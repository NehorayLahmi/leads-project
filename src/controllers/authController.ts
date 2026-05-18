import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../config/database";
import { sendEmail } from "../services/emailService";

const JWT_SECRET = process.env.JWT_SECRET ?? "fallback_dev_secret_change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";
const BCRYPT_ROUNDS = 10;

// POST /api/auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ message: "שדות חסרים: email ו-password הם שדות חובה" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: "הסיסמה חייבת להכיל לפחות 6 תווים" });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ message: "כתובת האימייל כבר רשומה במערכת" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, passwordHash, role: "PRO" },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    res.status(201).json({ message: "המשתמש נרשם בהצלחה", user });
  } catch (error) {
    console.error("[auth/register] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת פנימית בעת הרשמה" });
  }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ message: "שדות חסרים: email ו-password הם שדות חובה" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ message: "פרטי הכניסה שגויים" });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ message: "פרטי הכניסה שגויים" });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );

    res.json({
      message: "התחברות בוצעה בהצלחה",
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("[auth/login] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת פנימית בעת התחברות" });
  }
};

// POST /api/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email: string };

  if (!email) {
    res.status(400).json({ message: "שדה חובה: email" });
    return;
  }

  // Always return 200 — never reveal if an email exists in the system
  const successMessage = "אם האימייל קיים במערכת, ישלח אליו קישור לאיפוס סיסמה";

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.json({ message: successMessage });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { email },
      data: { resetToken, resetTokenExpiry },
    });

    const resetLink = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${resetToken}`;

    await sendEmail(
      email,
      "איפוס סיסמה — מערכת הלידים",
      `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
          <h2>איפוס סיסמה</h2>
          <p>שלום,</p>
          <p>קיבלנו בקשה לאיפוס הסיסמה שלך. לחץ על הכפתור למטה לאיפוס:</p>
          <a href="${resetLink}"
             style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0;">
            אפס סיסמה
          </a>
          <p>הקישור בתוקף למשך שעה אחת.</p>
          <p>אם לא ביקשת איפוס סיסמה, התעלם מהודעה זו.</p>
          <hr/>
          <small style="color:#888;">הקישור הישיר: ${resetLink}</small>
        </div>
      `
    );

    res.json({ message: successMessage });
  } catch (error) {
    console.error("[auth/forgot-password] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת פנימית בעת איפוס הסיסמה" });
  }
};
