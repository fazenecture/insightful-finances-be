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
const moment_1 = __importDefault(require("moment"));
const error_handler_1 = __importDefault(require("../helper/error.handler"));
const enums_1 = require("../processor/types/enums");
const helper_1 = __importDefault(require("./helper"));
const enums_2 = require("./types/enums");
const crypto_1 = require("crypto");
class PaymentsService extends helper_1.default {
    constructor() {
        super(...arguments);
        this.createOrderService = (obj) => __awaiter(this, void 0, void 0, function* () {
            let tokensGranted = 0;
            let amountInPaise = 0;
            let metaData = {};
            if (obj.type === enums_2.OrderType.PACKAGE) {
                const pkg = enums_2.TOKEN_PACKAGES[obj.package_id];
                if (!pkg) {
                    throw new error_handler_1.default({
                        status_code: 400,
                        message: "Invalid package",
                    });
                }
                tokensGranted = pkg.tokens;
                amountInPaise = pkg.price_inr * 100;
                metaData.package_id = obj.package_id;
            }
            const paymentUUID = (0, crypto_1.randomUUID)();
            const razorpayOrderParams = {
                amount: amountInPaise,
                receipt: `order_rcptid_${new Date().getTime()}_${obj.user_id}`,
                currency: enums_1.Currency.INR,
                notes: {
                    user_id: obj.user_id,
                    type: obj.type,
                    package_id: obj.package_id || "",
                    payment_uuid: paymentUUID,
                    tokens_granted: tokensGranted.toString(),
                },
            };
            const razorpayOrder = yield this.razorpayManager.createOrder(razorpayOrderParams);
            const paymentsObj = {
                uuid: paymentUUID,
                user_id: obj.user_id,
                razorpay_order_id: razorpayOrder.id,
                razorpay_payment_id: null,
                razorpay_refund_id: null,
                razorpay_signature: null,
                amount_in_paise: amountInPaise,
                currency: enums_1.Currency.INR,
                status: enums_2.PaymentStatus.CREATED,
                tokens_granted: tokensGranted,
                failure_reason: null,
                refund_reason: null,
                meta_data: metaData,
                created_at: (0, moment_1.default)().format(),
                created_by: obj.user_id,
            };
            yield this.insertPaymentsDb(paymentsObj);
            return {
                payment_order_id: razorpayOrder.id,
                amount: amountInPaise,
                currency: enums_1.Currency.INR,
                payment_uuid: paymentUUID,
                tokens_granted: tokensGranted,
            };
        });
        this.paymentWebhookService = (obj) => __awaiter(this, void 0, void 0, function* () {
            const { raw_body, signature, dbClient } = obj;
            // 1) Verify HMAC over **raw** body using WEBHOOK secret (NOT key_secret)
            const bodyStr = Buffer.isBuffer(raw_body)
                ? raw_body.toString("utf8")
                : typeof raw_body === "string"
                    ? raw_body
                    : JSON.stringify(raw_body);
            // 2) Parse payload & basic fields
            const payload = JSON.parse(bodyStr);
            const { event, order_id, payment_id, refund_id, failure_reason, package_id, payment_uuid, user_id, method, tokens_granted, } = this.extractIdsFromWebhookPayload(payload);
            if (!payment_uuid) {
                throw new error_handler_1.default({
                    status_code: 400,
                    message: "No payment in payment notes",
                });
            }
            const paymentRecord = yield this.fetchPaymentsByUUID({
                uuid: payment_uuid,
                dbClient,
            });
            if (!paymentRecord) {
                throw new error_handler_1.default({
                    status_code: 404,
                    message: "Payment record not found",
                });
            }
            if (event === enums_2.RazorPayPaymentWebhookEvent.PAYMENT_CAPTURED) {
                if (paymentRecord.status === enums_2.PaymentStatus.PAID) {
                    // Idempotent - already processed
                    return;
                }
                const updateObj = {
                    uuid: payment_uuid,
                    razorpay_payment_id: payment_id,
                    status: enums_2.PaymentStatus.PAID,
                    tokens_granted: Number(tokens_granted === null || tokens_granted === void 0 ? void 0 : tokens_granted.toString()),
                    updated_at: (0, moment_1.default)().format(),
                    updated_by: user_id || paymentRecord.user_id,
                    dbClient,
                };
                yield this.updatePaymentById(updateObj);
                yield this.incrementUserTokensDb({
                    user_id: paymentRecord.user_id,
                    paid_tokens_granted: Number(tokens_granted === null || tokens_granted === void 0 ? void 0 : tokens_granted.toString()),
                    dbClient,
                });
            }
            else if (event === enums_2.RazorPayPaymentWebhookEvent.PAYMENT_FAILED) {
                // Idempotent - already processed
                if (paymentRecord.status === enums_2.PaymentStatus.FAILED) {
                    return;
                }
                const updateObj = {
                    uuid: payment_uuid,
                    razorpay_payment_id: payment_id,
                    status: enums_2.PaymentStatus.FAILED,
                    failure_reason: failure_reason || "Unknown",
                    updated_at: (0, moment_1.default)().format(),
                    updated_by: user_id || paymentRecord.user_id,
                    dbClient,
                };
                yield this.updatePaymentById(updateObj);
            }
            else if (event === enums_2.RazorPayPaymentWebhookEvent.REFUND_PROCESSED &&
                refund_id) {
                // Idempotent - already processed
                if (paymentRecord.status === enums_2.PaymentStatus.REFUNDED) {
                    return;
                }
                const updateObj = {
                    uuid: payment_uuid,
                    razorpay_refund_id: refund_id,
                    status: enums_2.PaymentStatus.REFUNDED,
                    refund_reason: failure_reason || "No reason provided",
                    updated_at: (0, moment_1.default)().format(),
                    updated_by: user_id || paymentRecord.user_id,
                    dbClient,
                };
                yield this.updatePaymentById(updateObj);
            }
            else if (event === enums_2.RazorPayPaymentWebhookEvent.PAYMENT_PENDING) {
                // Idempotent - already processed
                return;
            }
        });
        this.verifyPaymentService = (obj) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { dbClient } = obj;
            const paymentRecord = yield this.fetchPaymentsByUUID({
                uuid: obj.payment_uuid,
                dbClient,
            });
            if (!paymentRecord) {
                throw new error_handler_1.default({
                    status_code: 404,
                    message: "Payment record not found",
                });
            }
            if (paymentRecord.status === enums_2.PaymentStatus.PAID) {
                // Idempotent - already processed
                return {
                    success: true,
                    message: "Payment already verified",
                    user_id: paymentRecord.user_id,
                    tokens_granted: paymentRecord.tokens_granted || 0,
                    is_already_paid: true,
                };
            }
            // 1) Verify signature
            const isValidSignature = this.razorpayManager.verifySignature({
                payment_id: obj.payment_id,
                order_id: obj.payment_order_id,
                signature: obj.payment_signature,
            });
            if (!isValidSignature) {
                throw new error_handler_1.default({
                    status_code: 400,
                    message: "Invalid payment signature",
                });
            }
            const updateObj = {
                uuid: obj.payment_uuid,
                razorpay_payment_id: obj.payment_id,
                status: enums_2.PaymentStatus.PAID,
                tokens_granted: Number((_a = paymentRecord === null || paymentRecord === void 0 ? void 0 : paymentRecord.tokens_granted) === null || _a === void 0 ? void 0 : _a.toString()),
                updated_at: (0, moment_1.default)().format(),
                updated_by: obj.user_id || paymentRecord.user_id,
                dbClient,
            };
            yield this.updatePaymentById(updateObj);
            yield this.incrementUserTokensDb({
                user_id: paymentRecord.user_id,
                paid_tokens_granted: Number((_b = paymentRecord === null || paymentRecord === void 0 ? void 0 : paymentRecord.tokens_granted) === null || _b === void 0 ? void 0 : _b.toString()),
                dbClient,
            });
            return {
                success: true,
                message: "Payment verified successfully",
                user_id: paymentRecord.user_id,
                tokens_granted: paymentRecord.tokens_granted || 0,
                is_already_paid: false,
            };
        });
    }
}
exports.default = PaymentsService;
//# sourceMappingURL=service.js.map