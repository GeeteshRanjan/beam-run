import { describe, it, expect } from 'vitest';
import { Simulation } from './Simulation';
import { Game } from './Game';
import { makeInput } from './Input';
import { LOOP, RUN, RESOLUTION } from '../data/tuning.config';

const DT = LOOP.FIXED_DT;

/** Drive a fresh sim to PLAYING on the Lobby. */
function toPlaying(): Simulation {
  const sim = new Simulation();
  sim.step(DT, makeInput({ anyPressed: true })); // START → begin run → TITLE_CARD
  for (let i = 0; i < 120 && sim.state !== 'PLAYING'; i += 1) {
    sim.step(DT, makeInput());
  }
  return sim;
}

describe('Simulation lifecycle', () => {
  it('boots to START and begins a run on any input', () => {
    const sim = new Simulation();
    expect(sim.state).toBe('START');
    sim.step(DT, makeInput({ anyPressed: true }));
    expect(sim.state).toBe('TITLE_CARD');
    expect(sim.screenId).toBe(0);
    expect(sim.lives).toBe(RUN.STARTING_LIVES);
  });

  it('auto-advances from the title card to PLAYING', () => {
    const sim = toPlaying();
    expect(sim.state).toBe('PLAYING');
  });
});

describe('Simulation movement & collision', () => {
  it('walls are solid — holding right stalls Beam at the first practice wall', () => {
    const sim = toPlaying();
    for (let i = 0; i < 150; i += 1) sim.step(DT, makeInput({ right: true }));
    const p = sim.player;
    expect(p.onGround).toBe(true);
    // First Lobby wall is at gx9 (x=360); Beam (w=28) stops just left of it.
    expect(p.box.x + p.box.w).toBeLessThanOrEqual(361);
    expect(p.box.x).toBeGreaterThan(300);
  });

  it('a full jump clears the 1-tile practice wall', () => {
    const sim = toPlaying();
    for (let i = 0; i < 150; i += 1) sim.step(DT, makeInput({ right: true }));
    // Jump while moving right and hold through the arc.
    sim.step(DT, makeInput({ right: true, jumpPressed: true, jumpHeld: true }));
    for (let i = 0; i < 45; i += 1) sim.step(DT, makeInput({ right: true, jumpHeld: true }));
    expect(sim.player.box.x).toBeGreaterThan(400);
  });
});

describe('Simulation progression', () => {
  it('reaching the exit advances to the next screen', () => {
    const sim = toPlaying();
    sim.player.box.x = sim.screen.exitX!;
    sim.step(DT, makeInput());
    expect(sim.screenId).toBe(1);
    expect(sim.state).toBe('TITLE_CARD');
  });

  it('collects a Growth Point on overlap and banks its value', () => {
    const sim = toPlaying();
    const pt = sim.screen.points[0]!;
    sim.player.box.x = pt.x - sim.player.box.w / 2;
    sim.player.box.y = pt.y - sim.player.box.h / 2;
    sim.step(DT, makeInput());
    expect(sim.points).toBe(RUN.POINTS_PER_PICKUP);
    expect(sim.screen.points[0]!.collected).toBe(true);
  });
});

describe('Simulation death & respawn', () => {
  it('falling out of the world costs a life and respawns at the start', () => {
    const sim = toPlaying();
    // Let spawn i-frames expire.
    for (let i = 0; i < 55; i += 1) sim.step(DT, makeInput());
    expect(sim.player.isInvulnerable).toBe(false);

    sim.player.box.y = RESOLUTION.HEIGHT + 200;
    sim.step(DT, makeInput());
    expect(sim.state).toBe('DEATH');
    expect(sim.lives).toBe(RUN.STARTING_LIVES - 1);

    // Death fade elapses → respawn back to PLAYING at the spawn point.
    for (let i = 0; i < 20 && sim.state !== 'PLAYING'; i += 1) sim.step(DT, makeInput());
    expect(sim.state).toBe('PLAYING');
    expect(sim.player.box.x).toBeCloseTo(sim.screen.spawnX, 0);
  });
});

describe('Game.simulate (headless)', () => {
  it('runs a scripted sequence and returns the resulting sim', () => {
    const script = [
      { anyPressed: true },
      ...Array.from({ length: 120 }, () => ({})),
    ];
    const sim = Game.simulate(script);
    expect(sim.state).toBe('PLAYING');
    expect(sim.screenId).toBe(0);
  });
});
