/**
 * storage.js — Onde as fotos ficam guardadas (ADR 006).
 *
 * O resto do código só usa `save`, `remove` e `urlFor`. Hoje é disco; trocar por S3/R2
 * depois é escrever outro objeto com os mesmos métodos.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

/** Só nomes simples (os nossos são UUID.jpg; os do Flask, hex.ext). Barra, `..` e afins ficam de fora. */
const SAFE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,250}$/;

export function assertSafeName(name) {
  if (typeof name !== 'string' || !SAFE_NAME.test(name) || name.includes('..')) {
    throw new Error(`nome de arquivo inválido: ${JSON.stringify(name)}`);
  }
  return name;
}

/**
 * @param {{ dir: string, publicPath?: string }} options
 */
export function createDiskStorage({ dir, publicPath = '/uploads' }) {
  let ready;
  const ensureDir = () => (ready ??= mkdir(dir, { recursive: true }));

  return {
    dir,
    publicPath,

    /** Grava o arquivo. `wx` falha se o nome já existir (nunca sobrescreve). */
    async save(name, buffer) {
      await ensureDir();
      await writeFile(join(dir, assertSafeName(name)), buffer, { flag: 'wx' });
    },

    /** Apaga o arquivo. Não existir não é erro. */
    async remove(name) {
      await rm(join(dir, assertSafeName(name)), { force: true });
    },

    urlFor: (name) => `${publicPath}/${assertSafeName(name)}`,
  };
}
