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
  it('contributes no solids and never drags — you time it, you do not climb it', () => {
    expect(stamps().solids()).toEqual([]);
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
    let warnEndedBeforeDrop = false;
    for (let i = 0; i < CYCLE_STEPS + 8; i += 1) {
      h.update(DT, clear, CTX);
      const s = h.stampStates()[0]!;
      if (s.warn > 0) {
        warnedFrames += 1;
        if (s.press > 0) warnedWhileMoving += 1;
      }
      // The wind-up must run right up to the drop: it ends as the press begins.
      if (lastWarn > 0.8 && s.warn === 0 && s.press > 0) warnEndedBeforeDrop = true;
      lastWarn = s.warn;
    }
    expect(warnedFrames).toBeCloseTo(Math.round(S.WARN_TIME / DT), -1);
    expect(warnedWhileMoving).toBe(0); // never while it is already moving
    expect(warnEndedBeforeDrop).toBe(true);
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
    // They take turns — never both flat at once — and there is never a frame where
    // both are idle: one is always pressing, lifting or winding up.
    expect(bothDown).toBe(0);
    expect(bothQuiet).toBe(0);
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

  it('reset() clears aborted strokes for a fresh attempt', () => {
    const h = stamps();
    const p = underStamp();
    run(h, p, 40, ASSISTED);
    expect(h.retractingCount).toBeGreaterThan(0);
    h.reset();
    expect(h.retractingCount).toBe(0);
    expect(h.isSlowed).toBe(false);
  });
});
