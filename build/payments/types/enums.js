"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUSTOM_TOKEN_RULES = exports.TOKEN_PACKAGES = exports.PaymentStatus = exports.OrderType = exports.FundAccountVerificationStatus = exports.FundAccountTypes = exports.RazorPayPaymentWebhookEvent = exports.PaymentEventWebhookLogsStatus = void 0;
var PaymentEventWebhookLogsStatus;
(function (PaymentEventWebhookLogsStatus) {
    PaymentEventWebhookLogsStatus["PROCESSED"] = "processed";
    PaymentEventWebhookLogsStatus["FAILED"] = "failed";
    PaymentEventWebhookLogsStatus["IGNORED"] = "ignored";
    PaymentEventWebhookLogsStatus["PROCESSING"] = "processing";
})(PaymentEventWebhookLogsStatus || (exports.PaymentEventWebhookLogsStatus = PaymentEventWebhookLogsStatus = {}));
var RazorPayPaymentWebhookEvent;
(function (RazorPayPaymentWebhookEvent) {
    RazorPayPaymentWebhookEvent["PAYMENT_CAPTURED"] = "payment.captured";
    RazorPayPaymentWebhookEvent["PAYMENT_FAILED"] = "payment.failed";
    RazorPayPaymentWebhookEvent["REFUND_PROCESSED"] = "refund.processed";
    RazorPayPaymentWebhookEvent["PAYMENT_PENDING"] = "payment.pending";
})(RazorPayPaymentWebhookEvent || (exports.RazorPayPaymentWebhookEvent = RazorPayPaymentWebhookEvent = {}));
var FundAccountTypes;
(function (FundAccountTypes) {
    FundAccountTypes["BANK_ACCOUNT"] = "bank_account";
    FundAccountTypes["VPA"] = "vpa";
})(FundAccountTypes || (exports.FundAccountTypes = FundAccountTypes = {}));
var FundAccountVerificationStatus;
(function (FundAccountVerificationStatus) {
    FundAccountVerificationStatus["PENDING"] = "pending";
    FundAccountVerificationStatus["VERIFIED"] = "verified";
    FundAccountVerificationStatus["FAILED"] = "failed";
    FundAccountVerificationStatus["INITIATED"] = "initiated";
})(FundAccountVerificationStatus || (exports.FundAccountVerificationStatus = FundAccountVerificationStatus = {}));
var OrderType;
(function (OrderType) {
    OrderType["PACKAGE"] = "package";
    OrderType["CUSTOM"] = "custom";
})(OrderType || (exports.OrderType = OrderType = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["CREATED"] = "created";
    PaymentStatus["PAID"] = "paid";
    PaymentStatus["FAILED"] = "failed";
    PaymentStatus["REFUNDED"] = "refunded";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
/**
 * CONSTANTS
 */
exports.TOKEN_PACKAGES = {
    starter: { price_inr: 299, tokens: 50 },
    pro: { price_inr: 699, tokens: 150 },
    power: { price_inr: 1499, tokens: 400 },
};
exports.CUSTOM_TOKEN_RULES = {
    MIN_TOKENS: 100,
    MAX_TOKENS: 5000,
    PRICE_PER_TOKEN_INR: 10,
};
//# sourceMappingURL=enums.js.map