import { describe, it, expect } from 'vitest';
import { Simulation } from './Simulation';
import { makeInput } from './Input';
import { LOOP, RESOLUTION } from '../data/tuning.config';

const DT = LOOP.FIXED_DT;
const T = RESOLUTION.TILE;

/** Drive a fresh sim until it is PLAYING on `target` (teleporting through exits). */
function driveToScreen(target: number): Simulation {
  const sim = new Simulation();
  sim.step(DT, makeInput({ anyPressed: true }));
  let guard = 0;
  while (!(sim.screenId === target && sim.state === 'PLAYING')) {
    if (++guard > 4000) break;
    if (sim.state === 'TITLE_CARD') {
      sim.step(DT, makeInput());
    } else if (sim.state === 'PLAYING' && sim.screenId < target) {
      sim.player.box.x = sim.screen.exitX!;
      sim.step(DT, makeInput());
    } else {
      sim.step(DT, makeInput());
    }
  }
  return sim;
}

describe('Screen 1 — Setup Delays (quicksand + PLACE_TILE badge)', () => {
  it('collecting the badge lays a permanent flush bridge across the pit', () => {
    const sim = driveToScreen(1);
    const badge = sim.screen.data.badge!;
    expect(badge.type).toBe('PLACE_TILE');

    // Overlap the badge → collect it.
    sim.player.box.x = badge.gx * T + 2;
    sim.player.box.y = badge.gy * T + 2;
    sim.step(DT, makeInput());

    expect(sim.powerups.collected).toBe(true);
    const tile = sim.powerups.placedTile!;
    const spec = badge.placesTileAt!;
    expect(tile).not.toBeNull();
    expect(tile.x).toBe(spec.gx * T);
    expect(tile.y).toBe(spec.gy * T);
    expect(tile.w).toBe(spec.w * T);
    expect(tile.h).toBe(spec.h * T);
  });

  it('the placed bridge is solid — Beam lands on it', () => {
    const sim = driveToScreen(1);
    const badge = sim.screen.data.badge!;
    sim.player.box.x = badge.gx * T + 2;
    sim.player.box.y = badge.gy * T + 2;
    sim.step(DT, makeInput());
    const tile = sim.powerups.placedTile!;

    // Drop Beam onto the middle of the bridge.
    sim.player.box.x = tile.x + tile.w / 2;
    sim.player.box.y = tile.y - sim.player.box.h - 20;
    sim.player.vy = 0;
    for (let i = 0; i < 30; i += 1) sim.step(DT, makeInput());

    expect(sim.player.onGround).toBe(true);
    expect(sim.player.box.y + sim.player.box.h).toBeCloseTo(tile.y, 0);
  });

  it('the bridge closes the pit to jumpable gaps (screen is completable)', () => {
    const sim = driveToScreen(1);
    const badge = sim.screen.data.badge!;
    sim.player.box.x = badge.gx * T + 2;
    sim.player.box.y = badge.gy * T + 2;
    sim.step(DT, makeInput());

    // Gather ground-level spans (side ground + bridge) and measure the gaps.
    const groundY = 15 * T;
    const spans = sim.screen.solids
      .filter((s) => s.y === groundY)
      .concat([sim.powerups.placedTile!])
      .map((s) => ({ start: s.x, end: s.x + s.w }))
      .sort((a, b) => a.start - b.start);

    let maxGap = 0;
    for (let i = 1; i < spans.length; i += 1) {
      maxGap = Math.max(maxGap, spans[i]!.start - spans[i - 1]!.end);
    }
    // Max full-jump distance ≈ 177px; gaps here are a single tile (40px).
    expect(maxGap).toBeLessThanOrEqual(177);
  });

  it('clears the placed tile on respawn (badge must be re-collected)', () => {
    const sim = driveToScreen(1);
    // Expire spawn i-frames.
    for (let i = 0; i < 60 && sim.player.isInvulnerable; i += 1) sim.step(DT, makeInput());

    const badge = sim.screen.data.badge!;
    sim.player.box.x = badge.gx * T + 2;
    sim.player.box.y = badge.gy * T + 2;
    sim.step(DT, makeInput());
    expect(sim.powerups.placedTile).not.toBeNull();

    // Die by falling.
    sim.player.box.y = RESOLUTION.HEIGHT + 200;
    sim.step(DT, makeInput());
    expect(sim.state).toBe('DEATH');
    for (let i = 0; i < 30 && sim.state !== 'PLAYING'; i += 1) sim.step(DT, makeInput());

    expect(sim.state).toBe('PLAYING');
    expect(sim.powerups.collected).toBe(false);
    expect(sim.powerups.placedTile).toBeNull();
  });

  it('without the bridge, dawdling in the quicksand is lethal', () => {
    const sim = driveToScreen(1);
    for (let i = 0; i < 60 && sim.player.isInvulnerable; i += 1) sim.step(DT, makeInput());

    // Stand in the middle of the pit (do not collect the badge).
    sim.player.box.x = 16 * T;
    sim.player.box.y = 16 * T - sim.player.box.h;
    let died = false;
    for (let i = 0; i < 200; i += 1) {
      sim.step(DT, makeInput());
      if (sim.state === 'DEATH') {
        died = true;
        break;
      }
    }
    expect(died).toBe(true);
  });
});
