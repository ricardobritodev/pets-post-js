# Etapa 8+ — Chatbot e IA

Specs: [ADR 004](../specs/adr/004-telegram-primeiro.md) · [ADR 005](../specs/adr/005-nlp-hibrido-rag.md)
Pré-requisito: API completa (Etapas 3–6). O bot é **cliente da API**, nunca acessa o banco direto.

## 8.1 — Bot Telegram com NLP local
- [ ] **T8.1 — Specs** `specs/bot/intents.md` e `specs/bot/conversations.md` (máquinas de estado).
- [ ] **T8.2 — `apps/bot`** com grammY; token via `.env`; processo separado.
- [ ] **T8.3 — Autenticação de serviço** bot → API (token com escopo limitado).
- [ ] **T8.4 — Classificador** node-nlp atrás de uma interface `IntentClassifier`: menu, perdi, encontrei, adotar, vet/petshop perto, ajuda, cancelar (~20 frases PT-BR cada).
- [ ] **T8.5 — Normalização** com Natural: stemming PT, fuzzy match de raça/cor → enums.
- [ ] **T8.6 — Fluxos determinísticos**: buscar posts (filtros), parceiros perto (localização do Telegram → T6.9), adoção.
- [ ] **T8.7 — Fluxo "relatar pet"** passo a passo (wizard) com confirmação antes de publicar.
- [ ] **T8.8 — LGPD**: consentimento ao publicar pelo bot; nunca expor telefone fora do link `wa.me` já público.

## 8.2 — LLM e RAG
- [ ] **T8.9 — Extração estruturada**: texto livre → rascunho de post via Anthropic SDK (saída validada pelo `createPostSchema`).
- [ ] **T8.10 — Indexação LanceDB**: posts ativos + FAQ (`specs/bot/rag.md`); reindexar ao criar/editar/resolver.
- [ ] **T8.11 — Embeddings** (OpenAI SDK) e busca por descrição ("gato cinza de olho verde na Paulista").
- [ ] **T8.12 — Roteador híbrido**: confiança ≥ 0.8 → handler local; senão → RAG + LLM citando posts reais.
- [ ] **T8.13 — Limites**: custo por usuário/dia, timeout, fallback quando o LLM falhar.

## 8.3 — Similaridade de fotos
- [ ] **T8.14 — Embeddings de imagem** com TensorFlow.js (MobileNet) no upload.
- [ ] **T8.15 — Match perdido × encontrado**: ao publicar "encontrado", sugerir "perdidos" parecidos e próximos.

## 8.4 — Experimental
- [ ] **T8.16 — Baileys (WhatsApp)** apenas com número dedicado, ciente do risco de banimento.

## Fechamento
- [ ] **T8.17 — Documentar** `doc/features/008-chatbot.md`.
