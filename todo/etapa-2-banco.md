# Etapa 2 — Banco de dados

Specs: [`specs/data/migration-plan.md`](../specs/data/migration-plan.md) · [`entities.md`](../specs/domain/entities.md)
Pré-requisito: P-01 (MySQL instalado). **✅ Concluída em 2026-11-05**, ver [`doc/features/002-banco.md`](../doc/features/002-banco.md).

- [x] **T2.1 — Migration inicial `0_init`**
  - Gerar com `prisma migrate diff --from-empty --to-schema-datamodel` em `packages/db/prisma/migrations/0_init/`.
  - Pronto quando: `npm run db:migrate` cria as 6 tabelas num banco vazio.

- [x] **T2.2 — Procedimento de baseline do banco Flask**
  - Script `packages/db/scripts/baseline.md` (ou `.sh`) com `db pull --print`, comparação e `migrate resolve --applied 0_init`.
  - Testar contra um **dump** do banco Flask (nunca direto em produção).
  - ✅ Feito com banco Flask simulado (`scripts/flask-mock/flask-mock.sql`); `npm run db:baseline`. Falta o dump real (Q-003).
  - Pronto quando: `prisma migrate status` diz "up to date" no dump, sem alterar dados.

- [x] **T2.3 — Seed de desenvolvimento** (porta de `pets-post/seeds.py`)
  - `packages/db/prisma/seed.js`: admin `admin@petpost.com` / `Admin@123` (via `hashPassword`), usuários, posts lost/found, anúncios de adoção.
  - Script `npm run db:seed`; idempotente (pode rodar duas vezes).
  - Pronto quando: o seed popula o banco e o admin consegue logar (validar na Etapa 3).

- [x] **T2.4 — Seed de parceiros SP** (porta de `pets-post/seeds_parceiros_sp.py`)
  - Com lat/lng já fixos no arquivo (não chamar Nominatim no seed).

- [x] **T2.5 — Banco de testes de integração**
  - `DATABASE_URL_TEST` + helper que faz `migrate reset --force` antes da suíte.
  - Separar `npm test` (unitário, sem banco) de `npm run test:integration`.

- [x] **T2.6 — Repositórios base**
  - `apps/api/src/modules/*/repository.js` com funções Prisma (sem regra de negócio).
  - Teste de integração: CRUD básico de `User`.

- [x] **T2.7 — Fechar P-02** (vetor `scrypt:` real) e atualizar ADR 003 para "validada".

- [x] **T2.8 — Documentar** `doc/features/002-banco.md` + atualizar README (seed, testes de integração).
