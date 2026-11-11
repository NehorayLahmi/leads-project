import { Request, Response } from "express";
import type { ProRequest } from "../middleware/isPro";
import { parseJobKind, setJobStatus } from "../services/jobStatusService";

// Body: { jobClosed: true | false | null }  (null = איפוס ל"ממתין לעדכון")
async function handle(req: Request, res: Response, proId?: string): Promise<void> {
  const kind = parseJobKind(req.params.kind);
  const id = req.params.id as string;
  const { jobClosed } = (req.body ?? {}) as { jobClosed?: unknown };

  if (!kind) {
    res.status(400).json({ message: "סוג לא תקין — lead או call" });
    return;
  }
  if (jobClosed !== true && jobClosed !== false && jobClosed !== null) {
    res.status(400).json({ message: "שדה חובה: jobClosed (true / false / null)" });
    return;
  }

  try {
    const ok = await setJobStatus(kind, id, jobClosed, proId);
    if (!ok) {
      res.status(404).json({ message: "הרשומה לא נמצאה" });
      return;
    }
    res.json({ id, kind, jobClosed });
  } catch (error) {
    console.error("[job-status PATCH]", error);
    res.status(500).json({ message: "שגיאת שרת" });
  }
}

// PATCH /api/admin/job-status/:kind/:id
export const updateJobStatusAdmin = (req: Request, res: Response) => handle(req, res);

// PATCH /api/pros/job-status/:kind/:id  (isPro — רק רשומות של בעל המקצוע המחובר)
export const updateJobStatusPro = (req: ProRequest, res: Response) => handle(req, res, req.proProfileId!);
