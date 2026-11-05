# API — Autenticação

Regras: BR-AUTH-001..011 · Permissões: PERM-004 · Convenções: [conventions.md](conventions.md)

## Sessão e CSRF (BR-AUTH-008, BR-AUTH-010)
- Sessão por cookie `petspost.sid` (`express-session`), guardada na tabela `sessions` (M-05).
  O cookie é `HttpOnly` e `SameSite=Lax`, e fica `Secure` em produção.
- Expira após **2 h sem uso**. Cada requisição renova o prazo (`rolling`). Com `remember: true`
  no login, o prazo passa a ser **7 dias**.
- Toda requisição que **muda estado** (`POST`, `PUT`, `PATCH`, `DELETE`) exige o header
  `X-CSRF-Token` com um token obtido em `GET /api/v1/auth/csrf`. Sem token válido → 403 `CSRF_INVALID`.
- O token é amarrado à sessão. Login e logout trocam a sessão (contra fixação de sessão), por isso
  as duas respostas trazem um `csrfToken` novo, que o front deve passar a usar.

## GET /api/v1/auth/csrf
- Auth: não
- Response 200: `{ "csrfToken": "..." }`. Cria uma sessão anônima, se ainda não houver.

## POST /api/v1/auth/register
- Auth: não · CSRF: sim · Rate limit: 5/min e 20/h por IP (BR-AUTH-007)
- Request: `registerSchema` → `{ name, email, phone?, password, confirmPassword }`
- Response **201**: `{ "user": PublicUser }`. **Não** loga automaticamente (igual ao sistema
  atual); o front manda para o login.
- Erros: 400 `VALIDATION_ERROR` (BR-AUTH-001..003) · 409 `CONFLICT`
  "Este email já está cadastrado. Faça login ou use outro email." · 403 `CSRF_INVALID` · 429 `RATE_LIMITED`
- Regras: BR-AUTH-001, 002, 003, 004 (hash), 011 (`register_success`)

## POST /api/v1/auth/login
- Auth: não · CSRF: sim · Rate limit: 10/min e 50/h por IP (BR-AUTH-007)
- Request: `loginSchema` → `{ email, password, remember? }`
- Response 200: `{ "user": PublicUser, "csrfToken": "..." }`
- Erros:
  - 401 `INVALID_CREDENTIALS` "Email ou senha incorretos. Tente novamente.". A mesma mensagem vale
    para email inexistente e para senha errada (BR-AUTH-006).
  - 403 `ACCOUNT_INACTIVE` "Esta conta foi desativada. Entre em contato com o suporte."
    (BR-AUTH-005 / PERM-004). Só é devolvido **depois** de a senha conferir.
  - 400 `VALIDATION_ERROR` · 403 `CSRF_INVALID` · 429 `RATE_LIMITED`
- Efeitos:
  - `session.regenerate()`;
  - re-hash quando `needsRehash` (BR-AUTH-004);
  - log `login_success`, `login_failed` ou `login_blocked_inactive` (BR-AUTH-011).

## POST /api/v1/auth/logout
- Auth: sim · CSRF: sim
- Response 200: `{ "csrfToken": "..." }` (já da nova sessão anônima)
- Erros: 401 `UNAUTHENTICATED` · 403 `CSRF_INVALID`
- Regras: BR-AUTH-010, 011 (`logout`)

## GET /api/v1/auth/me
- Auth: sim
- Response 200: `{ "user": PublicUser }` · 401 `UNAUTHENTICATED`
- Se a conta foi desativada depois do login, a sessão é encerrada e a rota responde 401 (PERM-004).

## PublicUser
`{ id, name, email, role, phone }` (`publicUserSchema`). Nunca inclui `passwordHash`.

## Middlewares de autorização
| Middleware | Sem sessão | Sem permissão |
|---|---|---|
| `requireAuth` | 401 `UNAUTHENTICATED` | — |
| `requireAdmin` (PERM-003) | 401 `UNAUTHENTICATED` | 403 `FORBIDDEN` |

## Redirect pós-login (BR-AUTH-009, no front)
`/login?next=/caminho`: depois do login, o front só segue o `next` se for um caminho relativo do
mesmo site (começa com `/`, não com `//` ou `/\`, e não tem esquema). Caso contrário, vai para `/`.

## Testes
`apps/api/integration/auth.int.js`, com um teste citando cada BR-AUTH.
