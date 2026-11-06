# API — Painel administrativo

Regras: BR-ADMIN-001..005, BR-PARTNER-002, BR-GEO-001 · Permissões: PERM-003, PERM-005 ·
Convenções: [conventions.md](conventions.md) · Contratos: `packages/contracts/src/admin.js`

**Todas** as rotas abaixo exigem admin (PERM-003): visitante → 401 `UNAUTHENTICATED`, usuário comum → 403
`FORBIDDEN`. As de escrita exigem CSRF.

## GET /api/v1/admin/stats (BR-ADMIN-001/004)
```json
{ "users": { "total": 40, "active": 38 },
  "posts": { "total": 120, "active": 80, "resolved": 30, "lost": 50, "found": 30, "hidden": 10 },
  "adoption": { "total": 25, "available": 18, "adopted": 6, "hidden": 1 },
  "partners": { "total": 30, "active": 29, "withoutCoords": 1 },
  "recent": { "posts": [AdminPost x5], "adoptions": [AdminAdoption x5], "users": [AdminUser x5] } }
```
- `posts.active` = ativos e não resolvidos (o mesmo que aparece no site); `lost`/`found` contam só esses.
- `hidden` = `isActive = false`.

## Usuários (BR-ADMIN-002, PERM-005)
### GET /api/v1/admin/users
- Query: `q` (parte do nome ou email), `page`. 20 por página, mais novos primeiro.
- Response: `{ items: AdminUser[], page, pageSize: 20, total, totalPages }`
- `AdminUser`: `{ id, name, email, phone, role, isActive, createdAt, postCount, adoptionCount }`
### POST /api/v1/admin/users/:id/toggle
- Ativa ou desativa. Response: `{ user: AdminUser }`
- O admin não pode desativar a si mesmo → 400 `VALIDATION_ERROR` com a mensagem "Você não pode desativar sua
  própria conta." (PERM-005). Inexistente → 404.
- Desativar **encerra todas as sessões** da pessoa na hora (BR-ADMIN-005). Ela não consegue mais entrar
  (BR-AUTH-005).

## Moderação de anúncios (BR-ADMIN-003)
### GET /api/v1/admin/posts · GET /api/v1/admin/adoption
- Lista **todos** os anúncios, inclusive ocultos, resolvidos e adotados. 20 por página, mais novos primeiro.
- Query: `q` (título), `visibility` (`active`|`hidden`), `page`. Posts aceitam também `status` (`lost`|`found`).
- Itens: o card público (PostCard / AdoptionCard) + `owner: { id, name, email }`.
### PATCH /api/v1/admin/posts/:id · PATCH /api/v1/admin/adoption/:id
- Body: `{ "isActive": true | false }`. Ocultar tira o anúncio do site e o link passa a dar 404 para os
  outros (PERM-002). O dono continua vendo, com o aviso "oculto".
- Response: `{ item: AdminPost | AdminAdoption }` · 404 se não existir.
- Excluir continua sendo `DELETE /api/v1/posts/:id` e `DELETE /api/v1/adoption/:id` (o admin já pode, PERM-001).

## Parceiros (BR-PARTNER-002)
### GET /api/v1/admin/partners
- Todos, inclusive inativos e sem coordenadas, em ordem alfabética. Query: `q` (nome), `type`, `page` (20 por página).
- Item: `{ id, name, description, type, typeLabel, address, lat, lng, phone, email, website, isActive, createdAt }`
### GET /api/v1/admin/partners/:id → `{ partner }`
### POST /api/v1/admin/partners · PATCH /api/v1/admin/partners/:id
- Body (`partnerSchema`): `name` (obrigatório, 150), `type` (obrigatório), `address` (obrigatório, 255),
  `description?`, `phone?` (formato BR-VAL-001), `email?`, `website?` (**só http/https**), `isActive` (padrão true),
  `lat?`/`lng?` (juntos; servem para corrigir à mão quando o mapa não acha o endereço).
- Geocodificação **na hora** (o admin precisa saber se deu certo): sem `lat`/`lng` no corpo, geocodifica quando o
  endereço é novo ou mudou, ou quando faltam coordenadas (BR-GEO-002).
- Response 201/200: `{ partner, geocoded: true | false | null }`
  - `true`: achou e gravou as coordenadas;
  - `false`: não achou (o parceiro é salvo, mas **não aparece no mapa** até ter coordenadas);
  - `null`: não precisou geocodificar.
### DELETE /api/v1/admin/partners/:id → 204

## Páginas do front (URLs do sistema antigo)
| URL | Página |
|---|---|
| `/admin` | dashboard |
| `/admin/usuarios` | usuários (busca, ativar/desativar) |
| `/admin/posts` | moderação de posts |
| `/admin/adocao` | moderação de adoção (nova) |
| `/admin/parceiros` | parceiros |
| `/admin/parceiros/criar` · `/admin/parceiros/:id/editar` | formulário de parceiro |

As páginas checam o papel no navegador só para mostrar "sem permissão" bonito; quem protege de verdade é a API.
