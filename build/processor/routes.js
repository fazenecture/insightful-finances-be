"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = __importDefault(require("./controller"));
const router = (0, express_1.Router)();
const { execute, fetchTokenEstimateController, fetchAnalysisDataController, fetchTransactionsController, streamAnalysisUpdatesController, downloadTransactionsController, } = new controller_1.default();
router.post("/process", execute);
router.post("/result/:id", fetchAnalysisDataController);
router.post("/tokens-estimate", fetchTokenEstimateController);
router.get("/stream/analysis", streamAnalysisUpdatesController);
router.get("/transactions/:session_id", fetchTransactionsController);
router.get("/transactions/download/:session_id", downloadTransactionsController);
exports.default = router;
//# sourceMappingURL=routes.js.map