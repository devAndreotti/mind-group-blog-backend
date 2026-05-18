import { Router } from "express";
import { RowDataPacket } from "mysql2";
import { pool, type DbUser } from "../database/connection";
import { requireAuth } from "../middlewares/auth.middleware";
import { assert, HttpError } from "../utils/http";
import { readObject, readOptionalString, readRequiredString } from "../utils/validation";

const router = Router();
const MAX_AVATAR_CHARS = 2_097_152;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type UserRow = RowDataPacket & DbUser;

const avatarToDataUrl = (buffer?: Buffer | null, mimeType?: string | null) => {
  if (!buffer) {
    return null;
  }

  return `data:${mimeType ?? "image/jpeg"};base64,${buffer.toString("base64")}`;
};

const publicProfile = (user: DbUser) => ({
  id: user.id,
  name: user.name,
  avatar: avatarToDataUrl(user.avatar, user.avatar_mime),
  bio: user.bio,
  role: user.role,
  createdAt: user.created_at
});

const readAvatarInput = (input: Record<string, unknown>) => {
  if (!Object.prototype.hasOwnProperty.call(input, "avatar")) {
    return undefined;
  }

  const avatar = readOptionalString(input, "avatar", "Avatar");

  if (avatar === undefined) {
    return undefined;
  }

  assert(avatar.startsWith("data:image/"), 400, "Avatar deve ser uma imagem em base64.");
  assert(avatar.length <= MAX_AVATAR_CHARS, 400, "Avatar deve ter no maximo 2 MB.");

  const match = avatar.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new HttpError(400, "Avatar deve estar em formato data URL base64.");
  }

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_AVATAR_MIME_TYPES.has(mimeType)) {
    throw new HttpError(400, "Formato de imagem não suportado. Use PNG, JPEG ou WebP.");
  }

  return {
    mimeType,
    buffer: Buffer.from(match[2], "base64")
  };
};

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
      avatar: avatarToDataUrl(users[0].avatar, users[0].avatar_mime),
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
    const avatar = readAvatarInput(input);

    assert(nameValue.length >= 3, 400, "Nome deve ter pelo menos 3 caracteres.");
    assert(nameValue.length <= 150, 400, "Nome deve ter no maximo 150 caracteres.");
    assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue), 400, "Email invalido.");
    assert(emailValue.length <= 150, 400, "Email deve ter no maximo 150 caracteres.");
    assert(!bio || bio.length <= 500, 400, "Bio deve ter no maximo 500 caracteres.");

    if (avatar) {
      await pool.execute(
        `UPDATE users
         SET name = ?, email = ?, bio = ?, avatar = ?, avatar_mime = ?
         WHERE id = ?`,
        [nameValue, emailValue, bio ?? null, avatar.buffer, avatar.mimeType, req.user!.id]
      );
    } else {
      await pool.execute(
        `UPDATE users
         SET name = ?, email = ?, bio = ?
         WHERE id = ?`,
        [nameValue, emailValue, bio ?? null, req.user!.id]
      );
    }

    const [users] = await pool.execute<UserRow[]>("SELECT * FROM users WHERE id = ?", [
      req.user!.id
    ]);

    res.json({
      id: users[0].id,
      name: users[0].name,
      email: users[0].email,
      avatar: avatarToDataUrl(users[0].avatar, users[0].avatar_mime),
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
