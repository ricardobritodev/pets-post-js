# Tarefas transversais (fazer ao longo das etapas)

## Qualidade de código
- [ ] **X-01 — ESLint + Prettier** no monorepo (`npm run lint`, `npm run format`).
- [ ] **X-02 — Tipagem via JSDoc** + `// @ts-check` nos pacotes `domain` e `contracts`.
- [ ] **X-03 — Cobertura de testes** (`node --test --experimental-test-coverage`), meta ≥ 80% em `domain`.
- [ ] **X-04 — Hooks de git** (pre-commit: lint + testes unitários).

## CI
- [ ] **X-05 — GitHub Actions**: install, lint, testes unitários, `db:validate`, build do web.
- [ ] **X-06 — Integração na CI** com serviço MySQL.
- [ ] **X-07 — Checagem SDD**: script que lista BR-* de `rules.md` sem teste correspondente.
- [ ] **X-08 — OpenAPI** gerado a partir dos schemas zod (`zod-to-openapi`) em `specs/api/openapi.yaml`.

## Segurança
- [ ] **X-09 — Repositório remoto** (GitHub) e proteção do branch `main`. *(repositório criado; falta proteger o `main`)*
- [ ] **X-10 — Dependabot/Renovate** para atualizações.
- [ ] **X-11 — Revisão de segurança** ao final das Etapas 3, 5 e 7. *(Etapa 3 ✅, ver doc/features/003)*

## Observabilidade
- [ ] **X-12 — Logger `pino`** com request id; sem dados pessoais nos logs. *(pino + redact de senha feitos; falta request id e `pino-pretty` em dev)*

## Front / UX
- [ ] **X-13 — Acessibilidade**: labels, foco visível, contraste, `alt` nas fotos.
- [ ] **X-14 — Responsivo** (mobile primeiro — maior parte dos acessos vem do WhatsApp).
- [ ] **X-15 — Ícones SVG** (porta de `app/utils/icons.py` para módulo JS).
- [ ] **X-16 — Página 404** e estados vazios/carregando/erro em todas as listas.
