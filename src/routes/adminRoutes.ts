import { Router } from "express";
import { isAdmin } from "../middleware/isAdmin";
import {
  getDashboardStats,
  getAllProsAdmin,
  getSingleProAdmin,
  createPro,
  updatePro,
  toggleProStatus,
  deletePro,
  getProLandingPagesAdmin,
  updateProLandingPageAdmin,
  createLandingPage,
  getAllLandingPages,
  assignLandingPage,
  deleteLandingPage,
  toggleDraftLandingPage,
  getAllCallsAdmin,
  getAllLeadsAdmin,
  deleteLeadAdmin,
  disconnectProTelegramAdmin,
  getSettings,
  updateSettings,
  telegramBroadcast,
  telegramSendToPro,
} from "../controllers/adminController";
import { updateJobStatusAdmin } from "../controllers/jobStatusController";

const router = Router();

router.use(isAdmin);

router.get("/stats", getDashboardStats);

router.get("/pros", getAllProsAdmin);
router.post("/pros", createPro);
// Single-pro routes must come before /:id generic routes to avoid conflicts
router.get("/pros/:proId/landing-pages", getProLandingPagesAdmin);
router.put("/pros/:proId/landing-pages/:pageId", updateProLandingPageAdmin);
router.get("/pros/:proId", getSingleProAdmin);
router.patch("/pros/:id", updatePro);
router.patch("/pros/:id/toggle-status", toggleProStatus);
router.delete("/pros/:id/telegram", disconnectProTelegramAdmin);
router.delete("/pros/:id", deletePro);

router.post("/landing-pages", createLandingPage);
router.get("/landing-pages", getAllLandingPages);
router.patch("/landing-pages/:id/assign", assignLandingPage);
router.patch("/landing-pages/:id/draft", toggleDraftLandingPage);
router.delete("/landing-pages/:id", deleteLandingPage);

router.get("/calls", getAllCallsAdmin);
router.get("/leads", getAllLeadsAdmin);
router.delete("/leads/:id", deleteLeadAdmin);
router.patch("/job-status/:kind/:id", updateJobStatusAdmin);

router.get("/settings", getSettings);
router.patch("/settings", updateSettings);

router.post("/telegram/broadcast", telegramBroadcast);
router.post("/telegram/send/:proId", telegramSendToPro);

export default router;
