import { describe, it, expect } from 'vitest';
import { Fire } from './Fire';
import { Player } from '../Player';
import { LOOP, HAZARDS, RESOLUTION } from '../../data/tuning.config';
import type { HazardContext } from '../types';

const DT = LOOP.FIXED_DT;
const T = RESOLUTION.TILE;
const CTX: HazardContext = { freeze: false, extraTelegraph: 0 };

// One lane at gx 8, phaseIndex 0.
function fire(): Fire {
  return new Fire([{ gx: 8, phaseIndex: 0 }]);
}

// Beam standing in the lane column.
function inLane(): Player {
  return new Player(8 * T + 5, 500);
}

describe('Fire', () => {
  it('is lethal only during the ACTIVE window of the cycle', () => {
    const f = fire();
    const p = inLane();
    // Two full cycles; a lane can only kill while its own state is ACTIVE.
    const steps = Math.ceil((2 * HAZARDS.FIRE.INTERVAL) / DT);
    let sawActiveKill = false;
    for (let i = 1; i <= steps; i += 1) {
      const cause = f.update(DT, p, CTX);
      const state = f.laneStates()[0]!.state;
      if (cause === 'fire') {
        expect(state).toBe('active');
        sawActiveKill = true;
      }
    }
    expect(sawActiveKill).toBe(true);
  });

  it('kills at some point during the active window when standing in the lane', () => {
    const f = fire();
    const p = inLane();
    let killed = false;
    for (let i = 0; i < Math.ceil(HAZARDS.FIRE.INTERVAL / DT) + 2; i += 1) {
      if (f.update(DT, p, CTX) === 'fire') {
        killed = true;
        break;
      }
    }
    expect(killed).toBe(true);
  });

  it('never kills a player standing between lanes', () => {
    const f = new Fire([{ gx: 8, phaseIndex: 0 }]);
    const p = new Player(12 * T, 500); // clear of the gx8 lane column
    let cause = null;
    for (let i = 0; i < 300; i += 1) cause = f.update(DT, p, CTX) ?? cause;
    expect(cause).toBeNull();
  });

  it('telegraph is never lethal', () => {
    const f = fire();
    const p = inLane();
    let sawTelegraph = false;
    for (let i = 1; i <= Math.ceil((2 * HAZARDS.FIRE.INTERVAL) / DT); i += 1) {
      const cause = f.update(DT, p, CTX);
      if (f.laneStates()[0]!.state === 'telegraph') {
        sawTelegraph = true;
        expect(cause).toBeNull();
      }
    }
    expect(sawTelegraph).toBe(true);
  });
});
