import moment from "moment";
import ErrorHandler from "../helper/error.handler";
import { Currency } from "../processor/types/enums";
import PaymentsHelper from "./helper";
import {
  OrderType,
  PaymentStatus,
  RazorPayPaymentWebhookEvent,
  TOKEN_PACKAGES,
} from "./types/enums";
import {
  ICreateOrderServiceReqObj,
  IInsertPaymentDbReqObj,
  IPaymentDbResObj,
  IPaymentWebHookReqObj,
  IVerifyPaymentServiceReqObj,
} from "./types/types";
import { randomUUID } from "crypto";

export default class PaymentsService extends PaymentsHelper {
  protected createOrderService = async (obj: ICreateOrderServiceReqObj) => {
    let tokensGranted: number = 0;
    let amountInPaise: number = 0;
    let metaData: any = {};

    if (obj.type === OrderType.PACKAGE) {
      const pkg = TOKEN_PACKAGES[obj.package_id!];
      if (!pkg) {
        throw new ErrorHandler({
          status_code: 400,
          message: "Invalid package",
        });
      }

      tokensGranted = pkg.tokens;
      amountInPaise = pkg.price_inr * 100;
      metaData.package_id = obj.package_id;
    }

    const paymentUUID = randomUUID();

    const razorpayOrderParams = {
      amount: amountInPaise,
      receipt: `order_rcptid_${new Date().getTime()}_${obj.user_id}`,
      currency: Currency.INR,
      notes: {
        user_id: obj.user_id,
        type: obj.type,
        package_id: obj.package_id || "",
        payment_uuid: paymentUUID,
        tokens_granted: tokensGranted.toString(),
      },
    };

    const razorpayOrder =
      await this.razorpayManager.createOrder(razorpayOrderParams);

    const paymentsObj: IInsertPaymentDbReqObj = {
      uuid: paymentUUID,
      user_id: obj.user_id,
      razorpay_order_id: razorpayOrder.id,
      razorpay_payment_id: null,
      razorpay_refund_id: null,
      razorpay_signature: null,
      amount_in_paise: amountInPaise,
      currency: Currency.INR,
      status: PaymentStatus.CREATED,
      tokens_granted: tokensGranted,
      failure_reason: null,
      refund_reason: null,
      meta_data: metaData,
      created_at: moment().format(),
      created_by: obj.user_id,
    };

    await this.insertPaymentsDb(paymentsObj);

    return {
      payment_order_id: razorpayOrder.id,
      amount: amountInPaise / 100,
      currency: Currency.INR,
      payment_uuid: paymentUUID,
      tokens_granted: tokensGranted,
    };
  };

  protected paymentWebhookService = async (obj: IPaymentWebHookReqObj) => {
    const { raw_body, signature, dbClient } = obj;

    // 1) Verify HMAC over **raw** body using WEBHOOK secret (NOT key_secret)
    const bodyStr = Buffer.isBuffer(raw_body)
      ? raw_body.toString("utf8")
      : typeof raw_body === "string"
        ? raw_body
        : JSON.stringify(raw_body);

    // 2) Parse payload & basic fields
    const payload = JSON.parse(bodyStr);

    const {
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
    } = this.extractIdsFromWebhookPayload(payload);

    if (!payment_uuid) {
      throw new ErrorHandler({
        status_code: 400,
        message: "No payment in payment notes",
      });
    }

    const paymentRecord = await this.fetchPaymentsByUUID({
      uuid: payment_uuid,
      dbClient,
    });

    if (!paymentRecord) {
      throw new ErrorHandler({
        status_code: 404,
        message: "Payment record not found",
      });
    }

    if (event === RazorPayPaymentWebhookEvent.PAYMENT_CAPTURED) {
      if (paymentRecord.status === PaymentStatus.PAID) {
        // Idempotent - already processed
        return;
      }

      const updateObj: Partial<IPaymentDbResObj> = {
        uuid: payment_uuid,
        razorpay_payment_id: payment_id,
        status: PaymentStatus.PAID,
        tokens_granted: Number(tokens_granted?.toString()),
        updated_at: moment().format(),
        updated_by: user_id || paymentRecord.user_id,

        dbClient,
      };

      await this.updatePaymentById(updateObj);
      await this.incrementUserTokensDb({
        user_id: paymentRecord.user_id,
        paid_tokens_granted: Number(tokens_granted?.toString()),

        dbClient,
      });
    } else if (event === RazorPayPaymentWebhookEvent.PAYMENT_FAILED) {
      // Idempotent - already processed
      if (paymentRecord.status === PaymentStatus.FAILED) {
        return;
      }

      const updateObj: Partial<IPaymentDbResObj> = {
        uuid: payment_uuid,
        razorpay_payment_id: payment_id,
        status: PaymentStatus.FAILED,
        failure_reason: failure_reason || "Unknown",
        updated_at: moment().format(),
        updated_by: user_id || paymentRecord.user_id,

        dbClient,
      };

      await this.updatePaymentById(updateObj);
    } else if (
      event === RazorPayPaymentWebhookEvent.REFUND_PROCESSED &&
      refund_id
    ) {
      // Idempotent - already processed
      if (paymentRecord.status === PaymentStatus.REFUNDED) {
        return;
      }

      const updateObj: Partial<IPaymentDbResObj> = {
        uuid: payment_uuid,
        razorpay_refund_id: refund_id,
        status: PaymentStatus.REFUNDED,
        refund_reason: failure_reason || "No reason provided",
        updated_at: moment().format(),
        updated_by: user_id || paymentRecord.user_id,

        dbClient,
      };

      await this.updatePaymentById(updateObj);
    } else if (event === RazorPayPaymentWebhookEvent.PAYMENT_PENDING) {
      // Idempotent - already processed
      return;
    }
  };

  protected verifyPaymentService = async (
    obj: IVerifyPaymentServiceReqObj,
  ) => {
    const { dbClient } = obj;

    const paymentRecord = await this.fetchPaymentsByUUID({
      uuid: obj.payment_uuid,
      dbClient,
    });

    if (!paymentRecord) {
      throw new ErrorHandler({
        status_code: 404,
        message: "Payment record not found",
      });
    }

    if (paymentRecord.status === PaymentStatus.PAID) {
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
      throw new ErrorHandler({
        status_code: 400,
        message: "Invalid payment signature",
      });
    }

    const updateObj: Partial<IPaymentDbResObj> = {
      uuid: obj.payment_uuid,
      razorpay_payment_id: obj.payment_id,
      status: PaymentStatus.PAID,
      tokens_granted: Number(paymentRecord?.tokens_granted?.toString()),
      updated_at: moment().format(),
      updated_by: obj.user_id || paymentRecord.user_id,

      dbClient,
    };

    await this.updatePaymentById(updateObj);
    await this.incrementUserTokensDb({
      user_id: paymentRecord.user_id,
      paid_tokens_granted: Number(paymentRecord?.tokens_granted?.toString()),

      dbClient,
    });

    return {
      success: true,
      message: "Payment verified successfully",
      user_id: paymentRecord.user_id,
      tokens_granted: paymentRecord.tokens_granted || 0,
      is_already_paid: false, 
    };
  };
}
