import { Router } from "express";
import authRoutes from "./authRoutes";
import webhookRoutes from "./webhookRoutes";
import formRoutes from "./formRoutes";
import callRoutes from "./callRoutes";
import proRoutes from "./proRoutes";
import landingPageRoutes from "./landingPageRoutes";
import adminRoutes from "./adminRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/calls", callRoutes);
router.use("/pros", proRoutes);
router.use("/pages", landingPageRoutes);
router.use("/webhook", webhookRoutes);
router.use("/webhook", formRoutes);
router.use("/admin", adminRoutes);

export default router;
