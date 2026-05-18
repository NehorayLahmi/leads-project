import twilio from "twilio";

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

  try {
    await client.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to,
    });
    console.log(`[SMS נשלח] ל-${to}: ${message}`);
  } catch (err: any) {
    // Twilio error code 21608 = unverified number on trial account
    if (err?.code === 21608) {
      console.warn(`[SMS — מספר לא מאומת] ${to} אינו מאומת בחשבון Twilio הניסיוני. אמת את המספר בכתובת: twilio.com/user/account/phone-numbers/verified`);
    } else {
      console.error(`[SMS — שגיאה] שליחה ל-${to} נכשלה:`, err?.message ?? err);
    }
  }
}
