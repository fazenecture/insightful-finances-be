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
const token_chunker_1 = require("../helper/token.chunker");
const helper_1 = __importDefault(require("./helper"));
const enums_1 = require("./types/enums");
const moment_1 = __importDefault(require("moment"));
class ProcessorService extends helper_1.default {
    constructor() {
        super(...arguments);
        /**
         * Entry point for processing multiple PDFs uploaded to S3.
         * This method is intentionally sequential to:
         * - avoid OpenAI TPM/RPM issues
         * - keep memory usage stable
         * - allow partial progress persistence
         */
        this.processPdfBatch = (input) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { userId, accountId, pdfKeys } = input;
            /**
             * Analysis Session
             */
            const startedAt = (0, moment_1.default)().toISOString();
            const t0 = this.now();
            let totalTokensUsed = 0;
            let pdfProcessingMs = 0;
            let analysisMs = 0;
            let narrativeMs = 0;
            let dbWriteMs = 0;
            yield this.insertAnalysisSessionDb([
                {
                    session_id: input === null || input === void 0 ? void 0 : input.sessionId,
                    user_id: userId,
                    source_type: "pdf_batch",
                    status: enums_1.AnalysisStatus.IN_PROGRESS,
                    created_at: (0, moment_1.default)().format(),
                    tokens_expected: (_a = input === null || input === void 0 ? void 0 : input.tokensEstimate) !== null && _a !== void 0 ? _a : 0,
                },
            ]);
            const pdfStart = this.now();
            // 1. Process each PDF independently
            for (const s3Key of pdfKeys) {
                const tokensUsed = yield this.processSinglePdf({
                    userId,
                    accountId,
                    s3Key,
                    sessionId: input === null || input === void 0 ? void 0 : input.sessionId,
                });
                totalTokensUsed += tokensUsed.productTokensExpected;
            }
            pdfProcessingMs = this.ms(pdfStart, this.now());
            // 2. Fetch canonical ledger (all transactions)
            const analysisStart = this.now();
            const allTransactions = yield this.fetchTransactionsByUser({
                userId,
            });
            // 3. Run deterministic financial analysis
            const analysisSnapshot = this.runFullAnalysis(allTransactions);
            analysisMs = this.ms(analysisStart, this.now());
            // 3️⃣ Persist snapshot
            const dbStart = this.now();
            // 4. Persist computed metrics
            yield this.persistAnalysisSnapshot({
                userId,
                snapshot: analysisSnapshot,
            });
            dbWriteMs += this.ms(dbStart, this.now());
            // 5. Generate read-only AI narrative
            const narrativeStart = this.now();
            const narrative = yield this.generateNarrativeSnapshot({
                userId,
                snapshot: analysisSnapshot,
                sessionId: input === null || input === void 0 ? void 0 : input.sessionId,
            });
            console.log("narrative: ", narrative);
            narrativeMs = this.ms(narrativeStart, this.now());
            const completedAt = (0, moment_1.default)().toISOString();
            const totalDurationMs = this.ms(t0, this.now());
            const metaData = {
                pdf_count: pdfKeys.length,
                total_transactions: allTransactions.length,
                metric: {
                    started_at: startedAt,
                    completed_at: completedAt,
                    total_duration_ms: Math.round(totalDurationMs),
                    breakdown: {
                        analysis_ms: Math.round(analysisMs),
                        narrative_ms: Math.round(narrativeMs),
                        db_write_ms: Math.round(dbWriteMs),
                        pdf_processing_ms: Math.round(pdfProcessingMs),
                    },
                },
            };
            yield this.updateAnalysisSessionStatusBySessionIdDb({
                session_id: input === null || input === void 0 ? void 0 : input.sessionId,
                status: enums_1.AnalysisStatus.COMPLETED,
                tokens_used: totalTokensUsed,
                updated_at: (0, moment_1.default)().format(),
                meta_data: metaData,
            });
            return narrative;
        });
        this.fetchAnalysisDataService = (reqObj) => __awaiter(this, void 0, void 0, function* () {
            const { user_id, session_id } = reqObj;
            // Fetch analysis snapshot from DB
            // const analysisData = await this.fetchAnalysisSnapshot({
            //   userId: user_id
            // });
            const data = yield this.fetchNarrativeBySessionId({
                user_id,
                session_id,
            });
            return Object.assign(Object.assign({}, data), { narrative: JSON.parse(data.narrative) });
        });
        this.fetchTokenEstimateService = (reqObj) => __awaiter(this, void 0, void 0, function* () {
            const { userId, accountId, pdfKeys } = reqObj;
            let totalTokens = 0, totalTimeInSecondsExpected = 0;
            for (const s3Key of pdfKeys) {
                const pages = yield this.extractPdfFromUrl({ url: s3Key });
                // const tokenData = this.estimateTokensFromPdfSession({
                //   pages,
                //   chunkSizeTokens: MAX_TOKENS_PER_CHUNK,
                //   baseContextPromptLength: this.BASE_CONTEXT_PROMPT_LENGTH,
                //   extractionPromptOverheadTokens: 900, // static prompt size
                //   narrativeEnabled: true,
                // });
                const metricsExpected = this.estimateTokensAndTimeFromPdfSession({
                    pages,
                    chunkSizeTokens: token_chunker_1.MAX_TOKENS_PER_CHUNK,
                    baseContextPromptLength: this.BASE_CONTEXT_PROMPT_LENGTH,
                    extractionPromptOverheadTokens: 900, // static prompt size
                    narrativeEnabled: true,
                });
                totalTokens += metricsExpected.tokensExpected;
                totalTimeInSecondsExpected += metricsExpected.timeSecondsExpected;
            }
            return {
                total_tokens: totalTokens,
                total_time_seconds: totalTimeInSecondsExpected,
            };
        });
        this.fetchTransactionsService = (obj) => __awaiter(this, void 0, void 0, function* () {
            const [transactionData, transactionTotalCount] = yield Promise.all([
                this.fetchTransactionDb(obj),
                this.fetchTotalTransactionsCountDb(obj),
            ]);
            const metaData = {
                total_items: Number.parseInt(transactionTotalCount),
                items_on_page: transactionData === null || transactionData === void 0 ? void 0 : transactionData.length,
                page_no: obj.page,
            };
            return {
                data: transactionData,
                meta_data: metaData,
            };
        });
    }
}
exports.default = ProcessorService;
//# sourceMappingURL=service.js.map