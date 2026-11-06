# 007 — Painel admin e preparação do deploy

**Etapa:** 7 · **Data:** 2026-11-06
**Specs:** [admin.md](../../specs/api/admin.md) · [rules.md](../../specs/domain/rules.md) (BR-ADMIN-001..005,
BR-PARTNER-002) · [permissions.md](../../specs/domain/permissions.md) (PERM-003, PERM-005) ·
[deploy/README.md](../../deploy/README.md)

## O que foi entregue

### API do admin (`/api/v1/admin/*`, só admin: 401 visitante, 403 usuário comum)
| Rota | O que faz |
|---|---|
| `GET /stats` | números de posts, adoção, usuários e parceiros, mais os 5 mais recentes de cada |
| `GET /users` · `POST /users/:id/toggle` | busca por nome/email; ativar/desativar. **Desativar derruba todas as sessões da pessoa na hora** (no Flask ela ficava logada até a sessão expirar). O admin não desativa a si mesmo |
| `GET /posts` · `GET /adoption` · `PATCH /posts/:id` · `PATCH /adoption/:id` | moderação: lista tudo (inclusive ocultos), filtra e oculta/reexibe. Ocultar faz o link dar 404 para os outros |
| `GET/POST/PATCH/DELETE /partners` | cadastro de parceiros. A geocodificação é **na hora** e a resposta diz se achou o endereço (`geocoded`); dá para informar latitude e longitude à mão. Site só http/https |

Todas as ações de admin vão para o log de segurança (`admin_user_toggled`, `admin_post_visibility`…).

### Telas (`/admin`, URLs do Flask mantidas)
- **Dashboard** com os números (cada um leva para a lista filtrada) e os mais recentes.
- **Tabelas** de usuários, posts, adoção (nova) e parceiros: busca, filtros, paginação e ações com confirmação.
- **Formulário de parceiro**, que avisa quando o endereço não é encontrado no mapa.
- O selo "admin" no menu leva ao painel. Quem não é admin vê "Acesso restrito". A proteção de verdade é da API.

### Produção
- **CSP final (T7.8):** sem `'unsafe-inline'`. Libera só os tiles do OpenStreetMap e `blob:` (prévia das fotos).
  Também tem `frame-ancestors 'none'` e `object-src 'none'`. Passei por todas as páginas no Chrome headless e
  não apareceu nenhuma violação.
- **Referrer-Policy `strict-origin-when-cross-origin`:** a política dos tiles do OpenStreetMap exige o
  `Referer`, e o padrão do helmet (`no-referrer`) não mandava.
- **Páginas de erro (T7.9):** 404 de verdade (antes mostrava a home) e 500 que não depende da API, sem
  detalhes do erro.
- **URLs antigas (T7.12):** todas as rotas GET do Flask têm equivalente. `/auth/login?next=...` agora mantém o
  `?next=`, e `/auth/logout` leva para a home.
- **Kit de deploy (T7.10/T7.11, pasta `deploy/`):**
  - `setup-server.sh`: Ubuntu 24.04 com Nginx, MySQL, Node 26, firewall, fail2ban e backup diário;
  - `deploy.sh`: uma pasta por versão; se o health check falhar, volta sozinho;
  - `rollback.sh`, `backup.sh`, serviço do systemd com proteções e config do Nginx (`petspost.com.br` → `www`);
  - `npm run admin:create`: cria o admin em produção (o seed de dev se recusa a rodar lá).

## Como testar
```bash
npm test                    # 134 testes unitários (contracts 28, db 6, domain 49, api 48, web 7)
npm run test:integration    # 121 testes com MySQL (admin 11)
npm run dev                 # entre com admin@petpost.com / Admin@123 e abra /admin
```

## Decisões
- **Hospedagem (Q-004):** VPS na Hostinger. O Flask (que ficava na Integrator) foi aposentado, então o
  rollback é a versão anterior da v2.
- **Geocodificação do parceiro na hora** (não em segundo plano como nos anúncios): o admin precisa saber
  se o parceiro vai aparecer no mapa.
- **O admin vê o email dos donos** na moderação, para poder entrar em contato.
- **Endereço oficial `www.petspost.com.br`:** é o que já circula nos links do sistema antigo.

## Pendências
- **T7.13/T7.14:** contratar o VPS, rodar o `setup-server.sh`, deploy, DNS e certificado
  (passo a passo em `deploy/README.md`). Os scripts foram checados (sintaxe e lógica), mas ainda não rodaram num
  servidor de verdade.
- A ideia antiga de "importar o banco do Flask" (Q-003) só vale se você quiser manter os dados de lá.
- "Meus anúncios" e o `og:image` padrão em PNG (vêm das etapas anteriores).
