import { describe, it, expect } from 'vitest';
import { makeInput } from './Input';
import { JOURNEY } from '../data/tuning.config';
import { ComplianceMaze } from '../world/Hazards/ComplianceMaze';
import { DT, T, driveToScreen, engageBadge, expireGrace, stepN } from '../test/helpers';
import type { Simulation } from './Simulation';

/**
 * Screen 2 — the Compliance maze (owner rebuild, and a re-ordering: compliance
 * now follows Setup Delays).
 *
 * The two claims this screen makes, and the two things worth proving here:
 *
 *  1. **You cannot cross on one level.** The maze is the obstacle as much as the
 *     monsters are, so "hold right and you are through" has to be false.
 *  2. **GCC-BOT changes the screen, not the player.** Every toll gate opens for
 *     good and all five monsters leave their corridors — measured, not asserted
 *     from a comment.
 */

/** Park Beam standing on the surface at a grid cell (works off the ground too). */
function standOn(sim: Simulation, gx: number, gy: number, offset = 6): void {
  sim.player.box.x = gx * T + offset;
  sim.player.box.y = gy * T - sim.player.box.h;
}

/** TAX patrols the left corridor, between the badge and the first staircase. */
const TAX_COLUMN = 7;

describe('Screen 2 — Compliance (a staircase maze of compliance monsters)', () => {
  it('is the GCC-BOT screen, and it comes straight after Setup Delays', () => {
    const sim = driveToScreen(2);
    expect(sim.screen.name).toBe('Compliance');
    expect(sim.screen.data.hazard).toBe('maze');
    expect(sim.screen.data.badge!.type).toBe('CLEAR_PATH');
    expect(sim.activeHazard).toBeInstanceOf(ComplianceMaze);
    expect(driveToScreen(1).screen.name).toBe('Setup Delays');
  });

  it('is patrolled by the compliance headaches, all of them beyond the badge', () => {
    const sim = driveToScreen(2);
    const badgeGx = sim.screen.data.badge!.gx;
    const monsters = sim.screen.data.monsters!;
    // The five filings the owner's reference view names, and the five words now
    // drawn on plaques over the monsters themselves rather than on boards in the
    // sky — so this list is also the screen's entire signage.
    expect(monsters.map((m) => m.name).sort()).toEqual([
      'AUDIT',
      'ENTITY',
      'GST',
      'LEGAL',
      'TAX',
    ]);
    // Every corridor starts beyond the badge: the badge is the first thing on the
    // path, always.
    expect(monsters.every((m) => m.from > badgeGx)).toBe(true);
    // And every one of them knows its way home, ending on the gather cell.
    for (const m of monsters) {
      const last = m.route![m.route!.length - 1]!;
      expect(last).toEqual(sim.screen.data.gather);
    }
  });

  it('puts a monster on every level of the maze, so no corridor is a free walk', () => {
    const sim = driveToScreen(2);
    const rows = sim.screen.data.monsters!.map((m) => m.gy);
    expect(new Set(rows).size).toBe(rows.length);
  });

  it('cannot be crossed on one level: holding right along the ground gets nowhere', () => {
    const sim = driveToScreen(2);
    // Start on the ground, clear of the badge, and just run.
    standOn(sim, 6, 15);
    for (let i = 0; i < 300; i += 1) sim.step(DT, makeInput({ right: true }));
    // The first stair riser stops them dead, and the screen never clears.
    expect(sim.screenId).toBe(2);
    expect(sim.player.box.x + sim.player.box.w).toBeLessThan(sim.screen.exitX!);
    expect(sim.player.box.x).toBeLessThan(9 * T);
  });

  it('touching a monster costs months and a life', () => {
    const sim = driveToScreen(2);
    expireGrace(sim);
    const before = sim.months;
    for (let i = 0; i < 900; i += 1) {
      if (sim.state !== 'PLAYING') break;
      standOn(sim, TAX_COLUMN, 15);
      sim.step(DT, makeInput());
      if (sim.months > before) break;
    }
    expect(sim.months).toBe(before + JOURNEY.SETBACK_MONTHS);
    expect(sim.state).toBe('LIFE_LOST');
    expect(sim.lifeLost?.cause).toBe('monster');
    expect(sim.lives).toBe(sim.livesTotal - 1);
  });

  it('engaging GCC-BOT raises every arm and walks every monster to the landing', () => {
    const sim = driveToScreen(2);
    expireGrace(sim);
    engageBadge(sim);
    const maze = sim.activeHazard as ComplianceMaze;
    expect(maze.isFriendly).toBe(true);
    // The exodus is a walk, not a sprint (owner call), so it takes about 4s from the
    // far gallery. 7s of headroom, because the assertion below is about *arriving*,
    // not about the pace — pinning the pace is `ComplianceMaze.test.ts`'s job.
    stepN(sim, 420);
    const count = sim.screen.data.monsters!.length;
    expect(maze.clearedCount).toBe(count);
    expect(maze.gatheredCount).toBe(count);
    const gatherY = sim.screen.data.gather!.gy * T;
    for (const m of maze.monsterStates()) {
      expect(m.friendly).toBe(true);
      expect(m.arm).toBe(1);
      // They walked the maze's own stairs to the spot, and they are standing on it.
      expect(m.box.y + m.box.h).toBe(gatherY);
    }
    // Contact is genuinely harmless now, which is what licenses the ANSR bubble.
    expect(sim.shielded).toBe(true);
  });

  it('the assisted maze is genuinely free — standing in a monster costs nothing', () => {
    const sim = driveToScreen(2);
    expireGrace(sim);
    engageBadge(sim);
    const before = sim.months;
    for (let i = 0; i < 600; i += 1) {
      standOn(sim, TAX_COLUMN, 15);
      sim.step(DT, makeInput());
    }
    expect(sim.months).toBe(before);
    expect(sim.setbacks).toBe(0);
    expect(sim.state).toBe('PLAYING');
  });

  it('help does not lapse — the arms stay up and the monsters stay put', () => {
    const sim = driveToScreen(2);
    engageBadge(sim);
    const maze = sim.activeHazard as ComplianceMaze;
    stepN(sim, 420); // long enough for the walk home to finish, whatever its pace
    const settled = maze.monsterStates().map((m) => m.box.x);
    stepN(sim, 900); // 15s later
    expect(maze.monsterStates().map((m) => m.box.x)).toEqual(settled);
    expect(maze.monsterStates().every((m) => m.arm === 1)).toBe(true);
    expect(sim.activePower?.product).toBe('GCC-BOT');
  });

  it('the clearance lift carries the player down into the far bay', () => {
    const sim = driveToScreen(2);
    const maze = sim.activeHazard as ComplianceMaze;
    const plate = maze.liftState()!;
    // Step off the top of the statutory wall onto the plate.
    sim.player.box.x = plate.box.x + 30;
    sim.player.box.y = plate.box.y - sim.player.box.h;
    stepN(sim, 240);
    const after = maze.liftState()!;
    expect(after.progress).toBe(1);
    // …and the player came down with it, onto the bay floor.
    expect(sim.player.box.y + sim.player.box.h).toBeGreaterThan(500);
  });
});
