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

function collectFireShield(sim: Simulation): void {
  const b = sim.screen.data.badge!;
  sim.player.box.x = b.gx * T + 2;
  sim.player.box.y = b.gy * T + 2;
  sim.step(DT, makeInput());
}

describe('Screen 2 — Hire Under Fire (fire + Fire Shield)', () => {
  it('grants a 5s Fire Shield on badge pickup', () => {
    const sim = driveToScreen(2);
    expect(sim.screen.data.badge!.type).toBe('FIRE_SHIELD');
    expireInvuln(sim);
    collectFireShield(sim);
    expect(sim.powerups.isShield).toBe(true);
    expect(sim.activePower?.duration).toBe(POWERUPS.FIRE_SHIELD.duration);
  });

  it('the shield grants immunity while active, then fire is lethal again', () => {
    const sim = driveToScreen(2);
    expireInvuln(sim);
    collectFireShield(sim);

    // Stand inside the first fire lane (gx 8) on the ground.
    const laneX = 8 * T;
    sim.player.box.x = laneX + 5;
    sim.player.box.y = 15 * T - sim.player.box.h;

    // While the shield is active (~5s), Beam survives fire.
    let diedWhileShielded = false;
    for (let i = 0; i < 150; i += 1) {
      sim.player.box.x = laneX + 5; // hold position in the lane
      sim.step(DT, makeInput());
      if (sim.state === 'DEATH') diedWhileShielded = true;
    }
    expect(diedWhileShielded).toBe(false);
    expect(sim.powerups.isShield).toBe(true); // still within 5s

    // Keep standing until the shield lapses → fire becomes lethal.
    let diedAfter = false;
    for (let i = 0; i < 400; i += 1) {
      if (sim.state === 'PLAYING') {
        sim.player.box.x = laneX + 5;
        sim.player.box.y = 15 * T - sim.player.box.h;
      }
      sim.step(DT, makeInput());
      if (sim.state === 'DEATH') {
        diedAfter = true;
        break;
      }
    }
    expect(diedAfter).toBe(true);
  });

  it('walking into an active lane without the shield is lethal', () => {
    const sim = driveToScreen(2);
    expireInvuln(sim);
    const laneX = 8 * T;
    let died = false;
    for (let i = 0; i < 200; i += 1) {
      if (sim.state === 'PLAYING') {
        sim.player.box.x = laneX + 5;
        sim.player.box.y = 15 * T - sim.player.box.h;
      }
      sim.step(DT, makeInput());
      if (sim.state === 'DEATH') {
        died = true;
        break;
      }
    }
    expect(died).toBe(true);
  });
});
