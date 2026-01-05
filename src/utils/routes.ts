import { Router } from "express";
import UtilsController from "../utils/controller";

const router = Router();

const { generatePreSignedUploadUrlController } = new UtilsController();


// presigned upload url
router.get("/upload", generatePreSignedUploadUrlController)


export default router;