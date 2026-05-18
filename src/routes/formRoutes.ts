import { Router } from "express";
import { handleFormLead } from "../controllers/formController";

const router = Router();

router.post("/form", handleFormLead);

export default router;
