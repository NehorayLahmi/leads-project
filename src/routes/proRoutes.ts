import { Router } from "express";
import { getAllPros, getProById, updateProStatus, connectTelegram, disconnectTelegram, linkTelegramCode, generateVerificationCode } from "../controllers/proController";
import {
  getLandingPagesForPro,
  updateProLandingPage,
} from "../controllers/proLandingPageController";
import { isPro } from "../middleware/isPro";
import { isAdmin } from "../middleware/isAdmin";
import { isSelfOrAdmin } from "../middleware/isSelfOrAdmin";
import { updateJobStatusPro } from "../controllers/jobStatusController";

const router = Router();

// רשימת כל הנציגים — מנהל בלבד; פרופיל ועדכון סטטוס — הנציג עצמו או מנהל
router.get("/", isAdmin, getAllPros);
router.get("/:id", isSelfOrAdmin, getProById);
router.patch("/:id", isSelfOrAdmin, updateProStatus);

router.post("/link-telegram", linkTelegramCode);
router.post("/generate-verification-code", isPro, generateVerificationCode);
router.post("/connect-telegram", isPro, connectTelegram);
router.post("/disconnect-telegram", isPro, disconnectTelegram);
router.patch("/job-status/:kind/:id", isPro, updateJobStatusPro);

// Pro CMS — landing page management (JWT-protected, ownership-enforced)
router.get("/:proId/landing-pages", isPro, getLandingPagesForPro);
router.put("/:proId/landing-pages/:pageId", isPro, updateProLandingPage);

export default router;
