import { describe, it, expect } from 'vitest';
import { makeInput } from './Input';
import { JOURNEY } from '../data/tuning.config';
import { Gates } from '../world/Hazards/Gates';
import { DT, T, driveToScreen, engageBadge, expireGrace, stepN } from '../test/helpers';

/** Park Beam where a barrier arm sweeps (gate rows sit at gy14). */
function standAtGate(sim: ReturnType<typeof driveToScreen>, gx: number): void {
  sim.player.box.x = gx * T + 6;
  sim.player.box.y = 14 * T - 12;
}

describe('Screen 3 — Compliance (thread the approvals → GCC-BOT → cleared)', () => {
  it('is the GCC-BOT capability screen, with every barrier beyond the badge', () => {
    const sim = driveToScreen(3);
    expect(sim.screen.data.badge!.type).toBe('CLEAR_PATH');
    expect(sim.screen.data.hazard).toBe('gates');
    expect(sim.activeHazard).toBeInstanceOf(Gates);
    const badgeGx = sim.screen.data.badge!.gx;
    const gates = sim.screen.data.gates!;
    expect(gates.every((g) => g.gx > badgeGx)).toBe(true);
    expect(gates.length).toBeGreaterThan(1);
  });

  it('a barrier costs months and a life', () => {
    const sim = driveToScreen(3);
    expireGrace(sim);
    const before = sim.months;
    const struggleGx = sim.screen.data.gates![0]!.gx;
    for (let i = 0; i < 600; i += 1) {
      if (sim.state !== 'PLAYING') break;
      standAtGate(sim, struggleGx);
      sim.step(DT, makeInput());
      if (sim.months > before) break;
    }
    expect(sim.months).toBe(before + JOURNEY.SETBACK_MONTHS);
    expect(sim.state).toBe('LIFE_LOST');
    expect(sim.lives).toBe(sim.livesTotal - 1);
  });

  it('engaging GCC-BOT lifts nearby barriers for good', () => {
    const sim = driveToScreen(3);
    expireGrace(sim);
    engageBadge(sim);
    const gates = sim.activeHazard as Gates;
    const reliefGx = sim.screen.data.gates!.find(
      (g) => g.gx > sim.screen.data.badge!.gx,
    )!.gx;
    standAtGate(sim, reliefGx);
    stepN(sim, 2);
    expect(gates.clearedCount).toBeGreaterThan(0);

    // Standing right in a lifted barrier is free.
    const before = sim.months;
    for (let i = 0; i < 400; i += 1) {
      standAtGate(sim, reliefGx);
      sim.step(DT, makeInput());
    }
    expect(sim.months).toBe(before);
  });

  it('help does not lapse — cleared filings stay cleared', () => {
    const sim = driveToScreen(3);
    engageBadge(sim);
    const gates = sim.activeHazard as Gates;
    stepN(sim, 2);
    const cleared = gates.clearedCount;
    stepN(sim, 600);
    expect(gates.clearedCount).toBeGreaterThanOrEqual(cleared);
    expect(sim.activePower?.product).toBe('GCC-BOT');
  });
});
