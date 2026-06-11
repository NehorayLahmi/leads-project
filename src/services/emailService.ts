import nodemailer from "nodemailer";
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Lumina <onboarding@resend.dev>";

let resendClient: Resend | null = null;
let devTransporter: nodemailer.Transporter | null = null;
let devFromAddress = "dev@leads-system.com";

async function getDevTransporter(): Promise<{ transport: nodemailer.Transporter; from: string }> {
  if (!devTransporter) {
    const testAccount = await nodemailer.createTestAccount();
    devTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    devFromAddress = testAccount.user;
    console.log("[EmailService — מצב פיתוח] נוצר חשבון Ethereal Email לבדיקות.");
    console.log(`  משתמש: ${testAccount.user}`);
    console.log(`  צפייה בהודעות: https://ethereal.email`);
  }
  return { transport: devTransporter, from: devFromAddress };
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    if (RESEND_API_KEY) {
      if (!resendClient) resendClient = new Resend(RESEND_API_KEY);
      await resendClient.emails.send({ from: EMAIL_FROM, to, subject, html });
      console.log(`[Email נשלח] ל-${to}: ${subject}`);
    } else {
      // Dev fallback — Ethereal Email (no real emails sent)
      const { transport, from } = await getDevTransporter();
      const info = await transport.sendMail({ from, to, subject, html });
      console.log(`[Email — מצב פיתוח] הודעה נשלחה לאתר הבדיקות.`);
      console.log(`  צפה בהודעה: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err: any) {
    console.error(`[Email — שגיאה] שליחה ל-${to} נכשלה:`, err?.message ?? err);
  }
}
