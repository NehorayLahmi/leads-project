import { Request, Response } from "express";
import prisma from "../config/database";

// GET /api/calls
export const getAllCalls = async (_req: Request, res: Response): Promise<void> => {
  try {
    const calls = await prisma.call.findMany({
      include: {
        pro: { select: { firstName: true, lastName: true, phone: true, city: true, profession: true } },
      },
      orderBy: { id: "desc" },
    });
    res.json(calls);
  } catch (error) {
    console.error("[calls] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת בטעינת יומן השיחות" });
  }
};
