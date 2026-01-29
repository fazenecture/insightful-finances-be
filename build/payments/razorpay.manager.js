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
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const enums_1 = require("./types/enums");
const error_handler_1 = __importDefault(require("../helper/error.handler"));
class RazorpayManager {
    // Razorpay initialization
    constructor() {
        this.createOrder = (_a) => __awaiter(this, [_a], void 0, function* ({ amount, receipt, currency = "INR", notes = {}, }) {
            return yield this.instance.orders.create({
                amount: Math.round(amount * 100), // Razorpay expects amount in paise
                currency,
                receipt,
                notes,
                transfers: [],
            });
        });
        this.verifyWebhookSignature = ({ body, signature, secret, }) => {
            const expectedSignature = crypto_1.default
                .createHmac("sha256", secret)
                .update(body) // raw buffer
                .digest("hex");
            console.log('secret: ', secret);
            console.log("expectedSignature:", expectedSignature);
            console.log("signature:", signature);
            if (expectedSignature.length !== signature.length) {
                return false; // timingSafeEqual requires same length
            }
            return crypto_1.default.timingSafeEqual(Buffer.from(expectedSignature, "utf8"), Buffer.from(signature, "utf8"));
        };
        this.verifySignature = ({ order_id, payment_id, signature, }) => {
            const body = `${order_id}|${payment_id}`;
            const expectedSignature = crypto_1.default
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(body)
                .digest("hex");
            return expectedSignature === signature;
        };
        this.fetchPayment = (payment_id) => __awaiter(this, void 0, void 0, function* () {
            return yield this.instance.payments.fetch(payment_id);
        });
        this.refundPayment = (_a) => __awaiter(this, [_a], void 0, function* ({ payment_id, amount, speed, notes, }) {
            var _b;
            try {
                const payload = {
                    // Razorpay expects paise
                    amount: amount ? Math.round(amount * 100) : undefined,
                    speed,
                    notes,
                };
                const res = yield this.instance.payments.refund(payment_id, payload);
                return res;
            }
            catch (err) {
                console.log("[RZ REFUND ERROR DETAILS]", {
                    statusCode: err === null || err === void 0 ? void 0 : err.statusCode,
                    message: err === null || err === void 0 ? void 0 : err.message,
                    error: err === null || err === void 0 ? void 0 : err.error,
                    description: (_b = err === null || err === void 0 ? void 0 : err.error) === null || _b === void 0 ? void 0 : _b.description,
                });
                throw err;
            }
        });
        //   public releaseOnHoldPayment = async (
        //     payment_id: string
        //   ): Promise<any> => {
        //     return await this.instance.payments.transfer(payment_id, {
        //     });
        //   };
        this.fetchOrder = (order_id) => __awaiter(this, void 0, void 0, function* () {
            return yield this.instance.orders.fetch(order_id);
        });
        this.fetchRefund = (refund_id) => __awaiter(this, void 0, void 0, function* () {
            return yield this.instance.refunds.fetch(refund_id);
        });
        this.createContact = (_a) => __awaiter(this, [_a], void 0, function* ({ name, email, phone, referenceId, type = "vendor", notes, }) {
            const { data } = yield this.http.post("/contacts", {
                name,
                email,
                contact: phone,
                reference_id: referenceId,
                type,
                notes,
            });
            return { id: data.id, raw: data };
        });
        this.createFundAccount = (_a) => __awaiter(this, [_a], void 0, function* ({ contact_id, account_type, bank_account, vpa, }) {
            const payload = {
                contact_id,
                account_type, // "bank_account" | "vpa"
            };
            if (account_type === enums_1.FundAccountTypes.BANK_ACCOUNT && bank_account) {
                payload.bank_account = {
                    ifsc: bank_account.ifsc,
                    account_number: bank_account.account_number,
                    name: bank_account.account_holder_name,
                };
            }
            if (account_type === enums_1.FundAccountTypes.VPA && vpa) {
                payload.vpa = { address: vpa.address };
            }
            const { data } = yield this.http.post("/fund_accounts", payload);
            return { id: data.id, raw: data };
        });
        this.validateFundAccount = (obj) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            try {
                // Razorpay fund account validation (penny drop / name match)
                // Endpoint commonly: POST /fund_accounts/validations
                const payload = {
                    account_number: obj.account_number,
                    fund_account: {
                        id: obj.fund_account.id,
                    },
                    amount: (_a = obj.amount) !== null && _a !== void 0 ? _a : 100, // in paise,
                    currency: (_b = obj.currency) !== null && _b !== void 0 ? _b : "INR",
                    notes: (_c = obj.notes) !== null && _c !== void 0 ? _c : {},
                };
                const { data } = yield this.http.post("/fund_accounts/validations", payload);
                // Map provider status -> our status
                // Adjust mapping based on actual response:
                // e.g., data.status: "created"|"processing"|"completed"|"failed"
                // and data.results.account_exists / data.results.name_matches etc.
                let status = enums_1.FundAccountVerificationStatus.PENDING;
                if ((data === null || data === void 0 ? void 0 : data.status) === "completed" && ((_d = data === null || data === void 0 ? void 0 : data.results) === null || _d === void 0 ? void 0 : _d.account_exists)) {
                    status = enums_1.FundAccountVerificationStatus.VERIFIED;
                }
                if ((data === null || data === void 0 ? void 0 : data.status) === "failed") {
                    status = enums_1.FundAccountVerificationStatus.FAILED;
                }
                else if (data.status === "created") {
                    status = enums_1.FundAccountVerificationStatus.INITIATED;
                }
                return { status, raw: data };
            }
            catch (err) {
                const status = (_e = err === null || err === void 0 ? void 0 : err.response) === null || _e === void 0 ? void 0 : _e.status;
                const data = (_f = err === null || err === void 0 ? void 0 : err.response) === null || _f === void 0 ? void 0 : _f.data;
                console.error("[RZ VALIDATE FUND ACCOUNT ERROR]", status, JSON.stringify(data, null, 2));
                const msg = ((_g = data === null || data === void 0 ? void 0 : data.error) === null || _g === void 0 ? void 0 : _g.description) ||
                    (data === null || data === void 0 ? void 0 : data.message) ||
                    err.message ||
                    "Razorpay error";
                throw new error_handler_1.default({
                    message: msg,
                    status_code: status,
                });
            }
        });
        this.instance = new razorpay_1.default({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
        // For endpoints not covered by the SDK (contacts, fund_accounts, etc.)
        this.http = axios_1.default.create({
            baseURL: "https://api.razorpay.com/v1",
            auth: {
                username: process.env.RAZORPAY_KEY_ID,
                password: process.env.RAZORPAY_KEY_SECRET,
            },
            timeout: 15000,
        });
    }
}
exports.default = RazorpayManager;
//# sourceMappingURL=razorpay.manager.js.map