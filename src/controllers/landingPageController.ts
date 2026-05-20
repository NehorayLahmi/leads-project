import { Request, Response } from "express";
import prisma from "../config/database";

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

    res.json(page);
  } catch (error) {
    console.error("[pages] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת בטעינת עמוד הנחיתה" });
  }
};
