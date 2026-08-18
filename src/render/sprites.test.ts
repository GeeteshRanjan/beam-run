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
  const colors: string[] = [];
  let fill = '';
  const ctx = {
    globalAlpha: 1,
    set fillStyle(v: string) {
      fill = v;
    },
    get fillStyle() {
      return fill;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h });
      colors.push(fill);
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects, colors };
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

  describe('the ANSR bubble', () => {
    const bubble = (pulse = 1, phase = 0) => {
      const { ctx, rects, colors } = recorder();
      drawAnsrBubble(ctx, CENTER, FEET, pulse, phase);
      return { rects, colors };
    };

    it('is built from pixel cells, not a vector circle', () => {
      // A smooth arc() stroke was the one thing on screen that was not 8-bit.
      const { rects, colors } = bubble();
      expect(rects.length).toBeGreaterThan(100);
      for (const r of rects) {
        expect(r.w).toBeLessThanOrEqual(4);
        expect(r.h).toBeLessThanOrEqual(4);
      }
      expect(colors.every((c) => c.includes('255, 84, 0') || c.includes('255, 184, 122'))).toBe(
        true,
      );
    });

    it('encloses the figure and leaves its middle clear', () => {
      const { rects } = bubble();
      const cy = FEET - 30;
      const d = rects.map((r) => Math.hypot(r.x - CENTER, r.y - cy));
      // Big enough to wrap a 48×60 hero, small enough to still be a bubble…
      expect(Math.max(...d)).toBeGreaterThan(40);
      expect(Math.max(...d)).toBeLessThan(64);
      // …and hollow, so the hero inside it stays crisp.
      expect(Math.min(...d)).toBeGreaterThan(18);
    });

    it('is a pure function of pulse and phase, so reduced motion freezes it', () => {
      expect(bubble(0.5, 0).rects).toEqual(bubble(0.5, 0).rects);
      // The rim dither and the sparks move with the phase.
      expect(bubble(0.5, 0).colors).not.toEqual(bubble(0.5, 0.5).colors);
    });
  });
});
