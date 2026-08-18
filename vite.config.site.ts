import { defineConfig } from 'vite';
// @ts-expect-error — plain-JS build helper, no types needed.
import { cssMinifyPlugin } from './scripts/css-minify.mjs';
import { notFoundPagePlugin } from './scripts/not-found-plugin';

/**
 * Standalone SITE build (for Vercel / static hosting).
 *
 * The default `vite build` produces an embeddable *library* (no index.html),
 * which is why a plain Vercel deploy 404s. This config instead builds the app
 * from index.html into `dist-site/`, giving a self-contained playable page.
 *
 * Usage: `vite build --config vite.config.site.ts` (see the `build:site` npm
 * script). The library build (vite.config.ts) is left unchanged.
 */
export default defineConfig(() => ({
  // `vite preview --config vite.config.site.ts` serves dist-site; without this
  // the history fallback would answer /gcc-opportunity-navigator with the game.
  plugins: [notFoundPagePlugin(), cssMinifyPlugin()],
  base: './',
  build: {
    outDir: 'dist-site',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
  },
  define: {
    __DEV__: JSON.stringify(false),
  },
}));
