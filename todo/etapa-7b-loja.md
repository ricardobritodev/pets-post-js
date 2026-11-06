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
