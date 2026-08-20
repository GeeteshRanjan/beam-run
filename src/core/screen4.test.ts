import { describe, it, expect } from 'vitest';
import { makeInput } from './Input';
import { HAZARDS, JOURNEY, POWERUPS, RESOLUTION } from '../data/tuning.config';
import { Dragon } from '../world/Hazards/Dragon';
import { dropLandsAt, dropRestBox } from '../world/badgeDrop';
import {
  DT,
  T,
  driveToScreen,
  engageBadge,
  expireGrace,
  recoverFromLifeLost,
  standAtColumn,
  stepN,
} from '../test/helpers';
import type { Simulation } from './Simulation';

/**
 * Hire Under Fire (screen 4) is a boss screen, and the second build of it (owner
 * call) changed where the boss stands and how the badge arrives:
 *
 *  · the beast **stands on the ground at the far end** and answers with one straight,
 *    growing, slightly diverging **cone** of fire down the lane in front of it. There
 *    are no fireballs and no rolling flame fronts: nothing on this screen travels;
 *  · the badge is **air-dropped** by a drone onto one of three **floating bricks** in
 *    turn and **expires**, so the test is being there in time *and* jumping for it;
 *  · and the old mid-screen hurdle is gone (owner call) — a boss screen did not need
 *    a paper heap to hop.
 */
const D = HAZARDS.DRAGON;

/** Fire the cannon `n` times, respecting the cooldown between shots. */
function spray(sim: Simulation, n: number): void {
  const gap = Math.ceil(D.WATER_COOLDOWN / DT) + 1;
  for (let k = 0; k < n; k += 1) {
    sim.step(DT, makeInput({ shootPressed: true }));
    stepN(sim, gap);
  }
}

/**
 * Beat the dragon: hold position and fire in the gaps between bursts, which is the
 * only time a jet reaches the wearer.
 */
function beatTheDragon(sim: Simulation, dragon: Dragon, maxSteps = 20000): number {
  const gap = Math.ceil(D.WATER_COOLDOWN / DT) + 1;
  let i = 0;
  for (; i < maxSteps && !dragon.isBeaten; i += 1) {
    const shoot = dragon.isVulnerable && i % gap === 0;
    sim.step(DT, makeInput({ shootPressed: shoot }));
  }
  return i * DT;
}

describe('Screen 4 — Hire Under Fire (cross the lane → Talent500 → hire the five)', () => {
  it('is the Talent500 screen, and the dragon roosts beyond every drop', () => {
    const sim = driveToScreen(4);
    expect(sim.screen.name).toBe('Hire Under Fire');
    expect(sim.screen.data.hazard).toBe('dragon');
    expect(sim.screen.data.badge!.type).toBe('EXTINGUISH');
    expect(sim.activeHazard).toBeInstanceOf(Dragon);
    const badge = sim.screen.data.badge!;
    const dragons = sim.screen.data.dragons!;
    expect(dragons).toHaveLength(1);
    // The badge has to be takeable before the obstacle is met — the one instruction
    // the game gives. Every drop column, not just the anchor.
    for (const gx of badge.drops!) expect(dragons[0]!.from).toBeGreaterThan(gx);
    // It holds the END of the screen (owner call), so its roost starts in the last
    // third of the frame and the approach belongs to the player.
    expect(dragons[0]!.from * T).toBeGreaterThan(RESOLUTION.WIDTH * 0.6);
    // Its fronts carry the screen's argument, in bitmap-safe copy.
    expect(dragons[0]!.taunts.length).toBeGreaterThan(1);
    for (const taunt of dragons[0]!.taunts) {
      expect(taunt).toBe(taunt.toUpperCase());
      expect(taunt).not.toContain("'");
    }
  });

  it('has no mid-screen hurdle any more, and ONE floating brick instead', () => {
    const sim = driveToScreen(4);
    /*
     * The paper heap is gone (owner call). What is authored as the screen's own props
     * now is one floating brick per drop column — real geometry the badge lands on — and
     * there is exactly **one** of each (owner call: "remove the 3 brick structures where
     * the ANSR powerup drops, remove the 2 and just keep 1"). Three bricks were three
     * separate promises the drone only ever kept one of per pass.
     */
    expect(sim.screen.data.badge!.drops).toHaveLength(1);
    expect(sim.screen.data.solids.filter((s) => s.role?.includes('hurdle'))).toHaveLength(0);
    const bricks = sim.screen.data.solids.filter((s) => s.role?.includes('pedestal'));
    expect(bricks).toHaveLength(sim.screen.data.badge!.drops!.length);
    // They really collide (they are in the physics list) and the host knows to paint
    // them as props rather than as level material.
    expect(sim.screen.propRects).toHaveLength(bricks.length);
    for (const rect of sim.screen.propRects) expect(sim.screen.solids).toContain(rect);
    // …and each one leaves the corridor under it walkable: a brick a standing player
    // bumps their head on would wall the screen off.
    const standingHead = 15 * T - sim.player.box.h;
    for (const b of bricks) {
      expect((b.gy + b.h) * T).toBeLessThanOrEqual(standingHead);
    }
  });

  it('opens on a guaranteed safe beat: the roar costs nothing, wherever you stand', () => {
    const sim = driveToScreen(4);
    expireGrace(sim);
    const dragon = sim.activeHazard as Dragon;
    expect(dragon.isRoaring).toBe(true);
    const before = sim.months;
    // Stand directly underneath it for the whole roar.
    for (let i = 0; i < Math.ceil((D.ROAR_TIME - 0.1) / DT); i += 1) {
      const box = dragon.dragonState().box;
      sim.player.box.x = box.x + box.w / 2;
      sim.step(DT, makeInput());
    }
    expect(sim.months).toBe(before);
    expect(sim.setbacks).toBe(0);
    expect(sim.state).toBe('PLAYING');
  });

  it('its fire costs months and a life', () => {
    const sim = driveToScreen(4);
    expireGrace(sim);
    const dragon = sim.activeHazard as Dragon;
    const before = sim.months;
    // Stand in the lane, on whatever is burning, until something catches.
    for (let i = 0; i < 6000 && sim.state === 'PLAYING'; i += 1) {
      const f = dragon.fireState();
      if (f) sim.player.box.x = f.target.x - sim.player.box.w / 2;
      sim.step(DT, makeInput());
    }
    expect(sim.months - before).toBe(JOURNEY.SETBACK_MONTHS);
    expect(sim.state).toBe('LIFE_LOST');
    expect(sim.lifeLost?.cause).toBe('fire');
    expect(sim.setbacks).toBe(1);
    expect(sim.lives).toBe(sim.livesTotal - 1);
  });

  it('a lost life restarts the stage with the roar, the suit and the drone back', () => {
    const sim = driveToScreen(4);
    expireGrace(sim);
    const dragon = sim.activeHazard as Dragon;
    for (let i = 0; i < 6000 && sim.state === 'PLAYING'; i += 1) {
      const f = dragon.fireState();
      if (f) sim.player.box.x = f.target.x - sim.player.box.w / 2;
      sim.step(DT, makeInput());
    }
    expect(sim.state).toBe('LIFE_LOST');
    recoverFromLifeLost(sim);
    expect(sim.screenId).toBe(4);
    const retry = sim.activeHazard as Dragon;
    expect(retry.isRoaring).toBe(true);
    expect(retry.layersLeft).toBe(D.HITS_TO_STRIP);
    // …and the delivery starts over, so the badge is on its way again.
    expect(sim.powerups.collected).toBe(false);
    expect(sim.badgeDrop?.phase).toBe('carrying');
  });

  describe('the badge is delivered, and it expires', () => {
    it('is nothing to collect while it is still in the air', () => {
      const sim = driveToScreen(4);
      expect(sim.badgeDrop).not.toBeNull();
      expect(sim.badgeDrop!.phase).toBe('carrying');
      expect(sim.badgeBox).toBeNull();
    });

    it('lands on the first column, on top of its floating brick', () => {
      const sim = driveToScreen(4);
      const badge = sim.screen.data.badge!;
      // Wait for it to land (the clock is the sim's own screen clock).
      while (sim.badgeDrop!.phase !== 'live') sim.step(DT, makeInput());
      const box = sim.badgeBox!;
      expect(box.x + box.w / 2).toBe(badge.drops![0]! * T + T / 2);
      // It comes to rest on the brick's top face, NOT on the floor (owner call), and
      // the brick is a real solid under it.
      expect(box.y + box.h).toBe(badge.restGy! * T);
      expect(box.y + box.h).toBeLessThan(15 * T);
      const brick = sim.screen.data.solids.find(
        (s) => s.role?.includes('pedestal') && s.gx === badge.drops![0],
      );
      expect(brick?.gy).toBe(badge.restGy);

      // …and it cannot be had by standing under it: this is the whole point of the
      // brick. Walking past on the ground touches nothing.
      standAtColumn(sim, badge.drops![0]!);
      sim.step(DT, makeInput());
      expect(sim.powerups.collected).toBe(false);

      // Up on the brick, it is collected.
      sim.player.box.x = box.x;
      sim.player.box.y = box.y;
      sim.step(DT, makeInput());
      expect(sim.powerups.collected).toBe(true);
      expect(sim.activePower?.product).toBe('Talent500');
    });

    it('disappears if it is not taken, and the drone brings another one', () => {
      const sim = driveToScreen(4);
      const badge = sim.screen.data.badge!;
      while (sim.badgeDrop!.phase !== 'live') sim.step(DT, makeInput());
      // Ignore it entirely.
      while (sim.badgeDrop!.phase === 'live') sim.step(DT, makeInput());
      expect(sim.badgeBox).toBeNull();
      expect(sim.powerups.collected).toBe(false);

      // The next delivery arrives — on the same column, because there is only one brick
      // now (owner call): missing a drop costs the player seconds, never the capability.
      while (sim.badgeDrop!.phase !== 'live') sim.step(DT, makeInput());
      expect(sim.badgeDrop!.dropGx).toBe(badge.drops![0]);
      expect(sim.badgeBox).not.toBeNull();
    });

    it('lands in front of a one-tap auto-run player, who can jump it off the brick', () => {
      /*
       * The fairness gate for this whole mechanic, and now the gate for the brick too.
       *
       * On touch the move pad is hidden and the hero runs right on his own, so the
       * badge is only takeable if it lands **ahead** of him — that is what set the
       * drone's speed, and a slower drone dropped it behind him every time. Putting the
       * badge up on a brick (owner call) adds a second requirement: he has to be
       * airborne at the right moment, and he only gets **one pass**, because by the time
       * the second delivery arrives an auto-runner has left the screen.
       *
       * So this is measured the way `badgeReach.test.ts` measures the rail: sweep the
       * frame the single tap happens on and count the ones that work. A contiguous
       * window of at least 0.3s is the budget. If a tuning change shrinks it, the brick
       * has moved too far, not the player.
       */
      const oneTap = (tapFrame: number): boolean => {
        const sim = driveToScreen(4);
        for (let f = 0; f < Math.ceil(6 / DT); f += 1) {
          const jump = f === tapFrame;
          sim.step(
            DT,
            makeInput({
              right: true,
              jumpPressed: jump,
              /*
               * Held for 20 frames (0.33s) after the press, where the rail screens'
               * equivalent holds for 12. That is not a fudge, it is the measurement the
               * brick forces: at a 12-frame hold jump-cut caps the rise at ~115px, and
               * the player arrives at the brick's left face with his feet 5px BELOW its
               * top — so the wall stops him one pixel short of a badge box he is already
               * level with. Clearing the brick needs ~76px of rise *before* reaching it,
               * which needs most of the arc, which needs the button held. A third of a
               * second is still a tap.
               */
              jumpHeld: jump || (f > tapFrame && f < tapFrame + 20),
            }),
          );
          if (sim.powerups.collected) return true;
          if (sim.state !== 'PLAYING') break;
        }
        return false;
      };
      const sim0 = driveToScreen(4);
      const hits: number[] = [];
      for (let tap = 0; tap < 150; tap += 1) if (oneTap(tap)) hits.push(tap);
      expect(hits.length, 'no single tap takes the air-dropped badge').toBeGreaterThan(0);
      expect(hits.length / 60).toBeGreaterThanOrEqual(0.3);
      // …and they are one contiguous window. A scattered set of working taps would mean
      // the arc is only grazing the box.
      expect(hits[hits.length - 1]! - hits[0]! + 1).toBe(hits.length);
      // …and every one of them is inside the FIRST delivery's life, i.e. this is the
      // first drop doing the work rather than a later one happening to intercept him.
      // It has to be: by the time the second drone arrives an auto-runner has left the
      // screen, so on touch there is exactly one chance at this badge.
      const badge = sim0.screen.data.badge!;
      expect(hits[hits.length - 1]! * DT).toBeLessThan(
        dropLandsAt(badge, 0) + POWERUPS.DROP.LIFETIME,
      );
    });

    it('lands ahead of that player rather than on top of him', () => {
      // The other half: "in front of" has to mean a step to walk, not a freebie
      // dropped on his head. A drop that lands on the player is not a decision.
      const sim = driveToScreen(4);
      while (sim.badgeDrop!.phase !== 'live') sim.step(DT, makeInput({ right: true }));
      const gap = sim.badgeBox!.x - (sim.player.box.x + sim.player.box.w);
      expect(gap).toBeGreaterThan(20);
      expect(gap).toBeLessThan(400);
    });

    it('is above a standing head on every drop column', () => {
      // The rule the brick exists to create, checked on all three columns rather than
      // on the one the first delivery happens to use.
      const sim = driveToScreen(4);
      const badge = sim.screen.data.badge!;
      const head = 15 * T - sim.player.box.h;
      for (let n = 0; n < badge.drops!.length; n += 1) {
        expect(dropRestBox(badge, n).y + T).toBeLessThan(head);
      }
    });

    it('is the only screen whose badge is FLOWN in', () => {
      /*
       * Reception (0) is not in this list: it has no badge at all now (owner call), so it
       * reports neither a delivery nor a box, and asserting a pickup exists there would
       * fail for being correct.
       *
       * The Workplace (3) is in the list but only for `badgeDrop`, because it is the one
       * other screen whose badge is **not always collectable**: its mark falls out of a
       * ceiling spotlight and expires (owner call), so `badgeBox` is null for most of
       * every cycle. "There is always a pickup somewhere" is a claim about rails and
       * perches, and it has to say so.
       */
      for (const id of [1, 2, 3, 5]) {
        const sim = driveToScreen(id);
        expect(sim.badgeDrop).toBeNull();
        if (sim.badgeCeiling) continue;
        expect(sim.badgeBox).not.toBeNull();
      }
      const reception = driveToScreen(0);
      expect(reception.screen.data.badge).toBeUndefined();
      expect(reception.badgeDrop).toBeNull();
      expect(reception.badgeBox).toBeNull();
    });
  });

  it('Talent500 raises the halo: the sim reports the player shielded', () => {
    const sim = driveToScreen(4);
    expect(sim.shielded).toBe(false);
    engageBadge(sim);
    expect(sim.shielded).toBe(true);
    expect(sim.activePower?.product).toBe('Talent500');
  });

  it('haloed, no flame on the screen can cost a thing', () => {
    const sim = driveToScreen(4);
    expireGrace(sim);
    engageBadge(sim);
    const dragon = sim.activeHazard as Dragon;
    const before = sim.months;
    // A minute parked on whatever is burning.
    for (let i = 0; i < Math.ceil(60 / DT); i += 1) {
      const f = dragon.fireState();
      if (f) sim.player.box.x = f.target.x - sim.player.box.w / 2;
      sim.step(DT, makeInput());
      if (sim.state !== 'PLAYING') break;
    }
    expect(sim.months).toBe(before);
    expect(sim.setbacks).toBe(0);
    expect(sim.state).toBe('PLAYING');
  });

  it('and the same badge arms the cannon — the shoot button starts doing something', () => {
    const sim = driveToScreen(4);
    const dragon = sim.activeHazard as Dragon;
    standAtColumn(sim, 8);
    // Before the badge the button is dead.
    sim.step(DT, makeInput({ shootPressed: true }));
    expect(dragon.hasCannon).toBe(false);
    expect(dragon.shotsFired).toBe(0);

    engageBadge(sim);
    standAtColumn(sim, 8);
    spray(sim, 1);
    expect(dragon.hasCannon).toBe(true);
    expect(dragon.shotsFired).toBe(1);
  });

  it('four clean jets take the suit off and five candidates land, hired', () => {
    const sim = driveToScreen(4);
    expireGrace(sim);
    engageBadge(sim);
    standAtColumn(sim, 14);
    const dragon = sim.activeHazard as Dragon;
    const seconds = beatTheDragon(sim, dragon);

    expect(dragon.isBeaten).toBe(true);
    expect(dragon.layersLeft).toBe(0);
    expect(dragon.candidateStates()).toHaveLength(D.CANDIDATES);
    // Nothing was charged to the player along the way: the halo held.
    expect(sim.setbacks).toBe(0);
    expect(sim.state).toBe('PLAYING');
    // The measured length of the fight — the figure §7 of the handoff is about.
    expect(seconds).toBeGreaterThan(4);
    expect(seconds).toBeLessThan(20);

    /*
     * …and they WALK OUT of the fallen costume one by one (owner call), so the wait is the
     * whole sequence rather than one fall: the zip, then five staggered walks.
     */
    const allOut =
      D.COSTUME_OPEN + (D.CANDIDATES - 1) * D.CANDIDATE_STAGGER + D.CANDIDATE_WALK_TIME;
    stepN(sim, Math.ceil((allOut + 0.2) / DT));
    for (const c of dragon.candidateStates()) {
      expect(c.landed).toBe(true);
      // They walk, so they are on the ground for every frame of it.
      expect(c.y).toBeCloseTo(15 * T, 5);
    }
    // The empty suit is still lying there at that point, and it goes on its own clock.
    expect(dragon.costumeState()).not.toBeNull();
    stepN(sim, Math.ceil((D.COSTUME_HOLD + D.COSTUME_FADE + 0.2) / DT));
    expect(dragon.costumeState()).toBeNull();
    // …and the environment has come good with them.
    expect(dragon.relief).toBe(1);
  });

  it('is crossable unassisted by reading the lane — nothing here is a wall', () => {
    // No screen in this game is impossible without its badge. Unassisted the dragon
    // cannot be answered at all, so the stage has to be survivable — and this is that
    // claim *played* rather than inferred from the tuning numbers. The policy is the
    // simplest thing a person does: walk right, jump what is rolling at you, and back
    // off from the column while it is pouring.
    const sim = driveToScreen(4);
    const dragon = sim.activeHazard as Dragon;
    /*
     * The policy is the claim, so it is worth stating: **wait just outside the far end
     * of the lane, and commit the moment a burst ends.**
     *
     * That is the only policy the screen's own numbers allow, and working it out is
     * what set them. One gap on its own is 0.95s ≈ 247px against a 325px lethal strip,
     * so a player who only ever walks during the gaps oscillates and never crosses.
     * Gap **plus** wind-up plus the ~0.3s the flame takes to grow out to the far end is
     * ~1.9s ≈ 494px, which clears it with room. So the crossing is one committed run
     * begun on the beat the fire goes out — and the wind-up, which reads as the moment
     * to freeze, is in fact the safest part of the run.
     */
    let laneFar = Number.POSITIVE_INFINITY;
    let committed = false;
    let wasBurning = false;
    let t = 0;
    while (t < 90 && sim.screenId === 4 && sim.state === 'PLAYING') {
      const f = dragon.fireState();
      // The lane is legible from the wind-up onwards: its far end is where to wait.
      if (f) laneFar = Math.min(f.mouth.x, f.target.x);
      const burning = f?.phase === 'burning';
      if (wasBurning && !burning) committed = true;
      wasBurning = burning;
      const px = sim.player.box.x + sim.player.box.w / 2;
      const back = !committed && Number.isFinite(laneFar) && px > laneFar - 36;
      sim.step(DT, makeInput({ right: !back, left: back }));
      t += DT;
    }
    expect(sim.screenId).toBe(5);
    expect(sim.setbacks).toBe(0);
  });

  it('and it is genuinely dangerous: ignoring the lane costs a life', () => {
    // The other half of the same claim, and the half the first build's tuning failed.
    // A run that never reads the floor has to walk into the fire, or taking the badge
    // demonstrates nothing and the boss is decoration.
    const sim = driveToScreen(4);
    expireGrace(sim);
    let t = 0;
    while (t < 30 && sim.screenId === 4) {
      sim.step(DT, makeInput({ right: true }));
      t += DT;
      if (sim.state === 'LIFE_LOST') break;
    }
    expect(sim.state).toBe('LIFE_LOST');
    expect(sim.lifeLost?.cause).toBe('fire');
  });

  it('help never lapses: the suit does not come back on', () => {
    const sim = driveToScreen(4);
    expireGrace(sim);
    engageBadge(sim);
    standAtColumn(sim, 14);
    const dragon = sim.activeHazard as Dragon;
    beatTheDragon(sim, dragon);
    stepN(sim, 900); // 15s — longer than any old timed shield
    expect(dragon.isBeaten).toBe(true);
    expect(dragon.layersLeft).toBe(0);
    expect(sim.shielded).toBe(true);
    expect(sim.activePower?.product).toBe('Talent500');
  });

  it('clearing it books the screen months once', () => {
    const sim = driveToScreen(4);
    expireGrace(sim);
    engageBadge(sim);
    const before = sim.months;
    const base = sim.screen.data.monthsBase!;
    // Walk out of the right-hand side, haloed, so nothing intervenes.
    for (let i = 0; i < 4000 && sim.screenId === 4; i += 1) {
      sim.player.box.x = Math.min(RESOLUTION.WIDTH, sim.player.box.x + 8);
      sim.step(DT, makeInput({ right: true }));
    }
    expect(sim.screenId).toBe(5);
    expect(sim.months).toBe(before + base);
  });
});
