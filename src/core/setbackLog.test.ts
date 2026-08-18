import { describe, it, expect } from 'vitest';
import { COPY } from '../data/copy';
import { JOURNEY, LIVES, PLAYER, POWERUPS, RESOLUTION } from '../data/tuning.config';
import { SCREENS } from '../data/levels';
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

/**
 * How far down the frame the HUD's top-left stack reaches (stage plaque + lives)
 * at a 1280-wide frame, measured from `Hud.ts`'s own sizing formula: ~22px inset
 * + a 69px stage plaque + an 8px gap + a 51px lives plaque. The badge column
 * (gx 4) passes under it, so the top of the float band has to stop below this or
 * the pickup hides behind DOM chrome.
 */
const HUD_LEFT_STACK_BOTTOM = 150;

describe('badge float', () => {
  const badge = { type: 'EXTINGUISH' as const, gx: 3, gy: 8 };
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

  /**
   * The band's two clearances are the whole design of the pickup (owner call: it
   * was too easy to take when the bottom of the swing dipped into a standing
   * player). Asserted against every authored anchor, not just a fixture, because
   * the numbers only work as a set: tuning, level data and player physics.
   */
  describe('is out of reach standing and in reach jumping, on every screen', () => {
    const standingTop = 15 * T - PLAYER.HEIGHT; // feet on the ground band
    const jumpRise = (PLAYER.JUMP_VELOCITY * PLAYER.JUMP_VELOCITY) / (2 * PLAYER.GRAVITY);

    for (const screen of SCREENS) {
      const b = screen.badge!;
      it(`screen ${screen.id} (${screen.name})`, () => {
        const lowest = badgeLowestBox(b);
        // Never walkable-into: the bottom of the swing clears a standing head…
        expect(lowest.y + lowest.h).toBeLessThan(standingTop);
        // …but a jump reaches it with margin (a full jump lifts ~140px).
        const hopNeeded = standingTop - (lowest.y + lowest.h);
        expect(hopNeeded).toBeLessThan(jumpRise * 0.6);
        // And the top of the swing stays clear of the HUD's left stack, which
        // hangs over this column (see POWERUPS in tuning.config.ts).
        const highestTop = b.gy * T + T / 2 - POWERUPS.FLOAT_AMPLITUDE - T / 2;
        expect(highestTop).toBeGreaterThan(HUD_LEFT_STACK_BOTTOM);
        expect(highestTop).toBeLessThan(RESOLUTION.HEIGHT * 0.25);
      });
    }
  });
});
