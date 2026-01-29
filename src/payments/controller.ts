import customErrorHandler from "../helper/custom.error";
import PaymentsService from "./service";
import { Request, Response } from "express";
import db from "../config/postgres";
import logger from "../helper/logger";

export default class PaymentsController extends PaymentsService {
  public createOrderController = async (req: Request, res: Response) => {
    const dbClient = (await db.getClient()) as any;
    try {
      const { user_id, type, package_id, meta_data, payment_method } = req.body;

      await dbClient.query("BEGIN");

      const order = await this.createOrderService({
        user_id,
        type,
        package_id,
        meta_data,
        payment_method,
        dbClient,
      });

      await dbClient.query("COMMIT");

      res.status(201).send({
        success: true,
        data: order,
      });
    } catch (error: any) {
      await dbClient.query("ROLLBACK");
      customErrorHandler(res, error);
    } finally {
      dbClient.release();
    }
  };

  public paymentWebhookController = async (req: Request, res: Response) => {
    const dbClient = (await db.getClient()) as any;
    let result, webhook_id;
    try {
      const signature =
        req.header("x-razorpay-signature") ||
        req.header("X-Razorpay-Signature");

      const rawBody = (req as any).body; // Buffer from express.raw

      /**
       * Validate the signature
       */
      const rawStr = rawBody.toString("utf-8");
      console.log("rawStr: ", rawStr);

      if (!signature) {
        logger.warn("Signature missing in webhook");
        res.status(400).send({
          success: false,
          message: "Signature missing",
        });

        return;
      }

      const valid = this.razorpayManager.verifyWebhookSignature({
        body: rawStr,
        signature,
        secret: process.env.RAZORPAY_WEBHOOK_SECRET!,
      });
      if (!valid) {
        logger.warn("Invalid webhook signature");
        res.status(400).send({
          success: false,
          message: "Invalid webhook signature",
        });

        return;
      }

      const jsonBody = JSON.parse(rawStr);
      logger.info(`Webhook event received - type ${jsonBody.event}`);
      webhook_id = this.extractReferenceWebhookIdFromPayload(jsonBody);

      await dbClient.query("BEGIN");

      result = await this.paymentWebhookService({
        raw_body: rawBody,
        signature,
        dbClient,
      });
      await dbClient.query("COMMIT");

      res.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      await dbClient.query("ROLLBACK");
      customErrorHandler(res, error);
    } finally {
      dbClient.release();
    }
  };

  public verifyPaymentController = async (req: Request, res: Response) => {
    const dbClient = (await db.getClient()) as any;
    try {
      const {
        payment_uuid,
        payment_id,
        user_id,
        payment_order_id,
        payment_signature,
      } = req.body;

      await dbClient.query("BEGIN");

      const result = await this.verifyPaymentService({
        payment_uuid,
        payment_id,
        user_id,
        payment_order_id,
        payment_signature,
        dbClient,
      });

      await dbClient.query("COMMIT");

      res.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      await dbClient.query("ROLLBACK");
      customErrorHandler(res, error);
    } finally {
      dbClient.release();
    }
  };
}
