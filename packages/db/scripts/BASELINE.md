# Baseline do banco Flask (BR-DATA-004)

Faz o Prisma Migrate **adotar** um banco criado pelo Pets Post (Flask) sem recriar nada e
sem alterar nenhum dado. Código: `packages/db/src/baseline.js` · CLI: `scripts/baseline.js`.

## O que o banco Flask tem de diferente
O DDL foi gerado pelo SQLAlchemy a partir dos models (veja `flask-mock/flask-mock.sql`).
As colunas e os tipos batem com o `schema.prisma`, mas a **estrutura** não:

| Diferença | Efeito se ignorada |
|---|---|
| Sem `DEFAULT` no banco (eram do ORM) | inserts manuais/SQL sem a coluna falham |
| FKs de fotos sem `ON DELETE CASCADE` | **excluir post com fotos falha (P2003)**, quebra BR-POST-006 |
| Nomes de índices/FKs (`ix_users_email`, `pet_posts_ibfk_1`, ...) | `prisma migrate dev` acusa *drift* |
| Tabela `alembic_version` | mantida de propósito (rollback para o Flask) |

Por isso o baseline tem 3 partes:
1. **Alinhar a estrutura** (DDL gerado por `prisma migrate diff`) ao schema do momento da `0_init`.
   Esse schema fica guardado em `scripts/baseline-target.prisma`, que não deve ser editado.
2. **Registrar** a `0_init` como aplicada (`prisma migrate resolve`).
3. **Aplicar as migrations seguintes** (`1_sessions`, ...) com `prisma migrate deploy`.

O alvo é a foto da `0_init`, e não o schema atual, por um motivo: se o alinhamento criasse por fora
as tabelas das migrations novas, o `deploy` falharia depois com "table already exists".

## Passo a passo (produção)

> Nunca rode `--apply` direto em produção sem testar na cópia antes.

```bash
# 1. Backup
mysqldump --single-transaction --routines -u USER -p petpost_prod > petpost_prod.sql

# 2. Restaurar numa cópia local
mysql -u root -e "CREATE DATABASE petpost_copia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root petpost_copia < petpost_prod.sql

# 3. Relatório (só leitura): contagens, órfãos e o SQL que seria executado
npm run db:baseline -- --url "mysql://USER:SENHA@localhost:3306/petpost_copia"

# 4. Aplicar na cópia e conferir a verificação no final (tudo true)
npm run db:baseline -- --url "mysql://USER:SENHA@localhost:3306/petpost_copia" --apply

# 5. Só então, em produção (janela de manutenção, Flask parado):
npm run db:baseline -- --url "$DATABASE_URL_PROD" --apply

# 6. Daí em diante, migrations novas só com:
npm run db:deploy
```

O SQL executado fica em `packages/db/scripts/output/<banco>/baseline-align.sql` (ignorado pelo git).

## Garantias do script
- **Recusa** se houver registros órfãos (foto sem post, post sem dono): a FK nova falharia.
- **Converge**: DDL no MySQL não é transacional. Se um comando falhar no meio, o diff é
  recalculado a partir do estado real e reaplicado (até 3 passadas). Isso acontece de verdade
  no MySQL 9+/26: ao remover a FK o índice implícito antigo some, e o `RENAME INDEX` planejado
  falha; a passada 2 corrige. Também torna o processo **retomável** após uma queda.
- **Idempotente**: rodar de novo num banco já adotado não muda nada.
- **Verifica** no final: diff vazio, `migrate status` ok, `0_init` registrada e contagem de
  linhas idêntica à de antes.

## Testar localmente com o banco simulado
```bash
mysql -u root petpost_flask_mock < packages/db/scripts/flask-mock/flask-mock.sql
npm run db:baseline -- --url "mysql://petpost_user:petpost123@localhost:3306/petpost_flask_mock" --apply
```
O teste automatizado (`packages/db/integration/baseline.int.js`, dentro de
`npm run test:integration`) faz isso no banco `petpost_flask_mock_test` e confere, linha a
linha, que nenhum dado mudou.
