import OpenAI from "openai";
import { Transaction, ExtractTransactionsInput, AccountContext } from "./types/types";
import { randomUUID } from "node:crypto";

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

Your ONLY responsibility is to accurately extract factual transaction data from the provided statement text.
You must be conservative, precise, and avoid assumptions.

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

RULE:
- If Account Type is "credit_card", all card spends belong to a credit card.
- If Account Type is "bank", debit card, UPI, IMPS, NEFT, POS are ALL bank transactions.
- You MUST NOT override this context.


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
      "recurring_signal": "SI | AUTO_DEBIT | MERCHANT_RECURRING | null",
    }
  ]
}

========================
CRITICAL DEFINITIONS
========================

INTERNAL TRANSFER:
Money moved BETWEEN TWO ACCOUNTS OWNED BY THE SAME USER.
Examples: savings → salary, bank → own wallet, self transfer.
Transaction having notes like "moving to another account"

========================
INTERNAL TRANSFER OVERRIDE RULES (NON-NEGOTIABLE)
========================

If a transaction is classified as is_internal_transfer = true:

- direction MUST be set based on statement sign ONLY
  (do NOT reinterpret as income or expense)

- category MUST be "personal_transfer"
- subcategory MUST be "self_transfer"

Internal transfers are NEVER:
- income
- expense
- salary
- investment

Explicit internal transfer indicators:
- RTGS / NEFT / IMPS
- Counterparty name EXACTLY matches account holder name
- Phrases like:
  - "SELF"
  - "OWN ACCOUNT"
  - "MOVING FUNDS"
  - "TRANSFER TO ANOTHER ACCOUNT"


NOT INTERNAL TRANSFERS (NEVER mark as internal):
- Payments to merchants (Zomato, Rapido, Amazon, Blinkit, Swiggy, Apple, etc.)
- Investments (Groww, Zerodha, mutual funds, stocks, SIPs)
- Payments to individuals (UPI to a person’s name or phone number)
- Food, transport, shopping, healthcare, subscriptions, or bills
- Any transaction where ownership of BOTH sides is not explicitly clear

When in doubt, ALWAYS set is_internal_transfer = false.

ACCOUNT HOLDER MATCH RULE (STRICT):

If the counterparty name matches the HolderName
(even partially, ignoring case and spacing),
THEN treat it as a potential self-transfer.

Example:
HolderName: ${input?.accountContext?.holderName}
Counterparty: ${input?.accountContext?.holderName?.toUpperCase()}
→ is_internal_transfer = true


========================
DIRECTION DEFINITION (CRITICAL)
========================

Direction represents USER CASHFLOW, not statement bookkeeping.

For BANK accounts:
- Credits → inflow
- Debits → outflow

For CREDIT CARD accounts:
- Card spends → outflow
- Refunds → inflow
- Credit card bill payments ("PAYMENT RECEIVED", "THANK YOU") → outflow


========================
RECURRING / SUBSCRIPTION SIGNALS (IMPORTANT)
========================

Your job is NOT to confirm subscriptions.
Your job is ONLY to flag possible recurring transactions.

Set:
- is_recurring_candidate = true
ONLY if there is EXPLICIT textual evidence.

Allowed signals:
1. Standing Instructions:
   - "SI"
   - "STANDING INSTRUCTION"
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
   - Disney+ Hotstar/JioHotstar
   - Sonyliv
   - Medium
   - LinkedIn

   → recurring_signal = "MERCHANT_RECURRING"

Rules:
- Investments (Groww, Zerodha, SIP, mutual funds) are NEVER subscriptions
- One-time purchases from these merchants are still candidates, NOT confirmed
- If unsure, set is_recurring_candidate = false and recurring_signal = null

========================
NON-NEGOTIABLE RULES
========================
- Parse Indian date formats correctly (DD/MM/YYYY, DD-MM-YYYY)
- Parse Indian number formats correctly (commas, lakhs)
- Amount must ALWAYS be positive
- direction:
  - inflow = credits, deposits, refunds
  - outflow = debits, spends, withdrawals
- source must be ONE of:
  - "upi"
  - "bank"
  - "credit_card"
- Categorization must be conservative (find it on the basis of transaction notes/merchant)
- If unsure about category or subcategory, set it to null
- DO NOT invent transactions
- DO NOT merge or split transactions
- DO NOT calculate totals or summaries
- DO NOT reinterpret transaction meaning
- DO NOT guess account ownership

CARD SOURCE RULES (IMPORTANT):
- Debit Card (DC) transactions MUST be classified as source = "bank"
- Credit Card transactions MUST only be classified as source = "credit_card"
  when the statement is clearly a credit card statement
  or explicitly mentions "Credit Card", "CC", or a credit card account.
- POS or card transactions without explicit credit card context
  MUST default to source = "bank"
- Standing Instructions (SI) from debit cards are NOT credit card spends

CREDIT CARD STATEMENT SPECIAL RULES (VERY IMPORTANT):

- Credit Card bill payments ("PAYMENT RECEIVED", "THANK YOU")
  MUST NOT be treated as income.

If Account Type = "credit_card" AND transaction description indicates:
- "PAYMENT RECEIVED"
- "THANK YOU"
- "CREDIT CARD PAYMENT"
- "BILL PAYMENT"

THEN:
- direction = "inflow"
- category = null
- subcategory = null
- confidence = 1.0

These are balance settlements, NOT income.

========================
INCOME CATEGORIZATION RULES
========================

If direction = "inflow" AND description contains:
- "SALARY"
- "PAYROLL"
- "MONTHLY SAL"
- "CREDIT SALARY"
- Employer name + fixed monthly pattern

THEN:
- category = "financial_services"
- subcategory = "salary"
- is_internal_transfer = false
- confidence = 1.0

========================
INVESTMENT / DEMAT CATEGORIZATION
========================

If transaction involves:
- Demat account
- Broker
- Mutual fund platform
- Stock trading platform

Examples:
- Groww
- Zerodha
- Upstox
- Angel One
- ICICI Direct
- Kuvera
- Coin
- NSE
- BSE
- "DEMAT"
- "MF"
- "SIP"

THEN:
- category = "financial_services"
- subcategory = "investment"
- is_internal_transfer = false

========================
RULE EVALUATION ORDER (MANDATORY)
========================

Apply rules in this exact order:

1. Internal transfer detection
2. Credit card special cases
3. Income classification (salary)
4. Investment classification
5. Merchant-based categorization
6. Fallback to null

Once a rule applies, DO NOT override it later.


========================
ALLOWED CATEGORIES (STRICT)
========================

You MUST choose a category ONLY from the list below.
If a transaction clearly matches one of these categories, you SHOULD assign it.
If it does not clearly match any, set category = null.

CATEGORIES:
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

SUBCATEGORY RULES:
- Subcategory is OPTIONAL
- Use simple values like:
  - "restaurant"
  - "fast_food"
  - "online_grocery"
  - "fashion"
  - "fuel_station"
  - "flight"
  - "hotel"
- If unsure, set subcategory = null

========================
MERCHANT CATEGORIZATION RULES
========================

Use the merchant name and transaction description to categorize.

Explicit mappings:

FOOD & DINING:
- Swiggy
- Zomato
- McDonalds
- Restaurants, cafes, bars
→ category = "food_and_dining"

GROCERIES:
- Blinkit
- Zepto
- BigBasket
- Instamart
→ category = "groceries"

SHOPPING:
- Amazon (non-flight, non-digital)
- Myntra
- Nykaa
- Ajio
- Arvind Fashions
→ category = "shopping"

TRAVEL:
- Amazon Flights
- IBIBO GROUP (Goibibo)
→ category = "travel"
  subcategory = "flight"

FUEL:
- Any merchant containing "FUELS", "PETROL", "FILLING STATION"
→ category = "fuel"

If multiple categories are possible:
- Prefer the MOST COMMON consumer interpretation
- Do NOT overthink

========================
CREDIT CARD BILL PAYMENT OVERRIDE (ABSOLUTE)
========================

If Account Type = "credit_card" AND transaction description contains:
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

This represents the user paying the credit card bill.
It is NEVER income or inflow.


========================
CONFIDENCE SCORING
========================
Assign a confidence score per transaction:
- 1.0 = explicitly clear from text
- 0.7 = strong inference
- 0.4 = weak inference
- 0.0 = unclear / ambiguous

========================
INPUT STATEMENT TEXT
========================
${input.pageText}
`;

  const res = await this.client.chat.completions.create({
    model: "gpt-4.1-mini",
    // model: "gpt-4.1",
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });

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
