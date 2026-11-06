/**
 * help-chat.js — Chatbot de ajuda: FAQ dentro do site (ADR 007 · specs/site/faq.md).
 *
 * Tudo roda no navegador: a pergunta é comparada com o FAQ por askFaq() e nada do que a pessoa
 * digita é enviado ao servidor (BR-FAQ-006). A conversa fica só nesta aba (sessionStorage).
 */
import { askFaq, faqById, popularFaq } from '@petspost/domain/faq';
import { el } from './dom.js';
import { icon } from './icons.js';
import { floatStack } from './float-stack.js';
import { contactWhatsappUrl } from './contact-button.js';

const STORE_KEY = 'petspost.help';
const GREETING = 'Oi! Sou a ajuda do Pets Post. Escreva sua dúvida ou escolha um assunto:';
const NOT_FOUND = 'Não encontrei uma resposta para isso. Veja se é algum destes assuntos, ou fale com a nossa equipe:';

/** Histórico da conversa nesta aba: { role: 'user'|'bot', text?, answerId?, relatedIds?, fallback? }[] */
function loadHistory() {
  try {
    const data = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? '[]');
    return Array.isArray(data) ? data.slice(-40) : [];
  } catch {
    return [];
  }
}
function saveHistory(history) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-40)));
  } catch { /* sem histórico, tudo bem */ }
}

export function mountHelpChat() {
  if (location.pathname.startsWith('/admin') || document.getElementById('help-launcher')) return;

  const history = loadHistory();
  let whatsappUrl = null;
  const panelId = 'help-panel';

  const messages = el('div', { class: 'help-messages', 'aria-live': 'polite', 'aria-relevant': 'additions' });
  const input = el('input', {
    type: 'text', id: 'help-input', class: 'help-input', maxlength: '200', autocomplete: 'off',
    placeholder: 'Digite sua dúvida…', 'aria-label': 'Digite sua dúvida',
  });
  const form = el('form', { class: 'help-form', onsubmit: (e) => { e.preventDefault(); ask(input.value); } },
    input,
    el('button', { type: 'submit', class: 'help-send', 'aria-label': 'Enviar' }, icon('paper-airplane', { size: 18 })),
  );

  const launcher = el('button', {
    type: 'button',
    id: 'help-launcher',
    class: 'help-launcher',
    'aria-controls': panelId,
    'aria-expanded': 'false',
    'aria-label': 'Abrir a ajuda do Pets Post',
    onclick: () => (panel.hidden ? open() : close()),
  }, icon('question-mark-circle', { size: 26 }), el('span', { class: 'help-launcher-label' }, 'Ajuda'));

  const panel = el('section', {
    id: panelId, class: 'help-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'help-title', hidden: true,
    onkeydown: (e) => e.key === 'Escape' && close(),
  },
    el('header', { class: 'help-header' },
      el('span', { class: 'flex items-center gap-3' },
        el('img', { src: '/brand/logo-white.png', alt: '', width: '110', height: '22', class: 'h-[22px] w-auto' }),
        el('h2', { id: 'help-title', class: 'text-base font-semibold' }, 'Ajuda')),
      el('div', { class: 'flex items-center gap-1' },
        el('button', { type: 'button', class: 'help-icon-button', title: 'Recomeçar a conversa', 'aria-label': 'Recomeçar a conversa', onclick: restart },
          icon('arrow-uturn-left', { size: 18 })),
        el('button', { type: 'button', class: 'help-icon-button', 'aria-label': 'Fechar a ajuda', onclick: close }, icon('x-mark', { size: 20 })),
      ),
    ),
    messages,
    form,
    el('p', { class: 'help-footnote' }, 'Respostas do FAQ. ', el('a', { href: '/ajuda', class: 'underline' }, 'Ver todas as perguntas')),
  );

  // ---- desenho das mensagens ----
  const chip = (entry) => el('button', { type: 'button', class: 'help-chip', onclick: () => showEntry(entry.id) }, entry.question);

  function linkButtons(entry) {
    const links = entry.links
      .map((l) => (l.href === 'contact:whatsapp' ? (whatsappUrl ? { ...l, href: whatsappUrl, external: true } : null) : l))
      .filter(Boolean);
    if (!links.length) return null;
    return el('div', { class: 'mt-3 flex flex-col gap-2' }, ...links.map((l) =>
      el('a', {
        href: l.href,
        class: `help-link ${l.external ? 'help-link-whatsapp' : ''}`,
        ...(l.external && { target: '_blank', rel: 'noopener noreferrer' }),
      }, icon(l.external ? 'chat' : 'arrow-right', { size: 16 }), l.label)));
  }

  function botBubble(...children) {
    return el('div', { class: 'help-bubble help-bubble-bot' }, ...children);
  }

  function render(msg) {
    if (msg.role === 'user') return el('div', { class: 'help-bubble help-bubble-user' }, msg.text);
    if (msg.greeting) {
      return botBubble(el('p', {}, GREETING), el('div', { class: 'mt-2 flex flex-col gap-1.5' }, ...popularFaq().map(chip)));
    }
    if (msg.fallback) {
      const related = (msg.relatedIds ?? []).map(faqById).filter(Boolean);
      const options = related.length ? related : popularFaq();
      return botBubble(
        el('p', {}, NOT_FOUND),
        el('div', { class: 'mt-2 flex flex-col gap-1.5' }, ...options.map(chip)),
        whatsappUrl && el('a', { href: whatsappUrl, target: '_blank', rel: 'noopener noreferrer', class: 'help-link help-link-whatsapp mt-3' },
          icon('chat', { size: 16 }), 'Falar com a gente no WhatsApp'),
      );
    }
    const entry = faqById(msg.answerId);
    if (!entry) return null;
    const related = (msg.relatedIds ?? []).map(faqById).filter(Boolean);
    return botBubble(
      el('p', { class: 'font-semibold' }, entry.question),
      ...entry.answer.split('\n\n').map((p) => el('p', { class: 'mt-2' }, p)),
      linkButtons(entry),
      related.length > 0 && el('div', { class: 'mt-3 border-t border-stone-200 pt-2' },
        el('p', { class: 'mb-1.5 text-xs font-medium text-stone-500' }, 'Perguntas relacionadas'),
        el('div', { class: 'flex flex-col gap-1.5' }, ...related.map(chip))),
    );
  }

  function push(msg) {
    history.push(msg);
    saveHistory(history);
    const node = render(msg);
    if (node) messages.append(node);
    messages.scrollTop = messages.scrollHeight;
  }

  function renderAll() {
    messages.replaceChildren(...history.map(render).filter(Boolean));
    messages.scrollTop = messages.scrollHeight;
  }

  // ---- ações ----
  function ask(text) {
    const question = text.trim().slice(0, 200);
    if (!question) return;
    input.value = '';
    push({ role: 'user', text: question });
    const { answer, related } = askFaq(question);
    if (answer) push({ role: 'bot', answerId: answer.id, relatedIds: related.map((e) => e.id) });
    else push({ role: 'bot', fallback: true, relatedIds: related.map((e) => e.id) });
  }

  function showEntry(id) {
    const entry = faqById(id);
    if (!entry) return;
    push({ role: 'user', text: entry.question });
    const related = askFaq(entry.question).related.map((e) => e.id);
    push({ role: 'bot', answerId: id, relatedIds: related });
  }

  function restart() {
    history.length = 0;
    push({ role: 'bot', greeting: true });
    input.focus();
  }

  /** A janela abre logo acima do botão "Ajuda" (que sobe quando o botão do WhatsApp está na tela). */
  function place() {
    const top = launcher.getBoundingClientRect().top;
    panel.style.bottom = `${Math.max(16, window.innerHeight - top + 12)}px`;
  }

  function open() {
    place();
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    if (!history.length) push({ role: 'bot', greeting: true });
    else renderAll();
    input.focus();
  }

  function close() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  const stack = floatStack();
  stack.append(launcher);
  document.body.append(panel);

  // O link do WhatsApp chega depois (configuração do servidor); redesenha se a janela estiver aberta.
  contactWhatsappUrl().then((url) => {
    whatsappUrl = url;
    if (!panel.hidden) {
      place();
      renderAll();
    }
  });
  window.addEventListener('resize', () => !panel.hidden && place());
}
