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
