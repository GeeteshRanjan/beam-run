import { describe, it, expect } from 'vitest';
import { makeInput } from './Input';
import { JOURNEY, HAZARDS, RESOLUTION } from '../data/tuning.config';
import { Stamps } from '../world/Hazards/Stamps';
import {
  DT,
  T,
  driveToScreen,
  engageBadge,
  expireGrace,
  recoverFromLifeLost,
  stepN,
} from '../test/helpers';

const S = HAZARDS.STAMPS;

/** Park Beam on the ground directly under a stamp column. */
function standUnder(sim: ReturnType<typeof driveToScreen>, gx: number): void {
  sim.player.box.x = gx * T + T / 2 - sim.player.box.w / 2;
  sim.player.box.y = 15 * T - sim.player.box.h;
}

/**
 * Walk right from the spawn for `seconds`, holding the run. Returns the sim so
 * the caller can see how far it got and whether anything stopped it.
 */
function walkRight(sim: ReturnType<typeof driveToScreen>, seconds: number): void {
  const frames = Math.ceil(seconds / DT);
  for (let i = 0; i < frames; i += 1) {
    if (sim.state !== 'PLAYING') return;
    sim.step(DT, makeInput({ right: true }));
  }
}

describe('Screen 1 — Setup Delays (DENIED stamps → 1Wrk → walk through)', () => {
  it('is the 1Wrk capability screen, running on slamming DENIED stamps', () => {
    const sim = driveToScreen(1);
    expect(sim.screen.data.badge!.type).toBe('PLACE_TILE');
    expect(sim.screen.data.hazard).toBe('stamps');
    expect(sim.activeHazard).toBeInstanceOf(Stamps);
  });

  it('is laid out as two stamps, a wall, then two more', () => {
    const sim = driveToScreen(1);
    const cols = sim.screen.data.stamps!.map((s) => s.gx).sort((a, b) => a - b);
    expect(cols).toHaveLength(4);

    const wall = sim.screen.data.solids.find((s) => s.role?.startsWith('wall'))!;
    expect(wall).toBeTruthy();
    // Two stamps before the wall, two after it.
    expect(cols.filter((gx) => gx < wall.gx)).toHaveLength(2);
    expect(cols.filter((gx) => gx > wall.gx)).toHaveLength(2);
    // The wall is small: two tiles tall against a ~140px jump, so it is a hop,
    // not a gate. (The physics validator proves the screen is completable.)
    expect(wall.h * T).toBeLessThan(100);
  });

  it('puts the badge ahead of every stamp', () => {
    // The badge is taken before the problem is met — that is the instruction the
    // game gives, and it would be a lie if a stamp came first.
    const sim = driveToScreen(1);
    const badgeGx = sim.screen.data.badge!.gx;
    expect(sim.screen.data.stamps!.every((s) => s.gx > badgeGx)).toBe(true);
  });

  it('each pair alternates: one is barely up before the next drops', () => {
    const sim = driveToScreen(1);
    const phases = sim.screen.data.stamps!.map((s) => s.phase);
    // Pair one and pair two are each authored half a cycle apart.
    expect(Math.abs(phases[1]! - phases[0]!)).toBeCloseTo(0.5, 5);
    expect(Math.abs(phases[3]! - phases[2]!)).toBeCloseTo(0.5, 5);
    // The stroke itself stays under half a cycle, so two stamps half a cycle apart
    // never press together — but stroke + wind-up is over half, so the moment one
    // finishes lifting the other is already winding up. That is the rapid fire.
    const busy = S.DROP_TIME + S.HOLD_TIME + S.LIFT_TIME;
    expect(busy).toBeLessThan(S.CYCLE / 2);
    expect(busy + S.WARN_TIME).toBeGreaterThan(S.CYCLE / 2);
  });

  it('a stamp landing on you costs months and a life', () => {
    const sim = driveToScreen(1);
    expireGrace(sim);
    const before = sim.months;
    const gx = sim.screen.data.stamps![0]!.gx;
    for (let i = 0; i < 400; i += 1) {
      if (sim.state !== 'PLAYING') break;
      standUnder(sim, gx);
      sim.step(DT, makeInput());
      if (sim.months > before) break;
    }
    expect(sim.months).toBe(before + JOURNEY.SETBACK_MONTHS);
    expect(sim.state).toBe('LIFE_LOST');
    expect(sim.lifeLost!.cause).toBe('stamp');
    expect(sim.lives).toBe(sim.livesTotal - 1);
  });

  it('the stamp stays pressed on the life-lost frames, so the flattening can be drawn', () => {
    const sim = driveToScreen(1);
    expireGrace(sim);
    const gx = sim.screen.data.stamps![0]!.gx;
    for (let i = 0; i < 400 && sim.state === 'PLAYING'; i += 1) {
      standUnder(sim, gx);
      sim.step(DT, makeInput());
    }
    expect(sim.state).toBe('LIFE_LOST');
    const hazard = sim.activeHazard as Stamps;
    expect(hazard.struckAt).toBeCloseTo(gx * T + T / 2, 5);
    // The guilty stamp is left at the bottom of its stroke (it catches you in the
    // last few frames of the drop, so this is not always a completed press).
    const guilty = hazard.stampStates().find((s) => Math.abs(s.cx - hazard.struckAt!) < 1)!;
    expect(guilty.press).toBeGreaterThan(0.8);
  });

  it('a lost life restarts this stage with the badge available again', () => {
    const sim = driveToScreen(1);
    expireGrace(sim);
    const gx = sim.screen.data.stamps![0]!.gx;
    for (let i = 0; i < 400 && sim.state === 'PLAYING'; i += 1) {
      standUnder(sim, gx);
      sim.step(DT, makeInput());
    }
    recoverFromLifeLost(sim);
    expect(sim.screenId).toBe(1);
    expect(sim.powerups.collected).toBe(false);
    expect(sim.badgeBox).not.toBeNull();
    stepN(sim, 30);
    expect(sim.player.box.y).toBeLessThan(RESOLUTION.HEIGHT);
  });

  it('without the badge, walking straight through gets you stamped', () => {
    // The unassisted screen is a reflex test: a player who just holds right into
    // the first pair is flattened. Deterministic — fixed phases, fixed timestep.
    const sim = driveToScreen(1);
    expireGrace(sim);
    walkRight(sim, 6);
    expect(sim.state).toBe('LIFE_LOST');
    expect(sim.lifeLost!.cause).toBe('stamp');
  });

  it('with 1Wrk engaged, walking straight through is untouched', () => {
    const sim = driveToScreen(1);
    engageBadge(sim);
    expireGrace(sim);
    expect(sim.powerups.isAssisted).toBe(true);
    const before = sim.months;
    walkRight(sim, 12);
    expect(sim.setbacks).toBe(0);
    expect(sim.months).toBeLessThanOrEqual(before + (sim.screen.data.monthsBase ?? 0));
  });

  it('1Wrk slows the whole mechanism right down', () => {
    const slow = driveToScreen(1);
    engageBadge(slow);
    const fast = driveToScreen(1);
    stepN(slow, 20);
    stepN(fast, 20);
    const travel = (sim: ReturnType<typeof driveToScreen>) =>
      (sim.activeHazard as Stamps).stampStates()[0]!.bottomY - S.REST_BOTTOM;
    expect(travel(slow)).toBeLessThan(travel(fast) * 0.5);
    expect((slow.activeHazard as Stamps).isSlowed).toBe(true);
  });

  it('a stamp cannot press an ANSR-backed player — it retracts from where it touched', () => {
    const sim = driveToScreen(1);
    engageBadge(sim);
    expireGrace(sim);
    const gx = sim.screen.data.stamps![0]!.gx;
    const hazard = sim.activeHazard as Stamps;
    let sawRetract = false;
    for (let i = 0; i < 900 && sim.state === 'PLAYING'; i += 1) {
      standUnder(sim, gx);
      sim.step(DT, makeInput());
      if (hazard.retractingCount > 0) sawRetract = true;
    }
    expect(sim.state).toBe('PLAYING');
    expect(sim.setbacks).toBe(0);
    expect(sawRetract).toBe(true);
    expect(hazard.struckAt).toBeNull();
  });

  it('shields the player while the help is engaged, and the help does not expire', () => {
    const sim = driveToScreen(1);
    expect(sim.shielded).toBe(false);
    engageBadge(sim);
    expect(sim.shielded).toBe(true);
    stepN(sim, 600); // 10 seconds
    expect(sim.shielded).toBe(true);
    expect(sim.activePower?.product).toBe('1Wrk');
  });

  it('no badge places geometry any more — the stage is walkable ground plus a wall', () => {
    const sim = driveToScreen(1);
    engageBadge(sim);
    const groundY = 15 * T;
    const ground = sim.screen.solids.filter((s) => s.y === groundY);
    expect(ground).toHaveLength(1);
    expect(ground[0]!.w).toBe(32 * T);
  });
});
