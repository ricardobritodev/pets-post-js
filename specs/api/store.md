# API — Loja (vitrine de produtos dos parceiros)

Regras: BR-STORE-001..008 · Permissões: PERM-003 (cadastro) · Convenções: [conventions.md](conventions.md) ·
Contratos: `packages/contracts/src/store.js`

**É uma vitrine, não um e-commerce:** o Pets Post mostra o produto com foto e preço, e o botão leva para a
loja do parceiro. Não tem carrinho, pagamento nem pedido aqui. Cada produto pertence a um parceiro do mapa
(normalmente um petshop). Quem cadastra é o admin, porque os parceiros não têm conta no site.

## Categorias (BR-STORE-002)
| valor | rótulo |
|---|---|
| `food` | Ração |
| `treats` | Petiscos |
| `toys` | Brinquedos |
| `hygiene` | Higiene e beleza |
| `health` | Farmácia e saúde |
| `accessories` | Coleiras e acessórios |
| `beds` | Camas e casinhas |

`petType`: `dog` · `cat` · `bird` · `other` · ou `null` = serve para todos.

## Objetos
### ProductCard (vitrine)
```json
{ "id": 1, "name": "Ração Premium Adulto 10 kg", "category": "food", "categoryLabel": "Ração",
  "petType": "dog", "petTypeLabel": "Cachorro",
  "priceCents": 18990, "promoPriceCents": 15990, "finalPriceCents": 15990, "discountPercent": 16,
  "inStock": true, "isFeatured": true, "primaryPhoto": { "url": "/uploads/x.jpg" },
  "partner": { "id": 3, "name": "Petshop Exemplo" } }
```
- Preço em **centavos** (inteiro), para não ter erro de arredondamento. O front formata em R$.
- `finalPriceCents` = promocional quando existe, senão o normal. `discountPercent` arredonda para baixo;
  `null` sem promoção (BR-STORE-003).
- `inStock` = estoque > 0. Produto esgotado continua na vitrine, com o aviso (BR-STORE-004).

### Product (detalhe) = ProductCard +
```json
{ "description": "...", "stock": 12, "photos": [{ "id": 1, "url": "...", "isPrimary": true }],
  "buyUrl": "https://loja.exemplo.com/produto/123", "buyChannel": "site",
  "partner": { "id": 3, "name": "...", "type": "petshop", "typeLabel": "Petshop Parceiro",
               "address": "...", "phone": "...", "website": "https://...", "whatsappUrl": "https://wa.me/..." } }
```
- **Para onde o botão leva (BR-STORE-005):** link do produto (`url`) → site do parceiro → WhatsApp do parceiro
  com a mensagem pronta ("Olá! Vi o produto *{nome}* no Pets Post e gostaria de saber mais. 🐾") → `null`
  (sem botão). `buyChannel`: `product` · `site` · `whatsapp` · `null`. Só links http/https.

## GET /api/v1/store/products
- Auth: não · Query: `q` (nome), `category`, `petType`, `partnerId`, `sort`
  (`featured` padrão · `price_asc` · `price_desc` · `newest`), `page` (24 por página). Inválidos são ignorados.
- Só produtos **ativos** de parceiros **ativos** (BR-STORE-001).
- `featured`: destaques primeiro, depois os mais novos. O preço da ordenação é o final (com promoção).
- Response: `{ items: ProductCard[], page, pageSize: 24, total, totalPages }`

## GET /api/v1/store/products/:id
- `{ product: Product }`. Inativo ou de parceiro inativo → 404 (BR-STORE-001).

## GET /api/v1/store/categories
- `{ items: [{ value, label, count }] }`: as 7 categorias, com quantos produtos visíveis cada uma tem.

## Admin (PERM-003: 401 visitante, 403 usuário comum)
| Rota | O que faz |
|---|---|
| `GET /api/v1/admin/products` | todos (inclusive inativos), busca `q`, filtros `category`, `partnerId`, `visibility`; 20 por página |
| `GET /api/v1/admin/products/:id` | `{ product }` com todos os campos |
| `POST /api/v1/admin/products` | cria (`productSchema`) → 201 `{ product }` |
| `PATCH /api/v1/admin/products/:id` | edita (subconjunto) → `{ product }` |
| `DELETE /api/v1/admin/products/:id` | exclui; fotos e arquivos saem junto → 204 |
| `POST /api/v1/admin/products/:id/photos` · `DELETE .../photos/:photoId` | fotos (até 6), mesmas regras dos anúncios (BR-PHOTO-*) |

`productSchema` (BR-STORE-006/007): `partnerId` (parceiro existente), `name` (obrigatório, 150), `description`
(até 5000), `category`, `petType?`, `priceCents` (inteiro > 0, até R$ 100.000), `promoPriceCents?` (menor que o
preço), `stock` (inteiro ≥ 0, padrão 0), `url?` (http/https), `isActive` (padrão true), `isFeatured` (padrão false).
No formulário o preço é digitado em reais ("189,90"); o front converte para centavos.

## Páginas do front
| URL | Página |
|---|---|
| `/loja` | vitrine: busca, categorias, filtro por animal, ordenação, destaques |
| `/loja/produto/:id` | detalhe com galeria, preço, parceiro e botão "Comprar na loja" (Open Graph, ADR 002) |
| `/admin/produtos` · `/admin/produtos/criar` · `/admin/produtos/:id/editar` | cadastro no painel |
