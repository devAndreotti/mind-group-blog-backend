import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http";
import { verifyToken } from "../utils/jwt";

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return next(new HttpError(401, "Token de autenticacao ausente."));
  }

  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return next(new HttpError(401, "Token de autenticacao invalido."));
  }
};
