# 006 — Adoção e mapa de parceiros

**Etapa:** 6 · **Data:** 2026-11-06
**Specs:** [adoption.md](../../specs/api/adoption.md) · [partners.md](../../specs/api/partners.md) ·
[rules.md](../../specs/domain/rules.md) (BR-ADOPT-001..004, BR-PARTNER-001..003) ·
[permissions.md](../../specs/domain/permissions.md) (PERM-001, PERM-002) · ADR [002](../../specs/adr/002-vite-mpa-og-injection.md)

## O que foi entregue

### Adoção
| Rota | O que faz |
|---|---|
| `GET /adoption` | lista pública: ativos e não adotados, 12 por página, filtro `petType` (aceita `pet_type`) |
| `GET /adoption/:id` | detalhe com WhatsApp e `canManage`. Adotado continua abrindo; inativo dá 404 para quem não é dono nem admin |
| `POST /adoption` · `PATCH /adoption/:id` · `DELETE /adoption/:id` | criar, editar (dono ou admin) e excluir (fotos e arquivos saem junto) |
| `POST /adoption/:id/adopted` | marca como adotado (sai da lista). Repetir não dá erro |
| `POST /adoption/:id/photos` · `DELETE /adoption/:id/photos/:photoId` | fotos, com as mesmas regras dos posts |
| `GET /me/adoption` | todos os anúncios de adoção do usuário logado |

**Sem código copiado.** O Flask tinha o código de posts duplicado na adoção. Aqui as duas usam as mesmas peças:
- **`modules/photos/`:** serviço e repositório genéricos. A adoção passa a tabela `adoption_photos`, e
  `mountPhotoRoutes` cria as rotas de fotos dos dois.
- **`modules/geo/jobs.js`:** a fila de geocodificação em segundo plano, com "só grava se o endereço não mudou".
- **`modules/shared/access.js`:** a checagem de dono ou admin, que decide entre 404 e 403.
- **Front:** `listing-page.js` (lista com filtros na URL), `listing-form.js` (formulário com login, CEP,
  fotos e erros por campo), `detail-parts.js`, `gallery.js` e `location-card.js`. As páginas de posts foram
  reescritas em cima delas.

**Prévia no WhatsApp:** `/adocao/:id` também recebe Open Graph no servidor ("Para adoção: ..."), igual aos posts.

**URLs do Flask mantidas:** `/adocao/`, `/adocao/:id`, `/adocao/criar` e `/adocao/:id/editar`.

### Mapa de parceiros
- **`GET /partners`:** só parceiros ativos **com** coordenadas, filtro por `type`. Link de WhatsApp pronto. Site
  que não é `http`/`https` vira `null`, para que um `javascript:` vindo do banco antigo não chegue na tela.
- **Busca "perto de mim"** (`?lat&lng&radiusKm`, raio de 1 a 100 km, padrão 10):
  - Haversine no domain (`packages/domain/src/geo.js`), com um retângulo filtrado no banco antes do cálculo exato;
  - devolve do mais perto para o mais longe, com `distanceKm`;
  - é a base da busca do bot (Etapa 8).
- **Página `/mapa`:**
  - pinos coloridos por tipo (as mesmas cores do Flask) e filtro por tipo;
  - lista lateral (clicar centraliza e abre o popup);
  - "Minha localização" mostra os parceiros até 10 km, com um círculo no mapa.
- **Diferenças para o Flask:**
  - o popup é montado com elementos DOM; o antigo colava nome e endereço como HTML (brecha de XSS);
  - a localização só é pedida quando a pessoa clica; o antigo pedia ao abrir a página;
  - sem o plugin de cluster (são poucas dezenas de pontos).
- **Menu:** ganhou "Adoção" e "Mapa". A página "Sobre" passou adoção e mapa para "Funcionalidades".

## Como testar
```bash
npm test                    # 131 testes unitários (contracts 23, db 6, domain 49, api 46, web 7)
npm run test:integration    # 110 testes com MySQL (adoção 14, parceiros 5)
npm run db:seed:partners    # 30 parceiros reais de SP
npm run geo:backfill -w @petspost/api -- --apply   # coordenadas de posts e adoções sem mapa
npm run dev                 # http://localhost:5173/adocao/ e /mapa
```

## Verificação no navegador
Em modo produção, com Chrome headless:
- lista, detalhe (selos, requisitos e mapa) e formulário de adoção;
- criar uma adoção pelo formulário, com "castrado" marcado e uma foto: tudo salvo certo;
- mapa com os 30 parceiros. "Minha localização" foi simulada na Praça da Sé: 12 parceiros até 10 km, do
  mais perto (0,7 km) para o mais longe, e o popup com WhatsApp e "Como chegar";
- páginas de posts depois da refatoração: filtros, galeria, mapa, botões do dono, edição e 404.

Isso achou um bug: no popup do mapa, o botão do WhatsApp ficava com o texto da mesma cor do fundo. O CSS do
Leaflet fica fora de `@layer` e ganhava das classes do Tailwind. A regra que corrige também ficou fora de
`@layer` (`main.css`, no final).

## Decisões e desvios da spec
- **WhatsApp na adoção e nos parceiros:** o Flask não tinha. Segue a mesma ideia dos posts.
- **Requisitos do adotante com limite de 2000 caracteres** (no Flask era TEXT sem limite).
- **PATCH de adoção:** castrado/vacinado que não vêm no corpo continuam como estão (no POST, viram `false`).
- **Cadastro de parceiros (BR-PARTNER-002) fica no painel admin, na Etapa 7.** Por enquanto os dados vêm do
  seed. A API pública já esconde site que não é http/https.

## Pendências
- Página "Meus anúncios" (posts + adoção): as APIs `/me/posts` e `/me/adoption` já existem.
- `og:image` padrão em PNG para anúncios sem foto (vem da Etapa 4).
- Painel admin com cadastro de parceiros e moderação: Etapa 7.
