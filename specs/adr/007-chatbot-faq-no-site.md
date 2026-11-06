# ADR 007 — Chatbot = FAQ dentro do site (substitui as ADRs 004 e 005)

**Status:** aceita · 2026-11-06

## Contexto
O plano da Etapa 8 era um bot no Telegram (ADR 004) com NLP local, LLM pago e RAG (ADR 005). O dono do
projeto definiu outra coisa: **o chatbot é um FAQ dentro do site, com links que levam para a página certa
quando a pessoa precisa agir.**

## Decisão
- **Janela de ajuda flutuante** em todas as páginas públicas, mais a página `/ajuda` com todas as perguntas.
- **Respostas por correspondência local, sem IA paga:** a pergunta digitada é comparada com o FAQ no próprio
  navegador. A comparação ignora acentos, maiúsculas, plural e palavras vazias, e entende sinônimos
  ("achei" = "encontrei", "cão" = "cachorro"). Dá a melhor resposta e sugere perguntas parecidas.
- **Cada resposta pode trazer links:** páginas do site (ex.: `/posts/criar?status=lost`) ou o WhatsApp do Pets
  Post (BR-CONTACT-002).
- **Quando não entende:** mostra os assuntos mais procurados e o WhatsApp.
- **Conteúdo num arquivo versionado** (`packages/domain/src/faq.js`), testado: todo link interno precisa
  existir no mapa de páginas.

## Alternativas descartadas
- **Bot no Telegram:** tira a pessoa do site, e o pedido é ajuda dentro dele.
- **LLM (Claude) respondendo:** custo por mensagem e risco de resposta inventada para um conteúdo que é
  fixo e pequeno. Pode voltar no futuro como "segunda tentativa" quando o FAQ não achar resposta.
- **Editar o FAQ pelo painel admin agora:** mais tabelas e telas. Pode vir depois; o formato do arquivo já
  serve de modelo para a tabela.

## Consequências
+ Custo zero, funciona sem internet depois de carregar e não envia o que a pessoa digita para lugar nenhum.
+ Respostas sempre corretas (escritas por gente) e com o link certo.
− Só responde o que está no FAQ; perguntas novas precisam ser escritas no arquivo (deploy).
