import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http";

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

  console.error(error);
  return res.status(500).json({ message: "Erro interno do servidor." });
};
