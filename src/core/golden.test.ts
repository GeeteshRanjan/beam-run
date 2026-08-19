import { describe, it, expect } from 'vitest';
import { Simulation } from './Simulation';
import { makeInput } from './Input';
import { JOURNEY } from '../data/tuning.config';
import { SCREEN_COUNT } from '../data/levels';
import { CAPABILITIES } from '../data/copy';
import { DT } from '../test/helpers';

/**
 * Golden full playthrough: start → traverse all six screens → WIN.
 *
 * Runs with the "no setbacks" assist so the run is a pure completability proof —
 * this mirrors the level validator's hazard-ignoring traversal. We advance each
 * PLAYING screen by moving Beam to its exit (or the finale win trigger),
 * optionally taking the ANSR badge on the way.
 */
function playToWin(opts: { engage?: boolean } = {}): Simulation {
  const sim = new Simulation({ assist: { noSetbacks: true } });
  sim.step(DT, makeInput({ anyPressed: true })); // START → run begins (TITLE_CARD)

  let guard = 0;
  while (sim.state !== 'WIN' && guard++ < 8000) {
    if (sim.state === 'PLAYING') {
      // Reception carries no badge at all now (owner call), so "take the badge"
      // has to ask the screen whether there is one before it waits for it —
      // otherwise the run stalls on the tutorial screen waiting for a delivery
      // that is never coming.
      if (opts.engage && sim.screen.data.badge && !sim.powerups.collected) {
        // Read the badge box from the sim: it floats, so its anchor cell is only
        // where it started.
        const box = sim.badgeBox;
        if (!box) {
          /*
           * Nothing to take *yet*. On five screens the badge is always there, so this
           * never happens; on Hire Under Fire it is **delivered**, and there is no box
           * at all until the drone has released it and the parcel has landed on its
           * brick (~1.7s in). Walking to the exit meanwhile cleared the screen before
           * the badge existed, and the receipt came back with three capabilities
           * instead of four — which is exactly the kind of silent gap this run is for.
           */
          sim.step(DT, makeInput());
          continue;
        }
        sim.player.box.x = box.x;
        sim.player.box.y = box.y;
        sim.step(DT, makeInput());
      }
      const target = sim.screen.winTriggerX ?? sim.screen.exitX;
      if (target !== undefined) sim.player.box.x = target;
    }
    sim.step(DT, makeInput());
  }
  return sim;
}

describe('Golden playthrough', () => {
  it('reaches WIN across all six screens and lands on the benchmark', () => {
    const sim = playToWin();
    expect(sim.state).toBe('WIN');
    expect(sim.screenId).toBe(SCREEN_COUNT - 1);
    expect(sim.screenId).toBe(5);
    expect(sim.setbacks).toBe(0);
    expect(sim.months).toBe(JOURNEY.ANSR_BENCHMARK_MONTHS);
  });

  it('engages every badge and reports the four capabilities on the receipt', () => {
    const sim = playToWin({ engage: true });
    const r = sim.receipt;
    // Five badges are taken — Reception has none — and the Tech Park's
    // SAFE_PASSAGE carries no capability, so the receipt lists the four real ones
    // in journey order, which is the order they are collected in.
    expect(r.engaged).toEqual([...CAPABILITIES.map((c) => c.badge), 'SAFE_PASSAGE']);
    expect(r.engaged.filter((b) => b !== 'SAFE_PASSAGE')).toHaveLength(4);
    expect(r.matchedBenchmark).toBe(true);
    expect(r.benchmarkMonths).toBe(JOURNEY.ANSR_BENCHMARK_MONTHS);
    expect(r.baselineMonths).toBe(JOURNEY.BASELINE_MONTHS);
  });

  it('never spends a life on a clean run, so the delay log stays empty', () => {
    const sim = playToWin({ engage: true });
    expect(sim.state).toBe('WIN');
    expect(sim.lives).toBe(sim.livesTotal);
    expect(sim.log).toHaveLength(0);
    expect(sim.delayMonths).toBe(0);
    expect(sim.months).toBe(JOURNEY.ANSR_BENCHMARK_MONTHS);
  });
});
