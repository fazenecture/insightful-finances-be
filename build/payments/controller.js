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
const custom_error_1 = __importDefault(require("../helper/custom.error"));
const service_1 = __importDefault(require("./service"));
const postgres_1 = __importDefault(require("../config/postgres"));
const logger_1 = __importDefault(require("../helper/logger"));
class PaymentsController extends service_1.default {
    constructor() {
        super(...arguments);
        this.createOrderController = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const dbClient = (yield postgres_1.default.getClient());
            try {
                const { user_id, type, package_id, meta_data, payment_method } = req.body;
                yield dbClient.query("BEGIN");
                const order = yield this.createOrderService({
                    user_id,
                    type,
                    package_id,
                    meta_data,
                    payment_method,
                    dbClient,
                });
                yield dbClient.query("COMMIT");
                res.status(201).send({
                    success: true,
                    data: order,
                });
            }
            catch (error) {
                yield dbClient.query("ROLLBACK");
                (0, custom_error_1.default)(res, error);
            }
            finally {
                dbClient.release();
            }
        });
        this.paymentWebhookController = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const dbClient = (yield postgres_1.default.getClient());
            let result, webhook_id;
            try {
                const signature = req.header("x-razorpay-signature") ||
                    req.header("X-Razorpay-Signature");
                const rawBody = req.body; // Buffer from express.raw
                /**
                 * Validate the signature
                 */
                const rawStr = rawBody.toString("utf-8");
                console.log("rawStr: ", rawStr);
                if (!signature) {
                    logger_1.default.warn("Signature missing in webhook");
                    res.status(400).send({
                        success: false,
                        message: "Signature missing",
                    });
                    return;
                }
                const valid = this.razorpayManager.verifyWebhookSignature({
                    body: rawStr,
                    signature,
                    secret: process.env.RAZORPAY_WEBHOOK_SECRET,
                });
                if (!valid) {
                    logger_1.default.warn("Invalid webhook signature");
                    res.status(400).send({
                        success: false,
                        message: "Invalid webhook signature",
                    });
                    return;
                }
                const jsonBody = JSON.parse(rawStr);
                logger_1.default.info(`Webhook event received - type ${jsonBody.event}`);
                webhook_id = this.extractReferenceWebhookIdFromPayload(jsonBody);
                yield dbClient.query("BEGIN");
                result = yield this.paymentWebhookService({
                    raw_body: rawBody,
                    signature,
                    dbClient,
                });
                yield dbClient.query("COMMIT");
                res.status(200).send({
                    success: true,
                    data: result,
                });
            }
            catch (error) {
                yield dbClient.query("ROLLBACK");
                (0, custom_error_1.default)(res, error);
            }
            finally {
                dbClient.release();
            }
        });
        this.verifyPaymentController = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const dbClient = (yield postgres_1.default.getClient());
            try {
                const { payment_uuid, payment_id, user_id, payment_order_id, payment_signature, } = req.body;
                yield dbClient.query("BEGIN");
                const result = yield this.verifyPaymentService({
                    payment_uuid,
                    payment_id,
                    user_id,
                    payment_order_id,
                    payment_signature,
                    dbClient,
                });
                yield dbClient.query("COMMIT");
                res.status(200).send({
                    success: true,
                    data: result,
                });
            }
            catch (error) {
                yield dbClient.query("ROLLBACK");
                (0, custom_error_1.default)(res, error);
            }
            finally {
                dbClient.release();
            }
        });
    }
}
exports.default = PaymentsController;
//# sourceMappingURL=controller.js.map