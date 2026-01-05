import { Response } from "express";
import { ValidationError } from "joi";

import ErrorHandler from "./error.handler";
import logger from "./logger";

const customErrorHandler = async (res: Response, error: any) => {
  console.error(
    "❌ Error: ",
    JSON.stringify(error),
    error["Error"],
    error.toString()
  );

  logger.error(error);

  if (error instanceof ValidationError) {
    return res.header({ "x-frame-options": "deny" }).status(400).json({
      success: false,
      message: "Data validation failed",
      details: error.details,
    });
  }
  if (error instanceof ErrorHandler) {
    return res.status(error.status_code).send({
      success: false,
      message: error.message,
      data: error.data,
    });
  }

  // Send non-blocking Slack alert for all errors

  if (process.env.ENV !== "local") {
    setImmediate(async () => {
      try {
        logger.info("Sending Slack alert for error");
        logger.info("Slack alert sent successfully");
      } catch (slackError: any) {
        console.error("Failed to send Slack alert:", slackError);
        logger.error(slackError);
      }
    });
  }

  console.log("error: ", error);
  res.status(500).send({
    success: false,
    message: error.toString().split("Error: ").pop() || "Internal ServerError.",
    error,
  });
};

export default customErrorHandler;
