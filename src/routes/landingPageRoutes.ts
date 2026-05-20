import { Router } from "express";
import { getLandingPage } from "../controllers/landingPageController";

const router = Router();

router.get("/:profession/:city", getLandingPage);

export default router;
