import { describe, it, expect } from 'vitest';
import { Gates } from './Gates';
import { Player } from '../Player';
import { LOOP, HAZARDS, RESOLUTION } from '../../data/tuning.config';
import type { HazardContext } from '../types';

const DT = LOOP.FIXED_DT;
const T = RESOLUTION.TILE;
const CTX: HazardContext = { assisted: false, extraTelegraph: 0 };
const ASSISTED: HazardContext = { assisted: true, extraTelegraph: 0 };

/** One barrier at gx 6, on-beat (phase 0 → centred at t=0). */
function gates(): Gates {
  return new Gates([{ gx: 6, gy: 14, axis: 'x', phase: 0 }]);
}

/** Beam standing right where the barrier arm sweeps. */
function inGate(): Player {
  return new Player(6 * T + 6, 14 * T - 12);
}

describe('Gates (approval barriers)', () => {
  it('contributes no solids — you thread it, you do not stand on it', () => {
    expect(gates().solids()).toEqual([]);
    expect(gates().speedMultAt()).toBe(1);
  });

  it('costs time when the arm catches you', () => {
    const g = gates();
    const p = inGate();
    let hit = false;
    for (let i = 0; i < Math.ceil((2 * HAZARDS.GATES.SWAY_PERIOD) / DT); i += 1) {
      if (g.update(DT, p, CTX) === 'gate') {
        hit = true;
        break;
      }
    }
    expect(hit).toBe(true);
  });

  it('sweeps within its amplitude and stays out of phase over time', () => {
    const g = gates();
    const p = new Player(20 * T, 500); // clear, so it just runs
    const base = 6 * T + T / 2;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < Math.ceil(HAZARDS.GATES.SWAY_PERIOD / DT); i += 1) {
      g.update(DT, p, CTX);
      const cx = g.gateStates()[0]!.cx;
      min = Math.min(min, cx);
      max = Math.max(max, cx);
    }
    expect(min).toBeGreaterThanOrEqual(base - HAZARDS.GATES.SWAY_AMPLITUDE - 0.001);
    expect(max).toBeLessThanOrEqual(base + HAZARDS.GATES.SWAY_AMPLITUDE + 0.001);
  });

  it('never touches a player standing well clear of it', () => {
    const g = gates();
    const p = new Player(20 * T, 500);
    let cause = null;
    for (let i = 0; i < 600; i += 1) cause = g.update(DT, p, CTX) ?? cause;
    expect(cause).toBeNull();
  });

  describe('assisted (GCC-BOT clears the filing)', () => {
    it('lifts a nearby barrier for good and stops it costing time', () => {
      const g = gates();
      const p = inGate();
      g.update(DT, p, ASSISTED);
      expect(g.clearedCount).toBe(1);

      let cause = null;
      for (let i = 0; i < Math.ceil((3 * HAZARDS.GATES.SWAY_PERIOD) / DT); i += 1) {
        cause = g.update(DT, p, ASSISTED) ?? cause;
      }
      expect(cause).toBeNull();
    });

    it('animates the lift to fully open, then stays open', () => {
      const g = gates();
      const p = inGate();
      g.update(DT, p, ASSISTED);
      expect(g.gateStates()[0]!.open).toBeGreaterThan(0);
      for (let i = 0; i < Math.ceil(HAZARDS.GATES.OPEN_TIME / DT) + 4; i += 1) {
        g.update(DT, p, ASSISTED);
      }
      expect(g.gateStates()[0]!.open).toBe(1);
      // Help does not lapse: still open with the flag gone.
      g.update(DT, p, CTX);
      expect(g.gateStates()[0]!.open).toBe(1);
    });

    it('leaves barriers beyond the open radius down', () => {
      const g = gates();
      const p = new Player(6 * T - HAZARDS.GATES.OPEN_RADIUS - 120, 500);
      g.update(DT, p, ASSISTED);
      expect(g.clearedCount).toBe(0);
      expect(g.gateStates()[0]!.open).toBe(0);
    });

    it('reset() drops every barrier again for a fresh attempt', () => {
      const g = gates();
      const p = inGate();
      g.update(DT, p, ASSISTED);
      expect(g.clearedCount).toBe(1);
      g.reset();
      expect(g.clearedCount).toBe(0);
      expect(g.gateStates()[0]!.open).toBe(0);
    });
  });
});
