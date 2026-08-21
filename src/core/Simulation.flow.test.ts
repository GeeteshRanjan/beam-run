import { describe, it, expect } from 'vitest';
import { Simulation } from './Simulation';
import { makeInput } from './Input';
import { JOURNEY, RESOLUTION, LIVES } from '../data/tuning.config';
import { TOTAL_MONTHS_BASE } from '../data/levels';
import { DT, stepN, recoverFromLifeLost, stepToPlaying, driveInput } from '../test/helpers';

function toPlaying(sim: Simulation): void {
  sim.step(DT, makeInput({ anyPressed: true }));
  stepToPlaying(sim);
}

/**
 * Advance through every screen by teleporting Beam to each exit / win trigger.
 *
 * `driveInput` presses on every briefing card: six screens now means six cards
 * that wait for the player, and a driver feeding neutral frames stops on the first.
 */
function driveToEnd(sim: Simulation): void {
  sim.step(DT, makeInput({ anyPressed: true }));
  for (let guard = 0; guard < 4000 && sim.state !== 'WIN'; guard += 1) {
    if (sim.state === 'PLAYING') {
      const s = sim.screen;
      if (s.winTriggerX !== undefined) sim.player.box.x = s.winTriggerX;
      else if (s.exitX !== undefined) sim.player.box.x = s.exitX;
    }
    sim.step(DT, driveInput(sim));
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

describe('the attempt can end, but the message never does', () => {
  it('a clean run lands exactly on the ANSR benchmark', () => {
    const sim = new Simulation();
    driveToEnd(sim);
    expect(sim.setbacks).toBe(0);
    expect(sim.months).toBe(JOURNEY.ANSR_BENCHMARK_MONTHS);
    expect(sim.months).toBe(TOTAL_MONTHS_BASE);
    expect(sim.receipt.matchedBenchmark).toBe(true);
    expect(sim.receipt.ledger).toHaveLength(0);
    expect(sim.receipt.livesLeft).toBe(LIVES.TOTAL);
  });

  it('delays inside the life budget still finish the run and reach the CTA', () => {
    const sim = new Simulation();
    toPlaying(sim);
    // Spend every life but the last, recovering each time.
    for (let i = 0; i < LIVES.TOTAL - 1; i += 1) {
      stepN(sim, 80); // outlast the grace window
      sim.player.box.y = RESOLUTION.HEIGHT + 200;
      sim.step(DT, makeInput());
      expect(sim.state).toBe('LIFE_LOST');
      recoverFromLifeLost(sim);
    }
    expect(sim.setbacks).toBe(LIVES.TOTAL - 1);
    expect(sim.lives).toBe(1);

    driveToEnd(sim);
    expect(sim.state).toBe('WIN');
    expect(sim.receipt.matchedBenchmark).toBe(false);
    expect(sim.receipt.delayMonths).toBe((LIVES.TOTAL - 1) * JOURNEY.SETBACK_MONTHS);
    expect(sim.months).toBeGreaterThan(JOURNEY.ANSR_BENCHMARK_MONTHS);
    expect(sim.months).toBeLessThan(JOURNEY.BASELINE_MONTHS);
  });

  it('running out of lives is not a dead end — it hands back to the title screen', () => {
    const sim = new Simulation();
    toPlaying(sim);
    for (let i = 0; i < LIVES.TOTAL; i += 1) {
      stepN(sim, 80);
      sim.player.box.y = RESOLUTION.HEIGHT + 200;
      sim.step(DT, makeInput());
      if (sim.lives > 0) recoverFromLifeLost(sim);
    }
    expect(sim.state).toBe('LIFE_LOST');
    expect(sim.lifeLost!.outOfLives).toBe(true);

    sim.continueAfterLifeLost();
    expect(sim.state).toBe('START');
    // ...and the next attempt is fully playable.
    driveToEnd(sim);
    expect(sim.state).toBe('WIN');
    expect(sim.months).toBe(JOURNEY.ANSR_BENCHMARK_MONTHS);
  });

  it('a full reset clears the clock, the lives and the log', () => {
    const sim = new Simulation();
    driveToEnd(sim);
    sim.reset();
    expect(sim.state).toBe('START');
    expect(sim.months).toBe(0);
    expect(sim.screenId).toBe(0);
    expect(sim.engaged).toHaveLength(0);
    expect(sim.lives).toBe(LIVES.TOTAL);
    expect(sim.log).toHaveLength(0);
  });
});
