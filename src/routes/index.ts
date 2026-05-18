import { Router } from "express";
import webhookRoutes from "./webhookRoutes";

const router = Router();

router.use("/webhook", webhookRoutes);

export default router;
