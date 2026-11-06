/**
 * contact-button.js — Botão flutuante "Fale com a gente" no WhatsApp do Pets Post (BR-CONTACT-002).
 * O link vem de GET /api/v1/site (número configurado no servidor). Sem número, nada aparece.
 */
import { api } from './api.js';
import { el } from './dom.js';
import { icon } from './icons.js';

const CACHE_KEY = 'petspost.site';
const CACHE_MS = 5 * 60 * 1000;

/** Configuração do site, guardada por 5 min para não buscar a cada página. */
async function siteConfig() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null');
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  } catch { /* sessionStorage indisponível ou corrompido: busca de novo */ }
  const data = await api('/site');
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch { /* sem cache, tudo bem */ }
  return data;
}

export async function mountContactButton() {
  if (location.pathname.startsWith('/admin') || document.getElementById('whatsapp-float')) return;
  let url;
  try {
    url = (await siteConfig()).contact?.whatsappUrl;
  } catch {
    return; // API fora do ar: sem botão
  }
  if (!url) return;
  document.body.append(
    el('a', {
      id: 'whatsapp-float',
      href: url,
      target: '_blank',
      rel: 'noopener noreferrer',
      class: 'whatsapp-float',
      'aria-label': 'Fale com o Pets Post pelo WhatsApp (abre em nova aba)',
    }, icon('chat', { size: 26 }), el('span', { class: 'whatsapp-float-label' }, 'Fale com a gente')),
  );
}
