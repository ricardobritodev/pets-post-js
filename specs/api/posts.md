# API — Posts de pets perdidos e encontrados

Regras: BR-POST-001..007, BR-PHOTO-001..007, BR-GEO-001/002, BR-CONTACT-001 · Permissões: PERM-001, PERM-002 ·
Convenções: [conventions.md](conventions.md) · Contratos: `packages/contracts/src/posts.js`

## Objetos

### PostCard (listagens)
```json
{ "id": 12, "title": "...", "status": "lost", "statusLabel": "Perdido",
  "petName": "Rex", "petType": "dog", "petTypeLabel": "Cachorro",
  "lastSeenLocation": "...", "isActive": true, "isResolved": false,
  "createdAt": "2026-11-05T12:00:00.000Z",
  "primaryPhoto": { "url": "/uploads/x.jpg" } }
```
`primaryPhoto` segue a BR-PHOTO-002: a foto marcada como principal ou, se não houver, a primeira.
Fica `null` quando o post não tem foto.

### Post (detalhe) = PostCard +
```json
{ "description": "...", "petBreed": null, "petColor": null, "petSize": "medium", "petSizeLabel": "Médio",
  "lastSeenLat": -23.58, "lastSeenLng": -46.65,
  "contactPhone": "(11) 98765-4321", "contactEmail": null, "reward": null,
  "updatedAt": "...", "owner": { "id": 2, "name": "Maria Silva" },
  "photos": [{ "id": 1, "url": "/uploads/x.jpg", "isPrimary": true }],
  "whatsappUrl": "https://wa.me/5511987654321?text=...", "canManage": false }
```
- `whatsappUrl` (BR-CONTACT-001): `null` quando o telefone não serve para WhatsApp. A mensagem é
  `Olá! Vi seu anúncio no Pets Post:\n*{statusLabel} — {petName ou petTypeLabel}*\nGostaria de saber mais informações. 🐾`
- `canManage` (PERM-001): `true` para o dono e para o admin. O front usa para mostrar os botões de ação.
- O email do dono nunca aparece. Só aparece o `contactEmail`, que o próprio anunciante preenche.
- `lastSeenLat`/`lastSeenLng`: `null` até a geocodificação terminar (BR-GEO-001), ou se ela falhar.
  O front mostra o mapa só quando as duas existem.

## GET /api/v1/posts
- Auth: não
- Query: `status` (`lost`|`found`), `petType` (`dog`|`cat`|`bird`|`other`), `page` (≥1).
  Valores inválidos são **ignorados**, sem erro (BR-POST-003). `pet_type` também é aceito, porque
  era o nome usado nos links antigos.
- Response 200: `{ items: PostCard[], page, pageSize: 12, total, totalPages }`
- Regras: BR-POST-002 (só `isActive` e não resolvidos, mais novos primeiro), BR-POST-003

## GET /api/v1/posts/recent
- Auth: não · Response 200: `{ items: PostCard[] }` com os 12 mais recentes elegíveis (BR-POST-004)

## GET /api/v1/posts/:id
- Auth: opcional · Response 200: `{ post: Post }`
- Post **resolvido** continua acessível pelo link (BR-POST-005).
- Post **inativo**: 404 `NOT_FOUND` para visitante e para quem não é dono nem admin (PERM-002).
- `:id` que não é número inteiro positivo → 404.

## POST /api/v1/posts
- Auth: sim (401) · CSRF: sim
- Request: `createPostSchema` → `{ title, description, status, petType, lastSeenLocation, contactPhone,
  petName?, petBreed?, petColor?, petSize?, contactEmail?, reward? }`
- Response **201**: `{ post: Post }` (sem fotos e com coordenadas `null`)
- Erros: 400 `VALIDATION_ERROR` (BR-POST-001) · 401 · 403 `CSRF_INVALID`
- Depois de responder, o endereço entra na fila de geocodificação (BR-GEO-001/003).
- As fotos vão numa segunda chamada, `POST /posts/:id/photos`. Assim uma foto ruim não impede
  de salvar o anúncio (BR-PHOTO-006).

## PATCH /api/v1/posts/:id
- Auth: sim · CSRF: sim · Permissão: PERM-001
- Request: `updatePostSchema`, ou seja, qualquer subconjunto dos campos do POST, com as mesmas
  regras. Corpo vazio → 400.
- Response 200: `{ post: Post }` · Erros: 400 · 401 · 403 `FORBIDDEN` · 404
- Se `lastSeenLocation` mudou, as coordenadas viram `null` e o novo endereço entra na fila.
  Sem mudança de endereço e com coordenadas, não geocodifica de novo (BR-GEO-002).

## DELETE /api/v1/posts/:id
- Auth: sim · CSRF: sim · Permissão: PERM-001
- Response **204**. As fotos (registros) saem junto, por CASCADE (BR-POST-006), e os arquivos
  são apagados do disco depois (BR-PHOTO-007).
- Erros: 401 · 403 · 404

## POST /api/v1/posts/:id/resolve
- Auth: sim · CSRF: sim · Permissão: PERM-001
- Response 200: `{ post: Post }` com `isResolved: true`. Repetir a chamada não dá erro (idempotente).
- Regras: BR-POST-005

## POST /api/v1/posts/:id/photos
- Auth: sim · CSRF: sim (header `X-CSRF-Token`) · Permissão: PERM-001
- Request: `multipart/form-data`, campo `photos` (um ou mais arquivos). Até 8 MB no total (BR-PHOTO-003).
- Cada arquivo é processado sozinho (BR-PHOTO-004/005). Se der erro, ele entra em `rejected` e os
  outros continuam (BR-PHOTO-006).
- O que passar do limite de 6 fotos do post também vai para `rejected` (BR-PHOTO-001).
- Se o post não tinha foto, a primeira salva vira a principal (BR-PHOTO-002).
- Response **201** (ao menos uma salva) ou **200** (nenhuma salva):
  ```json
  { "post": Post,
    "rejected": [{ "name": "gato.pdf", "message": "Formato não aceito. Use PNG, JPG, GIF ou WEBP." }] }
  ```
- Erros: 400 `VALIDATION_ERROR` (nenhum arquivo, ou não é multipart) · 401 · 403 · 404 ·
  413 `PAYLOAD_TOO_LARGE`

## DELETE /api/v1/posts/:id/photos/:photoId
- Auth: sim · CSRF: sim · Permissão: PERM-001
- Remove o registro e o arquivo (BR-PHOTO-007). Se era a principal, a primeira restante vira a
  principal (BR-PHOTO-002).
- Response 200: `{ post: Post }` · Erros: 401 · 403 · 404 (post ou foto não existe, ou a foto é de outro post)

## Arquivos `/uploads`
- As fotos novas ficam em `/uploads/<uuid>.jpg`. As do Flask continuam em `/static/uploads/...` e os dois
  caminhos servem a mesma pasta, então as URLs antigas gravadas no banco funcionam.
- Cache longo (`immutable`), porque o nome é um UUID que nunca é reaproveitado. Arquivo inexistente dá 404.

## GET /api/v1/me/posts
- Auth: sim · Query: `page`
- Response 200: paginado de PostCard com **todos** os posts do usuário, inclusive inativos e
  resolvidos, mais novos primeiro.

## 403 ou 404?
Nas rotas de escrita, um post inexistente dá 404. Um post inativo de outra pessoa também dá 404,
para não revelar que ele existe (PERM-002). Um post ativo de outra pessoa dá 403 (PERM-001).

## Páginas do front (URLs do sistema antigo mantidas)
| URL | Página |
|---|---|
| `/` | home: destaque + 12 recentes |
| `/posts/` | lista com filtros (`?status=`, `?pet_type=`, `?page=`) |
| `/posts/:id` | detalhe, com Open Graph injetado pelo servidor (ADR 002) |
| `/posts/criar` | formulário de criação (`?status=lost|found` pré-seleciona, BR-POST-007) |
| `/posts/:id/editar` | formulário de edição |
| `/sobre` | sobre o projeto |

## Testes
`apps/api/integration/posts.int.js`, com um teste citando cada BR-POST e PERM.
