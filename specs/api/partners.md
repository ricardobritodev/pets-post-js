# API — Parceiros (mapa)

Regras: BR-PARTNER-001, BR-PARTNER-003, BR-CONTACT-001 · Convenções: [conventions.md](conventions.md) ·
Contratos: `packages/contracts/src/partners.js`

O cadastro de parceiros (BR-PARTNER-002, só admin) fica no painel da Etapa 7. Os dados vêm do seed
`npm run db:seed:partners` (30 parceiros reais de SP).

## Objeto Partner
```json
{ "id": 1, "name": "...", "description": null, "type": "vet_clinic", "typeLabel": "Clínica Veterinária",
  "address": "Rua X, 100, São Paulo, SP", "lat": -23.56, "lng": -46.65,
  "phone": "(11) 3333-4444", "email": null, "website": "https://...",
  "whatsappUrl": "https://wa.me/55...?text=...", "distanceKm": 1.8 }
```
- `website` só sai se for `http://` ou `https://`; qualquer outra coisa vira `null` (proteção contra
  `javascript:` vindo do banco antigo).
- `whatsappUrl`: `null` quando o telefone não serve para WhatsApp (fixo sem 9, 0800...). Mensagem:
  `Olá! Encontrei vocês no mapa do Pets Post e gostaria de mais informações. 🐾`
- `distanceKm` só aparece na busca "perto de mim", com 1 casa decimal.

## GET /api/v1/partners
- Auth: não
- Query:
  - `type` (`foster_home`|`petshop`|`vet_clinic`): filtro opcional; inválido é ignorado.
  - `lat`, `lng`, `radiusKm`: busca "perto de mim" (BR-PARTNER-003). `lat` e `lng` vão juntos; `radiusKm`
    padrão 10, mínimo 1, máximo 100. Coordenada fora do mapa → 400.
- Response 200: `{ items: Partner[] }` (sem paginação; são poucos).
  - Sem `lat`/`lng`: ordem alfabética.
  - Com `lat`/`lng`: só os que estão dentro do raio, do mais perto para o mais longe.
- Regras: BR-PARTNER-001 (só ativos **com** coordenadas)
- O navegador pode guardar a resposta por 5 minutos (`Cache-Control: public, max-age=300`).

## Página do front
| URL | Página |
|---|---|
| `/mapa` | mapa de parceiros: marcadores por tipo, filtro, "Minha localização" e lista dos mais próximos |
