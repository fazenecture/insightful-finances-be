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
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const pdf_parse_1 = require("pdf-parse");
const db_1 = __importDefault(require("./db"));
const llm_1 = __importDefault(require("./llm"));
const analysis_1 = __importDefault(require("./analysis"));
const s3_1 = __importDefault(require("./s3"));
const token_chunker_1 = require("../helper/token.chunker");
class ProcessorHelper extends db_1.default {
    constructor() {
        super();
        /* ================================
           PDF PROCESSING
           ================================ */
        this.processSinglePdf = (input) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const { userId, accountId, s3Key } = input;
            // const localPath = await this.downloadPdf({ s3Key });
            // const pages = await this.extractPdfPages({ filePath: localPath });
            const pages = yield this.extractPdfFromUrl({ url: s3Key });
            // for (const page of pages) {
            //   const { text: pageText } = page as PageTextResult;
            //   if (!pageText.trim()) continue;
            //   console.log('Processing page text: ', pageText.length);
            //   let txns = await this.llm.extractAndEnrichTransactions({
            //     userId,
            //     accountId,
            //     pageText
            //   });
            //   txns = this.detectInternalTransfers({ transactions: txns });
            //   await this.insertBulkTransactions({ transactions: txns });
            //   await this.sleep({ ms: 400 }); // TPM safety
            // }
            // const PAGE_BATCH_SIZE = 5;
            // for (let i = 0; i < pages.length; i += PAGE_BATCH_SIZE) {
            //   const batch = pages.slice(i, i + PAGE_BATCH_SIZE);
            //   const combinedText = batch
            //     .map((p) => (p as PageTextResult).text)
            //     .join("\n\n--- PAGE BREAK ---\n\n");
            //   if (!combinedText.trim()) continue;
            //   console.log("Processing batch pages:", i, "-", i + batch.length);
            //   let txns = await this.llm.extractAndEnrichTransactions({
            //     userId,
            //     accountId,
            //     pageText: combinedText,
            //   });
            //   txns = this.detectInternalTransfers({ transactions: txns });
            //   await this.insertBulkTransactions({ transactions: txns });
            //   await this.sleep({ ms: 500 }); // one sleep per batch
            // }
            /**
             * get the context from the first page
             */
            const context = yield this.llm.detectStatementContext({
                firstPageText: pages[0].text,
            });
            const fullText = pages.map((p) => p.text).join("\n\n");
            // 2. Token-based chunking
            const chunks = (0, token_chunker_1.chunkTextByTokens)({
                text: fullText,
                maxTokens: token_chunker_1.MAX_TOKENS_PER_CHUNK,
            });
            console.log(`Total chunks: ${chunks.length}`);
            const accountIdData = [
                (_a = context.bankName) !== null && _a !== void 0 ? _a : "UNKNOWN_BANK",
                context.accountType,
                (_c = (_b = context === null || context === void 0 ? void 0 : context.accountLast4) !== null && _b !== void 0 ? _b : context === null || context === void 0 ? void 0 : context.cardLast4) !== null && _c !== void 0 ? _c : "XXXX",
            ].join("-");
            for (const [index, chunk] of chunks.entries()) {
                if (!chunk.trim())
                    continue;
                console.log(`Processing chunk ${index + 1}/${chunks.length}`);
                let txns = yield this.llm.extractAndEnrichTransactions({
                    userId,
                    accountId: accountIdData,
                    pageText: chunk,
                    accountContext: context,
                });
                txns = this.detectInternalTransfers({ transactions: txns });
                yield this.insertBulkTransactions({ transactions: txns });
            }
            // fs.unlinkSync(localPath);
        });
        /* ================================
           PDF HELPERS
           ================================ */
        this.downloadPdf = (input) => __awaiter(this, void 0, void 0, function* () {
            const { bucket, key } = this.parseS3Url(input.s3Key);
            const tmpPath = node_path_1.default.join("/tmp", `${Date.now()}-${node_path_1.default.basename(key)}`);
            yield this.s3.downloadToFile({
                bucket,
                key,
                destinationPath: tmpPath,
            });
            return tmpPath;
        });
        this.parseS3Url = (s3Url) => {
            const url = new URL(s3Url);
            // Example:
            // https://financial-analysis-be.s3.ap-south-1.amazonaws.com/Acct+Statement.pdf
            const bucket = url.hostname.split(".")[0];
            // Decode URL-encoded path
            const key = decodeURIComponent(url.pathname.slice(1));
            return { bucket, key };
        };
        this.extractPdfPages = (input) => __awaiter(this, void 0, void 0, function* () {
            const buffer = node_fs_1.default.readFileSync(input.filePath);
            const data = new pdf_parse_1.PDFParse({
                data: buffer,
            });
            return [""];
        });
        this.extractPdfFromUrl = (input) => __awaiter(this, void 0, void 0, function* () {
            const data = new pdf_parse_1.PDFParse({
                url: input.url,
            });
            const result = yield data.getText();
            return result.pages;
        });
        /* ================================
           INTERNAL TRANSFERS
           ================================ */
        this.detectInternalTransfers = (input) => {
            const map = new Map();
            input.transactions.forEach((t) => {
                const key = `${t.amount}-${t.date}`;
                if (map.has(key)) {
                    t.is_internal_transfer = true;
                    map.get(key).is_internal_transfer = true;
                }
                else {
                    map.set(key, t);
                }
            });
            return input.transactions;
        };
        /* ================================
           FULL ANALYSIS PIPELINE
           ================================ */
        this.runFullAnalysis = (transactions) => {
            const core = this.analysis.computeCoreMetrics({ transactions });
            const cashflow = this.analysis.computeCashFlowAnalysis({ transactions });
            const categories = this.analysis.computeCategoryAnalysis({ transactions });
            const credit = this.analysis.computeCreditCardAnalysis({ transactions });
            const income = this.analysis.computeIncomeSourceAnalysis({ transactions });
            const anomalies = this.analysis.detectAnomalies({ transactions });
            const healthScore = this.analysis.computeFinancialHealthScore({
                core,
                credit,
            });
            return {
                core,
                cashflow,
                categories,
                credit,
                income,
                anomalies,
                healthScore,
            };
        };
        /* ================================
           PERSISTENCE
           ================================ */
        this.persistAnalysisSnapshot = (input) => __awaiter(this, void 0, void 0, function* () {
            yield this.saveMonthlyMetrics({
                userId: input.userId,
                months: input.snapshot.cashflow.months,
            });
            yield this.saveHealthScore({
                userId: input.userId,
                score: input.snapshot.healthScore,
            });
        });
        this.generateNarrativeSnapshot = (input) => __awaiter(this, void 0, void 0, function* () {
            const narrative = yield this.llm.generateNarrative(input);
            yield this.saveNarrative({
                userId: input.userId,
                narrative,
            });
        });
        this.sleep = (input) => __awaiter(this, void 0, void 0, function* () { return new Promise((resolve) => setTimeout(resolve, input.ms)); });
        this.llm = new llm_1.default();
        this.analysis = new analysis_1.default();
        this.s3 = new s3_1.default();
    }
}
exports.default = ProcessorHelper;
//# sourceMappingURL=helper.js.map