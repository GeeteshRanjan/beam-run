import { describe, it, expect } from 'vitest';
import { Spikes } from './Spikes';
import { Player } from '../Player';
import { LOOP, HAZARDS, RESOLUTION } from '../../data/tuning.config';
import type { HazardContext } from '../types';

const DT = LOOP.FIXED_DT;
const T = RESOLUTION.TILE;
const CTX: HazardContext = { freeze: false, extraTelegraph: 0 };

// One column at gx 7, phaseIndex 0 (starts its cycle at t=0 → telegraph first).
function spikes(): Spikes {
  return new Spikes([{ gx: 7, phaseIndex: 0 }]);
}

/** Beam standing on the ground inside the column (overlaps a resting spike). */
function inColumn(): Player {
  const p = new Player(7 * T + 4, 560); // y=560 overlaps the resting band (560–600)
  return p;
}

describe('Spikes', () => {
  it('cycles telegraph → falling → resting → despawning in order', () => {
    const s = spikes();
    const p = inColumn();
    const seen: string[] = [];
    // One full cycle is telegraph + fall + rest + despawn; step through ~1.2x.
    const cycle =
      HAZARDS.SPIKES.TELEGRAPH +
      (560 / HAZARDS.SPIKES.FALL_SPEED) +
      HAZARDS.SPIKES.REST_TIME +
      HAZARDS.SPIKES.DESPAWN_FADE;
    const steps = Math.ceil((cycle * 1.2) / DT);
    for (let i = 0; i < steps; i += 1) {
      s.update(DT, p, CTX);
      const st = s.spikeStates()[0]!.state;
      if (seen[seen.length - 1] !== st) seen.push(st);
    }
    // First four distinct states, in order.
    expect(seen.slice(0, 4)).toEqual(['telegraph', 'falling', 'resting', 'despawning']);
  });

  it('is lethal ONLY during falling + resting (never telegraph/despawning)', () => {
    const s = spikes();
    const p = inColumn();
    const steps = Math.ceil((2 * 10) / DT); // plenty of cycles
    let sawFallKill = false;
    let sawRestKill = false;
    for (let i = 0; i < steps; i += 1) {
      const cause = s.update(DT, p, CTX);
      const st = s.spikeStates()[0]!.state;
      if (cause === 'spike') {
        expect(st === 'falling' || st === 'resting').toBe(true);
        if (st === 'falling') sawFallKill = true;
        if (st === 'resting') sawRestKill = true;
      } else {
        // No kill this step: if telegraph/despawning it must be non-lethal.
        expect(st === 'telegraph' || st === 'despawning' || cause === null).toBe(true);
      }
    }
    expect(sawFallKill).toBe(true);
    expect(sawRestKill).toBe(true);
  });

  it('telegraph and despawning are never lethal', () => {
    const s = spikes();
    const p = inColumn();
    for (let i = 0; i < Math.ceil((3 * 6) / DT); i += 1) {
      const cause = s.update(DT, p, CTX);
      const st = s.spikeStates()[0]!.state;
      if (st === 'telegraph' || st === 'despawning') expect(cause).toBeNull();
    }
  });

  it('ctx.freeze pauses ALL spikes: no motion, no time advance, no kill', () => {
    const s = spikes();
    const p = inColumn();
    // Advance unfrozen into a lethal (resting) phase first.
    let guard = 0;
    while (s.spikeStates()[0]!.state !== 'resting' && guard++ < 5000) {
      s.update(DT, p, CTX);
    }
    const frozenCtx: HazardContext = { freeze: true, extraTelegraph: 0 };
    const before = s.spikeStates()[0]!;
    for (let i = 0; i < 600; i += 1) {
      const cause = s.update(DT, p, frozenCtx);
      expect(cause).toBeNull(); // frozen never kills, even overlapping
      const now = s.spikeStates()[0]!;
      expect(now.state).toBe(before.state); // no state change
      expect(now.y).toBe(before.y); // no motion
    }
  });

  it('never kills a player standing outside the column', () => {
    const s = spikes();
    const p = inColumn();
    p.box.x = 20 * T; // clear of the gx7 column
    let cause: string | null = null;
    for (let i = 0; i < 1000; i += 1) cause = s.update(DT, p, CTX) ?? cause;
    expect(cause).toBeNull();
  });
});
