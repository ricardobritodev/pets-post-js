# ADR 003 — Hash de senha compatível com Werkzeug

**Status:** aceita · 2026-11-04 · **validada** · 2026-11-05

## Contexto
O banco herdado guarda `password_hash` no formato do Werkzeug
(`scrypt:32768:8:1$salt$hex`, ou `pbkdf2:sha256:N$salt$hex` em contas antigas).
Trocar o algoritmo sem compatibilidade deslogaria todos os usuários para sempre.

## Decisão
Implementar em `packages/domain/src/password.js`, só com `node:crypto`:
- `verifyPassword` aceita `scrypt:*` e `pbkdf2:*` do Werkzeug (comparação em tempo constante);
- `hashPassword` gera **no mesmo formato** `scrypt:32768:8:1` (= padrão do Werkzeug 3.x);
- `needsRehash` sinaliza hashes legados para regerar após login.

## Alternativas descartadas
- argon2/bcrypt: exigem dependência nativa e um período de convivência de formatos.

## Validação
- Vetores PBKDF2 gerados pelo Werkzeug 3.1.3 real.
- Primitiva scrypt validada com o vetor oficial da RFC 7914.
- Hashes `scrypt:32768:8:1` gerados pelo Werkzeug 3.1.3 real (Python 3.13 + OpenSSL 3) verificam, e
  um hash gerado pela v2 é aceito pelo `check_password_hash` do Werkzeug (ver doc/features/002).

## Consequências
+ Migração transparente e rollback para o Flask possível.
