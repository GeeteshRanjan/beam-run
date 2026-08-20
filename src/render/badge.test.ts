import { describe, it, expect, vi } from 'vitest';
import { drawAnsrBadgeMark, drawBadgePickup, drawBadgePerch, BADGE_MARK_D } from './badge';
import { RESOLUTION } from '../data/tuning.config';
import { ANSR_MARK_PATH, ANSR_MARK_W, ANSR_MARK_H, LOGO_ORANGE } from '../ui/ansrMark';

/**
 * jsdom has no `Path2D`, and `render/ansrLogo.ts` deliberately no-ops without it.
 * Stubbing it here is what lets these tests see the mark at all — and the stub
 * keeps the `d` string, which is how the first test proves the badge draws the
 * *real* brand path rather than a lookalike.
 *
 * It has to be installed before the first draw, because `ansrMarkPath()` caches
 * its answer (including the null one) on first call.
 */
class FakePath2D {
  constructor(readonly d: string) {}
}
vi.stubGlobal('Path2D', FakePath2D);

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

/**
 * A canvas that records fills and *fails* on anything vector-ish that cannot be
 * pixel art: the badge's old glow was a `createRadialGradient` + `arc()`, and the
 * whole point of this module is that it is gone.
 *
 * `fill(path)` is allowed, and recorded: the mark is the brand asset's own path,
 * which is not an approximation of a logo and so is not "art" this module is
 * entitled to redraw. Everything around it — shaft, flare, core backing, chevron —
 * is still whole cells.
 */
function recorder() {
  const rects: Rect[] = [];
  const fills: { d: string; color: string; scale: number; at: [number, number] }[] = [];
  let fill = '';
  const stack: { x: number; y: number; s: number }[] = [];
  let tf = { x: 0, y: 0, s: 1 };
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
    save() {
      stack.push({ ...tf });
    },
    restore() {
      tf = stack.pop() ?? tf;
    },
    translate(x: number, y: number) {
      tf = { x: tf.x + x * tf.s, y: tf.y + y * tf.s, s: tf.s };
    },
    scale(s: number) {
      tf = { ...tf, s: tf.s * s };
    },
    rotate() {},
    fill(path: FakePath2D) {
      fills.push({ d: path.d, color: fill, scale: tf.s, at: [tf.x, tf.y] });
    },
    createRadialGradient() {
      throw new Error('gradients are not 8-bit');
    },
    arc() {
      throw new Error('arcs are not 8-bit');
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects, fills };
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
  it('is the real brand path, in brand orange — not a lookalike', () => {
    const { ctx, fills } = recorder();
    drawAnsrBadgeMark(ctx, 100, 100);
    expect(fills).toHaveLength(1);
    // The asset itself, byte for byte. An authored pixel reduction of the
    // sunburst used to stand in for this and read as a generic star; the owner
    // asked for the logo we already have, so this is the assertion that matters.
    expect(fills[0]!.d).toBe(ANSR_MARK_PATH);
    expect(fills[0]!.color).toBe(LOGO_ORANGE);
    expect(fills[0]!.color).not.toBe('#FF5400'); // never the value accent
  });

  it('spans the pickup hitbox exactly, so what you see is what you can take', () => {
    const { ctx, fills } = recorder();
    drawAnsrBadgeMark(ctx, 100, 100);
    expect(BADGE_MARK_D).toBe(RESOLUTION.TILE);
    const longest = Math.max(ANSR_MARK_W, ANSR_MARK_H);
    expect(fills[0]!.scale * longest).toBeCloseTo(RESOLUTION.TILE, 6);
    // Centred on the point it was asked to draw at (the transform lands on the
    // mark's top-left, half its drawn size away from the centre).
    expect(fills[0]!.at[0]).toBeCloseTo(100 - (fills[0]!.scale * ANSR_MARK_W) / 2, 6);
    expect(fills[0]!.at[1]).toBeCloseTo(100 - (fills[0]!.scale * ANSR_MARK_H) / 2, 6);
  });

  it('backs the hollow core with whole dark cells, inside the hitbox', () => {
    const { ctx, rects } = recorder();
    drawAnsrBadgeMark(ctx, 100, 100);
    expect(rects.length).toBeGreaterThan(8);
    const cell = rects[0]!.w;
    for (const r of rects) {
      expect(r.w).toBe(cell);
      expect(r.h).toBe(cell);
      expect(r.color).toContain('rgba(1, 28, 38');
    }
    const left = Math.min(...rects.map((r) => r.x));
    const right = Math.max(...rects.map((r) => r.x + r.w));
    const top = Math.min(...rects.map((r) => r.y));
    const bottom = Math.max(...rects.map((r) => r.y + r.h));
    // Big enough to hide a lit window behind the ring, small enough to stay a
    // shadow under the rays rather than a filled disc.
    expect(right - left).toBeGreaterThan(RESOLUTION.TILE * 0.3);
    expect(right - left).toBeLessThan(RESOLUTION.TILE * 0.6);
    expect((left + right) / 2).toBeCloseTo(100, 6);
    expect((top + bottom) / 2).toBeCloseTo(100, 6);
  });

  it('shimmers by swapping tone, so a held phase is a static mark', () => {
    const lit = recorder();
    drawAnsrBadgeMark(lit.ctx, 0, 0, BADGE_MARK_D, 0);
    const flip = recorder();
    drawAnsrBadgeMark(flip.ctx, 0, 0, BADGE_MARK_D, 1);
    // Same geometry, different colour: the mark never changes shape.
    expect(lit.fills[0]!.scale).toBe(flip.fills[0]!.scale);
    expect(lit.rects).toEqual(flip.rects);
    expect(lit.fills[0]!.color).not.toBe(flip.fills[0]!.color);
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

  it('marks the spot with cells alone, so a missing Path2D never hides the pickup', () => {
    // `drawAnsrLogo` is a no-op where `Path2D` is unavailable. Everything else the
    // pickup draws is `fillRect`, so the badge is still findable — unbranded, not
    // invisible. This asserts that split: cells outside the mark's own 40px box.
    const { ctx, rects } = recorder();
    drawBadgePickup(ctx, VIEW);
    const outsideMark = rects.filter(
      (r) => r.y + r.h < VIEW.cy - RESOLUTION.TILE / 2 || r.y > VIEW.cy + RESOLUTION.TILE / 2,
    );
    expect(outsideMark.length).toBeGreaterThan(10);
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
      frames.add(JSON.stringify([f.rects, f.fills]));
    }
    expect(frames.size).toBeGreaterThan(1);
  });

  it('puts the wake behind the badge, so the direction of travel is readable', () => {
    const up = recorder();
    drawBadgePickup(up.ctx, { ...VIEW, rising: true });
    const down = recorder();
    drawBadgePickup(down.ctx, { ...VIEW, rising: false });
    const below = (rs: Rect[]) =>
      rs.filter((r) => r.y > VIEW.cy + 20 && r.y < VIEW.bandBottom).length;
    const above = (rs: Rect[]) => rs.filter((r) => r.y < VIEW.cy - 20 && r.y > VIEW.bandTop).length;
    expect(below(up.rects)).toBeGreaterThan(below(down.rects));
    expect(above(down.rects)).toBeGreaterThan(above(up.rects));
  });
});

describe('the badge standing on a wall (the Compliance perch)', () => {
  const PERCH = { cx: 260, cy: 500, surfaceY: 520, phase: 0.2 };

  it('draws none of the rail: no shaft, no band brackets, no ground chevron', () => {
    const { ctx, rects } = recorder();
    drawBadgePerch(ctx, PERCH);
    // Everything it paints is within a tile and a half of the mark. The rail's shaft ran
    // 310px and its chevron sat on the ground band 100px below — both of them describe a
    // pickup that moves, and this one does not. Now that the flare cells are gone too,
    // the only things outside the mark are the plinth and the contact shadow, and both
    // of them are on the wall's own top course.
    for (const r of rects) {
      expect(r.y).toBeGreaterThan(PERCH.cy - 60);
      expect(r.y + r.h).toBeLessThanOrEqual(PERCH.cy + 60);
    }
  });

  it('ties the mark to the wall it stands on', () => {
    const { ctx, rects } = recorder();
    drawBadgePerch(ctx, PERCH);
    // A contact shadow on the top course, so the mark is ON the wall rather than a tile
    // above it — which is exactly the picture the rail used to draw.
    const onSurface = rects.filter((r) => r.y >= PERCH.surfaceY - 1);
    expect(onSurface.length).toBeGreaterThan(0);
    expect(onSurface.some((r) => r.color.includes('0,16,22'))).toBe(true);
  });

  it('carries NO flare cells: the read is the plinth, not dots beside the mark', () => {
    const { ctx, rects } = recorder();
    drawBadgePerch(ctx, PERCH);
    /*
     * Owner call: "there are two dots around the ANSR powerup — remove that." There were
     * four, and only two of them were ever visible: the pair level with the mark's middle.
     * The other pair fell inside its own rays. So "few cells at full alpha say light" is
     * true and still the wrong device here — two cells flanking a logo are two dots.
     */
    expect(rects.filter((r) => r.color === '#ff8a4d')).toHaveLength(0);
    // What replaced them is what was always doing the work: a lit plinth under the mark.
    expect(rects.some((r) => r.color.includes('255,138,77') && r.y < PERCH.surfaceY)).toBe(
      true,
    );
  });

  it('is a pure function of its view', () => {
    const a = recorder();
    drawBadgePerch(a.ctx, PERCH);
    const b = recorder();
    drawBadgePerch(b.ctx, PERCH);
    expect(a.rects).toEqual(b.rects);
  });
});

describe('there is no ring round the mark', () => {
  /**
   * Owner call: "remove the halo effect that is around the ANSR powerup" — the fifth and
   * last entry in that story (a dithered field · four lone cells · a radial corona · a
   * tangential dashed ring, which is what this deletes).
   *
   * Stated as a count in the annulus the ring lived in, because that is the shape of the
   * thing rather than one of its constants: the dashed ring put ~50 cells on a circle
   * 28px out from the centre, and what is allowed out there now is **nothing at all** on
   * a perch and the shaft's wake on a rail. Any new ring, of any radius near the mark,
   * fails this immediately.
   */
  const ringCells = (rects: Rect[], cx: number, cy: number) =>
    rects.filter((r) => {
      const d = Math.hypot(r.x + r.w / 2 - cx, r.y + r.h / 2 - cy);
      return d >= 24 && d <= 34;
    });

  it('the perched mark has NOTHING out there — the four flare cells went too', () => {
    // Sixth and last: dithered field · four dots · corona · dashed ring · flare cells.
    // The answer round this mark has been "nothing" every time it has been asked.
    const { ctx, rects } = recorder();
    drawBadgePerch(ctx, { cx: 260, cy: 500, surfaceY: 520, phase: 0.2 });
    expect(ringCells(rects, 260, 500)).toHaveLength(0);
  });

  it('the floating mark has only its own wake out there', () => {
    const { ctx, rects } = recorder();
    drawBadgePickup(ctx, VIEW);
    expect(ringCells(rects, VIEW.cx, VIEW.cy).length).toBeLessThan(6);
    // …and what IS drawn away from the mark is the shaft, i.e. on its vertical axis.
    for (const r of ringCells(rects, VIEW.cx, VIEW.cy)) {
      expect(Math.abs(r.x + r.w / 2 - VIEW.cx)).toBeLessThan(6);
    }
  });

  it('holds still where it used to crawl: a rail badge with no motion in the ring', () => {
    // The ring's dash pattern was the only thing on the pickup that turned. With it gone,
    // two nearby phases differ only in the mark's own shimmer and the chevron's step.
    const a = recorder();
    drawBadgePickup(a.ctx, { ...VIEW, phase: 0.02 });
    const b = recorder();
    drawBadgePickup(b.ctx, { ...VIEW, phase: 0.06 });
    expect(a.rects).toEqual(b.rects);
  });
});
