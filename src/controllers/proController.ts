import { Request, Response } from "express";
import crypto from "crypto";
import prisma from "../config/database";
import type { ProRequest } from "../middleware/isPro";

// POST /api/pros/generate-verification-code  (isPro)
export const generateVerificationCode = async (req: ProRequest, res: Response): Promise<void> => {
  const code = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8-char hex
  try {
    await prisma.proProfile.update({
      where: { id: req.proProfileId! },
      data: { verificationCode: code },
    });
    res.json({ code });
  } catch (error) {
    console.error("[generate-verification-code]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// GET /api/pros/:id  — full profile with leads + calls for dashboard
export const getProById = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  try {
    const pro = await prisma.proProfile.findUnique({
      where: { id },
      include: {
        user: { select: { email: true } },
        leads: { orderBy: { createdAt: "desc" } },
        calls: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!pro) {
      res.status(404).json({ message: "נציג לא נמצא" });
      return;
    }
    res.json(pro);
  } catch (error) {
    console.error("[pros/:id] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// GET /api/pros
export const getAllPros = async (_req: Request, res: Response): Promise<void> => {
  try {
    const pros = await prisma.proProfile.findMany({
      orderBy: { lastName: "asc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        city: true,
        profession: true,
        pricePerLead: true,
        isActive: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    });
    res.json(pros);
  } catch (error) {
    console.error("[pros] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת בטעינת רשימת הנציגים" });
  }
};

// POST /api/pros/link-telegram  (public — called by Telegram webhook)
export const linkTelegramCode = async (req: Request, res: Response): Promise<void> => {
  const { code, chatId } = req.body as { code?: string; chatId?: string };

  if (!code || !chatId) {
    res.status(400).json({ message: "חסרים code ו-chatId" });
    return;
  }

  try {
    const pro = await prisma.proProfile.findFirst({ where: { verificationCode: code } });
    if (!pro) {
      res.status(404).json({ message: "קוד לא נמצא" });
      return;
    }
    await prisma.proProfile.update({
      where: { id: pro.id },
      data: { telegramChatId: chatId, verificationCode: null },
    });
    res.json({ message: "חובר בהצלחה" });
  } catch (error) {
    console.error("[link-telegram]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// POST /api/pros/connect-telegram  (isPro)
export const connectTelegram = async (req: ProRequest, res: Response): Promise<void> => {
  const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body as {
    id: string; first_name?: string; last_name?: string; username?: string;
    photo_url?: string; auth_date: string; hash: string;
  };

  if (!id || !auth_date || !hash) {
    res.status(400).json({ message: "נתוני טלגרם חסרים" });
    return;
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
  if (!BOT_TOKEN) {
    res.status(500).json({ message: "TELEGRAM_BOT_TOKEN לא מוגדר" });
    return;
  }

  // Verify Telegram hash (HMAC-SHA256 with SHA256(bot_token) as key)
  const data: Record<string, string> = { id, auth_date };
  if (first_name) data.first_name = first_name;
  if (last_name)  data.last_name  = last_name;
  if (username)   data.username   = username;
  if (photo_url)  data.photo_url  = photo_url;

  const checkString = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join("\n");
  const secretKey   = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  const expected    = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

  if (expected !== hash) {
    res.status(403).json({ message: "חתימת טלגרם לא תקינה" });
    return;
  }
  if (Date.now() / 1000 - parseInt(auth_date, 10) > 86400) {
    res.status(403).json({ message: "אימות טלגרם פג תוקף — נסה שוב" });
    return;
  }

  try {
    await prisma.proProfile.update({
      where: { id: req.proProfileId! },
      data: { telegramChatId: id.toString() },
    });
    res.json({ message: "טלגרם חובר בהצלחה", telegramChatId: id.toString() });
  } catch (error) {
    console.error("[connect-telegram]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// PATCH /api/pros/:id/status
export const updateProStatus = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { isActive } = req.body as { isActive: boolean };

  if (typeof isActive !== "boolean") {
    res.status(400).json({ message: "שדה חובה: isActive (boolean)" });
    return;
  }

  try {
    const pro = await prisma.proProfile.findUnique({ where: { id } });
    if (!pro) {
      res.status(404).json({ message: "נציג לא נמצא" });
      return;
    }

    // Block pro from re-enabling if admin has locked the account
    if (isActive && pro.adminLocked) {
      res.status(403).json({ message: "החשבון הושבת על ידי מנהל המערכת" });
      return;
    }

    const updated = await prisma.proProfile.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        city: true,
        profession: true,
        pricePerLead: true,
        isActive: true,
        adminLocked: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("[pros/status] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת בעדכון סטטוס הנציג" });
  }
};
