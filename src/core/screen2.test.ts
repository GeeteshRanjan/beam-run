import { describe, it, expect } from 'vitest';
import { makeInput } from './Input';
import { JOURNEY } from '../data/tuning.config';
import { Fire } from '../world/Hazards/Fire';
import {
  DT,
  T,
  driveToScreen,
  engageBadge,
  expireGrace,
  forceSetbackAt,
  standAtColumn,
  stepN,
} from '../test/helpers';

/** Struggle lanes come before the badge; relief lanes after it. */
const STRUGGLE_LANE = 6;
const RELIEF_LANE = 18;

describe('Screen 2 — Hire Under Fire (wait in line → Talent500 → keep moving)', () => {
  it('is the Talent500 capability screen, with every lane beyond the badge', () => {
    const sim = driveToScreen(2);
    expect(sim.screen.data.badge!.type).toBe('EXTINGUISH');
    expect(sim.activeHazard).toBeInstanceOf(Fire);
    const badgeGx = sim.screen.data.badge!.gx;
    const lanes = sim.screen.data.fireLanes!;
    expect(lanes.every((l) => l.gx > badgeGx)).toBe(true);
    expect(lanes.length).toBeGreaterThan(1);
  });

  it('standing in a lane costs months and a life', () => {
    const sim = driveToScreen(2);
    expireGrace(sim);
    const added = forceSetbackAt(sim, STRUGGLE_LANE);
    expect(added).toBe(JOURNEY.SETBACK_MONTHS);
    expect(sim.state).toBe('LIFE_LOST');
    expect(sim.setbacks).toBe(1);
    expect(sim.lives).toBe(sim.livesTotal - 1);
  });

  it('engaging Talent500 puts nearby lanes out for good', () => {
    const sim = driveToScreen(2);
    expireGrace(sim);
    engageBadge(sim);
    const fire = sim.activeHazard as Fire;
    // Walk into the relief zone; lanes ahead go out as they come into reach.
    standAtColumn(sim, RELIEF_LANE);
    stepN(sim, 2);
    expect(fire.extinguishedCount).toBeGreaterThan(0);
    expect(fire.laneStates().find((l) => l.x === RELIEF_LANE * T)!.state).toBe('out');
  });

  it('the relief zone is genuinely free — no months lost standing in a doused lane', () => {
    const sim = driveToScreen(2);
    expireGrace(sim);
    engageBadge(sim);
    const before = sim.months;
    for (let i = 0; i < 400; i += 1) {
      standAtColumn(sim, RELIEF_LANE);
      sim.step(DT, makeInput());
    }
    expect(sim.months).toBe(before);
    expect(sim.setbacks).toBe(0);
  });

  it('help does not lapse: doused lanes stay out for the rest of the screen', () => {
    const sim = driveToScreen(2);
    engageBadge(sim);
    standAtColumn(sim, RELIEF_LANE);
    stepN(sim, 2);
    const fire = sim.activeHazard as Fire;
    const doused = fire.extinguishedCount;
    stepN(sim, 600); // 10s — longer than any old timed shield
    expect(fire.extinguishedCount).toBeGreaterThanOrEqual(doused);
    expect(sim.activePower?.product).toBe('Talent500');
  });
});
