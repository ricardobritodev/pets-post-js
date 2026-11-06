# doc/ — Documentação das features implementadas

Aqui fica o **registro do que já foi entregue** (o "como ficou").
O **que deve ser feito** (regras, contratos) fica em [`../specs`](../specs/README.md).

| Arquivo | Conteúdo |
|---|---|
| [ROADMAP.md](ROADMAP.md) | Etapas e micro tarefas da reescrita, com status |
| [features/](features/) | Uma página por etapa/feature entregue |

## Features entregues
| # | Feature | Etapa | Data |
|---|---|---|---|
| 001 | [Fundação do projeto](features/001-fundacao.md) | 1 | 2026-11-04 |
| 002 | [Banco de dados](features/002-banco.md) | 2 | 2026-11-05 |
| 003 | [Autenticação](features/003-autenticacao.md) | 3 | 2026-11-05 |
| 004 | [Posts perdidos/encontrados](features/004-posts.md) | 4 | 2026-11-05 |
| 005 | [Fotos, CEP, geocodificação e mapa](features/005-midia-geo.md) | 5 | 2026-11-06 |

## Como documentar uma feature nova
Crie `features/NNN-nome.md` usando o modelo abaixo e adicione na tabela acima.

```markdown
# NNN — Nome da feature
**Etapa:** X · **Data:** AAAA-MM-DD · **Specs:** links para BR/PERM/rotas

## O que foi entregue
## Como usar / testar
## Decisões e desvios da spec
## Pendências
```
