# 009 — Botão de WhatsApp do site ("Fale com a gente")

**Data:** 2026-11-06 · **Specs:** [site.md](../../specs/api/site.md) · [rules.md](../../specs/domain/rules.md) (BR-CONTACT-002)

## O que foi entregue
- **Botão flutuante verde** no canto inferior direito de todas as páginas públicas. Ele abre uma conversa no
  WhatsApp **do Pets Post** com a mensagem pronta: "Olá! Vim pelo site do Pets Post e gostaria de ajuda.".
  No desktop aparece como "Fale com a gente"; no celular, um círculo com o ícone. Não aparece no painel admin.
- **O número vem da configuração (`CONTACT_WHATSAPP`), não do código:** dá para trocar sem novo deploy, só
  reiniciando a API. A mensagem pode ser trocada com `CONTACT_WHATSAPP_MESSAGE`.
- **Sem número, o botão não aparece.** Número que não serve para WhatsApp (0800, sem DDD) impede a API de subir,
  com a mensagem `CONTACT_WHATSAPP: número inválido…`, para o erro não passar despercebido.
- **`GET /api/v1/site`:** devolve o link pronto (`wa.me`, com a mesma codificação dos outros links, BR-CONTACT-001).
  Não cria sessão, e o navegador guarda a resposta por 5 minutos.

Os botões de WhatsApp que já existiam continuam iguais: falar com quem publicou o anúncio (posts e
adoção), com o parceiro (mapa) e para comprar um produto (loja).

## Como configurar
```bash
# .env (dev) ou /etc/petspost/petspost.env (produção)
CONTACT_WHATSAPP=(11) 91234-5678
```
Depois, **reinicie a API**: em dev, pare o `npm run dev` (Ctrl+C) e rode de novo; em produção,
`sudo systemctl restart petspost`. O `node --watch` do dev recarrega quando o código muda, mas **não** quando
o `.env` muda.

Para conferir: `curl localhost:3000/api/v1/site` deve mostrar o link `wa.me` em vez de `null`.

## Testes
- `apps/api/test/app.test.js`: rota sem número (`null`, sem cookie de sessão), número válido virando link com a
  mensagem padrão e a configurada, e número inválido barrando a inicialização.
- Chrome headless em modo produção, com um número de exemplo: botão no desktop e no celular, link e
  `target=_blank` certos, e ausente no `/admin`.
