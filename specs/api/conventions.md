# Convenções da API HTTP

- Prefixo: `/api/v1`. Corpo e respostas em JSON (`application/json`), exceto upload (`multipart/form-data`).
- Campos em **camelCase**.
- Datas em ISO 8601 UTC (`2026-11-04T12:00:00.000Z`).
- Listagens paginadas:
  ```json
  { "items": [ ... ], "page": 1, "pageSize": 12, "total": 40, "totalPages": 4 }
  ```
- Erros:
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ { "path": "email", "message": "…" } ] } }
  ```

| HTTP | code | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | corpo/query não passa no schema zod |
| 400 | `INVALID_JSON` | JSON malformado |
| 401 | `UNAUTHENTICATED` | sem sessão |
| 403 | `FORBIDDEN` | sem permissão |
| 404 | `NOT_FOUND` | inexistente **ou** inativo sem permissão (PERM-002) |
| 409 | `CONFLICT` | ex.: email já cadastrado |
| 429 | `RATE_LIMITED` | limite excedido |
| 500 | `INTERNAL` | erro inesperado (mensagem genérica em produção) |
| 502/503 | `UPSTREAM_ERROR` / — | serviço externo ou banco fora |

## Modelo de spec de rota
```markdown
## POST /api/v1/posts/:id/resolve
- Auth: sessão obrigatória
- Permissão: PERM-001
- Request: vazio · Response 200: PostDTO
- Erros: 401 · 403 · 404
- Regras: BR-POST-005
- Teste: apps/api/test/posts.test.js "BR-POST-005 …"
```
