"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = __importDefault(require("./controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const { createOrderController, verifyPaymentController } = new controller_1.default();
// POST /api/payments/create-order
router.post("/create-order", auth_middleware_1.authValidation, createOrderController);
router.post("/verify-payment", auth_middleware_1.authValidation, verifyPaymentController);
exports.default = router;
//# sourceMappingURL=routes.js.map