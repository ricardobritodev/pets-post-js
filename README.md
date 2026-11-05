# Pets Post v2

Reescrita do [Pets Post](https://www.petspost.com.br) (Flask) em **Node.js**, com
desenvolvimento guiado por especificação (*Spec-Driven Development*).

O sistema divulga pets **perdidos e encontrados**, pets para **adoção** e um **mapa de
parceiros** (lares temporários, petshops e clínicas), com contato direto por WhatsApp.

| Camada | Tecnologia |
|---|---|
| Frontend | Vite 8 (multi-page), JavaScript puro, Tailwind CSS 4 |
| Backend | Node.js, Express 5, zod, helmet |
| Banco | MySQL 8 + Prisma ORM 6 |
| Testes | `node:test` (nativo, sem dependências) |
| Chatbot (futuro) | grammY, node-nlp, LanceDB, Anthropic SDK |

> **Status:** Etapa 1 (fundação) concluída. Veja o [roadmap](doc/ROADMAP.md) e o checklist do que falta em [`todo/`](todo/README.md).

---

## Como rodar localmente

### 1. Requisitos

| Ferramenta | Versão | Como verificar |
|---|---|---|
| Node.js | 22 ou superior (recomendado 26, ver `.nvmrc`) | `node -v` |
| npm | 10 ou superior | `npm -v` |
| MySQL | 8.x | `mysql --version` |
| Git | qualquer | `git --version` |

Se não tiver o MySQL no macOS:

```bash
brew install mysql
brew services start mysql
```

> No Windows/Linux, instale o MySQL Community Server pelo site oficial ou pelo gerenciador de pacotes.

### 2. Clonar e instalar dependências

```bash
git clone <url-do-repo> pets-post-v2
cd pets-post-v2
npm install
```

O `npm install` instala todos os pacotes do monorepo e gera o client do Prisma.

> **npm 12:** scripts de instalação vêm bloqueados por padrão. Os do Prisma já estão
> liberados em `allowScripts` no `package.json`. Se aparecer aviso pedindo aprovação,
> rode `npm install-scripts approve prisma @prisma/client @prisma/engines`.

### 3. Criar o banco de dados

Entre no MySQL (`mysql -u root`) e rode:

```sql
CREATE DATABASE petpost_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'petpost_user'@'localhost' IDENTIFIED BY 'petpost123';
GRANT ALL PRIVILEGES ON petpost_v2.* TO 'petpost_user'@'localhost';
-- o Prisma precisa criar um banco temporário ("shadow") nas migrations de dev:
GRANT CREATE, ALTER, DROP, REFERENCES ON *.* TO 'petpost_user'@'localhost';
FLUSH PRIVILEGES;
```

> Já tem o banco do projeto Flask (`petpost_dev`)? Pode apontar o `DATABASE_URL` para
> ele: o schema Prisma usa as mesmas tabelas. Veja [specs/data/migration-plan.md](specs/data/migration-plan.md).

### 4. Configurar o `.env`

```bash
cp .env.example .env
```

Edite o `.env`:

```dotenv
NODE_ENV=development
API_PORT=3000
DATABASE_URL=mysql://petpost_user:petpost123@localhost:3306/petpost_v2
SESSION_SECRET=<cole aqui uma chave aleatória>
```

Para gerar a `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Criar as tabelas

```bash
npm run db:migrate
```

Na primeira vez, o Prisma pede um nome para a migration (ex.: `init`).

> **Etapa 1:** este passo é opcional. A página inicial só testa a conexão com o banco.
> As migrations versionadas entram na Etapa 2.

### 6. Rodar a aplicação

```bash
npm run dev
```

Isso sobe os dois servidores juntos:

| Serviço | URL |
|---|---|
| Web (Vite) | http://localhost:5173 |
| API (Express) | http://localhost:3000/api/v1/health |

Abra **http://localhost:5173**. O card "Status do sistema" deve mostrar
**API online** e **Banco conectado**. Se o banco aparecer "sem conexão",
confira o `DATABASE_URL` e se o MySQL está rodando.

Para subir só um dos lados: `npm run dev:api` ou `npm run dev:web`.

### 7. Rodar os testes

```bash
npm test
```

Os testes não precisam de MySQL (a API é testada com um banco falso).

---

## Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | API + Web em modo desenvolvimento (com recarregamento automático) |
| `npm run dev:api` / `npm run dev:web` | Sobe só a API ou só o front |
| `npm test` | Roda os testes de todos os pacotes |
| `npm run build` | Gera o build de produção do front em `apps/web/dist` |
| `npm run db:validate` | Valida o `schema.prisma` |
| `npm run db:generate` | Regenera o client do Prisma |
| `npm run db:migrate` | Cria/aplica migrations no banco de desenvolvimento |
| `npm run db:studio` | Abre o Prisma Studio (interface web do banco) |

## Estrutura do projeto

```
apps/
  api/          API Express (rotas em /api/v1)
  web/          Front Vite multi-page + Tailwind
packages/
  domain/       Regras de negócio puras (hash de senha, WhatsApp, permissões)
  contracts/    Schemas zod compartilhados (validação de entrada)
  db/           Schema Prisma + client
specs/          Fonte da verdade: regras (BR-*), permissões, contratos de API, ADRs
doc/            Features implementadas e roadmap
todo/           Checklist do que falta implementar (por etapa)
```

## Como contribuir (fluxo SDD)

1. Especifique a regra em `specs/` (ID `BR-xxx`).
2. Escreva o contrato zod em `packages/contracts`.
3. Escreva o teste citando o ID da regra.
4. Implemente.
5. Registre a entrega em `doc/features/`.

Detalhes em [specs/README.md](specs/README.md).

## Problemas comuns

| Sintoma | Solução |
|---|---|
| `Error: Configuração inválida` ao subir a API | Falta variável no `.env` (em produção, `DATABASE_URL` e `SESSION_SECRET` são obrigatórias) |
| `@prisma/client did not initialize yet` | Rode `npm run db:generate` |
| Banco "sem conexão" na página inicial | MySQL parado (`brew services start mysql`) ou `DATABASE_URL` errado |
| `EADDRINUSE :3000` | Outra coisa usando a porta. Mude `API_PORT` no `.env` e o proxy em `apps/web/vite.config.js` |
