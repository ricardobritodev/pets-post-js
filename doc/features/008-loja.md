# 008 — Loja (vitrine de produtos dos parceiros)

**Etapa:** 7b · **Data:** 2026-11-06
**Specs:** [store.md](../../specs/api/store.md) · [rules.md](../../specs/domain/rules.md) (BR-STORE-001..008) ·
ADR [002](../../specs/adr/002-vite-mpa-og-injection.md) (prévia no WhatsApp) · ADR [006](../../specs/adr/006-fotos-em-disco.md) (fotos)

## O que foi pedido
- **Vitrine, não e-commerce:** produto com foto e preço, e um botão que leva para a loja do parceiro.
- **Cada produto pertence a um parceiro do mapa.** Quem cadastra é o admin.
- **Campos:** nome, descrição, categoria, tipo de animal, preço, preço promocional, estoque, até 6 fotos,
  ativo/inativo e destaque.
- **Header no jeito das lojas pet** (inspirado na organização do header da Petz), sem copiar logo, cores nem textos
  da marca. O visual continua o do Pets Post, em laranja.

## O que foi entregue

### Banco
- **Migration `3_products`:** tabelas `products` e `product_photos`, novas da v2.
- **Preço em centavos (inteiro):** para não ter erro de arredondamento.
- **Parceiro com produtos não pode ser excluído** (FK `RESTRICT` e 409 na API, BR-STORE-008). Para tirar um
  parceiro do mapa, basta desativar.

### API
| Rota | O que faz |
|---|---|
| `GET /store/products` | vitrine: busca, categoria, animal (o filtro inclui os produtos "para todos os pets"), parceiro e ordenação por destaque, preço ou novidade. 24 por página |
| `GET /store/products/:id` | detalhe com o link de compra pronto (`buyUrl` / `buyChannel`) |
| `GET /store/categories` | as 7 categorias com a contagem de produtos visíveis |
| `/admin/products` (+ `/photos`) | cadastro completo no admin, com fotos pelo mesmo serviço dos anúncios |

- **Só aparece na vitrine** produto ativo de parceiro ativo (BR-STORE-001).
- **Ordenação por preço:** usa o preço **final**, já com a promoção. A promoção só vale se for menor que o preço;
  o desconto exibido arredonda para baixo, para nunca anunciar mais desconto do que dá.
- **Botão de compra (BR-STORE-005):** link do produto → site do parceiro → WhatsApp do parceiro, com a
  mensagem "Vi o produto *X* no Pets Post…". Só links `http`/`https`.
- **Estoque:** só informativo. Produto esgotado continua na vitrine com o selo "Esgotado".
- **Prévia no WhatsApp:** `/loja/produto/:id` recebe Open Graph com nome, preço final, parceiro e foto.

### Front
| Página | Destaques |
|---|---|
| `/loja` | atalhos de categoria com contagem, filtros (busca, categoria, pet, ordenação) com estado na URL, cards com "de/por", desconto, "Destaque" e "Esgotado" |
| `/loja/produto/:id` | galeria, preço grande com a economia, estoque, botão "Ir para a loja do parceiro" ou "Comprar pelo WhatsApp", card "Vendido por", "Mais de {parceiro}" e o aviso de que a compra é feita com o parceiro |
| `/admin/produtos` | lista com foto, preço, estoque e situação ("Parceiro inativo" quando é o caso) |
| formulário | preço digitado em reais ("189,90"), convertido para centavos; parceiro, categoria, pet, link, ativo, destaque e fotos |

**Header novo (todas as páginas):**
- **Em cima:** logo, uma **busca grande da loja** no meio, e "Publicar anúncio" e a conta à direita.
- **Embaixo, numa faixa laranja:** o menu (Início, Perdidos e encontrados, Adoção, Loja, Mapa de parceiros,
  Sobre), cada link com ícone.
- **No celular:** busca, menu e conta ficam dentro do botão ☰.

**Seed de dev:** `npm run db:seed` agora cria 10 produtos de exemplo, só nos parceiros **fictícios**, com
nomes genéricos e sem marca, para não parecer anúncio de loja real.

## Como testar
```bash
npm test                    # 149 testes unitários (contracts 33, db 6, domain 54, api 49, web 7)
npm run test:integration    # 132 testes com MySQL (loja 11)
npm run db:seed             # produtos de exemplo
npm run dev                 # http://localhost:5173/loja · /admin/produtos (admin@petpost.com / Admin@123)
```

## Verificação no navegador
Em modo produção, com Chrome headless:
- vitrine com os 10 produtos, busca "ração" com ordem de menor preço, página do produto e prévia do WhatsApp;
- header no desktop e no celular (390 px);
- cadastro de ponta a ponta pelo admin: preço "49,90" e promoção "39,90" viraram 4990/3990 centavos, com 20% de
  desconto, e a foto e o parceiro entraram certos (o produto de teste foi apagado depois).

Nenhuma violação de CSP.

## Decisões
- **O admin cadastra os produtos:** os parceiros não têm conta. Se um dia tiverem, o modelo já liga o produto ao parceiro.
- **Preço em centavos** no banco e na API. O front formata em R$.
- **Ordenação por preço final** feita na API (a vitrine tem poucas centenas de produtos). Se crescer muito, vale
  guardar o preço final numa coluna.
- **O filtro por animal inclui os produtos "para todos os pets"** (uma bolinha aparece em cachorro e em gato).

## Pendências
- Os parceiros reais do mapa ainda não têm produtos: é preciso cadastrar pelo admin.
- Carrinho e pagamento ficam fora de propósito (é vitrine).
