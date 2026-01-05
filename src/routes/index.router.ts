import { Router } from "express";
import processorRouter from "../processor/routes";
import utilsRouter from "../utils/routes";

const router = Router();

router.use("/analysis", processorRouter);
router.use("/utils", utilsRouter);

export default router;