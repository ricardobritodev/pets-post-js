# API — CEP e geocodificação

Regras: BR-GEO-001..004 · Convenções: [conventions.md](conventions.md)

## GET /api/v1/cep/:cep
- Auth: não · Rate limit: 30/min por IP (BR-GEO-004)
- `:cep`: 8 dígitos. Máscara e outros caracteres são ignorados (`01310-100` = `01310100`).
- Consulta o ViaCEP (`https://viacep.com.br/ws/<cep>/json/`), com timeout de 5 s.
- Response 200, só com os campos que o front usa:
  ```json
  { "cep": "01310-100", "street": "Avenida Paulista", "neighborhood": "Bela Vista",
    "city": "São Paulo", "uf": "SP" }
  ```
- Erros: 400 `VALIDATION_ERROR` (não tem 8 dígitos) · 404 `NOT_FOUND` (CEP não existe) ·
  429 `RATE_LIMITED` · 502 `UPSTREAM_ERROR` (ViaCEP fora do ar ou lento)
- O endereço montado pelo front é `rua, bairro, cidade/UF`, igual ao `cep.js` do sistema antigo.

## Geocodificação (interna, sem rota)
- Cliente do Nominatim em `apps/api/src/lib/geocoder.js`, com `fetch` nativo do Node.
- Parâmetros: `format=json`, `limit=1`, `countrycodes=br`. Timeout de 5 s. User-Agent vem de
  `GEOCODER_USER_AGENT`, e o padrão identifica o projeto (BR-GEO-003).
- Fila única no processo: no máximo 1 requisição por segundo (BR-GEO-003). Os pedidos esperam a vez.
- Roda **depois** de a API responder (BR-GEO-001). Quando termina, grava `last_seen_lat`/`last_seen_lng`.
  Se der erro ou não achar o endereço, as coordenadas ficam `null` e só sai um log.
- Antes de gravar, confere se o endereço do post ainda é o mesmo. Se a pessoa editou no meio do
  caminho, o resultado antigo é descartado.
- `GEOCODER_ENABLED=false` desliga tudo (testes e desenvolvimento sem internet).
