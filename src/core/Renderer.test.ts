import { describe, it, expect } from 'vitest';
import { computeViewport, clampPixelRatio, MAX_PIXEL_RATIO } from './Renderer';

describe('computeViewport (contain fit / letterbox)', () => {
  it('fills exactly at the native 16:9 size', () => {
    const v = computeViewport(1280, 720);
    expect(v.scale).toBeCloseTo(1, 5);
    expect(v.offsetX).toBeCloseTo(0, 5);
    expect(v.offsetY).toBeCloseTo(0, 5);
  });

  it('adds side bars when the container is wider than 16:9', () => {
    const v = computeViewport(1600, 720);
    expect(v.drawW).toBeCloseTo(1280, 5);
    expect(v.drawH).toBeCloseTo(720, 5);
    expect(v.offsetX).toBeCloseTo(160, 5);
    expect(v.offsetY).toBeCloseTo(0, 5);
  });

  it('adds top/bottom bars when the container is taller than 16:9', () => {
    const v = computeViewport(1280, 900);
    expect(v.drawW).toBeCloseTo(1280, 5);
    expect(v.drawH).toBeCloseTo(720, 5);
    expect(v.offsetY).toBeCloseTo(90, 5);
  });

  it('scales down uniformly for a small container', () => {
    const v = computeViewport(960, 540);
    expect(v.scale).toBeCloseTo(0.75, 5);
  });

  it('fits a portrait phone frame to the width, leaving bands for the UI', () => {
    // 390px-wide phone with a stage grown to 519px tall (frame + control band).
    const v = computeViewport(390, 519);
    expect(v.drawW).toBeCloseTo(390, 5);
    expect(v.drawH).toBeCloseTo(219.375, 3);
    expect(v.offsetY).toBeCloseTo((519 - 219.375) / 2, 3);
    expect(v.offsetX).toBeCloseTo(0, 5);
  });
});

describe('clampPixelRatio', () => {
  it(`caps the backing store at ${MAX_PIXEL_RATIO}x for high-density phones`, () => {
    expect(clampPixelRatio(3)).toBe(MAX_PIXEL_RATIO);
    expect(clampPixelRatio(4)).toBe(MAX_PIXEL_RATIO);
    expect(clampPixelRatio(1.5)).toBe(1.5);
  });

  it('falls back to 1 for missing or nonsense values', () => {
    expect(clampPixelRatio(undefined)).toBe(1);
    expect(clampPixelRatio(0)).toBe(1);
    expect(clampPixelRatio(-2)).toBe(1);
    expect(clampPixelRatio(Number.NaN)).toBe(1);
  });
});
