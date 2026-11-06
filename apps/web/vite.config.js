/**
 * Vite em modo MPA (multi-page): cada página HTML é uma entrada.
 * ADR: specs/adr/002-vite-mpa-og-injection.md
 * URLs das páginas: page-routes.js (o mesmo mapa é usado pelo Express em produção).
 */
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { PAGE_INPUTS, LEGACY_REDIRECTS, resolvePage } from './page-routes.js';
import { iconSvg } from './src/lib/icon-data.js';

const page = (file) => resolve(import.meta.dirname, file);

/** Em dev, /posts/12 → posts/detalhe.html (igual ao Express em produção). */
function pageRoutes() {
  return {
    name: 'petspost-page-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://dev');
        const to = LEGACY_REDIRECTS[url.pathname.replace(/\/$/, '')];
        if (to) {
          res.writeHead(301, { Location: to });
          return res.end();
        }
        const match = resolvePage(url.pathname);
        if (match) req.url = `/${match.page}${url.search}`;
        next();
      });
    },
  };
}

/**
 * Ícones no HTML estático: <i data-icon="paw" data-size="48" data-label="..." class="..."></i>
 * vira o <svg> inline (em dev e no build), sem depender do JavaScript da página.
 * Nome de ícone errado faz o build falhar.
 */
function htmlIcons() {
  const TAG = /<i\s+([^>]*\bdata-icon="[^"]*"[^>]*)><\/i>/g;
  return {
    name: 'petspost-html-icons',
    transformIndexHtml(html) {
      return html.replace(TAG, (_match, rawAttrs) => {
        const attrs = Object.fromEntries([...rawAttrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
        return iconSvg(attrs['data-icon'], {
          size: Number(attrs['data-size'] ?? 20),
          className: attrs.class ?? '',
          label: attrs['data-label'],
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), pageRoutes(), htmlIcons()],
  server: {
    port: 5173,
    // Em dev, o Vite repassa /api para o Express — mesmo domínio, sem CORS.
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
      '/static/uploads': 'http://localhost:3000', // fotos antigas do Flask
    },
  },
  build: {
    target: 'es2022', // top-level await nas páginas (ex.: await mountLayout())
    outDir: 'dist',
    rollupOptions: {
      input: Object.fromEntries(Object.entries(PAGE_INPUTS).map(([name, file]) => [name, page(file)])),
    },
  },
});
