# ADR 005 — NLP híbrido: node-nlp local + SQL + LLM/RAG

**Status:** substituída pela [ADR 007](007-chatbot-faq-no-site.md) (2026-11-06): o chatbot virou um FAQ dentro do site.

| Necessidade | Ferramenta |
|---|---|
| Intenções fixas (menu, perdi, adotar, vet perto) | node-nlp (local, determinístico) |
| Normalizar raça/cor, stemming PT | Natural |
| Filtros e "perto de mim" | SQL via Prisma (sem IA) |
| Texto livre → rascunho de post | Anthropic SDK (saída estruturada no schema zod) |
| Busca por descrição / FAQ | LanceDB (embutido) + embeddings + LLM |
| Similaridade de fotos perdido × encontrado | TensorFlow.js (MobileNet) + LanceDB |

LangChain.js e Brain.js não são necessários neste escopo.
