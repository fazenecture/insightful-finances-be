import { Router } from "express";
import processorRouter from "../processor/routes";
import utilsRouter from "../utils/routes";
import authRouter from "../auth/routes";

const router = Router();

router.use("/analysis", processorRouter);
router.use("/utils", utilsRouter);
router.use("/auth", authRouter);

export default router;