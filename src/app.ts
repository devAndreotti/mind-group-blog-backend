import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middlewares/error.middleware";

export const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.clientOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "8mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(notFound);
app.use(errorHandler);
