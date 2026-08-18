import { describe, it, expect } from 'vitest';
import { drawAnsrBadgeMark, drawBadgePickup, BADGE_CELLS } from './badge';
import { RESOLUTION } from '../data/tuning.config';
import { LOGO_ORANGE } from '../ui/ansrMark';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

/**
 * A canvas that records fills and *fails* on anything vector: the badge's old
 * glow was a `createRadialGradient` + `arc()`, which is the one thing on screen
 * that cannot be 8-bit, and the whole point of this module is that it is gone.
 */
function recorder() {
  const rects: Rect[] = [];
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
      rects.push({ x, y, w, h, color: fill });
    },
    createRadialGradient() {
      throw new Error('gradients are not 8-bit');
    },
    arc() {
      throw new Error('arcs are not 8-bit');
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

const VIEW = {
  cx: 180,
  cy: 340,
  bandTop: 185,
  bandBottom: 495,
  groundY: 600,
  phase: 0.2,
  rising: true,
};

describe('the ANSR badge mark', () => {
  it('is the sunburst, built from whole cells, and sized to the pickup box', () => {
    const { ctx, rects } = recorder();
    drawAnsrBadgeMark(ctx, 100, 100, 2);
    expect(rects.length).toBeGreaterThan(40);
    for (const r of rects) {
      expect(r.w).toBe(2);
      expect(r.h).toBe(2);
    }
    // 19 cells at scale 2 = 38px: the mark fits inside the 40px pickup hitbox, so
    // nothing is drawn that cannot be collected.
    const left = Math.min(...rects.map((r) => r.x));
    const right = Math.max(...rects.map((r) => r.x + r.w));
    expect(BADGE_CELLS * 2).toBe(38);
    expect(right - left).toBeLessThanOrEqual(RESOLUTION.TILE);
    // Centred on the point it was asked to draw at.
    expect((left + right) / 2).toBeCloseTo(100, 0);
    // It is the brand mark, in brand orange (not the FF5400 value accent).
    expect(rects.some((r) => r.color === LOGO_ORANGE)).toBe(true);
    expect(rects.every((r) => r.color !== '#FF5400')).toBe(true);
  });

  it('is symmetric about both axes — a lopsided sunburst reads as a defect', () => {
    const { ctx, rects } = recorder();
    drawAnsrBadgeMark(ctx, 0, 0, 1);
    const cells = new Set(rects.map((r) => `${r.x},${r.y}`));
    // The grid is odd-sized, so the centre is a real cell at (0,0) and mirroring
    // is exact: x → -x, y → -y.
    for (const r of rects) {
      expect(cells.has(`${-r.x},${r.y}`)).toBe(true);
      expect(cells.has(`${r.x},${-r.y}`)).toBe(true);
      expect(cells.has(`${r.y},${r.x}`)).toBe(true); // …and about the diagonal
    }
  });

  it('shimmers by swapping ray classes, so a held phase is a static mark', () => {
    const lit = recorder();
    drawAnsrBadgeMark(lit.ctx, 0, 0, 2, 0);
    const flip = recorder();
    drawAnsrBadgeMark(flip.ctx, 0, 0, 2, 1);
    // Same cells, different colours: the mark never changes shape.
    expect(lit.rects.map((r) => `${r.x},${r.y}`)).toEqual(flip.rects.map((r) => `${r.x},${r.y}`));
    expect(lit.rects.map((r) => r.color)).not.toEqual(flip.rects.map((r) => r.color));
  });
});

describe('the badge pickup as a whole', () => {
  it('draws the shaft across the whole float band and a chevron on the ground', () => {
    const { ctx, rects } = recorder();
    drawBadgePickup(ctx, VIEW);
    const top = Math.min(...rects.map((r) => r.y));
    const bottom = Math.max(...rects.map((r) => r.y + r.h));
    expect(top).toBeLessThanOrEqual(VIEW.bandTop);
    expect(bottom).toBeGreaterThan(VIEW.groundY - 20);
    // Nothing paints below the ground line.
    expect(bottom).toBeLessThanOrEqual(VIEW.groundY);
  });

  it('is a pure function of the view — reduced motion is a constant phase', () => {
    const a = recorder();
    drawBadgePickup(a.ctx, VIEW);
    const b = recorder();
    drawBadgePickup(b.ctx, VIEW);
    expect(a.rects).toEqual(b.rects);
    // The animation is held in whole frames (eight flare steps, four chevron
    // steps per turn), so a nearby phase is deliberately identical — what has to
    // be true is that the cycle has more than one frame in it.
    const frames = new Set<string>();
    for (let i = 0; i < 8; i += 1) {
      const f = recorder();
      drawBadgePickup(f.ctx, { ...VIEW, phase: i / 8 });
      frames.add(JSON.stringify(f.rects));
    }
    expect(frames.size).toBeGreaterThan(1);
  });

  it('puts the wake behind the badge, so the direction of travel is readable', () => {
    const up = recorder();
    drawBadgePickup(up.ctx, { ...VIEW, rising: true });
    const down = recorder();
    drawBadgePickup(down.ctx, { ...VIEW, rising: false });
    const below = (rs: Rect[]) => rs.filter((r) => r.y > VIEW.cy + 20 && r.y < VIEW.bandBottom).length;
    const above = (rs: Rect[]) => rs.filter((r) => r.y < VIEW.cy - 20 && r.y > VIEW.bandTop).length;
    expect(below(up.rects)).toBeGreaterThan(below(down.rects));
    expect(above(down.rects)).toBeGreaterThan(above(up.rects));
  });
});
