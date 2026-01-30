import { AnalysisStatus, Currency, TransactionDirection, TransactionSource } from "./enums";

export type Transaction = {
  transaction_id: string;
  user_id: number;
  account_id: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number | string;
  direction: TransactionDirection;
  source: TransactionSource;
  currency: Currency;

  session_id: string;

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
  userId: number;
  sessionId: string;
  pdfKeys: string[];
  tokensEstimate?: number;
};

export type ProcessSinglePdfInput = {
  userId: number;
  s3Key: string;
  sessionId: string;
};

export type ExtractTransactionsInput = {
  userId: number;
  accountId: string;
  pageText: string;
};

export type PersistAnalysisInput = {
  userId: number;
  snapshot: any;
  sessionId: string;
};

export type GenerateNarrativeInput = {
  userId: number;
  snapshot: any;
  sessionId: string;
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
  user_id: number;
};


export type IPageWithRows = {
  pageNumber: number;
  rows: string[];
};

export type IFetchAnalysisDataServiceReqObj = {
  user_id: number;
  session_id: string;
}

export type IAnalysisSessionObj = {
  session_id: string;
  user_id: number;
  source_type: string;
  status: AnalysisStatus;
  error_message?: string;
  tokens_expected?: number;
  tokens_used?: number;
  created_at?: string;
  updated_at?: string;
}

export type InsertAnalysisSessionResult = {
  session_id: string;
  status: AnalysisStatus;
  is_new: boolean;
};

export type IFetchNarrativeDbReqObj = {
  session_id: string;
  user_id: number;
}

export type IPdfTextMetrics = {
  total_chars: number;
  total_pages: number;
  non_empty_pages: number;
};

export type IUpdateAnalysisSessionBySessionIdReqObj = {
  session_id: string;
  status: AnalysisStatus;
  error_message?: string;
  tokens_used?: number;
  updated_at?: string;
  meta_data?: any;
}

export type IFetchTransactionsReqObj = {
  page: number;
  limit: number;
  search: string | null;
  session_id: string;
}

export type IUpdateUserTokensDbReqObj = {
  user_id: number;

  free_tokens_used: number;
  paid_tokens_used: number;

  free_tokens_granted?: number;
  paid_tokens_granted?: number;

  updated_at: string;
  updated_by: number;
}