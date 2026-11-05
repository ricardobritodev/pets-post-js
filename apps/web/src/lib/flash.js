/**
 * flash.js — Mensagens que sobrevivem a um redirect (como o flash() do sistema antigo).
 * Guardadas no sessionStorage; mostradas uma vez pelo layout.
 */
const KEY = 'petspost.flash';

/** @param {'success'|'info'|'warning'|'danger'} type */
export function flash(message, type = 'info') {
  try {
    const list = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
    list.push({ message, type });
    sessionStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* sessionStorage indisponível (modo privado): a mensagem só se perde */
  }
}

/** Lê e apaga as mensagens pendentes. */
export function takeFlashes() {
  try {
    const list = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
    sessionStorage.removeItem(KEY);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
