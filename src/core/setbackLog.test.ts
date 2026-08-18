import { describe, it, expect } from 'vitest';
import { COPY } from '../data/copy';
import { JOURNEY, LIVES, POWERUPS, RESOLUTION } from '../data/tuning.config';
import {
  causeLabel,
  ledgerRows,
  loggedMonths,
  logPanelView,
  type SetbackLogEntry,
} from './setbackLog';
import { badgeBoxAt, badgeCenter, badgeFloatOffset, badgeLowestBox } from '../world/badgeFloat';
import type { SetbackCause } from '../world/types';

function entry(cause: SetbackCause, index: number, screenId = 2): SetbackLogEntry {
  return {
    index,
    screenId,
    screenName: 'Hire Under Fire',
    cause,
    months: JOURNEY.SETBACK_MONTHS,
  };
}

describe('delay log', () => {
  it('names every obstacle from the copy deck, never from a raw cause', () => {
    for (const cause of ['stamp', 'fire', 'gate', 'spike', 'fall'] as const) {
      expect(causeLabel(cause)).toBe(COPY.setback.tag[cause]);
    }
  });

  it('totals the months the delays booked', () => {
    const log = [entry('fire', 1), entry('gate', 2), entry('fire', 3)];
    expect(loggedMonths(log)).toBe(3 * JOURNEY.SETBACK_MONTHS);
    expect(loggedMonths([])).toBe(0);
  });

  it('groups repeats by obstacle, in first-encountered order', () => {
    // "RED TAPE x2, +4 months" is a finding; four identical rows is noise.
    const rows = ledgerRows([entry('fire', 1), entry('gate', 2), entry('fire', 3)]);
    expect(rows.map((r) => r.cause)).toEqual(['fire', 'gate']);
    expect(rows[0]).toMatchObject({ count: 2, months: 2 * JOURNEY.SETBACK_MONTHS });
    expect(rows[1]).toMatchObject({ count: 1, months: JOURNEY.SETBACK_MONTHS });
    expect(ledgerRows([])).toEqual([]);
  });

  it('bounds the HUD panel: it shows the latest rows and rolls up the rest', () => {
    // The panel hangs from the top of the frame and grows downwards, so an
    // unbounded list would eventually cover the play area.
    const n = LIVES.LOG_VISIBLE_ROWS + 3;
    const log = Array.from({ length: n }, (_, i) => entry(i === 0 ? 'fall' : 'fire', i + 1));
    const view = logPanelView(log, LIVES.LOG_VISIBLE_ROWS);
    expect(view.rows).toHaveLength(LIVES.LOG_VISIBLE_ROWS);
    expect(view.earlier).toBe(3);
    expect(view.count).toBe(n);
    // The oldest (the only 'fall') has rolled up out of the visible rows...
    expect(view.rows.some((r) => r.label === causeLabel('fall'))).toBe(false);
    // ...but the total still counts every entry, which is the whole point.
    expect(view.total).toBe(n * JOURNEY.SETBACK_MONTHS);
  });

  it('reports an empty log as empty, so the panel can stay hidden', () => {
    const view = logPanelView([], LIVES.LOG_VISIBLE_ROWS);
    expect(view).toMatchObject({ rows: [], earlier: 0, total: 0, count: 0 });
  });
});

describe('badge float', () => {
  const badge = { type: 'EXTINGUISH' as const, gx: 3, gy: 12 };
  const T = RESOLUTION.TILE;

  it('travels a straight vertical line: x never moves', () => {
    const xs = new Set<number>();
    for (let i = 0; i < 60; i += 1) xs.add(badgeCenter(badge, i * 0.05).x);
    expect(xs.size).toBe(1);
    expect([...xs][0]).toBe(badge.gx * T + T / 2);
  });

  it('stays inside its authored band and returns to the anchor each cycle', () => {
    const anchorY = badge.gy * T + T / 2;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 400; i += 1) {
      const y = badgeCenter(badge, i * 0.02).y;
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    expect(lo).toBeGreaterThanOrEqual(anchorY - POWERUPS.FLOAT_AMPLITUDE - 0.001);
    expect(hi).toBeLessThanOrEqual(anchorY + POWERUPS.FLOAT_AMPLITUDE + 0.001);
    // One full period brings it back to where it started.
    expect(badgeCenter(badge, POWERUPS.FLOAT_PERIOD).y).toBeCloseTo(anchorY, 6);
    expect(badgeFloatOffset(0)).toBeCloseTo(0, 10);
  });

  it('is a pure function of time — the same clock gives the same box', () => {
    // The sim and the renderer both read this. If it depended on anything else,
    // the pickup would be drawn somewhere the collision is not.
    expect(badgeBoxAt(badge, 1.234)).toEqual(badgeBoxAt(badge, 1.234));
    expect(badgeBoxAt(badge, 1.234)).not.toEqual(badgeBoxAt(badge, 1.834));
  });

  it('exposes the bottom of the swing, which is what reachability is proved against', () => {
    const lowest = badgeLowestBox(badge);
    expect(lowest.y + lowest.h / 2).toBeCloseTo(
      badge.gy * T + T / 2 + POWERUPS.FLOAT_AMPLITUDE,
      6,
    );
    for (let i = 0; i < 400; i += 1) {
      expect(badgeBoxAt(badge, i * 0.02).y).toBeLessThanOrEqual(lowest.y + 0.001);
    }
  });

  it('dips low enough to be walked into from the ground band', () => {
    // A badge that only ever floats above head height would have to be jumped for
    // on every screen; one that never leaves the ground could not be missed. The
    // band is authored so a good pass catches it and a mistimed one needs a hop.
    const lowest = badgeLowestBox(badge);
    const standingTop = 15 * T - 44; // feet on the ground band, 44px hitbox
    expect(lowest.y).toBeLessThan(standingTop + 44);
    expect(lowest.y + lowest.h).toBeGreaterThan(standingTop);
  });
});
