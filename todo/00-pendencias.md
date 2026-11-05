# Pendências e decisões em aberto

## Bloqueios
- [ ] **P-01 — Instalar MySQL local** (`brew install mysql && brew services start mysql`).
  Bloqueia: Etapa 2 em diante (testes de integração, migrations).
- [ ] **P-02 — Hash `scrypt:` real de produção.** Obter o `password_hash` de uma conta
  de teste + a senha, e adicionar como vetor em `packages/domain/test/password.test.js`.
  Fecha a validação da ADR 003.

## Decisões de produto
- [ ] **Q-001 — Limite de fotos: 5 ou 6?** Proposta: 6 (é o que roda em produção).
  Ao decidir: atualizar `BR-PHOTO-001` e `PHOTO_POLICY.maxPerPost`.
- [ ] **Q-002 — Unificar `photos` + `adoption_photos`?** Proposta: sim, na Etapa 5 (migration M-03).
- [ ] **Q-003 — Reaproveitar o banco de produção ou começar banco novo e importar?**
  Proposta: reaproveitar (baseline `0_init` marcada como aplicada).
- [ ] **Q-004 — Hospedagem da v2** (mesmo servidor/Nginx do Flask?). Afeta Etapa 7.
- [ ] **Q-005 — Uploads: continuar em disco ou ir para S3/R2?** Proposta: disco na
  paridade, nuvem depois.

## Dívida técnica conhecida
- [ ] **D-01 —** `npm audit`: 3 alertas *high* em `deepmerge-ts` (CLI do Prisma 6, só dev).
  Reavaliar ao migrar para Prisma 7.
- [ ] **D-02 —** Telas do front ainda são placeholder (só a home de status existe).
