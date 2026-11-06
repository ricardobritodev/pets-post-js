# todo/ — O que falta implementar

Checklist **acionável** da reescrita. Visão resumida por etapa: [`../doc/ROADMAP.md`](../doc/ROADMAP.md).
Regras citadas (`BR-*`, `PERM-*`) estão em [`../specs/domain`](../specs/domain/).

## Como usar
1. Pegue a primeira tarefa `[ ]` da etapa atual (as etapas são sequenciais).
2. Siga o fluxo SDD: **spec → contrato zod → teste (citando o BR) → código**.
3. Marque `[x]` quando todos os critérios de "Pronto quando" forem atendidos.
4. Ao fechar uma etapa: atualize `doc/ROADMAP.md` e crie `doc/features/NNN-*.md`.

## Arquivos
| Arquivo | Etapa | Tarefas |
|---|---|---|
| [00-pendencias.md](00-pendencias.md) | — | Decisões e bloqueios em aberto |
| [etapa-2-banco.md](etapa-2-banco.md) | 2 | Migrations, seeds, baseline do banco Flask |
| [etapa-3-auth.md](etapa-3-auth.md) | 3 | Sessão, CSRF, rate limit, login/cadastro |
| [etapa-4-posts.md](etapa-4-posts.md) | 4 | Pets perdidos/encontrados |
| [etapa-5-midia-geo.md](etapa-5-midia-geo.md) | 5 | Upload de fotos, geocodificação, CEP, mapa |
| [etapa-6-adocao-parceiros.md](etapa-6-adocao-parceiros.md) | 6 | Adoção e mapa de parceiros |
| [etapa-7-admin-deploy.md](etapa-7-admin-deploy.md) | 7 | Painel admin, produção, cutover |
| [etapa-7b-loja.md](etapa-7b-loja.md) | 7b | Loja: vitrine de produtos dos parceiros |
| [etapa-8-chatbot-ia.md](etapa-8-chatbot-ia.md) | 8 | Chatbot de ajuda: FAQ dentro do site |
| [transversal.md](transversal.md) | contínuo | Qualidade, CI, segurança, acessibilidade |

## Progresso
| Etapa | Status |
|---|---|
| 1 — Fundação | ✅ concluída (ver `doc/features/001-fundacao.md`) |
| 2 — Banco | ✅ concluída (ver `doc/features/002-banco.md`) |
| 3 — Autenticação | ✅ concluída (ver `doc/features/003-autenticacao.md`) |
| 4 — Posts | ✅ concluída (ver `doc/features/004-posts.md`) |
| 5 — Mídia e geo | ✅ concluída (ver `doc/features/005-midia-geo.md`) |
| 6 — Adoção e parceiros | ✅ concluída (ver `doc/features/006-adocao-parceiros.md`) |
| 7 — Admin e deploy | 🟡 admin e kit de deploy prontos; falta subir no VPS (ver `doc/features/007-admin-deploy.md`) |
| 7b — Loja (vitrine) | ✅ concluída (ver `doc/features/008-loja.md`) |
| 8 — Chatbot de ajuda (FAQ) | ✅ concluída (ver `doc/features/010-ajuda-faq.md`) |
