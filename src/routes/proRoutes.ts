import { Router } from "express";
import { getAllPros, getProById, updateProStatus, connectTelegram, linkTelegramCode, generateVerificationCode } from "../controllers/proController";
import {
  getLandingPagesForPro,
  updateProLandingPage,
} from "../controllers/proLandingPageController";
import { isPro } from "../middleware/isPro";

const router = Router();

router.get("/", getAllPros);
router.get("/:id", getProById);
router.patch("/:id", updateProStatus);

router.post("/link-telegram", linkTelegramCode);
router.post("/generate-verification-code", isPro, generateVerificationCode);
router.post("/connect-telegram", isPro, connectTelegram);

// Pro CMS — landing page management (JWT-protected, ownership-enforced)
router.get("/:proId/landing-pages", isPro, getLandingPagesForPro);
router.put("/:proId/landing-pages/:pageId", isPro, updateProLandingPage);

export default router;
