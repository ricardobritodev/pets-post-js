# Etapa 4 — Posts de pets perdidos/encontrados

Specs: BR-POST-001..007, PERM-001/002, BR-CONTACT-001 · **✅ Concluída em 2026-11-05**, ver [`doc/features/004-posts.md`](../doc/features/004-posts.md)

## Backend
- [x] **T4.1 — Spec** `specs/api/posts.md` (todas as rotas abaixo).
- [x] **T4.2 — Contratos zod** `packages/contracts/src/posts.js`: `createPostSchema`, `updatePostSchema`, `listPostsQuerySchema`, `postDTO` (inclui `whatsappUrl`, rótulos PT-BR, `primaryPhoto`).
- [x] **T4.3 — `GET /api/v1/posts`** (BR-POST-002/003): filtros `status`, `petType`, `page`; 12 por página; inválidos ignorados; formato paginado da convenção.
- [x] **T4.4 — `GET /api/v1/posts/recent`** (BR-POST-004): 12 mais recentes para a home.
- [x] **T4.5 — `GET /api/v1/posts/:id`** (PERM-002): inativo → 404 para quem não é dono/admin.
- [x] **T4.6 — `POST /api/v1/posts`** (BR-POST-001), autenticado. Fotos chegam na Etapa 5 (por ora só JSON).
- [x] **T4.7 — `PATCH /api/v1/posts/:id`** (PERM-001).
- [x] **T4.8 — `DELETE /api/v1/posts/:id`** (BR-POST-006, PERM-001) — remoção de arquivos entra na Etapa 5.
- [x] **T4.9 — `POST /api/v1/posts/:id/resolve`** (BR-POST-005).
- [x] **T4.10 — `GET /api/v1/me/posts`**: posts do usuário logado (inclui inativos/resolvidos).

## Frontend
- [x] **T4.11 — Componente card** de post (porta de `posts/_card.html`) com badge lost/found.
- [x] **T4.12 — Home** (`index.html`): hero + CTA "perdi"/"encontrei" + grid dos recentes.
- [x] **T4.13 — Lista** `posts/index.html`: filtros, paginação sem recarregar, `history.pushState`, degradação se o fetch falhar.
- [x] **T4.14 — Detalhe** `posts/detalhe.html` (URL `/posts/:id`): galeria, dados, botão WhatsApp com mensagem pré-preenchida, ações do dono (editar/resolver/excluir com confirmação).
- [x] **T4.15 — Formulário** criar/editar com `?status=` pré-selecionado (BR-POST-007).
- [x] **T4.16 — Open Graph** (ADR 002): middleware Express que injeta title/description/og:image no HTML do detalhe.
- [x] **T4.17 — Página "Sobre"** (porta de `main/about.html`).

## Fechamento
- [x] **T4.18 — Testes**: porta de `pets-post/tests/test_posts.py` + todos os BR-POST.
- [x] **T4.19 — Documentar** `doc/features/004-posts.md`.
