# Roadmap da reescrita

Legenda: ✅ concluída · 🔜 próxima · ⬜ pendente

> Detalhamento acionável de cada tarefa (critérios de pronto, regras cobertas): [`../todo/`](../todo/README.md).

## Etapa 1 — Fundação ✅
| # | Micro tarefa | Status |
|---|---|---|
| 1.1 | Repositório git, `.gitignore`, `.editorconfig`, `.gitattributes`, `.nvmrc` | ✅ |
| 1.2 | Monorepo npm workspaces (`apps/*`, `packages/*`) | ✅ |
| 1.3 | Specs SDD: visão, entidades, regras (BR-*), permissões (PERM-*), ADRs | ✅ |
| 1.4 | Schema Prisma espelhando o banco Flask (`prisma validate` ok) | ✅ |
| 1.5 | `@petspost/domain`: hash Werkzeug, WhatsApp, permissões, constantes + testes | ✅ |
| 1.6 | `@petspost/contracts`: schemas zod comuns e de auth + testes | ✅ |
| 1.7 | API Express: config validada, helmet, health check, erros JSON + testes | ✅ |
| 1.8 | Web Vite MPA + Tailwind: página inicial com status da API/banco | ✅ |
| 1.9 | README com passo a passo e `doc/` | ✅ |

## Etapa 2 — Banco de dados ✅
| # | Micro tarefa | Status |
|---|---|---|
| 2.1 | Migration `0_init` (banco novo) + procedimento de baseline (banco Flask) | ✅ |
| 2.2 | Seed: admin + posts + adoção de exemplo (porta de `seeds.py`) | ✅ |
| 2.3 | Seed de parceiros SP (porta de `seeds_parceiros_sp.py`) | ✅ |
| 2.4 | Validar hash `scrypt:` real (Werkzeug 3.1.3) | ✅ |
| 2.5 | Testes de integração (`npm run test:integration`) + repositório de usuários | ✅ |

## Etapa 3 — Autenticação ✅
| # | Micro tarefa | Status |
|---|---|---|
| 3.1 | Sessão (`express-session` + store MySQL), cookies (BR-AUTH-008) | ✅ |
| 3.2 | CSRF (`csrf-csrf`) e rate limit (`express-rate-limit`) (BR-AUTH-007/010) | ✅ |
| 3.3 | `POST /auth/register`, `/auth/login`, `/auth/logout`, `GET /auth/me` | ✅ |
| 3.4 | Re-hash de senha legada no login, log de segurança (BR-AUTH-004/011) | ✅ |
| 3.5 | Páginas login/cadastro no front | ✅ |

## Etapa 4 — Posts de pets perdidos/encontrados ✅
| 4.1 | Contratos zod de post | ✅ |
| 4.2 | Listagem com filtros/paginação + home (BR-POST-002..004) | ✅ |
| 4.3 | Detalhe com regra de visibilidade (PERM-002) | ✅ |
| 4.4 | Criar/editar/excluir/resolver (PERM-001) | ✅ |
| 4.5 | Páginas de lista, detalhe, formulário; injeção Open Graph (ADR 002) | ✅ |

## Etapa 5 — Mídia e geolocalização ✅
| 5.1 | Upload (`multer`) + processamento (`sharp`) (BR-PHOTO-*) | ✅ |
| 5.2 | Geocodificação Nominatim com fila 1 req/s (BR-GEO-001..003) | ✅ |
| 5.3 | Proxy CEP ViaCEP (BR-GEO-004) | ✅ |
| 5.4 | Mapa Leaflet nas páginas de detalhe | ✅ |
| 5.5 | Migration M-01 (coordenadas em `DOUBLE`) | ✅ |

## Etapa 6 — Adoção e parceiros 🔜
| 6.1 | CRUD de adoção + marcar adotado (BR-ADOPT-*) | ⬜ |
| 6.2 | Mapa de parceiros + `GET /partners` (BR-PARTNER-001) | ⬜ |

## Etapa 7 — Admin e cutover
| 7.1 | Dashboard, usuários, moderação, parceiros (BR-ADMIN-*) | ⬜ |
| 7.2 | Express serve o build do Vite em produção; CSP final | 🟡 serve o build + OG (Etapa 4) e CSP com fotos/mapa (Etapa 5); falta revisar no deploy |
| 7.3 | Migração de uploads, deploy paralelo, troca de DNS | ⬜ |

## Etapa 8+ — Chatbot e IA (ADR 004/005)
| 8.1 | Bot Telegram (grammY) + intenções node-nlp + busca SQL | ⬜ |
| 8.2 | Extração de post por LLM + RAG LanceDB | ⬜ |
| 8.3 | Similaridade de fotos com TensorFlow.js | ⬜ |
