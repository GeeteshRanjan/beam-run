import { describe, it, expect } from 'vitest';
import {
  FIGURE,
  BANDS,
  SCALE,
  drawOffice,
  drawMummies,
  drawShots,
  drawBandages,
  drawOverheadCabinet,
} from './workplace';
import { CEILING, WORK_PODS, POD_SCREEN } from './scenery';
import { maxWidth } from './PixelArt';
import { HAZARDS, RESOLUTION } from '../data/tuning.config';
import levels from '../data/levels.json';
import type { ClutterSpec } from '../data/levels';
import type { BandageState, MummyState } from '../world/Hazards/Workplace';

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
    burn: 1,
    burning: 0,
    wind: 0,
    ...over,
  };
}

/** The pale value every light on this screen is painted in. */
const LIGHT = 'rgba(226,246,252';
const lights = (rs: Rect[]): Rect[] => rs.filter((r) => r.fill.startsWith(LIGHT));
/** Caution yellow, i.e. the ROOM's tape: barricades, cones, signs, tape runs. */
const CAUTION = ['#E8C23A', '#B8942A', '#F4DC7A'];
const caution = (rs: Rect[]): Rect[] => rs.filter((r) => CAUTION.includes(r.fill.toUpperCase()));
/** Red barrier tape, i.e. the FIGURE's. A different colour on purpose. */
const BARRIER = ['#D2402C', '#8E2216', '#E86A52'];
const barrier = (rs: Rect[]): Rect[] => rs.filter((r) => BARRIER.includes(r.fill.toUpperCase()));
/** Fire: the cutter's orbs, and the tape burning off him. */
const FIRE = ['#FFF6DC', '#FFB04A', '#FF5400', '#8E1F0A'];
const fire = (rs: Rect[]): Rect[] => rs.filter((r) => FIRE.includes(r.fill.toUpperCase()));

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

  it('has a neck, a waist and two legs with a gap between them', () => {
    /*
     * The owner's note was that the figure was not well shaped, and the diagnosis was
     * that it had no joints: an 8-row head straight onto a full-width torso straight
     * down to a bottom edge, with the legs divided by one column of outline. So the
     * test states the three narrowings that make it a body — the neck must be
     * narrower than the head, the waist narrower than the chest — and that the legs
     * are separated by a TRANSPARENT column rather than a dark one.
     */
    const width = (row: string): number => row.replace(/[. ]/g, '').length;
    const rows = FIGURE.map(width);
    const head = Math.max(...rows.slice(0, 5));
    const neck = Math.min(...rows.slice(5, 7));
    const chest = Math.max(...rows.slice(7, 15));
    const waist = Math.min(...rows.slice(15, 17));
    expect(neck).toBeLessThan(head);
    expect(waist).toBeLessThan(chest);

    // The gap: at least six rows whose interior holds a transparent cell with drawn
    // cells on both sides of it.
    const split = FIGURE.filter((row) => /[^. ][. ]+[^. ]/.test(row.slice(1)));
    expect(split.length).toBeGreaterThanOrEqual(6);
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
    expect(barrier(wrapped.rects).length).toBeGreaterThan(4);

    const freed = recorder();
    drawMummies(freed.ctx, [mummy({ phase: 'working', layers: 0, lethal: false })], 1, true);
    expect(barrier(freed.rects)).toHaveLength(0);
  });

  it('is bound in a DIFFERENT tape from the room, and never in the room’s', () => {
    /*
     * The owner's first note on this screen: the tape on him merged with the tape on
     * everything else. Holding the props back to 0.78 alpha was not enough, because
     * nine yellow shapes plus one yellow figure is ten yellow shapes. So the figure
     * carries red barrier tape and the room carries caution yellow, and the rule is
     * stated in both directions — not one caution-yellow cell may land on him.
     */
    const { ctx, rects } = recorder();
    drawMummies(ctx, [mummy()], 1, true);
    expect(barrier(rects).length).toBeGreaterThan(10);
    expect(caution(rects)).toHaveLength(0);
  });

  it('burns a band off with fire and leaves soot, rather than switching it off', () => {
    // "The bandages are shown burning and getting ashed" — so the frames after a hit
    // have to carry fire on the body, and the frames after THAT have to carry a mark
    // where the band was. A band that simply stops being drawn is a wipe.
    const mid = recorder();
    drawMummies(mid.ctx, [mummy({ layers: 2, burning: 3, burn: 0.5 })], 1, true);
    expect(fire(mid.rects).length).toBeGreaterThan(6);

    const after = recorder();
    drawMummies(after.ctx, [mummy({ layers: 2, burning: 0, burn: 1 })], 1, true);
    expect(fire(after.rects)).toHaveLength(0);
    // Soot where the outermost bands were, at partial alpha over the cloth.
    expect(after.rects.some((r) => r.fill.startsWith('rgba(58,54,48'))).toBe(true);
  });

  it('paints the cutter’s ammunition as a round orb, not a bar', () => {
    /*
     * Round means "the rows narrow away from the centre line". The first cut listed
     * the profile the other way up and rasterised as an orange brick — right in code,
     * obviously wrong in a PNG — so the property is stated here rather than trusted.
     */
    const { ctx, rects } = recorder();
    drawShots(ctx, [{ box: { x: 400, y: 500, w: 20, h: 16 }, dir: 1 }]);
    const rim = rects.filter((r) => r.fill.toUpperCase() === '#8E1F0A' && r.h <= 2);
    expect(rim.length).toBeGreaterThanOrEqual(6);
    const widest = Math.max(...rim.map((r) => r.w));
    // The widest course is at the orb's own middle, and the poles are narrower.
    const middle = rim.filter((r) => r.w === widest);
    const cy = 508;
    // 6, not 4: `pxRect` snaps every cell to the 2px grid, so a course authored 5px
    // off the centre line can land 6 off it. Measure the property, not the arithmetic.
    for (const r of middle) expect(Math.abs(r.y + r.h / 2 - cy)).toBeLessThanOrEqual(6);
    // …and the poles are genuinely narrower than the middle.
    const poles = rim.filter((r) => Math.abs(r.y + r.h / 2 - cy) >= 7);
    expect(poles.length).toBeGreaterThan(0);
    for (const r of poles) expect(r.w).toBeLessThan(widest);
    // …and nothing it paints is wider than its own hitbox.
    for (const r of rim) expect(r.w).toBeLessThanOrEqual(20);
  });
});

describe('the bandages he throws', () => {
  const roll = (): BandageState[] => [
    { box: { x: 400, y: 540, w: W.THROW_W, h: W.THROW_H }, dir: -1, travelled: 120 },
  ];

  it('is a DISC, not the hitbox filled in', () => {
    /*
     * The rule three objects on this screen have now paid for (the fire orb, the dragon's
     * bursts, and this): a round thing needs a stepped profile that narrows away from its
     * centre line. The first cut of the roll was a 26×22 rectangle with a keyline and two
     * bars across it, and it rasterised as a red warning box flying down the corridor.
     */
    const { ctx, rects } = recorder();
    drawBandages(ctx, roll());
    const cy = 540 + W.THROW_H / 2;
    const rim = rects.filter((r) => r.fill.toUpperCase() === '#10222A' && r.h <= 2);
    expect(rim.length).toBeGreaterThanOrEqual(8);
    const widest = Math.max(...rim.map((r) => r.w));
    for (const r of rim.filter((x) => x.w === widest)) {
      expect(Math.abs(r.y + r.h / 2 - cy)).toBeLessThanOrEqual(6);
    }
    const poles = rim.filter((r) => Math.abs(r.y + r.h / 2 - cy) >= 8);
    expect(poles.length).toBeGreaterThan(0);
    for (const r of poles) expect(r.w).toBeLessThan(widest);
  });

  it('never paints wider than its own hitbox', () => {
    // A hazard sprite IS its hitbox. Only the streamers may sit outside it, and they
    // trail *behind* the direction of travel, so they can never land the hit.
    const { ctx, rects } = recorder();
    drawBandages(ctx, roll());
    const body = rects.filter((r) => r.x >= 396 && r.x <= 426);
    expect(body.length).toBeGreaterThan(6);
    for (const r of body) expect(r.w).toBeLessThanOrEqual(W.THROW_W);
    const behind = rects.filter((r) => r.x > 400 + W.THROW_W);
    const ahead = rects.filter((r) => r.x + r.w < 400);
    expect(behind.length).toBeGreaterThan(0); // streamers, thrown leftwards
    expect(ahead).toHaveLength(0);
  });

  it('is his tape, never the room’s', () => {
    // Same rule as the figure: the room is cautioned off in yellow, he is condemned in
    // red, and the thing he throws is a length of what he is wrapped in.
    const { ctx, rects } = recorder();
    drawBandages(ctx, roll());
    expect(barrier(rects).length).toBeGreaterThan(6);
    expect(caution(rects)).toHaveLength(0);
  });

  it('spins off DISTANCE, so it can never rotate on the spot', () => {
    const spoke = (travelled: number): Rect | undefined => {
      const { ctx, rects } = recorder();
      drawBandages(ctx, [
        { box: { x: 400, y: 540, w: W.THROW_W, h: W.THROW_H }, dir: -1, travelled },
      ]);
      return rects.find((r) => r.fill.toUpperCase() === '#3E0C04');
    };
    // Two positions 8px apart show different spokes; the same distance shows the same one.
    expect(spoke(0)).not.toEqual(spoke(9));
    expect(spoke(20)).toEqual(spoke(20));
  });

  it('telegraphs the throw on his own body, and the tell grows', () => {
    const early = recorder();
    drawMummies(early.ctx, [mummy({ phase: 'winding', wind: 0.1 })], 1, true);
    const late = recorder();
    drawMummies(late.ctx, [mummy({ phase: 'winding', wind: 0.95 })], 1, true);
    // More coil courses and more chevrons as the wind-up runs on.
    expect(barrier(late.rects).length).toBeGreaterThan(barrier(early.rects).length);
    // …and every chevron carries a dark backing cell, because the pale ones landed on
    // the caution-yellow props and disappeared.
    const chevrons = late.rects.filter((r) => r.fill.startsWith('rgba(239,233,218'));
    const backings = late.rects.filter((r) => r.fill.startsWith('rgba(4,14,18'));
    expect(chevrons.length).toBeGreaterThan(0);
    expect(backings.length).toBeGreaterThanOrEqual(chevrons.length / 3);
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

  it('hangs four spotlights that FLARE towards their mouths and glow up on restore', () => {
    /*
     * Owner call: four big spots from the ceiling facing down, glowing up once the room is
     * fixed. Two properties, and both were defects in the first cut:
     *
     *  - the can's courses have to widen on the way DOWN, or the fitting is a box hanging
     *    off the ceiling and nothing about it says which way it points;
     *  - the lens has to be dramatically brighter once `restore` is 1 — "glow up" is the
     *    whole request, and it is the difference between a fitting and a fixture.
     */
    const cans = (r: number): Rect[] => {
      const { ctx, rects } = recorder();
      drawOffice(ctx, CLUTTER, r, 1, true);
      return rects.filter((x) => x.fill.toUpperCase() === '#123F4C' && x.h === 10);
    };
    const courses = cans(1).filter((r) => Math.abs(r.x + r.w / 2 - CEILING.LIGHTS[0]!) < 4);
    expect(courses.length).toBeGreaterThanOrEqual(4);
    const sorted = [...courses].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]!.w, 'the can does not flare downwards').toBeGreaterThan(sorted[i - 1]!.w);
    }
    // The lens: near-dead in the broken room, near-white once it is fixed.
    const lens = (r: number): number => {
      const { ctx, rects } = recorder();
      drawOffice(ctx, CLUTTER, r, 1, true);
      const hits = rects.filter((x) => x.fill.startsWith('rgba(255,250,232'));
      return Math.max(...hits.map((x) => Number(x.fill.split(',')[3]!.replace(')', ''))));
    };
    expect(lens(1)).toBeGreaterThan(lens(0) + 0.3);
    expect(lens(1)).toBeGreaterThan(0.9);
  });

  it('does not light a duct that is not there', () => {
    /*
     * The services duct is cut around every fitting (`CEILING.DUCT_GAP`) so a spot can
     * hang through it. The lit line along the duct's top therefore has to stop at the cut:
     * one 184px band centred on the fitting was mostly painted across a 96px hole, i.e. a
     * pale line lying in a gap, which is the light-as-an-object defect in its purest form.
     */
    const { ctx, rects } = recorder();
    drawOffice(ctx, CLUTTER, 1, 1, true);
    const onDuct = lights(rects).filter((r) => r.y === 108);
    expect(onDuct.length).toBeGreaterThan(0);
    for (const r of onDuct) {
      for (const cx of CEILING.LIGHTS) {
        const gapL = cx - CEILING.DUCT_GAP / 2;
        const gapR = cx + CEILING.DUCT_GAP / 2;
        expect(r.x >= gapR || r.x + r.w <= gapL, 'a lit duct edge lies inside the cut').toBe(true);
      }
    }
  });

  it('draws the badge’s cabinet as furniture, with its underside in shadow', () => {
    // It is a `pedestal` solid, so the level material never paints it — this does, and it
    // has to read as a WALL-MOUNTED unit: the whole reason the badge on top is a decision
    // is that the player can walk underneath.
    const box = { x: 160, y: 480, w: 80, h: 40 };
    const { ctx, rects } = recorder();
    drawOverheadCabinet(ctx, [box], 0);
    expect(rects.length).toBeGreaterThan(6);
    // Brackets back to the wall, below the carcase.
    expect(rects.some((r) => r.y >= box.y + box.h && r.y < box.y + box.h + 10)).toBe(true);
    // A lit top face (the surface the player has to see they can land on)…
    expect(rects.some((r) => r.fill.startsWith('rgba(226,246,252') && r.y === box.y)).toBe(true);
    // …and nothing painted below its own underside except those brackets.
    for (const r of rects) expect(r.y).toBeLessThan(box.y + box.h + 10);
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
