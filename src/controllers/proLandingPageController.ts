import { Response } from "express";
import prisma from "../config/database";
import { ProRequest } from "../middleware/isPro";

// GET /api/pros/:proId/landing-pages  — list all landing pages owned by this pro
export const getLandingPagesForPro = async (
  req: ProRequest,
  res: Response
): Promise<void> => {
  const proId = req.params.proId as string;

  if (req.proProfileId !== proId) {
    res.status(403).json({ message: "גישה נדחתה" });
    return;
  }

  try {
    const pages = await prisma.landingPage.findMany({
      where: { proId },
      orderBy: { updatedAt: "desc" },
    });
    res.json(pages);
  } catch (error) {
    console.error("[pro/landing-pages GET]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// PUT /api/pros/:proId/landing-pages/:pageId  — update text + image URLs
export const updateProLandingPage = async (
  req: ProRequest,
  res: Response
): Promise<void> => {
  const proId = req.params.proId as string;
  const pageId = req.params.pageId as string;

  if (req.proProfileId !== proId) {
    res.status(403).json({ message: "גישה נדחתה" });
    return;
  }

  const {
    mainTitle,
    subTitle,
    description,
    heroImage,
    profileImage,
    galleryImages,
  } = req.body as {
    mainTitle?: string;
    subTitle?: string;
    description?: string;
    heroImage?: string;
    profileImage?: string;
    galleryImages?: string; // stringified JSON array of { url, publicId }
  };

  try {
    // Ownership check: make sure the page belongs to this pro
    const existing = await prisma.landingPage.findUnique({
      where: { id: pageId },
      select: { proId: true },
    });
    if (!existing || existing.proId !== proId) {
      res.status(404).json({ message: "דף נחיתה לא נמצא" });
      return;
    }

    // Validate gallery max 10
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
        ...(mainTitle !== undefined && { mainTitle }),
        ...(subTitle !== undefined && { subTitle }),
        ...(description !== undefined && { description }),
        ...(heroImage !== undefined && { heroImage }),
        ...(profileImage !== undefined && { profileImage }),
        ...(galleryImages !== undefined && { galleryImages }),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("[pro/landing-pages PUT]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};
