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
const p_limit_1 = __importDefault(require("p-limit"));
const token_chunker_1 = require("../helper/token.chunker");
const node_crypto_1 = require("node:crypto");
const enums_1 = require("./types/enums");
const api_retry_1 = require("../helper/api.retry");
class ProcessorHelper extends db_1.default {
    constructor() {
        super();
        /* ================================
           PDF PROCESSING
           ================================ */
        this.processSinglePdf = (input) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const { userId, s3Key } = input;
            const pages = yield this.extractPdfFromUrl({ url: s3Key });
            /**
             * get the context from the first page
             */
            const tokenData = this.estimateTokensFromPdfSession({
                pages,
                chunkSizeTokens: token_chunker_1.MAX_TOKENS_PER_CHUNK,
                baseContextPromptLength: this.BASE_CONTEXT_PROMPT_LENGTH,
                extractionPromptOverheadTokens: 900, // static prompt size
                narrativeEnabled: true,
            });
            const limit = (0, p_limit_1.default)(10); // tune: 6–12 is safe
            const context = yield (0, api_retry_1.callWithRateLimitRetry)(() => this.llm.detectStatementContext({
                firstPageText: pages[0].text,
            }));
            // 2. Token-based chunking
            const pagesWithRows = pages.map((p, idx) => ({
                pageNumber: idx + 1,
                rows: this.splitPageIntoRows(p.text),
            }));
            const chunks = this.chunkRowsByTokens(pagesWithRows, token_chunker_1.MAX_TOKENS_PER_CHUNK, token_chunker_1.estimateTokens);
            console.log(`Total chunks: ${chunks.length}`);
            const accountIdData = [
                (_a = context.bankName) !== null && _a !== void 0 ? _a : "UNKNOWN_BANK",
                context.accountType,
                (_c = (_b = context === null || context === void 0 ? void 0 : context.accountLast4) !== null && _b !== void 0 ? _b : context === null || context === void 0 ? void 0 : context.cardLast4) !== null && _c !== void 0 ? _c : "XXXX",
            ].join("-");
            yield Promise.all(chunks.map((chunk, index) => limit(() => __awaiter(this, void 0, void 0, function* () {
                console.log(`Processing chunk ${index + 1}/${chunks.length} (pages: ${chunk.pages.join(",")})`);
                let txns = yield (0, api_retry_1.callWithRateLimitRetry)(() => this.llm.extractAndEnrichTransactions({
                    userId,
                    accountId: accountIdData,
                    pageText: chunk.text,
                    accountContext: context,
                    sessionId: input === null || input === void 0 ? void 0 : input.sessionId,
                }));
                txns = this.detectInternalTransfers({ transactions: txns });
                if (txns.length) {
                    yield this.insertBulkTransactions({ transactions: txns });
                }
            }))));
            return {
                token_used: tokenData,
                page_count: pages.length,
            };
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
        this.chunkRowsByTokens = (pages, maxTokens, estimateTokens) => {
            const chunks = [];
            let currentRows = [];
            let currentPages = new Set();
            let currentTokens = 0;
            for (const page of pages) {
                for (const row of page.rows) {
                    const rowTokens = estimateTokens(row);
                    if (currentTokens + rowTokens > maxTokens) {
                        chunks.push({
                            text: currentRows.join("\n"),
                            pages: Array.from(currentPages),
                        });
                        currentRows = [];
                        currentPages = new Set();
                        currentTokens = 0;
                    }
                    currentRows.push(row);
                    currentPages.add(page.pageNumber);
                    currentTokens += rowTokens;
                }
            }
            if (currentRows.length) {
                chunks.push({
                    text: currentRows.join("\n"),
                    pages: Array.from(currentPages),
                });
            }
            return chunks;
        };
        this.splitPageIntoRows = (pageText) => {
            return pageText
                .split("\n")
                .map((r) => r.trim())
                .filter(Boolean);
        };
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
            const subscriptions = this.detectSubscriptions({ transactions });
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
                subscriptions,
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
            yield this.saveSubscriptions(input.snapshot.subscriptions);
            yield this.saveHealthScore({
                userId: input.userId,
                score: input.snapshot.healthScore,
            });
        });
        this.detectSubscriptions = (input) => {
            const groups = this.groupByMerchant(input.transactions);
            const subscriptions = [];
            for (const [merchant, txns] of groups.entries()) {
                if (txns.length < 2)
                    continue;
                const dates = txns.map((t) => new Date(t.date)).sort((a, b) => +a - +b);
                const intervals = this.getDayIntervals(dates);
                const cadence = this.detectCadence(intervals);
                if (!cadence)
                    continue;
                const avgAmount = this.average(txns.map((t) => parseInt(t.amount.toString())));
                const variance = this.stdDev(txns.map((t) => parseInt(t.amount.toString()))) / avgAmount;
                if (variance > 0.1)
                    continue;
                subscriptions.push({
                    id: (0, node_crypto_1.randomUUID)(),
                    merchant,
                    frequency: cadence,
                    first_seen: dates[0].toISOString().slice(0, 10),
                    is_active: (new Date().getTime() - dates.at(-1).getTime()) /
                        (1000 * 60 * 60 * 24) <
                        (cadence === "weekly" ? 14 : cadence === "monthly" ? 45 : 400),
                    average_amount: avgAmount,
                    occurrences: txns.length,
                    confidence: cadence === "monthly" ? 0.9 : 0.7,
                    transactions: txns.map((t) => t.transaction_id),
                    user_id: txns[0].user_id,
                    created_at: new Date().toISOString(),
                });
            }
            return subscriptions;
        };
        this.stdDev = (values) => {
            const mean = this.average(values);
            const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
            return Math.sqrt(variance);
        };
        this.groupByMerchant = (transactions) => {
            var _a;
            const map = new Map();
            for (const t of transactions) {
                if (t.direction !== "outflow")
                    continue;
                if (!t.merchant && !t.description)
                    continue;
                const key = this.normalizeMerchant((_a = t.merchant) !== null && _a !== void 0 ? _a : t.description);
                if (!map.has(key)) {
                    map.set(key, []);
                }
                map.get(key).push(t);
            }
            return map;
        };
        this.normalizeMerchant = (value) => value
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .replace(/\s+/g, " ")
            .trim();
        this.getDayIntervals = (dates) => {
            const intervals = [];
            for (let i = 1; i < dates.length; i++) {
                const diff = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
                intervals.push(Math.round(diff));
            }
            return intervals;
        };
        this.detectCadence = (intervals) => {
            if (intervals.length < 2)
                return null;
            const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            if (avg >= 6 && avg <= 8)
                return "weekly";
            if (avg >= 28 && avg <= 32)
                return "monthly";
            if (avg >= 360 && avg <= 370)
                return "annual";
            return null;
        };
        this.average = (values) => values.reduce((a, b) => a + b, 0) / values.length;
        this.generateNarrativeSnapshot = (input) => __awaiter(this, void 0, void 0, function* () {
            const narrative = yield (0, api_retry_1.callWithRateLimitRetry)(() => this.llm.generateNarrative(input));
            yield this.saveNarrative({
                userId: input.userId,
                narrative,
                sessionId: input.sessionId,
            });
        });
        this.sleep = (input) => __awaiter(this, void 0, void 0, function* () { return new Promise((resolve) => setTimeout(resolve, input.ms)); });
        this.computePdfMetrics = (pages) => {
            let totalChars = 0;
            let nonEmptyPages = 0;
            for (const p of pages) {
                if (typeof p.text === "string" && p.text.trim().length > 0) {
                    totalChars += p.text.length;
                    nonEmptyPages++;
                }
            }
            return {
                total_chars: totalChars,
                total_pages: pages.length,
                non_empty_pages: nonEmptyPages,
            };
        };
        this.estimatePromptTokensFromPdf = (chars) => {
            return Math.ceil(chars / enums_1.CHARS_PER_TOKEN);
        };
        this.estimateTokensFromPdfSession = (input) => {
            const metrics = this.computePdfMetrics(input.pages);
            // Estimate tokens from PDF text
            const pdfPromptTokens = Math.ceil(metrics.total_chars / enums_1.CHARS_PER_TOKEN);
            const chunksCount = Math.ceil(pdfPromptTokens / input.chunkSizeTokens);
            // Base context (system prompt, once per session)
            const contextTokens = Math.ceil(input.baseContextPromptLength / enums_1.CHARS_PER_TOKEN) + 300; // structured output buffer
            // Extraction prompt tokens (user messages)
            const extractionPromptTokens = pdfPromptTokens + chunksCount * input.extractionPromptOverheadTokens;
            // Completion tokens (model output)
            const extractionCompletionTokens = Math.ceil(extractionPromptTokens * enums_1.COMPLETION_RATIO);
            let narrativeTokens = 0;
            if (input.narrativeEnabled) {
                narrativeTokens = enums_1.NARRATIVE_TOKENS;
            }
            const rawTotal = contextTokens +
                extractionPromptTokens +
                extractionCompletionTokens +
                narrativeTokens;
            const llmTokensExpected = Math.ceil(rawTotal * enums_1.SAFETY_MULTIPLIER);
            // Convert to your product tokens
            const productTokensExpected = Math.ceil(llmTokensExpected / enums_1.LLM_TOKENS_PER_PRODUCT_TOKEN);
            return {
                llmTokensExpected,
                productTokensExpected,
                breakdown: {
                    pdf_chars: metrics.total_chars,
                    pages: metrics.total_pages,
                    non_empty_pages: metrics.non_empty_pages,
                    chunks: chunksCount,
                    contextTokens,
                    extractionPromptTokens,
                    extractionCompletionTokens,
                    narrativeTokens,
                    safetyMultiplier: enums_1.SAFETY_MULTIPLIER,
                },
            };
        };
        this.estimateTokensAndTimeFromPdfSession = (input) => {
            const metrics = this.computePdfMetrics(input.pages);
            // ---------- TOKEN ESTIMATION ----------
            const tokenData = this.estimateTokensFromPdfSession(input);
            const estimatedPdfTokens = Math.max(Math.ceil(metrics.total_chars / enums_1.CHARS_PER_TOKEN), metrics.non_empty_pages * enums_1.TOKENS_PER_PAGE_ESTIMATE);
            const chunksCount = Math.ceil(estimatedPdfTokens / input.chunkSizeTokens);
            // ---------- TIME ESTIMATION ----------
            const parseTimeMs = metrics.total_pages * enums_1.PERFORMANCE_CONSTANTS.PDF_PARSE_MS_PER_PAGE;
            const contextTimeMs = enums_1.PERFORMANCE_CONSTANTS.CONTEXT_DETECTION_MS;
            const extractionTimeMs = chunksCount * enums_1.PERFORMANCE_CONSTANTS.EXTRACTION_MS_PER_CHUNK;
            const narrativeTimeMs = input.narrativeEnabled
                ? enums_1.PERFORMANCE_CONSTANTS.NARRATIVE_MS
                : 0;
            const SMALL_PDF_PENALTY = metrics.total_pages <= 3 ? 1.3 : 1;
            const MULTI_PDF_PENALTY = input.isBatch ? 1.6 : 1;
            const totalTimeMs = (parseTimeMs + contextTimeMs + extractionTimeMs + narrativeTimeMs) *
                enums_1.PERFORMANCE_CONSTANTS.BASE_TIME_SAFETY *
                SMALL_PDF_PENALTY *
                MULTI_PDF_PENALTY;
            const MIN_SECONDS = input.narrativeEnabled ? 35 : 20;
            console.log("🔍 PDF METRICS", {
                total_pages: metrics.total_pages,
                non_empty_pages: metrics.non_empty_pages,
                total_chars: metrics.total_chars,
                estimatedPdfTokens: Math.ceil(metrics.total_chars / enums_1.CHARS_PER_TOKEN),
                chunkSizeTokens: input.chunkSizeTokens,
            });
            console.log("🔍 CHUNK CALC", {
                estimatedPdfTokens,
                chunksCount,
            });
            const timeSecondsExpected = Math.max(Math.ceil(totalTimeMs / 1000), MIN_SECONDS);
            return {
                tokensExpected: tokenData.productTokensExpected,
                timeSecondsExpected: timeSecondsExpected,
                timeEstimate: {
                    minSeconds: timeSecondsExpected,
                    maxSeconds: Math.ceil(timeSecondsExpected * 1.35),
                },
                breakdown: Object.assign(Object.assign({}, tokenData.breakdown), { 
                    // 🔍 transparency
                    estimatedPdfTokens, chunks: chunksCount, parseTimeMs,
                    contextTimeMs,
                    extractionTimeMs,
                    narrativeTimeMs }),
            };
        };
        this.BASE_CONTEXT_PROMPT_LENGTH = 2000;
        this.now = () => process.hrtime.bigint();
        this.ms = (start, end) => {
            return Number(end - start) / 1000000;
        };
        this.llm = new llm_1.default();
        this.analysis = new analysis_1.default();
        this.s3 = new s3_1.default();
    }
}
exports.default = ProcessorHelper;
//# sourceMappingURL=helper.js.map