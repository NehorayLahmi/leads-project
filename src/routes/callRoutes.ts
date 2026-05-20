import { Router } from "express";
import { getAllCalls } from "../controllers/callController";

const router = Router();

router.get("/", getAllCalls);

export default router;
