import customErrorHandler from "../helper/custom.error";
import ProcessorService from "./service";
import { Request, Response } from "express";
import { AnalysisStatus } from "./types/enums";
import moment from "moment";

export default class ProcessorController extends ProcessorService {
  public execute = async (req: Request, res: Response) => {
    const { user_id, account_id, pdf_keys, session_id } = req.body;
    try {
      await this.processPdfBatch({
        userId: user_id,
        accountId: account_id,
        pdfKeys: pdf_keys,
        sessionId: session_id,
      });

      res.status(200).json({ message: "PDF batch processing initiated." });
    } catch (error: any) {
      this.updateAnalysisSessionStatusBySessionIdDb({
        session_id,
        status: AnalysisStatus.FAILED,
        tokens_used: 0,
        error_message: error?.message,
        updated_at: moment().format(),
      });
      customErrorHandler(res, error);
    }
  };

  public fetchAnalysisDataController = async (req: Request, res: Response) => {
    try {
      const { id: session_id } = req.params,
        { user_id } = req.body;

      const data = await this.fetchAnalysisDataService({ user_id, session_id });
      return res.status(200).send({
        success: true,
        data,
      });
    } catch (error: any) {
      customErrorHandler(res, error);
    }
  };

  public fetchTokenEstimateController = async (req: Request, res: Response) => {
    try {
      const { user_id, pdf_keys, session_id } = req.body;

      const data = await this.fetchTokenEstimateService({
        userId: user_id,
        accountId: session_id,
        pdfKeys: pdf_keys,
        sessionId: session_id,
      });
      return res.status(200).send({
        success: true,
        data,
      });
    } catch (error: any) {
      customErrorHandler(res, error);
    }
  };
}
