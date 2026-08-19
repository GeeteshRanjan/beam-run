import { describe, it, expect } from 'vitest';
import { FIGURE, BANDS, SCALE, drawOffice, drawMummies } from './workplace';
import { CEILING, WORK_PODS, POD_SCREEN } from './scenery';
import { maxWidth } from './PixelArt';
import { HAZARDS, RESOLUTION } from '../data/tuning.config';
import levels from '../data/levels.json';
import type { ClutterSpec } from '../data/levels';
import type { MummyState } from '../world/Hazards/Workplace';

const W = HAZARDS.WORKPLACE;
const GROUND_TOP = 15 * RESOLUTION.TILE;
const CLUTTER = (levels.screens.find((s) => s.id === 3)?.clutter ?? []) as ClutterSpec[];

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

/** The smallest canvas that can answer "what did it paint, where, and in what". */
function recorder() {
  const rects: Rect[] = [];
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, fill: String((this as { fillStyle: string }).fillStyle) });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

function mummy(over: Partial<MummyState> = {}): MummyState {
  return {
    name: 'TIED UP',
    box: { x: 480, y: GROUND_TOP - W.MUMMY_H, w: W.MUMMY_W, h: W.MUMMY_H },
    dir: 1,
    phase: 'wrapped',
    layers: W.TAPE_LAYERS,
    progress: 0,
    lethal: true,
    ...over,
  };
}

/** The pale value every light on this screen is painted in. */
const LIGHT = 'rgba(226,246,252';
const lights = (rs: Rect[]): Rect[] => rs.filter((r) => r.fill.startsWith(LIGHT));
/** Caution yellow, i.e. the tape, the barricades, the cones and the signs. */
const CAUTION = ['#E8C23A', '#B8942A', '#F4DC7A'];
const caution = (rs: Rect[]): Rect[] => rs.filter((r) => CAUTION.includes(r.fill.toUpperCase()));

describe('the wrapped figure', () => {
  it('the authored sprite is exactly the hitbox', () => {
    expect(maxWidth(FIGURE) * SCALE).toBe(W.MUMMY_W);
    expect(FIGURE.length * SCALE).toBe(W.MUMMY_H);
  });

  it('fills its box: no strip of hitbox that hits the player from nothing', () => {
    // The sprite IS the box, so an empty column inside it is a column that touches
    // the player with pixels that are not there. The first authoring left three
    // columns (9px) unused on one side, which mirrored to the other side when he
    // turned round.
    const used = (c: number): boolean => FIGURE.some((row) => !'. '.includes(row[c] ?? '.'));
    const empties = [...Array(maxWidth(FIGURE)).keys()].filter((c) => !used(c));
    expect(empties.length * SCALE).toBeLessThanOrEqual(3);
  });

  it('is wound cloth with tape on it, not a figure made of tape', () => {
    // The rule the first version broke. Nine two- and three-row bands covered 40% of
    // the body and the figure rasterised as a yellow striped pillar in a dark room —
    // a man in protective kit, not somebody wrapped up. What carries the mummy read
    // is the seam on every other row of pale cloth; the tape is the accent on it.
    const rows = FIGURE.length;
    const taped = new Set<number>();
    for (const b of BANDS) for (let r = b.row; r < b.row + b.h; r += 1) taped.add(r);
    expect(taped.size).toBeLessThan(rows / 2);
    // …and no band may cross the eye slit, which is the head's only feature.
    const slit = FIGURE.map((row, i) => (/[eE]/.test(row) ? i : -1)).filter((i) => i >= 0);
    expect(slit.length).toBeGreaterThan(0);
    for (const r of slit) expect(taped.has(r)).toBe(false);
  });

  it('keeps the eye slit dark while he is wrapped, and loses it when he is freed', () => {
    // Row 3 is odd, and the seam pass paints every odd row: its first version closed
    // the slit with a bandage seam. Anything drawn ACROSS the silhouette has to know
    // which cells are holes in it.
    const wrapped = recorder();
    drawMummies(wrapped.ctx, [mummy()], 1, true);
    expect(wrapped.rects.some((r) => r.fill.toUpperCase() === '#0A1418')).toBe(true);

    const freed = recorder();
    drawMummies(freed.ctx, [mummy({ phase: 'working', layers: 0, lethal: false })], 1, true);
    expect(freed.rects.some((r) => r.fill.toUpperCase() === '#0A1418')).toBe(false);
  });

  it('drops the tape and the name plate the moment he stops being the obstacle', () => {
    const wrapped = recorder();
    drawMummies(wrapped.ctx, [mummy()], 1, true);
    expect(caution(wrapped.rects).length).toBeGreaterThan(4);

    const freed = recorder();
    drawMummies(freed.ctx, [mummy({ phase: 'working', layers: 0, lethal: false })], 1, true);
    expect(caution(freed.rects)).toHaveLength(0);
  });
});

describe('the broken office', () => {
  it('puts every missing ceiling tile in the gap BETWEEN two fittings', () => {
    // A 168px fitting centred on 500 covers 416–584, so a hole at 480 is a hole
    // nobody can see: it rasterised as a dark smudge above a light fitting.
    for (const gap of CEILING.GAPS) {
      for (const cx of CEILING.LIGHTS) {
        const apertureL = cx - CEILING.FIT_W / 2;
        const apertureR = cx + CEILING.FIT_W / 2;
        const overlaps = gap < apertureR && gap + CEILING.TILE_W > apertureL;
        expect(overlaps).toBe(false);
      }
    }
    // …and the hole is on the tile grid, so it reads as a tile rather than a hole.
    for (const gap of CEILING.GAPS) expect(gap % CEILING.TILE_W).toBe(0);
  });

  it('lights the room with surfaces, never with a beam hanging in the air', () => {
    // Reception paid for this one and this screen paid for it again: a low-alpha
    // wedge thrown from a fitting down to the floor rasterises as a grey OBJECT
    // suspended from the ceiling. Everything painted in the light value between the
    // ceiling and the floor has to be an edge or a face — so it is flat.
    const { ctx, rects } = recorder();
    drawOffice(ctx, CLUTTER, 0, 1, true);
    const between = lights(rects).filter((r) => r.y > CEILING.H && r.y < GROUND_TOP);
    expect(between.length).toBeGreaterThan(0);
    for (const r of between) expect(r.h).toBeLessThanOrEqual(20);
  });

  it('leaves unlit floor between the pools, which is what makes them pools', () => {
    const { ctx, rects } = recorder();
    drawOffice(ctx, CLUTTER, 1, 1, true);
    const onFloor = lights(rects).filter((r) => r.y >= GROUND_TOP);
    expect(onFloor.length).toBeGreaterThan(8);
    // No single pool may reach halfway across the frame; four that do simply meet,
    // and a floor lit end to end reads as the floor's own top edge.
    for (const r of onFloor) expect(r.w).toBeLessThan(RESOLUTION.WIDTH / 2);
  });

  it('clears the tape, the props and the damage when the room comes good', () => {
    const broken = recorder();
    drawOffice(broken.ctx, CLUTTER, 0, 1, true);
    expect(caution(broken.rects).length).toBeGreaterThan(40);

    const fixed = recorder();
    drawOffice(fixed.ctx, CLUTTER, 1, 1, true);
    expect(caution(fixed.rects)).toHaveLength(0);
    // …and it is brighter than it was, not merely un-darkened.
    expect(lights(fixed.rects).length).toBeGreaterThan(lights(broken.rects).length);
  });

  it('wakes each monitor on the monitor that is actually there', () => {
    // The lit screen and the dead one are derived from one exported rect, because a
    // payoff that lands next to its own monitor is the same defect as a pickup drawn
    // where its hitbox is not.
    const { ctx, rects } = recorder();
    drawOffice(ctx, CLUTTER, 1, 1, true);
    for (const x of WORK_PODS) {
      const on = rects.filter(
        (r) =>
          r.x === x + POD_SCREEN.dx &&
          r.y === GROUND_TOP + POD_SCREEN.dy &&
          r.w === POD_SCREEN.w &&
          r.h === POD_SCREEN.h,
      );
      expect(on.length).toBeGreaterThan(0);
    }
  });

  it('holds the dressing back from the wrapped figure, who is the only actor', () => {
    // The props and the hazard are the same caution yellow, so at full alpha the one
    // thing on this floor that can cost a life was one more yellow shape among nine.
    const alphas: number[] = [];
    const rects: Rect[] = [];
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
      fillRect(x: number, y: number, w: number, h: number) {
        const self = this as { fillStyle: string; globalAlpha: number };
        rects.push({ x, y, w, h, fill: String(self.fillStyle) });
        if (CAUTION.includes(String(self.fillStyle).toUpperCase())) alphas.push(self.globalAlpha);
      },
    } as unknown as CanvasRenderingContext2D;
    drawOffice(ctx, CLUTTER, 0, 1, true);
    expect(alphas.length).toBeGreaterThan(20);
    expect(Math.max(...alphas)).toBeLessThan(1);
  });
});
