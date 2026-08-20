import { describe, it, expect } from 'vitest';
import { makeInput } from './Input';
import { JOURNEY, PLAYER } from '../data/tuning.config';
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
    // Start on the ground past the badge wall, clear of the mark, and just run.
    standOn(sim, 8, 15);
    for (let i = 0; i < 300; i += 1) sim.step(DT, makeInput({ right: true }));
    // The first stair riser stops them dead, and the screen never clears.
    expect(sim.screenId).toBe(2);
    expect(sim.player.box.x + sim.player.box.w).toBeLessThan(sim.screen.exitX!);
    expect(sim.player.box.x).toBeLessThan(9 * T);
  });

  it('carries its badge on TWO floating structures, reached by jumping both ways', () => {
    /*
     * Owner call in three steps, and the last two are the interesting ones. The rail went
     * first. Then the brickwork left the floor, because standing on it it was a hurdle
     * across the only corridor and everybody collected GCC-BOT for free. Then the badge
     * moved off the stepping stone and onto a second, higher deck to its LEFT — "still too
     * reachable ... so the user has to go on and jump the opposite direction to get it".
     */
    const sim = driveToScreen(2);
    const badge = sim.screen.data.badge!;
    expect(badge.delivery).toBe('perch');
    expect(sim.screen.data.solids.some((s) => s.role === 'platform-registers')).toBe(false);
    const step = sim.screen.data.solids.find((s) => s.role === 'step-ansr-approach')!;
    const deck = sim.screen.data.solids.find((s) => s.role === 'wall-ansr-mark')!;
    expect(step).toBeTruthy();
    expect(deck).toBeTruthy();
    /*
     * The mark is on the DECK, not on the step, and **centred across it** (owner call:
     * "the ANSR powerup is on the right side of the brick, make it centre on the floating
     * brick"). It used to stand on the deck's right-hand column under an older owner rule
     * about landing late; that rule assumes a deck you arrive at walking right, and this
     * one is reached by turning round and jumping back up-left, so the arrival is at the
     * far end and the walk is inwards anyway.
     */
    expect(badge.restGy).toBe(deck.gy);
    expect(badge.gx).toBe(deck.gx);
    expect(badge.restW).toBe(deck.w);
    const deckMid = (deck.gx + deck.w / 2) * T;
    expect(sim.badgeBox).toEqual({ x: deckMid - T / 2, y: deck.gy * T - T, w: T, h: T });
    // The deck is higher than the step and to its left, with a gap between them: the two
    // jumps have to be in opposite directions, and neither is a walk.
    expect(deck.gy).toBeLessThan(step.gy);
    expect((deck.gx + deck.w) * T).toBeLessThan(step.gx * T);
    // Both float, so the corridor under the pair stays open.
    const standingHead = 15 * T - sim.player.box.h;
    for (const s of [step, deck]) expect((s.gy + s.h) * T).toBeLessThan(standingHead);
  });

  it('puts the deck out of reach of the ground, so the step is not optional', () => {
    // If a jump off the floor could reach the deck, the whole two-jump shape collapses
    // back into the thing the owner rejected. A full jump lifts 140px: from the ground at
    // 600 that is feet 460, against a deck top at 360.
    const sim = driveToScreen(2);
    const deck = sim.screen.data.solids.find((s) => s.role === 'wall-ansr-mark')!;
    const rise = (PLAYER.JUMP_VELOCITY * PLAYER.JUMP_VELOCITY) / (2 * PLAYER.GRAVITY);
    expect(15 * T - rise).toBeGreaterThan(deck.gy * T);
    // …and the step IS reachable from the ground, which is what makes it the way up.
    const step = sim.screen.data.solids.find((s) => s.role === 'step-ansr-approach')!;
    expect(15 * T - rise).toBeLessThan(step.gy * T);
    // …and the deck is inside one jump of the step.
    expect(step.gy * T - rise).toBeLessThan(deck.gy * T);
  });

  it('is taken by hopping right onto the step and then jumping back up-left', () => {
    // The route, played. Two jumps in opposite directions, the second one with the button
    // held — a solid has to be cleared rather than touched.
    const sim = driveToScreen(2);
    sim.assist.noSetbacks = true; // this is a geometry claim; TAX is not the subject
    const TAP = 8;
    let landed = -1;
    for (let f = 0; f < 240 && !sim.powerups.collected; f += 1) {
      if (f < TAP + 30) {
        const jump = f === TAP;
        sim.step(
          DT,
          makeInput({
            right: true,
            jumpPressed: jump,
            jumpHeld: jump || (f > TAP && f < TAP + 20),
          }),
        );
        continue;
      }
      // Landed on the step: turn round, wait a beat, and jump the other way.
      if (landed < 0 && sim.player.onGround) landed = f;
      const g = landed < 0 ? -1 : f - landed;
      const jump = g === 8;
      sim.step(
        DT,
        makeInput({ left: true, jumpPressed: jump, jumpHeld: jump || (g > 8 && g < 32) }),
      );
    }
    expect(sim.powerups.collected).toBe(true);
    expect(sim.activePower?.product).toBe('GCC-BOT');
  });

  it('leaves the corridor under both structures walkable, so the badge is a decision', () => {
    // The whole point of lifting the brickwork off the floor. A player who holds right
    // walks under both decks, past the mark, and pays for it in the maze — which is the
    // argument the screen exists to make, and it only works if declining is possible.
    const sim = driveToScreen(2);
    sim.assist.noSetbacks = true;
    const step = sim.screen.data.solids.find((s) => s.role === 'step-ansr-approach')!;
    standOn(sim, 1, 15);
    for (let f = 0; f < 120; f += 1) sim.step(DT, makeInput({ right: true }));
    expect(sim.powerups.collected).toBe(false);
    expect(sim.player.box.x).toBeGreaterThan((step.gx + step.w) * T);
    expect(sim.player.onGround).toBe(true);
  });

  it('is climbed on the hoist: it rises only under the player and returns when empty', () => {
    const sim = driveToScreen(2);
    const maze = sim.activeHazard as ComplianceMaze;
    const parked = maze.hoistState()!;
    const spec = sim.screen.data.hoist!;
    expect(parked.box.y).toBe(spec.gy * T);
    // Empty, it stays parked however long you leave it — the plate is a ride, not a
    // timing puzzle, and a plate on its own clock could rise into a body.
    stepN(sim, 120);
    expect(maze.hoistState()!.box.y).toBe(spec.gy * T);

    // Step on: it lifts, and it takes the player with it.
    sim.player.box.x = parked.box.x + 40;
    sim.player.box.y = parked.box.y - sim.player.box.h;
    stepN(sim, 120);
    const top = maze.hoistState()!;
    expect(top.box.y).toBe(spec.toGy * T);
    expect(top.progress).toBe(1);
    expect(sim.player.box.y + sim.player.box.h).toBeCloseTo(top.box.y, 0);
    // …and its top puts the upper flight one small hop away, at the same height.
    const upper = sim.screen.data.solids.find((s) => s.role === 'stair-transfer-pricing')!;
    expect(upper.gy * T).toBe(spec.toGy * T);

    // Step off and it goes back down for the next time.
    sim.player.box.x = 2 * T;
    sim.player.box.y = 15 * T - sim.player.box.h;
    stepN(sim, 240);
    expect(maze.hoistState()!.box.y).toBe(spec.gy * T);
  });

  it('leaves 84px of headroom under the parked hoist, so the tread below stays jumpable', () => {
    // The trap this layout nearly shipped: one row lower and a player on the stair-gst
    // tread can no longer hop up to stair-tds, which seals the only route up — and the
    // plate is not a solid in levels.json, so nothing else would have noticed.
    const sim = driveToScreen(2);
    const plate = (sim.activeHazard as ComplianceMaze).hoistState()!.box;
    const under = sim.screen.data.solids.filter(
      (s) => s.gx * T < plate.x + plate.w && (s.gx + s.w) * T > plate.x && s.gy * T > plate.y,
    );
    expect(under.length).toBeGreaterThan(0);
    for (const s of under) expect(s.gy * T - (plate.y + plate.h)).toBeGreaterThanOrEqual(84);
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
    /*
     * …and the hazard remembers WHICH monster did it, on exactly the frames the host paints
     * the impact from. The pose is presentation (`render/maze.ts` buries the player in the
     * paperwork it filed him under), but "who filed him" is simulation state, and it only
     * survives because `Simulation.setback()` deliberately does not reset the hazard — the
     * same reason the DENIED stamp is still standing on the flattened hero on screen 1.
     */
    const struck = (sim.activeHazard as ComplianceMaze).monsterStates().filter((m) => m.struck);
    expect(struck).toHaveLength(1);
    expect(struck[0]!.name).toBe('TAX');
    expect(struck[0]!.friendly).toBe(false);
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
    // Contact is genuinely harmless now — and this is the one screen that says so with
    // the WEATHER rather than with a halo on the hero (owner call), so `shielded` is
    // deliberately false here where it is true on screens 1 and 4.
    expect(sim.shielded).toBe(false);
    expect(maze.skyClear).toBe(1);
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
