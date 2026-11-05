# Etapa 5 — Mídia e geolocalização

Specs: BR-PHOTO-001..006, BR-GEO-001..004

## Fotos
- [ ] **T5.1 — Migration M-03** (se Q-002 = sim): tabela única `photos` com `ownerType`/FKs opcionais; migrar dados de `adoption_photos`.
- [ ] **T5.2 — Upload** com `multer` (memória, limite 8 MB, até 6 arquivos, filtro de extensão) — BR-PHOTO-003.
- [ ] **T5.3 — Processamento** com `sharp` (BR-PHOTO-004/005): rejeitar não-imagem, limite 20 MP (`limitInputPixels`), RGB, máx. 800 px de largura, qualidade 85, remover metadados EXIF (GPS!), nome UUID.
- [ ] **T5.4 — Serviço `photoService`**: adicionar (respeitando limite de 6 na edição), remover (registro + arquivo), promover principal (BR-PHOTO-002), falha parcial não derruba o post (BR-PHOTO-006).
- [ ] **T5.5 — Rotas** `POST /posts/:id/photos`, `DELETE /posts/:id/photos/:photoId`; servir `/uploads` (e alias legado `/static/uploads`) com cache.
- [ ] **T5.6 — Front**: drag-and-drop, preview, remover antes de enviar, marcar fotos para excluir na edição (porta de `initPhotoUpload`).
- [ ] **T5.7 — Testes** com imagens fixture: PNG válido, arquivo falso `.jpg`, "decompression bomb", GIF/WebP.

## Geolocalização
- [ ] **T5.8 — Cliente Nominatim** (Axios): `countrycodes=br`, timeout 5 s, User-Agent identificado; falha → `(null, null)` (BR-GEO-001).
- [ ] **T5.9 — Fila 1 req/s** (BR-GEO-003) e geocodificar só se endereço mudou ou não há coordenadas (BR-GEO-002). Geocodificação **após** responder ao usuário.
- [ ] **T5.10 — `GET /api/v1/cep/:cep`** (BR-GEO-004) via ViaCEP, rate limit 30/min.
- [ ] **T5.11 — Front CEP** (porta de `cep.js`): máscara, debounce 500 ms, abortar requisição anterior, preencher endereço.
- [ ] **T5.12 — Mapa no detalhe** com Leaflet via npm (porta de `map-detail.js`).
- [ ] **T5.13 — Migration M-01** (`FLOAT` → `DOUBLE`).

## Fechamento
- [ ] **T5.14 — Documentar** `doc/features/005-midia-geo.md`.
