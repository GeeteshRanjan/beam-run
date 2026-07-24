import { describe, it, expect } from 'vitest';
import { Simulation } from './Simulation';
import { makeInput } from './Input';
import { LOOP, RESOLUTION, POWERUPS } from '../data/tuning.config';
import { Spikes } from '../world/Hazards/Spikes';

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

/** Park Beam standing on the ground inside a spike column (col in grid x). */
function standInColumn(sim: Simulation, gx: number): void {
  sim.player.box.x = gx * T + 4;
  sim.player.box.y = 15 * T - sim.player.box.h; // feet on ground row → overlaps rest band
}

/** Collect the FREEZE badge for the current screen. */
function collectFreeze(sim: Simulation): void {
  const b = sim.screen.data.badge!;
  sim.player.box.x = b.gx * T + 2;
  sim.player.box.y = b.gy * T + 2;
  sim.step(DT, makeInput());
}

describe('Screen 4 — Lack of Local Expertise (spikes + Freeze)', () => {
  it('grants a 4s global Freeze on badge pickup', () => {
    const sim = driveToScreen(4);
    expect(sim.screen.data.badge!.type).toBe('FREEZE');
    expect(sim.screen.data.hazard).toBe('spikes');
    expireInvuln(sim);
    collectFreeze(sim);
    expect(sim.powerups.isFreeze).toBe(true);
    expect(sim.activePower?.duration).toBe(POWERUPS.FREEZE.duration);
  });

  it('sitting in a spike column without Freeze is lethal (fall/rest)', () => {
    const sim = driveToScreen(4);
    expireInvuln(sim);
    let died = false;
    for (let i = 0; i < 400; i += 1) {
      if (sim.state === 'PLAYING') standInColumn(sim, 7);
      sim.step(DT, makeInput());
      if (sim.state === 'DEATH') {
        died = true;
        break;
      }
    }
    expect(died).toBe(true);
  });

  it('Freeze pauses ALL spikes: no kill in-column and hazard motion stops', () => {
    const sim = driveToScreen(4);
    expireInvuln(sim);
    collectFreeze(sim);
    expect(sim.powerups.isFreeze).toBe(true);

    const hazard = sim.activeHazard as Spikes;
    // Advance a little so at least one column is mid-cycle, then check freeze holds.
    const before = hazard.spikeStates().map((s) => ({ state: s.state, y: s.y }));

    let diedWhileFrozen = false;
    for (let i = 0; i < 120; i += 1) {
      // Stand in a column that would otherwise be lethal.
      standInColumn(sim, 7);
      sim.step(DT, makeInput());
      if (sim.state === 'DEATH') diedWhileFrozen = true;
      if (!sim.powerups.isFreeze) break; // only assert within the freeze window
    }
    expect(diedWhileFrozen).toBe(false);

    // While frozen, spikes did not advance (positions/states unchanged).
    const after = hazard.spikeStates().map((s) => ({ state: s.state, y: s.y }));
    expect(after).toEqual(before);
  });

  it('exposes the spikes hazard as the active hazard on screen 4', () => {
    const sim = driveToScreen(4);
    expect(sim.activeHazard).toBeInstanceOf(Spikes);
  });
});
