import { Request, Response } from "express";
import prisma from "../config/database";
import {
  notifyProAndMaybeAdmin,
  jobKeyboard,
  parseJobCallback,
  answerCallbackQuery,
  editMessageReplyMarkup,
  isAdminChat,
} from "../services/telegramService";
import { getJobOwner, setJobStatus } from "../services/jobStatusService";

async function resolvePro(landingPageId: string, destinationPhone: string) {
  const landingPage = landingPageId
    ? await prisma.landingPage.findUnique({
        where: { id: landingPageId },
        include: { pro: { select: { id: true, telegramChatId: true, isActive: true } } },
      })
    : await prisma.landingPage.findFirst({
        where: { twilioNumber: destinationPhone },
        include: { pro: { select: { id: true, telegramChatId: true, isActive: true } } },
      });
  const pro = (landingPage?.pro?.isActive ? landingPage.pro : null) ?? null;
  return { pro, proId: pro?.id ?? null };
}

// POST /api/webhook/call-click
export const logCallClick = async (req: Request, res: Response): Promise<void> => {
  const callerPhone      = (req.body.callerPhone ?? "") as string;
  const destinationPhone = (req.body.destinationPhone ?? "") as string;
  const landingPageId    = (req.body.landingPageId ?? "") as string;

  try {
    const { pro, proId } = await resolvePro(landingPageId, destinationPhone);

    const call = await prisma.call.create({
      data: { callerPhone, destinationPhone, duration: 0, status: "initiated", recordingUrl: null, type: "PHONE", proId },
    });

    await notifyProAndMaybeAdmin(
      pro?.telegramChatId,
      `📞 <b>שיחה נכנסת!</b>\n📱 מתקשר: ${callerPhone || "לא ידוע"}\n☎️ יעד: ${destinationPhone}`,
      jobKeyboard("call", call.id, null)
    );

    console.log(`[call-click] ${callerPhone} → ${destinationPhone} | proId: ${proId ?? "unknown"}`);
    res.status(201).json({ message: "שיחה נרשמה" });
  } catch (error) {
    console.error("[call-click] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// POST /api/webhook/whatsapp-click
export const logWhatsAppClick = async (req: Request, res: Response): Promise<void> => {
  const destinationPhone = (req.body.destinationPhone ?? "") as string;
  const landingPageId    = (req.body.landingPageId ?? "") as string;

  try {
    const { pro, proId } = await resolvePro(landingPageId, destinationPhone);

    const call = await prisma.call.create({
      data: { callerPhone: "", destinationPhone, duration: 0, status: "initiated", recordingUrl: null, type: "WHATSAPP", proId },
    });

    await notifyProAndMaybeAdmin(
      pro?.telegramChatId,
      `💬 <b>קליק WhatsApp!</b>\n📱 מספר יעד: ${destinationPhone}`,
      jobKeyboard("call", call.id, null)
    );

    console.log(`[whatsapp-click] → ${destinationPhone} | proId: ${proId ?? "unknown"}`);
    res.status(201).json({ message: "קליק WhatsApp נרשם" });
  } catch (error) {
    console.error("[whatsapp-click] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
};

// POST /api/webhook/telegram-callback
// נקרא ע"י ה-webhook של טלגרם (ב-Next.js) כשנלחץ כפתור "נסגרה עסקה / לא נסגרה" בהודעת ליד/שיחה.
// Body: { callbackQueryId, data, chatId, messageId }
export const handleTelegramCallback = async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.INTERNAL_API_SECRET;
  if (secret && req.headers["x-internal-secret"] !== secret) {
    res.status(401).json({ message: "unauthorized" });
    return;
  }

  const { callbackQueryId, data, chatId, messageId } = req.body as {
    callbackQueryId?: string; data?: string; chatId?: string | number; messageId?: number;
  };
  if (!callbackQueryId || !data || !chatId) {
    res.status(400).json({ message: "חסרים שדות" });
    return;
  }

  const parsed = parseJobCallback(data);
  if (!parsed) {
    await answerCallbackQuery(callbackQueryId, "פעולה לא מוכרת");
    res.json({ ok: true });
    return;
  }
  const { kind, id, jobClosed } = parsed;
  const chat = String(chatId);
  const what = kind === "lead" ? "הליד" : "השיחה";

  try {
    const owner = await getJobOwner(kind, id);
    if (!owner) {
      await answerCallbackQuery(callbackQueryId, `${what} לא נמצא/ה (ייתכן שנמחק/ה)`);
      res.json({ ok: true });
      return;
    }

    // רק בעל המקצוע המשויך או המנהל רשאים לעדכן
    if (owner.telegramChatId !== chat && !isAdminChat(chat)) {
      await answerCallbackQuery(callbackQueryId, "אין הרשאה לעדכן רשומה זו");
      res.status(403).json({ message: "forbidden" });
      return;
    }

    await setJobStatus(kind, id, jobClosed);

    await answerCallbackQuery(callbackQueryId, jobClosed ? "✅ סומן: נסגרה עסקה" : "סומן: לא נסגרה עסקה");
    if (messageId) {
      await editMessageReplyMarkup(chat, messageId, jobKeyboard(kind, id, jobClosed));
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("[telegram-callback] שגיאה:", error);
    await answerCallbackQuery(callbackQueryId, "שגיאת שרת — נסה שוב");
    res.status(500).json({ message: "שגיאת שרת" });
  }
};
