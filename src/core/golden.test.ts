import { describe, it, expect } from 'vitest';
import { Simulation } from './Simulation';
import { makeInput } from './Input';
import { JOURNEY } from '../data/tuning.config';
import { SCREEN_COUNT, TOTAL_QUICK_WINS } from '../data/levels';
import { CAPABILITIES } from '../data/copy';
import { DT } from '../test/helpers';

/**
 * Golden full playthrough: start → traverse all six screens → WIN.
 *
 * Runs with the "no setbacks" assist so the run is a pure completability proof —
 * this mirrors the level validator's hazard-ignoring traversal. We advance each
 * PLAYING screen by moving Beam to its exit (or the finale win trigger), first
 * engaging the ANSR badge and optionally sweeping up every quick win.
 */
function playToWin(opts: { collect?: boolean; engage?: boolean } = {}): Simulation {
  const sim = new Simulation({ assist: { noSetbacks: true } });
  sim.step(DT, makeInput({ anyPressed: true })); // START → run begins (TITLE_CARD)

  let guard = 0;
  while (sim.state !== 'WIN' && guard++ < 8000) {
    if (sim.state === 'PLAYING') {
      if (opts.engage) {
        const b = sim.screen.data.badge;
        if (b && !sim.powerups.collected) {
          sim.player.box.x = b.gx * 40 + 2;
          sim.player.box.y = b.gy * 40 + 2;
          sim.step(DT, makeInput());
        }
      }
      if (opts.collect) {
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
  it('reaches WIN across all six screens and lands on the benchmark', () => {
    const sim = playToWin();
    expect(sim.state).toBe('WIN');
    expect(sim.screenId).toBe(SCREEN_COUNT - 1);
    expect(sim.screenId).toBe(5);
    expect(sim.setbacks).toBe(0);
    expect(sim.months).toBe(JOURNEY.ANSR_BENCHMARK_MONTHS);
  });

  it('engages all four ANSR capabilities and reports them on the receipt', () => {
    const sim = playToWin({ engage: true });
    const r = sim.receipt;
    expect(r.engaged).toHaveLength(4);
    // Every capability in the copy deck is earned exactly once, in journey order.
    expect(r.engaged).toEqual(CAPABILITIES.map((c) => c.badge));
    expect(r.matchedBenchmark).toBe(true);
    expect(r.benchmarkMonths).toBe(JOURNEY.ANSR_BENCHMARK_MONTHS);
    expect(r.baselineMonths).toBe(JOURNEY.BASELINE_MONTHS);
  });

  it('collects every quick win across the run without touching the clock', () => {
    const sim = playToWin({ collect: true });
    expect(sim.state).toBe('WIN');
    expect(sim.quickWins).toBe(TOTAL_QUICK_WINS);
    expect(sim.receipt.quickWins).toBe(TOTAL_QUICK_WINS);
    expect(sim.months).toBe(JOURNEY.ANSR_BENCHMARK_MONTHS);
  });
});
