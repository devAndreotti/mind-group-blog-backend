import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http";

type ExpectedError = Error & {
  code?: string;
  errno?: number;
  status?: number;
  type?: string;
};

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

  if (expected.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "Registro duplicado." });
  }

  console.error(error);
  return res.status(500).json({ message: "Erro interno do servidor." });
};
