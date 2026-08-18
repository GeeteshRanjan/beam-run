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
import { PLAYER, POWERUPS } from '../data/tuning.config';
import { badgeLowestBox } from '../world/badgeFloat';
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

describe('badge reachability', () => {
  for (const screen of SCREENS) {
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
    for (const screen of SCREENS) {
      const box = badgeLowestBox(screen.badge!);
      const standingHead = GROUND_FEET_Y - PLAYER.HEIGHT;
      const lift = standingHead - (box.y + box.h);
      expect(lift).toBeGreaterThan(0); // out of reach standing…
      expect(lift).toBeLessThan(jumpRise / 2); // …but a light hop reaches it
    }
  });
});
