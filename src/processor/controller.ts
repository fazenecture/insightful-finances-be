import customErrorHandler from "../helper/custom.error";
import ProcessorService from "./service";
import {Request, Response} from "express";

export default class ProcessorController extends ProcessorService {

    public execute = async (
        req: Request,
        res: Response
    ) => {
        try {
            const { user_id, account_id, pdf_keys } = req.body;

            await this.processPdfBatch({
                userId: user_id,
                accountId: account_id,
                pdfKeys: pdf_keys
            });

            res.status(200).json({ message: "PDF batch processing initiated." });

        } catch (error: any) {
            customErrorHandler(res, error);
        }
    }
}