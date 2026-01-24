"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const custom_error_1 = __importDefault(require("../helper/custom.error"));
const service_1 = __importDefault(require("./service"));
const enums_1 = require("./types/enums");
const moment_1 = __importDefault(require("moment"));
class ProcessorController extends service_1.default {
    constructor() {
        super(...arguments);
        this.execute = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { user_id, account_id, pdf_keys, session_id } = req.body;
            try {
                yield this.executePdfAnalysis({
                    userId: user_id,
                    accountId: account_id,
                    pdfKeys: pdf_keys,
                    sessionId: session_id,
                });
                res.status(200).json({ message: "PDF batch processing initiated." });
                setImmediate(() => __awaiter(this, void 0, void 0, function* () {
                    this.processPdfBatch({
                        userId: user_id,
                        accountId: account_id,
                        pdfKeys: pdf_keys,
                        sessionId: session_id,
                    }).catch((error) => {
                        console.error(`Error processing PDF batch for session ${session_id}:`, error);
                        this.sseManager.emit(session_id, enums_1.SSEEventType.ERROR, {
                            message: `Processing failed: ${error === null || error === void 0 ? void 0 : error.message}`,
                        });
                        this.sseManager.emit(session_id, enums_1.SSEEventType.CLOSE, {});
                        this.updateAnalysisSessionStatusBySessionIdDb({
                            session_id,
                            status: enums_1.AnalysisStatus.FAILED,
                            tokens_used: 0,
                            error_message: error === null || error === void 0 ? void 0 : error.message,
                            updated_at: (0, moment_1.default)().format(),
                        });
                    });
                }));
            }
            catch (error) {
                this.sseManager.emit(session_id, enums_1.SSEEventType.ERROR, {
                    message: `Processing failed: ${error === null || error === void 0 ? void 0 : error.message}`,
                });
                this.sseManager.emit(session_id, enums_1.SSEEventType.CLOSE, {});
                this.updateAnalysisSessionStatusBySessionIdDb({
                    session_id,
                    status: enums_1.AnalysisStatus.FAILED,
                    tokens_used: 0,
                    error_message: error === null || error === void 0 ? void 0 : error.message,
                    updated_at: (0, moment_1.default)().format(),
                });
                (0, custom_error_1.default)(res, error);
            }
        });
        this.fetchAnalysisDataController = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id: session_id } = req.params, { user_id } = req.body;
                const data = yield this.fetchAnalysisDataService({ user_id, session_id });
                return res.status(200).send({
                    success: true,
                    data,
                });
            }
            catch (error) {
                (0, custom_error_1.default)(res, error);
            }
        });
        this.fetchTokenEstimateController = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { user_id, pdf_keys, session_id } = req.body;
                const data = yield this.fetchTokenEstimateService({
                    userId: user_id,
                    accountId: session_id,
                    pdfKeys: pdf_keys,
                    sessionId: session_id,
                });
                return res.status(200).send({
                    success: true,
                    data,
                });
            }
            catch (error) {
                (0, custom_error_1.default)(res, error);
            }
        });
        this.fetchTransactionsController = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { limit, page, search } = req.query, { session_id } = req.params;
                const { meta_data, data } = yield this.fetchTransactionsService({
                    limit: limit ? Number.parseInt(limit.toString()) : 10,
                    page: page ? Number.parseInt(page === null || page === void 0 ? void 0 : page.toString()) : 0,
                    search: (search === null || search === void 0 ? void 0 : search.length) ? search.toString() : null,
                    session_id,
                });
                return res.status(200).send({
                    success: true,
                    meta_data,
                    data,
                });
            }
            catch (error) {
                (0, custom_error_1.default)(res, error);
            }
        });
        // SSE Related Methods can be added here
        this.streamAnalysisUpdatesController = (req, res) => {
            try {
                const { session_id } = req.query;
                if (!session_id || typeof session_id !== "string") {
                    res.status(400).end();
                }
                res.setHeader("Content-Type", "text/event-stream");
                res.setHeader("Cache-Control", "no-cache");
                res.setHeader("Connection", "keep-alive");
                res.setHeader("X-Accel-Buffering", "no");
                this.sseManager.register(session_id, res);
                // Initial handshake event
                res.write(`event: connected\ndata: ${JSON.stringify({ message: "Connected to SSE stream." })}\n\n`);
                const heartbeat = setInterval(() => {
                    try {
                        res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
                    }
                    catch (err) {
                        // connection probably closed
                        clearInterval(heartbeat);
                    }
                }, 15000); // 15s is safe
                // Cleanup on client disconnect
                req.on("close", () => {
                    clearInterval(heartbeat);
                    this.sseManager.unregister(session_id, res);
                });
            }
            catch (error) {
                (0, custom_error_1.default)(res, error);
            }
        };
    }
}
exports.default = ProcessorController;
//# sourceMappingURL=controller.js.map