# API — Adoção

Regras: BR-ADOPT-001..004, BR-PHOTO-001..007, BR-GEO-001/002, BR-CONTACT-001 · Permissões: PERM-001, PERM-002 ·
Convenções: [conventions.md](conventions.md) · Contratos: `packages/contracts/src/adoption.js`

Mesmo desenho das rotas de [posts](posts.md). O código de fotos, geocodificação e permissão é o mesmo
(no Flask era copiado e colado).

## Objetos

### AdoptionCard (listagens)
```json
{ "id": 3, "title": "...", "petName": "Mel", "petType": "cat", "petTypeLabel": "Gato",
  "petSize": "small", "petSizeLabel": "Pequeno", "isNeutered": true, "isVaccinated": true,
  "location": "Pinheiros, São Paulo, SP", "isActive": true, "isAdopted": false,
  "createdAt": "2026-11-06T12:00:00.000Z", "primaryPhoto": { "url": "/uploads/x.jpg" } }
```

### Adoption (detalhe) = AdoptionCard +
```json
{ "description": "...", "petBreed": null, "petColor": null, "adopterRequirements": "Casa com tela",
  "locationLat": -23.56, "locationLng": -46.69,
  "contactPhone": "(11) 98765-4321", "contactEmail": null,
  "updatedAt": "...", "owner": { "id": 2, "name": "Maria Silva" },
  "photos": [{ "id": 1, "url": "/uploads/x.jpg", "isPrimary": true }],
  "whatsappUrl": "https://wa.me/55...?text=...", "canManage": false }
```
- Mensagem do WhatsApp: `Olá! Vi no Pets Post que *{petName ou petTypeLabel}* está para adoção.\nGostaria de saber mais. 🐾`
  (o Flask não tinha link de WhatsApp na adoção; é a mesma ideia dos posts).

## GET /api/v1/adoption
- Auth: não · Query: `petType` (ou `pet_type`, dos links antigos), `page`. Valor inválido é ignorado.
- Response 200: `{ items: AdoptionCard[], page, pageSize: 12, total, totalPages }`
- Regras: BR-ADOPT-002 (só ativos e não adotados, mais novos primeiro)

## GET /api/v1/adoption/:id
- Auth: opcional · Response 200: `{ adoption: Adoption }`
- **Adotado** continua acessível pelo link (BR-ADOPT-003). **Inativo**: 404 para quem não é dono nem admin (PERM-002).

## POST /api/v1/adoption
- Auth: sim · CSRF: sim · Request: `createAdoptionSchema` → `{ title, description, petType, location, contactPhone,
  petName?, petBreed?, petColor?, petSize?, isNeutered?, isVaccinated?, adopterRequirements?, contactEmail? }`
- Response **201**: `{ adoption: Adoption }` · Erros: 400 (BR-ADOPT-001) · 401 · 403 `CSRF_INVALID`
- Depois de responder, `location` entra na fila de geocodificação (BR-GEO-001).

## PATCH /api/v1/adoption/:id
- Auth: sim · CSRF: sim · Permissão: PERM-001 · Request: subconjunto do POST (vazio → 400)
- Response 200: `{ adoption: Adoption }` · Erros: 400 · 401 · 403 · 404
- Endereço novo apaga as coordenadas e geocodifica de novo (BR-GEO-002).

## DELETE /api/v1/adoption/:id
- Auth: sim · CSRF: sim · Permissão: PERM-001 · Response **204**. Fotos e arquivos saem junto (BR-PHOTO-007).

## POST /api/v1/adoption/:id/adopted
- Auth: sim · CSRF: sim · Permissão: PERM-001 · Response 200: `{ adoption: Adoption }` com `isAdopted: true`.
  Repetir não dá erro. Regras: BR-ADOPT-003

## POST /api/v1/adoption/:id/photos · DELETE /api/v1/adoption/:id/photos/:photoId
- Iguais às rotas de fotos dos posts (mesmas regras, limites e respostas), com `{ adoption, rejected }`
  e `{ adoption }`. Tabela `adoption_photos`.

## GET /api/v1/me/adoption
- Auth: sim · Query: `page` · Todos os anúncios de adoção do usuário, inclusive inativos e adotados.

## 403 ou 404?
Igual aos posts: inexistente ou inativo de outra pessoa → 404; ativo de outra pessoa → 403.

## Páginas do front (URLs do sistema antigo)
| URL | Página |
|---|---|
| `/adocao/` | lista com filtro por tipo (`?pet_type=`, `?page=`) |
| `/adocao/:id` | detalhe, com Open Graph injetado pelo servidor (ADR 002) |
| `/adocao/criar` | formulário de criação |
| `/adocao/:id/editar` | formulário de edição |
