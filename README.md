# Blog Mind Group - Backend

API REST do desafio de blog. Inclui autenticacao JWT, cadastro/login, CRUD protegido de artigos, categorias, tags e dump MySQL.

## Requisitos

- Node.js 20+
- MySQL 8+
- npm

## Setup

```powershell
cd "D:\Dev\Projects\Mind Group\blog-backend"
npm install
Copy-Item .env.example .env
mysql -u root -p < dump.sql
npm run dev
```

## Setup Rapido Com Docker

```powershell
cd "D:\Dev\Projects\Mind Group\blog-backend"
docker compose up -d mysql
npm install
npm run dev
```

Esse modo usa MySQL em Docker na porta `3307`:

```text
Host: 127.0.0.1
Porta: 3307
Usuario: root
Senha: mindgroup
Banco: mind_group_blog
```

API local:

```text
http://localhost:3333
```

Health check:

```powershell
curl http://localhost:3333/api/health
```

## Acesso Para Teste

Crie uma conta pela rota de cadastro ou pela tela de cadastro do frontend.
O dump ja inclui dados de exemplo para listagem publica.

## Variaveis

```env
PORT=3333
CLIENT_ORIGIN=http://localhost:5173
DB_HOST=localhost
DB_PORT=3307
DB_USER=root
DB_PASSWORD=mindgroup
DB_NAME=mind_group_blog
JWT_SECRET=replace_this_with_a_long_random_secret
JWT_EXPIRES_IN=7d
```

## Rotas

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`

Usuarios:

- `GET /api/users/me`
- `PUT /api/users/me`
- `GET /api/users/:id`

Artigos:

- `GET /api/articles`
- `GET /api/articles/:id`
- `POST /api/articles`
- `PUT /api/articles/:id`
- `DELETE /api/articles/:id`

Categorias e tags:

- `GET /api/categories`
- `GET /api/tags`

Dashboard:

- `GET /api/dashboard`

## Scripts

```powershell
npm run dev
npm run build
npm start
```

## Dump

Arquivo de entrega:

```text
dump.sql
```

Importa banco, tabelas, admin e artigos de exemplo.
