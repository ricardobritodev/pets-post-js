# ADR 001 — Express em monólito modular (não NestJS, não microsserviços)

**Status:** aceita · 2026-11-04

## Contexto
~25 rotas, 6 tabelas, um banco, um time pequeno (projeto acadêmico).

## Decisão
Express 5 em monorepo npm workspaces: `apps/api`, `apps/web`, `apps/bot` (futuro) e
pacotes compartilhados `domain` (regras puras), `contracts` (zod) e `db` (Prisma).
Cada módulo da API segue `router → service → repositório (Prisma)`.

## Consequências
+ Pouca cerimônia, fácil de entender e testar.
+ Regras de negócio puras em `domain`, testáveis sem banco.
− Sem DI/decorators prontos (resolvido com injeção por parâmetro em `createApp`).
O bot será um **processo separado** (conexões longas), mas fala com a API via HTTP.
