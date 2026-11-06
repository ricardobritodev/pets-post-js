/**
 * layout.js — Header, mensagens e rodapé comuns a todas as páginas (T3.11).
 *
 * Cada página HTML tem <div id="app-header">, <div id="app-flash"> e <footer id="app-footer">,
 * e chama mountLayout() no seu script. Dados do usuário entram só via textContent (sem XSS).
 */
import { getMe, logout } from './session.js';
import { flash, takeFlashes } from './flash.js';
import { el } from './dom.js';
import { icon } from './icons.js';
import { mountContactButton } from './contact-button.js';

/**
 * Menu da faixa laranja. A organização (logo + busca grande + conta em cima, menu embaixo) segue o
 * jeito das lojas pet; cores, textos e ícones são do Pets Post.
 */
const NAV = [
  { href: '/', label: 'Início', iconName: 'home' },
  { href: '/posts/', label: 'Perdidos e encontrados', iconName: 'megaphone' },
  { href: '/adocao/', label: 'Adoção', iconName: 'heart' },
  { href: '/loja', label: 'Loja', iconName: 'shopping-bag' },
  { href: '/mapa', label: 'Mapa de parceiros', iconName: 'map' },
  { href: '/sobre', label: 'Sobre', iconName: 'info' },
];

const isCurrent = (href) =>
  href === '/' ? location.pathname === '/' : location.pathname.startsWith(href.replace(/\/$/, ''));

function navLinks(className, { withIcons = false } = {}) {
  return NAV.map(({ href, label, iconName }) =>
    el('a', { href, class: className, ...(isCurrent(href) && { 'aria-current': 'page' }) },
      withIcons && icon(iconName, { size: 16 }), label),
  );
}

/** Busca da loja (vai para /loja?q=). */
function searchForm(id) {
  const q = location.pathname.startsWith('/loja') ? new URLSearchParams(location.search).get('q') ?? '' : '';
  return el('form', { action: '/loja', method: 'get', role: 'search', class: 'header-search' },
    el('label', { for: id, class: 'sr-only' }, 'Buscar produtos na loja'),
    el('input', { id, name: 'q', type: 'search', value: q, maxlength: '100', class: 'header-search-input', placeholder: 'Buscar na loja: ração, petiscos, brinquedos…' }),
    el('button', { type: 'submit', class: 'header-search-button', 'aria-label': 'Buscar' }, icon('search', { size: 18 })),
  );
}

const publishCta = () => el('a', { href: '/posts/criar', class: 'btn btn-primary btn-sm whitespace-nowrap' }, icon('plus', { size: 16 }), 'Publicar anúncio');

function authArea(user) {
  if (!user) {
    return [
      publishCta(),
      el('a', { href: '/login/', class: 'header-account' }, icon('user', { size: 20 }),
        el('span', { class: 'leading-tight' }, el('span', { class: 'block text-xs text-stone-500' }, 'Olá! Faça seu'), 'login'),
      ),
      el('a', { href: '/cadastro/', class: 'btn btn-outline btn-sm whitespace-nowrap' }, 'Criar conta'),
    ];
  }
  const onLogout = async (event) => {
    event.currentTarget.disabled = true;
    try {
      await logout();
      flash('Você saiu da sua conta.', 'info');
      location.assign('/');
    } catch {
      event.currentTarget.disabled = false;
      showFlash('Não foi possível sair agora. Tente novamente.', 'danger');
    }
  };
  return [
    publishCta(),
    el('span', { class: 'header-account' }, icon('user', { size: 20 }),
      el('span', { class: 'leading-tight' },
        el('span', { class: 'block text-xs text-stone-500' }, 'Olá,'),
        el('span', { 'data-user-name': '' }, user.name.split(' ')[0])),
    ),
    user.role === 'admin' && el('a', { href: '/admin', class: 'badge hover:bg-brand-100', title: 'Painel administrativo' }, 'admin'),
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: onLogout }, 'Sair'),
  ];
}

function renderHeader(user) {
  const menuId = 'mobile-menu';
  const mobile = el('div', { id: menuId, class: 'hidden border-t border-stone-200 bg-white px-4 py-3 lg:hidden' },
    searchForm('header-search-mobile'),
    el('nav', { class: 'mt-3 flex flex-col gap-1', 'aria-label': 'Menu' }, ...navLinks('mobile-nav-link', { withIcons: true })),
    el('div', { class: 'mt-3 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3' }, ...authArea(user)),
  );
  const toggle = el('button', {
    type: 'button',
    class: 'btn btn-ghost btn-sm lg:hidden',
    'aria-controls': menuId,
    'aria-expanded': 'false',
    'aria-label': 'Abrir menu',
    onclick: (e) => {
      const open = mobile.classList.toggle('hidden') === false;
      e.currentTarget.setAttribute('aria-expanded', String(open));
    },
  }, icon('bars-3', { size: 22 }));

  return el('header', { class: 'bg-white shadow-sm' },
    el('div', { class: 'mx-auto flex max-w-6xl items-center gap-4 px-4 py-3' },
      el('a', { href: '/', class: 'inline-flex shrink-0 items-center gap-2 text-xl font-bold text-brand-700' }, icon('paw', { size: 28 }), 'Pets Post'),
      el('div', { class: 'hidden flex-1 lg:block' }, searchForm('header-search')),
      el('div', { class: 'ml-auto hidden items-center gap-3 lg:flex' }, ...authArea(user)),
      el('div', { class: 'ml-auto lg:hidden' }, toggle),
    ),
    el('nav', { class: 'header-nav hidden lg:block', 'aria-label': 'Principal' },
      el('div', { class: 'mx-auto flex max-w-6xl items-center gap-1 px-4' }, ...navLinks('header-nav-link', { withIcons: true })),
    ),
    mobile,
  );
}

/** Mostra uma mensagem na área de flash da página atual. */
export function showFlash(message, type = 'info') {
  const area = document.getElementById('app-flash');
  if (!area) return;
  const close = el('button', { type: 'button', class: 'flash-close', 'aria-label': 'Fechar' }, icon('x-mark', { size: 16 }));
  const box = el('div', { class: `flash flash-${type}`, role: type === 'danger' ? 'alert' : 'status' },
    el('span', {}, message), close);
  close.addEventListener('click', () => box.remove());
  area.append(box);
}

function renderFooter() {
  return el('div', { class: 'mx-auto max-w-6xl px-4 py-6 text-sm text-stone-500' },
    `© ${new Date().getFullYear()} Pets Post · ajudando pets a voltarem para casa`);
}

/**
 * Monta o layout e devolve o usuário logado (ou null).
 * @returns {Promise<{id:number,name:string,email:string,role:string,phone:string|null}|null>}
 */
export async function mountLayout() {
  let user = null;
  try {
    user = await getMe();
  } catch {
    /* API fora do ar: o header aparece como deslogado */
  }
  document.getElementById('app-header')?.replaceChildren(renderHeader(user));
  document.getElementById('app-footer')?.replaceChildren(renderFooter());
  for (const { message, type } of takeFlashes()) showFlash(message, type);
  mountContactButton(); // BR-CONTACT-002 (não espera: o botão aparece quando a configuração chegar)
  return user;
}
