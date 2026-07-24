import { describe, it, expect } from 'vitest';
import { Simulation } from './Simulation';
import { makeInput } from './Input';
import { LOOP, RUN } from '../data/tuning.config';
import { SCREEN_COUNT } from '../data/levels';

const DT = LOOP.FIXED_DT;

/**
 * Golden full playthrough: start → traverse all six screens → WIN.
 *
 * Runs with the "invincible practice" assist so the run is a pure completability
 * proof (hazards cannot end it) — this mirrors the level validator's invincible
 * traversal. We advance each PLAYING screen by moving Beam to its exit (or the
 * finale win trigger) and optionally sweeping up every Growth Point first.
 */
function playToWin(collectPoints: boolean): Simulation {
  const sim = new Simulation({ assist: { invincible: true } });
  sim.step(DT, makeInput({ anyPressed: true })); // START → run begins (TITLE_CARD)

  let guard = 0;
  while (sim.state !== 'WIN' && guard++ < 8000) {
    if (sim.state === 'PLAYING') {
      if (collectPoints) {
        for (const pt of sim.screen.points) {
          if (pt.collected) continue;
          sim.player.box.x = pt.x - sim.player.box.w / 2;
          sim.player.box.y = pt.y - sim.player.box.h / 2;
          sim.step(DT, makeInput());
        }
      }
      const target = sim.screen.winTriggerX ?? sim.screen.exitX;
      if (target !== undefined) sim.player.box.x = target;
    }
    sim.step(DT, makeInput());
  }
  return sim;
}

describe('Golden playthrough', () => {
  it('reaches WIN after traversing all six screens with lives intact', () => {
    const sim = playToWin(false);
    expect(sim.state).toBe('WIN');
    expect(sim.screenId).toBe(SCREEN_COUNT - 1);
    expect(sim.screenId).toBe(5);
    expect(sim.lives).toBe(RUN.STARTING_LIVES);
  });

  it('banks every Growth Point across the run into the final valuation', () => {
    const sim = playToWin(true);
    expect(sim.state).toBe('WIN');
    // 3 + 4 + 5 + 4 + 4 + 3 = 23 pickups, banked and persisted across screens.
    const totalPickups = 23;
    expect(sim.points).toBe(totalPickups * RUN.POINTS_PER_PICKUP);
  });
});
