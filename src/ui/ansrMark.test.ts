import { describe, it, expect } from 'vitest';
import {
  ANSR_MARK_PATH,
  ANSR_MARK_SHAPES,
  ANSR_MARK_VIEWBOX,
  LOGO_ORANGE,
} from './ansrMark';

/**
 * `ansrMark.ts` is generated from the brand SVG (scripts/build-ansr-mark.mjs),
 * so these guard the transform rather than the artwork: every shape present,
 * nothing drifting outside the viewBox, and full source precision retained —
 * an earlier quantised version made the rays read unevenly at display size.
 */
describe('ANSR mark (generated from the brand SVG)', () => {
  it('carries every shape of the sunburst as its own closed subpath', () => {
    // 27 polygons + 5 rotate-transformed rects in the source's .cls-2 group.
    expect(ANSR_MARK_SHAPES).toBe(32);
    expect(ANSR_MARK_PATH.match(/M/g)).toHaveLength(ANSR_MARK_SHAPES);
    expect(ANSR_MARK_PATH.match(/Z/g)).toHaveLength(ANSR_MARK_SHAPES);
  });

  it('keeps the asset\u2019s own precision (not a rounded-off grid)', () => {
    const nums = ANSR_MARK_PATH.match(/\d+\.\d+/g) ?? [];
    // Hundreds of fractional coordinates: the rays are ~1.2 units wide, so
    // integer-grid rounding visibly changes their weight.
    expect(nums.length).toBeGreaterThan(200);
    expect(ANSR_MARK_VIEWBOX).toBe('0 0 87.68 90.55');
  });

  it('is re-origined so the mark exactly fills its viewBox', () => {
    const box = ANSR_MARK_VIEWBOX.split(' ').map(Number);
    const vw = box[2]!;
    const vh = box[3]!;
    const coords = (ANSR_MARK_PATH.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const xs = coords.filter((_, i) => i % 2 === 0);
    const ys = coords.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...xs)).toBeCloseTo(vw, 2);
    expect(Math.max(...ys)).toBeCloseTo(vh, 2);
  });

  it('keeps the logo orange separate from the value orange', () => {
    expect(LOGO_ORANGE).toBe('#f05722');
    expect(LOGO_ORANGE).not.toBe('#FF5400');
  });
});
