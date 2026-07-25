/**
 * Build-time minifier for the scoped stylesheet.
 *
 * `src/ui/styles.ts` keeps the CSS in a tagged-on template literal so brand
 * colours and the container-query type scale can be interpolated from the data
 * layer (one source of truth for the palette). The cost is that no minifier ever
 * touches it: terser leaves string contents alone and Vite's CSS pipeline never
 * sees it, so every comment and every level of indentation is shipped to the
 * browser. That was ~26 KB raw / 7.3 KB gzipped *per bundle* — the single
 * largest item in the payload, and it is duplicated across the ESM and UMD
 * builds.
 *
 * So the stylesheet stays fully documented in source and is compressed on the
 * way into the bundle. The transform is deliberately conservative: it only
 * removes comments and collapses whitespace, and it never touches the text
 * inside a `${...}` interpolation (that is TypeScript, not CSS).
 */

/** Marker for the stylesheet literal we are allowed to rewrite. */
const CSS_DECL = 'export const CSS = `';

/**
 * Collapse one run of literal CSS text (no interpolations inside).
 * @param {string} text
 * @returns {string}
 */
function squeeze(text) {
  return (
    text
      // Block comments (the CSS literal contains no quoted "/*" sequences).
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Any whitespace run becomes a single space...
      .replace(/\s+/g, ' ')
      // ...then the space around structural punctuation goes entirely.
      .replace(/\s*([{};:,>])\s*/g, '$1')
      // The last semicolon in a block is redundant.
      .replace(/;}/g, '}')
      // Leading zero on a fractional value (only after a separator, so 0.5s
      // stays intact inside identifiers and never touches "0 0 0 4px").
      .replace(/([:,(\s])0\.(\d)/g, '$1.$2')
  );
}

/**
 * Minify a CSS template-literal body, preserving `${...}` interpolations exactly
 * (including any whitespace immediately around them, which can be significant —
 * e.g. `1px solid ${BRAND.ORANGE}`).
 * @param {string} body
 * @returns {string}
 */
export function minifyCssLiteral(body) {
  const parts = body.split(/(\$\{[^}]*\})/g);
  let out = '';
  for (const part of parts) {
    out += part.startsWith('${') ? part : squeeze(part);
  }
  return out.trim();
}

/** Count occurrences of a character, for the safety check below. */
function count(text, ch) {
  let n = 0;
  for (const c of text) if (c === ch) n += 1;
  return n;
}

/**
 * Minify the CSS literal inside `src/ui/styles.ts`.
 *
 * Throws if the rewrite changed the structure of the sheet (unbalanced braces,
 * lost declarations or lost interpolations) so a bad transform fails the build
 * instead of silently shipping a broken stylesheet.
 * @param {string} code module source
 * @returns {string | null} rewritten source, or null if there was nothing to do
 */
export function minifyStylesModule(code) {
  const start = code.indexOf(CSS_DECL);
  if (start < 0) return null;
  const from = start + CSS_DECL.length;
  const to = code.indexOf('`', from);
  if (to < 0) return null;

  const body = code.slice(from, to);
  const min = minifyCssLiteral(body);

  // Braces and declarations must survive exactly. (Semicolons are not checked:
  // the squeeze deliberately drops the redundant one before each `}`.)
  const bare = body.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const ch of ['{', '}', ':']) {
    if (count(min, ch) !== count(bare, ch)) {
      throw new Error(`css-minify: '${ch}' count changed — refusing to ship`);
    }
  }
  const interps = (s) => (s.match(/\$\{[^}]*\}/g) ?? []).length;
  if (interps(min) !== interps(body)) {
    throw new Error('css-minify: lost a ${} interpolation — refusing to ship');
  }

  return code.slice(0, from) + min + code.slice(to);
}

/**
 * Vite plugin. Production only — during `vite dev` the readable stylesheet is
 * far more useful in devtools than a compressed one.
 * @returns {import('vite').Plugin}
 */
export function cssMinifyPlugin() {
  return {
    name: 'beam-run:minify-css-literal',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('src/ui/styles.ts')) return null;
      const out = minifyStylesModule(code);
      return out === null ? null : { code: out, map: null };
    },
  };
}
