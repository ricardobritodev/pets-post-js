# API — Configuração pública do site

Regras: BR-CONTACT-002 · Convenções: [conventions.md](conventions.md)

## GET /api/v1/site
- Auth: não · Cache: `public, max-age=300`
- Response 200:
  ```json
  { "contact": { "whatsappUrl": "https://wa.me/5511912345678?text=Ol%C3%A1!..." } }
  ```
- `whatsappUrl` é `null` quando `CONTACT_WHATSAPP` não está configurado (o botão flutuante some).
- Mensagem padrão: `Olá! Vim pelo site do Pets Post e gostaria de ajuda.` (troca com `CONTACT_WHATSAPP_MESSAGE`).

## Configuração (`.env`)
| Variável | Exemplo | Regra |
|---|---|---|
| `CONTACT_WHATSAPP` | `(11) 91234-5678` ou `5511912345678` | precisa virar um link `wa.me` válido (BR-CONTACT-001); senão a API não sobe, com mensagem clara |
| `CONTACT_WHATSAPP_MESSAGE` | `Olá! Quero ajuda com um anúncio.` | opcional, até 300 caracteres |

## Front
- Botão redondo verde fixo no canto inferior direito, com o texto "Fale com a gente" (que aparece em telas
  grandes) e `aria-label` sempre.
- Aparece em todas as páginas que usam o layout comum, **menos** no painel admin.
- Abre em nova aba (`target=_blank`, `rel=noopener noreferrer`). No celular, o link `wa.me` abre o app.
- O front guarda a configuração por 5 minutos (`sessionStorage`), para não buscar a cada página.
