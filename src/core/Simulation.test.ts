import { describe, it, expect } from 'vitest';
import { Simulation } from './Simulation';
import { Game } from './Game';
import { makeInput } from './Input';
import { JOURNEY, RESOLUTION } from '../data/tuning.config';
import { TOTAL_QUICK_WINS } from '../data/levels';
import { DT, stepN } from '../test/helpers';

/** Drive a fresh sim to PLAYING on Reception. */
function toPlaying(): Simulation {
  const sim = new Simulation();
  sim.step(DT, makeInput({ anyPressed: true })); // START → begin run → TITLE_CARD
  for (let i = 0; i < 120 && sim.state !== 'PLAYING'; i += 1) {
    sim.step(DT, makeInput());
  }
  return sim;
}

describe('Simulation lifecycle', () => {
  it('boots to START and begins a run on any input, with a clean clock', () => {
    const sim = new Simulation();
    expect(sim.state).toBe('START');
    sim.step(DT, makeInput({ anyPressed: true }));
    expect(sim.state).toBe('TITLE_CARD');
    expect(sim.screenId).toBe(0);
    expect(sim.months).toBe(0);
    expect(sim.setbacks).toBe(0);
    expect(sim.quickWins).toBe(0);
  });

  it('auto-advances from the title card to PLAYING', () => {
    expect(toPlaying().state).toBe('PLAYING');
  });
});

describe('Simulation movement & collision', () => {
  it('walls are solid — holding right stalls Beam at the first Reception step', () => {
    const sim = toPlaying();
    for (let i = 0; i < 150; i += 1) sim.step(DT, makeInput({ right: true }));
    const p = sim.player;
    expect(p.onGround).toBe(true);
    // First step is at gx9 (x=360); Beam (w=28) stops just left of it.
    expect(p.box.x + p.box.w).toBeLessThanOrEqual(361);
    expect(p.box.x).toBeGreaterThan(300);
  });

  it('a full jump clears the 1-tile step', () => {
    const sim = toPlaying();
    for (let i = 0; i < 150; i += 1) sim.step(DT, makeInput({ right: true }));
    sim.step(DT, makeInput({ right: true, jumpPressed: true, jumpHeld: true }));
    for (let i = 0; i < 45; i += 1) sim.step(DT, makeInput({ right: true, jumpHeld: true }));
    expect(sim.player.box.x).toBeGreaterThan(400);
  });
});

describe('Simulation progression & the journey clock', () => {
  it('clearing a screen books its months and advances', () => {
    const sim = toPlaying();
    const base = sim.screen.data.monthsBase;
    sim.player.box.x = sim.screen.exitX!;
    sim.step(DT, makeInput());
    expect(sim.screenId).toBe(1);
    expect(sim.state).toBe('TITLE_CARD');
    expect(sim.months).toBe(base);
  });

  it('collects a quick win on overlap and counts it (never scores it)', () => {
    const sim = toPlaying();
    const pt = sim.screen.points[0]!;
    sim.player.box.x = pt.x - sim.player.box.w / 2;
    sim.player.box.y = pt.y - sim.player.box.h / 2;
    sim.step(DT, makeInput());
    expect(sim.quickWins).toBe(1);
    expect(sim.screen.points[0]!.collected).toBe(true);
    // Quick wins do not touch the clock.
    expect(sim.months).toBe(0);
    expect(sim.receipt.totalQuickWins).toBe(TOTAL_QUICK_WINS);
  });
});

describe('Simulation setbacks (there is no death)', () => {
  it('falling out of the world books months and keeps playing', () => {
    const sim = toPlaying();
    stepN(sim, 55); // let spawn grace expire
    expect(sim.player.isInvulnerable).toBe(false);

    sim.player.box.y = RESOLUTION.HEIGHT + 200;
    sim.step(DT, makeInput());

    expect(sim.state).toBe('PLAYING'); // no DEATH state exists
    expect(sim.setbacks).toBe(1);
    expect(sim.months).toBe(JOURNEY.SETBACK_MONTHS);
    // Relocated onto known-good ground rather than left falling.
    stepN(sim, 40);
    expect(sim.player.box.y).toBeLessThan(RESOLUTION.HEIGHT);
  });

  it('the grace period stops one mistake chaining into several', () => {
    const sim = toPlaying();
    stepN(sim, 55);
    sim.player.box.y = RESOLUTION.HEIGHT + 200;
    sim.step(DT, makeInput());
    expect(sim.setbacks).toBe(1);
    // Immediately fall again while still in grace → relocated, not charged.
    sim.player.box.y = RESOLUTION.HEIGHT + 200;
    sim.step(DT, makeInput());
    expect(sim.setbacks).toBe(1);
  });

  it('caps the clock so a run always beats going it alone', () => {
    const sim = toPlaying();
    for (let i = 0; i < 40; i += 1) {
      stepN(sim, 80); // outlast the grace window
      sim.player.box.y = RESOLUTION.HEIGHT + 200;
      sim.step(DT, makeInput());
    }
    expect(sim.setbacks).toBeGreaterThan(5);
    expect(sim.months).toBe(JOURNEY.MAX_MONTHS);
    expect(sim.months).toBeLessThan(JOURNEY.BASELINE_MONTHS);
  });

  it('the "no setbacks" assist explores freely without booking months', () => {
    const sim = new Simulation({ assist: { noSetbacks: true } });
    sim.step(DT, makeInput({ anyPressed: true }));
    for (let i = 0; i < 120 && sim.state !== 'PLAYING'; i += 1) sim.step(DT, makeInput());
    stepN(sim, 60);
    sim.player.box.y = RESOLUTION.HEIGHT + 200;
    sim.step(DT, makeInput());
    expect(sim.setbacks).toBe(0);
    expect(sim.months).toBe(0);
    // Still rescued from the void so play can continue.
    stepN(sim, 40);
    expect(sim.player.box.y).toBeLessThan(RESOLUTION.HEIGHT);
  });
});

describe('Game.simulate (headless)', () => {
  it('runs a scripted sequence and returns the resulting sim', () => {
    const script = [{ anyPressed: true }, ...Array.from({ length: 120 }, () => ({}))];
    const sim = Game.simulate(script);
    expect(sim.state).toBe('PLAYING');
    expect(sim.screenId).toBe(0);
  });
});
