import customErrorHandler from "../helper/custom.error";
import ProcessorService from "./service";
import { Request, Response } from "express";
import { AnalysisStatus, SSEEventType } from "./types/enums";
import moment from "moment";

export default class ProcessorController extends ProcessorService {
  public execute = async (req: Request, res: Response) => {
    const { user_id, account_id, pdf_keys, session_id } = req.body;
    try {
      await this.executePdfAnalysis({
        userId: user_id,
        accountId: account_id,
        pdfKeys: pdf_keys,
        sessionId: session_id,
      });

      res.status(200).json({ message: "PDF batch processing initiated." });

      setImmediate(async () => {
        this.processPdfBatch({
          userId: user_id,
          accountId: account_id,
          pdfKeys: pdf_keys,
          sessionId: session_id,
        }).catch((error) => {
          console.error(
            `Error processing PDF batch for session ${session_id}:`,
            error,
          );

          this.sseManager.emit(session_id, SSEEventType.ERROR, {
            message: `Processing failed: ${error?.message}`,
          });

          this.sseManager.emit(session_id, SSEEventType.CLOSE, {});

          this.updateAnalysisSessionStatusBySessionIdDb({
            session_id,
            status: AnalysisStatus.FAILED,
            tokens_used: 0,
            error_message: error?.message,
            updated_at: moment().format(),
          });
        });
      });
    } catch (error: any) {
      this.sseManager.emit(session_id, SSEEventType.ERROR, {
        message: `Processing failed: ${error?.message}`,
      });

      this.sseManager.emit(session_id, SSEEventType.CLOSE, {});

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

  public fetchTransactionsController = async (req: Request, res: Response) => {
    try {
      const { limit, page, search } = req.query,
        { session_id } = req.params;
      const { meta_data, data } = await this.fetchTransactionsService({
        limit: limit ? Number.parseInt(limit.toString()) : 10,
        page: page ? Number.parseInt(page?.toString()) : 0,
        search: search?.length ? search.toString() : null,
        session_id,
      });

      return res.status(200).send({
        success: true,
        meta_data,
        data,
      });
    } catch (error) {
      customErrorHandler(res, error);
    }
  };

  // SSE Related Methods can be added here
  public streamAnalysisUpdatesController = (req: Request, res: Response) => {
    try {
      const { session_id } = req.query;

      if (!session_id || typeof session_id !== "string") {
        res.status(400).end();
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      this.sseManager.register(<string>session_id, res);

      // Initial handshake event
      res.write(
        `event: connected\ndata: ${JSON.stringify({ message: "Connected to SSE stream." })}\n\n`,
      );

      const heartbeat = setInterval(() => {
        try {
          res.write(
            `event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`,
          );
        } catch (err) {
          // connection probably closed
          clearInterval(heartbeat);
        }
      }, 15000); // 15s is safe

      // Cleanup on client disconnect
      req.on("close", () => {
        clearInterval(heartbeat);
        this.sseManager.unregister(<string>session_id, res);
      });
    } catch (error) {
      customErrorHandler(res, error);
    }
  };

  public downloadTransactionsController = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const { session_id } = req.params;

      const data = await this.downloadTransactionsCsvService(session_id);

      res.status(200).send({
        success: true,
        data,
      });
    } catch (error) {
      customErrorHandler(res, error);
    }
  };
}
