/**
 * /ajuda — todas as perguntas do FAQ por assunto (ADR 007 · specs/site/faq.md).
 * Abre e fecha com <details> (funciona sem JS depois de desenhado); cada pergunta tem âncora (#id).
 */
import '../styles/main.css';
import { FAQ, FAQ_TOPICS, askFaq } from '@petspost/domain/faq';
import { mountLayout } from '../lib/layout.js';
import { contactWhatsappUrl } from '../lib/contact-button.js';
import { el } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

const list = document.getElementById('faq-list');
const search = document.getElementById('faq-q');
let whatsappUrl = null;

function item(entry, { open = false } = {}) {
  const links = entry.links
    .map((l) => (l.href === 'contact:whatsapp' ? (whatsappUrl ? { ...l, href: whatsappUrl, external: true } : null) : l))
    .filter(Boolean);
  return el('details', { id: entry.id, class: 'faq-item', ...(open && { open: true }) },
    el('summary', {}, el('span', {}, entry.question), icon('arrow-right', { size: 16, class: 'shrink-0 text-stone-400' })),
    el('div', { class: 'space-y-2 px-4 pb-4 text-stone-700' },
      ...entry.answer.split('\n\n').map((p) => el('p', {}, p)),
      links.length > 0 && el('div', { class: 'flex flex-wrap gap-2 pt-2' }, ...links.map((l) =>
        el('a', {
          href: l.href,
          class: `btn btn-sm ${l.external ? 'btn-whatsapp' : 'btn-outline'}`,
          ...(l.external && { target: '_blank', rel: 'noopener noreferrer' }),
        }, l.label))),
    ),
  );
}

function renderAll() {
  const hash = decodeURIComponent(location.hash.slice(1));
  list.replaceChildren(...Object.entries(FAQ_TOPICS).map(([topic, title]) => {
    const entries = FAQ.filter((e) => e.topic === topic);
    if (!entries.length) return null;
    return el('section', { class: 'space-y-3' },
      el('h2', { class: 'text-lg font-semibold' }, title),
      ...entries.map((e) => item(e, { open: e.id === hash })));
  }).filter(Boolean));
  if (hash) document.getElementById(hash)?.scrollIntoView({ block: 'center' });
}

/** Busca com o mesmo "cérebro" do chat: a melhor resposta aberta, mais as relacionadas. */
function renderSearch(text) {
  const { answer, related, suggestions } = askFaq(text);
  const found = [answer, ...related].filter(Boolean);
  list.replaceChildren(
    el('section', { class: 'space-y-3' },
      el('h2', { class: 'text-lg font-semibold' }, found.length ? 'Resultados' : 'Nada encontrado. Talvez seja um destes:'),
      ...(found.length ? found : suggestions).map((e, i) => item(e, { open: Boolean(answer) && i === 0 })),
      el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { search.value = ''; renderAll(); } }, 'Ver todas as perguntas'),
    ),
  );
}

let timer;
search.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => (search.value.trim() ? renderSearch(search.value) : renderAll()), 200);
});
document.getElementById('faq-search').addEventListener('submit', (e) => e.preventDefault());

mountLayout();
renderAll();
contactWhatsappUrl().then((url) => {
  whatsappUrl = url;
  if (!search.value.trim()) renderAll();
});
