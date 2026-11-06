# Etapa 8 — Chatbot de ajuda (FAQ dentro do site)

Specs: [specs/site/faq.md](../specs/site/faq.md) · [ADR 007](../specs/adr/007-chatbot-faq-no-site.md) (substitui as ADRs 004 e 005)

> Mudança de 2026-11-06: o chatbot não é mais um bot no Telegram com IA. É um FAQ dentro do site, com
> links que levam para a página certa.

- [x] **F1 — Spec** `specs/site/faq.md`, regras BR-FAQ e ADR 007.
- [ ] **F2 — Conteúdo e correspondência** em `packages/domain/src/faq.js` (normalização, sinônimos, nota, relacionadas) + testes.
- [ ] **F3 — Front**: janela de ajuda flutuante (acima do botão do WhatsApp), página `/ajuda`, link no rodapé.
- [ ] **F4 — Documentar** `doc/features/010-ajuda-faq.md`.

## Depois, se fizer falta
- Editar o FAQ pelo painel admin (tabela `faq_entries`).
- Registrar (sem dados pessoais) as perguntas sem resposta, para melhorar o FAQ.
- LLM como segunda tentativa quando o FAQ não achar resposta.
