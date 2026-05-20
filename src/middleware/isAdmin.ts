import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "fallback_dev_secret_change_me";

export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ message: "נדרשת אימות" });
    return;
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { role: string };
    if (payload.role !== "ADMIN") {
      res.status(403).json({ message: "גישה נדחתה — נדרשת הרשאת מנהל" });
      return;
    }
    next();
  } catch {
    res.status(401).json({ message: "טוקן לא תקין" });
  }
}
