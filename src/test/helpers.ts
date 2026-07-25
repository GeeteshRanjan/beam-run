/**
 * Shared headless test helpers. Imported only by `*.test.ts`, never by engine
 * code, so it stays out of the shipped bundle.
 */
import { Simulation } from '../core/Simulation';
import { makeInput } from '../core/Input';
import { LOOP, RESOLUTION } from '../data/tuning.config';

export const DT = LOOP.FIXED_DT;
export const T = RESOLUTION.TILE;
/** Y for a player standing with their feet on the ground band (row 15). */
export const GROUND_FEET_Y = 15 * T;

/** Step the sim `n` times with neutral input. */
export function stepN(sim: Simulation, n: number): void {
  for (let i = 0; i < n; i += 1) sim.step(DT, makeInput());
}

/**
 * Drive a fresh sim until it is PLAYING on `target`, teleporting to each exit.
 * Exits sit clear of every hazard, so this never accrues setbacks.
 */
export function driveToScreen(target: number): Simulation {
  const sim = new Simulation();
  sim.step(DT, makeInput({ anyPressed: true }));
  let guard = 0;
  while (!(sim.screenId === target && sim.state === 'PLAYING')) {
    if (++guard > 4000) break;
    if (sim.state === 'PLAYING' && sim.screenId < target) {
      sim.player.box.x = sim.screen.exitX!;
    }
    sim.step(DT, makeInput());
  }
  return sim;
}

/** Burn off spawn/setback grace so a hazard can register. */
export function expireGrace(sim: Simulation): void {
  for (let i = 0; i < 200 && sim.player.isInvulnerable; i += 1) sim.step(DT, makeInput());
}

/** Walk onto the current screen's badge so its ANSR capability engages. */
export function engageBadge(sim: Simulation): void {
  const b = sim.screen.data.badge!;
  sim.player.box.x = b.gx * T + 2;
  sim.player.box.y = b.gy * T + 2;
  sim.step(DT, makeInput());
}

/** Park the player standing on the ground at a grid column. */
export function standAtColumn(sim: Simulation, gx: number, offset = 4): void {
  sim.player.box.x = gx * T + offset;
  sim.player.box.y = GROUND_FEET_Y - sim.player.box.h;
}

/**
 * Hold the player at `gx` until a setback is booked (or `maxSteps` elapses).
 * Returns how many months the clock moved.
 */
export function forceSetbackAt(sim: Simulation, gx: number, maxSteps = 600): number {
  const before = sim.months;
  for (let i = 0; i < maxSteps; i += 1) {
    if (!sim.inSetback) standAtColumn(sim, gx);
    sim.step(DT, makeInput());
    if (sim.months > before) break;
  }
  return sim.months - before;
}
