import { Request, Response } from "express";
import prisma from "../config/database";

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
