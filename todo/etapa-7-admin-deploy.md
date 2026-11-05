# Etapa 7 — Admin e cutover para produção

Specs: BR-ADMIN-001..004, PERM-003/005, BR-PARTNER-002

## Admin
- [ ] **T7.1 — `GET /api/v1/admin/stats`** (BR-ADMIN-001 + adoção, BR-ADMIN-004).
- [ ] **T7.2 — Usuários**: listar (paginado), `POST /admin/users/:id/toggle` (PERM-005).
- [ ] **T7.3 — Moderação**: listar posts e adoções, ocultar/reexibir (`isActive`, BR-ADMIN-003), excluir.
- [ ] **T7.4 — CRUD de parceiros** (BR-PARTNER-002) com geocodificação automática e aviso se falhar.
- [ ] **T7.5 — Front admin**: dashboard, tabelas de usuários/posts/adoções/parceiros, formulário de parceiro.
- [ ] **T7.6 — Testes**: acesso negado (401/403) em todas as rotas admin.

## Produção
- [ ] **T7.7 — Express serve `apps/web/dist`** + fallback das rotas MPA + injeção Open Graph.
- [ ] **T7.8 — CSP final** com helmet (sem `unsafe-inline` em script; tiles OSM em `img-src`).
- [ ] **T7.9 — Páginas de erro** 404/500 no front.
- [ ] **T7.10 — Processo**: PM2 ou systemd, `NODE_ENV=production`, `trust proxy`, logs.
- [ ] **T7.11 — Nginx**: proxy reverso, HTTPS, `client_max_body_size 8m`.
- [ ] **T7.12 — Redirects de URLs antigas** do Flask (`/posts/<id>`, `/adocao/<id>`, `/mapa`, `/auth/login`) para não quebrar links compartilhados.
- [ ] **T7.13 — Migração**: backup do banco, baseline (T2.2), copiar `app/static/uploads`.
- [ ] **T7.14 — Deploy paralelo** em subdomínio, testes de fumaça, troca de DNS, plano de rollback para o Flask.

## Fechamento
- [ ] **T7.15 — Documentar** `doc/features/007-admin-deploy.md` + seção de deploy no README.
