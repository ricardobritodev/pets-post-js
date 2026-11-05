/**
 * meta.js — Injeção de Open Graph no HTML das páginas de detalhe (ADR 002).
 *
 * Robôs do WhatsApp/Facebook não executam JS: o título, a descrição e a foto
 * precisam estar no HTML que o servidor manda. O HTML do build tem o marcador
 * <!--app-meta--> no <head>; aqui ele vira as meta tags do post.
 */
export const META_MARKER = '<!--app-meta-->';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Corta no limite sem quebrar palavra, com reticências. */
export function truncate(text, max) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

/** URL absoluta (og:image e og:url precisam ser absolutas). */
const absolute = (path, publicUrl) => (publicUrl && path ? new URL(path, publicUrl).toString() : path);

/**
 * Meta tags de um post.
 * @param {{ id: number, title: string, description: string, statusLabel: string, petTypeLabel: string,
 *           lastSeenLocation: string, primaryPhoto: { url: string }|null }} post
 * @param {string|undefined} publicUrl ex.: https://www.petspost.com.br
 */
export function postMeta(post, publicUrl) {
  const title = `${post.statusLabel}: ${post.title} · Pets Post`;
  const description = truncate(`${post.petTypeLabel} · ${post.lastSeenLocation}. ${post.description}`, 200);
  return {
    title,
    description,
    url: absolute(`/posts/${post.id}`, publicUrl),
    image: post.primaryPhoto ? absolute(post.primaryPhoto.url, publicUrl) : null,
  };
}

/**
 * Troca o <title> e insere as meta tags no lugar do marcador.
 * @param {string} html
 * @param {{ title: string, description: string, url?: string|null, image?: string|null }} meta
 */
export function injectMeta(html, meta) {
  const tags = [
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="Pets Post" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    meta.url && `<meta property="og:url" content="${escapeHtml(meta.url)}" />`,
    meta.image && `<meta property="og:image" content="${escapeHtml(meta.image)}" />`,
    `<meta name="twitter:card" content="${meta.image ? 'summary_large_image' : 'summary'}" />`,
  ].filter(Boolean);

  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(META_MARKER, tags.join('\n    '));
}
