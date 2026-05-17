CREATE DATABASE IF NOT EXISTS mind_group_blog
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mind_group_blog;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS article_tags;
DROP TABLE IF EXISTS articles;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar LONGBLOB NULL,
  avatar_mime_type VARCHAR(80) NULL,
  bio VARCHAR(500) NULL,
  role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
  reset_token VARCHAR(255) NULL,
  reset_token_expires DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE articles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  cover_image LONGBLOB NULL,
  cover_image_mime_type VARCHAR(80) NULL,
  category_id INT NULL,
  author_id INT NOT NULL,
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_articles_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_articles_author
    FOREIGN KEY (author_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT chk_articles_content_length CHECK (CHAR_LENGTH(content) <= 8000)
);

CREATE TABLE article_tags (
  article_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (article_id, tag_id),
  CONSTRAINT fk_article_tags_article
    FOREIGN KEY (article_id) REFERENCES articles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_article_tags_tag
    FOREIGN KEY (tag_id) REFERENCES tags(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_category_id ON articles(category_id);
CREATE INDEX idx_articles_author_id ON articles(author_id);

INSERT INTO users (name, email, password_hash, bio, role)
VALUES
  (
    'Admin Mind Group',
    'admin@mindgroup.com',
    '$2a$10$yJ62p4eM96JIzBfGEyOjt.4uJBtG2ASvHRMj0DZ88tQTTvV27q4x2',
    'Perfil administrativo para avaliacao do desafio.',
    'admin'
  );

INSERT INTO categories (name)
VALUES
  ('Desenvolvimento Web'),
  ('IA'),
  ('DevOps'),
  ('Mobile'),
  ('Seguranca'),
  ('Cloud');

INSERT INTO tags (name)
VALUES
  ('React'),
  ('Node.js'),
  ('MySQL'),
  ('Carreira'),
  ('Arquitetura');

INSERT INTO articles (title, summary, content, category_id, author_id)
VALUES
  (
    'Como estruturar um blog moderno com React e Node',
    'Uma visao pratica sobre frontend, backend, autenticacao e banco relacional para blogs pequenos.',
    'Um blog moderno precisa equilibrar experiencia de leitura, seguranca e manutencao. No frontend, React ajuda a organizar telas, formularios e estados de autenticacao. No backend, Express concentra regras de negocio e protege as operacoes sensiveis com JWT. O MySQL guarda usuarios, categorias, tags e artigos com relacionamentos claros. Essa separacao facilita evoluir o sistema sem misturar interface, regra e persistencia.',
    1,
    1
  ),
  (
    'Autenticacao JWT em projetos pequenos',
    'JWT e uma escolha simples para proteger rotas de criacao, edicao e exclusao de artigos.',
    'No fluxo de autenticacao, o usuario envia email e senha, o servidor valida o hash com bcrypt e devolve um token assinado. O frontend guarda o token e envia no header Authorization. O backend confere esse token antes de permitir alteracoes em artigos. Para um MVP, esse modelo e direto, facil de testar e suficiente para separar leitura publica de escrita protegida.',
    1,
    1
  ),
  (
    'Por que incluir dump SQL na entrega',
    'O dump reduz atrito na avaliacao porque recria tabelas e dados iniciais com um unico comando.',
    'Em desafios tecnicos, um dump SQL bem preparado ajuda a equipe avaliadora a testar o projeto rapidamente. Ele deve criar o banco, tabelas, chaves estrangeiras e seeds minimos. Com isso, o avaliador consegue rodar backend e frontend localmente sem adivinhar estrutura de dados ou criar registros manuais antes do primeiro teste.',
    3,
    1
  );

INSERT INTO article_tags (article_id, tag_id)
VALUES
  (1, 1),
  (1, 2),
  (1, 3),
  (2, 2),
  (2, 4),
  (3, 3);
