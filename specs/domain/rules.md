# Regras de negócio

Cada regra tem um ID estável. Testes citam o ID no nome.
**Status:** ✅ implementada e testada · 🟡 especificada, não implementada

Origem: engenharia reversa do projeto Flask (`pets-post/app/**`).

## Autenticação — BR-AUTH
| ID | Regra | Status |
|---|---|---|
| BR-AUTH-001 | Cadastro exige nome (2–100), email único e válido, senha e confirmação. Telefone opcional. Email é salvo em minúsculas e com trim. | ✅ contrato · 🟡 rota |
| BR-AUTH-002 | Senha com no mínimo 8 caracteres. | ✅ contrato |
| BR-AUTH-003 | Confirmação de senha deve ser igual à senha. | ✅ contrato |
| BR-AUTH-004 | Senhas são armazenadas com hash no formato Werkzeug. Hashes legados `scrypt:*` e `pbkdf2:*` do banco Flask **devem** continuar válidos. Novos hashes usam `scrypt:32768:8:1`. Hash legado PBKDF2 é regenerado após login bem-sucedido. | ✅ |
| BR-AUTH-005 | Usuário com `isActive=false` não consegue logar ("Esta conta foi desativada"). | 🟡 |
| BR-AUTH-006 | Login com email ou senha errados retorna mensagem genérica (não revela qual errou). | 🟡 |
| BR-AUTH-007 | Rate limit: login 10/min e 50/h por IP; cadastro 5/min e 20/h por IP. | 🟡 |
| BR-AUTH-008 | Sessão expira após 2h de inatividade (renovada a cada requisição). "Lembrar de mim" mantém por 7 dias. Cookie HttpOnly, SameSite=Lax, Secure em produção. | 🟡 |
| BR-AUTH-009 | Redirect pós-login (`next`) só para o mesmo host (anti open-redirect). | 🟡 |
| BR-AUTH-010 | Logout somente via POST com proteção CSRF. | 🟡 |
| BR-AUTH-011 | Log de segurança: login_success, login_failed, login_blocked_inactive, register_success, logout (com IP). | 🟡 |

## Posts de pets — BR-POST
| ID | Regra | Status |
|---|---|---|
| BR-POST-001 | Campos obrigatórios: título (≤150), descrição, status, tipo, localização (≤255), telefone de contato. | 🟡 |
| BR-POST-002 | Listagens públicas mostram apenas `isActive=true` e `isResolved=false`, ordenadas por `createdAt` desc. | 🟡 |
| BR-POST-003 | Listagem paginada com 12 itens; filtros opcionais `status` e `petType`; valores inválidos são ignorados. | 🟡 |
| BR-POST-004 | Home mostra os 12 posts mais recentes elegíveis (BR-POST-002). | 🟡 |
| BR-POST-005 | Marcar como resolvido: post sai das listagens, continua acessível pelo link. | 🟡 |
| BR-POST-006 | Excluir post remove também as fotos (registro e arquivo). | 🟡 |
| BR-POST-007 | Ao criar post, `status` pode vir pré-selecionado via `?status=lost|found`. | 🟡 |

## Adoção — BR-ADOPT
| ID | Regra | Status |
|---|---|---|
| BR-ADOPT-001 | Campos obrigatórios: título, descrição, tipo, localização, telefone. Castrado/vacinado padrão false. | 🟡 |
| BR-ADOPT-002 | Listagem: `isActive=true` e `isAdopted=false`, filtro `petType`, 12 por página. | 🟡 |
| BR-ADOPT-003 | Marcar como adotado encerra o anúncio (sai das listagens). | 🟡 |

## Fotos — BR-PHOTO
| ID | Regra | Status |
|---|---|---|
| BR-PHOTO-001 | Máximo de **6** fotos por anúncio (criação e edição). Excedentes na edição são ignoradas com aviso. | 🟡 ⚠️ ver Q-001 |
| BR-PHOTO-002 | A primeira foto enviada é a principal. Se a principal for removida, a primeira restante vira principal. Sem foto marcada, a primeira é usada. | 🟡 |
| BR-PHOTO-003 | Extensões aceitas: png, jpg, jpeg, gif, webp. Requisição de até 8 MB. | 🟡 |
| BR-PHOTO-004 | Toda imagem é re-codificada no servidor: rejeita não-imagem, rejeita > 20 MP, converte para RGB, redimensiona para no máx. 800 px de largura, qualidade 85. O arquivo original nunca é salvo. | 🟡 |
| BR-PHOTO-005 | Nome do arquivo = UUID aleatório; o nome enviado pelo usuário é descartado. | 🟡 |
| BR-PHOTO-006 | Falha em uma foto não impede salvar o anúncio (aviso ao usuário). | 🟡 |

## Geolocalização — BR-GEO
| ID | Regra | Status |
|---|---|---|
| BR-GEO-001 | Endereço é geocodificado via Nominatim (OSM), restrito ao Brasil, timeout 5 s. Falha não impede salvar (fica sem coordenadas). | 🟡 |
| BR-GEO-002 | Geocodificar **apenas** se o endereço mudou ou não há coordenadas. *(correção — o Flask geocodificava sempre na edição de posts)* | 🟡 |
| BR-GEO-003 | Respeitar 1 requisição/s ao Nominatim (fila) e User-Agent identificado. *(correção)* | 🟡 |
| BR-GEO-004 | `GET /api/cep/:cep` consulta ViaCEP; aceita 8 dígitos (máscara ignorada); devolve só logradouro, bairro, localidade, uf; 400 formato inválido, 404 não encontrado, 502 serviço fora; 30 req/min por IP. | 🟡 |

## Parceiros — BR-PARTNER
| ID | Regra | Status |
|---|---|---|
| BR-PARTNER-001 | Mapa público lista apenas parceiros `isActive=true` **com** coordenadas. | 🟡 |
| BR-PARTNER-002 | CRUD exclusivo de admin; site precisa ser URL http/https. | 🟡 |

## Validação e contato — BR-VAL / BR-CONTACT
| ID | Regra | Status |
|---|---|---|
| BR-VAL-001 | Telefone no formato `(XX) XXXX-XXXX` ou `(XX) XXXXX-XXXX`. | ✅ |
| BR-VAL-002 | Email válido, normalizado para minúsculas. | ✅ |
| BR-VAL-003 | Campos de texto opcionais: string vazia é salva como `null`; todos os textos com trim. | ✅ |
| BR-CONTACT-001 | Link WhatsApp: adiciona 55 em números com DDD (10–11 dígitos), aceita 55+DDD (12–13), rejeita 0800/0300 e números sem DDD; mensagem codificada como `urllib.parse.quote`. | ✅ |

## Admin — BR-ADMIN
| ID | Regra | Status |
|---|---|---|
| BR-ADMIN-001 | Dashboard: total de usuários, total de posts, ativos, resolvidos, perdidos e encontrados ativos; 5 posts e 5 usuários mais recentes. | 🟡 |
| BR-ADMIN-002 | Admin (des)ativa usuários, exceto a si mesmo (PERM-005). | 🟡 |
| BR-ADMIN-003 | Admin pode ocultar/reexibir anúncios (`isActive`). *(nova — no Flask o campo existia sem rota)* | 🟡 |
| BR-ADMIN-004 | Dashboard inclui estatísticas e moderação de adoção. *(nova)* | 🟡 |

## Questões em aberto
| ID | Pergunta | Proposta |
|---|---|---|
| Q-001 | Limite de fotos: README/model do Flask dizem 5, forms/rotas aplicam 6. | Manter **6** (é o que roda em produção). |
| Q-002 | Unificar `photos` + `adoption_photos` e `pet_posts` + `adoption_posts`? | Unificar fotos na Etapa de mídia; manter posts separados. |
