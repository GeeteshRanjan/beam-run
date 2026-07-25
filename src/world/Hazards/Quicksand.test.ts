import { describe, it, expect } from 'vitest';
import { Quicksand } from './Quicksand';
import { Player } from '../Player';
import { PLAYER, LOOP, HAZARDS, RESOLUTION } from '../../data/tuning.config';
import type { HazardContext } from '../types';

const DT = LOOP.FIXED_DT;
const T = RESOLUTION.TILE;
const CTX: HazardContext = { assisted: false, extraTelegraph: 0 };
const ASSISTED: HazardContext = { assisted: true, extraTelegraph: 0 };

/** Screen 1: shallow struggle sludge (cols 6–9) + the deep pit (cols 17–23). */
function sludge(): Quicksand {
  return new Quicksand([
    { gx: 6, gy: 15, w: 4, h: 1, deep: false },
    { gx: 17, gy: 16, w: 7, h: 2, deep: true },
  ]);
}

/** Standing in the shallow struggle sludge, flush with the ground band. */
function inShallow(): Player {
  return new Player(7 * T, 15 * T - PLAYER.HEIGHT);
}

/** Sunk into the deep pit (its surface is row 16, y 640). */
function inDeep(): Player {
  return new Player(19 * T, 16 * T - PLAYER.HEIGHT);
}

function onDryGround(): Player {
  return new Player(40, 15 * T - PLAYER.HEIGHT);
}

describe('Quicksand (red-tape sludge)', () => {
  it('drags movement in either grade, hardest in the pit, not at all on dry ground', () => {
    const q = sludge();
    expect(q.speedMultAt(inShallow())).toBeCloseTo(HAZARDS.QUICKSAND.WALK_SPEED_MULT, 5);
    expect(q.speedMultAt(inDeep())).toBeCloseTo(HAZARDS.QUICKSAND.DEEP_WALK_SPEED_MULT, 5);
    expect(q.speedMultAt(onDryGround())).toBe(1);
  });

  it('the drag is big enough to be felt, and the pit is worse than the wade', () => {
    // Guards the tuning itself: a shallow multiplier near 1 would make the
    // struggle zone indistinguishable from dry ground, which is the entire
    // claim of Screen 1. Keep the wade at most a third of walking pace.
    expect(HAZARDS.QUICKSAND.WALK_SPEED_MULT).toBeLessThanOrEqual(1 / 3);
    expect(HAZARDS.QUICKSAND.DEEP_WALK_SPEED_MULT).toBeLessThan(
      HAZARDS.QUICKSAND.WALK_SPEED_MULT,
    );
    expect(HAZARDS.QUICKSAND.DEEP_WALK_SPEED_MULT).toBeGreaterThan(0);
  });

  it('shallow struggle sludge is friction only — it never books a delay', () => {
    const q = sludge();
    const p = inShallow();
    let cause = null;
    // Ten times longer than the deep-pit threshold: still nothing.
    for (let i = 0; i < Math.ceil((HAZARDS.QUICKSAND.SINK_SETBACK_TIME * 10) / DT); i += 1) {
      cause = q.update(DT, p, CTX) ?? cause;
    }
    expect(cause).toBeNull();
  });

  it('books a delay after SINK_SETBACK_TIME in the deep pit', () => {
    const q = sludge();
    const p = inDeep();
    const expected = Math.round(HAZARDS.QUICKSAND.SINK_SETBACK_TIME / DT);
    let bookedAt = -1;
    for (let i = 1; i <= 300; i += 1) {
      if (q.update(DT, p, CTX) === 'delay') {
        bookedAt = i;
        break;
      }
    }
    expect(bookedAt).toBeGreaterThan(expected - 3);
    expect(bookedAt).toBeLessThan(expected + 3);
  });

  it('ignores `assisted` — the laid bridge is the relief, the sludge never softens', () => {
    const q = sludge();
    const p = inDeep();
    let booked = false;
    for (let i = 0; i < 300; i += 1) {
      if (q.update(DT, p, ASSISTED) === 'delay') {
        booked = true;
        break;
      }
    }
    expect(booked).toBe(true);
  });

  it('blocks jumping in the deep pit but not in the shallow sludge', () => {
    const q = sludge();
    expect(q.blocksJump(inDeep())).toBe(true);
    expect(q.blocksJump(inShallow())).toBe(false);
    expect(q.blocksJump(onDryGround())).toBe(false);
  });

  it('resets the contact timer when the player leaves the pit', () => {
    const q = sludge();
    const p = inDeep();
    for (let i = 0; i < 40; i += 1) q.update(DT, p, CTX); // ~0.67s of contact
    expect(q.sinkProgress).toBeGreaterThan(0);
    const dry = onDryGround();
    q.update(DT, dry, CTX);
    expect(q.sinkProgress).toBe(0);
  });

  it('exposes both grades for rendering', () => {
    const q = sludge();
    expect(q.rects.map((r) => r.deep)).toEqual([false, true]);
    expect(q.solids()).toHaveLength(2);
  });
});
