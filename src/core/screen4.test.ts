import { describe, it, expect } from 'vitest';
import { makeInput } from './Input';
import { JOURNEY, HAZARDS } from '../data/tuning.config';
import { Spikes } from '../world/Hazards/Spikes';
import {
  DT,
  driveToScreen,
  engageBadge,
  expireGrace,
  forceSetbackAt,
  standAtColumn,
  stepN,
} from '../test/helpers';

const STRUGGLE_COLUMN = 6;
const RELIEF_COLUMN = 18;

describe('Screen 4 — Local Expertise (blind → 500Leaders → foreseen)', () => {
  it('is the 500Leaders capability screen, with every column beyond the badge', () => {
    const sim = driveToScreen(4);
    expect(sim.screen.data.badge!.type).toBe('FORESIGHT');
    expect(sim.screen.data.hazard).toBe('spikes');
    expect(sim.activeHazard).toBeInstanceOf(Spikes);
    const badgeGx = sim.screen.data.badge!.gx;
    const cols = sim.screen.data.spikeColumns!;
    expect(cols.every((c) => c.gx > badgeGx)).toBe(true);
    expect(cols.length).toBeGreaterThan(1);
  });

  it('a column costs months and a life', () => {
    const sim = driveToScreen(4);
    expireGrace(sim);
    const added = forceSetbackAt(sim, STRUGGLE_COLUMN);
    expect(added).toBe(JOURNEY.SETBACK_MONTHS);
    expect(sim.state).toBe('LIFE_LOST');
    expect(sim.setbacks).toBe(1);
    expect(sim.lives).toBe(sim.livesTotal - 1);
  });

  it('engaging 500Leaders makes every column foreseen and free of setbacks', () => {
    const sim = driveToScreen(4);
    expireGrace(sim);
    engageBadge(sim);
    const spikes = sim.activeHazard as Spikes;

    const before = sim.months;
    for (let i = 0; i < 600; i += 1) {
      standAtColumn(sim, RELIEF_COLUMN);
      sim.step(DT, makeInput());
    }
    expect(sim.months).toBe(before);
    expect(spikes.spikeStates().every((s) => s.foreseen)).toBe(true);
  });

  it('foresight publishes a preview window without pausing the market', () => {
    const sim = driveToScreen(4);
    engageBadge(sim);
    const spikes = sim.activeHazard as Spikes;
    const before = spikes.spikeStates()[0]!.y;
    stepN(sim, 30);
    const after = spikes.spikeStates()[0]!;
    // Time did NOT stop — this is knowledge, not a freeze.
    expect(after.y === before && after.state === 'resting').toBe(false);
    expect(after.timeToFall).toBeGreaterThanOrEqual(0);
    expect(Spikes.previewWindow).toBe(HAZARDS.SPIKES.FORESIGHT_TELEGRAPH);
  });

  it('help does not lapse — foresight lasts the rest of the screen', () => {
    const sim = driveToScreen(4);
    engageBadge(sim);
    stepN(sim, 600);
    expect(sim.activePower?.product).toBe('500Leaders');
    expect((sim.activeHazard as Spikes).spikeStates()[0]!.foreseen).toBe(true);
  });
});
