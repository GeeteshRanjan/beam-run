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

/** The two beats of the stroke during which the head is moving down or held. */
const DESCENDING = S.DROP_TIME + S.HOLD_TIME;

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
  /**
   * Monotonic counters, polled by the host so it can sound a cue exactly once per
   * event without this file ever knowing an AudioEngine exists — the same contract
   * `Dragon.shotsFired` uses, and the reason neither of them is a callback.
   *
   * `_slams` counts strokes that reached the floor, `_deflections` strokes that hit
   * an ANSR-backed player and gave up. They are deliberately the two halves of the
   * screen's argument: the mechanism landing, and the mechanism failing to.
   */
  private _slams = 0;
  private _deflections = 0;
  /** Column centre (px) of the stroke that landed most recently, or null. */
  private _lastSlamAt: number | null = null;

  constructor(stamps: StampSpec[]) {
    this.stamps = stamps.map((s) => ({
      cx: s.gx * T + T / 2,
      e: (((s.phase % 1) + 1) % 1) * S.CYCLE,
      abortE: null,
      abortPress: 0,
    }));
  }

  /**
   * **An ANSR-backed stamp can be stood on** (owner call: "when the player jumps on
   * the stamp he is currently hitting the ground — make it such that the player is
   * standing on the stamp, in the case that he jumps on it with the powerup taken").
   *
   * Unassisted this returns nothing and always did: a stamp you could climb is a
   * stamp you are not timing, and timing them is the screen. Assisted it returns the
   * pressing face, and that is the third thing 1Wrk does on this screen — the
   * mechanism slows down, it cannot press you, and now the thing that used to flatten
   * you holds your weight. Which is the argument the screen makes, as geometry.
   *
   * Three constraints, and every one of them is load-bearing:
   *
   *  · **One-way.** The face is only solid to a player who was already above it, so
   *    walking into a pressed stamp is still a walk-through and the assisted screen
   *    is not quietly given four new walls. A two-way solid here would be a *harder*
   *    screen with the badge than without it, which inverts the whole model — and a
   *    pressed head spans 512-600, i.e. exactly a standing player, so it would have
   *    been four walls rather than four hurdles.
   *  · **Only while it is coming DOWN or held.** A rising solid under a standing body
   *    passes through it — `moveAndCollide` is driven by the player's motion — and the
   *    honest ways round that are both wrong here: carrying the rider would take him
   *    to the parked row at 242 and hand him back on the next slam (a lift he cannot
   *    get off), and pushing him would be the defect. Dropping the solid for the lift
   *    means the stamp simply leaves from under him, which is also the picture.
   *  · **Never while it is retracting.** A stamp backing off a shielded player is
   *    mid-apology; giving it a surface at the same time says two things at once.
   *
   * Nothing can be crushed against it, because a press that meets the player aborts
   * (see `update`) — so the one solid in this game that descends can never descend
   * into anybody.
   */
  solids(player: Player): AABB[] {
    if (!this.slowed) return [];
    const boxes: AABB[] = [];
    const prevBottom = player.box.y + player.box.h;
    for (const s of this.stamps) {
      if (s.abortE !== null || s.e >= DESCENDING) continue;
      const press = this.pressOf(s);
      if (press <= 0) continue;
      const head = this.headBox(s, press);
      if (prevBottom > head.y) continue; // he was not above it: walk through
      boxes.push(head);
    }
    return boxes;
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
      const prevE = s.e;
      s.e += step;
      /*
       * It has hit the floor: the frame the accelerating slam bottoms out, i.e. the
       * clock crossing `DROP_TIME`. Counted *before* the wrap clears the abort, because
       * a stroke that aborted never reached the floor and must not thud — and counted
       * off the clock rather than off `press >= 1`, which is true for the whole hold.
       */
      if (s.abortE === null && prevE < S.DROP_TIME && s.e >= S.DROP_TIME) {
        this._slams += 1;
        this._lastSlamAt = s.cx;
      }
      if (s.e >= S.CYCLE) {
        s.e %= S.CYCLE;
        s.abortE = null; // a fresh cycle starts with a clean stroke
        s.abortPress = 0;
      }
      const press = this.pressOf(s);
      if (press <= 0) continue;
      if (!aabbOverlap(player.box, this.headBox(s, press))) continue;

      if (ctx.assisted) {
        /*
         * Already on its way back up: there is nothing left to call off, so leave the
         * stroke alone. Without this, a player who has just been *standing* on the
         * head drops through it the moment the lift starts (`solids()` hands the
         * platform back at exactly that point), which reads as an overlap and sent
         * the stamp back DOWN again — a stamp that reverses under the person who
         * stepped off it. The rule is the same one the abort itself encodes: a press
         * that cannot happen is not aborted, it is simply not a press.
         */
        if (s.e >= DESCENDING) continue;
        // It cannot press an ANSR-backed player. Back off from right here.
        if (s.abortE === null) {
          s.abortE = s.e;
          s.abortPress = press;
          this._deflections += 1;
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

  /**
   * Strokes that have reached the floor. Never reset — like the dragon's counters it
   * is "how many have happened", and a retry builds a brand new Stamps anyway.
   */
  get slams(): number {
    return this._slams;
  }

  /** Strokes that hit an ANSR-backed player and backed off instead of pressing. */
  get deflections(): number {
    return this._deflections;
  }

  /**
   * Where the most recent stroke came down (px), or null before the first.
   *
   * The host needs it to weight the thud by distance: four columns land every cycle
   * and one volume for all of them is a drum machine rather than a mechanism standing
   * somewhere on the floor.
   */
  get lastSlamAt(): number | null {
    return this._lastSlamAt;
  }
}
