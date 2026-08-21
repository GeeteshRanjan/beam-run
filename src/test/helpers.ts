/**
 * Shared headless test helpers. Imported only by `*.test.ts`, never by engine
 * code, so it stays out of the shipped bundle.
 */
import { Simulation, type SimulationOptions } from '../core/Simulation';
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
 * The input a headless driver has to feed to get *through* a screen boundary.
 *
 * The briefing card between two screens does not time out (owner call): it waits
 * for a press. So anything that walks the run has to press on those frames, or it
 * sits on the card until its guard runs out — which is exactly what every helper
 * and probe in this repo did the moment the timeout was removed. `anyPressed` is
 * ignored while PLAYING, so this is safe to feed on every frame of a drive.
 */
export function driveInput(sim: Simulation): ReturnType<typeof makeInput> {
  return makeInput({ anyPressed: sim.state === 'TITLE_CARD' });
}

/** Step until the sim is PLAYING, dismissing any briefing card on the way. */
export function stepToPlaying(sim: Simulation, maxSteps = 200): void {
  for (let i = 0; i < maxSteps && sim.state !== 'PLAYING'; i += 1) {
    sim.step(DT, driveInput(sim));
  }
}

/**
 * Drive a fresh sim until it is PLAYING on `target`, teleporting to each exit.
 * Exits sit clear of every hazard, so this never accrues setbacks.
 */
export function driveToScreen(target: number, opts: SimulationOptions = {}): Simulation {
  const sim = new Simulation(opts);
  sim.step(DT, makeInput({ anyPressed: true }));
  let guard = 0;
  while (!(sim.screenId === target && sim.state === 'PLAYING')) {
    if (++guard > 4000) break;
    if (sim.state === 'PLAYING' && sim.screenId < target) {
      sim.player.box.x = sim.screen.exitX!;
    }
    sim.step(DT, driveInput(sim));
  }
  return sim;
}

/** Burn off spawn/setback grace so a hazard can register. */
export function expireGrace(sim: Simulation): void {
  for (let i = 0; i < 200 && sim.player.isInvulnerable; i += 1) sim.step(DT, makeInput());
}

/**
 * Walk onto the current screen's badge so its ANSR capability engages.
 *
 * The badge moves, so its box has to be read from the sim rather than computed from
 * the anchor cell — that is the same trap the renderer has. And on the one screen
 * whose badge is **air-dropped** there is no box at all until the drone has let go and
 * the mark has landed, so this waits for the delivery first. Every hazard test on that
 * screen goes through here, which is why the waiting belongs in the helper rather
 * than in each of them.
 */
export function engageBadge(sim: Simulation): void {
  for (let i = 0; i < 3000 && !sim.badgeBox; i += 1) sim.step(DT, makeInput());
  const box = sim.badgeBox;
  if (!box) return;
  sim.player.box.x = box.x + (box.w - sim.player.box.w) / 2;
  sim.player.box.y = box.y + (box.h - sim.player.box.h) / 2;
  sim.step(DT, makeInput());
}

/**
 * Acknowledge the life-lost screen and get back to PLAYING.
 *
 * Almost every hazard test needs this now: a delay leaves the sim in LIFE_LOST,
 * and the stage restarts from its title card. No-op in any other state.
 */
export function recoverFromLifeLost(sim: Simulation): void {
  sim.continueAfterLifeLost(); // no-op in any other state
  stepToPlaying(sim);
}

/** Park the player standing on the ground at a grid column. */
export function standAtColumn(sim: Simulation, gx: number, offset = 4): void {
  sim.player.box.x = gx * T + offset;
  sim.player.box.y = GROUND_FEET_Y - sim.player.box.h;
}

/**
 * Hold the player at `gx` until a setback is booked (or `maxSteps` elapses).
 * Returns how many months the clock moved. Leaves the sim on the life-lost
 * screen — call `recoverFromLifeLost` to carry on playing.
 */
export function forceSetbackAt(sim: Simulation, gx: number, maxSteps = 600): number {
  const before = sim.months;
  for (let i = 0; i < maxSteps; i += 1) {
    if (sim.state !== 'PLAYING') break;
    standAtColumn(sim, gx);
    sim.step(DT, makeInput());
    if (sim.months > before) break;
  }
  return sim.months - before;
}
