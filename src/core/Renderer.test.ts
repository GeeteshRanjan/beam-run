import { describe, it, expect } from 'vitest';
import { computeViewport } from './Renderer';

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
});
