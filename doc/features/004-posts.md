# 004 — Posts de pets perdidos e encontrados

**Etapa:** 4 · **Data:** 2026-11-05
**Specs:** [posts.md](../../specs/api/posts.md) · [rules.md](../../specs/domain/rules.md) (BR-POST-001..007,
BR-PHOTO-002, BR-CONTACT-001) · [permissions.md](../../specs/domain/permissions.md) (PERM-001, PERM-002) ·
ADR [002](../../specs/adr/002-vite-mpa-og-injection.md)

## O que foi entregue

### API
| Rota | O que faz |
|---|---|
| `GET /posts` | lista pública: ativos e não resolvidos, 12 por página, filtros `status`/`petType` (aceita `pet_type`); filtro inválido é ignorado |
| `GET /posts/recent` | 12 mais recentes, para a home |
| `GET /posts/:id` | detalhe com link do WhatsApp pronto e `canManage`. Resolvido continua acessível; inativo dá 404 para quem não é dono nem admin |
| `POST /posts` | cria (logado) |
| `PATCH /posts/:id` | edita (dono ou admin) |
| `DELETE /posts/:id` | exclui (dono ou admin). As fotos saem junto (CASCADE) |
| `POST /posts/:id/resolve` | marca como resolvido. Repetir não dá erro |
| `GET /me/posts` | todos os posts do usuário logado, inclusive inativos e resolvidos |

Código em `apps/api/src/modules/posts/` (repository → service → router, com um `presenter` que
monta os objetos da resposta). As regras puras ficam no domain: `pickPrimaryPhoto` (BR-PHOTO-002)
e `postWhatsappMessage` (texto igual ao do sistema antigo).

### Open Graph e Express servindo o front (ADR 002)
- `apps/web/page-routes.js`: um mapa único de URL → página. O Vite usa em dev e o Express em
  produção, então as URLs são iguais nos dois.
- **As URLs do sistema antigo continuam valendo:** `/posts/12`, `/posts/criar`, `/posts/12/editar`
  e `/sobre`. Os links que já circulam no WhatsApp não quebram. `/auth/login` e `/auth/register`
  redirecionam (301) para `/login/` e `/cadastro/`.
- Em produção, `/posts/:id` recebe no HTML o `<title>`, `og:title`, `og:description`, `og:url`,
  `og:image` (a foto principal) e `twitter:card`. Tudo passa por escape de HTML.
- Post inativo ou inexistente → 404, sem nenhum dado do post no HTML.
- Os arquivos de `/assets` (com hash no nome) têm cache de 1 ano; as páginas HTML vão com `no-cache`.
- O build não tem nenhum script inline, então o CSP padrão do helmet funciona.

### Front
| Página | Destaques |
|---|---|
| Home `/` | destaque com "Encontrei um Pet" / "Meu Pet Está Perdido" (já com `?status=`), atalhos de filtro, 12 recentes e estado vazio |
| Lista `/posts/` | filtros sem recarregar a página. O estado fica na URL (`history.pushState`, e o botão voltar funciona). Paginação e mensagem de erro com "Tentar de novo" |
| Detalhe `/posts/:id` | galeria com miniaturas, informações do pet, contato (WhatsApp, telefone, email), recompensa e ações do dono com confirmação. Avisa quando o post está oculto |
| Formulário `/posts/criar` e `/posts/:id/editar` | pede login (volta para cá depois), `?status=` pré-seleciona (BR-POST-007), preenche o telefone do usuário e mostra os erros da API no campo certo |
| Sobre `/sobre` | conteúdo do sistema antigo, com a stack nova (Node, Express, Prisma, Vite) |

Componentes novos: `lib/dom.js` (`el()`, que cria elementos sem `innerHTML`) e `lib/post-card.js`
(card, badge e placeholder com emoji). O menu ganhou "Posts", "Sobre" e "Publicar anúncio".

## Como testar
```bash
npm test                    # 96 testes unitários (contracts 16, db 6, domain 45, api 22)
npm run test:integration    # 68 testes com MySQL (23 de posts, porta do test_posts.py)
npm run dev                 # http://localhost:5173

# como em produção (Open Graph):
npm run build && WEB_DIST_DIR=apps/web/dist PUBLIC_URL=http://localhost:3000 npm run dev:api
curl -s localhost:3000/posts/1 | grep og:
```

## Decisões e desvios da spec
- **Parte da 7.2 adiantada:** o Express já serve o build, porque sem isso não daria para testar o
  Open Graph. O CSP final continua na Etapa 7.
- **Escrita em post inativo de outra pessoa dá 404, não 403:** segue a PERM-002 (não revelar que
  o post existe). Post ativo de outra pessoa dá 403.
- **Descrição com limite de 5000 caracteres:** o sistema antigo não tinha limite (coluna TEXT).
  Coloquei um teto para evitar abuso.
- **Recompensa some no formulário quando a situação é "Encontrei":** não faz sentido para quem achou
  o pet. O campo vai vazio.

## Pendências
- Fotos (upload, `sharp`, remover arquivos ao excluir), CEP, geocodificação e mapa no detalhe: Etapa 5.
- `og:image` padrão para posts sem foto: o WhatsApp não aceita SVG, então falta criar um PNG do logo.
- Página "Meus anúncios" no front: a API (`/me/posts`) já existe.
- As páginas não foram conferidas num navegador de verdade, só via HTTP e build. Vale abrir e
  clicar em tudo.
