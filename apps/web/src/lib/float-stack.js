/**
 * float-stack.js — Coluna fixa no canto inferior direito onde ficam os botões flutuantes
 * (ajuda em cima, WhatsApp embaixo), para um não cobrir o outro.
 */
import { el } from './dom.js';

export function floatStack() {
  let stack = document.getElementById('float-stack');
  if (!stack) {
    stack = el('div', { id: 'float-stack', class: 'float-stack' });
    document.body.append(stack);
  }
  return stack;
}
