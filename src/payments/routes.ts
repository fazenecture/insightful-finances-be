import { Router } from "express";
import PaymentsController from "./controller";
import { authValidation } from "../middleware/auth.middleware";

const router = Router();

const { createOrderController, verifyPaymentController } =
  new PaymentsController();

// POST /api/payments/create-order
router.post("/create-order", authValidation, createOrderController);
router.post("/verify-payment", authValidation, verifyPaymentController);

export default router;
