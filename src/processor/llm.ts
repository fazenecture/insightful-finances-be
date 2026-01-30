import OpenAI from "openai";
import {
  Transaction,
  ExtractTransactionsInput,
  AccountContext,
} from "./types/types";
import { randomUUID } from "node:crypto";
import logger from "../helper/logger";
import fs from "fs";

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
        - account to another account in user's name

        Internal transfers are NEVER:
        - income
        - expense
        - salary
        - investment
        - merchant payments

        ========================
        INTERNAL TRANSFER DETECTION (ABSOLUTE PRIORITY):
        ========================

        INDIAN BANK SELF-TRANSFER OVERRIDE (STRICT):

        If ALL of the following are true:

        1. Transaction method is IMPS or NEFT
        2. Counterparty name matches HolderName
          (partial match, case-insensitive)
        3. Counterparty bank code differs from source bank
          (e.g., HDFC-, UTIB-, ICIC-)
        4. Description contains ONE of:
          - "Deposit"
          - "Bill Pay"

        AND
        - Counterparty is NOT a business
        - Counterparty is NOT a merchant
        - Transaction is NOT marked as merchant payment

        THEN:
        - is_internal_transfer = true
        - category = "personal_transfer"
        - subcategory = "self_transfer"
        - confidence = 0.95


        COUNTERPARTY EXTRACTION SCOPE (CRITICAL):
        The counterparty name MUST be extracted ONLY from the transaction line itself.
        IGNORE header, account holder details, address blocks, and statement metadata.

        If the HolderName appears ONLY in the statement header
        and NOT within the transaction description line,
        it MUST NOT be considered a counterparty match.


        Mark is_internal_transfer = true ONLY if BOTH conditions are satisfied:

        1. Counterparty name matches HolderName
            ONLY IF the match occurs within the transaction description line
            after the transfer marker (e.g., NEFT*, IMPS/, UPI/).

        AND

        2. Description contains explicit self-transfer intent keywords:
          - "SELF"
          - "OWN ACCOUNT"
          - "TRANSFER TO ANOTHER ACCOUNT"
          - "MOVING FUNDS"

        Transfer methods such as NEFT, IMPS, RTGS, or UPI
        are NEUTRAL and MUST NOT be used as the ONLY evidence of internal transfer.


        IMPORTANT NEGATIVE RULE:

        A counterparty name matching HolderName
        WITHOUT explicit self-transfer intent keywords
        MUST NOT be treated as an internal transfer.

        ABSOLUTE BLOCKERS (NON-OVERRIDABLE):

        If counterparty name appears to be a business, company, or organization,
        THEN is_internal_transfer MUST be false.

        Business indicators include:
        - "PVT", "PRIVATE", "LTD", "LIMITED", "LLP"
        - "TECH", "TECHNOLOGIES", "SYSTEMS", "SOLUTIONS"
        - "INDIA", "SERVICES", "ENTERPRISES"
        - Any pluralized or brand-style name

        CREDIT BUSINESS BLOCKER (ABSOLUTE):

        If direction = "inflow"
        AND description indicates NEFT / IMPS credit
        AND counterparty appears to be a business or organization,
        THEN is_internal_transfer MUST be false.


        If is_internal_transfer = true:
        - direction MUST follow statement sign ONLY
        - category = "personal_transfer"
        - subcategory = "self_transfer"
        - confidence = 1.0

        When in doubt → is_internal_transfer = false


        DIRECTION EXTRACTION SCOPE (ABSOLUTE):

        Direction MUST be determined ONLY from the transaction row itself,
        using numeric and column indicators.

        The model MUST NOT use:
        - Keywords such as "Deposit", "Credit", "Transfer"
        - Section headers like "DEP TFR", "INTEREST CREDIT"
        - Any text outside the transaction row

        If multiple rows are present, direction must be determined
        independently for each row.

        DIRECTION DETERMINATION (NON-INFERENTIAL):

        For BANK accounts:

        1. If the transaction amount is prefixed with "-" → direction = "outflow"
        2. If the transaction amount is NOT prefixed with "-" → direction = "inflow"

        Supporting evidence (may confirm but never override):
        - Balance decreases → outflow
        - Balance increases → inflow

        Textual keywords such as:
        - "Deposit"
        - "Credit"
        - "Debit"
        - "Transfer"
        MUST NOT be used to determine direction.

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
        - rent
        - income
        - investment
        - personal_care
        - fuel
        - travel
        - healthcare
        - entertainment
        - subscriptions
        - utilities
        - financial_services
        - personal_transfer
        - accommodation
        - donations
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
        - Dominos
        - Pizza Hut
        - Haldiram
        - Cafes, restaurants, bars

        GROCERIES:
        - Blinkit
        - Zepto
        - BigBasket
        - JioMart
        - Instamart

        SHOPPING:
        - Amazon (non-flight, non-digital)
        - Flipkart
        - Meesho
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

        Direction MUST be determined BEFORE applying rule evaluation order.

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

        CONFIDENCE represents confidence in the OVERALL transaction interpretation,
        not only categorization.

        Direction correctness alone may justify confidence ≥ 0.7,
        even if category is null.

        ========================
        BANK-SPECIFIC OVERRIDES (SBI):
        ========================

        If a transaction line contains:
        - "WDL TFR"

        THEN direction MUST be "outflow",
        regardless of any other text in the description.

        ========================
        INPUT STATEMENT TEXT
        ========================
        ${input.pageText}
        `;

    // create a local file to log the prompt for debugging
    console.log("prompt: ", prompt);

    logger.info("Sending transaction extraction prompt to OpenAI");
    const res = await this.client.chat.completions.create({
      model: "gpt-4.1-mini",
      // model: "gpt-4.1",
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
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
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(res.choices[0].message.content!);
    return parsed;
  };

  /* ================================
            NARRATIVE (READ-ONLY)
            ================================ */

  public generateNarrative = async (input: {
    userId: number;
    snapshot: any;
  }): Promise<string> => {
    const prompt = `
        You are a deterministic financial report structuring engine
        for an Indian personal finance application.

        You are given a PRECOMPUTED FINANCIAL SNAPSHOT.
        Your job is to STRUCTURE this snapshot into a
        LOSSLESS, UI-READY REPORT FORMAT.

        You MUST preserve all factual data.
        You MAY summarize or interpret ONLY where explicitly allowed.

        ========================
        ABSOLUTE CONSTRAINTS (NON-NEGOTIABLE)
        ========================
        - DO NOT recompute numbers unless explicitly permitted
        - DO NOT infer missing data
        - DO NOT fabricate entities, merchants, subscriptions, patterns, or causes
        - DO NOT drop data present in the snapshot
        - DO NOT add new metrics
        - DO NOT contradict snapshot values
        - DO NOT introduce prescriptive financial advice
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
              "net": number
            }
          ],

          "expense_categories": [
            {
              "category": string,
              "amount": number,
              "percentage": number,
              "rank": number
            }
          ],

          "top_expense_categories": [
            {
              "category": string,
              "amount": number,
              "percentage": number,
              "rank": number
            }
          ],

          "expense_recipients": [
            {
              "recipient": string,
              "amount": number,
              "rank": number
            }
          ],

          "top_expense_recipients": [
            {
              "recipient": string,
              "amount": number,
              "rank": number
            }
          ],

          "income_sources": [
            {
              "source": string,
              "amount": number,
              "rank": number
            }
          ],

          "top_income_sources": [
            {
              "source": string,
              "amount": number,
              "rank": number
            }
          ],

          "subscriptions": {
            "present": boolean,
            "items": [
              {
                "merchant": string,
                "frequency": string | null,
                "average_amount": number | null,
                "occurrences": number | null,
                "confidence": number | null,
                "first_seen": "YYYY-MM-DD" | null
              }
            ]
          },

          "patterns": [
            {
              "pattern": string,
              "basis": string,
              "impact": "positive" | "negative" | "neutral"
            }
          ],

          "recommendations": [
            {
              "title": string,
              "reason": string,
              "confidence": "low" | "medium" | "high"
            }
          ],

          "totals": {
            "total_income": number,
            "total_expenses": number,
            "net_savings": number,
            "savings_rate": number
          },

          "analysis_period": {
            "start": "YYYY-MM-DD",
            "end": "YYYY-MM-DD"
          }
        }

        ========================
        HOW TO BUILD EACH SECTION
        ========================

        SUMMARY:
        - 4–6 concise bullet points
        - MUST reference exact snapshot values
        - MAY reference ordering (largest, highest, majority)
        - MUST avoid causal or behavioral claims

        MONTHLY BREAKDOWN:
        - Use cashflow.months ONLY
        - net = income − expenses (ALLOWED derivation)
        - Do NOT compute savings rate here

        EXPENSE CATEGORIES (LOSSLESS):
        - Include ALL entries from snapshot.categories
        - percentage = percentageOfExpense * 100
        - Rank by amount (descending)
        - Rank starts at 1

        TOP EXPENSE CATEGORIES:
        - Top 5 entries from expense_categories
        - MUST be a subset (never recompute)

        EXPENSE RECIPIENTS (LOSSLESS):
        - Use snapshot.expense.sources EXACTLY
        - Preserve recipient names as-is
        - Do NOT infer merchant vs person
        - Do NOT categorize or rename
        - Rank by amount (descending)

        TOP EXPENSE RECIPIENTS:
        - Top 5 entries from expense_recipients

        INCOME SOURCES (LOSSLESS):
        - Use snapshot.income.sources EXACTLY
        - Preserve naming as-is
        - Rank by amount (descending)

        TOP INCOME SOURCES:
        - Top 5 entries from income_sources

        SUBSCRIPTIONS (STRICT, READ-ONLY):
        - If snapshot.subscriptions exists and is non-empty:
            - present = true
            - items = snapshot.subscriptions verbatim
        - Else:
            - present = false
            - items = []
        - NEVER infer subscriptions from expense categories
        - NEVER classify food or retail merchants as subscriptions

        ========================
        PATTERNS (STRICT, OBSERVABLE ONLY)
        ========================

        A pattern is an OBSERVATION, not an explanation.

        Rules:
        - Patterns MUST be directly derivable from snapshot values
        - Patterns MUST NOT speculate on causes or intent
        - Patterns MUST reference EXACT snapshot fields
        - Patterns MUST be neutral in tone
        - Max 5 patterns
        - If fewer than 2 valid patterns exist, return only those

        ALLOWED PATTERN TYPES (ONLY THESE):

        1. Expense Concentration
          Trigger:
          - Any single category OR recipient ≥ 40% of total expenses
          Basis fields:
          - categories[].percentageOfExpense
          - expense.sources

        2. Income Concentration
          Trigger:
          - income.dependenceOnSingleSource ≥ 0.5
          Basis fields:
          - income.dependenceOnSingleSource
          - income.sources

        3. Net Negative Cashflow
          Trigger:
          - core.netSavings < 0
          Basis fields:
          - core.netSavings
          - cashflow.months

        4. Uncategorized Expense Dominance
          Trigger:
          - Uncategorized ≥ 30% of total expenses
          Basis fields:
          - categories[].category
          - categories[].percentageOfExpense

        5. Low Expense Diversity
          Trigger:
          - Top expense recipient ≥ 50% of expenses
          Basis fields:
          - expense.sources

        6. Single-Month Dependency
          Trigger:
          - cashflow.months.length === 1
          Basis fields:
          - cashflow.months

        Impact rules:
        - "negative" → exposure or imbalance
        - "neutral" → informational
        - "positive" → ONLY if explicitly supported by snapshot values

        ========================
        RECOMMENDATIONS (NON-PRESCRIPTIVE)
        ========================

        A recommendation is a REVIEW PROMPT, not advice.

        Rules:
        - Each recommendation MUST map to exactly ONE pattern
        - Recommendations MUST NOT introduce new data
        - Recommendations MUST NOT suggest optimization, reduction, or goals
        - Language MUST be review-oriented
        - Max 3 recommendations

        ALLOWED RECOMMENDATION TYPES:

        1. Review Concentration
          Used for:
          - Expense or income concentration patterns
          Allowed verbs:
          - "Review", "Assess", "Validate", "Understand"

        2. Review Categorization Coverage
          Used for:
          - Uncategorized expense dominance
          Focus:
          - Data visibility and classification completeness

        3. Monitor Cashflow Consistency
          Used for:
          - Net negative or unstable cashflow
          Focus:
          - Awareness only

        CONFIDENCE RULES:
        - high → threshold ≥ 50%
        - medium → threshold 30–49%
        - low → informational patterns only

        ========================
        TOTALS
        ========================
        - Use snapshot.core values ONLY

        ========================
        ANALYSIS PERIOD
        ========================
        - Use earliest and latest month from cashflow.months
        - Do NOT guess boundaries

        ========================
        FINAL VALIDATION RULES
        ========================
        - No fabricated entities or values
        - No inferred subscriptions or frequencies
        - No dropped snapshot data
        - JSON must be syntactically valid

        ========================
        INPUT SNAPSHOT (READ-ONLY)
        ========================
        ${JSON.stringify(input.snapshot, null, 2)}
        `;

    const res = await this.client.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.25,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "text" },
    });

    return res.choices[0].message.content!;
  };
}
