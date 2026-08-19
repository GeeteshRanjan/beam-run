/**
 * Can the badge still be taken? Asked with the real simulation, on every screen.
 *
 * The float band was raised so the badge cannot be walked into (owner call: it was
 * too easy to take). That changes the stakes on touch far more than on a keyboard:
 * with one-tap auto-run the move pad is hidden, so the player cannot stop under
 * the badge and wait for it — they get one pass and one tap. These tests drive the
 * sim exactly like that player, and like a keyboard player who stands and waits.
 *
 * The numbers here are the fairness budget. If a tuning change shrinks the one-tap
 * window below ~0.3s, the band has moved too far, not the player.
 */
import { describe, it, expect } from 'vitest';
import { SCREENS } from '../data/levels';
import { makeInput } from './Input';
import { PLAYER, POWERUPS, RESOLUTION } from '../data/tuning.config';
import { badgeLowestBox } from '../world/badgeFloat';
import { dropColumnsOf, dropRestBox, isAirdropped } from '../world/badgeDrop';
import { DT, driveToScreen, GROUND_FEET_Y, stepN } from '../test/helpers';
import type { Simulation } from './Simulation';

/** Hold "right" and jump once on `tapFrame`; did the badge come with us? */
function oneTapRun(screenId: number, tapFrame: number): boolean {
  const sim = driveToScreen(screenId);
  for (let f = 0; f < 200; f += 1) {
    const jump = f === tapFrame;
    sim.step(
      DT,
      makeInput({
        right: true,
        jumpPressed: jump,
        // Held for a few frames after the press: a tap is not an instant release,
        // and jump-cut would otherwise clip the arc short.
        jumpHeld: jump || (f > tapFrame && f < tapFrame + 12),
      }),
    );
    if (sim.powerups.collected) return true;
    if (sim.state !== 'PLAYING') break;
  }
  return false;
}

/** Stand under the badge and jump every time it comes back down. */
function waitAndJump(sim: Simulation, cx: number): boolean {
  sim.player.box.x = cx - sim.player.box.w / 2;
  sim.player.box.y = GROUND_FEET_Y - sim.player.box.h;
  for (let f = 0; f < 600; f += 1) {
    const grounded = sim.player.onGround;
    sim.step(DT, makeInput({ jumpPressed: grounded, jumpHeld: true }));
    if (sim.powerups.collected) return true;
  }
  return false;
}

/*
 * The AIR-DROPPED badge (Hire Under Fire) answers these questions somewhere else, and
 * has to be excluded from the rail's versions of them.
 *
 * The rail tests are all phrased in terms of `badgeLowestBox` — the bottom of a float
 * band this badge does not have. Applied to the drop screen they measure the *drone's
 * flight row* (gy 5) as if the pickup hung there, which is 161px over a standing head
 * and fails for being correct. What the drop screen actually has to prove — that the
 * badge rests out of standing reach on its brick, and that a one-tap auto-run player
 * can still jump it off — is proved against `dropRestBox` below and in
 * `screen4.test.ts`, both of which know where the badge really is.
 */
/*
 * And Reception carries NO badge at all now (owner call), so "every screen" has to
 * mean "every screen that has one" — the same lesson as the rail/drop split, one
 * step further: a rule phrased in terms of a badge must exclude the screen without
 * one, or it fails for being correct.
 */
const badged = SCREENS.filter((s) => s.badge);
const railScreens = badged.filter((s) => !isAirdropped(s.badge!));
const dropScreens = badged.filter((s) => isAirdropped(s.badge!));

describe('badge reachability', () => {
  for (const screen of railScreens) {
    const badge = screen.badge!;

    describe(`screen ${screen.id} — ${screen.name}`, () => {
      it('cannot be collected by walking: standing under it never touches it', () => {
        const sim = driveToScreen(screen.id);
        const box = badgeLowestBox(badge);
        sim.player.box.x = box.x + (box.w - sim.player.box.w) / 2;
        sim.player.box.y = GROUND_FEET_Y - sim.player.box.h;
        // A whole float cycle, standing still on the ground under the badge.
        stepN(sim, Math.ceil(POWERUPS.FLOAT_PERIOD / DT) + 10);
        expect(sim.powerups.collected).toBe(false);
      });

      it('is collected by a player who stands under it and jumps', () => {
        const sim = driveToScreen(screen.id);
        expect(waitAndJump(sim, badgeLowestBox(badge).x + 20)).toBe(true);
      });

      it('is collected by a one-tap auto-run player, with a fair tap window', () => {
        const hits: number[] = [];
        for (let tap = 0; tap < 50; tap += 1) if (oneTapRun(screen.id, tap)) hits.push(tap);
        expect(hits.length, 'no single tap takes the badge on a one-tap pass').toBeGreaterThan(0);
        // ≥0.3s of taps land it, and they are one contiguous window (a scattered
        // set of working taps would mean the arc is only just grazing the box).
        expect(hits.length / 60).toBeGreaterThanOrEqual(0.3);
        expect(hits[hits.length - 1]! - hits[0]! + 1).toBe(hits.length);
      });
    });
  }

  it('needs less than half a jump of lift, so the hop is small', () => {
    const jumpRise = (PLAYER.JUMP_VELOCITY * PLAYER.JUMP_VELOCITY) / (2 * PLAYER.GRAVITY);
    for (const screen of railScreens) {
      const box = badgeLowestBox(screen.badge!);
      const standingHead = GROUND_FEET_Y - PLAYER.HEIGHT;
      const lift = standingHead - (box.y + box.h);
      expect(lift).toBeGreaterThan(0); // out of reach standing…
      expect(lift).toBeLessThan(jumpRise / 2); // …but a light hop reaches it
    }
  });

  describe('the air-dropped badge sits on a brick, so the same rule holds there', () => {
    it('rests out of standing reach on every drop column', () => {
      // The whole reason the brick exists (owner call): on the floor, an auto-running
      // player collected the one pickup in the game with a clock on it *without leaving
      // the ground*. Every column has to be a jump, not just the one the first delivery
      // happens to use.
      const jumpRise = (PLAYER.JUMP_VELOCITY * PLAYER.JUMP_VELOCITY) / (2 * PLAYER.GRAVITY);
      const standingHead = GROUND_FEET_Y - PLAYER.HEIGHT;
      expect(dropScreens.length).toBeGreaterThan(0);
      for (const screen of dropScreens) {
        const badge = screen.badge!;
        dropColumnsOf(badge).forEach((gx, n) => {
          const box = dropRestBox(badge, n);
          const lift = standingHead - (box.y + box.h);
          expect(lift, `drop at gx=${gx} is walkable`).toBeGreaterThan(0);
          // A brick is a bigger hop than a float band's bottom, because a solid has to
          // be *cleared* rather than touched — but it still has to be inside one jump
          // with room, or the capability is gated on a perfect arc.
          expect(lift, `drop at gx=${gx} is out of jump range`).toBeLessThan(jumpRise * 0.7);
        });
      }
    });

    it('has a brick under each column that leaves the corridor walkable', () => {
      // The brick's underside is the trap: 4px lower and it is a wall across the only
      // route on the screen rather than a platform over it.
      for (const screen of dropScreens) {
        const badge = screen.badge!;
        const standingHead = GROUND_FEET_Y - PLAYER.HEIGHT;
        for (const gx of dropColumnsOf(badge)) {
          const brick = screen.solids.find((s) => s.role?.includes('pedestal') && s.gx === gx);
          expect(brick, `no brick at gx=${gx}`).toBeTruthy();
          expect((brick!.gy + brick!.h) * RESOLUTION.TILE).toBeLessThanOrEqual(standingHead);
          // …and the badge rests on its top face, not somewhere near it.
          expect(dropRestBox(badge, dropColumnsOf(badge).indexOf(gx)).y + RESOLUTION.TILE).toBe(
            brick!.gy * RESOLUTION.TILE,
          );
        }
      }
    });
  });
});
