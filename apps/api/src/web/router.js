/**
 * web/router.js — Em produção, o Express serve o build do Vite (apps/web/dist).
 * ADR 002 · Etapa 7.2 adiantada para a Etapa 4 por causa do Open Graph.
 *
 *   /assets/*      → arquivos com hash no nome, cache de 1 ano
 *   /posts/:id     → posts/detalhe.html com Open Graph do post
 *   outras páginas → o HTML de page-routes.js
 *   URL desconhecida → 404 com a home (o front mostra o conteúdo padrão)
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import express, { Router } from 'express';
import { resolvePage, LEGACY_REDIRECTS } from '@petspost/web/page-routes';
import { idParamSchema } from '@petspost/contracts';
import { injectMeta, postMeta } from './meta.js';

/**
 * @param {{ distDir: string, posts: { get: (id: number, viewer: null) => Promise<object> },
 *           publicUrl?: string, cache?: boolean }} deps
 */
export function webRouter({ distDir, posts, publicUrl, cache = true }) {
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
      if (legacy) return res.redirect(301, legacy);

      const match = resolvePage(req.path);
      res.set('Cache-Control', 'no-cache');
      if (!match) return res.status(404).type('html').send(await html('index.html'));

      let page = await html(match.page);
      if (match.og === 'post') {
        // Só posts públicos ganham Open Graph; inativo/inexistente → 404 sem vazar dados.
        const post = await posts.get(idParamSchema.parse(match.params.id), null).catch((err) => {
          if (err?.status === 404) return null;
          throw err;
        });
        if (!post) res.status(404);
        else page = injectMeta(page, postMeta(post, publicUrl));
      }
      res.type('html').send(page);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
