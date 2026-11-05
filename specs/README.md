# specs/ — Fonte da verdade (Spec-Driven Development)

Toda funcionalidade nasce aqui **antes** do código. O fluxo é:

1. **Especificar** — regra em `domain/rules.md` (ID `BR-xxx`), permissão em
   `domain/permissions.md` (ID `PERM-xxx`), contrato da rota em `api/*.md`.
2. **Contrato executável** — schema zod em `packages/contracts` espelhando a spec.
3. **Teste** — cada teste cita o ID da regra no nome (ex.: `BR-AUTH-002 senha curta…`).
4. **Implementação** — só depois do teste existir.
5. **Documentar** — feature entregue é registrada em `doc/features/`.

Se código e spec divergirem, **a spec vence**: corrija o código ou abra uma
alteração na spec (com justificativa) antes.

| Pasta | Conteúdo |
|---|---|
| `00-overview.md` | Visão do produto, glossário, atores, escopo |
| `domain/` | Entidades, regras de negócio, matriz de permissões |
| `data/` | Plano de migração do banco herdado |
| `api/` | Convenções HTTP e contrato de cada rota |
| `adr/` | Decisões de arquitetura (Architecture Decision Records) |

Para localizar onde uma regra é testada:

```bash
grep -rn "BR-AUTH-004" packages apps
```
