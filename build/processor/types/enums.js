"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOKENS_PER_PAGE_ESTIMATE = exports.PERFORMANCE_CONSTANTS = exports.NARRATIVE_TOKENS = exports.LLM_TOKENS_PER_PRODUCT_TOKEN = exports.SAFETY_MULTIPLIER = exports.COMPLETION_RATIO = exports.CHARS_PER_TOKEN = exports.SSEEventType = exports.AnalysisStatus = exports.Currency = exports.Category = exports.TransactionSource = exports.TransactionDirection = void 0;
var TransactionDirection;
(function (TransactionDirection) {
    TransactionDirection["INFLOW"] = "inflow";
    TransactionDirection["OUTFLOW"] = "outflow";
})(TransactionDirection || (exports.TransactionDirection = TransactionDirection = {}));
var TransactionSource;
(function (TransactionSource) {
    TransactionSource["BANK"] = "bank";
    TransactionSource["UPI"] = "upi";
    TransactionSource["CREDIT_CARD"] = "credit_card";
})(TransactionSource || (exports.TransactionSource = TransactionSource = {}));
var Category;
(function (Category) {
    Category["FOOD"] = "Food & Dining";
    Category["SHOPPING"] = "Shopping";
    Category["TRANSPORT"] = "Transport";
    Category["ENTERTAINMENT"] = "Entertainment";
    Category["UTILITIES"] = "Utilities";
    Category["HOUSING"] = "Housing";
    Category["HEALTHCARE"] = "Healthcare";
    Category["EDUCATION"] = "Education";
    Category["INVESTMENT"] = "Investment";
    Category["INCOME"] = "Income";
    Category["FEES"] = "Fees & Charges";
    Category["TRANSFER"] = "Transfers";
    Category["OTHER"] = "Other";
})(Category || (exports.Category = Category = {}));
var Currency;
(function (Currency) {
    Currency["INR"] = "INR";
    Currency["USD"] = "USD";
    Currency["EUR"] = "EUR";
    Currency["GBP"] = "GBP";
    Currency["JPY"] = "JPY";
})(Currency || (exports.Currency = Currency = {}));
var AnalysisStatus;
(function (AnalysisStatus) {
    AnalysisStatus["PENDING"] = "pending";
    AnalysisStatus["IN_PROGRESS"] = "in_progress";
    AnalysisStatus["COMPLETED"] = "completed";
    AnalysisStatus["FAILED"] = "failed";
})(AnalysisStatus || (exports.AnalysisStatus = AnalysisStatus = {}));
var SSEEventType;
(function (SSEEventType) {
    SSEEventType["PROGRESS"] = "progress";
    SSEEventType["COMPLETED"] = "completed";
    SSEEventType["ERROR"] = "error";
    SSEEventType["STAGE"] = "stage";
    SSEEventType["CLOSE"] = "close";
})(SSEEventType || (exports.SSEEventType = SSEEventType = {}));
exports.CHARS_PER_TOKEN = 4; // OpenAI average
exports.COMPLETION_RATIO = 0.35; // JSON output
exports.SAFETY_MULTIPLIER = 1.2; // retries + variance
exports.LLM_TOKENS_PER_PRODUCT_TOKEN = 1000; // 1:1 mapping
exports.NARRATIVE_TOKENS = 1500; // fixed overhead for narrative generation
exports.PERFORMANCE_CONSTANTS = {
    // PDF processing
    PDF_PARSE_MS_PER_PAGE: 120, // conservative avg
    // LLM calls (measured averages)
    CONTEXT_DETECTION_MS: 2800, // first page
    EXTRACTION_MS_PER_CHUNK: 3000, // per chunk
    NARRATIVE_MS: 14000, // bounded
    // Parallelism assumptions
    MAX_PARALLEL_CHUNKS: 9, // sequential (safe)
    // Safety buffer
    TIME_SAFETY_MULTIPLIER: 3,
    BASE_TIME_SAFETY: 1.35,
    OPENAI_TPM_LIMIT: 30000, // org limit
    COOLDOWN_BUFFER_SECONDS: 5, // seconds
};
exports.TOKENS_PER_PAGE_ESTIMATE = 10000;
//# sourceMappingURL=enums.js.map