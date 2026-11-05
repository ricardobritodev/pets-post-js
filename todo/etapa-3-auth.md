# Etapa 3 — Autenticação

Specs: BR-AUTH-001..013, PERM-003/004 · **✅ Concluída em 2026-11-05**, ver [`doc/features/003-autenticacao.md`](../doc/features/003-autenticacao.md) · [`rules.md`](../specs/domain/rules.md)

## Backend
- [x] **T3.1 — Spec das rotas** `specs/api/auth.md` (request/response/erros de cada rota).
- [x] **T3.2 — Sessão** (BR-AUTH-008)
  - `express-session` + store MySQL (`express-mysql-session` ou store Prisma; migration M-05). → store Prisma (`apps/api/src/lib/session-store.js`).
  - Cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção; `rolling: true`; 2h padrão, 7 dias com "lembrar de mim".
- [x] **T3.3 — CSRF** (BR-AUTH-010) com `csrf-csrf` (double submit). `GET /api/v1/auth/csrf` devolve o token.
- [x] **T3.4 — Rate limit** (BR-AUTH-007) com `express-rate-limit`: login 10/min + 50/h; cadastro 5/min + 20/h. Resposta 429 `RATE_LIMITED`.
- [x] **T3.5 — `POST /api/v1/auth/register`** (BR-AUTH-001..003)
  - 409 `CONFLICT` se o email já existe. 201 com `publicUser` (sem hash).
- [x] **T3.6 — `POST /api/v1/auth/login`** (BR-AUTH-004..006)
  - Mensagem genérica para email/senha errados; 403 para conta inativa.
  - Se `needsRehash(hash)` → regravar com `hashPassword` (re-hash transparente).
  - `session.regenerate()` no login (contra fixação de sessão).
- [x] **T3.7 — `POST /api/v1/auth/logout`** e **`GET /api/v1/auth/me`** (200 user | 401).
- [x] **T3.8 — Middlewares** `requireAuth` (401) e `requireAdmin` (403), usando `permissions.js`.
- [x] **T3.9 — Log de segurança** (BR-AUTH-011) com `pino`: login_success/failed/blocked_inactive, register_success, logout (com IP, sem senha).
- [x] **T3.10 — Validação genérica**: middleware `validate(schema)` → 400 `VALIDATION_ERROR` com `details`.

## Frontend
- [x] **T3.11 — Layout base** compartilhado (header com menu logado/deslogado, footer, flash messages).
- [x] **T3.12 — Páginas** `login/index.html` e `cadastro/index.html` (Vite inputs), com máscara de telefone e validação de email em tempo real (porta de `main.js`).
- [x] **T3.13 — Redirect seguro** pós-login via `?next=` (BR-AUTH-009): só caminhos relativos do mesmo host.
- [x] **T3.14 — Módulo `session.js`** no front: `getMe()`, cache, envio do token CSRF em todo POST.

## Fechamento
- [x] **T3.15 — Testes**: todos os BR-AUTH com teste de integração; porta de `pets-post/tests/test_auth.py`.
- [x] **T3.16 — Documentar** `doc/features/003-autenticacao.md`.
