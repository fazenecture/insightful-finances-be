import { Router } from "express";
import ProcessorController from "./controller";
import { authValidation } from "../middleware/auth.middleware";

const router = Router();
const {
  execute,
  fetchTokenEstimateController,
  fetchAnalysisDataController,
  fetchTransactionsController,
  streamAnalysisUpdatesController,
  downloadTransactionsController,
} = new ProcessorController();

router.post("/process", authValidation, execute);

router.post("/result/:id", authValidation, fetchAnalysisDataController);

router.post("/tokens-estimate", fetchTokenEstimateController);
router.get("/stream/analysis", authValidation, streamAnalysisUpdatesController);

router.get("/transactions/:session_id", authValidation, fetchTransactionsController);
router.get(
  "/transactions/download/:session_id",
  authValidation,
  downloadTransactionsController,
);

export default router;
