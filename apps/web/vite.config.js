/**
 * Vite em modo MPA (multi-page): cada página HTML é uma entrada.
 * ADR: specs/adr/002-vite-mpa-og-injection.md
 */
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const page = (file) => resolve(import.meta.dirname, file);

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    // Em dev, o Vite repassa /api para o Express — mesmo domínio, sem CORS.
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
  // top-level await nas páginas (ex.: await mountLayout())
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      // Uma pasta por página → URL limpa (/login/). Novas páginas entram aqui.
      input: {
        home: page('index.html'),
        login: page('login/index.html'),
        cadastro: page('cadastro/index.html'),
      },
    },
  },
});
