import { Router } from "express";
import { getAllCalls } from "../controllers/callController";
import { isAdmin } from "../middleware/isAdmin";

const router = Router();

// כל השיחות כולל מספרי טלפון — מנהל בלבד
router.get("/", isAdmin, getAllCalls);

export default router;
