import { Router } from "express";
import { RowDataPacket } from "mysql2";
import { pool } from "../database/connection";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const [totalRows] = await pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS totalArticles FROM articles WHERE author_id = ?",
      [req.user!.id]
    );

    const [recentArticles] = await pool.execute<RowDataPacket[]>(
      `SELECT
         a.id,
         a.title,
         a.summary,
         a.published_at AS created_at,
         a.updated_at,
         c.name AS category_name
       FROM articles a
       LEFT JOIN categories c ON c.id = a.category_id
       WHERE a.author_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [req.user!.id]
    );

    res.json({
      totalArticles: Number(totalRows[0]?.totalArticles ?? 0),
      recentArticles: recentArticles.map((article) => ({
        id: article.id,
        title: article.title,
        summary: article.summary,
        created_at: article.created_at,
        updated_at: article.updated_at,
        category: article.category_name ? { name: article.category_name } : null
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default router;
