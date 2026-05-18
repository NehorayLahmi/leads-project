import { Request, Response } from "express";
import prisma from "../config/database";
import { sendSMS } from "../services/smsService";

interface FormLeadBody {
  clientName: string;
  clientPhone: string;
  city: string;
  issueType: string;
}

export const handleFormLead = async (req: Request, res: Response): Promise<void> => {
  const { clientName, clientPhone, city, issueType } = req.body as FormLeadBody;

  if (!clientName || !clientPhone || !city || !issueType) {
    res.status(400).json({ message: "שדות חסרים: clientName, clientPhone, city, issueType הם שדות חובה" });
    return;
  }

  try {
    const pro = await prisma.pro.findFirst({
      where: { city, isActive: true },
    });

    if (pro) {
      const formLead = await prisma.formLead.create({
        data: {
          clientName,
          clientPhone,
          city,
          issueType,
          isSentToPro: true,
          proId: pro.id,
        },
      });

      await sendSMS(
        pro.phone,
        `שלום ${pro.name}, ליד חדש מהטופס! לקוח: ${clientName}, טלפון: ${clientPhone}, עיר: ${city}, סוג תקלה: ${issueType}. מזהה ליד: ${formLead.id}`
      );

      res.status(201).json({
        הצלחה: true,
        שויך: true,
        מזהה_ליד: formLead.id,
        בעל_מקצוע: { מזהה: pro.id, שם: pro.name, טלפון: pro.phone },
      });
    } else {
      const formLead = await prisma.formLead.create({
        data: {
          clientName,
          clientPhone,
          city,
          issueType,
          isSentToPro: false,
          proId: null,
        },
      });

      console.log(`[ליד לא משויך] לא נמצא בעל מקצוע פעיל בעיר "${city}". מזהה ליד: ${formLead.id} נשמר ללא שיוך.`);


      res.status(201).json({
        הצלחה: true,
        שויך: false,
        מזהה_ליד: formLead.id,
        הודעה: `לא נמצא בעל מקצוע פעיל בעיר: ${city}. הליד נשמר ללא שיוך.`,
      });
    }
  } catch (error) {
    console.error("[webhook/טופס] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת פנימית בעת עיבוד נתוני הטופס" });
  }
};
