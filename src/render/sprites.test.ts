import { describe, it, expect } from 'vitest';
import { drawHero, drawAnsrBubble, HERO_GRID_W, HERO_GRID_H } from './sprites';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function recorder() {
  const rects: Rect[] = [];
  const strokes: { color: string; r: number }[] = [];
  let fill = '';
  let stroke = '';
  let arcR = 0;
  const ctx = {
    globalAlpha: 1,
    lineWidth: 0,
    set fillStyle(v: string) {
      fill = v;
    },
    get fillStyle() {
      return fill;
    },
    set strokeStyle(v: string) {
      stroke = v;
    },
    get strokeStyle() {
      return stroke;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h });
    },
    createRadialGradient: () => ({ addColorStop: () => undefined }),
    beginPath: () => undefined,
    arc: (_x: number, _y: number, r: number) => {
      arcR = r;
    },
    fill: () => undefined,
    stroke: () => strokes.push({ color: stroke, r: arcR }),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects, strokes };
}

function bounds(rects: Rect[]) {
  return {
    left: Math.min(...rects.map((r) => r.x)),
    right: Math.max(...rects.map((r) => r.x + r.w)),
    top: Math.min(...rects.map((r) => r.y)),
    bottom: Math.max(...rects.map((r) => r.y + r.h)),
  };
}

const CENTER = 400;
const FEET = 600;

function pose(motion: 'idle' | 'squash', scale: number) {
  const { ctx, rects } = recorder();
  drawHero(ctx, { motion, facing: 1, time: 0, still: true }, CENTER, FEET, scale);
  return bounds(rects);
}

describe('hero sprite', () => {
  it('stands the normal poses on their feet, centred on the hitbox', () => {
    const b = pose('idle', 3);
    expect(b.bottom).toBeCloseTo(FEET, 0);
    expect((b.left + b.right) / 2).toBeCloseTo(CENTER, 0);
    expect(b.right - b.left).toBeLessThanOrEqual(HERO_GRID_W * 3);
    expect(b.bottom - b.top).toBeLessThanOrEqual(HERO_GRID_H * 3);
  });

  it('the squash pose is pressed out sideways and flat on the floor', () => {
    // The pose is measured per frame, not from the idle grid — that assumption is
    // what would draw a 22×9 pose off-centre and floating.
    const flat = pose('squash', 4);
    const standing = pose('idle', 3);
    expect(flat.bottom).toBeCloseTo(FEET, 0);
    expect((flat.left + flat.right) / 2).toBeCloseTo(CENTER, 0);
    expect(flat.right - flat.left).toBeGreaterThan(standing.right - standing.left);
    expect(flat.bottom - flat.top).toBeLessThan((standing.bottom - standing.top) * 0.7);
    // The aspect ratio flips: a standing figure is taller than it is wide, a
    // flattened one is much wider than it is tall. That is the whole read.
    const aspect = (b: typeof flat) => (b.right - b.left) / (b.bottom - b.top);
    expect(aspect(standing)).toBeLessThan(1);
    expect(aspect(flat)).toBeGreaterThan(2);
  });

  it('the ANSR bubble is an orange ring around the figure', () => {
    const { ctx, strokes } = recorder();
    drawAnsrBubble(ctx, CENTER, FEET, 1);
    expect(strokes).toHaveLength(1);
    expect(strokes[0]!.color).toContain('255, 84, 0');
    // Big enough to enclose a 48×60 hero, small enough to stay a bubble.
    expect(strokes[0]!.r).toBeGreaterThan(30);
    expect(strokes[0]!.r).toBeLessThan(60);
  });
});
