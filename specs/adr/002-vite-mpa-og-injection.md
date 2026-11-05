# ADR 002 — Vite MPA + JS puro + Tailwind, com injeção de Open Graph

**Status:** aceita · 2026-11-04

## Contexto
O canal principal do produto é o **compartilhamento de links no WhatsApp**. Uma SPA
pura não gera preview (título, foto) porque os robôs não executam JS.

## Decisão
- Vite em modo multi-page: uma entrada HTML por página, JS puro em módulos ES.
- Tailwind CSS v4 via `@tailwindcss/vite`.
- Em produção o Express serve `apps/web/dist` e, nas páginas de detalhe
  (`/posts/:id`, `/adocao/:id`), injeta `<title>`, `og:title`, `og:description`,
  `og:image` antes de enviar o HTML.
- Dados via API JSON (`/api/v1`). Em dev, o Vite faz proxy de `/api` para o Express.

## Consequências
+ Sem framework SPA; páginas leves.
+ Preview de link preservado.
− Um pequeno "template" no servidor para as meta tags.
