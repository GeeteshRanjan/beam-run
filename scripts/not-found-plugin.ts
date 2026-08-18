/**
 * Serve the game's own 404 screen for unmatched routes on the dev and preview
 * servers.
 *
 * `dist-site/404.html` only helps on a static host. Locally, Vite's default SPA
 * history fallback answers *every* extensionless path with `index.html`, so the
 * Navigator deep link (`/gcc-opportunity-navigator`) silently re-served the game
 * instead of the not-found screen we built for exactly that click.
 *
 * The middleware is registered from `configureServer` / `configurePreviewServer`
 * without deferring, so it runs ahead of Vite's internal html fallback. It
 * renders `src/ui/NotFoundPage.ts` once per server process (same jsdom + CSS
 * minifier path as `scripts/build-404.ts`), so what you see locally is the file
 * the site build emits.
 */
import type { PluginOption } from 'vite';
// @ts-expect-error — jsdom ships no bundled types; dev/build tooling only.
import { JSDOM } from 'jsdom';
// @ts-expect-error — plain-JS build helper, no types needed.
import { minifyCssLiteral } from './css-minify.mjs';
import { buildNotFoundHtml } from '../src/ui/NotFoundPage';

/** Paths Vite owns. Never intercept these, whatever the Accept header says. */
const INTERNAL = /^\/(@|src\/|node_modules\/|__|\.vite\/)/;
/** Anything with a file extension is a real asset request (or the 404 file itself). */
const HAS_EXTENSION = /\.[a-z0-9]+$/i;

let cached: string | null = null;

function renderNotFound(): string {
  if (cached) return cached;
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
  cached = buildNotFoundHtml(dom.window.document as Document, {
    minifyCss: minifyCssLiteral as (css: string) => string,
  });
  return cached;
}

type Req = { method?: string; url?: string; headers: Record<string, unknown> };
type Res = { statusCode: number; setHeader(k: string, v: string): void; end(body: string): void };

function handler(req: Req, res: Res, next: () => void): void {
  const path = (req.url ?? '/').replace(/[?#].*$/, '') || '/';
  const accept = String(req.headers.accept ?? '');
  const wantsPage = (req.method ?? 'GET') === 'GET' && accept.includes('text/html');
  if (!wantsPage || path === '/' || INTERNAL.test(path) || HAS_EXTENSION.test(path)) {
    next();
    return;
  }
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(renderNotFound());
}

export function notFoundPagePlugin(): PluginOption {
  return {
    name: 'beam-run:not-found-page',
    apply: (_config, env) => env.command === 'serve',
    configureServer(server) {
      server.middlewares.use(handler as never);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler as never);
    },
  };
}
