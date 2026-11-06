/**
 * page-routes.js — Mapa de URL → página HTML do front (specs/api/posts.md, "Páginas").
 *
 * Usado em dois lugares, para as URLs serem iguais em dev e em produção:
 *   - vite.config.js (dev): reescreve a URL para o HTML certo;
 *   - apps/api (produção): o Express serve o HTML do build e injeta Open Graph (ADR 002).
 *
 * As URLs do sistema antigo foram mantidas (links já compartilhados no WhatsApp).
 */

/** @typedef {{ page: string, params: Record<string, string>, og?: 'post' | 'adoption' | 'product' }} PageMatch */

const ROUTES = [
  { re: /^\/$/, page: 'index.html' },
  { re: /^\/posts\/?$/, page: 'posts/index.html' },
  { re: /^\/posts\/criar\/?$/, page: 'posts/form.html' },
  { re: /^\/posts\/(?<id>\d+)\/editar\/?$/, page: 'posts/form.html' },
  { re: /^\/posts\/(?<id>\d+)\/?$/, page: 'posts/detalhe.html', og: 'post' },
  { re: /^\/adocao\/?$/, page: 'adocao/index.html' },
  { re: /^\/adocao\/criar\/?$/, page: 'adocao/form.html' },
  { re: /^\/adocao\/(?<id>\d+)\/editar\/?$/, page: 'adocao/form.html' },
  { re: /^\/adocao\/(?<id>\d+)\/?$/, page: 'adocao/detalhe.html', og: 'adoption' },
  { re: /^\/mapa\/?$/, page: 'mapa/index.html' },
  { re: /^\/loja\/?$/, page: 'loja/index.html' },
  { re: /^\/loja\/produto\/(?<id>\d+)\/?$/, page: 'loja/produto.html', og: 'product' },
  { re: /^\/admin\/?$/, page: 'admin/index.html' },
  { re: /^\/admin\/usuarios\/?$/, page: 'admin/usuarios.html' },
  { re: /^\/admin\/(posts|adocao)\/?$/, page: 'admin/anuncios.html' },
  { re: /^\/admin\/parceiros\/?$/, page: 'admin/parceiros.html' },
  { re: /^\/admin\/parceiros\/criar\/?$/, page: 'admin/parceiro-form.html' },
  { re: /^\/admin\/parceiros\/(?<id>\d+)\/editar\/?$/, page: 'admin/parceiro-form.html' },
  { re: /^\/admin\/produtos\/?$/, page: 'admin/produtos.html' },
  { re: /^\/admin\/produtos\/criar\/?$/, page: 'admin/produto-form.html' },
  { re: /^\/admin\/produtos\/(?<id>\d+)\/editar\/?$/, page: 'admin/produto-form.html' },
  { re: /^\/sobre\/?$/, page: 'sobre/index.html' },
  { re: /^\/login\/?$/, page: 'login/index.html' },
  { re: /^\/cadastro\/?$/, page: 'cadastro/index.html' },
];

/** URLs antigas que mudaram de lugar → redirect 301. */
export const LEGACY_REDIRECTS = Object.freeze({
  '/auth/login': '/login/',
  '/auth/register': '/cadastro/',
  '/auth/logout': '/', // no Flask era um POST; se alguém abrir o link, volta para a home
});

/** Páginas que entram no build do Vite (chave = nome do chunk). */
export const PAGE_INPUTS = Object.freeze({
  home: 'index.html',
  posts: 'posts/index.html',
  postDetail: 'posts/detalhe.html',
  postForm: 'posts/form.html',
  adoption: 'adocao/index.html',
  adoptionDetail: 'adocao/detalhe.html',
  adoptionForm: 'adocao/form.html',
  mapa: 'mapa/index.html',
  store: 'loja/index.html',
  product: 'loja/produto.html',
  adminProducts: 'admin/produtos.html',
  adminProductForm: 'admin/produto-form.html',
  adminDashboard: 'admin/index.html',
  adminUsers: 'admin/usuarios.html',
  adminListings: 'admin/anuncios.html',
  adminPartners: 'admin/parceiros.html',
  adminPartnerForm: 'admin/parceiro-form.html',
  sobre: 'sobre/index.html',
  login: 'login/index.html',
  cadastro: 'cadastro/index.html',
  notFound: '404.html',
  serverError: '500.html',
});

/**
 * @param {string} pathname ex.: "/posts/12"
 * @returns {PageMatch|null}
 */
export function resolvePage(pathname) {
  for (const { re, page, og } of ROUTES) {
    const m = re.exec(pathname);
    if (m) return { page, params: { ...m.groups }, ...(og && { og }) };
  }
  return null;
}
