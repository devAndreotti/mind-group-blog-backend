import { Router } from "express";
import bcrypt from "bcryptjs";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { v4 as uuidv4 } from "uuid";
import { pool, type DbUser } from "../database/connection";
import { assert, HttpError } from "../utils/http";
import { signToken } from "../utils/jwt";
import { readObject, readOptionalString, readRequiredString } from "../utils/validation";

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
    const input = readObject(req.body);
    const nameValue = readRequiredString(input, "name", "Nome");
    const emailValue = readRequiredString(input, "email", "Email").toLowerCase();
    const passwordValue = readRequiredString(input, "password", "Senha");
    const confirmPassword = readOptionalString(input, "confirmPassword", "Confirmacao de senha");

    assert(nameValue.length >= 3, 400, "Nome deve ter pelo menos 3 caracteres.");
    assert(nameValue.length <= 150, 400, "Nome deve ter no maximo 150 caracteres.");
    assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue), 400, "Email invalido.");
    assert(emailValue.length <= 150, 400, "Email deve ter no maximo 150 caracteres.");
    assert(passwordValue.length >= 6, 400, "Senha deve ter pelo menos 6 caracteres.");
    assert(passwordValue.length <= 128, 400, "Senha deve ter no maximo 128 caracteres.");

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
    const input = readObject(req.body);
    const emailValue = readRequiredString(input, "email", "Email").toLowerCase();
    const passwordValue = readRequiredString(input, "password", "Senha");

    assert(emailValue, 400, "Email e obrigatorio.");
    assert(emailValue.length <= 150, 400, "Email deve ter no maximo 150 caracteres.");
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

router.post("/forgot-password", async (req, res, next) => {
  try {
    const input = readObject(req.body);
    const emailValue = readRequiredString(input, "email", "Email").toLowerCase();
    const resetToken = uuidv4();

    const [users] = await pool.execute<UserRow[]>(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [emailValue]
    );

    if (users[0]) {
      await pool.execute(
        `UPDATE users
         SET reset_token = ?, reset_token_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR)
         WHERE id = ?`,
        [resetToken, users[0].id]
      );
    }

    // Em produção, o token seria enviado por email via Resend/SendGrid
    // em vez de retornado na resposta.
    res.json({
      message: "Se o email existir, um token foi gerado.",
      reset_token: resetToken
    });
  } catch (error) {
    next(error);
  }
});

export default router;
