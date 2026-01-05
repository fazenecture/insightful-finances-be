import fs from "node:fs";
import path from "node:path";
import { PageTextResult, PDFParse } from "pdf-parse";

import ProcessorDB from "./db";
import ProcessorLLM from "./llm";
import FinancialAnalysisEngine from "./analysis";
import S3Service from "./s3";

import {
  ProcessSinglePdfInput,
  PersistAnalysisInput,
  GenerateNarrativeInput,
  Transaction,
} from "./types/types";
import {
  chunkTextByTokens,
  MAX_TOKENS_PER_CHUNK,
} from "../helper/token.chunker";

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
    input: ProcessSinglePdfInput
  ): Promise<void> => {
    const { userId, accountId, s3Key } = input;

    // const localPath = await this.downloadPdf({ s3Key });
    // const pages = await this.extractPdfPages({ filePath: localPath });
    const pages = await this.extractPdfFromUrl({ url: s3Key });

    // for (const page of pages) {
    //   const { text: pageText } = page as PageTextResult;
    //   if (!pageText.trim()) continue;

    //   console.log('Processing page text: ', pageText.length);
    //   let txns = await this.llm.extractAndEnrichTransactions({
    //     userId,
    //     accountId,
    //     pageText
    //   });

    //   txns = this.detectInternalTransfers({ transactions: txns });

    //   await this.insertBulkTransactions({ transactions: txns });

    //   await this.sleep({ ms: 400 }); // TPM safety
    // }

    // const PAGE_BATCH_SIZE = 5;

    // for (let i = 0; i < pages.length; i += PAGE_BATCH_SIZE) {
    //   const batch = pages.slice(i, i + PAGE_BATCH_SIZE);

    //   const combinedText = batch
    //     .map((p) => (p as PageTextResult).text)
    //     .join("\n\n--- PAGE BREAK ---\n\n");

    //   if (!combinedText.trim()) continue;

    //   console.log("Processing batch pages:", i, "-", i + batch.length);

    //   let txns = await this.llm.extractAndEnrichTransactions({
    //     userId,
    //     accountId,
    //     pageText: combinedText,
    //   });

    //   txns = this.detectInternalTransfers({ transactions: txns });

    //   await this.insertBulkTransactions({ transactions: txns });

    //   await this.sleep({ ms: 500 }); // one sleep per batch
    // }

    /**
     * get the context from the first page
     */

    const context = await this.llm.detectStatementContext({
      firstPageText: pages[0].text as any,
    });

    const fullText = pages.map((p) => (p as PageTextResult).text).join("\n\n");

    // 2. Token-based chunking
    const chunks = chunkTextByTokens({
      text: fullText,
      maxTokens: MAX_TOKENS_PER_CHUNK,
    });

    console.log(`Total chunks: ${chunks.length}`);

    const accountIdData = [
      context.bankName ?? "UNKNOWN_BANK",
      context.accountType,
      context?.accountLast4 ?? context?.cardLast4 ?? "XXXX",
    ].join("-");

    for (const [index, chunk] of chunks.entries()) {
      if (!chunk.trim()) continue;

      console.log(`Processing chunk ${index + 1}/${chunks.length}`);

      let txns = await this.llm.extractAndEnrichTransactions({
        userId,
        accountId: accountIdData,
        pageText: chunk,
        accountContext: context,
      });

      txns = this.detectInternalTransfers({ transactions: txns });

      await this.insertBulkTransactions({ transactions: txns });
    }

    // fs.unlinkSync(localPath);
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

  private parseS3Url = (
    s3Url: string
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
    transactions: Transaction[]
  ): {
    core: any;
    cashflow: any;
    categories: any;
    credit: any;
    income: any;
    anomalies: any;
    healthScore: number;
  } => {
    const core = this.analysis.computeCoreMetrics({ transactions });
    const cashflow = this.analysis.computeCashFlowAnalysis({ transactions });
    const categories = this.analysis.computeCategoryAnalysis({ transactions });
    const credit = this.analysis.computeCreditCardAnalysis({ transactions });
    const income = this.analysis.computeIncomeSourceAnalysis({ transactions });
    const anomalies = this.analysis.detectAnomalies({ transactions });

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
    };
  };

  /* ================================
     PERSISTENCE
     ================================ */

  protected persistAnalysisSnapshot = async (
    input: PersistAnalysisInput
  ): Promise<void> => {
    await this.saveMonthlyMetrics({
      userId: input.userId,
      months: input.snapshot.cashflow.months,
    });

    await this.saveHealthScore({
      userId: input.userId,
      score: input.snapshot.healthScore,
    });
  };

  protected generateNarrativeSnapshot = async (
    input: GenerateNarrativeInput
  ): Promise<void> => {
    const narrative = await this.llm.generateNarrative(input);

    await this.saveNarrative({
      userId: input.userId,
      narrative,
    });
  };

  protected sleep = async (input: { ms: number }): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, input.ms));
}
