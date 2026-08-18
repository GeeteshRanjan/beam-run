/**
 * "DENIED" rubber stamps (Screen 1 — Setup Delays).
 *
 * Owner-specified replacement for the red-tape sludge that used to be here. Two
 * stamps slam down from the top of the frame, then a small wall to hop, then two
 * more doing exactly the same thing. Each pair is authored half a cycle out of
 * phase, so they alternate rapid-fire: one is barely up before the next drops.
 *
 * Each stamp runs its own local clock (not a shared `t` + phase) because an
 * assisted press has to be able to **abort mid-stroke**, which is per-stamp
 * state. The clock is seeded from the authored `phase`, so the alternation is
 * still authored in level data.
 *
 * One cycle:
 *
 *   parked at the ceiling → SLAM (DROP_TIME) → held on the floor (HOLD_TIME)
 *     → lifted (LIFT_TIME) → a beat → wind-up (WARN_TIME) → again
 *
 * A stamp only costs time at the bottom of its stroke: you are flattened by the
 * landing, not brushed by the descent. So the reflex test is "do not be in the
 * column when the drop starts". Two things make that readable rather than
 * guesswork: the ink pad on the floor marks every stamp column permanently, and
 * the last `WARN_TIME` of the beat is a visible wind-up. The wind-up changes
 * nothing about the geometry — it is a tell, so the drop can be anticipated
 * instead of merely survived.
 *
 * Before the badge (struggle) that is the whole screen: two tight windows, a
 * wall, two more.
 *
 * After the badge the verb is SET UP: 1Wrk stands the entity/office/systems up
 * properly, so the approval machinery stops fighting you. Two things change, and
 * neither of them expires:
 *
 *  1. the whole mechanism runs at `ASSIST_TIME_SCALE` — the windows go from
 *     "reflex" to "walk through it";
 *  2. a stamp that touches an ANSR-backed player **cannot press**. It aborts and
 *     retracts from exactly where it made contact (`shieldsPlayer`), which is
 *     what the orange bubble around the player is promising.
 *
 * Distinguished by shape + motion (a wide block on a vertical rail, slamming),
 * not colour: the head is brand grey/slate, never the reserved value orange.
 */
import { RESOLUTION, HAZARDS } from '../../data/tuning.config';
import type { StampSpec } from '../../data/levels';
import { type AABB, aabbOverlap } from '../Physics';
import type { Player } from '../Player';
import type { Hazard, SetbackCause, HazardContext } from '../types';

const T = RESOLUTION.TILE;
const S = HAZARDS.STAMPS;

/** Top of the ground band (row 15) — where a fully pressed stamp lands. */
const GROUND_TOP = 15 * T;
/** Total vertical travel of the head's bottom edge, parked → pressed. */
const TRAVEL = GROUND_TOP - S.REST_BOTTOM;

const BUSY = S.DROP_TIME + S.HOLD_TIME + S.LIFT_TIME;

interface StampEntry {
  /** Column centre (px). */
  cx: number;
  /** Local cycle clock, 0..CYCLE. */
  e: number;
  /** Clock reading when an assisted press aborted this cycle (else null). */
  abortE: number | null;
  /** Press depth at the moment it aborted. */
  abortPress: number;
}

export interface StampState {
  /** Column centre (px). */
  cx: number;
  /** 0 = parked at the ceiling, 1 = pressed flat on the floor. */
  press: number;
  /** Bottom edge of the head (px) — the face that does the pressing. */
  bottomY: number;
  /** True while backing off a player it could not press (assisted). */
  retracting: boolean;
  /** True on the frame range where this stamp is lethal to stand under. */
  pressing: boolean;
  /** 0..1 through the wind-up that precedes the slam (0 at any other time). */
  warn: number;
}

export class Stamps implements Hazard {
  private readonly stamps: StampEntry[];
  /** Contact is harmless once the badge is taken — the host draws the bubble. */
  readonly shieldsPlayer = true;
  private slowed = false;
  /**
   * Where the stamp that flattened the player came down (px), or null.
   *
   * Deliberately **not** cleared by `reset()`: the host paints the flattening
   * beat during LIFE_LOST, which is after the setback has been booked. A retry
   * builds a brand new Stamps anyway (`Simulation.loadScreen`), so this can
   * never leak into the next attempt.
   */
  private _struckAt: number | null = null;

  constructor(stamps: StampSpec[]) {
    this.stamps = stamps.map((s) => ({
      cx: s.gx * T + T / 2,
      e: (((s.phase % 1) + 1) % 1) * S.CYCLE,
      abortE: null,
      abortPress: 0,
    }));
  }

  /** Stamps are hazards, never collidable — you time them, you do not climb them. */
  solids(): AABB[] {
    return [];
  }

  speedMultAt(): number {
    return 1;
  }

  /**
   * How fast the mechanism runs. 1 = the market's own pace; anything less is
   * ANSR (or the assist menu) buying the player time.
   */
  private timeScale(ctx: HazardContext): number {
    let scale = ctx.assisted ? S.ASSIST_TIME_SCALE : 1;
    if (ctx.extraTelegraph > 0) scale *= S.EXTRA_TIME_SCALE;
    return scale;
  }

  /** Press depth 0..1 for one stamp at its current clock reading. */
  private pressOf(s: StampEntry): number {
    if (s.abortE !== null) {
      const back = (s.e - s.abortE) / S.RETRACT_TIME;
      return Math.max(0, s.abortPress * (1 - back));
    }
    if (s.e < S.DROP_TIME) {
      const q = s.e / S.DROP_TIME;
      return q * q; // accelerating: it slams, it does not descend
    }
    if (s.e < S.DROP_TIME + S.HOLD_TIME) return 1;
    if (s.e < BUSY) return 1 - (s.e - S.DROP_TIME - S.HOLD_TIME) / S.LIFT_TIME;
    return 0;
  }

  /** The pressing face's hitbox at a given press depth. */
  private headBox(s: StampEntry, press: number): AABB {
    const bottom = S.REST_BOTTOM + press * TRAVEL;
    return { x: s.cx - S.WIDTH / 2, y: bottom - S.HEAD_H, w: S.WIDTH, h: S.HEAD_H };
  }

  update(dt: number, player: Player, ctx: HazardContext): SetbackCause | null {
    const step = dt * this.timeScale(ctx);
    this.slowed = ctx.assisted;

    for (const s of this.stamps) {
      s.e += step;
      if (s.e >= S.CYCLE) {
        s.e %= S.CYCLE;
        s.abortE = null; // a fresh cycle starts with a clean stroke
        s.abortPress = 0;
      }
      const press = this.pressOf(s);
      if (press <= 0) continue;
      if (!aabbOverlap(player.box, this.headBox(s, press))) continue;

      if (ctx.assisted) {
        // It cannot press an ANSR-backed player. Back off from right here.
        if (s.abortE === null) {
          s.abortE = s.e;
          s.abortPress = press;
        }
        continue;
      }
      this._struckAt = s.cx;
      return 'stamp';
    }
    return null;
  }

  reset(): void {
    for (const s of this.stamps) {
      s.abortE = null;
      s.abortPress = 0;
    }
    this.slowed = false;
  }

  /**
   * 0..1 through the wind-up that precedes the slam. Zero while the stamp is
   * doing anything else, and zero for a stroke that has already aborted (an
   * ANSR-backed player is not being warned about a press that cannot happen).
   */
  private warnOf(s: StampEntry): number {
    if (s.abortE !== null) return 0;
    const from = S.CYCLE - S.WARN_TIME;
    if (s.e < from) return 0;
    return (s.e - from) / S.WARN_TIME;
  }

  /** Per-stamp snapshot for rendering. */
  stampStates(): StampState[] {
    return this.stamps.map((s) => {
      const press = this.pressOf(s);
      return {
        cx: s.cx,
        press,
        bottomY: S.REST_BOTTOM + press * TRAVEL,
        retracting: s.abortE !== null,
        pressing: press >= 1,
        warn: this.warnOf(s),
      };
    });
  }

  /** Every stamp column centre (px) — the ink pads are drawn here, always. */
  get columns(): number[] {
    return this.stamps.map((s) => s.cx);
  }

  /** True while ANSR is holding the mechanism at a walk-through pace. */
  get isSlowed(): boolean {
    return this.slowed;
  }

  /** Where the stamp that flattened the player landed (px), or null. */
  get struckAt(): number | null {
    return this._struckAt;
  }

  /** How many stamps are currently backing off a shielded player. */
  get retractingCount(): number {
    return this.stamps.filter((s) => s.abortE !== null).length;
  }
}
