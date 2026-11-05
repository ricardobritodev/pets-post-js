# 002 — Banco de dados

**Etapa:** 2 · **Data:** 2026-11-05
**Specs:** [migration-plan.md](../../specs/data/migration-plan.md) · [entities.md](../../specs/domain/entities.md) ·
[rules.md](../../specs/domain/rules.md) (BR-DATA-001..005, BR-AUTH-004) · ADR [003](../../specs/adr/003-password-hash-migration.md)

## O que foi entregue

### Migration inicial `0_init`
`packages/db/prisma/migrations/0_init/migration.sql`, gerada com
`prisma migrate diff --from-empty`. Num banco vazio, `npm run db:migrate` cria as 6 tabelas.

### Baseline do banco Flask (BR-DATA-004)
`npm run db:baseline` adota um banco Flask existente **sem alterar dados**. Procedimento
completo e garantias em [`packages/db/scripts/BASELINE.md`](../../packages/db/scripts/BASELINE.md).

Testamos com um **banco Flask simulado** (`packages/db/scripts/flask-mock/flask-mock.sql`). O DDL
dele foi gerado pelo próprio SQLAlchemy a partir de `pets-post/app/models`, e os hashes de senha
pelo Werkzeug 3.1.3 real. Isso revelou um ponto que o plano não previa:

> O `schema.prisma` declara `onDelete: Cascade` nas fotos, mas o banco Flask não tem cascade.
> Só marcar `0_init` como aplicada deixaria **a exclusão de posts com foto quebrada (P2003)**.
> Por isso o baseline também **alinha a estrutura**: defaults, FKs com CASCADE e nomes de índices.
> Isso antecipa a M-02 do plano de migração. A `alembic_version` é preservada.

### Seeds (BR-DATA-001..003)
| Comando | Conteúdo | Produção? |
|---|---|---|
| `npm run db:seed` | porta de `seeds.py`: admin + 3 usuários, 5 posts, 6 parceiros, **+2 anúncios de adoção** (novos) | ❌ recusa |
| `npm run db:seed:partners` | porta de `seeds_parceiros_sp.py`: 30 parceiros reais de SP, com lat/lng fixos | ✅ |

Os dois são idempotentes (chave natural: email, título ou nome). Os dados de SP foram extraídos
do arquivo Python com `ast.literal_eval` para `prisma/seed-data/partners-sp.json`.
Admin de dev: `admin@petpost.com` / `Admin@123`.

### Testes de integração (MySQL real)
- `npm run test:integration` valida `DATABASE_URL_TEST` (o banco precisa terminar em `_test`,
  BR-DATA-005), roda `prisma migrate deploy` e executa os arquivos `*/integration/**/*.int.js`
  um por vez.
- `npm test` continua **sem banco**, porque os arquivos `.int.js` não entram no padrão do `node --test`.
- Helpers em `@petspost/db/testing`: `clearDatabase` (confere `SELECT DATABASE()` antes de apagar),
  `assertTestDatabaseUrl`.

### Repositório base
`apps/api/src/modules/users/repository.js`: `createUserRepository(db)` com findById, findByEmail,
findByEmailWithHash (só para login), create, update, updatePasswordHash, setActive e list paginado.
As leituras comuns nunca devolvem `passwordHash`.

### Compatibilidade de senha validada (fecha P-02 / ADR 003)
- 3 hashes `scrypt:32768:8:1` gerados pelo **Werkzeug 3.1.3 real** (Python 3.13 + OpenSSL 3)
  são aceitos e não pedem re-hash. Um `scrypt:16384` mais fraco é aceito e pede re-hash.
- Sentido inverso: um hash gerado por `hashPassword()` da v2 foi aceito por
  `werkzeug.security.check_password_hash`, então o rollback para o Flask continua possível.
- Obs.: o Python do macOS (3.9 + LibreSSL) não tem `hashlib.scrypt`. Por isso a Etapa 1 só
  tinha vetores PBKDF2.

## Como testar
```bash
npm test                    # 55 testes unitários, sem banco
npm run test:integration    # 17 testes contra MySQL (repositório, seeds, baseline)
npm run db:seed && npm run db:seed:partners
```

## Decisões e desvios da spec
- **Baseline com alinhamento de estrutura** (acima): o plano previa só `resolve --applied`.
- **`migrate reset` fora do runner de testes**: o `reset` apaga o banco inteiro, então preferi não
  deixar isso automático. O runner usa `migrate deploy` e cada teste limpa só os dados que usa. Para recriar
  o banco de teste do zero, rode o `reset` manualmente (comando no topo de `scripts/test-integration.js`).
- **MySQL local 26.10** (Homebrew), não 8.x. Tudo funcionou, mas o comportamento de índices de FK
  difere do 8.x (ver BASELINE.md). Antes do cutover, vale testar o baseline num MySQL da mesma
  versão da produção.
- Logs do Prisma ficam silenciados com `NODE_ENV=test`.

## Pendências
- Rodar o baseline contra um **dump real** de produção quando houver acesso (Q-003 / Etapa 7).
- A Etapa 3 vai usar `findByEmailWithHash` + `needsRehash` para o re-hash no login (BR-AUTH-004).
