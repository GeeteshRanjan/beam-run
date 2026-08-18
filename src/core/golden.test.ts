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
      if (opts.engage) {
        // Read the badge box from the sim: it floats, so its anchor cell is only
        // where it started.
        const box = sim.badgeBox;
        if (box) {
          sim.player.box.x = box.x;
          sim.player.box.y = box.y;
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
    // Six badges are taken; the two SAFE_PASSAGE ones carry no capability, so the
    // receipt lists the four real ones in journey order.
    expect(r.engaged).toEqual(['SAFE_PASSAGE', ...CAPABILITIES.map((c) => c.badge)]);
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
