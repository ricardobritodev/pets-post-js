# 001 — Fundação do projeto

**Etapa:** 1 · **Data:** 2026-11-04
**Specs:** [rules.md](../../specs/domain/rules.md) (BR-AUTH-004, BR-VAL-*, BR-CONTACT-001) ·
[permissions.md](../../specs/domain/permissions.md) · [health.md](../../specs/api/health.md) ·
ADRs [001](../../specs/adr/001-express-monolito-modular.md) [002](../../specs/adr/002-vite-mpa-og-injection.md) [003](../../specs/adr/003-password-hash-migration.md)

## O que foi entregue

### Estrutura do monorepo
```
apps/api            Express 5 — API JSON em /api/v1
apps/web            Vite 8 (multi-page) + Tailwind 4 + JS puro
packages/domain     regras de negócio puras (sem I/O)
packages/contracts  schemas zod (validação de entrada) compartilhados
packages/db         schema Prisma 6 + client singleton
specs/              fonte da verdade (SDD)
doc/                esta documentação
```

### Banco de dados (`packages/db`)
- `schema.prisma` com as 6 tabelas do projeto Flask, **mesmos nomes físicos**
  (`@@map`/`@map`) e mesmos tipos MySQL — o banco atual pode ser reaproveitado.

### Regras de domínio (`packages/domain`)
| Módulo | O que faz | Regra |
|---|---|---|
| `password.js` | Verifica hashes Werkzeug `scrypt:*`/`pbkdf2:*`; gera novos em `scrypt:32768:8:1`; `needsRehash` | BR-AUTH-004 |
| `whatsapp.js` | `toWhatsappUrl(phone, msg)` — porta fiel do `phone.py`, inclusive a codificação da mensagem | BR-CONTACT-001 |
| `permissions.js` | `canManage`, `canView`, `canToggleUser` | PERM-001/002/005 |
| `constants.js` | Enums, rótulos PT-BR, política de fotos, regex de telefone | — |

### Contratos (`packages/contracts`)
`registerSchema`, `loginSchema`, `publicUserSchema` e blocos reutilizáveis
(`phoneSchema`, `emailSchema`, `optionalText`…).

### API (`apps/api`)
- `createApp({ config, db })` — fábrica com injeção de dependências.
- Config validada com zod; em produção exige `DATABASE_URL` e `SESSION_SECRET` (≥32).
- `helmet` (headers de segurança), `x-powered-by` desligado, `trust proxy` em produção.
- `GET /api/v1/health` e `GET /api/v1/health/db`.
- 404 e erros em JSON padronizado (`specs/api/conventions.md`).

### Web (`apps/web`)
- Página inicial com indicador de status da API e do banco.
- Cliente `api()` sobre `fetch` com tratamento de erros padronizado.
- Proxy `/api` → `localhost:3000` no `vite dev`.

## Como testar
```bash
npm test                # 44 testes (domain 31, contracts 6, api 7)
npm run db:validate     # valida o schema Prisma
npm run dev             # API :3000 + Web :5173 → abra http://localhost:5173
```

## Testes de compatibilidade com o Flask
- 4 hashes PBKDF2 gerados pelo **Werkzeug 3.1.3 real** são aceitos.
- A primitiva scrypt do Node confere com o vetor oficial da **RFC 7914**.
- Os 17 casos de `tests/test_utils.py` (WhatsApp) foram portados 1:1, e a
  codificação da mensagem confere com `urllib.parse.quote` do Python.

## Decisões e desvios
- **npm workspaces** em vez de pnpm (pnpm não está instalado; npm 12 resolve).
- **Prisma 6.19** (estável) em vez da 7/8 — a 8 está em RC e a 7 exige driver adapters.
- npm 12 bloqueia scripts de instalação: só `prisma`, `@prisma/client` e
  `@prisma/engines` foram liberados em `allowScripts` (`package.json`).
- Hash de senha **mantém o formato Werkzeug** (ADR 003) em vez de migrar para argon2.

## Pendências
- Validar um hash `scrypt:` real do banco de produção (o Python local, 3.9 com
  LibreSSL, não tem `hashlib.scrypt` para gerar um vetor scrypt do Werkzeug).
- Migrations e seeds → Etapa 2.
- `npm audit` aponta 3 alertas *high* em `deepmerge-ts` (dependência do **CLI** do
  Prisma 6, `devDependency`). Não chega ao runtime da API. Correção oficial exige
  Prisma 7 (breaking) — reavaliar ao migrar de versão.
