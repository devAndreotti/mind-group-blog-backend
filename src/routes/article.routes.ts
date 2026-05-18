import { Router } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../database/connection";
import { requireAuth } from "../middlewares/auth.middleware";
import { assert, HttpError } from "../utils/http";
import {
  readNullableInteger,
  readNullableString,
  readObject,
  readRequiredString,
  readStringArray
} from "../utils/validation";

const router = Router();
const ALLOWED_COVER_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_COVER_IMAGE_BYTES = 2 * 1024 * 1024;

type ArticleInput = {
  title: string;
  summary: string;
  content: string;
  categoryId: number | null;
  tags: string[];
  coverImage: string | null;
};

const readArticleInput = (body: unknown): ArticleInput => {
  const input = readObject(body);
  const title = readRequiredString(input, "title", "Titulo");
  const summary = readRequiredString(input, "summary", "Resumo");
  const content = readRequiredString(input, "content", "Conteudo");
  const categoryId = readNullableInteger(input, "categoryId", "Categoria");
  const tags = readStringArray(input, "tags", "Tags", { maxItems: 10, maxLength: 80 });
  const coverImage = readNullableString(input, "coverImage", "Imagem de capa");

  assert(title.length >= 3, 400, "Titulo deve ter pelo menos 3 caracteres.");
  assert(title.length <= 255, 400, "Titulo deve ter no maximo 255 caracteres.");
  assert(summary.length >= 10, 400, "Resumo deve ter pelo menos 10 caracteres.");
  assert(summary.length <= 1000, 400, "Resumo deve ter no maximo 1000 caracteres.");
  assert(content.length >= 20, 400, "Conteudo deve ter pelo menos 20 caracteres.");
  assert(content.length <= 8000, 400, "Conteudo deve ter no maximo 8000 caracteres.");

  return { title, summary, content, categoryId, tags, coverImage };
};

const dataUrlToBuffer = (value?: string | null) => {
  if (!value) {
    return { buffer: null, mimeType: null };
  }

  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new HttpError(400, "Imagem de capa deve estar em formato data URL base64.");
  }

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_COVER_IMAGE_TYPES.has(mimeType)) {
    throw new HttpError(400, "Imagem de capa deve ser PNG, JPG ou WebP.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_COVER_IMAGE_BYTES) {
    throw new HttpError(400, "Imagem de capa deve ter no maximo 2MB.");
  }

  return {
    mimeType,
    buffer
  };
};

const imageToDataUrl = (buffer?: Buffer | null, mimeType?: string | null) => {
  if (!buffer) {
    return null;
  }

  return `data:${mimeType ?? "image/jpeg"};base64,${buffer.toString("base64")}`;
};

const loadTags = async (articleId: number) => {
  const [tags] = await pool.execute<RowDataPacket[]>(
    `SELECT t.id, t.name
     FROM tags t
     INNER JOIN article_tags at ON at.tag_id = t.id
     WHERE at.article_id = ?
     ORDER BY t.name`,
    [articleId]
  );

  return tags;
};

const serializeArticle = async (row: RowDataPacket) => ({
  id: row.id,
  title: row.title,
  summary: row.summary,
  content: row.content,
  coverImage: imageToDataUrl(row.cover, row.cover_mime),
  category: row.category_id
    ? {
        id: row.category_id,
        name: row.category_name
      }
    : null,
  author: {
    id: row.author_id,
    name: row.author_name,
    bio: row.author_bio,
    role: row.author_role
  },
  tags: await loadTags(row.id),
  publishedAt: row.published_at,
  updatedAt: row.updated_at
});

const ensureArticleAccess = async (articleId: number, userId: number, role: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT author_id FROM articles WHERE id = ? LIMIT 1",
    [articleId]
  );
  const article = rows[0];

  assert(article, 404, "Artigo nao encontrado.");
  assert(role === "admin" || article.author_id === userId, 403, "Voce nao pode alterar este artigo.");
};

const syncTags = async (articleId: number, tagNames: string[] = []) => {
  await pool.execute("DELETE FROM article_tags WHERE article_id = ?", [articleId]);

  const normalized = [...new Set(tagNames.map((tag) => tag.trim()).filter(Boolean))];

  for (const tag of normalized) {
    await pool.execute<ResultSetHeader>(
      "INSERT IGNORE INTO tags (name) VALUES (?)",
      [tag]
    );

    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id FROM tags WHERE name = ? LIMIT 1",
      [tag]
    );

    await pool.execute(
      "INSERT IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)",
      [articleId, rows[0].id]
    );
  }
};

router.get("/", async (req, res, next) => {
  try {
    const pageValue = req.query.page === undefined ? 1 : Number(req.query.page);
    assert(Number.isInteger(pageValue) && pageValue > 0, 400, "Pagina invalida.");
    const page = pageValue;
    const limit = 9;
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === "string" ? `%${req.query.search}%` : null;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const filters: string[] = [];
    const values: Array<string | number> = [];

    if (req.query.categoryId) {
      assert(categoryId !== null && Number.isInteger(categoryId) && categoryId > 0, 400, "Categoria invalida.");
    }

    if (search) {
      filters.push("(a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)");
      values.push(search, search, search);
    }

    if (categoryId) {
      filters.push("a.category_id = ?");
      values.push(categoryId);
    }

    const whereSql = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const [articles] = await pool.query<RowDataPacket[]>(
      `SELECT a.*, c.name AS category_name, u.name AS author_name, u.bio AS author_bio, u.role AS author_role
       FROM articles a
       LEFT JOIN categories c ON c.id = a.category_id
       INNER JOIN users u ON u.id = a.author_id
       ${whereSql}
       ORDER BY a.published_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values
    );

    res.json(await Promise.all(articles.map(serializeArticle)));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*, c.name AS category_name, u.name AS author_name, u.bio AS author_bio, u.role AS author_role
       FROM articles a
       LEFT JOIN categories c ON c.id = a.category_id
       INNER JOIN users u ON u.id = a.author_id
       WHERE a.id = ?
       LIMIT 1`,
      [Number(req.params.id)]
    );

    assert(rows[0], 404, "Artigo nao encontrado.");
    res.json(await serializeArticle(rows[0]));
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const input = readArticleInput(req.body);

    const { buffer, mimeType } = dataUrlToBuffer(input.coverImage);
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO articles (title, summary, content, cover, cover_mime, category_id, author_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.title, input.summary, input.content, buffer, mimeType, input.categoryId, req.user!.id]
    );

    await syncTags(result.insertId, input.tags);

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
    const input = readArticleInput(req.body);

    await ensureArticleAccess(articleId, req.user!.id, req.user!.role);

    const { buffer, mimeType } = dataUrlToBuffer(input.coverImage);

    await pool.execute(
      `UPDATE articles
       SET title = ?,
           summary = ?,
           content = ?,
           cover = ?,
           cover_mime = ?,
           category_id = ?
       WHERE id = ?`,
      [input.title, input.summary, input.content, buffer, mimeType, input.categoryId, articleId]
    );

    await syncTags(articleId, input.tags);

    res.json({ id: articleId });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);

    await ensureArticleAccess(articleId, req.user!.id, req.user!.role);

    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM articles WHERE id = ?",
      [articleId]
    );

    if (result.affectedRows === 0) {
      throw new HttpError(404, "Artigo nao encontrado.");
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
