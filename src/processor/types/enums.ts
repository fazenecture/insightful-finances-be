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