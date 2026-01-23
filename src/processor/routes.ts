import { Router } from "express";
import ProcessorController from "./controller";

const router = Router();
const { execute, fetchTokenEstimateController, fetchAnalysisDataController, fetchTransactionsController, streamAnalysisUpdatesController } =
  new ProcessorController();

router.post("/process", execute);

router.post("/result/:id", fetchAnalysisDataController);

router.post("/tokens-estimate", fetchTokenEstimateController);
router.get("/stream/analysis", streamAnalysisUpdatesController);

router.get("/transactions/:session_id", fetchTransactionsController);

export default router;
