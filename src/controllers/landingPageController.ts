import { Request, Response } from "express";
import prisma from "../config/database";

export const listLandingPageSlugs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const pages = await prisma.landingPage.findMany({
      where: { isDraft: false },
      select: { city: true, profession: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    res.json(pages);
  } catch {
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

export const getLandingPage = async (req: Request, res: Response): Promise<void> => {
  const profession = req.params.profession as string;
  const city = req.params.city as string;

  try {
    const page = await prisma.landingPage.findUnique({
      where: { city_profession: { city, profession } },
      include: {
        pro: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            city: true,
            profession: true,
            isActive: true,
          },
        },
      },
    });

    if (!page) {
      res.status(404).json({ message: `לא נמצא עמוד נחיתה עבור "${profession}" ב-"${city}"` });
      return;
    }

    // נציג כבוי — כפתורי החיוג וה-WhatsApp בדף מפנים למספר של המנהל במקום לנציג,
    // כך שהנציג לא מקבל פניות בזמן שהוא כבוי (טופס הלידים כבר מנותב למנהל בנפרד).
    if (!page.pro.isActive) {
      const fallback = process.env.ADMIN_FALLBACK_PHONE?.trim();
      if (fallback) {
        res.json({ ...page, twilioNumber: fallback, pro: { ...page.pro, phone: fallback }, usingFallback: true });
        return;
      }
      console.warn(`[pages] נציג כבוי ב-${profession}/${city} אבל ADMIN_FALLBACK_PHONE לא מוגדר — מוצג מספר הנציג`);
    }

    res.json(page);
  } catch (error) {
    console.error("[pages] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת בטעינת עמוד הנחיתה" });
  }
};
