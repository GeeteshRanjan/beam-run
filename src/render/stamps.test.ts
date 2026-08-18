import { describe, it, expect } from 'vitest';
import { drawStamps, drawInkPads } from './stamps';
import { measureText } from './PixelText';
import { HAZARDS, RESOLUTION } from '../data/tuning.config';
import type { StampState } from '../world/Hazards/Stamps';

const S = HAZARDS.STAMPS;
const GROUND_TOP = 15 * RESOLUTION.TILE;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The smallest canvas that can answer "what did it paint, and where". Everything
 * in this module goes through `fillRect` (pxRect and the bitmap font both do), so
 * recording that is enough to measure the picture.
 */
function recorder() {
  const rects: Rect[] = [];
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

function state(over: Partial<StampState> = {}): StampState {
  const press = over.press ?? 1;
  return {
    cx: 300,
    press,
    bottomY: S.REST_BOTTOM + press * (GROUND_TOP - S.REST_BOTTOM),
    retracting: false,
    pressing: press >= 1,
    warn: 0,
    ...over,
  };
}

describe('stamp painting', () => {
  it('never draws the head wider than its hitbox — the picture cannot over-promise', () => {
    const { ctx, rects } = recorder();
    drawStamps(ctx, [state()], false);
    const left = 300 - S.WIDTH / 2;
    const right = 300 + S.WIDTH / 2;
    // Everything except the deliberate retraction ticks lives inside the hitbox.
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(left - 0.01);
      expect(r.x + r.w).toBeLessThanOrEqual(right + 0.01);
    }
  });

  it('fits the word DENIED inside the face plate', () => {
    // This is the whole message of the hazard, and it silently fell off the plate
    // onto the frame at WIDTH 76. Guarded here rather than in a comment.
    const plateInner = S.WIDTH - 4 * 4 - 4 * 2; // plate inset, then a pixel of air
    expect(measureText('DENIED', 2)).toBeLessThan(plateInner);
  });

  it('presses down to the ground and parks inside the top of the frame', () => {
    const down = recorder();
    drawStamps(down.ctx, [state({ press: 1 })], false);
    const lowest = Math.max(...down.rects.map((r) => r.y + r.h));
    expect(lowest).toBeGreaterThanOrEqual(GROUND_TOP);

    const up = recorder();
    drawStamps(up.ctx, [state({ press: 0 })], false);
    const headBottom = Math.max(
      ...up.rects.filter((r) => r.y + r.h < GROUND_TOP).map((r) => r.y + r.h),
    );
    expect(headBottom).toBeCloseTo(S.REST_BOTTOM, 0);
  });

  it('draws the wind-up down the column, not up on the parked head', () => {
    // A parked stamp hangs mostly above the frame, so a tell drawn on the head is
    // a tell nobody sees. The cue has to live between the head and the floor.
    const quiet = recorder();
    drawStamps(quiet.ctx, [state({ press: 0, warn: 0 })], false);
    const winding = recorder();
    drawStamps(winding.ctx, [state({ press: 0, warn: 1 })], false);

    const inColumn = (rs: Rect[]) =>
      rs.filter((r) => r.y > S.REST_BOTTOM && r.y + r.h < GROUND_TOP).length;
    expect(inColumn(winding.rects)).toBeGreaterThan(inColumn(quiet.rects));
    // …and it reaches the floor, where the print is about to land.
    expect(winding.rects.some((r) => r.y === GROUND_TOP)).toBe(true);
  });

  it('marks every stamp column on the floor, whether the stamp is up or down', () => {
    const { ctx, rects } = recorder();
    drawInkPads(ctx, [200, 600, 1000]);
    for (const cx of [200, 600, 1000]) {
      expect(rects.some((r) => r.y === GROUND_TOP && Math.abs(r.x + r.w / 2 - cx) < 1)).toBe(true);
    }
  });

  it('lifts only the guilty stamp on the life-lost frames', () => {
    const plain = recorder();
    drawStamps(plain.ctx, [state({ cx: 300 }), state({ cx: 900 })], false);
    const lifted = recorder();
    drawStamps(lifted.ctx, [state({ cx: 300 }), state({ cx: 900 })], false, 300);

    // The head is the only thing drawn a full hitbox wide, so its top edge is an
    // unambiguous measure of where the stamp is.
    const headTop = (rs: Rect[], cx: number) =>
      Math.min(
        ...rs
          .filter((r) => Math.abs(r.w - S.WIDTH) <= 4 && Math.abs(r.x + r.w / 2 - cx) < 2)
          .map((r) => r.y),
      );

    expect(headTop(lifted.rects, 300)).toBeCloseTo(headTop(plain.rects, 300) - S.REVEAL_LIFT, 0);
    expect(headTop(lifted.rects, 900)).toBeCloseTo(headTop(plain.rects, 900), 0);
  });
});
