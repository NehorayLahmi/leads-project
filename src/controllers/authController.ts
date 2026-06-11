import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../config/database";
import { sendEmail } from "../services/emailService";
import { sanitize, isValidEmail, isValidPhone, isValidName, isValidPassword } from "../utils/validate";

const JWT_SECRET = process.env.JWT_SECRET ?? "fallback_dev_secret_change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";
const BCRYPT_ROUNDS = 10;

// POST /api/auth/register
// Creates a User (auth) + ProProfile (business) in a single transaction.
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, firstName, lastName, phone, city, profession } = req.body as {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    city: string;
    profession: string;
  };

  const emailClean = sanitize(email ?? "").toLowerCase();
  const firstClean = sanitize(firstName ?? "");
  const lastClean = sanitize(lastName ?? "");
  const phoneClean = sanitize(phone ?? "");

  if (!emailClean || !password || !firstClean || !lastClean || !phoneClean || !city || !profession) {
    res.status(400).json({ message: "שדות חסרים: email, password, firstName, lastName, phone, city, profession הם שדות חובה" });
    return;
  }
  if (!isValidEmail(emailClean)) {
    res.status(400).json({ message: "כתובת אימייל לא תקינה" });
    return;
  }
  if (!isValidPassword(password)) {
    res.status(400).json({ message: "הסיסמה חייבת להכיל בין 6 ל-100 תווים" });
    return;
  }
  if (!isValidName(firstClean) || !isValidName(lastClean)) {
    res.status(400).json({ message: "שם לא תקין — יש להזין שם בעברית או באנגלית בלבד (2–50 תווים)" });
    return;
  }
  if (!isValidPhone(phoneClean)) {
    res.status(400).json({ message: "מספר טלפון לא תקין — יש להזין מספר ישראלי תקני (לדוגמה: 050-1234567)" });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: emailClean } });
    if (existing) {
      res.status(409).json({ message: "כתובת האימייל כבר רשומה במערכת" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: emailClean,
        passwordHash,
        role: "PRO",
        proProfile: {
          create: { firstName: firstClean, lastName: lastClean, phone: phoneClean, city, profession },
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        proProfile: {
          select: { id: true, firstName: true, lastName: true, phone: true, city: true, profession: true },
        },
      },
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

  const emailClean = sanitize(email ?? "").toLowerCase();

  if (!emailClean || !password) {
    res.status(400).json({ message: "שדות חסרים: email ו-password הם שדות חובה" });
    return;
  }
  if (!isValidEmail(emailClean)) {
    res.status(400).json({ message: "כתובת אימייל לא תקינה" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: emailClean },
      include: { proProfile: { select: { id: true, firstName: true, lastName: true, profession: true, city: true } } },
    });

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
      { userId: user.id, email: user.email, role: user.role, proProfileId: user.proProfile?.id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "התחברות בוצעה בהצלחה",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        proProfile: user.proProfile,
      },
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

  const successMessage = "אם האימייל קיים במערכת, ישלח אליו קישור לאיפוס סיסמה";

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.json({ message: successMessage });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: { resetToken, resetTokenExpiry },
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

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

// GET /api/auth/me
export const getMe = async (req: Request, res: Response): Promise<void> => {
  const token =
    req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : (req.cookies as Record<string, string>)?.auth_token;

  if (!token) {
    res.status(401).json({ message: "נדרשת אימות" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string; proProfileId?: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        proProfile: {
          select: { id: true, firstName: true, lastName: true, phone: true, city: true, profession: true, isActive: true },
        },
      },
    });
    if (!user) {
      res.status(401).json({ message: "משתמש לא נמצא" });
      return;
    }
    res.json({ user });
  } catch {
    res.status(401).json({ message: "טוקן לא תקין" });
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { token, password } = req.body as { token: string; password: string };

  if (!token || !password) {
    res.status(400).json({ message: "שדות חסרים: token ו-password הם שדות חובה" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: "הסיסמה חייבת להכיל לפחות 6 תווים" });
    return;
  }

  try {
    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
    });

    if (!user) {
      res.status(400).json({ message: "הקישור לאיפוס הסיסמה אינו תקין או פג תוקף" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });

    res.json({ message: "הסיסמה אופסה בהצלחה. כעת ניתן להתחבר עם הסיסמה החדשה." });
  } catch (error) {
    console.error("[auth/reset-password] שגיאה:", error);
    res.status(500).json({ message: "שגיאת שרת פנימית בעת איפוס הסיסמה" });
  }
};
