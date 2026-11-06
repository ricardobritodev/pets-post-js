/**
 * Produto /loja/produto/:id — BR-STORE-001/004/005. Open Graph injetado pelo servidor (ADR 002).
 */
import '../styles/main.css';
import { api } from '../lib/api.js';
import { mountLayout } from '../lib/layout.js';
import { el, formatDate } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { gallery } from '../lib/gallery.js';
import { row, loadDetail } from '../lib/detail-parts.js';
import { priceBlock, renderProductGrid } from '../lib/product-card.js';
import { formatBRL } from '@petspost/domain/store';

const root = document.getElementById('product');
const id = Number(/^\/loja\/produto\/(\d+)/.exec(location.pathname)?.[1]);

const BUY_LABEL = { product: 'Comprar na loja do parceiro', site: 'Ir para a loja do parceiro', whatsapp: 'Comprar pelo WhatsApp' };

function buyBox(p) {
  return el('section', { class: 'card space-y-4' },
    el('p', { class: 'text-sm text-stone-500' }, `${p.categoryLabel} · ${p.petTypeLabel}`),
    el('h1', { class: 'text-2xl font-bold leading-tight' }, p.name),
    priceBlock(p, { large: true }),
    p.discountPercent != null && el('p', { class: 'text-sm text-found-600' }, `Economia de ${formatBRL(p.priceCents - p.finalPriceCents)}`),
    // BR-STORE-011 — o preço é o que a loja mostrava na data da consulta.
    p.priceCheckedAt && el('p', { class: 'text-xs text-stone-500' }, `Preço consultado em ${formatDate(p.priceCheckedAt)}. Confirme na loja antes de comprar.`),
    el('p', { class: `flex items-center gap-1.5 text-sm font-medium ${p.inStock ? 'text-found-600' : 'text-lost-600'}` },
      icon(p.inStock ? 'check-circle' : 'x-circle', { size: 16 }),
      p.inStock ? `Em estoque (${p.stock} ${p.stock === 1 ? 'unidade' : 'unidades'} no parceiro)` : 'Esgotado no momento'),
    p.buyUrl
      ? el('a', {
        href: p.buyUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: `btn w-full py-3 text-base ${p.buyChannel === 'whatsapp' ? 'btn-whatsapp' : 'btn-primary'}`,
      }, icon(p.buyChannel === 'whatsapp' ? 'chat' : 'shopping-bag'), BUY_LABEL[p.buyChannel], icon('arrow-right', { size: 16 }))
      : el('p', { class: 'text-sm text-stone-500' }, 'Fale com o parceiro pelos contatos abaixo.'),
    el('p', { class: 'flex items-start gap-1.5 text-xs text-stone-500' }, icon('info', { size: 14, class: 'mt-0.5' }),
      'A compra, o pagamento e a entrega são feitos direto com o parceiro. O Pets Post só mostra o produto.'),
  );
}

function partnerCard(partner) {
  if (!partner) return null;
  return el('section', { class: 'card space-y-2' },
    el('h2', { class: 'flex items-center gap-2 text-lg font-semibold' }, icon('shopping-bag', { class: 'text-brand-600' }), 'Vendido por'),
    el('p', { class: 'font-medium' }, partner.name),
    el('p', { class: 'text-sm text-stone-500' }, partner.typeLabel),
    el('p', { class: 'flex items-start gap-1.5 text-sm text-stone-600' }, icon('map-pin', { size: 16, class: 'mt-0.5' }), partner.address),
    partner.phone && el('p', { class: 'text-sm' }, el('a', { href: `tel:${partner.phone.replace(/\D/g, '')}`, class: 'text-brand-700 hover:underline' }, partner.phone)),
    el('div', { class: 'flex flex-wrap gap-2 pt-1' },
      partner.whatsappUrl && el('a', { href: partner.whatsappUrl, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn-whatsapp btn-sm' }, icon('chat', { size: 14 }), 'WhatsApp'),
      el('a', { href: `/loja?partner=${partner.id}`, class: 'btn btn-outline btn-sm' }, 'Mais produtos'),
    ),
  );
}

async function moreFromPartner(p) {
  const box = el('section', { class: 'space-y-3' });
  try {
    const { items } = await api(`/store/products?partnerId=${p.partner.id}`);
    const others = items.filter((i) => i.id !== p.id).slice(0, 4);
    if (!others.length) return;
    box.append(el('h2', { class: 'text-lg font-semibold' }, `Mais de ${p.partner.name}`), renderProductGrid(others, null));
    root.append(box);
  } catch { /* opcional: sem a seção */ }
}

function render(p) {
  document.title = `${p.name} · Loja · Pets Post`;
  root.replaceChildren(
    el('nav', { class: 'mb-4 text-sm text-stone-500', 'aria-label': 'Você está em' },
      el('a', { href: '/', class: 'hover:underline' }, 'Início'), ' › ',
      el('a', { href: '/loja', class: 'hover:underline' }, 'Loja'), ' › ',
      el('a', { href: `/loja?category=${p.category}`, class: 'hover:underline' }, p.categoryLabel), ' › ',
      el('span', { 'aria-current': 'page' }, p.name),
    ),
    el('div', { class: 'mb-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]' },
      el('div', { class: 'space-y-6' },
        gallery({ ...p, petName: p.name }),
        p.description && el('section', { class: 'card' },
          el('h2', { class: 'mb-2 text-lg font-semibold' }, 'Descrição'),
          el('p', { class: 'whitespace-pre-line text-stone-700' }, p.description)),
      ),
      el('div', { class: 'space-y-6' },
        buyBox(p),
        partnerCard(p.partner),
        el('section', { class: 'card' }, el('dl', {}, row('Categoria', p.categoryLabel), row('Para', p.petTypeLabel))),
      ),
    ),
  );
  if (p.partner) moreFromPartner(p);
}

await mountLayout();
await loadDetail({ root, id, apiPath: '/store/products', key: 'product', render, listHref: '/loja', listLabel: 'Ver a loja' });
