import { describe, it, expect } from 'vitest';
import { SCREENS, type BadgeSpec } from '../data/levels';
import { RESOLUTION, POWERUPS } from '../data/tuning.config';
import {
  ceilingBoxAt,
  ceilingCycleLength,
  ceilingLandsAt,
  ceilingRestBox,
  ceilingSource,
  ceilingStateAt,
  isCeilingDrop,
} from './badgeCeiling';

const T = RESOLUTION.TILE;
const C = POWERUPS.CEILING;
const spec: BadgeSpec = { type: 'UNWRAP', gx: 5, gy: 4, delivery: 'ceiling', restGy: 12 };

describe('the ceiling drop (the Workplace’s badge)', () => {
  it('is the delivery on exactly one screen', () => {
    const ceiling = SCREENS.filter((s) => s.badge && isCeilingDrop(s.badge));
    expect(ceiling).toHaveLength(1);
    expect(ceiling[0]!.name).toBe('Workplace');
  });

  it('falls straight down the fitting’s own axis', () => {
    // It came out of a fixed light, so it cannot drift sideways on the way down: an arc
    // would say it was thrown by somebody.
    const source = ceilingSource(spec);
    for (const u of [0, 0.2, 0.5, 0.8, 1]) {
      const t = C.HOLD + C.FALL_TIME * u;
      expect(ceilingStateAt(spec, t).badge.x).toBe(source.x);
    }
    expect(ceilingRestBox(spec).x + T / 2).toBe(source.x);
  });

  it('waits, falls, lives, expires — and comes back for another go', () => {
    expect(ceilingStateAt(spec, 0).phase).toBe('held');
    expect(ceilingStateAt(spec, C.HOLD - 0.01).phase).toBe('held');
    expect(ceilingStateAt(spec, C.HOLD + 0.01).phase).toBe('falling');
    expect(ceilingStateAt(spec, ceilingLandsAt(0) + 0.01).phase).toBe('live');
    expect(ceilingStateAt(spec, ceilingLandsAt(0) + C.LIFETIME + 0.01).phase).toBe('gone');
    // Next cycle, same shape. A missed drop costs seconds, never the capability.
    expect(ceilingStateAt(spec, ceilingCycleLength() + 0.01).phase).toBe('held');
    expect(ceilingLandsAt(1) - ceilingLandsAt(0)).toBeCloseTo(ceilingCycleLength(), 6);
  });

  it('is collectable only where and when it rests', () => {
    // One answer per frame to "is the badge takeable", and it is the same rectangle the
    // renderer paints. A mark still up in the light must not be collectable — that beat is
    // the mechanic, and a pickup you could take early would delete it.
    expect(ceilingBoxAt(spec, 0)).toBeNull();
    expect(ceilingBoxAt(spec, C.HOLD + C.FALL_TIME * 0.5)).toBeNull();
    expect(ceilingBoxAt(spec, ceilingLandsAt(0) + 0.1)).toEqual(ceilingRestBox(spec));
    expect(ceilingBoxAt(spec, ceilingLandsAt(0) + C.LIFETIME + 0.1)).toBeNull();
  });

  it('counts down while it is down, and nowhere else', () => {
    const live = ceilingStateAt(spec, ceilingLandsAt(0) + 1);
    expect(live.remaining).toBeCloseTo(C.LIFETIME - 1, 6);
    expect(ceilingStateAt(spec, 1).remaining).toBe(0);
    expect(ceilingStateAt(spec, ceilingLandsAt(0) + C.LIFETIME + 1).remaining).toBe(0);
  });

  it('is a pure function of (spec, time): the same t always gives the same view', () => {
    // No stored phase and no wall clock, so `step()` stays replayable and a reload cannot
    // leave a badge halfway down.
    for (const t of [0, 1.7, C.HOLD + 0.2, ceilingLandsAt(0) + 2, ceilingCycleLength() * 2.4]) {
      expect(ceilingStateAt(spec, t)).toEqual(ceilingStateAt(spec, t));
    }
  });

  it('rests on the row it is authored against, not on the floor', () => {
    expect(ceilingRestBox(spec).y + T).toBe(spec.restGy! * T);
    // …and with no `restGy` it falls to the ground band, which is the honest fallback for
    // any future screen that wants this delivery without a cabinet.
    const loose: BadgeSpec = { type: 'UNWRAP', gx: 5, gy: 4, delivery: 'ceiling' };
    expect(ceilingRestBox(loose).y + T).toBe(15 * T);
  });
});
