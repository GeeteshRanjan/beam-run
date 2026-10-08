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
  /** What this stamp refuses, printed on its index label (see `StampSpec.label`). */
  label: string;
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
  /**
   * What this stamp is refusing, set on its index label — ENTITY, BANKING, TAX,
   * MCA (owner call: the four stamps name the four setup approvals, and DENIED
   * moves onto the rubber die at the bottom).
   *
   * Authored in `levels.json`, carried through here rather than looked up in the
   * renderer, for the same reason the dragon's taunts are: it is the level's content and
   * the picture must have exactly one source for it.
   */
  label: string;
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
      label: s.label ?? 'DENIED',
      e: (((s.phase % 1) + 1) % 1) * S.CYCLE,
      abortE: null,
      abortPress: 0,
    }));
  }

  /**
   * **With the badge, the head is a solid object at every point of its stroke** (owner
   * call: "make the stamps solid — if a user manages to jump on the stamp at any time it
   * should act as an actual solid thing, stop the user as a wall would, and he should be
   * able to stand on it"). This supersedes the earlier rule that it was a one-way
   * platform, only while coming down or held.
   *
   * So, assisted, it is a plain two-way AABB: walking into its side stops you, jumping
   * into its underside bonks you, landing on top stands you on it. What still aborts a
   * stroke is the *stamp's own motion into you* — being pressed from above, which
   * `update` checks after the head has moved. A head that moves with somebody on top
   * carries him (see `carry`), so riding it is never read as being pressed.
   *
   * **Unassisted it is still not solid, on purpose.** A solid stamp without the badge
   * is a far easier screen: walking into a stamp that is down just parks you against
   * its side instead of flattening you, so the only way to be hit is to stand in the
   * column at the instant of the drop, and the tuned reflex test (`HAZARDS.STAMPS.CYCLE`)
   * stops being one. Standing on stamps is what 1Wrk buys; without it a head you touch
   * flattens you, from the side or from above.
   *
   * One exclusion, and it is load-bearing: a head the player is already **inside** is
   * left out. The only way to be inside one is for it to have come down onto you, and
   * `moveAndCollide` resolves an overlap by snapping to the nearest face on the axis you
   * are moving along — i.e. it would teleport a shielded player onto the roof of the
   * stamp that just touched him, or ~100px sideways out of it. Left out, he simply stays
   * put while it retracts off him, which is the picture.
   */
  solids(player: Player): AABB[] {
    if (!this.slowed) return [];
    const boxes: AABB[] = [];
    for (const s of this.stamps) {
      const head = this.headBox(s, this.pressOf(s));
      if (aabbOverlap(player.box, head)) continue;
      boxes.push(head);
    }
    return boxes;
  }
  /**
   * Keep a rider on a moving head. Called after the head has moved from `before` to
   * `after`, before anything checks for a press.
   *
   *  · **Rising:** anybody whose feet were at or above the old top and whose body the
   *    new top now cuts into is lifted onto it — a rising solid cannot pass through a
   *    body standing on (or dropping onto) it. `vy` only loses its downward part, so a
   *    jump already under way keeps its momentum.
   *  · **Falling:** only a player actually standing on it (grounded, feet on the old
   *    top) follows it down; one in the air above it just falls after it and lands.
   *
   * Horizontal overlap is strict, as in `aabbOverlap`, so a player standing flush
   * against the side of a moving head is never picked up by it.
   */
  private carry(player: Player, before: AABB, after: AABB): void {
    if (after.y === before.y) return;
    const b = player.box;
    if (b.x >= after.x + after.w || b.x + b.w <= after.x) return;
    const feet = b.y + b.h;
    if (after.y < before.y) {
      if (feet > before.y + 1 || feet <= after.y) return;
    } else if (!player.onGround || Math.abs(feet - before.y) > 1) {
      return;
    }
    b.y = after.y - b.h;
    if (player.vy > 0) player.vy = 0;
    player.onGround = true;
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
      const before = this.headBox(s, this.pressOf(s));
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
      // Only a solid head can carry anybody; unassisted, the overlap below flattens him.
      if (ctx.assisted) this.carry(player, before, this.headBox(s, press));
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
        label: s.label,
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
