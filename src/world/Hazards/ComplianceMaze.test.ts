import { describe, it, expect } from 'vitest';
import { ComplianceMaze } from './ComplianceMaze';
import { Player } from '../Player';
import { LOOP, HAZARDS, RESOLUTION, PLAYER } from '../../data/tuning.config';
import type { MonsterSpec } from '../../data/levels';
import type { HazardContext } from '../types';

const DT = LOOP.FIXED_DT;
const T = RESOLUTION.TILE;
const M = HAZARDS.MAZE;
const CTX: HazardContext = { assisted: false, extraTelegraph: 0 };
const ASSISTED: HazardContext = { assisted: true, extraTelegraph: 0 };

const GATHER = { gx: 20, gy: 15 };

/** One flat corridor monster, columns 6..10 on the ground band. */
const FLAT: MonsterSpec = {
  name: 'TAX',
  from: 6,
  to: 10,
  gy: 15,
  seed: 7,
  route: [GATHER],
};
/** One walking a rising staircase — the treads are 560, 520, 480, 440. */
const STAIR: MonsterSpec = {
  name: 'PAYROLL',
  from: 9,
  to: 12,
  gy: 14,
  slope: -1,
  seed: 23,
  // Home the long way: back down the flight, then along the floor.
  route: [
    { gx: 9, gy: 14 },
    { gx: 12, gy: 15 },
    GATHER,
  ],
};

function maze(monsters: MonsterSpec[] = [FLAT], gather = GATHER): ComplianceMaze {
  return new ComplianceMaze(monsters, gather);
}

/** Somewhere nothing can reach, so the maze just runs. */
function bystander(): Player {
  return new Player(2 * T, 15 * T - PLAYER.HEIGHT);
}

function run(m: ComplianceMaze, seconds: number, p = bystander(), ctx = CTX): void {
  for (let i = 0; i < Math.ceil(seconds / DT); i += 1) m.update(DT, p, ctx);
}

describe('ComplianceMaze — monsters', () => {
  it('contributes no solids of its own without a lift, and never slows the player', () => {
    const m = maze();
    expect(m.solids()).toEqual([]);
    expect(m.speedMultAt()).toBe(1);
  });

  it('is exactly its hitbox, standing on the surface it patrols', () => {
    const m = maze();
    run(m, 0.2);
    const s = m.monsterStates()[0]!;
    expect(s.box.w).toBe(M.MONSTER_W);
    expect(s.box.h).toBe(M.MONSTER_H);
    expect(s.box.y + s.box.h).toBe(15 * T); // feet on the ground band
  });

  it('never leaves its corridor, however long it wanders', () => {
    const m = maze();
    const min = FLAT.from * T;
    const max = (FLAT.to + 1) * T;
    for (let i = 0; i < 60 / DT; i += 1) {
      m.update(DT, bystander(), CTX);
      const box = m.monsterStates()[0]!.box;
      expect(box.x).toBeGreaterThanOrEqual(min - 0.001);
      expect(box.x + box.w).toBeLessThanOrEqual(max + 0.001);
    }
  });

  it('walks a staircase: its feet follow the treads, not a slope', () => {
    const m = maze([STAIR]);
    const seen = new Set<number>();
    for (let i = 0; i < 40 / DT; i += 1) {
      m.update(DT, bystander(), CTX);
      const s = m.monsterStates()[0]!;
      seen.add(s.box.y + s.box.h);
    }
    // One reading per tread — whole tile tops, never an interpolated diagonal.
    expect([...seen].sort((a, b) => a - b)).toEqual([440, 480, 520, 560]);
  });

  it('changes direction and speed at junctions, and the speed stays wanderable', () => {
    const m = maze();
    const speeds = new Set<number>();
    const dirs = new Set<number>();
    for (let i = 0; i < 40 / DT; i += 1) {
      m.update(DT, bystander(), CTX);
      const s = m.monsterStates()[0]!;
      speeds.add(Math.round(s.speed));
      dirs.add(s.dir);
      expect(s.speed).toBeGreaterThanOrEqual(M.SPEED_MIN - 0.001);
      expect(s.speed).toBeLessThanOrEqual(M.SPEED_MAX + 0.001);
    }
    // "Sometimes slow, sometimes fast" is the owner's brief: a single speed would
    // be memorised on the first attempt.
    expect(speeds.size).toBeGreaterThan(5);
    expect(dirs).toEqual(new Set([-1, 1]));
    // …and never fast enough to make a corridor unwinnable.
    expect(M.SPEED_MAX).toBeLessThan(PLAYER.WALK_SPEED * 0.6);
  });

  it('wanders rather than hunts: the player is not an input', () => {
    // Two runs, the player parked in completely different places. If anything in
    // the monster's decision-making read the player, the paths would diverge.
    const near = maze();
    const far = maze();
    const nearPath: number[] = [];
    const farPath: number[] = [];
    for (let i = 0; i < 20 / DT; i += 1) {
      near.update(DT, new Player(7 * T, 15 * T - PLAYER.HEIGHT), CTX);
      far.update(DT, new Player(28 * T, 15 * T - PLAYER.HEIGHT), CTX);
      nearPath.push(near.monsterStates()[0]!.box.x);
      farPath.push(far.monsterStates()[0]!.box.x);
    }
    expect(nearPath).toEqual(farPath);
  });

  it('stops the stage when it touches an unassisted player', () => {
    const m = maze();
    const p = new Player(8 * T, 15 * T - PLAYER.HEIGHT);
    let cause = null;
    for (let i = 0; i < 20 / DT && cause === null; i += 1) cause = m.update(DT, p, CTX);
    expect(cause).toBe('monster');
  });

  it('holds its boom arm down the whole time it is scowling', () => {
    const m = maze();
    run(m, 10);
    expect(m.monsterStates()[0]!.arm).toBe(0);
    expect(m.clearedCount).toBe(0);
  });

  it('never blocks a crossing for long — the corridor is a reading test, not a wall', () => {
    // The fairness budget for this hazard. A monster sweeps at least a whole tile
    // between decisions, so it cannot dither in a doorway; this measures it rather
    // than asserting it in a comment.
    const m = maze();
    const doorX = 8 * T; // a column the player has to cross
    let blocked = 0;
    let worst = 0;
    for (let i = 0; i < 60 / DT; i += 1) {
      m.update(DT, bystander(), CTX);
      const box = m.monsterStates()[0]!.box;
      const overlaps = box.x < doorX + PLAYER.WIDTH && box.x + box.w > doorX;
      blocked = overlaps ? blocked + DT : 0;
      worst = Math.max(worst, blocked);
    }
    expect(worst).toBeLessThan(3);
  });
});

describe('ComplianceMaze — assisted (GCC-BOT files everything)', () => {
  it('raises every boom arm, for good', () => {
    const m = maze([FLAT, STAIR]);
    run(m, M.ARM_LIFT_TIME + 0.2, bystander(), ASSISTED);
    expect(m.clearedCount).toBe(2);
    expect(m.monsterStates().every((s) => s.arm === 1)).toBe(true);
    // Help does not lapse: the arms stay up with the flag gone, because the state
    // cannot go back — that is the promise the badge makes.
    run(m, 10, bystander(), CTX);
    expect(m.monsterStates().every((s) => s.arm === 1 && s.friendly)).toBe(true);
  });

  it('walks them home along their route, corner by corner, not through the stone', () => {
    const m = maze([STAIR]);
    const feet: number[] = [];
    for (let i = 0; i < 6 / DT; i += 1) {
      m.update(DT, bystander(), ASSISTED);
      feet.push(m.monsterStates()[0]!.box.y + m.monsterStates()[0]!.box.h);
    }
    // Its route goes back down the flight and along the floor, so the only
    // surfaces it ever stands on are the ones the player uses.
    const surfaces = [...new Set(feet.map((f) => Math.round(f)))];
    expect(Math.min(...surfaces)).toBeGreaterThanOrEqual(440);
    expect(Math.max(...surfaces)).toBe(15 * T);
    // …and it ends up on the landing.
    const end = m.monsterStates()[0]!;
    expect(end.settled).toBe(true);
    expect(end.box.y + end.box.h).toBe(GATHER.gy * T);
  });

  it('walks home rather than sprinting — and drops down the level instead of floating', () => {
    // Owner call: "make the movement of the creatures to the resting space a bit
    // slow, right now it's too fast and not natural". It was 420 px/s, which is
    // 1.6× the player's own walk, so five obstacles left the screen faster than
    // anything else on it moves. The two properties that make it read as a body
    // going home, measured off the frames rather than off the constants:
    //   · nothing moves horizontally faster than the player walks, and it is at
    //     least as quick as the creature's own top wander speed (it is leaving with
    //     purpose, not dawdling);
    //   · a leg that ends in a pure descent falls, because a body lowering itself
    //     at walking pace looks like it is floating. That defect was invisible at
    //     420 and only showed up once the walk slowed down.
    // A route shaped like the real LEGAL's: one column across and four rows down,
    // so the leg runs out of horizontal travel with the descent unfinished. That
    // leftover is the part that used to float.
    const m = maze([
      { name: 'LEGAL', from: 9, to: 12, gy: 8, seed: 5, route: [{ gx: 10, gy: 12 }, GATHER] },
    ]);
    let peakX = 0;
    let peakDown = 0;
    let prev = m.monsterStates()[0]!.box;
    for (let i = 0; i < 6 / DT; i += 1) {
      m.update(DT, bystander(), ASSISTED);
      const box = m.monsterStates()[0]!.box;
      peakX = Math.max(peakX, Math.abs(box.x - prev.x) / DT);
      if (Math.abs(box.x - prev.x) < 1) peakDown = Math.max(peakDown, (box.y - prev.y) / DT);
      prev = box;
    }
    // Measured speeds run up to half a pixel per frame over the constant, because a
    // leg snaps onto its corner on the frame it arrives; 30 px/s of slack covers it.
    const SNAP = 0.5 / DT;
    expect(peakX).toBeLessThanOrEqual(PLAYER.WALK_SPEED);
    expect(peakX).toBeGreaterThanOrEqual(M.SPEED_MAX);
    expect(peakX).toBeLessThanOrEqual(M.GATHER_SPEED + SNAP);
    // The descent is quicker than the walk, and it is the drop constant that sets it.
    expect(peakDown).toBeGreaterThan(peakX);
    expect(peakDown).toBeGreaterThanOrEqual(M.GATHER_DROP_SPEED);
    expect(peakDown).toBeLessThanOrEqual(M.GATHER_DROP_SPEED + SNAP);
  });

  it('turns them friendly and huddles them side by side', () => {
    const m = maze([FLAT, STAIR]);
    run(m, 8, bystander(), ASSISTED);
    expect(m.isFriendly).toBe(true);
    expect(m.gatheredCount).toBe(2);
    const states = m.monsterStates();
    for (const s of states) {
      expect(s.friendly).toBe(true);
      expect(s.settled).toBe(true);
      expect(s.box.y + s.box.h).toBe(GATHER.gy * T);
    }
    // Side by side, not stacked on one spot.
    expect(states[0]!.box.x).not.toBe(states[1]!.box.x);
    expect(Math.abs(states[0]!.box.x - states[1]!.box.x)).toBe(M.GATHER_SPACING);
  });

  it('a monster with nowhere to go simply stops, still harmless', () => {
    const m = new ComplianceMaze([{ ...FLAT, route: undefined }], GATHER);
    run(m, 3, bystander(), ASSISTED);
    const s = m.monsterStates()[0]!;
    expect(s.settled).toBe(true);
    expect(s.box.y + s.box.h).toBe(15 * T); // never left the surface
  });

  it('cannot cost the player anything once it is friendly', () => {
    const m = maze([FLAT]);
    const p = new Player(8 * T, 15 * T - PLAYER.HEIGHT);
    let cause = null;
    for (let i = 0; i < 20 / DT; i += 1) cause = m.update(DT, p, ASSISTED) ?? cause;
    expect(cause).toBeNull();
  });

  it('shields the player, because contact really is harmless', () => {
    expect(maze().shieldsPlayer).toBe(true);
  });

  it('reset() puts the maze back for a fresh attempt', () => {
    const m = maze([FLAT]);
    run(m, 4, bystander(), ASSISTED);
    expect(m.clearedCount).toBe(1);
    const moved = m.monsterStates()[0]!.box.x;
    m.reset();
    expect(m.clearedCount).toBe(0);
    expect(m.isFriendly).toBe(false);
    expect(m.gatheredCount).toBe(0);
    expect(m.monsterStates()[0]!.arm).toBe(0);
    expect(m.monsterStates()[0]!.box.x).toBe(FLAT.from * T);
    expect(m.monsterStates()[0]!.box.x).not.toBe(moved);
  });
});

describe('ComplianceMaze — the clearance lift', () => {
  const LIFT = { gx: 26, gy: 6, w: 3, toGy: 15 };
  const liftMaze = () => new ComplianceMaze([], undefined, LIFT);
  /** Standing on the plate at its current height. */
  const rider = (m: ComplianceMaze) => {
    const box = m.liftState()!.box;
    return new Player(box.x + 20, box.y - PLAYER.HEIGHT);
  };

  it('is a real solid, so the player can stand on it', () => {
    const m = liftMaze();
    const solids = m.solids();
    expect(solids).toHaveLength(1);
    expect(solids[0]).toEqual({ x: 26 * T, y: 6 * T, w: 3 * T, h: M.LIFT_H });
  });

  it('parks at the top until someone steps on', () => {
    const m = liftMaze();
    run(m, 3);
    expect(m.liftState()!.box.y).toBe(6 * T);
    expect(m.liftState()!.carrying).toBe(false);
  });

  it('carries the player down and stops at the bay floor', () => {
    const m = liftMaze();
    for (let i = 0; i < 8 / DT; i += 1) m.update(DT, rider(m), CTX);
    const s = m.liftState()!;
    expect(s.box.y).toBe(15 * T); // the plate's top is level with the floor
    expect(s.progress).toBe(1);
    expect(s.remaining).toBe(0);
  });

  it('returns to the top once it is empty, and only then', () => {
    const m = liftMaze();
    for (let i = 0; i < 1 / DT; i += 1) m.update(DT, rider(m), CTX);
    const droppedTo = m.liftState()!.box.y;
    expect(droppedTo).toBeGreaterThan(6 * T);
    // Nobody aboard: it climbs back, and it never pushes into the player, because
    // it only ever moves up while the plate is clear.
    run(m, 6);
    expect(m.liftState()!.box.y).toBe(6 * T);
    expect(m.liftState()!.carrying).toBe(false);
  });

  it('takes the ride at a readable pace', () => {
    // Slow enough to read as a lift, fast enough that nobody waits for it.
    const travel = (15 - 6) * T;
    expect(travel / M.LIFT_DOWN_SPEED).toBeGreaterThan(1.5);
    expect(travel / M.LIFT_DOWN_SPEED).toBeLessThan(4);
  });
});
