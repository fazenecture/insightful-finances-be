import Razorpay from "razorpay";
import crypto from "crypto";
import {
  IRazorpayOrderParams,
  IVerifyWebhookSignatureParams,
  IRazorpayRefundParams,
  ICreateContactParams,
  ICreateContactRes,
  ICreateFundAccountParams,
  ICreateFundAccountRes,
  IValidateFundAccountReqObj,
} from "./types/razorpay";
import axios, { AxiosInstance } from "axios";
import {
  FundAccountTypes,
  FundAccountVerificationStatus,
} from "./types/enums";
import ErrorHandler from "../helper/error.handler";

export default class RazorpayManager {
  instance: Razorpay;
  http: AxiosInstance;

  // Razorpay initialization
  constructor() {
    this.instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // For endpoints not covered by the SDK (contacts, fund_accounts, etc.)
    this.http = axios.create({
      baseURL: "https://api.razorpay.com/v1",
      auth: {
        username: process.env.RAZORPAY_KEY_ID as string,
        password: process.env.RAZORPAY_KEY_SECRET as string,
      },
      timeout: 15000,
    });
  }

  public createOrder = async ({
    amount,
    receipt,
    currency = "INR",
    notes = {},
  }: IRazorpayOrderParams): Promise<any> => {
    return await this.instance.orders.create({
      amount: Math.round(amount * 100), // Razorpay expects amount in paise
      currency,
      receipt,
      notes,
      transfers: [],
    });
  };

  public verifyWebhookSignature = ({
    body,
    signature,
    secret,
  }: IVerifyWebhookSignatureParams): boolean => {
      const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)         // raw buffer
    .digest("hex");
    
    console.log('secret: ', secret);
  console.log("expectedSignature:", expectedSignature);
  console.log("signature:", signature);


  if (expectedSignature.length !== signature.length) {
    return false; // timingSafeEqual requires same length
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "utf8"),
    Buffer.from(signature, "utf8")
  );
};

  public verifySignature = ({
    order_id,
    payment_id,
    signature,
  }: {
    order_id: string;
    payment_id: string;
    signature: string;
  }): boolean => {
    const body = `${order_id}|${payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    return expectedSignature === signature;
  };

  public fetchPayment = async (payment_id: string): Promise<any> => {
    return await this.instance.payments.fetch(payment_id);
  };

  public refundPayment = async ({
    payment_id,
    amount,
    speed,
    notes,
  }: IRazorpayRefundParams): Promise<any> => {
  try {
    const payload: any = {
      // Razorpay expects paise
      amount: amount ? Math.round(amount * 100) : undefined,
      speed,
      notes,
    };

    const res = await this.instance.payments.refund(payment_id, payload);
    return res;
  } catch (err: any) {
    console.log("[RZ REFUND ERROR DETAILS]", {
      statusCode: err?.statusCode,
      message: err?.message,
      error: err?.error,
      description: err?.error?.description,
    });
    throw err;
  }

  };

  //   public releaseOnHoldPayment = async (
  //     payment_id: string
  //   ): Promise<any> => {
  //     return await this.instance.payments.transfer(payment_id, {
  //     });
  //   };

  public fetchOrder = async (order_id: string): Promise<any> => {
    return await this.instance.orders.fetch(order_id);
  };

  public fetchRefund = async (refund_id: string): Promise<any> => {
    return await this.instance.refunds.fetch(refund_id);
  };

  public createContact = async ({
    name,
    email,
    phone,
    referenceId,
    type = "vendor",
    notes,
  }: ICreateContactParams): Promise<ICreateContactRes> => {
    const { data } = await this.http.post("/contacts", {
      name,
      email,
      contact: phone,
      reference_id: referenceId,
      type,
      notes,
    });
    return { id: data.id, raw: data };
  };

  public createFundAccount = async ({
    contact_id,
    account_type,
    bank_account,
    vpa,
  }: ICreateFundAccountParams): Promise<ICreateFundAccountRes> => {
    const payload: any = {
      contact_id,
      account_type, // "bank_account" | "vpa"
    };

    if (account_type === FundAccountTypes.BANK_ACCOUNT && bank_account) {
      payload.bank_account = {
        ifsc: bank_account.ifsc,
        account_number: bank_account.account_number,
        name: bank_account.account_holder_name,
      };
    }

    if (account_type === FundAccountTypes.VPA && vpa) {
      payload.vpa = { address: vpa.address };
    }

    const { data } = await this.http.post("/fund_accounts", payload);
    return { id: data.id, raw: data };
  };

  public validateFundAccount = async (
    obj: IValidateFundAccountReqObj
  ): Promise<{ status: FundAccountVerificationStatus; raw: any }> => {
    try {
      // Razorpay fund account validation (penny drop / name match)
      // Endpoint commonly: POST /fund_accounts/validations

      const payload = {
        account_number: obj.account_number,
        fund_account: {
          id: obj.fund_account.id,
        },
        amount: obj.amount ?? 100, // in paise,
        currency: obj.currency ?? "INR",
        notes: obj.notes ?? {},
      };

      const { data } = await this.http.post(
        "/fund_accounts/validations",
        payload
      );

      // Map provider status -> our status
      // Adjust mapping based on actual response:
      // e.g., data.status: "created"|"processing"|"completed"|"failed"
      // and data.results.account_exists / data.results.name_matches etc.
      let status: FundAccountVerificationStatus =
        FundAccountVerificationStatus.PENDING;
      if (data?.status === "completed" && data?.results?.account_exists) {
        status = FundAccountVerificationStatus.VERIFIED;
      }
      if (data?.status === "failed") {
        status = FundAccountVerificationStatus.FAILED;
      } else if (data.status === "created"){
        status = FundAccountVerificationStatus.INITIATED;
      }

      return { status, raw: data };
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      console.error(
        "[RZ VALIDATE FUND ACCOUNT ERROR]",
        status,
        JSON.stringify(data, null, 2)
      );
      const msg =
        data?.error?.description ||
        data?.message ||
        err.message ||
        "Razorpay error";
        throw new ErrorHandler({
          message: msg,
          status_code: status,
        });
    }
  };
}
