import customErrorHandler from "../helper/custom.error";
import UtilsService from "./service";
import { Request, Response } from "express";

export default class UtilsController extends UtilsService {
  public generatePreSignedUploadUrlController = async (
    req: Request,
    res: Response
  ) => {
    try {
      const { file_name, mime_type, id } = req.body;
      const data = await this.generatePreSignedUploadUrlService({
        file_name,
        mime_type,
        id,
      });

      res.status(200).send({
        success: true,
        data,
      });
    } catch (err) {
      customErrorHandler(res, err);
    }
  };
}
