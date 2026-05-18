import { Request, Response } from "express";
import prisma from "../config/database";

interface CallWebhookBody {
  callerPhone: string;
  destinationPhone: string;
  duration: number;
  status: string;
  recordingUrl?: string;
}

export const handleIncomingCall = async (req: Request, res: Response): Promise<void> => {
  const { callerPhone, destinationPhone, duration, status, recordingUrl } = req.body as CallWebhookBody;

  if (!callerPhone || !destinationPhone || !status) {
    res.status(400).json({ message: "Missing required fields: callerPhone, destinationPhone, status" });
    return;
  }

  try {
    const pro = await prisma.pro.findFirst({
      where: { phone: destinationPhone, isActive: true },
    });

    if (!pro) {
      res.status(404).json({ message: `No active Pro found for phone: ${destinationPhone}` });
      return;
    }

    const call = await prisma.call.create({
      data: {
        callerPhone,
        destinationPhone,
        duration: duration ?? 0,
        status,
        recordingUrl: recordingUrl ?? null,
        proId: pro.id,
      },
    });

    if (status === "missed") {
      // TODO: trigger SMS to Pro notifying them of a missed lead
      console.log(`[SMS PLACEHOLDER] Missed call from ${callerPhone} to Pro "${pro.name}" (${pro.phone}). Call ID: ${call.id}`);
    }

    res.status(201).json({ success: true, callId: call.id, proId: pro.id });
  } catch (error) {
    console.error("[webhook/call] Error:", error);
    res.status(500).json({ message: "Internal server error while processing call webhook" });
  }
};
