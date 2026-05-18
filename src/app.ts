import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import articleRoutes from "./routes/article.routes";
import authRoutes from "./routes/auth.routes";
import categoryRoutes from "./routes/category.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import tagRoutes from "./routes/tag.routes";
import userRoutes from "./routes/user.routes";
import { pool } from "./database/connection";
import { errorHandler, notFound } from "./middlewares/error.middleware";
import { HttpError } from "./utils/http";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.clientOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new HttpError(403, "Origem nao permitida pelo CORS."));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "8mb" }));

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "ok" });
  } catch (error) {
    next(new HttpError(503, "Banco de dados indisponivel."));
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(notFound);
app.use(errorHandler);
