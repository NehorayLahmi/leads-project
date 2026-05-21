import { Router } from "express";
import { register, login, forgotPassword, resetPassword, getMe } from "../controllers/authController";

const router = Router();

router.get("/me", getMe);
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
