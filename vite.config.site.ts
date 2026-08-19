import { defineConfig } from 'vite';
// @ts-expect-error — plain-JS build helper, no types needed.
import { cssMinifyPlugin } from './scripts/css-minify.mjs';
import { notFoundPagePlugin } from './scripts/not-found-plugin';
import { stripLevelNotesPlugin } from './scripts/strip-level-notes';

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
  /*
   * `stripLevelNotesPlugin` was missing here until this pass, and this is the build
   * that gets deployed: every word of `levels.json`'s authoring prose — the meta
   * notes, the conventions block, every screen, badge, solid and hazard note — was
   * shipping to the live page, ~5 KB of it. The library build has stripped them
   * since the plugin was written, and the budget gate only measures `dist/`, so
   * nothing ever reported it. Caught by grepping this bundle for a sentence written
   * three minutes earlier, which is exactly what that habit is for.
   */
  plugins: [notFoundPagePlugin(), stripLevelNotesPlugin(), cssMinifyPlugin()],
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
