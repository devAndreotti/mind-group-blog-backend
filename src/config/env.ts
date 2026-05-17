import dotenv from "dotenv";

dotenv.config();

const required = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};

export const env = {
  port: Number(process.env.PORT ?? 3333),
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  db: {
    host: required("DB_HOST", "localhost"),
    port: Number(process.env.DB_PORT ?? 3306),
    user: required("DB_USER", "root"),
    password: process.env.DB_PASSWORD ?? "",
    database: required("DB_NAME", "mind_group_blog")
  },
  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN ?? "7d"
  }
};
