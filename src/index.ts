import * as dotenv from "dotenv";
dotenv.config();
import morgan from "morgan";
import { Request, Response } from "express";
import express, { Application } from "express";
import cors from "cors";
import baseRouter from "./routes/index.router";

const app: Application = express();

const allowedOrigins = [
  "https://id-preview--f992b107-57d4-49cd-bfe8-bb4ce1748d71.lovable.app/",
  "http://localhost:8080",
  "https://finance-insight-alpha.vercel.app/",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      console.log('origin: ', origin);
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

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
