import fs from "node:fs";
import path from "node:path";
import { PageTextResult, PDFParse } from "pdf-parse";

import ProcessorDB from "./db";
import ProcessorLLM from "./llm";
import FinancialAnalysisEngine from "./analysis";
import S3Service from "./s3";
import pLimit from "p-limit";

import {
  ProcessSinglePdfInput,
  PersistAnalysisInput,
  GenerateNarrativeInput,
  Transaction,
  IDetectedSubscription,
  IPageWithRows,
  IPdfTextMetrics,
} from "./types/types";
import {
  chunkTextByTokens,
  estimateTokens,
  MAX_TOKENS_PER_CHUNK,
} from "../helper/token.chunker";
import { randomUUID } from "node:crypto";
import {
  CHARS_PER_TOKEN,
  COMPLETION_RATIO,
  LLM_TOKENS_PER_PRODUCT_TOKEN,
  NARRATIVE_TOKENS,
  PERFORMANCE_CONSTANTS,
  SAFETY_MULTIPLIER,
} from "./types/enums";
import { token } from "morgan";

export default class ProcessorHelper extends ProcessorDB {
  protected llm: ProcessorLLM;
  protected analysis: FinancialAnalysisEngine;
  protected s3: S3Service;

  constructor() {
    super();
    this.llm = new ProcessorLLM();
    this.analysis = new FinancialAnalysisEngine();
    this.s3 = new S3Service();
  }

  /* ================================
     PDF PROCESSING
     ================================ */

  protected processSinglePdf = async (
    input: ProcessSinglePdfInput,
  ): Promise<any> => {
    const { userId, s3Key } = input;
    const pages = await this.extractPdfFromUrl({ url: s3Key });
    /**
     * get the context from the first page
     */

    const tokenData = this.estimateTokensFromPdfSession({
      pages,
      chunkSizeTokens: MAX_TOKENS_PER_CHUNK,
      baseContextPromptLength: this.BASE_CONTEXT_PROMPT_LENGTH,
      extractionPromptOverheadTokens: 900, // static prompt size
      narrativeEnabled: true,
    });

    const limit = pLimit(10); // tune: 6–12 is safe

    const context = await this.llm.detectStatementContext({
      firstPageText: pages[0].text as any,
    });

    // 2. Token-based chunking
    const pagesWithRows = pages.map((p, idx) => ({
      pageNumber: idx + 1,
      rows: this.splitPageIntoRows((p as PageTextResult).text),
    }));

    const chunks = this.chunkRowsByTokens(
      pagesWithRows,
      MAX_TOKENS_PER_CHUNK,
      estimateTokens, // your tokenizer
    );

    console.log(`Total chunks: ${chunks.length}`);

    const accountIdData = [
      context.bankName ?? "UNKNOWN_BANK",
      context.accountType,
      context?.accountLast4 ?? context?.cardLast4 ?? "XXXX",
    ].join("-");

    await Promise.all(
      chunks.map((chunk, index) =>
        limit(async () => {
          console.log(
            `Processing chunk ${index + 1}/${
              chunks.length
            } (pages: ${chunk.pages.join(",")})`,
          );

          let txns = await this.llm.extractAndEnrichTransactions({
            userId,
            accountId: accountIdData,
            pageText: chunk.text,
            accountContext: context,
            sessionId: input?.sessionId,
          });

          txns = this.detectInternalTransfers({ transactions: txns });

          if (txns.length) {
            await this.insertBulkTransactions({ transactions: txns });
          }
        }),
      ),
    );

    return tokenData;
  };

  /* ================================
     PDF HELPERS
     ================================ */

  protected downloadPdf = async (input: { s3Key: string }): Promise<string> => {
    const { bucket, key } = this.parseS3Url(input.s3Key);

    const tmpPath = path.join("/tmp", `${Date.now()}-${path.basename(key)}`);

    await this.s3.downloadToFile({
      bucket,
      key,
      destinationPath: tmpPath,
    });

    return tmpPath;
  };

  private readonly chunkRowsByTokens = (
    pages: IPageWithRows[],
    maxTokens: number,
    estimateTokens: (s: string) => number,
  ) => {
    const chunks: {
      text: string;
      pages: number[];
    }[] = [];

    let currentRows: string[] = [];
    let currentPages = new Set<number>();
    let currentTokens = 0;

    for (const page of pages) {
      for (const row of page.rows) {
        const rowTokens = estimateTokens(row);

        if (currentTokens + rowTokens > maxTokens) {
          chunks.push({
            text: currentRows.join("\n"),
            pages: Array.from(currentPages),
          });

          currentRows = [];
          currentPages = new Set();
          currentTokens = 0;
        }

        currentRows.push(row);
        currentPages.add(page.pageNumber);
        currentTokens += rowTokens;
      }
    }

    if (currentRows.length) {
      chunks.push({
        text: currentRows.join("\n"),
        pages: Array.from(currentPages),
      });
    }

    return chunks;
  };

  private readonly splitPageIntoRows = (pageText: string): string[] => {
    return pageText
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
  };

  private parseS3Url = (
    s3Url: string,
  ): {
    bucket: string;
    key: string;
  } => {
    const url = new URL(s3Url);

    // Example:
    // https://financial-analysis-be.s3.ap-south-1.amazonaws.com/Acct+Statement.pdf
    const bucket = url.hostname.split(".")[0];

    // Decode URL-encoded path
    const key = decodeURIComponent(url.pathname.slice(1));

    return { bucket, key };
  };

  protected extractPdfPages = async (input: {
    filePath: string;
  }): Promise<string[]> => {
    const buffer = fs.readFileSync(input.filePath);

    const data = new PDFParse({
      data: buffer,
    });

    return [""];
  };

  protected extractPdfFromUrl = async (input: {
    url: string;
  }): Promise<any[]> => {
    const data = new PDFParse({
      url: input.url,
    });

    const result = await data.getText();
    return result.pages as any;
  };

  /* ================================
     INTERNAL TRANSFERS
     ================================ */

  protected detectInternalTransfers = (input: {
    transactions: Transaction[];
  }): Transaction[] => {
    const map = new Map<string, Transaction>();

    input.transactions.forEach((t) => {
      const key = `${t.amount}-${t.date}`;
      if (map.has(key)) {
        t.is_internal_transfer = true;
        map.get(key)!.is_internal_transfer = true;
      } else {
        map.set(key, t);
      }
    });

    return input.transactions;
  };

  /* ================================
     FULL ANALYSIS PIPELINE
     ================================ */

  protected runFullAnalysis = (
    transactions: Transaction[],
  ): {
    core: any;
    cashflow: any;
    categories: any;
    credit: any;
    income: any;
    anomalies: any;
    healthScore: number;
    subscriptions: IDetectedSubscription[];
  } => {
    const core = this.analysis.computeCoreMetrics({ transactions });
    const cashflow = this.analysis.computeCashFlowAnalysis({ transactions });
    const categories = this.analysis.computeCategoryAnalysis({ transactions });
    const credit = this.analysis.computeCreditCardAnalysis({ transactions });
    const income = this.analysis.computeIncomeSourceAnalysis({ transactions });
    const anomalies = this.analysis.detectAnomalies({ transactions });
    const subscriptions = this.detectSubscriptions({ transactions });

    const healthScore = this.analysis.computeFinancialHealthScore({
      core,
      credit,
    });

    return {
      core,
      cashflow,
      categories,
      credit,
      income,
      anomalies,
      healthScore,
      subscriptions,
    };
  };

  /* ================================
     PERSISTENCE
     ================================ */

  protected persistAnalysisSnapshot = async (
    input: PersistAnalysisInput,
  ): Promise<void> => {
    await this.saveMonthlyMetrics({
      userId: input.userId,
      months: input.snapshot.cashflow.months,
    });

    await this.saveSubscriptions(input.snapshot.subscriptions);

    await this.saveHealthScore({
      userId: input.userId,
      score: input.snapshot.healthScore,
    });
  };

  public detectSubscriptions = (input: {
    transactions: Transaction[];
  }): IDetectedSubscription[] => {
    const groups = this.groupByMerchant(input.transactions);
    const subscriptions: IDetectedSubscription[] = [];

    for (const [merchant, txns] of groups.entries()) {
      if (txns.length < 2) continue;

      const dates = txns.map((t) => new Date(t.date)).sort((a, b) => +a - +b);
      const intervals = this.getDayIntervals(dates);

      const cadence = this.detectCadence(intervals);
      if (!cadence) continue;

      const avgAmount = this.average(
        txns.map((t) => parseInt(t.amount.toString())),
      );
      const variance =
        this.stdDev(txns.map((t) => parseInt(t.amount.toString()))) / avgAmount;

      if (variance > 0.1) continue;

      subscriptions.push({
        id: randomUUID(),
        merchant,
        frequency: cadence,
        first_seen: dates[0].toISOString().slice(0, 10),
        is_active:
          (new Date().getTime() - dates.at(-1)!.getTime()) /
            (1000 * 60 * 60 * 24) <
          (cadence === "weekly" ? 14 : cadence === "monthly" ? 45 : 400),
        average_amount: avgAmount,
        occurrences: txns.length,
        confidence: cadence === "monthly" ? 0.9 : 0.7,
        transactions: txns.map((t) => t.transaction_id),
        user_id: txns[0].user_id,
        created_at: new Date().toISOString(),
      });
    }

    return subscriptions;
  };

  protected stdDev = (values: number[]): number => {
    const mean = this.average(values);
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

    return Math.sqrt(variance);
  };

  protected groupByMerchant = (
    transactions: Transaction[],
  ): Map<string, Transaction[]> => {
    const map = new Map<string, Transaction[]>();

    for (const t of transactions) {
      if (t.direction !== "outflow") continue;
      if (!t.merchant && !t.description) continue;

      const key = this.normalizeMerchant(t.merchant ?? t.description);

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)!.push(t);
    }

    return map;
  };

  protected normalizeMerchant = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  protected getDayIntervals = (dates: Date[]): number[] => {
    const intervals: number[] = [];

    for (let i = 1; i < dates.length; i++) {
      const diff =
        (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);

      intervals.push(Math.round(diff));
    }

    return intervals;
  };

  protected detectCadence = (
    intervals: number[],
  ): "weekly" | "monthly" | "annual" | null => {
    if (intervals.length < 2) return null;

    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    if (avg >= 6 && avg <= 8) return "weekly";
    if (avg >= 28 && avg <= 32) return "monthly";
    if (avg >= 360 && avg <= 370) return "annual";

    return null;
  };

  protected average = (values: number[]): number =>
    values.reduce((a, b) => a + b, 0) / values.length;

  protected generateNarrativeSnapshot = async (
    input: GenerateNarrativeInput,
  ): Promise<void> => {
    const narrative = await this.llm.generateNarrative(input);

    await this.saveNarrative({
      userId: input.userId,
      narrative,
      sessionId: input.sessionId,
    });
  };

  protected sleep = async (input: { ms: number }): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, input.ms));

  protected computePdfMetrics = (pages: PageTextResult[]): IPdfTextMetrics => {
    let totalChars = 0;
    let nonEmptyPages = 0;

    for (const p of pages) {
      if (typeof p.text === "string" && p.text.trim().length > 0) {
        totalChars += p.text.length;
        nonEmptyPages++;
      }
    }

    return {
      total_chars: totalChars,
      total_pages: pages.length,
      non_empty_pages: nonEmptyPages,
    };
  };

  protected estimatePromptTokensFromPdf = (chars: number): number => {
    return Math.ceil(chars / CHARS_PER_TOKEN);
  };

  protected estimateTokensFromPdfSession = (input: {
    pages: PageTextResult[];
    chunkSizeTokens: number;
    baseContextPromptLength: number;
    extractionPromptOverheadTokens: number;
    narrativeEnabled?: boolean;
  }): {
    llmTokensExpected: number;
    productTokensExpected: number;
    breakdown: Record<string, number>;
  } => {
    const metrics = this.computePdfMetrics(input.pages);

    // Estimate tokens from PDF text
    const pdfPromptTokens = Math.ceil(metrics.total_chars / CHARS_PER_TOKEN);

    const chunksCount = Math.ceil(pdfPromptTokens / input.chunkSizeTokens);

    // Base context (system prompt, once per session)
    const contextTokens =
      Math.ceil(input.baseContextPromptLength / CHARS_PER_TOKEN) + 300; // structured output buffer

    // Extraction prompt tokens (user messages)
    const extractionPromptTokens =
      pdfPromptTokens + chunksCount * input.extractionPromptOverheadTokens;

    // Completion tokens (model output)
    const extractionCompletionTokens = Math.ceil(
      extractionPromptTokens * COMPLETION_RATIO,
    );

    let narrativeTokens = 0;
    if (input.narrativeEnabled) {
      narrativeTokens = NARRATIVE_TOKENS;
    }

    const rawTotal =
      contextTokens +
      extractionPromptTokens +
      extractionCompletionTokens +
      narrativeTokens;

    const llmTokensExpected = Math.ceil(rawTotal * SAFETY_MULTIPLIER);

    // Convert to your product tokens
    const productTokensExpected = Math.ceil(
      llmTokensExpected / LLM_TOKENS_PER_PRODUCT_TOKEN,
    );

    return {
      llmTokensExpected,
      productTokensExpected,
      breakdown: {
        pdf_chars: metrics.total_chars,
        pages: metrics.total_pages,
        non_empty_pages: metrics.non_empty_pages,
        chunks: chunksCount,
        contextTokens,
        extractionPromptTokens,
        extractionCompletionTokens,
        narrativeTokens,
        safetyMultiplier: SAFETY_MULTIPLIER,
      },
    };
  };

  protected estimateTokensAndTimeFromPdfSession = (input: {
    pages: PageTextResult[];
    chunkSizeTokens: number;
    baseContextPromptLength: number;
    extractionPromptOverheadTokens: number;
    narrativeEnabled?: boolean;
  }): {
    tokensExpected: number;
    timeSecondsExpected: number;
    breakdown: Record<string, number>;
  } => {
    const metrics = this.computePdfMetrics(input.pages);

    // ---------- TOKEN ESTIMATION ----------
    const tokenData = this.estimateTokensFromPdfSession(input);

    // ---------- TIME ESTIMATION ----------
    const parseTimeMs =
      metrics.total_pages * PERFORMANCE_CONSTANTS.PDF_PARSE_MS_PER_PAGE;

    const chunksCount = Math.ceil(
      tokenData.breakdown.extractionPromptTokens / input.chunkSizeTokens,
    );

    const contextTimeMs = PERFORMANCE_CONSTANTS.CONTEXT_DETECTION_MS;

    const extractionTimeMs =
      chunksCount * PERFORMANCE_CONSTANTS.EXTRACTION_MS_PER_CHUNK;

    const narrativeTimeMs = input.narrativeEnabled
      ? PERFORMANCE_CONSTANTS.NARRATIVE_MS
      : 0;

    const totalTimeMs =
      (parseTimeMs + contextTimeMs + extractionTimeMs + narrativeTimeMs) *
      PERFORMANCE_CONSTANTS.TIME_SAFETY_MULTIPLIER;

    return {
      tokensExpected: tokenData.productTokensExpected,
      timeSecondsExpected: Math.ceil(totalTimeMs / 1000),
      breakdown: {
        ...tokenData.breakdown,
        parseTimeMs,
        contextTimeMs,
        extractionTimeMs,
        narrativeTimeMs,
        chunks: chunksCount,
      },
    };
  };

  protected BASE_CONTEXT_PROMPT_LENGTH = 1000;

  protected now = () => process.hrtime.bigint();
  protected ms = (start: bigint, end: bigint): number => {
    return Number(end - start) / 1_000_000;
  }
}
