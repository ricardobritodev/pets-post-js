# Etapa 7b — Loja (vitrine de produtos dos parceiros)

Specs: [store.md](../specs/api/store.md) · BR-STORE-001..008

Vitrine, não e-commerce: produto com foto e preço, e o botão leva para a loja do parceiro.

- [ ] **L1 — Spec** `specs/api/store.md` e regras BR-STORE.
- [ ] **L2 — Banco**: migration `3_products` (`products`, `product_photos`).
- [ ] **L3 — Domain e contratos**: preço final, desconto, link de compra; `productSchema` e query da vitrine.
- [ ] **L4 — API**: vitrine pública + CRUD no admin + fotos (mesmo serviço dos anúncios).
- [ ] **L5 — Front**: `/loja`, `/loja/produto/:id`, telas do admin.
- [ ] **L6 — Header** com a organização das lojas pet (logo, busca em destaque, ações; menu embaixo), visual próprio.
- [ ] **L7 — Documentar** `doc/features/008-loja.md`.
