# Health check ✅

## GET /api/v1/health
- Auth: pública
- 200 `{ "status": "ok", "uptime": <segundos> }`
- Uso: saber se o processo da API está de pé.

## GET /api/v1/health/db
- Auth: pública
- 200 `{ "status": "ok", "db": "up" }` — executou `SELECT 1` no MySQL
- 503 `{ "status": "error", "db": "down" }` — sem conexão
- Uso: diagnóstico de configuração (`DATABASE_URL`) e monitoramento.

Teste: `apps/api/test/app.test.js`
