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
