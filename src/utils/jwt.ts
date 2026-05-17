import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export type TokenPayload = {
  id: number;
  email: string;
  role: "admin" | "member";
};

export const signToken = (payload: TokenPayload) => {
  const options: SignOptions = {
    expiresIn: env.jwt.expiresIn as SignOptions["expiresIn"]
  };

  return jwt.sign(payload, env.jwt.secret, options);
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, env.jwt.secret) as TokenPayload;
};
