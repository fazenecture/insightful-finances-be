"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = __importDefault(require("./controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const { execute, fetchTokenEstimateController, fetchAnalysisDataController, fetchTransactionsController, streamAnalysisUpdatesController, downloadTransactionsController, } = new controller_1.default();
router.post("/process", auth_middleware_1.authValidation, execute);
router.post("/result/:id", auth_middleware_1.authValidation, fetchAnalysisDataController);
router.post("/tokens-estimate", fetchTokenEstimateController);
router.get("/stream/analysis", auth_middleware_1.authValidation, streamAnalysisUpdatesController);
router.get("/transactions/:session_id", auth_middleware_1.authValidation, fetchTransactionsController);
router.get("/transactions/download/:session_id", auth_middleware_1.authValidation, downloadTransactionsController);
exports.default = router;
//# sourceMappingURL=routes.js.map