export enum PaymentEventWebhookLogsStatus {
  PROCESSED = "processed", // Webhook event has been processed
  FAILED = "failed", // Webhook event processing failed
  IGNORED = "ignored", // Webhook event has been ignored

  PROCESSING = "processing", // Webhook event is being processed
}

export enum RazorPayPaymentWebhookEvent {
  PAYMENT_CAPTURED = "payment.captured", // Payment has been captured successfully
  PAYMENT_FAILED = "payment.failed", // Payment has failed
  REFUND_PROCESSED = "refund.processed", // Payment has been refunded
  PAYMENT_PENDING = "payment.pending", // Payment is pending
}

export enum FundAccountTypes {
  BANK_ACCOUNT = "bank_account",
  VPA = "vpa",
}

export enum FundAccountVerificationStatus {
  PENDING = "pending",
  VERIFIED = "verified",
  FAILED = "failed",

  INITIATED = "initiated",
}

export enum OrderType {
  PACKAGE = "package",
  CUSTOM = "custom",
}

export enum PaymentStatus {
  CREATED = "created",
  PAID = "paid",
  FAILED = "failed",
  REFUNDED = "refunded",
}

/**
 * CONSTANTS
 */

export const TOKEN_PACKAGES = {
  starter: { price_inr: 299, tokens: 50 },
  pro: { price_inr: 699, tokens: 150 },
  power: { price_inr: 1499, tokens: 400 },
};

export const CUSTOM_TOKEN_RULES = {
  MIN_TOKENS: 100,
  MAX_TOKENS: 5000,
  PRICE_PER_TOKEN_INR: 10,
};
