/**
 * Emit the custom not-found page into the site build.
 *
 * A static host serves `404.html` from the output directory for any path that
 * matches nothing else (Vercel, Netlify and GitHub Pages all follow this
 * convention), so one generated file covers every unmatched route — including
 * the `/gcc-opportunity-navigator` deep link the game's CTAs use, which this
 * deployment does not serve.
 *
 * The page itself is `src/ui/NotFoundPage.ts`; this script only supplies a DOM
 * (jsdom, already a dev dependency) and the CSS minifier the Vite build uses,
 * then writes the result. Run by `npm run build:site`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — jsdom ships no bundled types; this is a build script only.
import { JSDOM } from 'jsdom';
// @ts-expect-error — plain-JS build helper, no types needed.
import { minifyCssLiteral } from './css-minify.mjs';
import { buildNotFoundHtml } from '../src/ui/NotFoundPage';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '..', 'dist-site', '404.html');

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
const doc = dom.window.document as Document;
const html = buildNotFoundHtml(doc, {
  minifyCss: minifyCssLiteral as (css: string) => string,
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
process.stdout.write(`404 page written: dist-site/404.html (${kb} KB, self-contained)\n`);
