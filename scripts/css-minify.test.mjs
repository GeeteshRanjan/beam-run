// @vitest-environment node
// (esbuild's CSS parser needs a real Node environment, not jsdom's TextEncoder.)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
import { minifyCssLiteral, minifyStylesModule } from './css-minify.mjs';
import { CSS } from '../src/ui/styles';

describe('minifyCssLiteral', () => {
  it('drops comments and collapses whitespace', () => {
    const out = minifyCssLiteral(`
      /* a comment that should not ship */
      .a {
        color: red;
        padding: 1px 2px;
      }
    `);
    expect(out).toBe('.a{color:red;padding:1px 2px}');
  });

  it('never edits inside a ${} interpolation, or the space around it', () => {
    const out = minifyCssLiteral('.a { border: 1px solid ${BRAND.ORANGE}; }');
    expect(out).toBe('.a{border:1px solid ${BRAND.ORANGE}}');
    const nested = minifyCssLiteral('.a { font-size: clamp(11px, ${U(1.5)}, 17px); }');
    expect(nested).toBe('.a{font-size:clamp(11px,${U(1.5)},17px)}');
  });

  it('rewrites the real styles module without losing structure', () => {
    // Exercises the production path (including the guard, which throws if the
    // brace/declaration/interpolation counts move).
    const src = readFileSync(new URL('../src/ui/styles.ts', import.meta.url), 'utf8');
    const out = minifyStylesModule(src);
    expect(out).not.toBeNull();
    expect(out.length).toBeLessThan(src.length);
    // Everything outside the CSS literal is untouched.
    expect(out).toContain('export function injectStyles');
    expect(out).toContain('export const STYLE_ELEMENT_ID');
  });

  it('leaves modules without a CSS literal alone', () => {
    expect(minifyStylesModule('export const NOPE = 1;')).toBeNull();
  });
});

describe('the real stylesheet', () => {
  it('is still valid CSS after minification, and much smaller', async () => {
    const min = minifyCssLiteral(CSS);
    // esbuild parses CSS strictly and reports syntax errors as thrown warnings.
    const res = await transform(min, { loader: 'css' });
    expect(res.warnings).toEqual([]);
    expect(min.length).toBeLessThan(CSS.length * 0.8);
    // Spot-check that structural rules survived the squeeze.
    for (const selector of [
      '.beam-run__stage',
      '.beam-run__overlay--scene',
      '.beam-run__pixels',
      '@media (orientation:portrait)',
      '@supports (container-type:inline-size)',
    ]) {
      expect(min).toContain(selector);
    }
  });
});
