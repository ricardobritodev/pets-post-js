# ADR 006 — Fotos em disco, atrás de uma interface `storage`

**Status:** aceita · 2026-11-06

## Contexto
O Flask salva as fotos em `app/static/uploads/` e grava no banco a URL `/static/uploads/<arquivo>`.
A Q-005 perguntava se a v2 continuava em disco ou ia para S3/R2.

## Decisão
- Disco local, na pasta `UPLOAD_DIR` (padrão `apps/api/uploads/`).
- O código de fotos só fala com uma interface pequena: `save(nome, buffer)`, `remove(nome)` e
  `urlFor(nome)`. A implementação de disco fica em `apps/api/src/lib/storage.js`.
- O Express serve a pasta em `/uploads` e também em `/static/uploads`, para as URLs antigas do banco
  funcionarem sem migrar dados.
- Toda imagem é re-codificada com `sharp` antes de salvar (BR-PHOTO-004). O arquivo original nunca
  chega ao disco.

## Alternativas descartadas
- **S3/R2 agora:** mais custo e configuração para um projeto acadêmico, e a paridade com o Flask
  vem antes.
- **Processar com Pillow (como o Flask):** quebra a regra de stack 100% JS.

## Consequências
+ Paridade com o Flask, e o rollback continua possível (as URLs antigas valem nos dois).
+ Trocar por nuvem depois é escrever outra implementação de `storage`.
− Com mais de uma instância da API, as instâncias precisam dividir a mesma pasta (volume
  compartilhado) ou ir para nuvem.
− O backup precisa incluir a pasta de uploads, além do banco.
