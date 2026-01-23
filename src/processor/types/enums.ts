export enum TransactionDirection {
  INFLOW = "inflow",
  OUTFLOW = "outflow"
}

export enum TransactionSource {
  BANK = "bank",
  UPI = "upi",
  CREDIT_CARD = "credit_card"
}

export enum Category {
  FOOD = "Food & Dining",
  SHOPPING = "Shopping",
  TRANSPORT = "Transport",
  ENTERTAINMENT = "Entertainment",
  UTILITIES = "Utilities",
  HOUSING = "Housing",
  HEALTHCARE = "Healthcare",
  EDUCATION = "Education",
  INVESTMENT = "Investment",
  INCOME = "Income",
  FEES = "Fees & Charges",
  TRANSFER = "Transfers",
  OTHER = "Other"
}

export enum Currency {
    INR = "INR",
    USD = "USD",
    EUR = "EUR",
    GBP = "GBP",
    JPY = "JPY"

}

export enum AnalysisStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed"
}

export const CHARS_PER_TOKEN = 4;          // OpenAI average
export const COMPLETION_RATIO = 0.35;      // JSON output
export const SAFETY_MULTIPLIER = 1.2;      // retries + variance
export const LLM_TOKENS_PER_PRODUCT_TOKEN = 1000; // 1:1 mapping
export const NARRATIVE_TOKENS = 1500;      // fixed overhead for narrative generation

export const PERFORMANCE_CONSTANTS = {
  // PDF processing
  PDF_PARSE_MS_PER_PAGE: 120,        // conservative avg

  // LLM calls (measured averages)
  CONTEXT_DETECTION_MS: 1800,        // first page
  EXTRACTION_MS_PER_CHUNK: 2200,     // per chunk
  NARRATIVE_MS: 2500,                // bounded

  // Parallelism assumptions
  MAX_PARALLEL_CHUNKS: 1,            // sequential (safe)
  
  // Safety buffer
  TIME_SAFETY_MULTIPLIER: 1.25
};
