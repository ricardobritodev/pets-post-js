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

/** Links do menu. Novos módulos entram aqui conforme forem migrados (Etapas 4–6). */
const NAV = [
  { href: '/', label: 'Início' },
  { href: '/posts/', label: 'Posts' },
  { href: '/adocao/', label: 'Adoção' },
  { href: '/mapa', label: 'Mapa' },
  { href: '/sobre', label: 'Sobre' },
];

const isCurrent = (href) =>
  href === '/' ? location.pathname === '/' : location.pathname.startsWith(href.replace(/\/$/, ''));

function navLinks(className) {
  return NAV.map(({ href, label }) =>
    el('a', { href, class: className, ...(isCurrent(href) && { 'aria-current': 'page' }) }, label),
  );
}

const publishCta = () => el('a', { href: '/posts/criar', class: 'btn btn-primary btn-sm' }, '+ Publicar anúncio');

function authArea(user) {
  if (!user) {
    return [
      publishCta(),
      el('a', { href: '/login/', class: 'nav-link' }, 'Entrar'),
      el('a', { href: '/cadastro/', class: 'btn btn-outline btn-sm' }, 'Criar conta'),
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
    el('span', { class: 'text-sm text-stone-600', 'data-user-name': '' }, `Olá, ${user.name.split(' ')[0]}`),
    user.role === 'admin' && el('a', { href: '/admin', class: 'badge hover:bg-brand-100', title: 'Painel administrativo' }, 'admin'),
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: onLogout }, 'Sair'),
  ];
}

function renderHeader(user) {
  const menuId = 'mobile-menu';
  const mobile = el('div', { id: menuId, class: 'hidden border-t border-stone-200 px-4 py-3 sm:hidden' },
    el('nav', { class: 'flex flex-col gap-2', 'aria-label': 'Menu' }, ...navLinks('nav-link'), ...authArea(user)),
  );
  const toggle = el('button', {
    type: 'button',
    class: 'btn btn-ghost btn-sm sm:hidden',
    'aria-controls': menuId,
    'aria-expanded': 'false',
    'aria-label': 'Abrir menu',
    onclick: (e) => {
      const open = mobile.classList.toggle('hidden') === false;
      e.currentTarget.setAttribute('aria-expanded', String(open));
    },
  }, icon('bars-3', { size: 22 }));

  return el('header', { class: 'border-b border-stone-200 bg-white' },
    el('div', { class: 'mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3' },
      el('a', { href: '/', class: 'inline-flex items-center gap-2 text-xl font-bold text-brand-700' }, icon('paw', { size: 26 }), 'Pets Post'),
      el('nav', { class: 'hidden items-center gap-6 sm:flex', 'aria-label': 'Principal' }, ...navLinks('nav-link')),
      el('div', { class: 'hidden items-center gap-3 sm:flex' }, ...authArea(user)),
      toggle,
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
  return user;
}
