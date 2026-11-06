# 008 — Loja (vitrine de produtos dos parceiros)

**Etapa:** 7b · **Data:** 2026-11-06
**Specs:** [store.md](../../specs/api/store.md) · [rules.md](../../specs/domain/rules.md) (BR-STORE-001..008) ·
ADR [002](../../specs/adr/002-vite-mpa-og-injection.md) (prévia no WhatsApp) · ADR [006](../../specs/adr/006-fotos-em-disco.md) (fotos)

## O que foi pedido
- **Vitrine, não e-commerce:** produto com foto e preço, e um botão que leva para a loja do parceiro.
- **Cada produto pertence a um parceiro do mapa.** Quem cadastra é o admin.
- **Campos:** nome, descrição, categoria, tipo de animal, preço, preço promocional, estoque, até 6 fotos,
  ativo/inativo e destaque.
- **Header no jeito das lojas pet** (inspirado na organização do header da Petz), sem copiar logo, cores nem textos
  da marca. O visual continua o do Pets Post, em laranja.

## O que foi entregue

### Banco
- **Migration `3_products`:** tabelas `products` e `product_photos`, novas da v2.
- **Preço em centavos (inteiro):** para não ter erro de arredondamento.
- **Parceiro com produtos não pode ser excluído** (FK `RESTRICT` e 409 na API, BR-STORE-008). Para tirar um
  parceiro do mapa, basta desativar.

### API
| Rota | O que faz |
|---|---|
| `GET /store/products` | vitrine: busca, categoria, animal (o filtro inclui os produtos "para todos os pets"), parceiro e ordenação por destaque, preço ou novidade. 24 por página |
| `GET /store/products/:id` | detalhe com o link de compra pronto (`buyUrl` / `buyChannel`) |
| `GET /store/categories` | as 7 categorias com a contagem de produtos visíveis |
| `/admin/products` (+ `/photos`) | cadastro completo no admin, com fotos pelo mesmo serviço dos anúncios |

- **Só aparece na vitrine** produto ativo de parceiro ativo (BR-STORE-001).
- **Ordenação por preço:** usa o preço **final**, já com a promoção. A promoção só vale se for menor que o preço;
  o desconto exibido arredonda para baixo, para nunca anunciar mais desconto do que dá.
- **Botão de compra (BR-STORE-005):** link do produto → site do parceiro → WhatsApp do parceiro, com a
  mensagem "Vi o produto *X* no Pets Post…". Só links `http`/`https`.
- **Estoque:** só informativo. Produto esgotado continua na vitrine com o selo "Esgotado".
- **Prévia no WhatsApp:** `/loja/produto/:id` recebe Open Graph com nome, preço final, parceiro e foto.

### Front
| Página | Destaques |
|---|---|
| `/loja` | atalhos de categoria com contagem, filtros (busca, categoria, pet, ordenação) com estado na URL, cards com "de/por", desconto, "Destaque" e "Esgotado" |
| `/loja/produto/:id` | galeria, preço grande com a economia, estoque, botão "Ir para a loja do parceiro" ou "Comprar pelo WhatsApp", card "Vendido por", "Mais de {parceiro}" e o aviso de que a compra é feita com o parceiro |
| `/admin/produtos` | lista com foto, preço, estoque e situação ("Parceiro inativo" quando é o caso) |
| formulário | preço digitado em reais ("189,90"), convertido para centavos; parceiro, categoria, pet, link, ativo, destaque e fotos |

**Header novo (todas as páginas):**
- **Em cima:** logo, uma **busca grande da loja** no meio, e "Publicar anúncio" e a conta à direita.
- **Embaixo, numa faixa laranja:** o menu (Início, Perdidos e encontrados, Adoção, Loja, Mapa de parceiros,
  Sobre), cada link com ícone.
- **No celular:** busca, menu e conta ficam dentro do botão ☰.

**Seed de dev:** `npm run db:seed` agora cria 10 produtos de exemplo, só nos parceiros **fictícios**, com
nomes genéricos e sem marca, para não parecer anúncio de loja real.

## Como testar
```bash
npm test                    # 149 testes unitários (contracts 33, db 6, domain 54, api 49, web 7)
npm run test:integration    # 132 testes com MySQL (loja 11)
npm run db:seed             # produtos de exemplo
npm run dev                 # http://localhost:5173/loja · /admin/produtos (admin@petpost.com / Admin@123)
```

## Verificação no navegador
Em modo produção, com Chrome headless:
- vitrine com os 10 produtos, busca "ração" com ordem de menor preço, página do produto e prévia do WhatsApp;
- header no desktop e no celular (390 px);
- cadastro de ponta a ponta pelo admin: preço "49,90" e promoção "39,90" viraram 4990/3990 centavos, com 20% de
  desconto, e a foto e o parceiro entraram certos (o produto de teste foi apagado depois).

Nenhuma violação de CSP.

## Decisões
- **O admin cadastra os produtos:** os parceiros não têm conta. Se um dia tiverem, o modelo já liga o produto ao parceiro.
- **Preço em centavos** no banco e na API. O front formata em R$.
- **Ordenação por preço final** feita na API (a vitrine tem poucas centenas de produtos). Se crescer muito, vale
  guardar o preço final numa coluna.
- **O filtro por animal inclui os produtos "para todos os pets"** (uma bolinha aparece em cachorro e em gato).

## Pendências
- Os parceiros reais do mapa ainda não têm produtos: é preciso cadastrar pelo admin.
- Carrinho e pagamento ficam fora de propósito (é vitrine).

---

## Atualização (2026-11-06): importar produto de um link

**Pedido:** colar o link de um produto (ex.: da Petz) e o anúncio ser criado a partir dele.

### O que foi entregue
- **"Importar de um link" no formulário de novo produto** (`/admin/produtos/criar`):
  1. você cola o link e clica em "Buscar";
  2. nome, descrição, preço, link do produto, categoria e pet (os dois últimos são sugestões pelo nome) são preenchidos,
     junto com as **fotos da loja em miniatura**, para marcar quais entram;
  3. você confere, escolhe o parceiro e salva. Nada é salvo antes disso;
  4. as fotos escolhidas são baixadas pelo servidor e tratadas como as enviadas (800 px, JPEG, sem metadados).
- **Como o servidor lê a página (BR-STORE-009):** usa só os dados que a loja publica para Google e WhatsApp (schema.org
  `Product` em JSON-LD; se não houver, Open Graph). Não executa o JavaScript da página nem "raspa" o layout.
- **"Atualizar do link"** na edição: lê a página de novo e atualiza o preço e a disponibilidade, mostrando o que mudou.
  Promoção que ficaria maior que o preço novo é apagada.
- **"Preço consultado em DD/MM/AAAA. Confirme na loja antes de comprar."** na página do produto (BR-STORE-011).
  A data é gravada ao criar, ao mudar o preço e ao atualizar do link. Migration `4_price_checked_at`.

### Segurança (BR-STORE-010)
O servidor acessar um link digitado é um risco conhecido (SSRF: usar o site para chegar à rede interna).
`apps/api/src/lib/safe-fetch.js`:
- só `https` na porta 443, sem usuário e senha no link;
- o IP é conferido **na hora de conectar**. Localhost, rede privada, link-local (169.254.x, onde ficam os metadados
  da nuvem), IPv6 interno e IPv4 disfarçado de IPv6 são recusados, inclusive quando o DNS aponta para eles ou um
  redirecionamento leva para eles;
- IP escrito direto no link também é conferido. Esse caso foi achado testando de verdade: o Node não consulta o
  DNS quando o link já é um IP;
- até 3 redirecionamentos, 8 s, 3 MB por página e 8 MB por foto;
- só o admin usa (401/403), com limite de 10 importações por minuto;
- User-Agent honesto do Pets Post. O site **não se passa por navegador nem tenta burlar bloqueio de robôs**.

### E a Petz?
Testei com o link que você mandou: a Petz responde **403 (Akamai)** para leitura automática. No Pets Post aparece
"O site petz.com.br não permite leitura automática (respondeu 403). Preencha os dados à mão." O mesmo vale para
qualquer loja que bloqueie robôs. A alternativa para esses sites é um botão no seu navegador ("Enviar para o Pets
Post"), que fica como próximo passo opcional.

### Testes
- `apps/api/test/product-import.test.js` (sem rede): validação de link, IPs internos, DNS apontando para dentro,
  redirecionamentos, tamanho, gzip, leitura de JSON-LD (`@graph`, `AggregateOffer`, entidades HTML) e Open Graph.
- `apps/api/integration/store-import.int.js`: rascunho, site bloqueado, página sem produto, permissão, salvar com
  fotos importadas, "Atualizar do link" e data do preço.
- No navegador (Chrome headless, com uma loja falsa): importação, mensagem de bloqueio, salvar de ponta a ponta,
  "Atualizar do link" e a data na vitrine.

## Atualização (2026-11-06): loja automática e "Vendido e entregue por"

**Pedido:** o link `https://www.cobasi.com.br/antipulgas-credeli-450mg-caes-11-a-22kg-3779423/p?idsku=779423`
não subiu direito para a loja. Também: identificar a loja sozinho, sem escolher na lista, e mostrar
"Vendido e entregue por …" como nos marketplaces.

### O que estava errado
- **Fotos não vinham:** o User-Agent tinha acento ("importação"). O Node manda o acento como byte solto e o CDN de
  fotos da VTEX (usado pela Cobasi) responde **400** para qualquer foto. Agora o User-Agent é só ASCII (BR-STORE-010).
- **Variação errada:** a página da Cobasi tem várias variações (`ProductGroup`): 1 comprimido por R$ 74,90 e
  3 comprimidos por R$ 177,90. O link apontava a de 3 (`?idsku=779423`), mas vinha sempre a primeira, e o link salvo
  perdia o `?idsku`. Agora vale a variação do link: nome, preço, foto e link dela (BR-STORE-009).

### O que foi entregue
- **Loja escolhida pelo link (BR-STORE-012):** o domínio do link é comparado com o site dos parceiros
  (sem `www.`; subdomínio da loja também vale). Um parceiro só → já vem escolhido. Vários (ex.: "Cobasi Alto de
  Pinheiros" e "Cobasi Santos", com o mesmo site) → vem o ativo cujo nome é igual ao vendedor da página, senão o
  primeiro, e um aviso lista os outros. Nenhum → aviso com link para cadastrar a loja. A lista continua editável.
- **"Vendido e entregue por …" (BR-STORE-013):** campo novo `sellerName` (migration `5_product_seller`). Na
  importação vem do `offers.seller` da página (na Cobasi: "Cobasi"); no formulário dá para mudar. Vazio = nome do
  parceiro. Aparece no card da vitrine e ao lado do preço na página do produto. O quadro do parceiro na página virou
  "Loja parceira".

### Fotos da Cobasi (VTEX): limite para robôs
Teste com `https://www.cobasi.com.br/coleira-antiparasitaria-scalibor-48-cm-caes-pequenos-e-medios-3540234/p?idsku=540234`:
os dados vieram, as fotos não. O servidor de fotos da VTEX responde **429** com `rate-limit-reason: bot` e
`rate-limit-threshold: 23`: é um limite de propósito para robôs, contado por endereço. Um navegador comum não é
limitado. O Pets Post não se passa por navegador para fugir disso (BR-STORE-009), então o importador passou a gastar
menos e a avisar melhor (BR-STORE-010):
- **cada foto é baixada uma vez:** a do rascunho fica guardada 15 min na memória e é reaproveitada ao salvar
  (antes eram duas leituras por foto);
- **ao primeiro 429, para:** não pede as outras fotos e mostra "O site cobasi.com.br limitou o acesso de robôs às
  fotos agora (429). Tente buscar de novo em alguns minutos ou envie as fotos à mão.";
- **foto em tamanho bom:** a Cobasi publica no JSON-LD e no `og:image` só a miniatura de 194 px. Endereços da VTEX
  (`/arquivos/ids/ID-194-194/`) passam a pedir a de 1200 px, que é a que a própria página mostra.

A Cobasi publica nos dados estruturados só **uma** foto por produto; as outras da galeria ficam só no layout da
página, que o importador não raspa.

### Testes
- `packages/domain/test/store.test.js`: domínio do link, escolha do parceiro, "Vendido e entregue por".
- `packages/contracts/test/store.test.js`: `sellerName` opcional, até 120 caracteres.
- `apps/api/test/product-import.test.js`: variação pelo `?idsku`/`?sku`, vendedor da oferta, User-Agent só ASCII.
  Fotos: miniatura da VTEX vira 1200 px, uma leitura por foto (guardada 15 min), para no primeiro 429.
- `apps/api/integration/store-import.int.js`: parceiro escolhido pelo domínio (filiais, inativo, nenhum),
  vendedor salvo e mostrado na vitrine, vendedor vazio volta para o parceiro.

## Atualização (2026-11-06): importação mais tolerante (BR-STORE-014)

**Pedido:** analisar as lojas pet da lista (100 domínios) e reduzir os erros de importação por link.

**Levantamento:** cerca de 35 domínios da lista não existem (sem DNS). Petz, Magalu, Casas Bahia, Premier Pet e
BoxPet bloqueiam robôs (403). 4 sites têm certificado inválido. Nas páginas de produto que abriram, os problemas foram:
- JSON-LD com `type` sem aspas (Wake/Fbits, ex.: Tudo de Bicho): o preço se perdia;
- JSON-LD com quebra de linha crua dentro do texto (WooCommerce, ex.: Terra Zoo): o bloco era descartado;
- `Product` dentro de outro objeto (Zee.Dog): ficava sem preço nem variação;
- o mesmo produto em 2 ou 3 blocos, cada um com um pedaço (plugins de SEO): o vendedor se perdia;
- VTEX antiga sem JSON-LD (Dr. Hato): agora o `skuJson` da plataforma é lido (preço em centavos, sku do link);
- microdados em `span`/`link` (Loja Integrada): preço e estoque agora vêm, sem as fotos dos produtos relacionados;
- preço `0` (Tray) e vendedor "1" (Americanas) ignorados;
- nome com sufixo da loja ("| Amazon.com.br", "- Frete Rápido") limpo;
- a mesma foto em vários tamanhos agora conta uma vez;
- blog e páginas institucionais não viram mais rascunho de produto;
- página acima de 3 MB é lida até 3 MB; charset do `<meta>` quando o cabeçalho não diz;
- certificado inválido tem mensagem própria; raízes do sistema somadas às do Node (Let's Encrypt "Root YE").

**Testes:** `apps/api/test/product-import.test.js` (BR-STORE-014), com exemplos montados a partir das páginas reais.

## Atualização (2026-11-06): parceiro sem perguntar

**Pedido:** ao importar, o formulário ainda pedia "Escolha quem vende este produto" quando a loja não estava
cadastrada; usar o nome do domínio ou o nome da loja.

**Agora (BR-STORE-012):**
1. parceiro com o mesmo **site** do link (como antes);
2. senão, parceiro **sem site** cujo nome contém o nome da loja (vendedor da página ou `og:site_name`) ou o nome do
   domínio (ex.: "PetCenter Curitiba" para petcenter.com.br);
3. senão, a lista já vem em **"Nova loja: {nome} (cadastrada ao salvar)"**. Ao salvar, a loja vira parceiro
   "loja online" (petshop, endereço "Loja online", site do link, sem coordenadas, então não aparece no mapa).
   Se já existir parceiro com esse site, ele é usado, sem duplicar.

O nome da loja nova vem do vendedor da página, senão do `og:site_name` sem o slogan, senão do domínio.

## Atualização (2026-11-06): fotos baixadas pelo navegador do admin (BR-STORE-015)

**Pedido:** quando a Cobasi limita o servidor, deixar o navegador do admin baixar as fotos; nas lojas que não
permitem, continua o envio manual.

**Como funciona:**
1. O servidor lê a página. Se as fotos respondem **429**, ele devolve no rascunho os endereços que o navegador pode
   baixar (`pendingImages`): só os de servidores da lista `BROWSER_IMAGE_HOSTS` (VTEX: `*.vteximg.com.br`,
   `*.vtexassets.com`), que permitem esse download (CORS `*`, conferido nos dois).
2. O navegador do admin baixa as fotos (sem cookies, só JPEG/PNG/GIF/WEBP até 8 MB) e mostra as miniaturas para marcar.
3. Ao salvar, elas vão pelo envio normal de fotos (800 px, JPEG, sem metadados).
4. Loja fora da lista, ou foto que falhar também no navegador → aviso para enviar à mão.

**Segurança:** a CSP só libera esses servidores no `connect-src` das páginas `/admin/*`. Vitrine, anúncios, mapa e
o resto do site continuam sem acesso a nada de fora. O servidor continua se identificando como robô e respeitando o
limite. Quem baixa no navegador é o admin, de verdade.

**Testes:** lista e https (`packages/domain/test/store.test.js`), `pendingImages` só para servidores da lista
(`apps/api/test/product-import.test.js`), CSP só no `/admin` (`apps/api/test/app.test.js`).
