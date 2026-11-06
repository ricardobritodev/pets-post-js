# Regras de negócio

Cada regra tem um ID estável. Testes citam o ID no nome.
**Status:** ✅ implementada e testada · 🟡 especificada, não implementada

Origem: engenharia reversa do projeto Flask (`pets-post/app/**`).

## Autenticação — BR-AUTH
| ID | Regra | Status |
|---|---|---|
| BR-AUTH-001 | Cadastro exige nome (2–100), email único e válido, senha e confirmação. Telefone opcional. Email é salvo em minúsculas e com trim. | ✅ |
| BR-AUTH-002 | Senha com no mínimo 8 caracteres. | ✅ contrato |
| BR-AUTH-003 | Confirmação de senha deve ser igual à senha. | ✅ contrato |
| BR-AUTH-004 | Senhas são armazenadas com hash no formato Werkzeug. Hashes legados `scrypt:*` e `pbkdf2:*` do banco Flask **devem** continuar válidos. Novos hashes usam `scrypt:32768:8:1`. Hash legado PBKDF2 é regenerado após login bem-sucedido. | ✅ |
| BR-AUTH-005 | Usuário com `isActive=false` não consegue logar ("Esta conta foi desativada"). | ✅ |
| BR-AUTH-006 | Login com email ou senha errados retorna mensagem genérica (não revela qual errou). | ✅ |
| BR-AUTH-007 | Rate limit: login 10/min e 50/h por IP; cadastro 5/min e 20/h por IP; emissão de token CSRF 30/min e 300/h por IP. | ✅ |
| BR-AUTH-008 | Sessão expira após 2h de inatividade (renovada a cada requisição). "Lembrar de mim" mantém por 7 dias. Cookie HttpOnly, SameSite=Lax, Secure em produção. | ✅ |
| BR-AUTH-009 | Redirect pós-login (`next`) só para o mesmo host (anti open-redirect). | ✅ |
| BR-AUTH-010 | Logout somente via POST com proteção CSRF. | ✅ |
| BR-AUTH-011 | Log de segurança: login_success, login_failed, login_blocked_inactive, register_success, logout (com IP). | ✅ |
| BR-AUTH-012 | Toda requisição que altera estado (POST/PUT/PATCH/DELETE) exige token CSRF válido (header `X-CSRF-Token`). *(generaliza BR-AUTH-010; no sistema antigo o CSRF cobria todos os formulários)* | ✅ |
| BR-AUTH-013 | O login gera um ID de sessão novo (contra fixação de sessão); o logout destrói a sessão no servidor. | ✅ |

## Posts de pets — BR-POST
| ID | Regra | Status |
|---|---|---|
| BR-POST-001 | Campos obrigatórios: título (≤150), descrição, status, tipo, localização (≤255), telefone de contato. | ✅ |
| BR-POST-002 | Listagens públicas mostram apenas `isActive=true` e `isResolved=false`, ordenadas por `createdAt` desc. | ✅ |
| BR-POST-003 | Listagem paginada com 12 itens; filtros opcionais `status` e `petType`; valores inválidos são ignorados. | ✅ |
| BR-POST-004 | Home mostra os 12 posts mais recentes elegíveis (BR-POST-002). | ✅ |
| BR-POST-005 | Marcar como resolvido: post sai das listagens, continua acessível pelo link. | ✅ |
| BR-POST-006 | Excluir post remove também as fotos (registro e arquivo). | ✅ registro · 🟡 arquivo (Etapa 5) |
| BR-POST-007 | Ao criar post, `status` pode vir pré-selecionado via `?status=lost|found`. | ✅ |

## Adoção — BR-ADOPT
| ID | Regra | Status |
|---|---|---|
| BR-ADOPT-001 | Campos obrigatórios: título, descrição, tipo, localização, telefone. Castrado/vacinado padrão false. | ✅ |
| BR-ADOPT-002 | Listagem: `isActive=true` e `isAdopted=false`, filtro `petType`, 12 por página. | ✅ |
| BR-ADOPT-003 | Marcar como adotado encerra o anúncio (sai das listagens), mas o link continua abrindo, com o aviso "adotado". Repetir não dá erro. | ✅ |
| BR-ADOPT-004 | Castrado e vacinado aparecem como selos no card e no detalhe; requisitos do adotante são texto livre opcional (até 2000 caracteres). | ✅ |

## Fotos — BR-PHOTO
| ID | Regra | Status |
|---|---|---|
| BR-PHOTO-001 | Máximo de **6** fotos por anúncio (criação e edição). Excedentes são ignoradas com aviso. *(Q-001 decidida: 6)* | ✅ |
| BR-PHOTO-002 | A primeira foto enviada é a principal. Se a principal for removida, a primeira restante vira principal. Sem foto marcada, a primeira é usada. | ✅ |
| BR-PHOTO-003 | Extensões aceitas: png, jpg, jpeg, gif, webp. Requisição de até 8 MB (413 acima disso). | ✅ |
| BR-PHOTO-004 | Toda imagem é re-codificada no servidor: rejeita não-imagem (o conteúdo manda, não a extensão), rejeita > 20 MP, aplica a rotação do EXIF, converte para RGB (fundo branco no lugar da transparência), redimensiona para no máx. 800 px de largura e salva em **JPEG** qualidade 85, **sem metadados** (o EXIF pode ter o GPS da casa de quem tirou a foto). O arquivo original nunca é salvo. GIF animado vira o primeiro quadro. | ✅ |
| BR-PHOTO-005 | Nome do arquivo = UUID aleatório + `.jpg`; o nome enviado pelo usuário é descartado. | ✅ |
| BR-PHOTO-006 | Falha em uma foto não impede salvar o anúncio nem as outras fotos (aviso ao usuário). | ✅ |
| BR-PHOTO-007 | Remover uma foto apaga o registro **e** o arquivo. Excluir o anúncio apaga os arquivos de todas as fotos. Falha ao apagar o arquivo só gera log, não erro. | ✅ |

## Geolocalização — BR-GEO
| ID | Regra | Status |
|---|---|---|
| BR-GEO-001 | Endereço é geocodificado via Nominatim (OSM), restrito ao Brasil, timeout 5 s, **depois** de responder ao usuário. Falha não impede salvar (fica sem coordenadas). | ✅ |
| BR-GEO-002 | Geocodificar **apenas** se o endereço mudou ou não há coordenadas. Endereço mudou → as coordenadas antigas são apagadas na hora. *(correção — o Flask geocodificava sempre na edição de posts)* | ✅ |
| BR-GEO-003 | Respeitar 1 requisição/s ao Nominatim (fila) e User-Agent identificado. *(correção)* | ✅ |
| BR-GEO-004 | `GET /api/v1/cep/:cep` consulta ViaCEP; aceita 8 dígitos (máscara ignorada); devolve só logradouro, bairro, cidade e UF; 400 formato inválido, 404 não encontrado, 502 serviço fora; 30 req/min por IP. | ✅ |

## Parceiros — BR-PARTNER
| ID | Regra | Status |
|---|---|---|
| BR-PARTNER-001 | Mapa público lista apenas parceiros `isActive=true` **com** coordenadas. | ✅ |
| BR-PARTNER-002 | CRUD exclusivo de admin; site precisa ser URL http/https. *(cadastro na Etapa 7; a API pública já esconde site que não é http/https)* | ✅ |
| BR-PARTNER-003 | Busca "perto de mim": distância em linha reta (Haversine) a partir de `lat`/`lng`, raio padrão 10 km (1 a 100), do mais perto para o mais longe. | ✅ |

## Validação e contato — BR-VAL / BR-CONTACT
| ID | Regra | Status |
|---|---|---|
| BR-VAL-001 | Telefone no formato `(XX) XXXX-XXXX` ou `(XX) XXXXX-XXXX`. | ✅ |
| BR-VAL-002 | Email válido, normalizado para minúsculas. | ✅ |
| BR-VAL-003 | Campos de texto opcionais: string vazia é salva como `null`; todos os textos com trim. | ✅ |
| BR-CONTACT-001 | Link WhatsApp: adiciona 55 em números com DDD (10–11 dígitos), aceita 55+DDD (12–13), rejeita 0800/0300 e números sem DDD; mensagem codificada como `urllib.parse.quote`. | ✅ |
| BR-CONTACT-002 | Botão flutuante "Fale com a gente" em todas as páginas públicas: abre uma conversa no WhatsApp **do Pets Post**, com a mensagem pronta. O número vem de `CONTACT_WHATSAPP` (configuração, não código); sem número válido, o botão não aparece. Não aparece no painel admin. | ✅ |

## Loja (vitrine) — BR-STORE
| ID | Regra | Status |
|---|---|---|
| BR-STORE-001 | A vitrine pública mostra só produtos ativos de parceiros ativos. Inativo (ou de parceiro inativo) dá 404 no detalhe. | ✅ |
| BR-STORE-002 | Categorias fixas (ração, petiscos, brinquedos, higiene, saúde, acessórios, camas); tipo de animal opcional (vazio = todos). | ✅ |
| BR-STORE-003 | Preço em centavos. Promoção só vale se for menor que o preço; o desconto exibido arredonda para baixo. | ✅ |
| BR-STORE-004 | Estoque é informativo: esgotado continua na vitrine com o aviso "Esgotado". | ✅ |
| BR-STORE-005 | O botão de compra leva para fora: link do produto → site do parceiro → WhatsApp do parceiro. Só http/https. | ✅ |
| BR-STORE-006 | Só o admin cadastra, edita e exclui produtos (PERM-003). Todo produto pertence a um parceiro existente. | ✅ |
| BR-STORE-007 | Até 6 fotos por produto, com as mesmas regras e o mesmo serviço dos anúncios (BR-PHOTO-*). | ✅ |
| BR-STORE-008 | Excluir um parceiro com produtos é bloqueado (409); é preciso excluir ou mover os produtos antes. | ✅ |
| BR-STORE-009 | Importar produto de um link (só admin): o servidor lê a página **uma vez** e preenche um rascunho para revisão (nada é salvo sem o admin confirmar). Lê os dados que a loja publica (schema.org `Product` em JSON-LD; senão Open Graph). Site que bloqueia ou não tem os dados → mensagem clara, sem erro. Não tenta burlar bloqueio de robôs. | ✅ |
| BR-STORE-010 | Busca segura de páginas e fotos: só `https`, porta 443, sem endereços internos (localhost, rede privada, link-local…) mesmo depois de redirecionamento, até 3 redirecionamentos, 8 s de tempo, até 3 MB de página e 8 MB por foto, User-Agent identificado do Pets Post. | ✅ |
| BR-STORE-011 | Todo produto guarda a data em que o preço foi conferido (`priceCheckedAt`): ao criar, ao mudar o preço e ao "Atualizar do link". A vitrine mostra "Preço consultado em DD/MM/AAAA — confirme na loja". | ✅ |

## Ajuda / FAQ — BR-FAQ
Detalhes em [specs/site/faq.md](../site/faq.md) (ADR 007).

| ID | Regra | Status |
|---|---|---|
| BR-FAQ-001 | Comparação ignora acentos, maiúsculas, pontuação, plural e palavras vazias; entende sinônimos. | ✅ |
| BR-FAQ-002 | Palavras-chave pesam mais que exemplos; resposta só acima de uma nota mínima. | ✅ |
| BR-FAQ-003 | A resposta vem com até 3 perguntas relacionadas. | ✅ |
| BR-FAQ-004 | Sem resposta boa: assuntos mais procurados + WhatsApp. | ✅ |
| BR-FAQ-005 | Todo link interno do FAQ existe no mapa de páginas. | ✅ |
| BR-FAQ-006 | O texto digitado não sai do navegador; a conversa fica só na aba. | ✅ |

## Admin — BR-ADMIN
| ID | Regra | Status |
|---|---|---|
| BR-ADMIN-001 | Dashboard: total de usuários, total de posts, ativos, resolvidos, perdidos e encontrados ativos; 5 posts e 5 usuários mais recentes. | ✅ |
| BR-ADMIN-002 | Admin (des)ativa usuários, exceto a si mesmo (PERM-005). | ✅ |
| BR-ADMIN-003 | Admin pode ocultar/reexibir anúncios (`isActive`). *(nova — no Flask o campo existia sem rota)* | ✅ |
| BR-ADMIN-004 | Dashboard inclui estatísticas e moderação de adoção. *(nova)* | ✅ |
| BR-ADMIN-005 | Desativar um usuário encerra todas as sessões dele na hora. *(nova — no Flask a sessão continuava até expirar)* | ✅ |

## Dados e operação — BR-DATA
| ID | Regra | Status |
|---|---|---|
| BR-DATA-001 | Seeds são idempotentes: registro cuja chave natural já existe é pulado (`users.email`, `pet_posts.title`, `adoption_posts.title`, `partners.name`). | ✅ |
| BR-DATA-002 | O seed de desenvolvimento (senhas conhecidas) recusa rodar com `NODE_ENV=production`. O seed de parceiros SP pode rodar em produção. | ✅ |
| BR-DATA-003 | Senhas criadas por seed usam `hashPassword` (BR-AUTH-004) e o admin de dev (`admin@petpost.com` / `Admin@123`) verifica com `verifyPassword`. | ✅ |
| BR-DATA-004 | O banco Flask existente é adotado por *baseline* (`migrate resolve --applied 0_init`), sem alterar dados. | ✅ |
| BR-DATA-005 | Testes de integração só rodam contra banco cujo nome termina em `_test` (proteção contra apagar dados reais). | ✅ |

## Questões em aberto
| ID | Pergunta | Proposta |
|---|---|---|
| Q-001 | Limite de fotos: README/model do Flask dizem 5, forms/rotas aplicam 6. | ✅ **6** (é o que roda em produção) · 2026-11-06 |
| Q-002 | Unificar `photos` + `adoption_photos` e `pet_posts` + `adoption_posts`? | ✅ **Não por enquanto** (2026-11-06): as tabelas ficam como no Flask, para o rollback continuar possível. O serviço de fotos é genérico e a adoção (Etapa 6) usa o mesmo código com a outra tabela. M-03 fica para depois da virada. |
