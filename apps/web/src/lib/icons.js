/**
 * icons.js — Ícones SVG no navegador (substituem os emojis).
 *
 *   icon('trash')                       decorativo (aria-hidden), 20 px
 *   icon('paw', { size: 48, label: 'Pets Post' })   com nome para leitor de tela
 *
 * No HTML estático, use <i data-icon="nome" data-size="16" class="..."></i>: o plugin do Vite
 * troca pelo SVG no build (vite.config.js), sem esperar o JavaScript.
 */
import { ICONS, BRAND_ICONS } from './icon-data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {string} name
 * @param {{ size?: number, class?: string, label?: string }} [options]
 * @returns {SVGSVGElement}
 */
export function icon(name, { size = 20, class: className = '', label } = {}) {
  const shapes = ICONS[name];
  if (!shapes) throw new Error(`ícone desconhecido: ${name}`);
  const svg = document.createElementNS(SVG_NS, 'svg');
  const attrs = {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    class: ['icon', className].filter(Boolean).join(' '),
  };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, String(v));
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  for (const [tag, shapeAttrs] of shapes) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(shapeAttrs)) node.setAttribute(k, v);
    svg.append(node);
  }
  return svg;
}

/**
 * Logo de marca preenchido (ex.: o do WhatsApp nos botões que abrem conversa).
 * @param {keyof typeof BRAND_ICONS} name
 * @param {{ size?: number, class?: string, label?: string }} [options]
 */
export function brandIcon(name, { size = 24, class: className = '', label } = {}) {
  const d = BRAND_ICONS[name];
  if (!d) throw new Error(`logo desconhecido: ${name}`);
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'currentColor', class: ['icon', className].filter(Boolean).join(' ') })) {
    svg.setAttribute(k, String(v));
  }
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}
