/**
 * Where a CEILING-DROPPED badge is: hanging in a spotlight, or on the cabinet
 * under it, or nowhere (the Workplace only).
 *
 * The fourth and last of the game's delivery models, and the owner's replacement
 * for that screen's rail: "for the powerup remove the rail and add — from the
 * spotlight I just said — an ANSR powerup that falls and stays for a few seconds,
 * and the user has to take it otherwise it's gone, and this happens at regular
 * intervals; and this powerup doesn't drop immediately, it's visible as the user
 * comes to this screen but drops after a few seconds the user has spent in the
 * screen, and this drops on a cabinet or something which is before the partition
 * wall so the user can take it safely but the player has to put in some effort to
 * grab it."
 *
 * So the cycle is four beats, and each one is a different question:
 *
 *  - **`held`** — the mark hangs in the first spotlight's beam, lit and obvious and
 *    completely untakeable. This is the beat the other three deliveries do not have,
 *    and it is the whole reason this one exists: the player *sees the offer* before it
 *    is on the table, so being ready for it is a decision rather than a reaction.
 *  - **`falling`** — it drops straight down the light's own axis onto the overhead
 *    cabinet. Straight down, because the thing it falls from is a fixed fitting; an
 *    arc would say it was thrown.
 *  - **`live`** — it stands on the cabinet and can be jumped for. The cabinet floats
 *    36px over a standing head, so this is the perch's geometry with a clock on it.
 *  - **`gone`** — a beat of nothing, and then it is back in the fitting. Missing one
 *    costs seconds, never the capability.
 *
 * Three properties this file exists to guarantee, the same three every delivery
 * module before it does:
 *
 *  1. **One source of position.** The simulation collides against `ceilingBoxAt` and
 *     the renderer paints from `ceilingStateAt`; there is no second opinion about
 *     where the mark is, so it can never be visible somewhere the collision is not.
 *  2. **Pure and stateless.** A function of (spec, simulation time) — no wall clock,
 *     no stored phase, no `Math.random` — so `step()` stays replayable and a reload
 *     cannot leave a badge halfway down.
 *  3. **The validator reads it too.** "It comes to rest on top of a solid, that solid
 *     floats, and the rest box is out of a standing player's reach" are claims about
 *     `ceilingRestBox`, and a second derivation would make them claims about nothing.
 */
import { RESOLUTION, POWERUPS } from '../data/tuning.config';
import type { BadgeSpec } from '../data/levels';
import type { AABB } from './Physics';

const T = RESOLUTION.TILE;
const C = POWERUPS.CEILING;
/** Top of the ground band — the fallback surface, as in the other two landers. */
const GROUND_TOP = 15 * T;

/** True when this badge falls out of a ceiling fitting rather than floating or flying in. */
export function isCeilingDrop(badge: BadgeSpec): boolean {
  return badge.delivery === 'ceiling';
}

/** One cycle, start to finish: hanging, falling, live, gone. */
export type CeilingPhase = 'held' | 'falling' | 'live' | 'gone';

export interface CeilingView {
  phase: CeilingPhase;
  /** The fitting it hangs in / fell out of (px, centre). Fixed for the whole run. */
  source: { x: number; y: number };
  /** The mark's centre — in the fitting, mid-fall, or resting on the cabinet. */
  badge: { x: number; y: number };
  /**
   * Seconds of life left once it is down (0 in every other phase). The host draws
   * the countdown from this; `POWERUPS.CEILING.WARN_TIME` is when it starts blinking.
   */
  remaining: number;
  /** 0..1 through the current phase, for the shaft, the shadow and the countdown. */
  progress: number;
}

/** Seconds one full cycle takes, including the quiet beat after it. */
export function ceilingCycleLength(): number {
  return C.HOLD + C.FALL_TIME + C.LIFETIME + C.GAP;
}

/** The fitting the mark hangs in — the authored cell, which is the light's own centre. */
export function ceilingSource(badge: BadgeSpec): { x: number; y: number } {
  return { x: badge.gx * T + T / 2, y: badge.gy * T + T / 2 };
}

/** The y the mark's **centre** comes to rest at: on the top face of row `restGy`. */
function restCenterY(badge: BadgeSpec): number {
  const surface = badge.restGy === undefined ? GROUND_TOP : badge.restGy * T;
  return surface - T / 2;
}

/** One tile, centred — every pickup box in the game is this. */
function boxAround(cx: number, cy: number): AABB {
  return { x: cx - T / 2, y: cy - T / 2, w: T, h: T };
}

/** Where the mark **will** be, ignoring time: the validator's and the tests' target. */
export function ceilingRestBox(badge: BadgeSpec): AABB {
  return boxAround(badge.gx * T + T / 2, restCenterY(badge));
}

/** Seconds into the run at which cycle `n` (0-based) puts the mark on the cabinet. */
export function ceilingLandsAt(n: number): number {
  return n * ceilingCycleLength() + C.HOLD + C.FALL_TIME;
}

/**
 * The whole delivery at simulation time `t`.
 *
 * The fall is eased (t²) rather than linear, because something released from a
 * fitting accelerates; a mark descending at one speed reads as being lowered on a
 * wire, which is a different machine doing a different thing.
 */
export function ceilingStateAt(badge: BadgeSpec, t: number): CeilingView {
  const cycle = ceilingCycleLength();
  const n = Math.max(0, Math.floor(t / cycle));
  const u = t - n * cycle;
  const source = ceilingSource(badge);
  const restY = restCenterY(badge);

  if (u < C.HOLD) {
    return {
      phase: 'held',
      source,
      badge: { x: source.x, y: source.y },
      remaining: 0,
      progress: u / C.HOLD,
    };
  }

  const fallU = u - C.HOLD;
  if (fallU < C.FALL_TIME) {
    const p = fallU / C.FALL_TIME;
    return {
      phase: 'falling',
      source,
      // Straight down the fitting's own axis: it fell out of a fixed light.
      badge: { x: source.x, y: source.y + (restY - source.y) * p * p },
      remaining: 0,
      progress: p,
    };
  }

  const liveU = fallU - C.FALL_TIME;
  if (liveU < C.LIFETIME) {
    return {
      phase: 'live',
      source,
      badge: { x: source.x, y: restY },
      remaining: C.LIFETIME - liveU,
      progress: liveU / C.LIFETIME,
    };
  }

  return {
    phase: 'gone',
    source,
    badge: { x: source.x, y: restY },
    remaining: 0,
    progress: 1,
  };
}

/**
 * The pickup hitbox, or null when there is nothing on the cabinet to take.
 *
 * Only ever non-null in the `live` phase: a mark still in the fitting is scenery
 * (and one that could be collected up there would delete the wait, which is the
 * mechanic), and an expired one is gone. This is the single function the simulation
 * collides against, so "is the badge takeable" has one answer per frame.
 */
export function ceilingBoxAt(badge: BadgeSpec, t: number): AABB | null {
  const view = ceilingStateAt(badge, t);
  if (view.phase !== 'live') return null;
  return boxAround(view.badge.x, view.badge.y);
}
