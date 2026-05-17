import { Router } from "express";
import { RowDataPacket } from "mysql2";
import { pool, type DbUser } from "../database/connection";
import { requireAuth } from "../middlewares/auth.middleware";
import { assert } from "../utils/http";
import { readObject, readOptionalString, readRequiredString } from "../utils/validation";

const router = Router();

type UserRow = RowDataPacket & DbUser;

const publicProfile = (user: DbUser) => ({
  id: user.id,
  name: user.name,
  bio: user.bio,
  role: user.role,
  createdAt: user.created_at
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const [users] = await pool.execute<UserRow[]>("SELECT * FROM users WHERE id = ?", [
      req.user!.id
    ]);

    assert(users[0], 404, "Usuario nao encontrado.");

    res.json({
      id: users[0].id,
      name: users[0].name,
      email: users[0].email,
      bio: users[0].bio,
      role: users[0].role,
      createdAt: users[0].created_at,
      updatedAt: users[0].updated_at
    });
  } catch (error) {
    next(error);
  }
});

router.put("/me", requireAuth, async (req, res, next) => {
  try {
    const input = readObject(req.body);
    const nameValue = readRequiredString(input, "name", "Nome");
    const emailValue = readRequiredString(input, "email", "Email").toLowerCase();
    const bio = readOptionalString(input, "bio", "Bio");

    assert(nameValue.length >= 3, 400, "Nome deve ter pelo menos 3 caracteres.");
    assert(nameValue.length <= 150, 400, "Nome deve ter no maximo 150 caracteres.");
    assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue), 400, "Email invalido.");
    assert(emailValue.length <= 150, 400, "Email deve ter no maximo 150 caracteres.");
    assert(!bio || bio.length <= 500, 400, "Bio deve ter no maximo 500 caracteres.");

    await pool.execute(
      `UPDATE users
       SET name = ?, email = ?, bio = ?
       WHERE id = ?`,
      [nameValue, emailValue, bio ?? null, req.user!.id]
    );

    const [users] = await pool.execute<UserRow[]>("SELECT * FROM users WHERE id = ?", [
      req.user!.id
    ]);

    res.json({
      id: users[0].id,
      name: users[0].name,
      email: users[0].email,
      bio: users[0].bio,
      role: users[0].role,
      createdAt: users[0].created_at,
      updatedAt: users[0].updated_at
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [users] = await pool.execute<UserRow[]>(
      "SELECT * FROM users WHERE id = ? LIMIT 1",
      [Number(req.params.id)]
    );

    assert(users[0], 404, "Autor nao encontrado.");

    const [articles] = await pool.execute<RowDataPacket[]>(
      `SELECT id, title, summary, published_at AS publishedAt, updated_at AS updatedAt
       FROM articles
       WHERE author_id = ?
       ORDER BY published_at DESC`,
      [Number(req.params.id)]
    );

    res.json({ ...publicProfile(users[0]), articles });
  } catch (error) {
    next(error);
  }
});

export default router;
