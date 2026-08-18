import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { BUDGETS, evaluateBudget } from './budget.mjs';

describe('bundle budget gate', () => {
  it('passes when JS and total are within budget', () => {
    const r = evaluateBudget(30, 52);
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([]);
  });

  it('fails when the JS payload exceeds its gzip budget', () => {
    const r = evaluateBudget(BUDGETS.jsGzipKB + 1, 100);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain('JS');
  });

  it('fails when the total payload exceeds its gzip budget', () => {
    const r = evaluateBudget(50, BUDGETS.totalGzipKB + 10);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain('Total');
  });
});

/**
 * Guard for a regression that hid for a long time: `beam-run.esm.js` shipping
 * unminified.
 *
 * `minifyEsOutput()` in vite.config.ts existed for exactly this, and it *ran* —
 * terser returned 135 KB — but Vite's `vite:esbuild-transpile` runs in the post
 * phase, after every normal plugin's `renderChunk`, and re-printed the chunk.
 * Mangled identifiers survived that (so the output looked minified if you glanced
 * at it) while every byte of whitespace came back: 176 KB raw / 48.5 KB gzipped
 * against 138 KB / 43.7 KB for the umd build of the same code.
 *
 * The two formats bundle the same source, so their sizes should be within a few
 * KB of each other. One being far larger is the signature of that bug, and it is
 * cheap to assert here — where it fails loudly — rather than noticing it years
 * later while hunting for headroom.
 */
describe('built bundles', () => {
  const dist = new URL('../dist/', import.meta.url);
  const read = (name) => {
    try {
      return readFileSync(new URL(name, dist));
    } catch {
      return null;
    }
  };

  it('keeps the es and umd bundles within 10% of each other, both minified', () => {
    const esm = read('beam-run.esm.js');
    const umd = read('beam-run.iife.js');
    if (!esm || !umd) {
      // `npm test` may run before `npm run build`; the CI gate runs both.
      expect(true).toBe(true);
      return;
    }
    const gz = (b) => gzipSync(b).length;
    const ratio = gz(esm) / gz(umd);
    expect(ratio, `esm ${gz(esm)} vs umd ${gz(umd)} gzipped`).toBeLessThan(1.1);
    // Minified output has almost no newlines; a beautified 138 KB file has ~2400.
    for (const [name, buf] of [
      ['esm', esm],
      ['umd', umd],
    ]) {
      const newlines = buf.toString('utf8').split('\n').length - 1;
      expect(newlines, `${name} looks beautified (${newlines} newlines)`).toBeLessThan(50);
    }
  });
});
