import { Currency, TransactionDirection, TransactionSource } from "./enums";

export type Transaction = {
  transaction_id: string;
  user_id: string;
  account_id: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number | string;
  direction: TransactionDirection;
  source: TransactionSource;
  currency: Currency;

  category?: string;
  subcategory?: string;
  is_internal_transfer?: boolean;

  is_interest?: boolean;
  is_fee?: boolean;

  is_recurring_candidate?: boolean;
  recurring_signal?: "SI" | "AUTO_DEBIT" | "MERCHANT_RECURRING" | null;
};

export type MonthlyMetrics = {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  burnRate: number;
};

export type ProcessPdfBatchInput = {
  userId: string;
  accountId: string;
  pdfKeys: string[];
};

export type ProcessSinglePdfInput = {
  userId: string;
  accountId: string;
  s3Key: string;
};

export type ExtractTransactionsInput = {
  userId: string;
  accountId: string;
  pageText: string;
};

export type PersistAnalysisInput = {
  userId: string;
  snapshot: any;
};

export type GenerateNarrativeInput = {
  userId: string;
  snapshot: any;
};

export type AccountContext = {
  accountId: string; // internal ID you generate
  accountType: "bank" | "credit_card";
  bankName: string | null;
  accountLast4: string | null; // account or card last 4
  holderName?: string | null;
  cardLast4?: string | null;
  statementPeriod?: {
    start: string;
    end: string;
  };
};


export type IDetectedSubscription = {
  id: string;
  merchant: string;
  frequency: "weekly" | "monthly" | "annual";
  first_seen: string;
  is_active: boolean;
  confidence: number;
  average_amount: number;
  occurrences: number;
  transactions: string[]; // transaction_ids
  created_at: string;
  user_id: string;
};


export type IPageWithRows = {
  pageNumber: number;
  rows: string[];
};