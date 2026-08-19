import { describe, it, expect } from 'vitest';
import { makeInput } from './Input';
import { JOURNEY, HAZARDS, PLAYER } from '../data/tuning.config';
import { Workplace } from '../world/Hazards/Workplace';
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

/**
 * The Workplace is screen **3** (owner call): it replaced Local Expertise outright
 * and took the slot straight after Compliance, because a workplace is the first
 * thing you walk into once the filings clear.
 *
 * Column 7 is the firing step: it sits between the partition (gx 6) and the start
 * of the figure's corridor (gx 9), so it is both safe for the whole screen and has
 * a clear line to him. The tests use it for exactly that reason.
 */
const FIRING_COLUMN = 7;

/** Hold the shoot button for one step (it is an edge signal, never held). */
function shoot(sim: ReturnType<typeof driveToScreen>): void {
  sim.step(DT, makeInput({ shootPressed: true }));
}

/** Fire `n` pulses, respecting the cutter's cooldown between them. */
function fire(sim: ReturnType<typeof driveToScreen>, n: number): void {
  const gap = Math.ceil(HAZARDS.WORKPLACE.SHOT_COOLDOWN / DT) + 1;
  for (let i = 0; i < n; i += 1) {
    standAtColumn(sim, FIRING_COLUMN);
    shoot(sim);
    for (let k = 0; k < gap; k += 1) {
      standAtColumn(sim, FIRING_COLUMN);
      sim.step(DT, makeInput());
    }
  }
}

function hazardOf(sim: ReturnType<typeof driveToScreen>): Workplace {
  return sim.activeHazard as Workplace;
}

describe('Screen 3 — Workplace (taped off → 500Leaders → the room put right)', () => {
  it('is the 500Leaders capability screen, with the figure beyond the badge', () => {
    const sim = driveToScreen(3);
    expect(sim.screen.name).toBe('Workplace');
    expect(sim.screen.data.hazard).toBe('workplace');
    expect(sim.screen.data.badge!.type).toBe('UNWRAP');
    expect(sim.activeHazard).toBeInstanceOf(Workplace);
    const badgeGx = sim.screen.data.badge!.gx;
    const mummies = sim.screen.data.mummies!;
    expect(mummies).toHaveLength(1);
    expect(mummies.every((m) => m.from > badgeGx)).toBe(true);
    expect(hazardOf(sim).layersLeft).toBe(HAZARDS.WORKPLACE.TAPE_LAYERS);
  });

  it('spawns the player behind the partition, clear of the corridor on frame one', () => {
    const sim = driveToScreen(3);
    const wall = sim.screen.data.solids.find((s) => s.role?.includes('partition'));
    expect(wall).toBeTruthy();
    const spawnRight = sim.screen.data.spawn.gx * T + PLAYER.WIDTH;
    const corridorLeft = sim.screen.data.mummies![0]!.from * T;
    // Partition between the two, and the figure never reaches back past it.
    expect(spawnRight).toBeLessThan(wall!.gx * T);
    expect(wall!.gx * T).toBeLessThan(corridorLeft);
    const box = hazardOf(sim).mummyStates()[0]!.box;
    expect(box.x).toBeGreaterThan(wall!.gx * T + wall!.w * T);
  });

  it('trudges one way only and loops back to the start — a metronome, not a chase', () => {
    const sim = driveToScreen(3);
    const hz = hazardOf(sim);
    standAtColumn(sim, FIRING_COLUMN);
    let last = hz.mummyStates()[0]!.box.x;
    let looped = false;
    let reversed = false;
    for (let i = 0; i < 600; i += 1) {
      standAtColumn(sim, FIRING_COLUMN); // stay out of his way for the whole sweep
      sim.step(DT, makeInput());
      const s = hz.mummyStates()[0]!;
      if (s.phase === 'returning') {
        looped = true;
      } else if (s.box.x < last - 0.001 && !looped) {
        reversed = true;
      }
      if (s.phase === 'wrapped') last = s.box.x;
    }
    expect(reversed).toBe(false); // he never turns around
    expect(looped).toBe(true); // he does loop
  });

  it('is harmless while looping back, so he can never materialise on top of you', () => {
    const sim = driveToScreen(3);
    const hz = hazardOf(sim);
    let sawReturning = false;
    for (let i = 0; i < 600; i += 1) {
      const s = hz.mummyStates()[0]!;
      if (s.phase === 'returning') {
        sawReturning = true;
        expect(s.lethal).toBe(false);
      }
      standAtColumn(sim, FIRING_COLUMN);
      sim.step(DT, makeInput());
    }
    expect(sawReturning).toBe(true);
  });

  it('walking into him while he is wrapped costs months and a life', () => {
    const sim = driveToScreen(3);
    expireGrace(sim);
    const added = forceSetbackAt(sim, 12, 900);
    expect(added).toBe(JOURNEY.SETBACK_MONTHS);
    expect(sim.state).toBe('LIFE_LOST');
    expect(sim.lifeLost!.cause).toBe('mummy');
    expect(sim.lives).toBe(sim.livesTotal - 1);
  });

  it('without the badge there is no cutter, so the shoot button does nothing', () => {
    const sim = driveToScreen(3);
    const hz = hazardOf(sim);
    expect(hz.hasCutter).toBe(false);
    fire(sim, 4);
    expect(hz.shotStates()).toHaveLength(0);
    expect(hz.layersLeft).toBe(HAZARDS.WORKPLACE.TAPE_LAYERS);
  });

  it('engaging 500Leaders arms the cutter, and one pulse strips one layer', () => {
    const sim = driveToScreen(3);
    engageBadge(sim);
    const hz = hazardOf(sim);
    expect(hz.hasCutter).toBe(true);
    fire(sim, 1);
    expect(hz.layersLeft).toBe(HAZARDS.WORKPLACE.TAPE_LAYERS - 1);
    fire(sim, 1);
    expect(hz.layersLeft).toBe(HAZARDS.WORKPLACE.TAPE_LAYERS - 2);
  });

  it('three hits free him — and he fixes the room instead of dying', () => {
    const sim = driveToScreen(3);
    engageBadge(sim);
    const hz = hazardOf(sim);
    fire(sim, HAZARDS.WORKPLACE.TAPE_LAYERS);
    expect(hz.layersLeft).toBe(0);
    expect(hz.mummyStates()[0]!.phase).not.toBe('wrapped');

    // Unravel → run to the terminal → work → the room comes good.
    for (let i = 0; i < 500 && hz.restore < 1; i += 1) {
      standAtColumn(sim, FIRING_COLUMN);
      sim.step(DT, makeInput());
    }
    const s = hz.mummyStates()[0]!;
    expect(s.phase).toBe('restored');
    expect(s.lethal).toBe(false);
    expect(hz.isFixed).toBe(true);
    expect(hz.restore).toBe(1);
    // He is at the terminal, not where he was blocking the floor.
    const terminalX = sim.screen.data.terminal!.gx * T;
    expect(Math.abs(s.box.x + s.box.w / 2 - terminalX)).toBeLessThan(2 * T);
  });

  it('a freed colleague is safe to touch, and the cutter refuses to fire at him', () => {
    const sim = driveToScreen(3);
    expireGrace(sim);
    engageBadge(sim);
    const hz = hazardOf(sim);
    fire(sim, HAZARDS.WORKPLACE.TAPE_LAYERS);
    stepN(sim, 400);

    const before = sim.months;
    const box = hz.mummyStates()[0]!.box;
    for (let i = 0; i < 200; i += 1) {
      sim.player.box.x = box.x;
      sim.player.box.y = box.y + box.h - sim.player.box.h;
      sim.step(DT, makeInput({ shootPressed: i % 15 === 0 }));
    }
    expect(sim.months).toBe(before);
    expect(sim.setbacks).toBe(0);
    expect(hz.shotStates()).toHaveLength(0);
  });

  it('help does not lapse: the room stays fixed for the rest of the screen', () => {
    const sim = driveToScreen(3);
    engageBadge(sim);
    const hz = hazardOf(sim);
    fire(sim, HAZARDS.WORKPLACE.TAPE_LAYERS);
    stepN(sim, 400);
    expect(hz.restore).toBe(1);
    stepN(sim, 900); // 15s — longer than any old timed shield
    expect(hz.restore).toBe(1);
    expect(hz.isFixed).toBe(true);
    expect(sim.activePower?.product).toBe('500Leaders');
  });
});
