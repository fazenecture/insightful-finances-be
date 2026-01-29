import { OrderType, PaymentStatus } from "./enums";
import { PoolClient } from "pg";

export type ICreateOrderServiceReqObj = {
    package_id: string;
    user_id: number;
    type: OrderType;
    meta_data?: Record<string, any>;
    payment_method: string;
    dbClient?: PoolClient;
}

export type IInsertPaymentDbReqObj = {
    uuid: string;
    user_id: number;
    razorpay_order_id: string;
    razorpay_payment_id?: string | null;
    razorpay_refund_id?: string | null;
    razorpay_signature?: string | null;
    amount_in_paise: number;
    currency: string;
    status: PaymentStatus;
    tokens_granted?: number;
    failure_reason?: string | null;
    refund_reason?: string | null;
    meta_data?: Record<string, any>;
    created_at: string;
    created_by: number;
    updated_at?: string;
    updated_by?: number;
}

export type IPaymentDbResObj = {
    id: number;
    uuid: string;
    user_id: number;
    razorpay_order_id: string;
    razorpay_payment_id?: string | null;
    razorpay_refund_id?: string | null;
    razorpay_signature?: string | null;
    amount_in_paise: number;
    currency: string;
    status: PaymentStatus;
    tokens_granted?: number;
    failure_reason?: string | null;
    refund_reason?: string | null;
    meta_data?: Record<string, any>;
    created_at: string;
    created_by: number;
    updated_at?: string;
    updated_by?: number;

    dbClient?: PoolClient;
}

export type IPaymentWebHookReqObj = {
  raw_body: Buffer;
  signature: string;

  dbClient?: PoolClient;
};

export type ParsedRazorpayIds = {
  event: string;
  order_id?: string; // order_...
  payment_id?: string; // pay_...
  refund_id?: string; // rfd_...
  failure_reason?: string;
  package_id?: string;
  payment_uuid?: string;
  tokens_granted?: string;
  user_id: number;
  method: string | undefined;
};

export type IUpdateUserTokensDbReqObj = {
  user_id: number;

  free_tokens_used: number;
  paid_tokens_used: number;

  free_tokens_granted?: number;
  paid_tokens_granted?: number;

  updated_at: string;
  updated_by: number;

  dbClient?: PoolClient;
}

export type IFetchPaymentByUUIDReqObj = {
  uuid: string;

  dbClient?: PoolClient;
}

export type IVerifyPaymentServiceReqObj = {
  payment_uuid: string;
  payment_id: string;
  user_id: number;
  payment_order_id: string;
  payment_signature: string;
  
  dbClient?: PoolClient;
}