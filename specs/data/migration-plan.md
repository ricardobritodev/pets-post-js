# Plano de migração do banco

## Situação herdada (Flask)
- Tabelas `users`, `pet_posts`, `photos` foram criadas via `flask create-db`,
  **sem migration** (a primeira migration Alembic `a68a5fb6bb8b` tem
  `down_revision = None` e só cria as tabelas de adoção; `6aab70c6759b` cria `partners`).
- FKs de fotos **não** têm `ON DELETE CASCADE` no banco (o cascade era do ORM).
- Coordenadas em `FLOAT` (precisão simples, ~7 dígitos).

## Passo 1 — Baseline (Etapa 2)
Objetivo: Prisma assumir o banco existente sem alterar nada.

```bash
# 1. Comparar o schema.prisma com o banco real (cópia de produção!)
npx prisma db pull --print          # inspeção, não sobrescreve
# 2. Gerar a migration inicial a partir do schema
mkdir -p packages/db/prisma/migrations/0_init
npx prisma migrate diff --from-empty --to-schema-datamodel packages/db/prisma/schema.prisma \
  --script > packages/db/prisma/migrations/0_init/migration.sql
# 3. Marcar como já aplicada no banco existente
npx prisma migrate resolve --applied 0_init
```

Para banco **novo** (dev local), basta `npm run db:migrate`.

**Implementado (Etapa 2):** `npm run db:baseline` automatiza esses passos e também **alinha a
estrutura** (defaults, FKs com CASCADE, nomes de índices) antes do `resolve`. Sem isso, excluir
post com fotos falha no banco Flask, porque o `schema.prisma` já declara `onDelete: Cascade`.
Procedimento: [`packages/db/scripts/BASELINE.md`](../../packages/db/scripts/BASELINE.md).

## Passo 2 — Correções planejadas (migrations futuras)
| # | Mudança | Motivo |
|---|---|---|
| M-01 | ~~`FLOAT` → `DOUBLE` nas coordenadas~~ ✅ migration `2_coords_double` (Etapa 5) | precisão |
| M-02 | ~~`ON DELETE CASCADE` nas FKs de fotos~~ ✅ feito no baseline (já estava no `0_init`) | integridade |
| M-03 | Unificar `photos` + `adoption_photos` (Q-002: adiada para depois da virada, para manter o rollback) | remover duplicação |
| M-04 | Índices `(is_active, is_resolved, created_at)` e `(is_active, is_adopted, created_at)` | listagens |
| M-05 | ~~Tabela `sessions` (express-session store)~~ ✅ migration `1_sessions` (Etapa 3) | sessões persistentes |

Cada mudança vira uma migration Prisma separada e reversível.
