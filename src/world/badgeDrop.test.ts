/**
 * The air-dropped badge (Hire Under Fire).
 *
 * Everything here is a claim about a *pure function of time*, which is the whole
 * reason this mechanic is safe to add: the drone, the parcel and the pickup box are
 * one derivation, so a test that pins the derivation pins the game.
 */
import { describe, it, expect } from 'vitest';
import {
  dropBoxAt,
  dropColumnsOf,
  dropCycleLength,
  dropLandsAt,
  dropReleaseTime,
  dropRestBox,
  dropStateAt,
  isAirdropped,
} from './badgeDrop';
import { POWERUPS, PLAYER, RESOLUTION } from '../data/tuning.config';
import { SCREENS } from '../data/levels';
import type { BadgeSpec } from '../data/levels';

const T = RESOLUTION.TILE;
const D = POWERUPS.DROP;
const GROUND_TOP = 15 * T;

const BADGE: BadgeSpec = {
  type: 'EXTINGUISH',
  gx: 4,
  gy: 5,
  delivery: 'airdrop',
  drops: [6, 13, 19],
};

describe('the air-dropped badge', () => {
  it('is only used by the screen that declares it', () => {
    const airdropped = SCREENS.filter((s) => s.badge && isAirdropped(s.badge));
    expect(airdropped).toHaveLength(1);
    expect(airdropped[0]!.name).toBe('Hire Under Fire');
    // …and nothing else in the game grew a delivery it does not want.
    for (const s of SCREENS) {
      if (s.badge && !isAirdropped(s.badge)) expect(s.badge.drops).toBeUndefined();
    }
  });

  it('runs one delivery per cycle, and the cycle is a fixed length', () => {
    expect(dropCycleLength()).toBe(D.CROSS_TIME + D.GAP);
    // Which column a delivery uses is plain arithmetic on the cycle — that is what
    // keeps the whole thing stateless.
    expect(dropStateAt(BADGE, 0.1).dropGx).toBe(6);
    expect(dropStateAt(BADGE, dropCycleLength() + 0.1).dropGx).toBe(13);
    expect(dropStateAt(BADGE, 2 * dropCycleLength() + 0.1).dropGx).toBe(19);
    // …and then it starts again, so a screen can never run out of badges.
    expect(dropStateAt(BADGE, 3 * dropCycleLength() + 0.1).dropGx).toBe(6);
  });

  it('goes carrying → falling → live, in that order, once per cycle', () => {
    const seen: string[] = [];
    for (let t = 0; t < dropCycleLength(); t += 0.05) {
      const phase = dropStateAt(BADGE, t).phase;
      if (seen[seen.length - 1] !== phase) seen.push(phase);
    }
    /*
     * The ORDER is the claim, not the length of the list. Whether a `gone` beat falls inside
     * the same cycle depends on the column and on the clock: with the slower drone and the
     * shorter fall this pass brought in (`POWERUPS.DROP.CROSS_TIME` 2.6 → 3.4, `FALL_TIME`
     * 0.55 → 0.35) the early columns now expire before the cycle is out, where before they
     * did not. That is the next test's subject; this one is about the sequence.
     */
    expect(seen.slice(0, 3)).toEqual(['carrying', 'falling', 'live']);
    expect(seen.slice(3)).toEqual(seen.slice(3).filter((p) => p === 'gone'));
  });

  it('reaches "gone" when the lifetime runs out inside the cycle', () => {
    /*
     * `gone` is the quiet beat between one badge expiring and the next drone. Whether
     * it happens at all depends on the column: the release time grows with the drop's
     * distance across the frame (the drone travels at one speed), so
     * `release + FALL_TIME + LIFETIME` can land past the end of the cycle — and then
     * the next delivery takes over while the old badge is still notionally live.
     *
     * That is harmless (the new drone *is* the new chance, and `dropBoxAt` follows the
     * current cycle) but it is worth pinning, because it is why the phase walk above
     * stops at `live`. Measured on a column released early enough for the whole life
     * to fit.
     */
    const early: BadgeSpec = { ...BADGE, drops: [0] };
    const gone = dropReleaseTime(0) + D.FALL_TIME + D.LIFETIME;
    expect(gone).toBeLessThan(dropCycleLength());
    expect(dropStateAt(early, gone + 0.05).phase).toBe('gone');
    expect(dropBoxAt(early, gone + 0.05)).toBeNull();
  });

  it('carries the badge under the drone, then lets it fall to the floor', () => {
    const carried = dropStateAt(BADGE, 0.4);
    expect(carried.carrying).toBe(true);
    // Slung under the hull, and travelling with it.
    expect(carried.badge.x).toBe(carried.carrier.x);
    expect(carried.badge.y).toBeGreaterThan(carried.carrier.y);
    const later = dropStateAt(BADGE, 0.8);
    expect(later.carrier.x).toBeGreaterThan(carried.carrier.x);

    // Released over the column, and it stays over the column while it falls.
    const release = dropReleaseTime(6);
    const mid = dropStateAt(BADGE, release + D.FALL_TIME * 0.5);
    expect(mid.phase).toBe('falling');
    expect(mid.carrying).toBe(false);
    expect(mid.badge.x).toBe(6 * T + T / 2);
    expect(mid.badge.y).toBeLessThan(GROUND_TOP - T / 2);
    // …and it accelerates rather than being lowered on a wire.
    const early = dropStateAt(BADGE, release + D.FALL_TIME * 0.25);
    const late = dropStateAt(BADGE, release + D.FALL_TIME * 0.75);
    expect(late.badge.y - mid.badge.y).toBeGreaterThan(mid.badge.y - early.badge.y);
  });

  it('is takeable only while it is lying on the ground', () => {
    const landed = dropLandsAt(BADGE, 0);
    expect(dropBoxAt(BADGE, landed - 0.1)).toBeNull(); // still in the air
    const box = dropBoxAt(BADGE, landed + 0.1);
    expect(box).not.toBeNull();
    // It rests ON the floor, and it is one tile, like every other pickup here.
    expect(box!.w).toBe(T);
    expect(box!.h).toBe(T);
    expect(box!.y + box!.h).toBe(GROUND_TOP);
    expect(dropBoxAt(BADGE, landed + D.LIFETIME + 0.1)).toBeNull(); // gone
  });

  it('gives the player a few seconds, and counts them down', () => {
    const landed = dropLandsAt(BADGE, 0);
    expect(dropStateAt(BADGE, landed + 0.01).remaining).toBeCloseTo(D.LIFETIME, 1);
    expect(dropStateAt(BADGE, landed + D.LIFETIME - 0.5).remaining).toBeCloseTo(0.5, 1);
    // Nothing to count down anywhere else.
    expect(dropStateAt(BADGE, 0.2).remaining).toBe(0);
    expect(dropStateAt(BADGE, landed + D.LIFETIME + 0.2).remaining).toBe(0);
  });

  it('is walkable, deliberately — this badge is a clock, not a jump', () => {
    // Every other badge in the game is authored to sit above a standing player's head
    // (`badgeFloat`). This one is the exception the owner asked for, and it only works
    // because it expires: the box has to be reachable from the ground.
    const box = dropRestBox(BADGE, 0);
    const standingHead = GROUND_TOP - PLAYER.HEIGHT;
    expect(box.y).toBeLessThan(GROUND_TOP);
    expect(box.y + box.h).toBeGreaterThan(standingHead);
  });

  it('is makeable: the first drop can be walked to with time to spare', () => {
    const walk = Math.abs(dropRestBox(BADGE, 0).x - 1 * T) / PLAYER.WALK_SPEED;
    const gone = dropLandsAt(BADGE, 0) + D.LIFETIME;
    expect(gone - walk).toBeGreaterThan(1);
  });

  it('drops further out later in a cycle, because the drone is still flying', () => {
    // Worth knowing when reading the timings: the release is simply the moment the
    // drone is overhead, so the far columns land later and leave less walking time.
    expect(dropReleaseTime(6)).toBeLessThan(dropReleaseTime(13));
    expect(dropReleaseTime(13)).toBeLessThan(dropReleaseTime(19));
    expect(dropLandsAt(BADGE, 0)).toBeLessThan(dropLandsAt(BADGE, 1));
  });

  it('keeps the drone on a straight crossing, off-frame at both ends', () => {
    expect(dropStateAt(BADGE, 0).carrier.x).toBe(-D.MARGIN);
    expect(dropStateAt(BADGE, D.CROSS_TIME).carrier.x).toBe(RESOLUTION.WIDTH + D.MARGIN);
    // It flies along the authored row, and never dips.
    for (const t of [0.2, 1.4, 3.9]) {
      expect(dropStateAt(BADGE, t).carrier.y).toBe(BADGE.gy * T + T / 2);
    }
  });

  it('defaults to the badge column when no drops are authored', () => {
    const lazy: BadgeSpec = { type: 'EXTINGUISH', gx: 9, gy: 5, delivery: 'airdrop' };
    expect(dropColumnsOf(lazy)).toEqual([9]);
    expect(dropStateAt(lazy, 0.2).dropGx).toBe(9);
  });

  it('is a pure function of time: the same clock always gives the same delivery', () => {
    for (const t of [0.3, 2.2, 7.9, 21.4]) {
      expect(dropStateAt(BADGE, t)).toEqual(dropStateAt(BADGE, t));
    }
  });
});
