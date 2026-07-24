import { describe, it, expect } from 'vitest';
import { Simulation } from './Simulation';
import { Input, makeInput } from './Input';
import { LOOP } from '../data/tuning.config';

const DT = LOOP.FIXED_DT;

/**
 * Keyboard operability: the game must be fully playable with the keyboard alone
 * (no pointer). We drive the real Input abstraction (as key handlers would) into
 * the Simulation and confirm it starts, moves and jumps.
 */
describe('Keyboard-only operability', () => {
  it('starts the run, walks right and jumps using only key actions', () => {
    const sim = new Simulation();
    const input = new Input();

    // Press jump → START advances into the run (title card).
    input.pressAction('jump');
    sim.step(DT, input.getState());
    input.endFrame();
    input.releaseAction('jump');
    expect(sim.state).toBe('TITLE_CARD');

    // Let the title card auto-advance to PLAYING.
    let guard = 0;
    while (sim.state !== 'PLAYING' && guard++ < 200) sim.step(DT, makeInput());
    expect(sim.state).toBe('PLAYING');

    // Hold Right for a while → Beam accelerates rightward across the Lobby floor.
    const x0 = sim.player.box.x;
    input.pressAction('right');
    for (let i = 0; i < 40; i += 1) {
      sim.step(DT, input.getState());
      input.endFrame();
    }
    expect(sim.player.box.x).toBeGreaterThan(x0 + 50);
    input.releaseAction('right');

    // Settle on the ground, then press Jump → Beam leaves the floor.
    for (let i = 0; i < 10; i += 1) sim.step(DT, makeInput());
    const yGround = sim.player.box.y;
    input.pressAction('jump');
    let minY = yGround;
    for (let i = 0; i < 12; i += 1) {
      sim.step(DT, input.getState());
      input.endFrame();
      minY = Math.min(minY, sim.player.box.y);
    }
    expect(minY).toBeLessThan(yGround - 20); // rose off the ground
  });
});
