import twilio from "twilio";

export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+972${digits.slice(1)}`;
  return phone; // already formatted or unrecognized — pass through
}

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

const isTwilioConfigured =
  Boolean(TWILIO_ACCOUNT_SID) &&
  Boolean(TWILIO_AUTH_TOKEN) &&
  Boolean(TWILIO_PHONE_NUMBER) &&
  TWILIO_ACCOUNT_SID !== "your_sid_here" &&
  TWILIO_AUTH_TOKEN !== "your_token_here" &&
  TWILIO_PHONE_NUMBER !== "your_number_here";

const client = isTwilioConfigured
  ? twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!)
  : null;

export async function sendSMS(to: string, message: string): Promise<void> {
  if (!client || !TWILIO_PHONE_NUMBER) {
    console.warn(`[SMS — מצב פיתוח] מפתחות Twilio לא הוגדרו. ההודעה לא נשלחה.\nנמען: ${to}\nתוכן: ${message}`);
    return;
  }

  const e164 = toE164(to);
  try {
    await client.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: e164,
    });
    console.log(`[SMS נשלח] ל-${e164}: ${message}`);
  } catch (err: any) {
    // Twilio error code 21608 = unverified number on trial account
    if (err?.code === 21608) {
      console.warn(`[SMS — מספר לא מאומת] ${to} אינו מאומת בחשבון Twilio הניסיוני. אמת את המספר בכתובת: twilio.com/user/account/phone-numbers/verified`);
    } else {
      console.error(`[SMS — שגיאה] שליחה ל-${to} נכשלה:`, err?.message ?? err);
    }
  }
}
