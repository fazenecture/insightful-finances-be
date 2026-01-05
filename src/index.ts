import * as dotenv from "dotenv";
dotenv.config();
import morgan from "morgan";
import { Request, Response } from "express";
import express, { Application } from "express";
import cors from "cors";
import baseRouter from "./routes/index.router";

const app: Application = express();

app.use(cors());
app.use(express.json());
app.set("trust proxy", true);
app.use(morgan("dev"));

app.use("/api", baseRouter);


app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    uptime: process.uptime(),
    hrtime: process.hrtime(),
  });
});

app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "NOT_FOUND",
  });
});


const PORT = process.env.PORT || 4000;

const init = async () => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

init();
