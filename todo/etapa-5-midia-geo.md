# Etapa 5 — Mídia e geolocalização

Specs: BR-PHOTO-001..006, BR-GEO-001..004

## Fotos
- [x] **T5.1 — Migration M-03**: ~~tabela única `photos`~~ *adiada: Q-002 decidida como "não por enquanto" (rollback para o Flask)*.
- [x] **T5.2 — Upload** com `multer` (memória, limite 8 MB, até 6 arquivos, filtro de extensão) — BR-PHOTO-003.
- [x] **T5.3 — Processamento** com `sharp` (BR-PHOTO-004/005): rejeitar não-imagem, limite 20 MP (`limitInputPixels`), RGB, máx. 800 px de largura, qualidade 85, remover metadados EXIF (GPS!), nome UUID.
- [x] **T5.4 — Serviço `photoService`**: adicionar (respeitando limite de 6 na edição), remover (registro + arquivo), promover principal (BR-PHOTO-002), falha parcial não derruba o post (BR-PHOTO-006).
- [x] **T5.5 — Rotas** `POST /posts/:id/photos`, `DELETE /posts/:id/photos/:photoId`; servir `/uploads` (e alias legado `/static/uploads`) com cache.
- [x] **T5.6 — Front**: drag-and-drop, preview, remover antes de enviar, marcar fotos para excluir na edição (porta de `initPhotoUpload`).
- [x] **T5.7 — Testes** com imagens fixture: PNG válido, arquivo falso `.jpg`, "decompression bomb", GIF/WebP.

## Geolocalização
- [x] **T5.8 — Cliente Nominatim** (`fetch` nativo do Node, sem Axios): `countrycodes=br`, timeout 5 s, User-Agent identificado; falha → `(null, null)` (BR-GEO-001).
- [x] **T5.9 — Fila 1 req/s** (BR-GEO-003) e geocodificar só se endereço mudou ou não há coordenadas (BR-GEO-002). Geocodificação **após** responder ao usuário.
- [x] **T5.10 — `GET /api/v1/cep/:cep`** (BR-GEO-004) via ViaCEP, rate limit 30/min.
- [x] **T5.11 — Front CEP** (porta de `cep.js`): máscara, debounce 500 ms, abortar requisição anterior, preencher endereço.
- [x] **T5.12 — Mapa no detalhe** com Leaflet via npm (porta de `map-detail.js`).
- [x] **T5.13 — Migration M-01** (`FLOAT` → `DOUBLE`): migration `2_coords_double`.

## Fechamento
- [x] **T5.14 — Documentar** `doc/features/005-midia-geo.md`.

> Concluída em 2026-11-06. Extras: `npm run geo:backfill` (posts sem coordenadas) e testes de front (`apps/web/test`).
