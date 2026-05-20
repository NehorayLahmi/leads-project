import { Request, Response } from "express";
import prisma from "../config/database";
import { sendSMS, toE164 } from "../services/smsService";

const ADMIN_FALLBACK_PHONE = process.env.ADMIN_FALLBACK_PHONE ?? "";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

function buildTwiML(dialTo: string, callerPhone: string, statusCallbackUrl: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `  <Dial record="record-from-answer"`,
    `        action="${statusCallbackUrl}"`,
    `        callerId="${callerPhone}">`,
    `    <Number>${dialTo}</Number>`,
    "  </Dial>",
    "</Response>",
  ].join("\n");
}

function errorTwiML(message = "השירות אינו זמין כרגע. אנא נסה שנית מאוחר יותר."): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `  <Say language="he-IL">${message}</Say>`,
    "</Response>",
  ].join("\n");
}

// ─── POST /api/webhook/call ───────────────────────────────────────────────────
// Twilio routing webhook — called synchronously when a call arrives.
// Must return TwiML immediately to instruct Twilio where to forward the call.
export const handleIncomingCall = async (req: Request, res: Response): Promise<void> => {
  // Twilio sends `To` and `From`; support both for manual testing
  const callerPhone    = (req.body.From ?? req.body.callerPhone ?? "") as string;
  const twilioNumber   = (req.body.To   ?? req.body.destinationPhone ?? "") as string;

  res.type("text/xml");

  if (!callerPhone || !twilioNumber) {
    res.send(errorTwiML());
    return;
  }

  try {
    // Step 1 — Find the LandingPage that owns this Twilio number
    const landingPage = await prisma.landingPage.findFirst({
      where: { twilioNumber },
      include: {
        pro: {
          select: { id: true, phone: true, firstName: true, isActive: true },
        },
      },
    });

    const statusCallbackUrl = `${APP_URL}/api/webhook/call/status`;

    // Step 2 — Route to pro or fall back to admin
    const activePhone = landingPage?.pro?.isActive
      ? landingPage.pro.phone
      : ADMIN_FALLBACK_PHONE;

    if (!activePhone) {
      console.error(`[webhook/call] No active pro and no ADMIN_FALLBACK_PHONE set. twilioNumber=${twilioNumber}`);
      res.send(errorTwiML());
      return;
    }

    const isForwarded = landingPage?.pro?.isActive ?? false;
    console.log(
      `[webhook/call] ${callerPhone} → ${twilioNumber} | routed to: ${activePhone} (${isForwarded ? "pro" : "admin fallback"})`
    );

    res.send(buildTwiML(toE164(activePhone), callerPhone, statusCallbackUrl));
  } catch (error) {
    console.error("[webhook/call] שגיאה:", error);
    res.send(errorTwiML());
  }
};

// ─── POST /api/webhook/call/status ───────────────────────────────────────────
// Twilio post-call callback — called by Twilio after the call ends.
// Logs the call record to the DB and sends missed-call SMS if needed.
export const handleCallStatus = async (req: Request, res: Response): Promise<void> => {
  const callerPhone    = (req.body.From ?? "") as string;
  const twilioNumber   = (req.body.To ?? "") as string;
  const callStatus     = (req.body.DialCallStatus ?? req.body.CallStatus ?? "unknown") as string;
  const duration       = parseInt(req.body.DialCallDuration ?? req.body.CallDuration ?? "0", 10);
  const recordingUrl   = (req.body.RecordingUrl ?? null) as string | null;

  res.type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response/>');

  try {
    // Re-look up the landing page to find the proId
    const landingPage = await prisma.landingPage.findFirst({
      where: { twilioNumber },
      include: {
        pro: {
          select: { id: true, phone: true, firstName: true, isActive: true },
        },
      },
    });

    const pro   = landingPage?.pro?.isActive ? landingPage.pro : null;
    const proId = pro?.id ?? null;

    // Log the call — always, even for fallback calls
    await prisma.call.create({
      data: {
        callerPhone,
        destinationPhone: twilioNumber,
        duration: isNaN(duration) ? 0 : duration,
        status: callStatus,
        recordingUrl,
        proId,
      },
    });

    // Send missed-call SMS to the pro
    if (pro && (callStatus === "no-answer" || callStatus === "busy" || callStatus === "failed")) {
      await sendSMS(
        pro.phone,
        `שלום ${pro.firstName}, שיחה שלא נענתה מהמספר ${callerPhone}. בדוק את הפאנל לפרטים.`
      );
    }

    console.log(`[webhook/call/status] logged — ${callerPhone} → ${twilioNumber} | status: ${callStatus} | duration: ${duration}s | proId: ${proId ?? "fallback"}`);
  } catch (error) {
    console.error("[webhook/call/status] שגיאה:", error);
  }
};
