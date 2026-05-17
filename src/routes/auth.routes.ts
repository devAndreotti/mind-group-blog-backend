import { Router } from "express";
import bcrypt from "bcryptjs";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool, type DbUser } from "../database/connection";
import { assert, HttpError } from "../utils/http";
import { signToken } from "../utils/jwt";

const router = Router();

type UserRow = RowDataPacket & DbUser;

const publicUser = (user: DbUser) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  bio: user.bio,
  role: user.role,
  createdAt: user.created_at,
  updatedAt: user.updated_at
});

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    };
    const nameValue = name?.trim() ?? "";
    const emailValue = email?.toLowerCase() ?? "";
    const passwordValue = password ?? "";

    assert(nameValue.length >= 3, 400, "Nome deve ter pelo menos 3 caracteres.");
    assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue), 400, "Email invalido.");
    assert(passwordValue.length >= 6, 400, "Senha deve ter pelo menos 6 caracteres.");

    if (confirmPassword !== undefined) {
      assert(passwordValue === confirmPassword, 400, "As senhas nao conferem.");
    }

    const [existing] = await pool.execute<UserRow[]>(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [emailValue]
    );

    if (existing.length > 0) {
      throw new HttpError(409, "Email ja cadastrado.");
    }

    const passwordHash = await bcrypt.hash(passwordValue, 10);
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, 'member')`,
      [nameValue, emailValue, passwordHash]
    );

    const [users] = await pool.execute<UserRow[]>("SELECT * FROM users WHERE id = ?", [
      result.insertId
    ]);
    const user = users[0];
    const token = signToken({ id: user.id, email: user.email, role: user.role });

    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    const emailValue = email?.toLowerCase() ?? "";
    const passwordValue = password ?? "";

    assert(emailValue, 400, "Email e obrigatorio.");
    assert(passwordValue, 400, "Senha e obrigatoria.");

    const [users] = await pool.execute<UserRow[]>(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [emailValue]
    );
    const user = users[0];

    assert(user, 401, "Credenciais invalidas.");

    const passwordOk = await bcrypt.compare(passwordValue, user.password_hash);
    assert(passwordOk, 401, "Credenciais invalidas.");

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

export default router;
