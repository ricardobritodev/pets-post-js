# Etapa 7 — Admin e cutover para produção

Specs: BR-ADMIN-001..004, PERM-003/005, BR-PARTNER-002

## Admin
- [x] **T7.1 — `GET /api/v1/admin/stats`** (BR-ADMIN-001 + adoção, BR-ADMIN-004).
- [x] **T7.2 — Usuários**: listar (paginado), `POST /admin/users/:id/toggle` (PERM-005).
- [x] **T7.3 — Moderação**: listar posts e adoções, ocultar/reexibir (`isActive`, BR-ADMIN-003), excluir.
- [x] **T7.4 — CRUD de parceiros** (BR-PARTNER-002) com geocodificação automática e aviso se falhar.
- [x] **T7.5 — Front admin**: dashboard, tabelas de usuários/posts/adoções/parceiros, formulário de parceiro.
- [x] **T7.6 — Testes**: acesso negado (401/403) em todas as rotas admin.

## Produção
- [x] **T7.7 — Express serve `apps/web/dist`** + fallback das rotas MPA + injeção Open Graph.
- [x] **T7.8 — CSP final** com helmet (sem `unsafe-inline` em script; tiles OSM em `img-src`).
- [x] **T7.9 — Páginas de erro** 404/500 no front.
- [x] **T7.10 — Processo**: PM2 ou systemd, `NODE_ENV=production`, `trust proxy`, logs.
- [x] **T7.11 — Nginx**: proxy reverso, HTTPS, `client_max_body_size 8m`.
- [x] **T7.12 — Redirects de URLs antigas** do Flask (`/posts/<id>`, `/adocao/<id>`, `/mapa`, `/auth/login`) para não quebrar links compartilhados.
- [ ] **T7.13 — Dados**: banco novo no VPS (setup-server.sh). Importar o banco do Flask só se quiser manter os dados de lá (Q-003); o procedimento `npm run db:baseline` está pronto.
- [ ] **T7.14 — Subida** no VPS da Hostinger (Q-004): teste pelo IP/subdomínio, testes de fumaça, troca de DNS. Rollback = versão anterior da v2 (tag + backup); o Flask foi aposentado.

## Fechamento
- [x] **T7.15 — Documentar** `doc/features/007-admin-deploy.md` + seção de deploy no README.

> 2026-11-06: admin e preparação de produção prontos (doc/features/007). Falta T7.13/T7.14, que dependem do VPS contratado (deploy/README.md).
