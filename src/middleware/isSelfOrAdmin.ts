import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "fallback_dev_secret_change_me";

/**
 * לנתיבים מהצורה /api/pros/:id — מנהל רשאי לגשת לכל נציג,
 * נציג רשאי לגשת רק לפרופיל של עצמו (req.params.id === proProfileId מהטוקן).
 */
export function isSelfOrAdmin(req: Request, res: Response, next: NextFunction): void {
  const token =
    req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : (req.cookies as Record<string, string>)?.auth_token;

  if (!token) {
    res.status(401).json({ message: "נדרשת אימות" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { role: string; proProfileId?: string };
    if (payload.role === "ADMIN") {
      next();
      return;
    }
    if (payload.role === "PRO" && payload.proProfileId && payload.proProfileId === req.params.id) {
      next();
      return;
    }
    res.status(403).json({ message: "גישה נדחתה" });
  } catch {
    res.status(401).json({ message: "טוקן לא תקין" });
  }
}
