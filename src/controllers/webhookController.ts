import { Request, Response } from "express";
import prisma from "../config/database";
import { sendSMS } from "../services/smsService";

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
    res.status(400).json({ message: "שדות חסרים: callerPhone, destinationPhone, status הם שדות חובה" });
    return;
  }

  try {
    const pro = await prisma.pro.findFirst({
      where: { phone: destinationPhone, isActive: true },
    });

    if (!pro) {
      res.status(404).json({ message: `לא נמצא בעל מקצוע פעיל עם מספר הטלפון: ${destinationPhone}` });
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
      await sendSMS(
        pro.phone,
        `שלום ${pro.name}, שיחה שלא נענתה מהמספר ${callerPhone}. מזהה שיחה: ${call.id}`
      );
    }

    res.status(201).json({
      הצלחה: true,
      מזהה_שיחה: call.id,
      מזהה_בעל_מקצוע: pro.id,
    });
  } catch (error) {
    console.error("[webhook/שיחה] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת פנימית בעת עיבוד נתוני השיחה" });
  }
};
