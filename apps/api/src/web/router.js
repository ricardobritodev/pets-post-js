/**
 * web/router.js — Em produção, o Express serve o build do Vite (apps/web/dist).
 * ADR 002 · Etapa 7.2 adiantada para a Etapa 4 por causa do Open Graph.
 *
 *   /assets/*      → arquivos com hash no nome, cache de 1 ano
 *   /posts/:id     → posts/detalhe.html com Open Graph do post
 *   /adocao/:id    → adocao/detalhe.html com Open Graph da adoção
 *   outras páginas → o HTML de page-routes.js
 *   URL desconhecida → página 404 · erro inesperado → página 500 (T7.9)
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import express, { Router } from 'express';
import { resolvePage, LEGACY_REDIRECTS } from '@petspost/web/page-routes';
import { idParamSchema } from '@petspost/contracts';
import { injectMeta, META_BUILDERS } from './meta.js';

const queryOf = (req) => {
  const i = req.originalUrl.indexOf('?');
  return i === -1 ? '' : req.originalUrl.slice(i);
};

/**
 * @param {{
 *   distDir: string,
 *   og: Record<'post' | 'adoption', { get: (id: number, viewer: null) => Promise<object> }>,
 *   publicUrl?: string,
 *   cache?: boolean,
 *   onError?: (err: Error) => void, // log do erro antes de mostrar a página 500
 * }} deps `og`: o serviço que busca o anúncio de cada tipo de página com Open Graph
 */
export function webRouter({ distDir, og, publicUrl, cache = true, onError }) {
  const router = Router();
  const files = new Map();

  /** Lê o HTML do build (em produção fica em memória). */
  async function html(page) {
    if (cache && files.has(page)) return files.get(page);
    const content = await readFile(join(distDir, page), 'utf8');
    if (cache) files.set(page, content);
    return content;
  }

  router.use('/assets', express.static(join(distDir, 'assets'), { immutable: true, maxAge: '1y' }));
  router.use('/assets', (_req, res) => res.status(404).type('text').send('Não encontrado'));
  router.use(express.static(distDir, { index: false, redirect: false }));

  router.get(/.*/, async (req, res, next) => {
    try {
      const legacy = LEGACY_REDIRECTS[req.path.replace(/\/$/, '')];
      if (legacy) return res.redirect(301, `${legacy}${queryOf(req)}`); // mantém ?next=

      const match = resolvePage(req.path);
      res.set('Cache-Control', 'no-cache');
      if (!match) return res.status(404).type('html').send(await html('404.html'));

      let page = await html(match.page);
      if (match.og) {
        // Só anúncios públicos ganham Open Graph; inativo/inexistente → 404 sem vazar dados.
        const item = await og[match.og].get(idParamSchema.parse(match.params.id), null).catch((err) => {
          if (err?.status === 404) return null;
          throw err;
        });
        if (!item) res.status(404);
        else page = injectMeta(page, META_BUILDERS[match.og](item, publicUrl));
      }
      res.type('html').send(page);
    } catch (err) {
      next(err);
    }
  });

  // Erro numa página HTML → página 500 (a API continua respondendo JSON pelo errorHandler).
  // eslint-disable-next-line no-unused-vars
  router.use(async (err, req, res, next) => {
    if (req.path.startsWith('/api/') || res.headersSent) return next(err);
    onError?.(err);
    try {
      res.status(500).set('Cache-Control', 'no-store').type('html').send(await html('500.html'));
    } catch {
      res.status(500).type('text').send('Erro interno. Tente de novo em instantes.');
    }
  });

  return router;
}
