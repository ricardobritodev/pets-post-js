# Etapa 6 — Adoção e parceiros

Specs: BR-ADOPT-001..003, BR-PARTNER-001..002

## Adoção
- [x] **T6.1 — Spec** `specs/api/adoption.md`.
- [x] **T6.2 — Contratos zod** de adoção (castrado, vacinado, requisitos do adotante).
- [x] **T6.3 — Rotas** `GET /adoption` (filtro `petType`, 12/página), `GET /adoption/:id` (PERM-002), `POST`, `PATCH`, `DELETE`, `POST /adoption/:id/adopted`.
- [x] **T6.4 — Reaproveitar** `photoService` e geocodificação da Etapa 5 (sem duplicar código como no Flask).
- [x] **T6.5 — Front**: lista, detalhe (badges castrado/vacinado, requisitos), formulário, botão "marcar como adotado".
- [x] **T6.6 — Testes** de todos os BR-ADOPT.

## Parceiros
- [x] **T6.7 — `GET /api/v1/partners`** (BR-PARTNER-001): só ativos com coordenadas; filtro opcional por tipo.
- [x] **T6.8 — Página do mapa** (porta de `map-partners.js`): marcadores por tipo, legenda/filtro, popup com contato e WhatsApp.
- [x] **T6.9 — Busca "perto de mim"**: `GET /partners?lat&lng&radiusKm` com Haversine (base para o bot na Etapa 8).

## Fechamento
- [x] **T6.10 — Documentar** `doc/features/006-adocao-parceiros.md`.

> Concluída em 2026-11-06. Extras: Open Graph na adoção, `/me/adoption`, e o front de posts reescrito em cima das peças compartilhadas.
