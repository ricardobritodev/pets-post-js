# 003 — Autenticação

**Etapa:** 3 · **Data:** 2026-11-05
**Specs:** [auth.md](../../specs/api/auth.md) · [rules.md](../../specs/domain/rules.md) (BR-AUTH-001..013) ·
[permissions.md](../../specs/domain/permissions.md) (PERM-003, PERM-004)

## O que foi entregue

### Rotas (`/api/v1/auth`)
| Rota | O que faz |
|---|---|
| `GET /csrf` | devolve o token CSRF (e cria uma sessão anônima) |
| `POST /register` | cria a conta (201). **Não** loga, igual ao sistema antigo |
| `POST /login` | abre a sessão. Opção "lembrar de mim" por 7 dias |
| `POST /logout` | destrói a sessão no banco |
| `GET /me` | usuário logado ou 401 |

### Segurança
| Regra | Como |
|---|---|
| Sessão (BR-AUTH-008) | `express-session` com store próprio em Prisma (tabela `sessions`, migration `1_sessions`). Cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção. 2 h sem uso, ou 7 dias com "lembrar". Sessões expiradas são limpas a cada 15 min |
| CSRF (BR-AUTH-010/012) | `csrf-csrf` (double submit) amarrado à sessão, header `X-CSRF-Token` em todo POST/PUT/PATCH/DELETE |
| Fixação de sessão (BR-AUTH-013) | `session.regenerate()` no login e no logout. As duas rotas devolvem um token CSRF novo |
| Rate limit (BR-AUTH-007) | `express-rate-limit`: login 10/min e 50/h, cadastro 5/min e 20/h, token CSRF 30/min e 300/h |
| Mensagem genérica (BR-AUTH-006) | mesma resposta para email inexistente e senha errada. Com email inexistente, roda um scrypt "isca" para o tempo de resposta não denunciar quais emails existem |
| Conta inativa (BR-AUTH-005/PERM-004) | 403 só depois de a senha conferir. Se a conta for desativada com a sessão aberta, perde o acesso na próxima requisição |
| Senhas antigas (BR-AUTH-004) | hash `pbkdf2:` (ou scrypt mais fraco) é regravado em `scrypt:32768:8:1` no login |
| Log (BR-AUTH-011) | `pino`, canal `security`, com IP. Senha removida com `redact` |
| Autorização | `requireAuth` (401) e `requireAdmin` (401/403, PERM-003) |
| Validação | `validate(schema)` → 400 `VALIDATION_ERROR` com `details: [{ path, message }]` |

### Front (Vite MPA, JS puro)
- `/login/` e `/cadastro/`: uma pasta por página, o que dá URL limpa.
- `lib/layout.js`: header com o estado de login, menu mobile, mensagens (flash) e rodapé. Já
  aplicado na home.
- `lib/api.js`: envia o `X-CSRF-Token` sozinho e, se o token expirar, busca outro e tenta de novo.
- `lib/session.js`: `getMe()` com cache, `login`, `register`, `logout`, `redirectToLogin()`.
- `lib/forms.js`: máscara de telefone e checagem de email (porta do `main.js` antigo), e erros da
  API mostrados no campo certo.
- Redirect pós-login (BR-AUTH-009): `safeRedirectPath` em `@petspost/domain/redirect`. É uma regra
  pura, testada contra 18 tipos de ataque (`//mal.com`, `/\mal.com`, `javascript:`...).

## Como testar
```bash
npm test                    # 67 testes unitários
npm run test:integration    # 45 testes com MySQL (26 de auth, porta do test_auth.py)
npm run dev                 # http://localhost:5173/login/  → admin@petpost.com / Admin@123
```

## Revisão de segurança (X-11)
- ✅ Itens da tabela acima.
- ✅ Encontrado e corrigido na revisão: `GET /auth/csrf` grava uma sessão por chamada, o que
  permitiria lotar a tabela `sessions`. Agora tem rate limit.
- ✅ Dependências novas fixadas em versões publicadas há mais de 2 semanas (sem `^`): `csrf-csrf`
  4.0.3, `express-rate-limit` 8.7.1, `express-session` 1.19.0, `cookie-parser` 1.4.7, `pino` 10.4.0.
  O `npm audit` não acusa nada novo, só a D-01 que já era conhecida.
- ⚠️ Aceito, igual ao sistema antigo: o cadastro diz "email já cadastrado", então dá para descobrir
  se um email tem conta. O rate limit do cadastro reduz o abuso.
- ⚠️ O rate limit fica em memória, um por processo. Com mais de uma instância (Etapa 7), vai
  precisar de um store compartilhado.

## Decisões e desvios da spec
- **Store de sessão em Prisma** em vez de `express-mysql-session`: não abre um segundo pool MySQL,
  e a tabela é versionada pelas migrations.
- **Baseline ajustado:** o banco antigo agora é alinhado ao schema da `0_init`
  (`scripts/baseline-target.prisma`), e depois o `migrate deploy` aplica a `1_sessions`. Alinhar ao
  schema atual criaria `sessions` por fora e quebraria o deploy.
- **URLs `/login/` e `/cadastro/`** em vez de `/auth/login`: são páginas do front. A API fica em
  `/api/v1/auth`.
- **Regra nova BR-AUTH-012:** CSRF em toda requisição que altera estado. Generaliza a BR-AUTH-010.
- **Regra nova BR-AUTH-013:** a sessão é trocada no login e destruída no logout.
- `SESSION_SECRET` ausente fora de produção: a API gera uma chave temporária e avisa no log.

## Pendências
- Logs do pino saem em JSON também em dev. Dá para adicionar `pino-pretty` (X-12).
- Recuperar senha por email e login com Google continuam fora do escopo (eram TODO no sistema antigo).
