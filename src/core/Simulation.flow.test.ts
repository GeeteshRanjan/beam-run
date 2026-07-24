import { describe, it, expect } from 'vitest';
import { Simulation } from './Simulation';
import { makeInput } from './Input';
import { LOOP, RUN, RESOLUTION } from '../data/tuning.config';

const DT = LOOP.FIXED_DT;

function toPlaying(sim: Simulation): void {
  sim.step(DT, makeInput({ anyPressed: true }));
  for (let i = 0; i < 120 && sim.state !== 'PLAYING'; i += 1) sim.step(DT, makeInput());
}

/** Advance through every screen by teleporting Beam to each exit / win trigger. */
function driveToEnd(sim: Simulation): void {
  sim.step(DT, makeInput({ anyPressed: true }));
  for (let guard = 0; guard < 4000 && sim.state !== 'WIN' && sim.state !== 'GAMEOVER'; guard += 1) {
    if (sim.state === 'PLAYING') {
      const s = sim.screen;
      if (s.winTriggerX !== undefined) sim.player.box.x = s.winTriggerX;
      else if (s.exitX !== undefined) sim.player.box.x = s.exitX;
    }
    sim.step(DT, makeInput());
  }
}

describe('full state-machine flow', () => {
  it('runs Lobby → … → Tech Park and reaches WIN on screen 5', () => {
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

describe('lives & game over', () => {
  it('reaches GAME OVER after losing all lives', () => {
    const sim = new Simulation();
    toPlaying(sim);
    for (let life = 0; life < RUN.STARTING_LIVES; life += 1) {
      // Wait out spawn i-frames.
      for (let i = 0; i < 60 && sim.state === 'PLAYING' && sim.player.isInvulnerable; i += 1) {
        sim.step(DT, makeInput());
      }
      if (sim.state === 'PLAYING') {
        sim.player.box.y = RESOLUTION.HEIGHT + 200;
        sim.step(DT, makeInput());
      }
      for (let i = 0; i < 30 && sim.state === 'DEATH'; i += 1) sim.step(DT, makeInput());
    }
    expect(sim.lives).toBe(0);
    expect(sim.state).toBe('GAMEOVER');
  });
});

describe('Growth Points persistence rule', () => {
  it('keeps collected points across a mid-screen respawn (and their value)', () => {
    const sim = new Simulation();
    toPlaying(sim);
    // Wait out i-frames so a fall counts.
    for (let i = 0; i < 60 && sim.player.isInvulnerable; i += 1) sim.step(DT, makeInput());

    const pt = sim.screen.points[0]!;
    sim.player.box.x = pt.x - sim.player.box.w / 2;
    sim.player.box.y = pt.y - sim.player.box.h / 2;
    sim.step(DT, makeInput());
    expect(sim.points).toBe(RUN.POINTS_PER_PICKUP);
    const collectedId = pt.id;

    // Die by falling → respawn same screen.
    sim.player.box.y = RESOLUTION.HEIGHT + 200;
    sim.step(DT, makeInput());
    for (let i = 0; i < 30 && sim.state !== 'PLAYING'; i += 1) sim.step(DT, makeInput());

    expect(sim.state).toBe('PLAYING');
    expect(sim.points).toBe(RUN.POINTS_PER_PICKUP); // value retained
    const still = sim.screen.points.find((p) => p.id === collectedId)!;
    expect(still.collected).toBe(true); // does not reappear
  });

  it('banks points from a completed screen (they carry to the next)', () => {
    const sim = new Simulation();
    toPlaying(sim);
    const pt = sim.screen.points[0]!;
    sim.player.box.x = pt.x - sim.player.box.w / 2;
    sim.player.box.y = pt.y - sim.player.box.h / 2;
    sim.step(DT, makeInput());
    expect(sim.points).toBe(RUN.POINTS_PER_PICKUP);

    // Reach the exit → advance to screen 1; banked points persist.
    sim.player.box.x = sim.screen.exitX!;
    sim.step(DT, makeInput());
    expect(sim.screenId).toBe(1);
    expect(sim.points).toBe(RUN.POINTS_PER_PICKUP);
  });
});
