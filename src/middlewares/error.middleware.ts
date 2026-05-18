import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http";

type ExpectedError = Error & {
  code?: string;
  errno?: number;
  status?: number;
  type?: string;
};

const databaseUnavailableCodes = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ETIMEDOUT",
  "PROTOCOL_CONNECTION_LOST",
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "ER_CON_COUNT_ERROR",
  "ER_DBACCESS_DENIED_ERROR",
  "ER_HOST_NOT_PRIVILEGED"
]);

export const notFound = (_req: Request, _res: Response, next: NextFunction) => {
  next(new HttpError(404, "Rota nao encontrada."));
};

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  const expected = error as ExpectedError;

  if (expected.type === "entity.parse.failed") {
    return res.status(400).json({ message: "JSON invalido." });
  }

  if (expected.type === "entity.too.large" || expected.status === 413) {
    return res.status(413).json({ message: "Payload muito grande." });
  }

  if (expected.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "Registro duplicado." });
  }

  if (expected.code && databaseUnavailableCodes.has(expected.code)) {
    return res.status(503).json({ message: "Banco de dados indisponivel." });
  }

  console.error(error);
  return res.status(500).json({ message: "Erro interno do servidor." });
};
