import { describe, it, expect } from 'vitest';
import { drawStamps, drawInkPads, STAMP_SCALE, STAMP_BODY_ROWS } from './stamps';
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

  it('fits the word DENIED inside the printed label panel', () => {
    // This is the whole message of the hazard, and it silently fell off the label
    // onto the body at WIDTH 76. Guarded here rather than in a comment.
    const labelInner = S.WIDTH - 2 * 2 * STAMP_SCALE; // body edge + shade, both sides
    expect(measureText('DENIED', 2)).toBeLessThan(labelInner);
  });

  it('the authored body is exactly the hitbox', () => {
    // The picture and the collision box are the same object, so they cannot drift:
    // a taller sprite would be a stamp that hits you before it reaches you.
    expect(STAMP_BODY_ROWS * STAMP_SCALE).toBe(S.HEAD_H);
  });

  it('presses down to the ground and parks just above the middle of the frame', () => {
    const down = recorder();
    drawStamps(down.ctx, [state({ press: 1 })], false);
    expect(Math.max(...down.rects.map((r) => r.y + r.h))).toBeGreaterThanOrEqual(GROUND_TOP);

    const up = recorder();
    drawStamps(up.ctx, [state({ press: 0 })], false);
    const dieBottom = Math.max(
      ...up.rects.filter((r) => r.y + r.h < GROUND_TOP).map((r) => r.y + r.h),
    );
    expect(dieBottom).toBeCloseTo(S.REST_BOTTOM, 0);
    expect(S.REST_BOTTOM).toBeLessThan(RESOLUTION.HEIGHT / 2);
  });

  it('hangs from nothing — no rail, rope or rod above the stamp', () => {
    const { ctx, rects } = recorder();
    drawStamps(ctx, [state({ press: 0 })], false);
    // The knob is the topmost thing drawn, and it is narrow. Nothing may reach up
    // from it towards the ceiling.
    const top = Math.min(...rects.map((r) => r.y));
    expect(top).toBeGreaterThan(0);
    expect(rects.filter((r) => r.y < top + 4)).not.toHaveLength(0);
    const knobWidth = Math.max(
      ...rects.filter((r) => r.y < top + 4).map((r) => r.x + r.w),
    ) - Math.min(...rects.filter((r) => r.y < top + 4).map((r) => r.x));
    expect(knobWidth).toBeLessThan(S.WIDTH * 0.6); // a turned handle, not a shaft
  });

  it('cocks the stamp back and lights the floor during the wind-up', () => {
    const quiet = recorder();
    drawStamps(quiet.ctx, [state({ press: 0, warn: 0 })], false);
    const winding = recorder();
    drawStamps(winding.ctx, [state({ press: 0, warn: 1 })], false);

    // The whole object lifts — now that it parks in view, the tell can be on the
    // stamp itself and not only on the floor.
    const top = (rs: Rect[]) => Math.min(...rs.map((r) => r.y));
    expect(top(winding.rects)).toBeCloseTo(top(quiet.rects) - S.WARN_LIFT, 0);
    // …and the column it is about to print lights up from the floor.
    const litFloor = (rs: Rect[]) => rs.filter((r) => r.y >= GROUND_TOP - 16).length;
    expect(litFloor(winding.rects)).toBeGreaterThan(litFloor(quiet.rects));
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

    // The top of the knob is an unambiguous measure of where a stamp is.
    const stampTop = (rs: Rect[], cx: number) =>
      Math.min(...rs.filter((r) => Math.abs(r.x + r.w / 2 - cx) < S.WIDTH).map((r) => r.y));

    expect(stampTop(lifted.rects, 300)).toBeCloseTo(stampTop(plain.rects, 300) - S.REVEAL_LIFT, 0);
    expect(stampTop(lifted.rects, 900)).toBeCloseTo(stampTop(plain.rects, 900), 0);
  });
});
