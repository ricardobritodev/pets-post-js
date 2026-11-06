# Etapa 7b — Loja (vitrine de produtos dos parceiros)

Specs: [store.md](../specs/api/store.md) · BR-STORE-001..008

Vitrine, não e-commerce: produto com foto e preço, e o botão leva para a loja do parceiro.

- [x] **L1 — Spec** `specs/api/store.md` e regras BR-STORE.
- [x] **L2 — Banco**: migration `3_products` (`products`, `product_photos`).
- [x] **L3 — Domain e contratos**: preço final, desconto, link de compra; `productSchema` e query da vitrine.
- [x] **L4 — API**: vitrine pública + CRUD no admin + fotos (mesmo serviço dos anúncios).
- [x] **L5 — Front**: `/loja`, `/loja/produto/:id`, telas do admin.
- [x] **L6 — Header** com a organização das lojas pet (logo, busca em destaque, ações; menu embaixo), visual próprio.
- [x] **L7 — Documentar** `doc/features/008-loja.md`.

> Concluída em 2026-11-06 (doc/features/008-loja.md).

## Importar de um link (pedido de 2026-11-06)
- [x] **I1 — Spec**: BR-STORE-009..011 e rotas de importação em `specs/api/store.md`.
- [x] **I2 — Banco**: `products.price_checked_at` (migration `4_price_checked_at`).
- [x] **I3 — Leitor** (JSON-LD/Open Graph) + busca segura (anti-SSRF) + sugestão de categoria/pet, com testes.
- [x] **I4 — API**: importar rascunho, baixar fotos do link, "Atualizar do link".
- [x] **I5 — Front**: "Importar de um link" no formulário do admin; "Preço consultado em…" na vitrine.
- [x] **I6 — Documentar** em `doc/features/008-loja.md`.
- [ ] *(depois, se quiser)* Botão no navegador "Enviar para o Pets Post" para sites que bloqueiam leitura automática.

## Loja automática e "Vendido e entregue por" (pedido de 2026-11-06)
- [x] **V1 — Spec**: BR-STORE-012/013; BR-STORE-009 (variação do link) e BR-STORE-010 (User-Agent ASCII).
- [x] **V2 — Banco**: `products.seller_name` (migration `5_product_seller`).
- [x] **V3 — Leitor**: variação pelo link e vendedor do `offers.seller`; User-Agent sem acento (fotos da VTEX).
- [x] **V4 — API**: parceiro escolhido pelo domínio na importação; `soldBy` na vitrine; `sellerName` no admin.
- [x] **V5 — Front**: parceiro e vendedor preenchidos na importação; "Vendido e entregue por" no card e no produto.
- [x] **V6 — Fotos da VTEX**: uma leitura por foto (guardada 15 min), para no primeiro 429 com aviso, miniatura vira 1200 px.
- [x] **V7 — Documentar** em `doc/features/008-loja.md`.
- [ ] *(opcional)* Admin baixar as fotos pelo próprio navegador quando o site limita robôs (precisa liberar o CDN no CSP).

## Importação mais tolerante (pedido de 2026-11-06)
- [x] **T1 — Levantamento** de 100 lojas pet: formatos reais de JSON-LD, microdados, VTEX antiga, bloqueios.
- [x] **T2 — Spec**: BR-STORE-014.
- [x] **T3 — Leitor**: JSON-LD tolerante, Product aninhado, blocos repetidos, `skuJson` da VTEX, microdados, nome limpo, fotos sem repetir, página sem produto recusada.
- [x] **T4 — Busca**: página grande lida até 3 MB, charset do `<meta>`, raízes do sistema e mensagem de certificado.
- [x] **T5 — Documentar** em `doc/features/008-loja.md`.
- [x] **T6 — Parceiro sem perguntar**: busca pelo nome (loja/domínio) e "Nova loja" cadastrada ao salvar (BR-STORE-012).
