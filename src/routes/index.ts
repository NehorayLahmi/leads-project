import { Router } from "express";
import webhookRoutes from "./webhookRoutes";
import formRoutes from "./formRoutes";
import authRoutes from "./authRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/webhook", webhookRoutes);
router.use("/webhook", formRoutes);

export default router;
