import { Router } from "express";
import ProcessorController from "./controller";

const router = Router();
const { execute, fetchTokenEstimateController, fetchAnalysisDataController } =
  new ProcessorController();

router.post("/process", execute);

router.post("/result/:id", fetchAnalysisDataController);

router.post("/tokens-estimate", fetchTokenEstimateController);

export default router;
