import { Router } from "express";
import { handleIncomingCall } from "../controllers/webhookController";

const router = Router();

router.post("/call", handleIncomingCall);

export default router;
