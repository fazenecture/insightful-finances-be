import OpenAI from "openai";
import { Transaction, ExtractTransactionsInput, AccountContext } from "./types/types";
import { randomUUID } from "node:crypto";
import logger from "../helper/logger";

export default class ProcessorLLM {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /* ================================
     TRANSACTION EXTRACTION
     ================================ */
public extractAndEnrichTransactions = async (input: {
  userId: number;
  accountId: string;
  pageText: string;
  accountContext: AccountContext;
  sessionId: string;
}): Promise<Transaction[]> => {


      const prompt = `
        You are a deterministic financial transaction extraction engine for Indian bank and credit card statements.

        Your PRIMARY responsibility is to accurately extract factual transaction data.
        Your SECONDARY responsibility is to conservatively enrich transactions with category signals
        when supported by clear or aligned evidence.

        You must be precise, bounded, and auditable.
        You must NOT hallucinate, invent, or over-interpret.

        You are provided with:
        1. Explicit ACCOUNT CONTEXT (authoritative)
        2. Raw STATEMENT TEXT for a single page or chunk

        You MUST use the provided account context as ground truth.
        You must NOT infer account type or ownership beyond this context.

        ========================
        ACCOUNT CONTEXT (AUTHORITATIVE)
        ========================
        - Account ID: ${input.accountContext.accountId}
        - Account Type: ${input.accountContext.accountType}
        ${input.accountContext.bankName ? `- Bank Name: ${input.accountContext.bankName}` : ""}
        ${input.accountContext.cardLast4 ? `- Card Last 4 Digits: ${input.accountContext.cardLast4}` : ""}
        - HolderName: ${input.accountContext.holderName}

        ACCOUNT CONTEXT RULES (NON-NEGOTIABLE):
        - If Account Type is "credit_card", all card spends belong to a credit card.
        - If Account Type is "bank", debit card, UPI, IMPS, NEFT, POS are ALL bank transactions.
        - You MUST NOT override or reinterpret this context.

        ========================
        STRICT OUTPUT FORMAT
        ========================
        Return ONLY valid JSON in the following exact structure.
        Do NOT include explanations, comments, or extra keys.

        {
          "transactions": [
            {
              "transaction_id": "uuid-like string",
              "date": "YYYY-MM-DD",
              "amount": number (positive, INR),
              "direction": "inflow | outflow",
              "description": "verbatim transaction text",
              "merchant": "clean merchant name or null",
              "source": "bank | upi | credit_card",
              "category": "string or null",
              "subcategory": "string or null",
              "is_internal_transfer": boolean,
              "confidence": number between 0 and 1,
              "is_recurring_candidate": boolean,
              "recurring_signal": "SI | AUTO_DEBIT | MERCHANT_RECURRING | null"
            }
          ]
        }

        ========================
        CORE DEFINITIONS
        ========================

        INTERNAL TRANSFER:
        Money moved BETWEEN TWO ACCOUNTS OWNED BY THE SAME USER.
        Examples:
        - savings → own account
        - bank → own wallet
        - explicit self transfer

        Internal transfers are NEVER:
        - income
        - expense
        - salary
        - investment

        ========================
        INTERNAL TRANSFER DETECTION (ABSOLUTE PRIORITY)
        ========================

        Mark is_internal_transfer = true ONLY if ownership on BOTH sides is explicit.

        Explicit indicators:
        - RTGS / NEFT / IMPS
        - Counterparty name matches HolderName (partial, case-insensitive)
        - Phrases:
          - "SELF"
          - "OWN ACCOUNT"
          - "TRANSFER TO ANOTHER ACCOUNT"
          - "MOVING FUNDS"

        ACCOUNT HOLDER MATCH RULE (STRICT):
        If counterparty name matches HolderName (ignoring case and spacing)
        → is_internal_transfer = true

        If is_internal_transfer = true:
        - direction MUST follow statement sign ONLY
        - category = "personal_transfer"
        - subcategory = "self_transfer"
        - confidence = 1.0

        When in doubt → is_internal_transfer = false

        ========================
        DIRECTION DEFINITION (CRITICAL)
        ========================

        Direction represents USER CASHFLOW.

        BANK accounts:
        - Credits → inflow
        - Debits → outflow

        CREDIT CARD accounts:
        - Card spends → outflow
        - Refunds → inflow
        - Bill payments → outflow

        ========================
        CREDIT CARD BILL PAYMENT OVERRIDE (ABSOLUTE)
        ========================

        If Account Type = "credit_card" AND description contains:
        - "PAYMENT RECEIVED"
        - "THANK YOU"
        - "CREDIT CARD PAYMENT"
        - "BILL PAYMENT"

        THEN FORCE:
        - direction = "outflow"
        - category = null
        - subcategory = null
        - is_internal_transfer = false
        - is_recurring_candidate = false
        - recurring_signal = null
        - confidence = 1.0

        These are balance settlements, NEVER income.

        ========================
        INCOME CLASSIFICATION
        ========================

        If direction = "inflow" AND description contains:
        - "SALARY"
        - "PAYROLL"
        - "MONTHLY SAL"
        - "CREDIT SALARY"
        - Employer name with fixed monthly pattern

        THEN:
        - category = "financial_services"
        - subcategory = "salary"
        - confidence = 1.0

        ========================
        INVESTMENT / DEMAT CLASSIFICATION
        ========================

        If transaction involves:
        - Demat accounts
        - Brokers
        - Mutual funds
        - SIPs

        Examples:
        - Groww, Zerodha, Upstox, Angel One
        - Kuvera, Coin
        - NSE, BSE
        - "MF", "SIP", "DEMAT"

        THEN:
        - category = "financial_services"
        - subcategory = "investment"
        - is_internal_transfer = false
        - confidence = 1.0

        ========================
        RECURRING / SUBSCRIPTION SIGNALS
        ========================

        Your job is NOT to confirm subscriptions.
        Only flag possible recurring transactions.

        Set is_recurring_candidate = true ONLY with explicit evidence.

        Allowed signals:
        1. Standing instructions:
          - "SI"
          - "AUTO DEBIT"
          - "E-MANDATE"
          - "NACH"
          → recurring_signal = "SI" or "AUTO_DEBIT"

        2. Known recurring merchants:
          - Apple Media Services
          - Google Play
          - Netflix
          - Spotify
          - Amazon Prime
          - Microsoft
          - Adobe
          - Disney+ Hotstar / JioHotstar
          - Sonyliv
          - Medium
          - LinkedIn
          → recurring_signal = "MERCHANT_RECURRING"

        If unsure:
        - is_recurring_candidate = false
        - recurring_signal = null

        ========================
        ALLOWED CATEGORIES (STRICT)
        ========================

        Categories (choose ONLY from this list):
        - food_and_dining
        - groceries
        - shopping
        - transport
        - fuel
        - travel
        - healthcare
        - entertainment
        - subscriptions
        - utilities
        - financial_services
        - personal_transfer
        - accommodation
        - education
        - others

        Subcategory:
        - Optional
        - Simple lowercase strings only
        - If unsure → null

        ========================
        MERCHANT IDENTIFICATION (IMPORTANT)
        ========================

        Treat a transaction as a MERCHANT PAYMENT if:
        - Description includes UPI / POS / CARD
        - Counterparty is NOT a person name
        - Counterparty is NOT a bank or investment platform

        UPI Merchant Pattern:
        - UPI-<NAME>-<ID>@<BANK>
        If <NAME> is not a person → merchant entity


        PERSON VS MERCHANT HEURISTIC (IMPORTANT):

        Treat the counterparty as a PERSON (NOT a merchant) if ANY of the following are true:
        - Name resembles a personal name (e.g., First Name + Last Name patterns)
        - Contains a mobile number (10-digit or masked)
        - UPI handle ends with personal identifiers such as:
          - "@okaxis", "@okhdfcbank", "@oksbi", "@paytm", "@upi"
          AND the prefix appears to be a person name or phone number

        Examples (PERSON, NOT merchant):
        - UPI-RAHUL-KUMAR-9876543210@OKAXIS
        - UPI-ANITA@OKHDFC
        - UPI-9876543210@PAYTM

        Treat the counterparty as a MERCHANT if:
        - Name does NOT resemble a person
        - Does NOT contain a phone number
        - Appears as a brand, shop, service, or business name


        ========================
        MERCHANT-BASED CATEGORIZATION
        ========================

        Explicit mappings:

        FOOD & DINING:
        - Swiggy
        - Zomato
        - McDonalds
        - Cafes, restaurants, bars

        GROCERIES:
        - Blinkit
        - Zepto
        - BigBasket
        - Instamart

        SHOPPING:
        - Amazon (non-flight, non-digital)
        - Myntra
        - Nykaa
        - Ajio

        TRAVEL:
        - Amazon Flights
        - IBIBO GROUP (Goibibo)
        → subcategory = "flight"

        FUEL:
        - Contains "FUEL", "PETROL", "FILLING STATION"

        ========================
        WEAK-SIGNAL CATEGORIZATION (ALLOWED, BOUNDED)
        ========================

        You MAY assign a category using weak signals ONLY if ALL are true:
        - direction = "outflow"
        - is_internal_transfer = false
        - Merchant payment is detected
        - At least TWO of the following signals align:
          - Merchant name looks like a business
          - Amount < ₹300
          - UPI merchant ID (@YBL, @OK, @AXIS, etc.)
          - No income / investment / bill keywords

        Examples:
        - Small UPI merchant spends → food_and_dining
        - Transport indicators include:
          - Ride-hailing keywords (Uber, Ola, Rapido)
          - Parking, tolls, metro, bus
          - Small frequent merchant spends near commute hours

        If only ONE signal exists → category MUST be null.

        ========================
        AMOUNT AS SUPPORTING SIGNAL
        ========================

        Amount may be used ONLY as a supporting signal, NEVER alone.

        Rules:
        - ₹1–₹200 supports food_and_dining / transport
        - ₹2,000+ contradicts food unless explicit
        - If amount contradicts category → do NOT assign

        ========================
        RULE EVALUATION ORDER (MANDATORY)
        ========================

        1. Internal transfer detection
        2. Credit card bill override
        3. Income classification
        4. Investment classification
        5. Explicit merchant categorization
        6. Weak-signal categorization
        7. Fallback to null

        Once a rule applies, DO NOT override it later.

        ========================
        CONFIDENCE SCORING (STRICT)
        ========================

        - Explicit rule match → confidence = 1.0
        - Weak-signal categorization → confidence ≤ 0.7
        - Category = null → confidence ≤ 0.4

        ========================
        INPUT STATEMENT TEXT
        ========================
        ${input.pageText}
        `;


  logger.info("Sending transaction extraction prompt to OpenAI");
  const res = await this.client.chat.completions.create({
    model: "gpt-4.1-mini",
    // model: "gpt-4.1",
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  logger.info("Received response from OpenAI for transaction extraction");

  const parsed = JSON.parse(res.choices[0].message.content!);

  return parsed.transactions.map((t: any) => ({
    transaction_id: randomUUID(),
    user_id: input.userId,
    account_id: input.accountId,

    date: t.date,
    amount: t.amount,
    direction: t.direction,
    description: t.description,
    merchant: t.merchant,

    source: t.source,
    category: t.category,
    subcategory: t.subcategory,

    is_internal_transfer: t.is_internal_transfer,
    currency: "INR",
    session_id: input.sessionId,

    // optional but VERY useful
    confidence: t.confidence,

    is_recurring_candidate: t.is_recurring_candidate,
    recurring_signal: t.recurring_signal,
  }));
};


  public detectStatementContext = async (input: {
  firstPageText: string;
}): Promise<AccountContext> => {

  const prompt = `
You are a deterministic Indian bank statement classifier.

Your task is to extract ACCOUNT CONTEXT from the FIRST PAGE of a statement.

========================
WHAT YOU MUST IDENTIFY
========================
From the text below, determine:

1. Account Type:
   - "bank" OR "credit_card"

2. Bank Name:
   - e.g. HDFC Bank, ICICI Bank, Axis Bank
   - null if not found

3. Account / Card Last 4 Digits:
   - Use masked number (XXXX1234 → 1234)
   - null if not found

4. Account Holder Name (if present)

5. Statement Period (if present)

========================
STRICT OUTPUT FORMAT
========================
Return ONLY valid JSON:

{
  "accountType": "bank | credit_card",
  "bankName": string | null,
  "accountLast4": string | null,
  "holderName": string | null,
  "cardLast4": string | null,
  "statementPeriod": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD"
  } | null
}

========================
IMPORTANT RULES
========================
- If the text mentions "Credit Card Statement", classify as credit_card
- Debit card usage DOES NOT mean credit card
- Do NOT guess missing values
- If unsure, set field to null

========================
STATEMENT FIRST PAGE TEXT
========================
${input.firstPageText}
`;

  const res = await this.client.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

  const parsed = JSON.parse(res.choices[0].message.content!);
  return parsed;
}


  /* ================================
     NARRATIVE (READ-ONLY)
     ================================ */

public generateNarrative = async (input: {
  userId: number;
  snapshot: any;
}): Promise<string> => {

  const prompt = `
        You are a deterministic financial analysis engine for an Indian personal finance application.

      You are given a PRECOMPUTED financial analysis SNAPSHOT.
      Your task is to STRUCTURE and INTERPRET this snapshot into a UI-ready insight report.

      You must be precise, conservative, and strictly rule-driven.

      ========================
      CRITICAL CONSTRAINTS (NON-NEGOTIABLE)
      ========================
      - DO NOT recompute numbers
      - DO NOT infer missing data
      - DO NOT introduce new metrics
      - DO NOT contradict the snapshot
      - DO NOT fabricate trends or causes
      - DO NOT include explanations or prose outside JSON
      - RETURN ONLY valid JSON
      - Output MUST EXACTLY match the schema below

      ========================
      OUTPUT SCHEMA (STRICT)
      ========================

      {
        "summary": string[],

        "monthly_breakdown": [
          {
            "month": "MMM YYYY",
            "income": number,
            "expenses": number,
            "savings": number,
            "savingsRate": number
          }
        ],

        "category_breakdown": [
          {
            "category": string,
            "amount": number,
            "percentage": number,
            "trend": "up" | "down" | "stable",
            "count": number
          }
        ],

        "subscriptions": [
          {
            "merchant": string,
            "frequency": "weekly" | "monthly" | "annual",
            "average_amount": number,
            "is_active": boolean,
            "confidence": number,
            "occurrences": number,
            "first_seen": "YYYY-MM-DD"
          }
        ],

        "patterns": [
          {
            "pattern": string,
            "description": string,
            "impact": "positive" | "negative" | "neutral"
          }
        ],

        "recommendations": [
          {
            "title": string,
            "impact": string,
            "confidence": "low" | "medium" | "high"
          }
        ],

        "goal_alignment_score": number,

        "total_income": number,
        "total_expenses": number,
        "net_savings": number,

        "analysis_period": {
          "start": "YYYY-MM-DD",
          "end": "YYYY-MM-DD"
        }
      }

      ========================
      HOW TO INTERPRET SNAPSHOT DATA
      ========================

      SUMMARY:
      - Provide 4–6 concise, insight-driven bullet points
      - Reference ONLY values and patterns present in the snapshot
      - May reference subscriptions if present
      - Avoid generic financial advice

      MONTHLY BREAKDOWN:
      - Use cashflow.months
      - savings = income − expenses (already provided or directly derivable)
      - savingsRate = savings / income * 100
      - Format month as "MMM YYYY"

      CATEGORY BREAKDOWN:
      - Use dominant expense categories only
      - percentage = percentageOfExpense * 100
      - trend:
        - "up" if spending increases across months
        - "down" if decreases
        - "stable" otherwise
      - count = number of transactions (estimate conservatively)

      ========================
      SUBSCRIPTIONS (FACTUAL, READ-ONLY)
      ========================

      If snapshot includes a "subscriptions" array:

      - Populate the subscriptions section directly from snapshot data
      - DO NOT modify, aggregate, annualize, or recompute subscription values
      - Preserve merchant naming as-is
      - Include both active and inactive subscriptions
      - Order subscriptions by is_active (true first), then by confidence descending

      ========================
      PATTERNS
      ========================

      - Detect observable behavioral patterns ONLY from snapshot data
      - Patterns MAY reference subscriptions, but MUST NOT recompute costs

      Allowed subscription-related patterns:
      - High number of active subscriptions
      - Low-usage active subscriptions (low occurrences)
      - High average_amount subscriptions
      - Subscription redundancy or clustering

      Impact rules:
      - "negative" → recurring cost inefficiency
      - "neutral" → informational patterns
      - "positive" → only if explicitly supported by snapshot health indicators

      ========================
      RECOMMENDATIONS
      ========================

      - Must directly correspond to detected patterns
      - Must be realistic and actionable
      - Subscription recommendations must reference:
        - low usage
        - high cost
        - redundancy
      - Avoid generic advice like “cancel unused subscriptions”

      ========================
      GOAL ALIGNMENT SCORE
      ========================

      - Use snapshot.healthScore normalized to a 0–1 scale

      ========================
      ANALYSIS PERIOD
      ========================

      - Use earliest and latest months from cashflow.months

      ========================
      FINAL VALIDATION RULES
      ========================

      - All numeric values MUST come from snapshot
      - No empty arrays unless snapshot truly lacks data
      - Output MUST be valid JSON
      - No trailing commas
      - No commentary outside the schema

      ========================
      INPUT SNAPSHOT (READ-ONLY)
      ========================
      ${JSON.stringify(input.snapshot, null, 2)}
      `;


  const res = await this.client.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0.25,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "text" }
  });

  return res.choices[0].message.content!;
};
}
