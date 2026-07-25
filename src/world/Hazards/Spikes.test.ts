import { describe, it, expect } from 'vitest';
import { Spikes } from './Spikes';
import { Player } from '../Player';
import { LOOP, HAZARDS, RESOLUTION } from '../../data/tuning.config';
import type { HazardContext } from '../types';

const DT = LOOP.FIXED_DT;
const T = RESOLUTION.TILE;
const CTX: HazardContext = { assisted: false, extraTelegraph: 0 };
const ASSISTED: HazardContext = { assisted: true, extraTelegraph: 0 };

// One column at gx 7, phaseIndex 0 (starts its cycle at t=0 → telegraph first).
function spikes(): Spikes {
  return new Spikes([{ gx: 7, phaseIndex: 0 }]);
}

/** Beam standing on the ground inside the column (overlaps a resting spike). */
function inColumn(): Player {
  return new Player(7 * T + 4, 560); // y=560 overlaps the resting band (560–600)
}

describe('Spikes (unknown unknowns)', () => {
  it('cycles telegraph → falling → resting → despawning in order', () => {
    const s = spikes();
    const p = inColumn();
    const seen: string[] = [];
    const cycle =
      HAZARDS.SPIKES.TELEGRAPH +
      560 / HAZARDS.SPIKES.FALL_SPEED +
      HAZARDS.SPIKES.REST_TIME +
      HAZARDS.SPIKES.DESPAWN_FADE;
    const steps = Math.ceil((cycle * 1.2) / DT);
    for (let i = 0; i < steps; i += 1) {
      s.update(DT, p, CTX);
      const st = s.spikeStates()[0]!.state;
      if (seen[seen.length - 1] !== st) seen.push(st);
    }
    expect(seen.slice(0, 4)).toEqual(['telegraph', 'falling', 'resting', 'despawning']);
  });

  it('costs time ONLY while falling + resting (never telegraph/despawning)', () => {
    const s = spikes();
    const p = inColumn();
    const steps = Math.ceil(20 / DT);
    let sawFallHit = false;
    let sawRestHit = false;
    for (let i = 0; i < steps; i += 1) {
      const cause = s.update(DT, p, CTX);
      const st = s.spikeStates()[0]!.state;
      if (cause === 'spike') {
        expect(st === 'falling' || st === 'resting').toBe(true);
        if (st === 'falling') sawFallHit = true;
        if (st === 'resting') sawRestHit = true;
      }
      if (st === 'telegraph' || st === 'despawning') expect(cause).toBeNull();
    }
    expect(sawFallHit).toBe(true);
    expect(sawRestHit).toBe(true);
  });

  it('never touches a player standing outside the column', () => {
    const s = spikes();
    const p = inColumn();
    p.box.x = 20 * T; // clear of the gx7 column
    let cause: string | null = null;
    for (let i = 0; i < 1000; i += 1) cause = s.update(DT, p, CTX) ?? cause;
    expect(cause).toBeNull();
  });

  describe('foreseen (500Leaders local context)', () => {
    it('never costs time — you saw it coming and stepped around it', () => {
      const s = spikes();
      const p = inColumn();
      let cause = null;
      for (let i = 0; i < Math.ceil(20 / DT); i += 1) {
        cause = s.update(DT, p, ASSISTED) ?? cause;
      }
      expect(cause).toBeNull();
    });

    it('marks columns as foreseen and publishes time-to-impact', () => {
      const s = spikes();
      const p = inColumn();
      s.update(DT, p, ASSISTED);
      const st = s.spikeStates()[0]!;
      expect(st.foreseen).toBe(true);
      expect(st.timeToFall).toBeGreaterThan(0);
      expect(st.timeToFall).toBeLessThanOrEqual(
        HAZARDS.SPIKES.TELEGRAPH + 560 / HAZARDS.SPIKES.FALL_SPEED + HAZARDS.SPIKES.REST_TIME + HAZARDS.SPIKES.DESPAWN_FADE,
      );
      expect(Spikes.previewWindow).toBe(HAZARDS.SPIKES.FORESIGHT_TELEGRAPH);
    });

    it('does NOT alter the drop rhythm — knowledge, not magic (nothing teleports)', () => {
      // Run two identical columns: one plain, one foreseen. Their positions must
      // stay in lockstep, so picking the badge up never visibly shifts a spike.
      const plain = spikes();
      const seen = spikes();
      const p = new Player(20 * T, 500); // clear of the column, so no setbacks
      for (let i = 0; i < Math.ceil(12 / DT); i += 1) {
        plain.update(DT, p, CTX);
        seen.update(DT, p, ASSISTED);
        const a = plain.spikeStates()[0]!;
        const b = seen.spikeStates()[0]!;
        expect(b.state).toBe(a.state);
        expect(b.y).toBeCloseTo(a.y, 6);
      }
    });
  });
});
