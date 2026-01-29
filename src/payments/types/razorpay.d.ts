import { FundAccountTypes, PaymentEventWebhookLogsStatus } from "./enums";

export type IRazorpayOrderParams = {
  amount: number;
  receipt: string;
  currency?: string;
  notes?: Record<string, any>;
}

export type IRazorpayRefundParams = {
  payment_id: string;
  amount?: number;
  speed?: "normal" | "optimum";
  notes?: Record<string, any>;
}

export type IVerifyWebhookSignatureParams = {
  body: string;
  signature: string;
  secret: string;
}

/** --------- New: Contacts / Fund Accounts ---------- */
export interface ICreateContactParams {
  name: string;
  referenceId: string;
  email?: string;
  phone?: string;
  type?: "vendor" | "employee" | "customer" | string;
  notes?: Record<string, any>;
}
export interface ICreateContactRes {
  id: string;
  raw: any;
}


export interface ICreateFundAccountParams {
  contact_id: string;
  account_type: FundAccountTypes;
  bank_account?: {
    ifsc: string;
    account_number: string;
    account_holder_name?: string;
  };
  vpa?: {
    address: string; // e.g., someone@upi
  };
  notes?: Record<string, any>;
}

export interface ICreateFundAccountRes {
  id: string;
  raw: any;
}


export type IValidateFundAccountReqObj = {
  account_number: string;
  fund_account: {
    id: string;
  },
  amount: number;
  currency: string;
  notes: Record<string, any>;
};

export type IUpdateWebhookConsumedStatusReqObj = {
  event_id: string;
  status: PaymentEventWebhookLogsStatus;
  is_updated_only: boolean;
}