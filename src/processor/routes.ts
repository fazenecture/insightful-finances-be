import { Router } from "express";
import ProcessorController from "./controller";

const router = Router();
const {execute} = new ProcessorController();

router.post("/process", execute);

export default router;