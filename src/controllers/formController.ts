import { Request, Response } from "express";
import prisma from "../config/database";
import { notifyProAndMaybeAdmin, jobKeyboard } from "../services/telegramService";
import { sanitize, isValidName, isValidPhone } from "../utils/validate";

interface LeadBody {
  clientName: string;
  clientPhone: string;
  city: string;
  profession: string;
}

// POST /api/webhook/form
export const handleFormLead = async (req: Request, res: Response): Promise<void> => {
  const { clientName, clientPhone, city, profession } = req.body as LeadBody;

  const name  = sanitize(clientName  ?? "");
  const phone = sanitize(clientPhone ?? "");

  if (!name || !phone || !city || !profession) {
    res.status(400).json({ message: "שדות חסרים: clientName, clientPhone, city, profession הם שדות חובה" });
    return;
  }
  if (!isValidName(name)) {
    res.status(400).json({ message: "שם לא תקין — יש להזין שם מלא בעברית או באנגלית (2–50 תווים)" });
    return;
  }
  if (!isValidPhone(phone)) {
    res.status(400).json({ message: "מספר טלפון לא תקין — יש להזין מספר ישראלי תקני (לדוגמה: 050-1234567)" });
    return;
  }

  try {
    // Match by city + profession — both must align for an accurate assignment
    const pro = await prisma.proProfile.findFirst({
      where: { city, profession, isActive: true },
    });

    if (pro) {
      const lead = await prisma.lead.create({
        data: {
          clientName: name,
          clientPhone: phone,
          city,
          profession,
          status: "ASSIGNED",
          proId: pro.id,
        },
      });

      await notifyProAndMaybeAdmin(
        pro.telegramChatId,
        `🔔 <b>ליד חדש הגיע!</b>\n\n👤 <b>שם לקוח:</b> ${name}\n📞 <b>טלפון:</b> ${phone}\n📍 <b>עיר:</b> ${city}\n🛠 <b>שירות:</b> ${profession}`,
        jobKeyboard("lead", lead.id, null)
      );

      res.status(201).json({
        success: true,
        assigned: true,
        leadId: lead.id,
        pro: { id: pro.id, name: `${pro.firstName} ${pro.lastName}`, phone: pro.phone },
      });
    } else {
      const lead = await prisma.lead.create({
        data: {
          clientName: name,
          clientPhone: phone,
          city,
          profession,
          status: "NEW",
          proId: null,
        },
      });

      console.log(`[ליד לא משויך] לא נמצא נציג פעיל עבור "${profession}" ב-"${city}". מזהה ליד: ${lead.id}`);
      await notifyProAndMaybeAdmin(
        null,
        `⚠️ <b>ליד לא משויך!</b>\n\n👤 <b>שם לקוח:</b> ${name}\n📞 <b>טלפון:</b> ${phone}\n📍 <b>עיר:</b> ${city}\n🛠 <b>שירות:</b> ${profession}\n\nאין נציג פעיל — יש לטפל ידנית.`,
        jobKeyboard("lead", lead.id, null)
      );

      res.status(201).json({
        success: true,
        assigned: false,
        leadId: lead.id,
        message: `לא נמצא נציג פעיל עבור: ${profession} ב-${city}. הליד נשמר לעיבוד ידני.`,
      });
    }
  } catch (error) {
    console.error("[webhook/form] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת פנימית בעת עיבוד נתוני הטופס" });
  }
};
