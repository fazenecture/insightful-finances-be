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
// processor/service.ts
const helper_1 = __importDefault(require("./helper"));
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
            const { userId, accountId, pdfKeys } = input;
            // 1. Process each PDF independently
            for (const s3Key of pdfKeys) {
                yield this.processSinglePdf({
                    userId,
                    accountId,
                    s3Key
                });
            }
            // 2. Fetch canonical ledger (all transactions)
            const allTransactions = yield this.fetchTransactionsByUser({
                userId
            });
            // 3. Run deterministic financial analysis
            const analysisSnapshot = this.runFullAnalysis(allTransactions);
            // 4. Persist computed metrics
            yield this.persistAnalysisSnapshot({
                userId,
                snapshot: analysisSnapshot
            });
            // 5. Generate read-only AI narrative
            const narrative = yield this.generateNarrativeSnapshot({
                userId,
                snapshot: analysisSnapshot
            });
            console.log('narrative: ', narrative);
            return narrative;
        });
    }
}
exports.default = ProcessorService;
//# sourceMappingURL=service.js.map