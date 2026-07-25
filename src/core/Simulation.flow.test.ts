import { describe, it, expect } from 'vitest';
import { Simulation } from './Simulation';
import { makeInput } from './Input';
import { JOURNEY, RESOLUTION } from '../data/tuning.config';
import { TOTAL_MONTHS_BASE } from '../data/levels';
import { DT, stepN } from '../test/helpers';

function toPlaying(sim: Simulation): void {
  sim.step(DT, makeInput({ anyPressed: true }));
  for (let i = 0; i < 120 && sim.state !== 'PLAYING'; i += 1) sim.step(DT, makeInput());
}

/** Advance through every screen by teleporting Beam to each exit / win trigger. */
function driveToEnd(sim: Simulation): void {
  sim.step(DT, makeInput({ anyPressed: true }));
  for (let guard = 0; guard < 4000 && sim.state !== 'WIN'; guard += 1) {
    if (sim.state === 'PLAYING') {
      const s = sim.screen;
      if (s.winTriggerX !== undefined) sim.player.box.x = s.winTriggerX;
      else if (s.exitX !== undefined) sim.player.box.x = s.exitX;
    }
    sim.step(DT, makeInput());
  }
}

describe('full state-machine flow', () => {
  it('runs Reception → … → Tech Park and reaches WIN on screen 5', () => {
    const sim = new Simulation();
    driveToEnd(sim);
    expect(sim.state).toBe('WIN');
    expect(sim.screenId).toBe(5);
  });

  it('can restart from WIN back to START', () => {
    const sim = new Simulation();
    driveToEnd(sim);
    sim.requestRestart();
    expect(sim.state).toBe('START');
  });
});

describe('the run cannot fail', () => {
  it('a clean run lands exactly on the ANSR benchmark', () => {
    const sim = new Simulation();
    driveToEnd(sim);
    expect(sim.setbacks).toBe(0);
    expect(sim.months).toBe(JOURNEY.ANSR_BENCHMARK_MONTHS);
    expect(sim.months).toBe(TOTAL_MONTHS_BASE);
    expect(sim.receipt.matchedBenchmark).toBe(true);
  });

  it('no number of setbacks can end the run — there is no game over', () => {
    const sim = new Simulation();
    toPlaying(sim);
    for (let i = 0; i < 12; i += 1) {
      stepN(sim, 80); // outlast the grace window
      sim.player.box.y = RESOLUTION.HEIGHT + 200;
      sim.step(DT, makeInput());
      expect(sim.state).toBe('PLAYING');
    }
    expect(sim.setbacks).toBe(12);
    // The run is still finishable, and still reaches the CTA.
    driveToEnd(sim);
    expect(sim.state).toBe('WIN');
    expect(sim.receipt.matchedBenchmark).toBe(false);
    expect(sim.months).toBeGreaterThan(JOURNEY.ANSR_BENCHMARK_MONTHS);
    expect(sim.months).toBeLessThan(JOURNEY.BASELINE_MONTHS);
  });

  it('a full reset clears the clock and the receipt', () => {
    const sim = new Simulation();
    driveToEnd(sim);
    sim.reset();
    expect(sim.state).toBe('START');
    expect(sim.months).toBe(0);
    expect(sim.screenId).toBe(0);
    expect(sim.engaged).toHaveLength(0);
  });
});

describe('quick-win persistence rule', () => {
  it('keeps collected quick wins across a setback (they do not reappear)', () => {
    const sim = new Simulation();
    toPlaying(sim);
    stepN(sim, 60);

    const pt = sim.screen.points[0]!;
    sim.player.box.x = pt.x - sim.player.box.w / 2;
    sim.player.box.y = pt.y - sim.player.box.h / 2;
    sim.step(DT, makeInput());
    expect(sim.quickWins).toBe(1);
    const collectedId = pt.id;

    sim.player.box.y = RESOLUTION.HEIGHT + 200;
    sim.step(DT, makeInput());
    stepN(sim, 30);

    expect(sim.quickWins).toBe(1);
    expect(sim.screen.points.find((p) => p.id === collectedId)!.collected).toBe(true);
  });

  it('banks quick wins from a completed screen', () => {
    const sim = new Simulation();
    toPlaying(sim);
    const pt = sim.screen.points[0]!;
    sim.player.box.x = pt.x - sim.player.box.w / 2;
    sim.player.box.y = pt.y - sim.player.box.h / 2;
    sim.step(DT, makeInput());
    expect(sim.quickWins).toBe(1);

    sim.player.box.x = sim.screen.exitX!;
    sim.step(DT, makeInput());
    expect(sim.screenId).toBe(1);
    expect(sim.quickWins).toBe(1);
  });
});
