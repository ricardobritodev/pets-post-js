# Matriz de permissões

Implementação: `packages/domain/src/permissions.js`

| ID | Ação | Visitante | Usuário | Dono | Admin |
|---|---|:-:|:-:|:-:|:-:|
| — | Ver listagens, detalhes de anúncio ativo, mapa | ✅ | ✅ | ✅ | ✅ |
| — | Criar post / anúncio de adoção | ❌ → 401 | ✅ | — | ✅ |
| PERM-001 | Editar, excluir, resolver, marcar adotado | ❌ 401 | ❌ 403 | ✅ | ✅ |
| PERM-002 | Ver anúncio **inativo** | ❌ **404** | ❌ **404** | ✅ | ✅ |
| PERM-003 | Painel admin, gerenciar parceiros, moderar | ❌ 401 | ❌ 403 | ❌ 403 | ✅ |
| PERM-004 | Logar com conta inativa | — | ❌ | ❌ | ❌ |
| PERM-005 | Desativar usuário | ❌ | ❌ | ❌ | ✅ exceto a si mesmo |

Notas
- PERM-002 responde **404 e não 403** para não revelar que o anúncio existe.
- Rotas que exigem login respondem **401** para não autenticados (a API é JSON;
  o front decide redirecionar para `/login?next=...`).
