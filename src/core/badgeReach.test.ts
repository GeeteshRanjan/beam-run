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
import { isPerched, perchBox } from '../world/badgePerch';
import {
  ceilingCycleLength,
  ceilingLandsAt,
  ceilingRestBox,
  ceilingStateAt,
  isCeilingDrop,
} from '../world/badgeCeiling';
import { DT, driveToScreen, GROUND_FEET_Y, stepN } from '../test/helpers';
import type { Simulation } from './Simulation';

/**
 * Hold "right" and jump once on `tapFrame`; did the badge come with us?
 *
 * `hold` is how many frames the button stays down after the press. 12 is a rail
 * screen's tap: the band's bottom is 41px over a standing head, so a clipped arc still
 * reaches it. **A pickup standing on something needs 20** — the same figure the
 * air-dropped brick forced (`screen4.test.ts`), and for the same reason: a solid has to
 * be *cleared* rather than touched, and at a 12-frame hold jump-cut caps the rise at
 * ~121px against a deck top 120px up, which lands the player on the deck's face instead
 * of on its top. A third of a second is still a tap.
 */
function oneTapRun(screenId: number, tapFrame: number, hold = 12): boolean {
  const sim = driveToScreen(screenId);
  for (let f = 0; f < 200; f += 1) {
    const jump = f === tapFrame;
    sim.step(
      DT,
      makeInput({
        right: true,
        jumpPressed: jump,
        // A tap is not an instant release, and jump-cut would otherwise clip the arc.
        jumpHeld: jump || (f > tapFrame && f < tapFrame + hold),
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
/*
 * And the PERCHED badge (Compliance) has to come out of the rail's set for the same
 * reason the drop did, one delivery model later: it stands on the top course of a brick
 * wall, so it has no band at all. Fed to `badgeLowestBox` its authored row becomes an
 * anchor and the "band" lands 155px under the floor — right in code, nonsense as a
 * measurement. What that screen has to prove is the wall's own arithmetic, and it is
 * proved below.
 */
/*
 * …and the CEILING-DROPPED badge (the Workplace) is the fourth model to come out of the
 * rail's set, which is the **fourth time this exact bill has been paid** — rail vs drop,
 * then the screen with no badge at all, then the perch, now this. Fed to
 * `badgeLowestBox` its authored row is the *spotlight's* row (gy 4), so the "band" comes
 * out 201px over a standing head and the rail's small-hop rule fails for being correct.
 *
 * The general form, written down for the fifth delivery: the *question* is always "is it
 * a jump and not a walk-through, and can a one-tap player still take it" — and each
 * delivery answers it with different arithmetic, against its own rest box.
 */
const badged = SCREENS.filter((s) => s.badge);
const railScreens = badged.filter(
  (s) => !isAirdropped(s.badge!) && !isPerched(s.badge!) && !isCeilingDrop(s.badge!),
);
const dropScreens = badged.filter((s) => isAirdropped(s.badge!));
const perchScreens = badged.filter((s) => isPerched(s.badge!));
const ceilingScreens = badged.filter((s) => isCeilingDrop(s.badge!));

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

  describe('the perched badge is a DETOUR, and the detour is the proof', () => {
    /*
     * This badge answers a different question from the other two, and it took three owner
     * notes to get there. The rail asks "can you time a jump" and the air-drop asks "can
     * you be in the right place in time". This one asks **"do you want it?"** — it is two
     * jumps in opposite directions off the main line, and every version that could be
     * collected on the way past was rejected: on a rail, then standing on the floor as a
     * hurdle you had to clear, then one hop up where a single tap took it.
     *
     * So the measurements here are the shape of the detour: out of reach from the ground,
     * inside one jump of the step below it, ignorable by anybody holding forward, and
     * still takeable with the controls a one-tap touch player actually has.
     */
    it('is out of reach from the ground, and inside one jump of its step', () => {
      const jumpRise = (PLAYER.JUMP_VELOCITY * PLAYER.JUMP_VELOCITY) / (2 * PLAYER.GRAVITY);
      expect(perchScreens.length).toBeGreaterThan(0);
      for (const screen of perchScreens) {
        const box = perchBox(screen.badge!);
        const deck = box.y + box.h;
        // Nothing a player can do from the floor reaches it: a full jump off the ground
        // tops out well below the deck the mark stands on.
        expect(GROUND_FEET_Y - jumpRise).toBeGreaterThan(deck);
        // It stands on a solid, that solid floats, and the mark is CENTRED across it
        // (owner call). It used to be parked on the deck's last column; the arithmetic
        // that matters is the same either way — the pickup has to be *on* the deck — so
        // this asserts the centring rather than a column index.
        const support = screen.solids.find(
          (r) =>
            r.gy * RESOLUTION.TILE === deck &&
            r.gx * RESOLUTION.TILE <= box.x &&
            (r.gx + r.w) * RESOLUTION.TILE >= box.x + box.w,
        );
        expect(support, `no deck under the perch on screen ${screen.id}`).toBeTruthy();
        expect(box.x + box.w / 2).toBe((support!.gx + support!.w / 2) * RESOLUTION.TILE);
        expect((support!.gy + support!.h) * RESOLUTION.TILE).toBeLessThan(
          GROUND_FEET_Y - PLAYER.HEIGHT,
        );
        // …and there is a lower, floating step that IS inside a jump of the ground and
        // that the deck is inside a jump of. Without it the deck is decoration.
        const steps = screen.solids.filter(
          (r) =>
            r !== support &&
            r.gy * RESOLUTION.TILE > deck &&
            (r.gy + r.h) * RESOLUTION.TILE < GROUND_FEET_Y - PLAYER.HEIGHT,
        );
        const reachable = steps.filter(
          (r) =>
            r.gy * RESOLUTION.TILE > GROUND_FEET_Y - jumpRise &&
            r.gy * RESOLUTION.TILE - jumpRise < deck,
        );
        expect(reachable.length, `nothing to climb to the perch from on ${screen.id}`)
          .toBeGreaterThan(0);
      }
    });

    it('is ignored by an auto-run player who only ever holds forward', () => {
      // The point of the whole arrangement. Holding right for four seconds walks under both
      // decks and past the mark — a badge nobody can decline is a badge nobody chooses.
      for (const screen of perchScreens) {
        const sim = driveToScreen(screen.id);
        sim.assist.noSetbacks = true;
        for (let f = 0; f < 240; f += 1) sim.step(DT, makeInput({ right: true }));
        expect(sim.powerups.collected).toBe(false);
      }
    });

    it('cannot be taken by a single forward tap, however it is timed', () => {
      // It used to be: one hop off the ground and the mark was yours, which is what the
      // owner called "still too reachable". Sweeping every tap frame proves the deck is
      // genuinely off the forward line now, rather than merely harder.
      for (const screen of perchScreens) {
        for (let tap = 0; tap < 60; tap += 1) {
          expect(oneTapRun(screen.id, tap, 20), `tap ${tap} still takes it`).toBe(false);
        }
      }
    });

    it('IS taken by a player who turns round and jumps the other way', () => {
      /*
       * And optional must not mean impossible on a phone. One-tap auto-run is the default
       * there, which is why that layout keeps a BACK button (`TouchControls.setAutoRun`):
       * the inputs used below — forward, one tap, then left plus a held tap — are exactly
       * the ones a one-thumb player has.
       */
      for (const screen of perchScreens) {
        const sim = driveToScreen(screen.id);
        sim.assist.noSetbacks = true;
        let landed = -1;
        for (let f = 0; f < 240 && !sim.powerups.collected; f += 1) {
          if (f < 38) {
            const jump = f === 8;
            sim.step(
              DT,
              makeInput({ right: true, jumpPressed: jump, jumpHeld: jump || (f > 8 && f < 28) }),
            );
            continue;
          }
          if (landed < 0 && sim.player.onGround) landed = f;
          const g = landed < 0 ? -1 : f - landed;
          const jump = g === 8;
          sim.step(
            DT,
            makeInput({ left: true, jumpPressed: jump, jumpHeld: jump || (g > 8 && g < 32) }),
          );
        }
        expect(sim.powerups.collected, `screen ${screen.id} is unreachable`).toBe(true);
      }
    });
  });

  describe('the ceiling-dropped badge is a WAIT and then a climb', () => {
    /*
     * The fourth delivery's own arithmetic (owner call: the rail is gone and the mark falls
     * out of the first ceiling spotlight onto a cabinet before the partition wall).
     *
     * What it has to prove is a combination of the other three: it is **out of standing
     * reach on a floating cabinet** (the perch's question), it **expires** (the drop's),
     * and it is **visible before it is takeable**, which is this one's own — so the first
     * test here is that standing under it through the whole hold collects nothing. That
     * beat is the mechanic, not a delay: it is what makes being ready for the drop a
     * decision.
     */
    const tile = RESOLUTION.TILE;
    const supportOf = (screen: (typeof ceilingScreens)[number]) =>
      screen.solids.find(
        (r) =>
          r.role?.includes('pedestal') &&
          r.gx <= screen.badge!.gx &&
          r.gx + r.w > screen.badge!.gx,
      );

    it('rests on the top of a FLOATING cabinet, out of standing reach', () => {
      const jumpRise = (PLAYER.JUMP_VELOCITY * PLAYER.JUMP_VELOCITY) / (2 * PLAYER.GRAVITY);
      const standingHead = GROUND_FEET_Y - PLAYER.HEIGHT;
      expect(ceilingScreens.length).toBeGreaterThan(0);
      for (const screen of ceilingScreens) {
        const box = ceilingRestBox(screen.badge!);
        const support = supportOf(screen);
        expect(support, `no cabinet under the drop on screen ${screen.id}`).toBeTruthy();
        // It rests on the cabinet's top face, not somewhere near it.
        expect(box.y + box.h).toBe(support!.gy * tile);
        // Out of reach standing (or it is a walk-through)…
        const lift = standingHead - (box.y + box.h);
        expect(lift).toBeGreaterThan(0);
        // …and inside one jump, with the button held: a solid has to be CLEARED rather
        // than touched, which is why this is measured against 0.9 of the arc and not the
        // rail's 0.5.
        expect(lift).toBeLessThan(jumpRise * 0.9);
        // And the cabinet FLOATS: 36px of air over a standing head, so holding right walks
        // underneath it and declining the badge is possible. Same rule as the perch, and
        // the same reason — a pickup on the path is not a decision.
        expect((support!.gy + support!.h) * tile).toBeLessThanOrEqual(standingHead);
      }
    });

    it('is on the safe side of the partition wall, which is the point of the column', () => {
      // Owner call: "this drops on a cabinet or something which is before the partition
      // wall so the user can take it safely". So the whole transaction happens before the
      // one solid the player has to jump — and the cabinet's right edge has to stay clear
      // of the face a player pins against at that wall, or its underside caps their jump
      // at 36px and the screen is sealed.
      for (const screen of ceilingScreens) {
        const support = supportOf(screen)!;
        const wall = screen.solids.find((r) => r.role?.includes('partition'))!;
        expect(wall).toBeTruthy();
        expect((support.gx + support.w) * tile).toBeLessThanOrEqual(wall.gx * tile);
        const pinnedLeft = wall.gx * tile - PLAYER.WIDTH;
        expect(pinnedLeft).toBeGreaterThanOrEqual((support.gx + support.w) * tile);
      }
    });

    it('is not takeable while it waits in the light, however long you stand there', () => {
      for (const screen of ceilingScreens) {
        const sim = driveToScreen(screen.id);
        const box = ceilingRestBox(screen.badge!);
        // Standing ON the cabinet, in the pickup's own box, for the whole hold.
        const holdFrames = Math.floor(ceilingLandsAt(0) / DT) - 4;
        for (let f = 0; f < holdFrames; f += 1) {
          sim.player.box.x = box.x + (box.w - sim.player.box.w) / 2;
          sim.player.box.y = box.y + box.h - sim.player.box.h;
          sim.step(DT, makeInput());
        }
        expect(sim.badgeBox, 'the mark is takeable before it has fallen').toBeNull();
        expect(sim.powerups.collected).toBe(false);
      }
    });

    it('lands, is takeable for a few seconds, expires, and comes back', () => {
      for (const screen of ceilingScreens) {
        const badge = screen.badge!;
        const cycle = ceilingCycleLength();
        expect(ceilingStateAt(badge, 0).phase).toBe('held');
        expect(ceilingStateAt(badge, ceilingLandsAt(0) + 0.05).phase).toBe('live');
        expect(ceilingStateAt(badge, ceilingLandsAt(0) + POWERUPS.CEILING.LIFETIME + 0.1).phase)
          .toBe('gone');
        // …and the next cycle puts it back in the fitting, so a missed drop costs seconds
        // rather than the capability.
        expect(ceilingStateAt(badge, cycle + 0.05).phase).toBe('held');
        expect(ceilingStateAt(badge, ceilingLandsAt(1) + 0.05).phase).toBe('live');
      }
    });

    it('is ignored by a player who only ever holds forward', () => {
      // The cabinet floats, so an auto-runner walks under it and pins at the partition —
      // through the drop, the whole of its life, and out the other side.
      for (const screen of ceilingScreens) {
        const sim = driveToScreen(screen.id);
        sim.assist.noSetbacks = true;
        const frames = Math.ceil(ceilingCycleLength() / DT);
        for (let f = 0; f < frames; f += 1) sim.step(DT, makeInput({ right: true }));
        expect(sim.powerups.collected).toBe(false);
      }
    });

    it('IS taken by a player who waits for it and then runs at the cabinet', () => {
      /*
       * The move, played with the inputs a one-thumb touch player has: wait, then forward
       * and one held tap at the cabinet's left face. It is deliberately the *forward* jump
       * — unlike the Compliance perch, which needs a turn — because this pickup already
       * costs the player something the others do not: the wait.
       */
      for (const screen of ceilingScreens) {
        const support = supportOf(screen)!;
        const faceX = support.gx * tile;
        const sim = driveToScreen(screen.id);
        sim.assist.noSetbacks = true;
        let hold = 0;
        for (let f = 0; f < 900 && !sim.powerups.collected; f += 1) {
          // Nothing at all until the mark is on its way down: this is the wait.
          const falling = ceilingStateAt(screen.badge!, sim.clock).phase !== 'held';
          const pb = sim.player.box;
          const atFace = pb.x + pb.w >= faceX - 34 && pb.x < faceX;
          if (falling && hold === 0 && atFace && sim.player.onGround) hold = 20;
          sim.step(
            DT,
            makeInput({ right: falling, jumpPressed: hold === 20, jumpHeld: hold > 0 }),
          );
          if (hold > 0) hold -= 1;
        }
        expect(sim.powerups.collected, `screen ${screen.id} is unreachable`).toBe(true);
      }
    });
  });
});
