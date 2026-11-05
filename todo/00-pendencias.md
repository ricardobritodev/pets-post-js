# Pendências e decisões em aberto

## Bloqueios
- [x] **P-01 — Instalar MySQL local** *(2026-11-05: MySQL 26.10 via Homebrew)* (`brew install mysql && brew services start mysql`).
  Bloqueia: Etapa 2 em diante (testes de integração, migrations).
- [x] **P-02 — Hash `scrypt:` real.** *(2026-11-05: resolvido com vetores do Werkzeug 3.1.3 real em vez de um hash de produção; ver doc/features/002)* Obter o `password_hash` de uma conta
  de teste + a senha, e adicionar como vetor em `packages/domain/test/password.test.js`.
  Fecha a validação da ADR 003.

## Decisões de produto
- [ ] **Q-001 — Limite de fotos: 5 ou 6?** Proposta: 6 (é o que roda em produção).
  Ao decidir: atualizar `BR-PHOTO-001` e `PHOTO_POLICY.maxPerPost`.
- [ ] **Q-002 — Unificar `photos` + `adoption_photos`?** Proposta: sim, na Etapa 5 (migration M-03).
- [ ] **Q-003 — Reaproveitar o banco de produção ou começar banco novo e importar?**
  Proposta: reaproveitar. Procedimento pronto e testado em banco simulado (`npm run db:baseline`);
  falta testar num dump real.
- [ ] **Q-004 — Hospedagem da v2** (mesmo servidor/Nginx do Flask?). Afeta Etapa 7.
- [ ] **Q-005 — Uploads: continuar em disco ou ir para S3/R2?** Proposta: disco na
  paridade, nuvem depois.

## Dívida técnica conhecida
- [ ] **D-01 —** `npm audit`: 3 alertas *high* em `deepmerge-ts` (CLI do Prisma 6, só dev).
  Reavaliar ao migrar para Prisma 7.
- [x] **D-02 —** Telas do front ainda são placeholder. *(2026-11-05: home, posts, detalhe, formulário, sobre, login e cadastro prontos; faltam adoção, mapa e admin)*
