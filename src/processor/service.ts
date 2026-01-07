// processor/service.ts
import { randomUUID } from "node:crypto";
import { MAX_TOKENS_PER_CHUNK } from "../helper/token.chunker";
import ProcessorHelper from "./helper";
import {
  IFetchAnalysisDataServiceReqObj,
  ProcessPdfBatchInput,
} from "./types/types";
import { AnalysisStatus } from "./types/enums";
import moment from "moment";

export default class ProcessorService extends ProcessorHelper {
  /**
   * Entry point for processing multiple PDFs uploaded to S3.
   * This method is intentionally sequential to:
   * - avoid OpenAI TPM/RPM issues
   * - keep memory usage stable
   * - allow partial progress persistence
   */
  public processPdfBatch = async (
    input: ProcessPdfBatchInput
  ): Promise<void> => {
    const { userId, accountId, pdfKeys } = input;

    /**
     * Analysis Session
     */

    await this.insertAnalysisSessionDb([
      {
        session_id: input?.sessionId,
        user_id: userId,
        source_type: "pdf_batch",
        status: AnalysisStatus.IN_PROGRESS,
        created_at: moment().format(),
        tokens_expected: input?.tokensEstimate ?? 0,
      },
    ]);

    // 1. Process each PDF independently
    for (const s3Key of pdfKeys) {
      await this.processSinglePdf({
        userId,
        accountId,
        s3Key,
        sessionId: input?.sessionId
      });
    }

    // 2. Fetch canonical ledger (all transactions)
    const allTransactions = await this.fetchTransactionsByUser({
      userId,
    });

    // 3. Run deterministic financial analysis
    const analysisSnapshot = this.runFullAnalysis(allTransactions);

    // 4. Persist computed metrics
    await this.persistAnalysisSnapshot({
      userId,
      snapshot: analysisSnapshot,
    });

    // 5. Generate read-only AI narrative
    const narrative = await this.generateNarrativeSnapshot({
      userId,
      snapshot: analysisSnapshot,
      sessionId: input?.sessionId,
    });

    console.log("narrative: ", narrative);

    await this.updateAnalysisSessionStatusBySessionIdDb({
      session_id: input?.sessionId!,
      status: AnalysisStatus.COMPLETED,
      tokens_used: input?.tokensEstimate,
      updated_at: moment().format(),
    });

    return narrative;
  };

  public fetchAnalysisDataService = async (
    reqObj: IFetchAnalysisDataServiceReqObj
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
    const { userId, accountId, pdfKeys } = reqObj;

    let totalTokens = 0;

    for (const s3Key of pdfKeys) {
      const pages = await this.extractPdfFromUrl({ url: s3Key });

      const tokenData = this.estimateTokensFromPdfSession({
        pages,
        chunkSizeTokens: MAX_TOKENS_PER_CHUNK,
        baseContextPrompt: this.BASE_CONTEXT_PROMPT,
        extractionPromptOverheadTokens: 900, // static prompt size
        narrativeEnabled: true,
      });
      console.log("tokenData: ", tokenData);

      totalTokens += tokenData.productTokensExpected;
    }

    return { total_tokens: totalTokens };
  };
}
