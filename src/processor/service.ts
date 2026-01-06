// processor/service.ts
import ProcessorHelper from "./helper";
import { ProcessPdfBatchInput } from "./types/types";

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


    // 1. Process each PDF independently
    for (const s3Key of pdfKeys) {
      await this.processSinglePdf({
        userId,
        accountId,
        s3Key
      });
    }

    // 2. Fetch canonical ledger (all transactions)
    const allTransactions = await this.fetchTransactionsByUser({
      userId
    });

    // 3. Run deterministic financial analysis
    const analysisSnapshot = this.runFullAnalysis(allTransactions);

    // 4. Persist computed metrics
    await this.persistAnalysisSnapshot({
      userId,
      snapshot: analysisSnapshot
    });

    // 5. Generate read-only AI narrative
    const narrative = await this.generateNarrativeSnapshot({
      userId,
      snapshot: analysisSnapshot
    });

    console.log('narrative: ', narrative);
    return narrative;
  };
}
