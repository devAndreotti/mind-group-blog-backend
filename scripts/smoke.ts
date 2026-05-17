import type { Server } from "node:http";

type JsonRecord = Record<string, unknown>;

const smokePort = Number(process.env.SMOKE_PORT ?? 3999);
process.env.PORT = String(smokePort);

const baseUrl = `http://127.0.0.1:${smokePort}/api`;
const smokeId = Date.now();
const primaryEmail = `smoke.primary.${smokeId}@example.com`;
const secondaryEmail = `smoke.secondary.${smokeId}@example.com`;
const massAssignmentEmail = `smoke.mass.${smokeId}@example.com`;
const password = "Smoke@123";
const createdTitle = `Smoke artigo ${smokeId}`;
const updatedTitle = `Smoke artigo editado ${smokeId}`;

let server: Server | null = null;
let createdArticleId: number | null = null;

const fail = (message: string): never => {
  throw new Error(`[smoke] ${message}`);
};

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    fail(message);
  }
};

const send = async <T = JsonRecord>(
  path: string,
  options: RequestInit & { expectedStatus?: number } = {}
): Promise<{ headers: Headers; payload: T; status: number; text: string }> => {
  const { expectedStatus = 200, headers, body, ...rest } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : ({} as T);

  if (response.status !== expectedStatus) {
    fail(`${path} expected ${expectedStatus}, got ${response.status}: ${text}`);
  }

  return { headers: response.headers, payload, status: response.status, text };
};

const request = async <T = JsonRecord>(
  path: string,
  options: RequestInit & { expectedStatus?: number } = {}
): Promise<T> => {
  const response = await send<T>(path, options);
  return response.payload;
};

const validArticlePayload = (categoryId: number, suffix: string) => ({
  title: `Smoke artigo ${suffix} ${smokeId}`,
  summary: "Resumo do smoke test com tamanho minimo.",
  content:
    "Conteudo criado pelo smoke test para provar cadastro, login e criacao autenticada de artigo.",
  categoryId,
  tags: [`smoke-${smokeId}`],
  coverImage: null
});

const authHeader = (token: string) => ({
  Authorization: `Bearer ${token}`
});

const cleanup = async () => {
  const { pool } = await import("../src/database/connection");

  if (createdArticleId) {
    await pool.execute("DELETE FROM articles WHERE id = ?", [createdArticleId]);
  }

  await pool.execute("DELETE FROM users WHERE email IN (?, ?, ?)", [
    primaryEmail,
    secondaryEmail,
    massAssignmentEmail
  ]);
  await pool.execute("DELETE FROM tags WHERE name IN (?, ?)", [
    `smoke-${smokeId}`,
    `smoke-editado-${smokeId}`
  ]);
  await pool.end();
};

const main = async () => {
  const { app } = await import("../src/app");

  server = app.listen(smokePort);

  const health = await send("/health");
  assert(!health.headers.has("x-powered-by"), "header x-powered-by nao deveria existir");
  assert(
    health.headers.get("x-content-type-options") === "nosniff",
    "helmet nao aplicou x-content-type-options"
  );

  await send("/auth/login", {
    method: "POST",
    expectedStatus: 400,
    body: "{"
  });

  await request("/auth/register", {
    method: "POST",
    expectedStatus: 400,
    body: JSON.stringify({ name: ["Smoke"], email: {}, password: 123, confirmPassword: 123 })
  });

  await request("/auth/login", {
    method: "POST",
    expectedStatus: 400,
    body: JSON.stringify({ email: [], password: [] })
  });

  await request("/health", {
    expectedStatus: 403,
    headers: { Origin: "https://evil.example" }
  });

  await request("/articles", {
    method: "POST",
    expectedStatus: 401,
    body: JSON.stringify({
      title: createdTitle,
      summary: "Tentativa sem token",
      content: "Conteudo suficiente para validar bloqueio sem token."
    })
  });

  const categories = await request<Array<{ id: number; name: string }>>("/categories");
  assert(categories.length > 0, "categorias seed nao encontradas");

  const registerResponse = await request<{ token: string; user: { id: number; email: string } }>(
    "/auth/register",
    {
      method: "POST",
      expectedStatus: 201,
      body: JSON.stringify({
        name: "Smoke Primary",
        email: primaryEmail,
        password,
        confirmPassword: password
      })
    }
  );
  assert(registerResponse.token, "cadastro nao retornou token");

  const massAssignmentResponse = await request<{ user: { role: string } }>("/auth/register", {
    method: "POST",
    expectedStatus: 201,
    body: JSON.stringify({
      name: "Smoke Mass",
      email: massAssignmentEmail,
      password,
      confirmPassword: password,
      role: "admin"
    })
  });
  assert(massAssignmentResponse.user.role === "member", "cadastro aceitou role enviado pelo cliente");

  const loginResponse = await request<{ token: string; user: { id: number; email: string } }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        email: primaryEmail,
        password
      })
    }
  );
  assert(loginResponse.user.email === primaryEmail, "login retornou usuario incorreto");

  const secondaryResponse = await request<{ token: string }>("/auth/register", {
    method: "POST",
    expectedStatus: 201,
    body: JSON.stringify({
      name: "Smoke Secondary",
      email: secondaryEmail,
      password,
      confirmPassword: password
    })
  });

  await request("/users/me", {
    method: "PUT",
    expectedStatus: 409,
    headers: authHeader(loginResponse.token),
    body: JSON.stringify({
      name: "Smoke Primary",
      email: secondaryEmail,
      bio: "Bio valida"
    })
  });

  await request("/articles?categoryId=abc", { expectedStatus: 400 });
  await request("/articles?page=abc", { expectedStatus: 400 });

  const invalidArticlePayloads = [
    {
      body: { ...validArticlePayload(categories[0].id, "categoria-invalida"), categoryId: "1 OR 1=1" }
    },
    {
      body: { ...validArticlePayload(categories[0].id, "tags-invalidas"), tags: [{}, null, 123, "ok"] }
    },
    {
      body: { ...validArticlePayload(categories[0].id, "titulo-grande"), title: "A".repeat(5000) }
    },
    {
      body: { ...validArticlePayload(categories[0].id, "resumo-grande"), summary: "S".repeat(100000) }
    },
    {
      body: {
        ...validArticlePayload(categories[0].id, "html-cover"),
        coverImage: `data:text/html;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`
      }
    },
    {
      body: {
        ...validArticlePayload(categories[0].id, "svg-cover"),
        coverImage: `data:image/svg+xml;base64,${Buffer.from("<svg onload=alert(1)></svg>").toString("base64")}`
      }
    }
  ];

  for (const invalidPayload of invalidArticlePayloads) {
    await request("/articles", {
      method: "POST",
      expectedStatus: 400,
      headers: authHeader(loginResponse.token),
      body: JSON.stringify(invalidPayload.body)
    });
  }

  const createResponse = await request<{ id: number }>("/articles", {
    method: "POST",
    expectedStatus: 201,
    headers: authHeader(loginResponse.token),
    body: JSON.stringify({
      title: createdTitle,
      summary: "Resumo do smoke test com tamanho minimo.",
      content:
        "Conteudo criado pelo smoke test para provar cadastro, login e criacao autenticada de artigo.",
      categoryId: categories[0].id,
      tags: [`smoke-${smokeId}`],
      coverImage: null
    })
  });
  createdArticleId = createResponse.id;
  assert(createdArticleId > 0, "criacao nao retornou id valido");

  const listed = await request<Array<{ id: number; title: string }>>(
    `/articles?search=${encodeURIComponent(createdTitle)}`
  );
  assert(listed.some((article) => article.id === createdArticleId), "artigo criado nao apareceu na busca");

  const detail = await request<{ id: number; title: string; author: { id: number } }>(
    `/articles/${createdArticleId}`
  );
  assert(detail.title === createdTitle, "detalhe do artigo nao retornou titulo criado");

  await request(`/articles/${createdArticleId}`, {
    method: "PUT",
    expectedStatus: 403,
    headers: authHeader(secondaryResponse.token),
    body: JSON.stringify({
      title: "Tentativa indevida",
      summary: "Resumo valido para tentativa indevida.",
      content: "Conteudo valido para tentativa indevida de outro usuario.",
      categoryId: categories[0].id,
      tags: [`smoke-${smokeId}`],
      coverImage: null
    })
  });

  await request(`/articles/${createdArticleId}`, {
    method: "PUT",
    headers: authHeader(loginResponse.token),
    body: JSON.stringify({
      title: updatedTitle,
      summary: "Resumo editado pelo smoke test.",
      content:
        "Conteudo editado pelo smoke test para provar atualizacao autenticada do proprio artigo.",
      categoryId: categories[0].id,
      tags: [`smoke-editado-${smokeId}`],
      coverImage: null
    })
  });

  const updated = await request<{ title: string; tags: Array<{ name: string }> }>(
    `/articles/${createdArticleId}`
  );
  assert(updated.title === updatedTitle, "edicao nao persistiu titulo");
  assert(
    updated.tags.some((tag) => tag.name === `smoke-editado-${smokeId}`),
    "edicao nao sincronizou tags"
  );

  await request(`/articles/${createdArticleId}`, {
    method: "DELETE",
    expectedStatus: 204,
    headers: authHeader(loginResponse.token)
  });

  await request(`/articles/${createdArticleId}`, {
    expectedStatus: 404
  });
  createdArticleId = null;

  console.log(
    JSON.stringify(
      {
        status: "ok",
        checked: [
          "health",
          "security headers",
          "malformed JSON",
          "auth type validation",
          "CORS rejection",
          "unauthorized article create",
          "register",
          "mass assignment guard",
          "login",
          "duplicate email guard",
          "query validation",
          "article payload validation",
          "cover image validation",
          "create article",
          "list/search article",
          "read article",
          "forbid another user update",
          "update article",
          "delete article"
        ]
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (error) {
      console.error("[smoke] cleanup failed", error);
      process.exitCode = 1;
    }

    if (server) {
      server.close();
    }
  });
