import { describe, it, expect } from 'vitest';
import { Plants } from './Plants';
import { Player } from '../Player';
import { LOOP, HAZARDS, RESOLUTION } from '../../data/tuning.config';
import type { HazardContext } from '../types';

const DT = LOOP.FIXED_DT;
const T = RESOLUTION.TILE;
const CTX: HazardContext = { freeze: false, extraTelegraph: 0 };

describe('Plants', () => {
  it('is lethal when the player overlaps a plant in its path', () => {
    // Plant at gx 6, phase 0 → sway starts at 0 (centred on its base).
    const plants = new Plants([{ gx: 6, gy: 14, axis: 'x', phase: 0 }]);
    const p = new Player(6 * T + T / 2 - 14, 14 * T); // centred on the plant
    expect(plants.update(DT, p, CTX)).toBe('plant');
  });

  it('is not lethal when the player threads the gap (plant swayed away)', () => {
    const plants = new Plants([{ gx: 6, gy: 14, axis: 'x', phase: 0 }]);
    // Stand a full sway-amplitude + margin to the left of the base centre.
    const cx = 6 * T + T / 2;
    const p = new Player(cx - HAZARDS.PLANTS.SWAY_AMPLITUDE - 60, 14 * T);
    let everLethal = false;
    for (let i = 0; i < Math.ceil(HAZARDS.PLANTS.SWAY_PERIOD / DT) + 4; i += 1) {
      if (plants.update(DT, p, CTX) === 'plant') everLethal = true;
    }
    expect(everLethal).toBe(false);
  });

  it('each plant sways on its own phase (positions differ)', () => {
    const plants = new Plants([
      { gx: 6, gy: 14, axis: 'x', phase: 0 },
      { gx: 6, gy: 14, axis: 'x', phase: 0.5 },
    ]);
    // Advance a quarter period so phase differences are visible.
    const p = new Player(0, 0);
    for (let i = 0; i < Math.ceil(HAZARDS.PLANTS.SWAY_PERIOD / 4 / DT); i += 1) {
      plants.update(DT, p, CTX);
    }
    const [a, b] = plants.plantStates();
    expect(Math.abs(a!.cx - b!.cx)).toBeGreaterThan(1);
  });
});
