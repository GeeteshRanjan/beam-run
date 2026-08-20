import { describe, it, expect } from 'vitest';
import {
  MONSTER,
  MONSTER_SCALE,
  drawMonsters,
  drawLift,
  drawHoist,
  drawGatherPad,
  drawWeatherWash,
  drawFiled,
} from './maze';
import { maxWidth } from './PixelArt';
import { BRAND, HAZARDS, PLAYER, RESOLUTION } from '../data/tuning.config';
import type { LiftState, MonsterState } from '../world/Hazards/ComplianceMaze';

const M = HAZARDS.MAZE;

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

function monster(over: Partial<MonsterState> = {}): MonsterState {
  return {
    name: 'AUDIT',
    box: { x: 400, y: 400 - M.MONSTER_H, w: M.MONSTER_W, h: M.MONSTER_H },
    dir: 1,
    speed: 90,
    friendly: false,
    arm: 0,
    settled: false,
    struck: false,
    ...over,
  };
}

function lift(over: Partial<LiftState> = {}): LiftState {
  return {
    box: { x: 1040, y: 240, w: 120, h: M.LIFT_H },
    progress: 0,
    remaining: 360,
    carrying: false,
    ...over,
  };
}

describe('compliance monsters', () => {
  it('the authored sprite is exactly the hitbox', () => {
    // Same rule as the DENIED stamps: the picture and the collision box are one
    // object. A monster drawn wider than its box would touch the player with
    // pixels that are not there — on a screen where touching is the whole rule.
    expect(maxWidth(MONSTER) * MONSTER_SCALE).toBe(M.MONSTER_W);
    expect(MONSTER.length * MONSTER_SCALE).toBe(M.MONSTER_H);
  });

  it('is a creature in two parts: a head floating over a cabinet, with a gap', () => {
    // This is the structure the deployed creature has and the one a transcription
    // keeps losing. `Game.drawGates` anchors the cabinet to the screen floor and the
    // head to the gate's own row (gy 14, one row up), so on the real screen the head
    // floats clear of the body. Render it from a single ground line — which one pass
    // did — and the two stack into one lump: a stamp wearing a hat, which the owner
    // rejected as "not the full version".
    //
    // Asserted off the grid so it cannot be lost again: a head block, at least one
    // completely empty row, then a cabinet block — and the head wider than the body
    // it rides on.
    const rowHas = (row: string, chars: string) => [...row].some((ch) => chars.includes(ch));
    const headRows = MONSTER.map((r) => rowHas(r, 'Hc'));
    const bodyRows = MONSTER.map((r) => rowHas(r, 'LPd'));
    const blank = MONSTER.map((_row, i) => !headRows[i] && !bodyRows[i]);
    const lastHead = headRows.lastIndexOf(true);
    const firstBody = bodyRows.indexOf(true);
    expect(lastHead).toBeGreaterThanOrEqual(0);
    expect(firstBody).toBeGreaterThan(lastHead); // head above, cabinet below
    expect(blank.slice(lastHead + 1, firstBody).some(Boolean)).toBe(true); // the gap
    // No cabinet up in the head, and no head down in the cabinet.
    expect(headRows.slice(firstBody).some(Boolean)).toBe(false);
    const width = (rows: readonly string[], chars: string) =>
      Math.max(...rows.map((r) => [...r].filter((ch) => chars.includes(ch)).length));
    expect(width(MONSTER, 'Hc')).toBeGreaterThan(width(MONSTER, 'LPd'));
    // And the whole creature is taller than it is wide — it stands, it is not a lump.
    expect(M.MONSTER_H).toBeGreaterThan(M.MONSTER_W);
    // Still small enough to read as a creature rather than a rival to the hero: the
    // head alone is under half the hero's height.
    expect(headRows.filter(Boolean).length * MONSTER_SCALE).toBeLessThan(PLAYER.HEIGHT);
  });

  it('never paints the body outside the box (the name plate sits above it)', () => {
    const { ctx, rects } = recorder();
    const m = monster();
    drawMonsters(ctx, [m]);
    const body = rects.filter((r) => r.y >= m.box.y);
    expect(body.length).toBeGreaterThan(20);
    for (const r of body) {
      expect(r.x).toBeGreaterThanOrEqual(m.box.x - 0.01);
      expect(r.x + r.w).toBeLessThanOrEqual(m.box.x + m.box.w + 0.01);
      expect(r.y + r.h).toBeLessThanOrEqual(m.box.y + m.box.h + 3.01); // + shadow
    }
  });

  it('changes its face, not its size, when GCC-BOT files everything', () => {
    const angry = recorder();
    drawMonsters(angry.ctx, [monster({ friendly: false, arm: 0 })]);
    const happy = recorder();
    drawMonsters(happy.ctx, [monster({ friendly: true, arm: 0 })]);
    // Same silhouette (the arm is still down in both, so only the face differs)…
    const bounds = (rs: Rect[]) => ({
      x: Math.min(...rs.map((r) => r.x)),
      w: Math.max(...rs.map((r) => r.x + r.w)),
    });
    expect(bounds(angry.rects)).toEqual(bounds(happy.rects));
    // …different plate: the plate and the slot are the only cells that change.
    const fills = (rs: Rect[]) => rs.map((r) => r.fill).join('|');
    expect(fills(angry.rects)).not.toBe(fills(happy.rects));
    // The pale scowl and the mint grin are two different plates.
    expect(angry.rects.some((r) => r.fill.toUpperCase() === '#CFE6EC')).toBe(true);
    expect(happy.rects.some((r) => r.fill.toUpperCase() === '#9FE6C4')).toBe(true);
  });

  it('has no face: the plate carries one slot, not eyes and a mouth', () => {
    // Owner call, and the reason it is worth a test rather than a comment: this
    // sprite has been re-drawn as a horned, fanged animal once and rejected. The
    // creature is `Game.drawGates`' approval plate on a filing cabinet — a rounded
    // pale slab with ONE dark bar straight through it.
    //
    // Measured structurally off the grid, which is what makes it hard to break by
    // accident. Two properties say "one slot, no features":
    //   · no row has more than ONE run of slot cells — a pair of eyes is two runs
    //     on one row, so this rules a face out;
    //   · the rows that have a slot are one contiguous band — an eye band plus a
    //     separate mouth band would be two.
    const slotRows: number[] = [];
    MONSTER.forEach((row, i) => {
      const runs = row.match(/c+/g) ?? [];
      expect(runs.length).toBeLessThanOrEqual(1);
      if (runs.length === 1) slotRows.push(i);
      // The materials the creature is made of, and nothing else: head, slot, cabinet
      // top course, cabinet face, drawer seams.
      for (const ch of row) expect('.HcLPd').toContain(ch);
    });
    expect(slotRows.length).toBeGreaterThan(0);
    expect(slotRows[slotRows.length - 1]! - slotRows[0]!).toBe(slotRows.length - 1);
  });

  it('hides the boom behind the plate while it blocks, and swings it clear when it does not', () => {
    // The deployed build's draw order, and the thing that makes the creature look
    // the way the owner asked for: the boom is painted FIRST and the plate over it,
    // so a blocking monster is a plain rubber stamp with a nub at its shoulder, and
    // the barrier emerges as it rises. Painted on top instead it is a plate with a
    // white bar across it — a different picture, and one that was rejected.
    const m = monster();
    const stripes = (rs: Rect[]) =>
      rs.filter((r) => r.fill.toUpperCase() === '#E6E6E6' || r.fill === '#233A44');

    const down = recorder();
    drawMonsters(down.ctx, [monster({ arm: 0 })]);
    const plateFirst = down.rects.findIndex((r) => r.fill.toUpperCase() === '#CFE6EC');
    const boom = stripes(down.rects);
    expect(boom.length).toBeGreaterThan(4);
    // Every stripe cell is painted before the plate, and none of it leaves the box.
    for (const r of boom) {
      expect(down.rects.indexOf(r)).toBeLessThan(plateFirst);
      expect(r.y).toBeGreaterThanOrEqual(m.box.y - 0.01);
      expect(r.y + r.h).toBeLessThanOrEqual(m.box.y + m.box.h + 0.01);
    }

    // Raised, it reaches above the head — never across the corridor.
    const up = recorder();
    drawMonsters(up.ctx, [monster({ friendly: true, arm: 1 })]);
    const raised = stripes(up.rects);
    expect(Math.min(...raised.map((r) => r.y))).toBeLessThan(m.box.y);
    // And the name plate steps up with it instead of covering it: the first raster
    // of this creature had five booms hidden behind five name plates.
    const plaque = up.rects.filter((r) => r.fill.startsWith('rgba(90,190,150'));
    expect(plaque.length).toBeGreaterThan(0);
    const plaqueBottom = Math.max(...plaque.map((r) => r.y + r.h));
    expect(plaqueBottom).toBeLessThanOrEqual(Math.min(...raised.map((r) => r.y)));
  });

  it('wears no orange — that is reserved for value', () => {
    const { ctx, rects } = recorder();
    drawMonsters(ctx, [monster(), monster({ friendly: true })]);
    for (const r of rects) expect(r.fill.toUpperCase()).not.toContain(BRAND.ORANGE);
  });

  it('only marks the gather pad once they are actually leaving', () => {
    const before = recorder();
    drawGatherPad(before.ctx, { x: 740, y: 400 }, false);
    expect(before.rects).toHaveLength(0);
    const after = recorder();
    drawGatherPad(after.ctx, { x: 740, y: 400 }, true);
    expect(after.rects.length).toBeGreaterThan(4);
  });
});

describe('the clearance lift', () => {
  it('is painted as machinery, not as level material', () => {
    const { ctx, rects } = recorder();
    drawLift(ctx, lift());
    const fills = new Set(rects.map((r) => r.fill.toUpperCase()));
    // Its own yellow plate — and emphatically not the reserved value orange.
    expect([...fills].some((f) => f.includes('EFC94C'))).toBe(true);
    for (const f of fills) expect(f).not.toContain(BRAND.ORANGE);
  });

  it('draws the plate inside its own box, and the rail below it', () => {
    const l = lift();
    const { ctx, rects } = recorder();
    drawLift(ctx, l);
    const plate = rects.filter((r) => r.y < l.box.y + l.box.h);
    for (const r of plate) {
      expect(r.x).toBeGreaterThanOrEqual(l.box.x - 0.01);
      expect(r.x + r.w).toBeLessThanOrEqual(l.box.x + l.box.w + 0.01);
    }
    // The travel is signposted before the player has stepped on: dashes running
    // down the remaining descent, the same idea as the badge's float rail.
    const rail = rects.filter((r) => r.y > l.box.y + l.box.h);
    expect(rail.length).toBeGreaterThan(4);
    expect(Math.max(...rail.map((r) => r.y))).toBeLessThanOrEqual(
      l.box.y + l.box.h + l.remaining,
    );
  });

  it('shortens the rail as it descends, and drops it at the bottom', () => {
    const top = recorder();
    drawLift(top.ctx, lift({ remaining: 360 }));
    const bottom = recorder();
    drawLift(bottom.ctx, lift({ box: { x: 1040, y: 600, w: 120, h: M.LIFT_H }, remaining: 0 }));
    // The plate's carriage shoes hang 12px under it and travel with it, so they are
    // part of the machine rather than part of the rail.
    const rail = (rs: Rect[], y: number) => rs.filter((r) => r.y > y + M.LIFT_H + 12).length;
    expect(rail(top.rects, 240)).toBeGreaterThan(0);
    expect(rail(bottom.rects, 600)).toBe(0);
  });

  it('draws nothing at all when a screen has no lift', () => {
    const { ctx, rects } = recorder();
    drawLift(ctx, null);
    expect(rects).toHaveLength(0);
  });
});

describe('the clearance hoist', () => {
  /** Parked low with two rows of travel above it — the shipped geometry. */
  const hoist = (over: Partial<LiftState> = {}): LiftState => ({
    box: { x: 360, y: 360, w: 240, h: M.LIFT_H },
    progress: 0,
    remaining: 80,
    carrying: false,
    ...over,
  });

  it('is the same machine as the lift, and says so', () => {
    const { ctx, rects } = recorder();
    drawHoist(ctx, hoist());
    const fills = new Set(rects.map((r) => r.fill.toUpperCase()));
    expect([...fills].some((f) => f.includes('EFC94C'))).toBe(true);
    // The one colour rule this screen cannot break: machinery yellow, never the
    // reserved value orange.
    for (const f of fills) expect(f).not.toContain(BRAND.ORANGE);
  });

  it('points its travel UP, above the plate, and never past where it can go', () => {
    const h = hoist({ remaining: 80 });
    const { ctx, rects } = recorder();
    drawHoist(ctx, h);
    const cue = rects.filter((r) => r.y + r.h <= h.box.y);
    expect(cue.length).toBeGreaterThan(0);
    // A cue drawn past the end of the travel promises a lift the machine does not have.
    expect(Math.min(...cue.map((r) => r.y))).toBeGreaterThanOrEqual(h.box.y - h.remaining);
    // …and nothing is drawn below the plate except its carriage shoes, which hang under
    // it rather than over its top face: art above the plate would promise footing the
    // collision box does not have.
    const below = rects.filter((r) => r.y >= h.box.y + h.box.h);
    for (const r of below) expect(r.y).toBeLessThanOrEqual(h.box.y + h.box.h + 12);
  });

  it('carries a mark per 80px, so a 240px plate is not a blank ruler', () => {
    const wide = recorder();
    drawHoist(wide.ctx, hoist());
    const narrow = recorder();
    drawHoist(narrow.ctx, hoist({ box: { x: 360, y: 360, w: 80, h: M.LIFT_H } }));
    const marks = (rs: Rect[]) => rs.filter((r) => r.fill.toUpperCase().includes('6B5410')).length;
    expect(marks(wide.rects)).toBe(marks(narrow.rects) * 3);
  });

  it('draws nothing at all when a screen has no hoist', () => {
    const { ctx, rects } = recorder();
    drawHoist(ctx, null);
    expect(rects).toHaveLength(0);
  });
});

describe('the weather wash', () => {
  it('veils the whole frame under gloom and washes it under daylight', () => {
    const gloom = recorder();
    drawWeatherWash(gloom.ctx, 0);
    expect(gloom.rects).toHaveLength(1);
    expect(gloom.rects[0]!.w).toBe(RESOLUTION.WIDTH);
    expect(gloom.rects[0]!.h).toBe(RESOLUTION.HEIGHT);
    // Cool and dark while it is raining…
    expect(gloom.rects[0]!.fill).toContain('0,16,24');

    const clear = recorder();
    drawWeatherWash(clear.ctx, 1);
    expect(clear.rects).toHaveLength(1);
    // …and its exact inverse once GCC-BOT has filed everything. Same lesson as the
    // Workplace's payoff: "un-gloomed" is not "lit".
    expect(clear.rects[0]!.fill).toContain('190,232,240');
  });

  it('is a dial, not a switch: half way through, both layers are on the frame', () => {
    const { ctx, rects } = recorder();
    drawWeatherWash(ctx, 0.5);
    expect(rects).toHaveLength(2);
    for (const r of rects) expect(r.w).toBe(RESOLUTION.WIDTH);
  });

  it('never paints the value orange, whatever the weather', () => {
    for (const c of [0, 0.3, 0.7, 1]) {
      const { ctx, rects } = recorder();
      drawWeatherWash(ctx, c);
      for (const r of rects) expect(r.fill.toUpperCase()).not.toContain(BRAND.ORANGE);
    }
  });
});

describe('the death pose: the player gets filed', () => {
  const FEET = 600;
  const CX = 300;
  const pose = (phase = 0.2, reduced = false): Rect[] => {
    const { ctx, rects } = recorder();
    drawFiled(ctx, CX, FEET, phase, reduced);
    return rects;
  };

  it('buries him from the floor to his chest, and nothing below the floor', () => {
    // The rule this screen was missing: every death that stops the stage is visible ON the
    // player. The pile has to reach him — a mound round his ankles would read as scenery —
    // and it must not paint into the ground band under his feet.
    const rects = pose();
    const top = Math.min(...rects.map((r) => r.y));
    const bottom = Math.max(...rects.map((r) => r.y + r.h));
    expect(bottom).toBeLessThanOrEqual(FEET);
    // A drawn hero is 60px tall, so his chest is ~FEET-34: the stack has to get there.
    expect(top).toBeLessThan(FEET - 34);
  });

  it('is an uneven STACK, not a pyramid', () => {
    // Rasterised symmetrical it read as a wedding cake, i.e. as something somebody built
    // rather than as something dumped on him. Every course is offset sideways, so no two
    // share a centre line.
    // The courses are the tall wide runs; `pxRect` snaps their height to the 4px cell, so
    // they come out 8 or 12 rather than the authored 10.
    const wide = pose().filter((r) => r.w >= 28 && r.h >= 8);
    expect(wide.length).toBeGreaterThanOrEqual(5);
    // No two courses that touch share a centre line, which is what makes the stack lean
    // rather than taper. (Two non-adjacent courses may land on the same centre — the
    // property that matters is that consecutive ones do not.)
    const centres = wide.map((r) => Math.round(r.x + r.w / 2));
    for (let i = 1; i < centres.length; i += 1) {
      expect(centres[i]).not.toBe(centres[i - 1]);
    }
  });

  it('is stamped with the creature\'s own slot mark, in its own dark red', () => {
    // What ties the pile to the thing that made it: the same bar that sits in every
    // monster's head. It is the only warm thing in the pose, and it is not the value
    // orange, which this screen reserves for the badge.
    const red = pose().filter((r) => r.fill.toUpperCase() === '#8B1A1A');
    expect(red.length).toBeGreaterThanOrEqual(3);
    for (const r of red) expect(r.fill.toUpperCase()).not.toContain(BRAND.ORANGE);
  });

  it('keeps the loose sheets on the frame under reduced motion', () => {
    // The information is "he is under a pile of paper", and that survives being still — so
    // the sheets hold mid-fall rather than being deleted (the same call the ANSR bubble and
    // the badge's shimmer make).
    const still = pose(0.2, true);
    const later = pose(0.9, true);
    expect(later).toEqual(still);
    expect(still.length).toBe(pose(0.2, false).length);
  });

  it('is pure: same inputs, same cells', () => {
    expect(pose(0.4)).toEqual(pose(0.4));
  });
});

describe('the monster that caught him', () => {
  it('slams its boom down and lights its slot, without changing sprite', () => {
    const calm = recorder();
    drawMonsters(calm.ctx, [monster()]);
    const hit = recorder();
    drawMonsters(hit.ctx, [monster({ struck: true })]);

    // Same number of cells: a third palette and an offset, never a second grid.
    expect(hit.rects).toHaveLength(calm.rects.length);
    // The slot goes hot…
    expect(hit.rects.some((r) => r.fill.toUpperCase() === '#8B1A1A')).toBe(true);
    expect(calm.rects.some((r) => r.fill.toUpperCase() === '#8B1A1A')).toBe(false);
    // …and the striped boom sits LOWER than at rest, i.e. across the player it just filed.
    const armY = (rs: Rect[]) =>
      Math.min(...rs.filter((r) => r.fill === '#E6E6E6').map((r) => r.y));
    expect(armY(hit.rects)).toBeGreaterThan(armY(calm.rects));
  });
});
