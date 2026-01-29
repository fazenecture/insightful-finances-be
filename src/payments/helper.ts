import PaymentsDb from "./db";
import RazorpayManager from "./razorpay.manager";
import { RazorPayPaymentWebhookEvent } from "./types/enums";
import { ParsedRazorpayIds } from "./types/types";

export default class PaymentsHelper extends PaymentsDb {
  razorpayManager: RazorpayManager;
  constructor() {
    super();
    this.razorpayManager = new RazorpayManager();
  }

  protected extractReferenceWebhookIdFromPayload = (payload: any) => {
    /**
     * Extracts the reference webhook ID from the payload based on the event type.
     */
    if (payload?.event === RazorPayPaymentWebhookEvent.PAYMENT_CAPTURED) {
      return payload?.payload?.payment?.entity?.id || "";
    } else if (
      payload?.event === RazorPayPaymentWebhookEvent.REFUND_PROCESSED
    ) {
      return payload?.payload?.refund?.entity?.id || "";
    } else if (payload?.event === RazorPayPaymentWebhookEvent.PAYMENT_FAILED) {
      return payload?.payload?.payment?.entity?.id || "";
    } else {
      return "";
    }
  };

  protected extractIdsFromWebhookPayload = (
    payload: any,
  ): ParsedRazorpayIds => {
    const event: string = payload?.event;

    // Entities by type
    const p = payload?.payload?.payment?.entity; // for payment.* events
    const o = payload?.payload?.order?.entity; // for order.* events
    const r = payload?.payload?.refund?.entity; // for refund.* events

    // IDs
    const payment_id = p?.id || r?.payment_id || undefined;
    const order_id = p?.order_id || o?.id || undefined;
    const method = p?.method || undefined;
    const refund_id = r?.notes?.refund_id || undefined;
    const package_id = p?.notes?.package_id || undefined;
    const payment_uuid = p?.notes?.payment_uuid || undefined;
    const user_id = p?.notes?.user_id || undefined;
    const tokens_granted = p?.notes?.tokens_granted || undefined;

    // Failure reason (common for payment.failed)
    const failure_reason =
      p?.error_description ||
      p?.error_reason ||
      payload?.payload?.payment?.entity?.notes?.failure_reason ||
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
}
