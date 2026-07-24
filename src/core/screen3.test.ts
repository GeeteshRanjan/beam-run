import { describe, it, expect } from 'vitest';
import { Simulation } from './Simulation';
import { makeInput } from './Input';
import { LOOP, RESOLUTION, POWERUPS } from '../data/tuning.config';

const DT = LOOP.FIXED_DT;
const T = RESOLUTION.TILE;

function driveToScreen(target: number): Simulation {
  const sim = new Simulation();
  sim.step(DT, makeInput({ anyPressed: true }));
  let guard = 0;
  while (!(sim.screenId === target && sim.state === 'PLAYING')) {
    if (++guard > 4000) break;
    if (sim.state === 'TITLE_CARD') sim.step(DT, makeInput());
    else if (sim.state === 'PLAYING' && sim.screenId < target) {
      sim.player.box.x = sim.screen.exitX!;
      sim.step(DT, makeInput());
    } else sim.step(DT, makeInput());
  }
  return sim;
}

function expireInvuln(sim: Simulation): void {
  for (let i = 0; i < 60 && sim.player.isInvulnerable; i += 1) sim.step(DT, makeInput());
}

/** Place Beam directly on top of the first plant's base column. */
function standOnFirstPlant(sim: Simulation): void {
  const plant = sim.screen.data.plants![0]!;
  sim.player.box.x = plant.gx * T + T / 2 - sim.player.box.w / 2;
  sim.player.box.y = 14 * T;
}

describe('Screen 3 — Compliance Maze (plants + Pass-through)', () => {
  it('grants a 4s Pass-through on badge pickup', () => {
    const sim = driveToScreen(3);
    expect(sim.screen.data.badge!.type).toBe('PASS_THROUGH');
    expireInvuln(sim);
    const b = sim.screen.data.badge!;
    sim.player.box.x = b.gx * T + 2;
    sim.player.box.y = b.gy * T + 2;
    sim.step(DT, makeInput());
    expect(sim.powerups.isPassThrough).toBe(true);
    expect(sim.activePower?.duration).toBe(POWERUPS.PASS_THROUGH.duration);
  });

  it('walks through plants unharmed while active, then plants are lethal again', () => {
    const sim = driveToScreen(3);
    expireInvuln(sim);
    const b = sim.screen.data.badge!;
    sim.player.box.x = b.gx * T + 2;
    sim.player.box.y = b.gy * T + 2;
    sim.step(DT, makeInput());
    expect(sim.powerups.isPassThrough).toBe(true);

    // Sit inside a plant while Pass-through is active → survive.
    let diedWhileActive = false;
    for (let i = 0; i < 120; i += 1) {
      standOnFirstPlant(sim);
      sim.step(DT, makeInput());
      if (sim.state === 'DEATH') diedWhileActive = true;
    }
    expect(diedWhileActive).toBe(false);

    // After Pass-through lapses, the plant becomes lethal.
    let diedAfter = false;
    for (let i = 0; i < 240; i += 1) {
      if (sim.state === 'PLAYING') standOnFirstPlant(sim);
      sim.step(DT, makeInput());
      if (sim.state === 'DEATH') {
        diedAfter = true;
        break;
      }
    }
    expect(diedAfter).toBe(true);
  });

  it('touching a plant without the badge is lethal', () => {
    const sim = driveToScreen(3);
    expireInvuln(sim);
    let died = false;
    for (let i = 0; i < 200; i += 1) {
      if (sim.state === 'PLAYING') standOnFirstPlant(sim);
      sim.step(DT, makeInput());
      if (sim.state === 'DEATH') {
        died = true;
        break;
      }
    }
    expect(died).toBe(true);
  });
});
