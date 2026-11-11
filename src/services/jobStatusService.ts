import prisma from "../config/database";

// "האם נסגרה עסקה" — משותף ללידים ולשיחות/וואטסאפ
export type JobKind = "lead" | "call";

export function parseJobKind(value: unknown): JobKind | null {
  return value === "lead" || value === "call" ? value : null;
}

/** מחזיר את ה-proId וה-chatId של בעל המקצוע המשויך, או null אם הרשומה לא קיימת */
export async function getJobOwner(kind: JobKind, id: string) {
  const select = { id: true, proId: true, pro: { select: { telegramChatId: true } } } as const;
  const rec = kind === "lead"
    ? await prisma.lead.findUnique({ where: { id }, select })
    : await prisma.call.findUnique({ where: { id }, select });
  if (!rec) return null;
  return { proId: rec.proId, telegramChatId: rec.pro?.telegramChatId ?? null };
}

/** מעדכן את הסטטוס. אם proId מסופק — מעדכן רק רשומה ששייכת לבעל המקצוע הזה. מחזיר false אם לא נמצאה. */
export async function setJobStatus(
  kind: JobKind,
  id: string,
  jobClosed: boolean | null,
  proId?: string
): Promise<boolean> {
  const where = { id, ...(proId ? { proId } : {}) };
  const data = { jobClosed, jobClosedAt: jobClosed === null ? null : new Date() };
  const { count } = kind === "lead"
    ? await prisma.lead.updateMany({ where, data })
    : await prisma.call.updateMany({ where, data });
  return count > 0;
}
