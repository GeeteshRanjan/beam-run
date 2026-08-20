import { describe, it, expect } from 'vitest';
import { Stamps } from './Stamps';
import { Player } from '../Player';
import { LOOP, HAZARDS, RESOLUTION } from '../../data/tuning.config';
import type { HazardContext } from '../types';

const DT = LOOP.FIXED_DT;
const T = RESOLUTION.TILE;
const S = HAZARDS.STAMPS;
const CTX: HazardContext = { assisted: false, extraTelegraph: 0 };
const ASSISTED: HazardContext = { assisted: true, extraTelegraph: 0 };

const CYCLE_STEPS = Math.ceil(S.CYCLE / DT);

/** One stamp at col 8, parked at the top of its cycle. */
function stamps(): Stamps {
  return new Stamps([{ gx: 8, phase: 0 }]);
}

/** The authored pair: half a cycle apart, four tiles apart. */
function pair(): Stamps {
  return new Stamps([
    { gx: 8, phase: 0 },
    { gx: 12, phase: 0.5 },
  ]);
}

/** Beam standing on the ground directly under the col-8 stamp. */
function underStamp(): Player {
  return new Player(8 * T + T / 2 - 14, 15 * T - 44);
}

/** Run the hazard for `n` steps and return the first cause it books. */
function run(h: Stamps, p: Player, n: number, ctx: HazardContext = CTX): string | null {
  for (let i = 0; i < n; i += 1) {
    const cause = h.update(DT, p, ctx);
    if (cause) return cause;
  }
  return null;
}

describe('Stamps (DENIED rubber stamps)', () => {
  it('contributes no solids UNASSISTED and never drags — you time it, you do not climb it', () => {
    expect(stamps().solids(underStamp())).toEqual([]);
    expect(stamps().speedMultAt()).toBe(1);
  });

  it('slams down from the top of the frame and returns to it', () => {
    const h = stamps();
    const clear = new Player(28 * T, 15 * T - 44); // nowhere near the column
    let lowest = -Infinity;
    let highest = Infinity;
    for (let i = 0; i < CYCLE_STEPS; i += 1) {
      h.update(DT, clear, CTX);
      const s = h.stampStates()[0]!;
      lowest = Math.max(lowest, s.bottomY);
      highest = Math.min(highest, s.bottomY);
    }
    // Parked well inside the top of the frame, pressed flat on the ground band.
    expect(highest).toBeCloseTo(S.REST_BOTTOM, 0);
    expect(lowest).toBeCloseTo(15 * T, 0);
  });

  it('winds up before it slams, and only then', () => {
    // The slam is 0.14s — far too fast to react to — so the tell before it is
    // what makes the screen a test rather than a coin flip.
    const h = stamps();
    const clear = new Player(28 * T, 15 * T - 44);
    let warnedFrames = 0;
    let warnedWhileMoving = 0;
    let lastWarn = 0;
    /**
     * Frames left to see a press after the wind-up has finished.
     *
     * This used to demand the press on the *very next* frame, which passed for a
     * reason that had nothing to do with the mechanism: at the old CYCLE of 1.8 the
     * accumulated clock reached 1.7999999999999985 after 108 steps, so it never
     * landed on the wrap exactly. `CYCLE / DT` is a whole 84 at 1.4, the clock does
     * land on it, and at `e === 0` the press is 0 *by definition* (it is the instant
     * the drop begins). So the honest claim is "the wind-up runs into the drop with
     * no idle gap", allowing the single wrap frame — 16ms — rather than "the next
     * frame is already pressing".
     */
    let dropDue = 0;
    let idleGapAfterWarn = false;
    let warnRanIntoDrop = false;
    for (let i = 0; i < CYCLE_STEPS + 8; i += 1) {
      h.update(DT, clear, CTX);
      const s = h.stampStates()[0]!;
      if (s.warn > 0) {
        warnedFrames += 1;
        if (s.press > 0) warnedWhileMoving += 1;
      }
      if (dropDue > 0) {
        if (s.press > 0) {
          warnRanIntoDrop = true;
          dropDue = 0;
        } else if (--dropDue === 0) {
          idleGapAfterWarn = true;
        }
      }
      // The wind-up must run right up to the drop: it ends as the press begins.
      if (lastWarn > 0.8 && s.warn === 0 && dropDue === 0 && !warnRanIntoDrop) {
        if (s.press > 0) warnRanIntoDrop = true;
        else dropDue = 2;
      }
      lastWarn = s.warn;
    }
    expect(warnedFrames).toBeCloseTo(Math.round(S.WARN_TIME / DT), -1);
    expect(warnedWhileMoving).toBe(0); // never while it is already moving
    expect(warnRanIntoDrop).toBe(true);
    expect(idleGapAfterWarn).toBe(false);
  });

  it('flattens anything standing under it when it lands', () => {
    expect(run(stamps(), underStamp(), CYCLE_STEPS + 4)).toBe('stamp');
  });

  it('records where the strike landed, so the host can paint the flattening', () => {
    const h = stamps();
    expect(h.struckAt).toBeNull();
    run(h, underStamp(), CYCLE_STEPS + 4);
    expect(h.struckAt).toBeCloseTo(8 * T + T / 2, 5);
    // Survives reset() on purpose: the setback books first, the life-lost frames
    // are painted after, and a retry builds a brand new Stamps anyway.
    h.reset();
    expect(h.struckAt).toBeCloseTo(8 * T + T / 2, 5);
  });

  it('is harmless to anyone standing clear of its column', () => {
    const beside = new Player(8 * T + T / 2 + S.WIDTH, 15 * T - 44);
    expect(run(stamps(), beside, CYCLE_STEPS * 3)).toBeNull();
  });

  it('is lethal at the bottom of its stroke, not for the whole cycle', () => {
    // Standing in the column for a full cycle: it must cost time (the landing
    // lands) but the column has to be passable for most of the cycle, or the
    // screen would be a wall rather than a rhythm.
    const h = stamps();
    const p = underStamp();
    let lethalFrames = 0;
    for (let i = 0; i < CYCLE_STEPS; i += 1) {
      if (h.update(DT, p, CTX)) lethalFrames += 1;
    }
    expect(lethalFrames).toBeGreaterThan(0);
    expect(lethalFrames).toBeLessThan(CYCLE_STEPS * 0.45);
  });

  it('alternates rapid-fire: barely a beat between one lifting and the next dropping', () => {
    const h = pair();
    const clear = new Player(28 * T, 15 * T - 44);
    let bothDown = 0;
    let bothQuiet = 0;
    const quiet = (s: { press: number; warn: number }) => s.press === 0 && s.warn === 0;
    for (let i = 0; i < CYCLE_STEPS; i += 1) {
      h.update(DT, clear, CTX);
      const [a, b] = h.stampStates();
      if (a!.pressing && b!.pressing) bothDown += 1;
      if (quiet(a!) && quiet(b!)) bothQuiet += 1;
    }
    /*
     * They take turns — never both flat at once — and there is (all but) never a
     * frame where both are idle: one is always pressing, lifting or winding up.
     *
     * "All but" is one frame, and it is the same wrap artefact the wind-up test
     * documents. `CYCLE` is a whole 84 frames and half of it a whole 42, so the
     * trailing stamp's clock lands exactly on its own wrap, where `press` is 0
     * because that is the instant its drop begins. 16ms of both stamps reading
     * idle is invisible; asserting zero here only ever passed because the old 1.8
     * cycle could not be reached exactly in floating point.
     */
    expect(bothDown).toBe(0);
    expect(bothQuiet).toBeLessThanOrEqual(1);
  });

  describe('assisted (1Wrk stands the setup up)', () => {
    it('runs the whole mechanism way down, so the windows go wide', () => {
      const h = stamps();
      const clear = new Player(28 * T, 15 * T - 44);
      const slow = stamps();
      for (let i = 0; i < 20; i += 1) {
        h.update(DT, clear, CTX);
        slow.update(DT, clear, ASSISTED);
      }
      // Same elapsed real time, a fraction of the travel.
      const fast = h.stampStates()[0]!.bottomY - S.REST_BOTTOM;
      const eased = slow.stampStates()[0]!.bottomY - S.REST_BOTTOM;
      expect(eased).toBeLessThan(fast * 0.5);
      expect(slow.isSlowed).toBe(true);
    });

    it('cannot press an ANSR-backed player — it retracts from where it touched', () => {
      const h = stamps();
      const p = underStamp();
      // Long enough for several assisted cycles: it must never book anything.
      expect(run(h, p, Math.ceil(CYCLE_STEPS / S.ASSIST_TIME_SCALE) * 3, ASSISTED)).toBeNull();
      expect(h.struckAt).toBeNull();
    });

    it('the abort is visible: the stamp is marked as retracting and backs off', () => {
      const h = stamps();
      const p = underStamp();
      let sawRetract = false;
      let peak = 0;
      // Stop short of the wrap: a new cycle deliberately starts a clean stroke,
      // so the abort flag is only observable within the cycle that aborted.
      const steps = Math.floor((CYCLE_STEPS / S.ASSIST_TIME_SCALE) * 0.6);
      for (let i = 0; i < steps; i += 1) {
        h.update(DT, p, ASSISTED);
        const s = h.stampStates()[0]!;
        if (s.retracting) sawRetract = true;
        peak = Math.max(peak, s.press);
      }
      expect(sawRetract).toBe(true);
      expect(h.retractingCount).toBeGreaterThan(0);
      // It never completes the press: the stroke stops on contact.
      expect(peak).toBeLessThan(1);
    });

    it('declares itself a shielding hazard, so the host may draw the bubble', () => {
      expect(stamps().shieldsPlayer).toBe(true);
    });

    /*
     * The third thing 1Wrk does on this screen (owner call): a stamp you have jumped
     * onto holds your weight instead of dropping you on the floor.
     *
     * Every one of these says the same thing from a different side — the platform is
     * only there for somebody who was **above** it, and only while the head is coming
     * down or held. Both halves are the fairness of it: two-way, four pressed heads
     * would be four walls across a screen the badge is supposed to make *easier*
     * (a pressed head spans 512-600, i.e. exactly a standing player); solid on the
     * way up, it would carry a rider to the parked row and hand him back on the next
     * slam.
     */
    describe('and it can be stood on', () => {
      const clear = () => new Player(28 * T, 15 * T - 44);
      /** Assisted seconds into the stroke, with nobody in the column. */
      const driveTo = (h: Stamps, e: number): void => {
        const step = DT * S.ASSIST_TIME_SCALE;
        const away = clear();
        for (let i = 0; i < Math.ceil(e / step); i += 1) h.update(DT, away, ASSISTED);
      };
      /** A player whose feet are exactly on the col-8 head at the given press. */
      const standingOn = (press: number): Player => {
        const top = S.REST_BOTTOM + press * (15 * T - S.REST_BOTTOM) - S.HEAD_H;
        return new Player(8 * T + T / 2 - 14, top - 44);
      };

      it('offers the pressing face as a platform once the head is down', () => {
        const h = stamps();
        driveTo(h, S.DROP_TIME + S.HOLD_TIME * 0.5); // held flat on the floor
        const boxes = h.solids(standingOn(1));
        expect(boxes).toHaveLength(1);
        expect(boxes[0]!.w).toBe(S.WIDTH);
        expect(boxes[0]!.h).toBe(S.HEAD_H);
        // The platform IS the hitbox — the same face that would have flattened him.
        expect(boxes[0]!.y + boxes[0]!.h).toBeCloseTo(15 * T, 0);
      });

      it('is one-way: a player at ground level walks straight through it', () => {
        const h = stamps();
        driveTo(h, S.DROP_TIME + S.HOLD_TIME * 0.5);
        // Standing on the floor in the stamp's own column — the walk-through the
        // assisted screen has always promised.
        expect(h.solids(underStamp())).toEqual([]);
      });

      it('is not a platform while the head is on its way back up', () => {
        const h = stamps();
        driveTo(h, S.DROP_TIME + S.HOLD_TIME + S.LIFT_TIME * 0.5);
        expect(h.stampStates()[0]!.press).toBeGreaterThan(0);
        expect(h.stampStates()[0]!.press).toBeLessThan(1);
        expect(h.solids(standingOn(1))).toEqual([]);
      });

      it('is not a platform while it is backing off a shielded player', () => {
        const h = stamps();
        const p = underStamp();
        run(h, p, Math.ceil(S.DROP_TIME / S.ASSIST_TIME_SCALE / DT) + 8, ASSISTED);
        expect(h.retractingCount).toBe(1);
        expect(h.solids(standingOn(0.9))).toEqual([]);
      });

      it('does not reverse the stroke when the rider drops off during the lift', () => {
        /*
         * The lift hands the platform back, so a rider overlaps the head for a frame or
         * two on his way down. That used to read as "it touched the player", abort the
         * stroke and send the head back DOWN — a stamp reversing under the person who
         * had just stepped off it.
         */
        const h = stamps();
        driveTo(h, S.DROP_TIME + S.HOLD_TIME + S.LIFT_TIME * 0.2);
        const before = h.stampStates()[0]!.press;
        const rider = standingOn(1); // now overlapping the rising head
        for (let i = 0; i < 4; i += 1) h.update(DT, rider, ASSISTED);
        expect(h.retractingCount).toBe(0);
        expect(h.stampStates()[0]!.press).toBeLessThan(before);
      });
    });
  });

  it('the extra-reaction-time assist slows it further still', () => {
    const clear = new Player(28 * T, 15 * T - 44);
    const eased = stamps();
    const plain = stamps();
    // Sampled mid-slam, where the two have visibly diverged.
    for (let i = 0; i < 6; i += 1) {
      eased.update(DT, clear, { assisted: false, extraTelegraph: 0.25 });
      plain.update(DT, clear, CTX);
    }
    expect(eased.stampStates()[0]!.bottomY).toBeLessThan(plain.stampStates()[0]!.bottomY);
  });

  describe('audio counters (the host polls them; the hazard stays headless)', () => {
    it('counts one slam per stroke, on the frame it reaches the floor', () => {
      const h = stamps();
      const clear = new Player(28 * T, 15 * T - 44);
      expect(h.slams).toBe(0);
      // Up to the frame before the die bottoms out: nothing has landed yet.
      const toFloor = Math.floor(S.DROP_TIME / DT);
      for (let i = 0; i < toFloor; i += 1) h.update(DT, clear, CTX);
      expect(h.slams).toBe(0);
      h.update(DT, clear, CTX);
      expect(h.slams).toBe(1);
      // …and it stays at one for the whole hold, the lift and the park. A counter that
      // read `press >= 1` instead would fire every frame the die was on the floor.
      for (let i = 0; i < CYCLE_STEPS - toFloor - 2; i += 1) h.update(DT, clear, CTX);
      expect(h.slams).toBe(1);
      // One per stroke, on the pair too.
      const two = pair();
      for (let i = 0; i < CYCLE_STEPS * 2; i += 1) two.update(DT, clear, CTX);
      expect(two.slams).toBe(4);
    });

    it('a stroke refused by an ANSR-backed player deflects instead of landing', () => {
      const h = stamps();
      const p = underStamp();
      run(h, p, Math.ceil(S.DROP_TIME / S.ASSIST_TIME_SCALE / DT) + 8, ASSISTED);
      // The muffled thud sounds once for the stroke, not once per frame of the back-off…
      expect(h.deflections).toBe(1);
      // …and the stroke that gave up never reaches the floor, so it must not also thud.
      expect(h.slams).toBe(0);
    });
  });

  it('reset() clears aborted strokes for a fresh attempt', () => {
    const h = stamps();
    const p = underStamp();
    /*
     * Long enough for the assisted stroke to actually reach a standing head, DERIVED
     * rather than guessed: the die has to fall ~84% of its travel to touch him, which
     * is most of `DROP_TIME`, and the assisted clock stretches that by
     * `1 / ASSIST_TIME_SCALE`. A hardcoded 40 frames was 0.17s of hazard time at the
     * old 0.26 scale and only 0.12s at 0.18 — three frames short of contact, so the
     * test failed for a reason that had nothing to do with `reset()`.
     */
    run(h, p, Math.ceil(S.DROP_TIME / S.ASSIST_TIME_SCALE / DT) + 8, ASSISTED);
    expect(h.retractingCount).toBeGreaterThan(0);
    h.reset();
    expect(h.retractingCount).toBe(0);
    expect(h.isSlowed).toBe(false);
  });
});
