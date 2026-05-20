import { Request, Response } from "express";
import prisma from "../config/database";
import { sendSMS } from "../services/smsService";

interface LeadBody {
  clientName: string;
  clientPhone: string;
  city: string;
  profession: string;
}

// POST /api/webhook/form
export const handleFormLead = async (req: Request, res: Response): Promise<void> => {
  const { clientName, clientPhone, city, profession } = req.body as LeadBody;

  if (!clientName || !clientPhone || !city || !profession) {
    res.status(400).json({
      message: "שדות חסרים: clientName, clientPhone, city, profession הם שדות חובה",
    });
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
          clientName,
          clientPhone,
          city,
          profession,
          status: "ASSIGNED",
          proId: pro.id,
        },
      });

      await sendSMS(
        pro.phone,
        `שלום ${pro.firstName}, ליד חדש! לקוח: ${clientName}, טלפון: ${clientPhone}, עיר: ${city}, מקצוע: ${profession}. מזהה: ${lead.id}`
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
          clientName,
          clientPhone,
          city,
          profession,
          status: "NEW",
          proId: null,
        },
      });

      console.log(`[ליד לא משויך] לא נמצא נציג פעיל עבור "${profession}" ב-"${city}". מזהה ליד: ${lead.id}`);

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
