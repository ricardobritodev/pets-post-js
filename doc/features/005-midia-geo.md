# 005 — Fotos, CEP, geocodificação e mapa

**Etapa:** 5 · **Data:** 2026-11-06
**Specs:** [posts.md](../../specs/api/posts.md) (rotas de fotos) · [geo.md](../../specs/api/geo.md) ·
[rules.md](../../specs/domain/rules.md) (BR-PHOTO-001..007, BR-GEO-001..004) · ADR [006](../../specs/adr/006-fotos-em-disco.md)

## O que foi entregue

### Fotos
| Rota | O que faz |
|---|---|
| `POST /posts/:id/photos` | recebe as fotos (multipart, campo `photos`), re-codifica e salva. Responde `{ post, rejected }` |
| `DELETE /posts/:id/photos/:photoId` | remove o registro **e** o arquivo; se era a principal, a próxima vira principal |
| `DELETE /posts/:id` | agora também apaga os arquivos das fotos |
| `/uploads/*` e `/static/uploads/*` | servem a pasta de fotos com cache de 1 ano. O segundo caminho é o do Flask, ainda gravado nas fotos antigas |

- **Processamento com `sharp`** (`apps/api/src/lib/images.js`), porta do `upload.py`: o conteúdo decide se é
  imagem (um `.jpg` que é texto é recusado, assim como SVG); acima de 20 MP é recusado antes de decodificar;
  aplica a rotação do EXIF e **apaga todos os metadados**, porque o EXIF pode ter o GPS de quem tirou a foto;
  sai em JPEG de até 800 px de largura, qualidade 85, com nome UUID.
- **Uma foto ruim não derruba as outras** (BR-PHOTO-006): cada arquivo é processado sozinho e o que falhar vai
  para `rejected` com o motivo. O que passar de 6 fotos também.
- **Limite de 8 MB** conferido pelo `Content-Length` antes de ler qualquer byte (413 acima disso).
  Limite de 20 envios/min por IP, porque re-codificar imagem gasta CPU.
- **Storage** (`apps/api/src/lib/storage.js`): disco, atrás de `save`/`remove`/`urlFor` (ADR 006). Trocar
  por S3/R2 depois é escrever outra implementação.
- O serviço de fotos é genérico (tabela e FK por parâmetro). A adoção (Etapa 6) usa o mesmo código.

### Geocodificação e CEP
- **Nominatim** (`apps/api/src/lib/geocoder.js`) com `fetch` nativo: `countrycodes=br`, timeout de 5 s,
  User-Agent identificado e **fila de 1 requisição por segundo** (o Flask não tinha fila).
- **Roda depois de responder**: criar ou editar um post não espera o Nominatim. Quando o resultado
  chega, só é gravado se o endereço do post ainda for o mesmo, porque a pessoa pode ter editado no meio do caminho.
- **Só geocodifica de novo se o endereço mudou ou faltam coordenadas** (BR-GEO-002; o Flask geocodificava a
  cada edição). Endereço novo apaga as coordenadas antigas na hora.
- **`GET /api/v1/cep/:cep`** via ViaCEP: devolve `{ cep, street, neighborhood, city, uf }`, com 400/404/502 e
  30 req/min por IP. O navegador guarda a resposta por 1 dia.
- **Migration `2_coords_double` (M-01):** coordenadas de `FLOAT` para `DOUBLE`. O teste do baseline confere
  que nenhuma coordenada antiga mudou (comparando na precisão do FLOAT).
- **`npm run geo:backfill -w @petspost/api`** (com `-- --apply`): geocodifica os posts ativos sem coordenadas
  (posts do seed, ou antigos do Flask em que a geocodificação falhou).

### Front
| Onde | O que mudou |
|---|---|
| Formulário | seletor de fotos (arrastar ou clicar, prévia, tirar antes de enviar, limite de 6, aviso de formato e tamanho); na edição, marcar fotos salvas para remover, com "desfazer"; campo CEP que preenche o endereço (máscara, espera 500 ms, cancela a consulta anterior) |
| Envio | salva o anúncio e depois manda as fotos **uma por requisição** ("Enviando foto 2 de 4…"). Se alguma falhar, o anúncio continua salvo e aparece um aviso com o motivo |
| Detalhe | card "Localização" com mapa Leaflet (via npm). O Leaflet é baixado **só** quando o post tem coordenadas (arquivo separado, ~49 KB gzip) |

- O CSP do helmet ganhou só o necessário: `img-src` com `blob:` (prévia das fotos) e
  `https://tile.openstreetmap.org` (mapa). Continua sem script inline nem de fora.
- O popup do mapa recebe o endereço como nó de texto, porque `bindPopup` com string vira `innerHTML`.

## Como testar
```bash
npm test                    # 115 testes unitários (contracts 18, db 6, domain 45, api 43, web 3)
npm run test:integration    # 91 testes com MySQL (fotos 12, geo 11)
npm run geo:backfill -w @petspost/api -- --apply   # coordenadas para os posts do seed
npm run dev                 # http://localhost:5173 → editar um post → fotos e CEP
```
Nos testes, o Nominatim e o ViaCEP são falsos (sem rede) e as fotos vão para uma pasta temporária.
As imagens de teste (PNG válido, `.jpg` falso, "decompression bomb" de 25 MP, GIF animado, JPEG com EXIF)
são geradas no próprio teste, sem binários no repositório.

## Verificação no navegador
Em modo produção (Express servindo o build), com Chrome headless:
- detalhe com foto, miniaturas e mapa do OpenStreetMap carregando sob o CSP;
- edição: CEP `01310-100` preencheu "Avenida Paulista, Bela Vista, São Paulo/SP"; PDF recusado com aviso;
  foto salva marcada para remover; ao salvar, a antiga saiu do banco **e** do disco e as novas entraram,
  com a principal certa.

Isso achou um bug da Etapa 4: um texto `false` aparecia acima do título no detalhe. Já está corrigido.

## Decisões e desvios da spec
- **Q-001:** 6 fotos (o que roda em produção).
- **Q-002:** as tabelas `photos` e `adoption_photos` **não** foram unificadas por enquanto, para o rollback
  para o Flask continuar possível. M-03 fica para depois da virada.
- **Q-005:** disco (ADR 006).
- **Tudo vira JPEG:** o Flask mantinha a extensão original. JPEG é o formato que o WhatsApp mostra
  na prévia sem problema, e o GIF animado vira o primeiro quadro (o Pillow do Flask fazia o mesmo).
- **`fetch` nativo no lugar de Axios:** menos uma dependência; o Node 22 já tem `fetch` e `AbortSignal.timeout`.
- **Fotos numa segunda chamada** (não no `POST /posts`): o anúncio é salvo mesmo se as fotos falharem
  (BR-PHOTO-006), e cada foto pode ter até 8 MB.
- **`updated_at` muda quando a geocodificação grava as coordenadas** (o Prisma atualiza o campo sozinho).

## Pendências
- Limite de 6 fotos com dois envios **ao mesmo tempo** no mesmo post pode passar de 6 (corrida). O front
  manda uma por vez, então só acontece chamando a API direto. Dá para resolver com um lock, se precisar.
- Mapa com vários posts (página de mapa) fica com o mapa de parceiros, na Etapa 6.
- `og:image` padrão em PNG para posts sem foto (vem da Etapa 4).
- Rodar o `geo:backfill` no banco de produção depois da virada (Etapa 7).
