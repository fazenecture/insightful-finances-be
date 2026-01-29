"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
const razorpay_manager_1 = __importDefault(require("./razorpay.manager"));
const enums_1 = require("./types/enums");
class PaymentsHelper extends db_1.default {
    constructor() {
        super();
        this.extractReferenceWebhookIdFromPayload = (payload) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            /**
             * Extracts the reference webhook ID from the payload based on the event type.
             */
            if ((payload === null || payload === void 0 ? void 0 : payload.event) === enums_1.RazorPayPaymentWebhookEvent.PAYMENT_CAPTURED) {
                return ((_c = (_b = (_a = payload === null || payload === void 0 ? void 0 : payload.payload) === null || _a === void 0 ? void 0 : _a.payment) === null || _b === void 0 ? void 0 : _b.entity) === null || _c === void 0 ? void 0 : _c.id) || "";
            }
            else if ((payload === null || payload === void 0 ? void 0 : payload.event) === enums_1.RazorPayPaymentWebhookEvent.REFUND_PROCESSED) {
                return ((_f = (_e = (_d = payload === null || payload === void 0 ? void 0 : payload.payload) === null || _d === void 0 ? void 0 : _d.refund) === null || _e === void 0 ? void 0 : _e.entity) === null || _f === void 0 ? void 0 : _f.id) || "";
            }
            else if ((payload === null || payload === void 0 ? void 0 : payload.event) === enums_1.RazorPayPaymentWebhookEvent.PAYMENT_FAILED) {
                return ((_j = (_h = (_g = payload === null || payload === void 0 ? void 0 : payload.payload) === null || _g === void 0 ? void 0 : _g.payment) === null || _h === void 0 ? void 0 : _h.entity) === null || _j === void 0 ? void 0 : _j.id) || "";
            }
            else {
                return "";
            }
        };
        this.extractIdsFromWebhookPayload = (payload) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            const event = payload === null || payload === void 0 ? void 0 : payload.event;
            // Entities by type
            const p = (_b = (_a = payload === null || payload === void 0 ? void 0 : payload.payload) === null || _a === void 0 ? void 0 : _a.payment) === null || _b === void 0 ? void 0 : _b.entity; // for payment.* events
            const o = (_d = (_c = payload === null || payload === void 0 ? void 0 : payload.payload) === null || _c === void 0 ? void 0 : _c.order) === null || _d === void 0 ? void 0 : _d.entity; // for order.* events
            const r = (_f = (_e = payload === null || payload === void 0 ? void 0 : payload.payload) === null || _e === void 0 ? void 0 : _e.refund) === null || _f === void 0 ? void 0 : _f.entity; // for refund.* events
            // IDs
            const payment_id = (p === null || p === void 0 ? void 0 : p.id) || (r === null || r === void 0 ? void 0 : r.payment_id) || undefined;
            const order_id = (p === null || p === void 0 ? void 0 : p.order_id) || (o === null || o === void 0 ? void 0 : o.id) || undefined;
            const method = (p === null || p === void 0 ? void 0 : p.method) || undefined;
            const refund_id = ((_g = r === null || r === void 0 ? void 0 : r.notes) === null || _g === void 0 ? void 0 : _g.refund_id) || undefined;
            const package_id = ((_h = p === null || p === void 0 ? void 0 : p.notes) === null || _h === void 0 ? void 0 : _h.package_id) || undefined;
            const payment_uuid = ((_j = p === null || p === void 0 ? void 0 : p.notes) === null || _j === void 0 ? void 0 : _j.payment_uuid) || undefined;
            const user_id = ((_k = p === null || p === void 0 ? void 0 : p.notes) === null || _k === void 0 ? void 0 : _k.user_id) || undefined;
            const tokens_granted = ((_l = p === null || p === void 0 ? void 0 : p.notes) === null || _l === void 0 ? void 0 : _l.tokens_granted) || undefined;
            // Failure reason (common for payment.failed)
            const failure_reason = (p === null || p === void 0 ? void 0 : p.error_description) ||
                (p === null || p === void 0 ? void 0 : p.error_reason) ||
                ((_q = (_p = (_o = (_m = payload === null || payload === void 0 ? void 0 : payload.payload) === null || _m === void 0 ? void 0 : _m.payment) === null || _o === void 0 ? void 0 : _o.entity) === null || _p === void 0 ? void 0 : _p.notes) === null || _q === void 0 ? void 0 : _q.failure_reason) ||
                undefined;
            return {
                event,
                order_id,
                payment_id,
                refund_id,
                failure_reason,
                package_id,
                payment_uuid,
                user_id,
                method,
                tokens_granted,
            };
        };
        this.razorpayManager = new razorpay_manager_1.default();
    }
}
exports.default = PaymentsHelper;
//# sourceMappingURL=helper.js.map