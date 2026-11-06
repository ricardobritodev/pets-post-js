# Site — FAQ / chatbot de ajuda

Regras: BR-FAQ-001..006 · ADR [007](../adr/007-chatbot-faq-no-site.md) · Conteúdo: `packages/domain/src/faq.js`

## Formato de uma pergunta
```js
{
  id: 'publicar-perdido',             // único, kebab-case (vira âncora em /ajuda#publicar-perdido)
  topic: 'anuncios',                  // agrupa na página /ajuda
  question: 'Como publico um anúncio de pet perdido?',
  answer: 'Texto curto, em parágrafos separados por \n\n.',
  examples: ['perdi meu cachorro', 'sumiu meu gato', ...],   // jeitos de perguntar (ajudam a achar)
  keywords: ['perdi', 'sumiu', 'fugiu'],                      // palavras fortes (pesam mais)
  links: [{ label: 'Publicar anúncio', href: '/posts/criar?status=lost' }, { label: 'Falar com a gente', href: 'contact:whatsapp' }],
}
```
- `href` é um caminho do site (precisa existir em `page-routes.js`) ou `contact:whatsapp` (link do botão
  flutuante; se não houver número configurado, esse link não aparece).

## Regras
| ID | Regra |
|---|---|
| BR-FAQ-001 | A comparação ignora acentos, maiúsculas, pontuação, plural simples e palavras vazias ("como", "o", "de"…), e entende sinônimos. |
| BR-FAQ-002 | Pontuação: palavras-chave pesam mais que os exemplos. A melhor pergunta precisa passar de uma nota mínima para virar resposta. |
| BR-FAQ-003 | Junto com a resposta vêm até 3 perguntas relacionadas (as próximas melhores notas). |
| BR-FAQ-004 | Sem resposta boa: mensagem "Não encontrei…", os assuntos mais procurados e o link do WhatsApp. |
| BR-FAQ-005 | Todo link interno do FAQ aponta para uma página que existe (teste automático). |
| BR-FAQ-006 | O que a pessoa digita não sai do navegador. A conversa fica só na aba (`sessionStorage`) e some ao fechá-la. |

## Interface
- **Botão "Ajuda"** (laranja) no canto inferior direito; o do WhatsApp fica no esquerdo, na mesma altura. Abre uma janela com:
  - saudação e atalhos para os assuntos mais procurados;
  - campo "Digite sua dúvida";
  - respostas com os botões de link e "Perguntas relacionadas".
- **Acessibilidade:** janela com `role="dialog"`, Esc fecha, o foco vai para o campo ao abrir e volta para o
  botão ao fechar, e as mensagens novas são anunciadas por `aria-live`.
- **Página `/ajuda`:** todas as perguntas por assunto, abrindo e fechando sem JavaScript (`<details>`), cada
  uma com âncora. O rodapé ganha o link "Ajuda".
- Não aparece no painel admin.
