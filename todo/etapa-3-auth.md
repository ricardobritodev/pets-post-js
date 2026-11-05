# Etapa 3 — Autenticação

Specs: BR-AUTH-001..011, PERM-004 · [`rules.md`](../specs/domain/rules.md)

## Backend
- [ ] **T3.1 — Spec das rotas** `specs/api/auth.md` (request/response/erros de cada rota).
- [ ] **T3.2 — Sessão** (BR-AUTH-008)
  - `express-session` + store MySQL (`express-mysql-session` ou store Prisma; migration M-05).
  - Cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção; `rolling: true`; 2h padrão, 7 dias com "lembrar de mim".
- [ ] **T3.3 — CSRF** (BR-AUTH-010) com `csrf-csrf` (double submit). `GET /api/v1/auth/csrf` devolve o token.
- [ ] **T3.4 — Rate limit** (BR-AUTH-007) com `express-rate-limit`: login 10/min + 50/h; cadastro 5/min + 20/h. Resposta 429 `RATE_LIMITED`.
- [ ] **T3.5 — `POST /api/v1/auth/register`** (BR-AUTH-001..003)
  - 409 `CONFLICT` se o email já existe. 201 com `publicUser` (sem hash).
- [ ] **T3.6 — `POST /api/v1/auth/login`** (BR-AUTH-004..006)
  - Mensagem genérica para email/senha errados; 403 para conta inativa.
  - Se `needsRehash(hash)` → regravar com `hashPassword` (re-hash transparente).
  - `session.regenerate()` no login (contra fixação de sessão).
- [ ] **T3.7 — `POST /api/v1/auth/logout`** e **`GET /api/v1/auth/me`** (200 user | 401).
- [ ] **T3.8 — Middlewares** `requireAuth` (401) e `requireAdmin` (403), usando `permissions.js`.
- [ ] **T3.9 — Log de segurança** (BR-AUTH-011) com `pino`: login_success/failed/blocked_inactive, register_success, logout (com IP, sem senha).
- [ ] **T3.10 — Validação genérica**: middleware `validate(schema)` → 400 `VALIDATION_ERROR` com `details`.

## Frontend
- [ ] **T3.11 — Layout base** compartilhado (header com menu logado/deslogado, footer, flash messages).
- [ ] **T3.12 — Páginas** `login.html` e `cadastro.html` (Vite inputs), com máscara de telefone e validação de email em tempo real (porta de `main.js`).
- [ ] **T3.13 — Redirect seguro** pós-login via `?next=` (BR-AUTH-009): só caminhos relativos do mesmo host.
- [ ] **T3.14 — Módulo `session.js`** no front: `getMe()`, cache, envio do token CSRF em todo POST.

## Fechamento
- [ ] **T3.15 — Testes**: todos os BR-AUTH com teste de integração; porta de `pets-post/tests/test_auth.py`.
- [ ] **T3.16 — Documentar** `doc/features/003-autenticacao.md`.
