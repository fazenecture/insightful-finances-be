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
  accountId: string;              // internal ID you generate
  accountType: "bank" | "credit_card";
  bankName: string | null;
  accountLast4: string | null;    // account or card last 4
  holderName?: string | null;
  cardLast4?: string | null;
  statementPeriod?: {
    start: string;
    end: string;
  };
};