import { describe, it, expect } from 'vitest';
import { Fire } from './Fire';
import { Player } from '../Player';
import { LOOP, HAZARDS, RESOLUTION } from '../../data/tuning.config';
import type { HazardContext } from '../types';

const DT = LOOP.FIXED_DT;
const T = RESOLUTION.TILE;
const CTX: HazardContext = { assisted: false, extraTelegraph: 0 };
const ASSISTED: HazardContext = { assisted: true, extraTelegraph: 0 };

// One lane at gx 8, phaseIndex 0.
function fire(): Fire {
  return new Fire([{ gx: 8, phaseIndex: 0 }]);
}

// Beam standing in the lane column.
function inLane(): Player {
  return new Player(8 * T + 5, 500);
}

describe('Fire (hiring pressure)', () => {
  it('costs time only during the ACTIVE window of the cycle', () => {
    const f = fire();
    const p = inLane();
    const steps = Math.ceil((2 * HAZARDS.FIRE.INTERVAL) / DT);
    let sawActiveHit = false;
    for (let i = 1; i <= steps; i += 1) {
      const cause = f.update(DT, p, CTX);
      const state = f.laneStates()[0]!.state;
      if (cause === 'fire') {
        expect(state).toBe('active');
        sawActiveHit = true;
      }
    }
    expect(sawActiveHit).toBe(true);
  });

  it('hits a player who stands in the lane through a full cycle', () => {
    const f = fire();
    const p = inLane();
    let hit = false;
    for (let i = 0; i < Math.ceil(HAZARDS.FIRE.INTERVAL / DT) + 2; i += 1) {
      if (f.update(DT, p, CTX) === 'fire') {
        hit = true;
        break;
      }
    }
    expect(hit).toBe(true);
  });

  it('never hits a player standing between lanes', () => {
    const f = fire();
    const p = new Player(12 * T, 500); // clear of the gx8 lane column
    let cause = null;
    for (let i = 0; i < 300; i += 1) cause = f.update(DT, p, CTX) ?? cause;
    expect(cause).toBeNull();
  });

  it('telegraph is a warning, never a cost', () => {
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

  describe('assisted (Talent500 fills the roles)', () => {
    it('extinguishes a nearby lane for good and stops it costing time', () => {
      const f = fire();
      const p = inLane();
      f.update(DT, p, ASSISTED);
      expect(f.laneStates()[0]!.state).toBe('out');
      expect(f.extinguishedCount).toBe(1);

      // Standing in a doused lane for several cycles is now free.
      let cause = null;
      for (let i = 0; i < Math.ceil((3 * HAZARDS.FIRE.INTERVAL) / DT); i += 1) {
        cause = f.update(DT, p, ASSISTED) ?? cause;
      }
      expect(cause).toBeNull();
    });

    it('stays out even after help is no longer flagged (it does not relight)', () => {
      const f = fire();
      const p = inLane();
      f.update(DT, p, ASSISTED);
      let cause = null;
      for (let i = 0; i < Math.ceil((3 * HAZARDS.FIRE.INTERVAL) / DT); i += 1) {
        cause = f.update(DT, p, CTX) ?? cause;
      }
      expect(f.laneStates()[0]!.state).toBe('out');
      expect(cause).toBeNull();
    });

    it('leaves lanes beyond the extinguish radius burning', () => {
      const far = new Fire([{ gx: 8, phaseIndex: 0 }]);
      // Player far to the left of the lane, outside EXTINGUISH_RADIUS.
      const p = new Player(8 * T - HAZARDS.FIRE.EXTINGUISH_RADIUS - 120, 500);
      far.update(DT, p, ASSISTED);
      expect(far.laneStates()[0]!.state).not.toBe('out');
      expect(far.extinguishedCount).toBe(0);
    });

    it('reset() relights every lane for a fresh attempt', () => {
      const f = fire();
      const p = inLane();
      f.update(DT, p, ASSISTED);
      expect(f.extinguishedCount).toBe(1);
      f.reset();
      expect(f.extinguishedCount).toBe(0);
    });
  });
});
