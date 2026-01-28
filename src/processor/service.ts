// processor/service.ts
import { randomUUID } from "node:crypto";
import { MAX_TOKENS_PER_CHUNK } from "../helper/token.chunker";
import ProcessorHelper from "./helper";
import {
  IFetchAnalysisDataServiceReqObj,
  IFetchTransactionsReqObj,
  ProcessPdfBatchInput,
} from "./types/types";
import { AnalysisStatus, SSEEventType } from "./types/enums";
import moment from "moment";
import ErrorHandler from "../helper/error.handler";
import logger from "../helper/logger";
import { formatDurationRange, formatSeconds } from "../helper/time.formatter";

export default class ProcessorService extends ProcessorHelper {
  /**
   * Entry point for processing multiple PDFs uploaded to S3.
   * This method is intentionally sequential to:
   * - avoid OpenAI TPM/RPM issues
   * - keep memory usage stable
   * - allow partial progress persistence
   */

  public executePdfAnalysis = async (input: ProcessPdfBatchInput) => {
    if (!input?.sessionId) {
      input.sessionId = `pdf-batch-${randomUUID()}`;
    }

    // check if the user exists & the token
    const user = await this.fetchUserDetailsWithTokensByIdDb(input.userId);

    if (!user) {
      throw new ErrorHandler({
        status_code: 400,
        message: "User not found, signup required to process PDFs",
      });
    }

    if (user.user_tokens.total_net_tokens === 0) {
      throw new ErrorHandler({
        status_code: 402,
        message:
          "Insufficient tokens. Please purchase additional tokens to proceed.",
      });
    }

    const estimatedTokenData = await this.fetchTokenEstimateService({
      userId: input.userId,
      pdfKeys: input.pdfKeys,
      sessionId: input.sessionId,
    });

    if (estimatedTokenData.total_tokens > user.user_tokens.total_net_tokens) {
      throw new ErrorHandler({
        status_code: 402,
        message: `Insufficient tokens. Estimated tokens required: ${estimatedTokenData.total_tokens}, but only ${user.user_tokens.total_net_tokens} available. Please purchase additional tokens to proceed.`,
      });
    }

    const sessionData = await this.fetchAnalysisSessionBySessionIdDb(
      input?.sessionId!,
    );

    if (sessionData?.status.length) {
      throw new ErrorHandler({
        status_code: 400,
        message: `Analysis session with already in ${sessionData.status} status!`,
      });
    }

    console.log("Inserting analysis session for:", input?.sessionId);
    this.sseManager.emit(input?.sessionId, SSEEventType.STAGE, {
      stage: "initiated",
    });

    const tokenUsageData = this.calculateUpdatedTokenUsage({
      free_tokens_granted: user.user_tokens.free_tokens_granted,
      free_tokens_used: user.user_tokens.free_tokens_used,
      paid_tokens_granted: user.user_tokens.paid_tokens_granted,
      paid_tokens_used: user.user_tokens.paid_tokens_used,
      estimated_tokens_to_use: estimatedTokenData.total_tokens,
    });

    await this.insertAnalysisSessionDb([
      {
        session_id: input?.sessionId,
        user_id: input.userId,
        source_type: "pdf_batch",
        status: AnalysisStatus.IN_PROGRESS,
        created_at: moment().format(),
        tokens_expected: input?.tokensEstimate ?? 0,
      },
    ]);

    await this.updateUserTokensDb({
      user_id: input.userId,
      free_tokens_used: tokenUsageData.free_tokens_used,
      paid_tokens_used: tokenUsageData.paid_tokens_used,
      updated_at: moment().format(),
      updated_by: input.userId,
    });

    return {
      session_id: input?.sessionId,
      estimated_tokens: estimatedTokenData.total_tokens,
      paid_tokens_used: user.user_tokens.paid_tokens_used,
      free_tokens_used: user.user_tokens.free_tokens_used,
      free_tokens_granted: user.user_tokens.free_tokens_granted,
      paid_tokens_granted: user.user_tokens.paid_tokens_granted,
    };
  };

  public processPdfBatch = async (
    input: ProcessPdfBatchInput,
  ): Promise<void> => {
    const { userId, pdfKeys } = input;

    // a fail check
    if (!input?.sessionId) {
      input.sessionId = `pdf-batch-${randomUUID()}`;
    }

    console.log(
      `Starting PDF batch processing for session: ${input?.sessionId}, PDFs: ${pdfKeys.length}`,
    );
    this.sseManager.emit(input?.sessionId, SSEEventType.PROGRESS, {
      stage: "parsing",
      message: `Starting PDF batch processing for ${pdfKeys.length} PDFs...`,
    });

    /**
     * Analysis Session
     */
    const startedAt = moment().toISOString();
    const t0 = this.now();

    let totalTokensUsed = 0;

    let pdfProcessingMs = 0;
    let analysisMs = 0;
    let narrativeMs = 0;
    let dbWriteMs = 0;
    let totalPages = 0;

    const pdfStart = this.now();

    // 1. Process each PDF independently
    for (const s3Key of pdfKeys) {
      const tokenData = await this.processSinglePdf({
        userId,
        s3Key,
        sessionId: input?.sessionId,
      });

      totalTokensUsed += tokenData.token_used.productTokensExpected;
      totalPages += tokenData.page_count;
    }

    pdfProcessingMs = this.ms(pdfStart, this.now());

    // 2. Fetch canonical ledger (all transactions)
    const analysisStart = this.now();
    const allTransactions = await this.fetchTransactionsByUser({
      userId,
    });

    this.sseManager.emit(input?.sessionId, SSEEventType.PROGRESS, {
      stage: `understanding`,
      message: `Fetched ${allTransactions.length} transactions for analysis.`,
    });

    // 3. Run deterministic financial analysis
    const analysisSnapshot = this.runFullAnalysis(allTransactions);
    console.log('analysisSnapshot: ', analysisSnapshot);

    analysisMs = this.ms(analysisStart, this.now());

    // 3️⃣ Persist snapshot
    const dbStart = this.now();
    console.log('dbStart: ', dbStart);

    // 4. Persist computed metrics
    await this.persistAnalysisSnapshot({
      userId,
      snapshot: analysisSnapshot,
    });

    dbWriteMs += this.ms(dbStart, this.now());

    // 5. Generate read-only AI narrative
    const narrativeStart = this.now();

    this.sseManager.emit(input?.sessionId, SSEEventType.PROGRESS, {
      stage: `analyzing`,
      message: `Generating narrative summary...`,
    });

    const narrative = await this.generateNarrativeSnapshot({
      userId,
      snapshot: analysisSnapshot,
      sessionId: input?.sessionId,
    });

    narrativeMs = this.ms(narrativeStart, this.now());

    const completedAt = moment().toISOString();
    const totalDurationMs = this.ms(t0, this.now());

    console.log(
      `Completed PDF batch processing for session: ${input?.sessionId} in ${
        formatSeconds(totalDurationMs / 1000).value
      } ${formatSeconds(totalDurationMs / 1000).unit}`,
    );
    this.sseManager.emit(input?.sessionId, SSEEventType.COMPLETED, {
      stage: `completed`,
      message: `PDF batch processing completed in ${
        formatSeconds(totalDurationMs / 1000).value
      } ${formatSeconds(totalDurationMs / 1000).unit}.`,
      redirectUrl: `/analysis/result/${input?.sessionId}`,
    });

    this.sseManager.emit(input?.sessionId, SSEEventType.CLOSE, {});

    const metaData = {
      pdf_count: pdfKeys.length,
      total_pages: totalPages,
      total_transactions: allTransactions.length,
      metric: {
        started_at: startedAt,
        completed_at: completedAt,
        total_duration_ms: Math.round(totalDurationMs),
        breakdown: {
          analysis_ms: Math.round(analysisMs),
          narrative_ms: Math.round(narrativeMs),
          db_write_ms: Math.round(dbWriteMs),
          pdf_processing_ms: Math.round(pdfProcessingMs),
        },
      },
    };

    await this.updateAnalysisSessionStatusBySessionIdDb({
      session_id: input?.sessionId!,
      status: AnalysisStatus.COMPLETED,
      tokens_used: totalTokensUsed,
      updated_at: moment().format(),
      meta_data: metaData,
    });

    return narrative;
  };

  public fetchAnalysisDataService = async (
    reqObj: IFetchAnalysisDataServiceReqObj,
  ) => {
    const { user_id, session_id } = reqObj;

    // Fetch analysis snapshot from DB
    // const analysisData = await this.fetchAnalysisSnapshot({
    //   userId: user_id
    // });

    const data = await this.fetchNarrativeBySessionId({
      user_id,
      session_id,
    });

    return {
      ...data,
      narrative: JSON.parse(data.narrative),
    };
  };

  public fetchTokenEstimateService = async (reqObj: ProcessPdfBatchInput) => {
    const { pdfKeys } = reqObj;

    let totalTokens = 0,
      totalTimeInSecondsExpected = 0,
      totalMinimumTimeSeconds = 0,
      totalMaximumTimeSeconds = 0,
      totalCooldownSeconds = 0;

    let isBatch = pdfKeys.length > 1;

    for (const s3Key of pdfKeys) {
      const pages = await this.extractPdfFromUrl({ url: s3Key });

      // const tokenData = this.estimateTokensFromPdfSession({
      //   pages,
      //   chunkSizeTokens: MAX_TOKENS_PER_CHUNK,
      //   baseContextPromptLength: this.BASE_CONTEXT_PROMPT_LENGTH,
      //   extractionPromptOverheadTokens: 900, // static prompt size
      //   narrativeEnabled: true,
      // });

      const metricsExpected = this.estimateTokensAndTimeFromPdfSession({
        pages,
        chunkSizeTokens: MAX_TOKENS_PER_CHUNK,
        baseContextPromptLength: this.BASE_CONTEXT_PROMPT_LENGTH,
        extractionPromptOverheadTokens: 900, // static prompt size
        narrativeEnabled: true,
        isBatch,
      });

      totalTokens += metricsExpected.tokensExpected;
      totalTimeInSecondsExpected += metricsExpected.timeSecondsExpected;
      totalMinimumTimeSeconds += metricsExpected.timeEstimate.minSeconds;
      totalMaximumTimeSeconds += metricsExpected.timeEstimate.maxSeconds;
      totalCooldownSeconds +=
        metricsExpected?.breakdown?.estimatedCooldownSeconds || 0;
    }

    let isLLMCallRateLimited = false;

    if (totalCooldownSeconds > 0) {
      logger.info(
        `Total estimated cooldown time for batch: ${totalCooldownSeconds}s`,
      );
      isLLMCallRateLimited = true;
    }

    return {
      total_tokens: totalTokens,
      total_time_seconds: totalTimeInSecondsExpected,
      total_time_estimate: {
        min_seconds: totalMinimumTimeSeconds,
        max_seconds: totalMaximumTimeSeconds,
        display: formatDurationRange(
          totalMinimumTimeSeconds,
          totalMaximumTimeSeconds,
        ),
        total_cooldown_seconds: totalCooldownSeconds,
        is_llm_call_rate_limited: isLLMCallRateLimited,
      },
    };
  };

  public fetchTransactionsService = async (obj: IFetchTransactionsReqObj) => {
    const [transactionData, transactionTotalCount] = await Promise.all([
      this.fetchTransactionDb(obj),
      this.fetchTotalTransactionsCountDb(obj),
    ]);

    const metaData = {
      total_items: Number.parseInt(transactionTotalCount),
      items_on_page: transactionData?.length,
      page_no: obj.page,
    };

    return {
      data: transactionData,
      meta_data: metaData,
    };
  };

  public downloadTransactionsCsvService = async (
    session_id: string,
  ): Promise<any> => {
    const s3Url = await this.exportBySessionIdHelper(session_id);

    const downloadUrl = await this.s3.getSignedDownloadUrl(s3Url);

    return {
      download_url: downloadUrl,
      expiry_time: moment().add(15, "minutes").toISOString(),
    };
  };
}
