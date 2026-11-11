import { Router } from "express";
import { logCallClick, logWhatsAppClick, handleTelegramCallback } from "../controllers/webhookController";

const router = Router();

router.post("/call-click", logCallClick);
router.post("/whatsapp-click", logWhatsAppClick);
router.post("/telegram-callback", handleTelegramCallback);

export default router;
