# 00 — Visão geral

## Produto
Pets Post conecta quem **perdeu** um pet a quem **encontrou** um, divulga pets
para **adoção** e mostra um **mapa de parceiros** (lares temporários, petshops,
clínicas veterinárias). O contato entre pessoas é feito por **WhatsApp** (link `wa.me`).

Produção atual (Flask): https://www.petspost.com.br

## Glossário
| Termo | Significado |
|---|---|
| Post (pet post) | Anúncio de pet `lost` (perdido — dono procura) ou `found` (encontrado — alguém achou) |
| Resolvido (`isResolved`) | Pet reencontrou o dono; sai das listagens públicas |
| Anúncio de adoção | Pet disponível para adoção |
| Adotado (`isAdopted`) | Anúncio encerrado por adoção; sai das listagens |
| Ativo (`isActive`) | Visível publicamente. Inativo = oculto (só dono/admin veem) |
| Parceiro | Lar temporário, petshop ou clínica exibido no mapa |

## Atores
- **Visitante** — navega, filtra, vê detalhes, abre WhatsApp, vê o mapa.
- **Usuário** — tudo do visitante + cria/edita/remove os próprios anúncios.
- **Admin** — tudo do usuário + modera qualquer anúncio, (des)ativa usuários, gerencia parceiros.
- **Bot** (futuro) — cliente da API com token de serviço.

## Escopo da v2
Paridade funcional com a versão Flask + correções listadas em
`data/migration-plan.md` + chatbot (Telegram) em fase posterior.

## Fora de escopo (por enquanto)
Recuperação de senha por email, login social, chat interno, notificações.
