import mysql from "mysql2/promise";
import { env } from "../config/env";

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10
});

export type DbUser = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  bio: string | null;
  role: "admin" | "member";
  created_at: Date;
  updated_at: Date;
};
