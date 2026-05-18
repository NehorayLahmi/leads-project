import nodemailer, { Transporter } from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

const isSmtpConfigured =
  Boolean(SMTP_HOST) &&
  Boolean(SMTP_USER) &&
  Boolean(SMTP_PASS) &&
  SMTP_HOST !== "smtp.example.com";

let transporter: Transporter | null = null;
let devFromAddress = "dev@leads-system.com";

async function getTransporter(): Promise<{ transport: Transporter; from: string }> {
  if (isSmtpConfigured) {
    if (!transporter) {
      transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT ?? "587", 10),
        secure: parseInt(SMTP_PORT ?? "587", 10) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
    }
    return { transport: transporter, from: SMTP_FROM ?? SMTP_USER! };
  }

  // Dev fallback — Ethereal Email (free test inbox, no real emails sent)
  if (!transporter) {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    devFromAddress = testAccount.user;
    console.log("[EmailService — מצב פיתוח] נוצר חשבון Ethereal Email לבדיקות.");
    console.log(`  משתמש: ${testAccount.user}`);
    console.log(`  סיסמה: ${testAccount.pass}`);
    console.log(`  צפייה בהודעות: https://ethereal.email`);
  }
  return { transport: transporter, from: devFromAddress };
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const { transport, from } = await getTransporter();

    const info = await transport.sendMail({ from, to, subject, html });

    if (!isSmtpConfigured) {
      console.log(`[Email — מצב פיתוח] הודעה נשלחה לאתר הבדיקות.`);
      console.log(`  צפה בהודעה: ${nodemailer.getTestMessageUrl(info)}`);
    } else {
      console.log(`[Email נשלח] ל-${to}: ${subject}`);
    }
  } catch (err: any) {
    console.error(`[Email — שגיאה] שליחה ל-${to} נכשלה:`, err?.message ?? err);
  }
}
