import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../config/database";
import { sendTelegram } from "../services/telegramService";

// GET /api/admin/stats
export const getDashboardStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalLeads, totalCalls, activePros, allPros] = await Promise.all([
      prisma.lead.count(),
      prisma.call.count(),
      prisma.proProfile.count({ where: { isActive: true } }),
      prisma.proProfile.findMany({
        select: {
          pricePerLead: true,
          _count: { select: { leads: true, calls: true } },
        },
      }),
    ]);

    const fallbackCalls = await prisma.call.count({ where: { proId: null } });

    const totalRevenue = allPros.reduce((sum, pro) => {
      return sum + (pro._count.leads + pro._count.calls) * pro.pricePerLead;
    }, 0);

    res.json({ totalLeads, totalCalls, fallbackCalls, activePros, totalRevenue });
  } catch (error) {
    console.error("[admin/stats]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// GET /api/admin/pros
export const getAllProsAdmin = async (_req: Request, res: Response): Promise<void> => {
  try {
    const pros = await prisma.proProfile.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true } },
        _count: { select: { leads: true, calls: true, landingPages: true } },
      },
    });
    res.json(pros);
  } catch (error) {
    console.error("[admin/pros GET]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// POST /api/admin/pros
export const createPro = async (req: Request, res: Response): Promise<void> => {
  const { email, password, firstName, lastName, phone, city, profession, pricePerLead } =
    req.body as {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone: string;
      city: string;
      profession: string;
      pricePerLead?: number;
    };

  if (!email || !password || !firstName || !lastName || !phone || !city || !profession) {
    res.status(400).json({ message: "כל השדות חובה" });
    return;
  }

  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      res.status(409).json({ message: "כתובת האימייל כבר קיימת" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "PRO",
        proProfile: {
          create: {
            firstName,
            lastName,
            phone,
            city,
            profession,
            pricePerLead: pricePerLead ?? 0,
          },
        },
      },
      include: {
        proProfile: true,
      },
    });

    res.status(201).json({ userId: user.id, proProfileId: user.proProfile?.id });
  } catch (error) {
    console.error("[admin/pros POST]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// PATCH /api/admin/pros/:id
export const updatePro = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { firstName, lastName, phone, city, profession, pricePerLead, telegramChatId, verificationCode } = req.body as {
    firstName?: string;
    lastName?: string;
    phone?: string;
    city?: string;
    profession?: string;
    pricePerLead?: number;
    telegramChatId?: string | null;
    verificationCode?: string | null;
  };

  try {
    const updated = await prisma.proProfile.update({
      where: { id },
      data: {
        firstName, lastName, phone, city, profession, pricePerLead,
        ...(telegramChatId   !== undefined && { telegramChatId:   telegramChatId   || null }),
        ...(verificationCode !== undefined && { verificationCode: verificationCode || null }),
      },
      include: { user: { select: { email: true } } },
    });
    res.json(updated);
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      res.status(404).json({ message: "נציג לא נמצא" });
      return;
    }
    console.error("[admin/pros PATCH]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// PATCH /api/admin/pros/:id/toggle-status
export const toggleProStatus = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    const pro = await prisma.proProfile.findUnique({ where: { id }, select: { isActive: true } });
    if (!pro) {
      res.status(404).json({ message: "נציג לא נמצא" });
      return;
    }
    const turningOff = pro.isActive;
    const updated = await prisma.proProfile.update({
      where: { id },
      data: {
        isActive: !pro.isActive,
        // When admin disables → lock so pro can't re-enable; when enabling → release lock
        adminLocked: turningOff,
      },
      select: { id: true, isActive: true, adminLocked: true },
    });
    res.json(updated);
  } catch (error) {
    console.error("[admin/pros toggle]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// DELETE /api/admin/pros/:id
export const deletePro = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    const pro = await prisma.proProfile.findUnique({
      where: { id },
      select: { userId: true, _count: { select: { landingPages: true } } },
    });
    if (!pro) {
      res.status(404).json({ message: "נציג לא נמצא" });
      return;
    }
    if (pro._count.landingPages > 0) {
      res.status(409).json({ message: "לא ניתן למחוק — לנציג יש דפי נחיתה פעילים" });
      return;
    }

    await prisma.$transaction([
      prisma.lead.updateMany({ where: { proId: id }, data: { proId: null } }),
      prisma.call.updateMany({ where: { proId: id }, data: { proId: null } }),
      prisma.proProfile.delete({ where: { id } }),
      prisma.user.delete({ where: { id: pro.userId } }),
    ]);

    res.json({ message: "נציג נמחק בהצלחה" });
  } catch (error) {
    console.error("[admin/pros DELETE]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// GET /api/admin/pros/:proId  — single pro (for CMS header display)
export const getSingleProAdmin = async (req: Request, res: Response): Promise<void> => {
  const proId = req.params.proId as string;
  try {
    const pro = await prisma.proProfile.findUnique({
      where: { id: proId },
      include: { user: { select: { email: true } } },
    });
    if (!pro) {
      res.status(404).json({ message: "נציג לא נמצא" });
      return;
    }
    res.json(pro);
  } catch (error) {
    console.error("[admin/pros/:proId GET]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// GET /api/admin/pros/:proId/landing-pages
export const getProLandingPagesAdmin = async (req: Request, res: Response): Promise<void> => {
  const proId = req.params.proId as string;
  try {
    const pages = await prisma.landingPage.findMany({
      where: { proId },
      orderBy: { updatedAt: "desc" },
    });
    res.json(pages);
  } catch (error) {
    console.error("[admin/pros/:proId/landing-pages GET]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// PUT /api/admin/pros/:proId/landing-pages/:pageId
export const updateProLandingPageAdmin = async (req: Request, res: Response): Promise<void> => {
  const proId = req.params.proId as string;
  const pageId = req.params.pageId as string;
  const { mainTitle, subTitle, description, heroImage, profileImage, galleryImages, twilioNumber } =
    req.body as {
      mainTitle?: string;
      subTitle?: string;
      description?: string;
      heroImage?: string;
      profileImage?: string | null;
      galleryImages?: string;
      twilioNumber?: string;
    };

  try {
    const existing = await prisma.landingPage.findUnique({
      where: { id: pageId },
      select: { proId: true },
    });
    if (!existing || existing.proId !== proId) {
      res.status(404).json({ message: "דף נחיתה לא נמצא" });
      return;
    }

    if (galleryImages !== undefined) {
      try {
        const arr = JSON.parse(galleryImages);
        if (!Array.isArray(arr) || arr.length > 10) {
          res.status(400).json({ message: "גלריה: מקסימום 10 תמונות" });
          return;
        }
      } catch {
        res.status(400).json({ message: "galleryImages אינו JSON תקני" });
        return;
      }
    }

    const updated = await prisma.landingPage.update({
      where: { id: pageId },
      data: {
        ...(mainTitle     !== undefined && { mainTitle }),
        ...(subTitle      !== undefined && { subTitle }),
        ...(description   !== undefined && { description }),
        ...(heroImage     !== undefined && { heroImage }),
        ...(profileImage  !== undefined && { profileImage }),
        ...(galleryImages !== undefined && { galleryImages }),
        ...(twilioNumber  !== undefined && twilioNumber.trim() !== "" && { twilioNumber: twilioNumber.trim() }),
      },
    });
    res.json(updated);
  } catch (error) {
    console.error("[admin/pros/:proId/landing-pages PUT]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// POST /api/admin/landing-pages
export const createLandingPage = async (req: Request, res: Response): Promise<void> => {
  const {
    mainTitle, subTitle, description, twilioNumber,
    city, profession, proId,
    heroImage, profileImage, galleryImages,
  } = req.body as {
    mainTitle: string; subTitle?: string; description?: string;
    twilioNumber: string; city: string; profession: string; proId: string;
    heroImage?: string; profileImage?: string; galleryImages?: string;
  };

  if (!mainTitle || !twilioNumber || !city || !profession || !proId) {
    res.status(400).json({ message: "שדות חובה: mainTitle, twilioNumber, city, profession, proId" });
    return;
  }

  try {
    const pro = await prisma.proProfile.findUnique({ where: { id: proId } });
    if (!pro) {
      res.status(404).json({ message: "נציג לא נמצא" });
      return;
    }

    const page = await prisma.landingPage.create({
      data: {
        mainTitle,
        subTitle: subTitle ?? "",
        description: description ?? "",
        twilioNumber,
        city,
        profession,
        proId,
        heroImage: heroImage ?? "",
        profileImage: profileImage ?? null,
        galleryImages: galleryImages ?? "[]",
      },
    });
    res.status(201).json(page);
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      res.status(409).json({ message: "דף נחיתה עם מספר טויליו זה כבר קיים" });
      return;
    }
    console.error("[admin/landing-pages POST]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// GET /api/admin/landing-pages
export const getAllLandingPages = async (_req: Request, res: Response): Promise<void> => {
  try {
    const pages = await prisma.landingPage.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        pro: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    res.json(pages);
  } catch (error) {
    console.error("[admin/landing-pages GET]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// PATCH /api/admin/landing-pages/:id/assign
export const assignLandingPage = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { proId } = req.body as { proId: string };
  if (!proId) {
    res.status(400).json({ message: "שדה חובה: proId" });
    return;
  }
  try {
    const updated = await prisma.landingPage.update({
      where: { id },
      data: { proId },
      include: { pro: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(updated);
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      res.status(404).json({ message: "דף נחיתה לא נמצא" });
      return;
    }
    console.error("[admin/landing-pages assign]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// GET /api/admin/calls
export const getAllCallsAdmin = async (_req: Request, res: Response): Promise<void> => {
  try {
    const calls = await prisma.call.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        pro: { select: { firstName: true, lastName: true, phone: true, city: true, profession: true } },
      },
    });
    res.json(calls);
  } catch (error) {
    console.error("[admin/calls GET]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// POST /api/admin/telegram/broadcast
export const telegramBroadcast = async (req: Request, res: Response): Promise<void> => {
  const { message } = req.body as { message?: string };
  if (!message?.trim()) {
    res.status(400).json({ message: "שדה חובה: message" });
    return;
  }
  try {
    const pros = await prisma.proProfile.findMany({
      where: { telegramChatId: { not: null } },
      select: { telegramChatId: true },
    });
    await Promise.all(pros.map(p => sendTelegram(p.telegramChatId, message.trim())));
    res.json({ sent: pros.length });
  } catch (error) {
    console.error("[telegram/broadcast]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// POST /api/admin/telegram/send/:proId
export const telegramSendToPro = async (req: Request, res: Response): Promise<void> => {
  const { proId } = req.params;
  const { message } = req.body as { message?: string };
  if (!message?.trim()) {
    res.status(400).json({ message: "שדה חובה: message" });
    return;
  }
  try {
    const pro = await prisma.proProfile.findUnique({
      where: { id: proId },
      select: { telegramChatId: true, firstName: true, lastName: true },
    });
    if (!pro) { res.status(404).json({ message: "נציג לא נמצא" }); return; }
    if (!pro.telegramChatId) { res.status(400).json({ message: "לנציג אין טלגרם מחובר" }); return; }
    await sendTelegram(pro.telegramChatId, message.trim());
    res.json({ ok: true });
  } catch (error) {
    console.error("[telegram/send]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// GET /api/admin/settings
export const getSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.settings.upsert({
      where:  { id: "singleton" },
      update: {},
      create: { id: "singleton", adminNotifyAll: true },
    });
    res.json(settings);
  } catch (error) {
    console.error("[admin/settings GET]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// PATCH /api/admin/settings
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  const { adminNotifyAll } = req.body as { adminNotifyAll: boolean };
  if (typeof adminNotifyAll !== "boolean") {
    res.status(400).json({ message: "שדה חובה: adminNotifyAll (boolean)" });
    return;
  }
  try {
    const settings = await prisma.settings.upsert({
      where:  { id: "singleton" },
      update: { adminNotifyAll },
      create: { id: "singleton", adminNotifyAll },
    });
    res.json(settings);
  } catch (error) {
    console.error("[admin/settings PATCH]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// GET /api/admin/leads
export const getAllLeadsAdmin = async (_req: Request, res: Response): Promise<void> => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        pro: { select: { firstName: true, lastName: true, phone: true, city: true, profession: true } },
      },
    });
    res.json(leads);
  } catch (error) {
    console.error("[admin/leads GET]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};
