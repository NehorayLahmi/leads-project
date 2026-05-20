import { Router } from "express";
import { handleIncomingCall, handleCallStatus } from "../controllers/webhookController";

const router = Router();

// Twilio routing webhook — returns TwiML, called synchronously on call arrival
router.post("/call", handleIncomingCall);

// Twilio post-call callback — logs the call after it ends
router.post("/call/status", handleCallStatus);

export default router;
