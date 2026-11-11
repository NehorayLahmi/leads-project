import prisma from "../config/database";
import type { JobKind } from "./jobStatusService";

const BOT_TOKEN       = process.env.TELEGRAM_BOT_TOKEN ?? "";
const ADMIN_CHAT_ID   = process.env.TELEGRAM_CHAT_ID   ?? "";

type InlineKeyboard = { inline_keyboard: { text: string; callback_data: string }[][] };

async function callTelegram(method: string, payload: Record<string, unknown>): Promise<void> {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(err => console.error(`[telegram/${method}]`, err));
}

async function send(chatId: string, message: string, replyMarkup?: InlineKeyboard): Promise<void> {
  if (!chatId) return;
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: message,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export function isAdminChat(chatId: string): boolean {
  return !!ADMIN_CHAT_ID && chatId === ADMIN_CHAT_ID;
}

// ─── "האם נסגרה עסקה" — כפתורי סימון על הודעת ליד / שיחה / וואטסאפ ───────────
// callback_data: "job:l:<id>:1" (ליד) / "job:c:<id>:0" (שיחה)  — מוגבל ל-64 בתים בטלגרם.
// פורמט ישן "job:<leadId>:1" (הודעות שכבר נשלחו) עדיין נתמך ומתפרש כליד.
const JOB_CALLBACK_RE = /^job:(?:([lc]):)?([0-9a-f-]{36}):([01])$/i;

export function parseJobCallback(data: string): { kind: JobKind; id: string; jobClosed: boolean } | null {
  const m = JOB_CALLBACK_RE.exec(data);
  if (!m) return null;
  return { kind: m[1]?.toLowerCase() === "c" ? "call" : "lead", id: m[2], jobClosed: m[3] === "1" };
}

export function jobKeyboard(kind: JobKind, id: string, jobClosed: boolean | null): InlineKeyboard {
  const k = kind === "call" ? "c" : "l";
  return {
    inline_keyboard: [[
      { text: `${jobClosed === true  ? "☑️" : "⬜"} נסגרה עסקה`, callback_data: `job:${k}:${id}:1` },
      { text: `${jobClosed === false ? "☑️" : "⬜"} לא נסגרה`,   callback_data: `job:${k}:${id}:0` },
    ]],
  };
}

export async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  await callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

export async function editMessageReplyMarkup(
  chatId: string,
  messageId: number,
  replyMarkup: InlineKeyboard
): Promise<void> {
  await callTelegram("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup });
}

export async function sendTelegram(chatId: string | null | undefined, message: string): Promise<void> {
  const target = chatId?.trim() || ADMIN_CHAT_ID;
  await send(target, message);
}

export async function notifyProAndMaybeAdmin(
  proChatId: string | null | undefined,
  message: string,
  replyMarkup?: InlineKeyboard
): Promise<void> {
  if (proChatId) {
    await send(proChatId, message, replyMarkup);
  }

  if (!ADMIN_CHAT_ID) return;
  const settings = await prisma.settings.upsert({
    where:  { id: "singleton" },
    update: {},
    create: { id: "singleton", adminNotifyAll: true },
  });
  if (settings.adminNotifyAll) {
    await send(ADMIN_CHAT_ID, message, replyMarkup);
  }
}
