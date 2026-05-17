import cors from "cors";
import express from "express";
import { env } from "./config/env";
import articleRoutes from "./routes/article.routes";
import authRoutes from "./routes/auth.routes";
import categoryRoutes from "./routes/category.routes";
import tagRoutes from "./routes/tag.routes";
import userRoutes from "./routes/user.routes";
import { errorHandler, notFound } from "./middlewares/error.middleware";
import { HttpError } from "./utils/http";

export const app = express();

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/tags", tagRoutes);

app.use(notFound);
app.use(errorHandler);
