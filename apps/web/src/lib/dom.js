/**
 * dom.js — Criação de elementos sem innerHTML (texto do usuário nunca vira HTML).
 *
 *   el('a', { href: '/x', class: 'btn' }, 'Texto', outroNode)
 *   - atributos `on*` viram addEventListener
 *   - valores false/null/undefined são ignorados (atributo e filhos)
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter((c) => c !== false && c !== null && c !== undefined));
  return node;
}

/** Data em pt-BR (dd/mm/aaaa). */
export const formatDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
