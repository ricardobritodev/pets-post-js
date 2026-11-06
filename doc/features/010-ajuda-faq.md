# 010 — Chatbot de ajuda: FAQ dentro do site

**Etapa:** 8 · **Data:** 2026-11-06
**Specs:** [specs/site/faq.md](../../specs/site/faq.md) · [rules.md](../../specs/domain/rules.md) (BR-FAQ-001..006) ·
ADR [007](../../specs/adr/007-chatbot-faq-no-site.md), que substitui as ADRs 004/005 (Telegram + IA)

## O que foi pedido
"O chatbot tem que ser um FAQ dentro do site, com os links de direcionamento caso precise."

## O que foi entregue
- **Botão "Ajuda"** (laranja), empilhado acima do botão do WhatsApp no canto inferior direito, em todas as
  páginas públicas (não aparece no admin). Abre uma janela de conversa:
  - saudação com os 6 assuntos mais procurados;
  - a pessoa digita a dúvida e recebe a resposta do FAQ, com **botões que levam para a página certa**
    ("Publicar anúncio de perdido", "Ver pets para adoção", "Abrir o mapa de parceiros"…) ou para o WhatsApp do
    Pets Post;
  - até 3 "Perguntas relacionadas" clicáveis;
  - quando não entende: "Não encontrei…", os assuntos mais procurados e o botão do WhatsApp;
  - "Recomeçar" e fechar (também com Esc). O foco vai para o campo ao abrir e volta para o botão ao fechar.
- **Página `/ajuda`** com as 20 perguntas por assunto (abre e fecha com `<details>`). A busca usa o mesmo "cérebro"
  do chat, e cada pergunta tem âncora: `/ajuda#esqueci-senha` abre direto. O rodapé ganhou o link "Ajuda".
- **O "cérebro"** fica em `packages/domain/src/faq.js` e roda no navegador:
  - ignora acento, maiúscula, pontuação, plural e palavras vazias ("como", "o", "de"…);
  - entende sinônimos ("achei" = "encontrei", "cão" = "cachorro", "zap" = "whatsapp");
  - entende conjugações ("apago", "apaguei" → excluir);
  - palavras-chave valem mais que os exemplos, e a resposta só aparece acima de uma nota mínima.
- **Privacidade:** o que a pessoa digita não sai do navegador, e a conversa fica só na aba (`sessionStorage`).
- **Conteúdo** em `packages/domain/src/faq-data.js`: 20 perguntas, escritas para o que o site faz hoje.
  Exemplo: como não existe "esqueci minha senha", a resposta manda falar com a equipe.

## Como mudar o FAQ
Edite `packages/domain/src/faq-data.js`: pergunta, resposta, exemplos de como as pessoas perguntam, palavras-chave
e links. Rode `npm test`. Os testes conferem que:
- cada pergunta é achada pelo próprio texto;
- as perguntas de exemplo continuam caindo na resposta certa;
- todo link interno existe no site (BR-FAQ-005).

## Como testar
```bash
npm test                    # 158 testes unitários (domain 59, com 26 perguntas reais; web 8)
npm run dev                 # botão "Ajuda" em qualquer página; http://localhost:5173/ajuda
```

## Verificação no navegador
Em modo produção, com Chrome headless, desktop e celular (390 px):
- pergunta respondida com 2 links;
- pergunta sem sentido caindo no "Não encontrei", com o WhatsApp;
- Esc fecha e devolve o foco;
- `/ajuda#esqueci-senha` abre a pergunta certa.

Isso achou um problema: com o botão do WhatsApp na tela, a janela cobria o próprio botão "Ajuda". Agora a
janela calcula onde abrir a partir da posição do botão.

## Decisões
- **Sem IA paga:** custo zero, respostas sempre corretas e com o link certo, e nada enviado a terceiros.
- **O plano antigo** (bot no Telegram, LLM, RAG, comparação de fotos) foi substituído pela ADR 007.

## Pendências (se fizer falta)
- Editar o FAQ pelo painel admin.
- Registrar, sem dados pessoais, as perguntas que ficaram sem resposta, para melhorar o FAQ.
- "Esqueci minha senha" de verdade (hoje a resposta manda para o WhatsApp).
