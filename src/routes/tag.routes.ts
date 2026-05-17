import { Router } from "express";
import { RowDataPacket } from "mysql2";
import { pool } from "../database/connection";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const [tags] = await pool.query<RowDataPacket[]>(
      "SELECT id, name FROM tags ORDER BY name ASC"
    );

    res.json(tags);
  } catch (error) {
    next(error);
  }
});

export default router;
