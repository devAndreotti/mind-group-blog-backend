import { Router } from "express";
import { RowDataPacket } from "mysql2";
import { pool } from "../database/connection";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const [categories] = await pool.query<RowDataPacket[]>(
      "SELECT id, name, created_at AS createdAt FROM categories ORDER BY name ASC"
    );

    res.json(categories);
  } catch (error) {
    next(error);
  }
});

export default router;
