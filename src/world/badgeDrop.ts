/**
 * Where an AIR-DROPPED badge is *right now* (Hire Under Fire only).
 *
 * The other five screens hang their badge on a vertical rail and let it drift
 * (`world/badgeFloat.ts`). This screen has it **delivered** (owner call): a flying
 * ANSR supply drone crosses the frame, releases the badge over one of the authored
 * `drops` columns, the badge falls onto the **floating brick** standing there
 * (`restGy`), and it sits up there for a few seconds before it is gone. The player
 * has to be there, and has to jump.
 *
 * That is a different question from the rail's, and deliberately so. The rail asks
 * "can you time a jump" from a fixed place; on the one screen where standing still
 * is how you get burnt, the question is "can you be in the right place in time" —
 * and it is the only badge in the game that can be missed by doing *nothing* rather
 * than by mistiming something. The brick was added on the second pass of this
 * mechanic (owner call): with the badge on the floor, an auto-running player
 * collected it without ever leaving the ground, which made the one pickup with a
 * clock on it the one pickup that asked for nothing.
 *
 * Three properties this file exists to guarantee:
 *
 *  1. **One source of position.** The simulation reads the pickup box from here and
 *     the renderer draws the drone, the parcel and the badge from the same call, so
 *     they cannot disagree. Same invariant as `badgeFloat.ts`, for the same reason:
 *     a pickup whose position is derived twice is a pickup you can see and cannot
 *     take.
 *  2. **Pure and stateless.** It is a function of (spec, simulation time) — no
 *     stored phase, no wall clock, no `Math.random` — so `step()` stays replayable
 *     and a reload cannot leave a drone half way through a delivery. The cycle is a
 *     *fixed* length whichever column is being dropped on, which is what makes
 *     "which drop is this" plain arithmetic: `floor(t / cycle)`.
 *  3. **Never a dead screen.** The drops repeat, in order, for as long as the badge
 *     is uncollected. Missing one costs the player the seconds until the next drone,
 *     not the capability.
 */
import { RESOLUTION, POWERUPS } from '../data/tuning.config';
import type { BadgeSpec } from '../data/levels';
import type { AABB } from './Physics';

const T = RESOLUTION.TILE;
const D = POWERUPS.DROP;
/** Top of the ground band. */
const GROUND_TOP = 15 * T;

/**
 * The y the badge's **centre** comes to rest at.
 *
 * `restGy` is the row whose top face it lands on — the floating brick authored at
 * each drop column (owner call: the badge lands on a brick the player has to jump
 * for, instead of on the floor where an auto-running player walked into it). With no
 * `restGy` it rests on the ground band, which is what this mechanic used to do, and
 * that fallback is what keeps the pure functions here honest for any future screen.
 */
function restCenterY(badge: BadgeSpec): number {
  const surface = badge.restGy === undefined ? GROUND_TOP : badge.restGy * T;
  return surface - T / 2;
}

/** One delivery, start to finish. `gone` is the beat before the next drone. */
export type DropPhase = 'carrying' | 'falling' | 'live' | 'gone';

export interface DropView {
  phase: DropPhase;
  /** Which authored column this delivery is using (grid units). */
  dropGx: number;
  /** The carrier's centre. It crosses the frame whether or not it has released yet. */
  carrier: { x: number; y: number };
  /** True while the badge is still slung under the drone. */
  carrying: boolean;
  /** The badge's centre — under the drone, mid-fall, or resting on the ground. */
  badge: { x: number; y: number };
  /**
   * Seconds of life left once it is down (0 in every other phase). The host draws
   * the countdown from this; `POWERUPS.DROP.WARN_TIME` is when it starts blinking.
   */
  remaining: number;
  /** 0..1 through the current phase, for the drop shadow and the countdown ring. */
  progress: number;
}

/**
 * px the badge hangs below the drone's flight row while it is still slung.
 *
 * 1.4 tiles rather than 0.8: at the shorter length the mark overlapped the hull and
 * the cable had no length at all, so the two read as one object instead of as a
 * machine carrying something.
 */
const SLING = T * 1.4;

/** The badge is a tile, like every other pickup box in the game. */
function boxAround(cx: number, cy: number): AABB {
  return { x: cx - T / 2, y: cy - T / 2, w: T, h: T };
}

/** px the carrier's centre travels from, and to. Off-frame at both ends. */
function carrierSpan(): { from: number; to: number } {
  return { from: -D.MARGIN, to: RESOLUTION.WIDTH + D.MARGIN };
}

/** Seconds one full delivery takes, including the quiet beat after it. */
export function dropCycleLength(): number {
  return D.CROSS_TIME + D.GAP;
}

/**
 * The columns this badge drops on. Defaults to its authored `gx`, so a screen that
 * sets `delivery: "airdrop"` and forgets `drops` still works (and the validator
 * still has one column to check).
 */
function dropColumns(badge: BadgeSpec): number[] {
  return badge.drops?.length ? badge.drops : [badge.gx];
}

/**
 * When, inside its cycle, the drone releases the badge over `dropGx`.
 *
 * Derived from the crossing rather than authored: the drone travels at one speed
 * across the whole frame, so the release is simply the moment it is overhead. That
 * is why a far column is dropped on later in the cycle — which is worth knowing
 * when reading the timings, because it means the *last* authored column gives the
 * player the least warning and the most walking.
 */
export function dropReleaseTime(dropGx: number): number {
  const { from, to } = carrierSpan();
  const x = dropGx * T + T / 2;
  return D.CROSS_TIME * ((x - from) / (to - from));
}

/** Seconds into the run at which delivery `n` (0-based) puts the badge down. */
export function dropLandsAt(badge: BadgeSpec, n: number): number {
  const cols = dropColumns(badge);
  const gx = cols[n % cols.length]!;
  return n * dropCycleLength() + dropReleaseTime(gx) + D.FALL_TIME;
}

/**
 * The whole delivery at simulation time `t`.
 *
 * The parcel's fall is eased (t²) rather than linear, because a crate released
 * from a drone accelerates and a crate that descends at one speed reads as being
 * lowered on a wire — which is a different machine doing a different thing.
 */
export function dropStateAt(badge: BadgeSpec, t: number): DropView {
  const cycle = dropCycleLength();
  const n = Math.max(0, Math.floor(t / cycle));
  const u = t - n * cycle;
  const cols = dropColumns(badge);
  const dropGx = cols[n % cols.length]!;

  const { from, to } = carrierSpan();
  const flightY = badge.gy * T + T / 2;
  const carrierX = from + (to - from) * Math.min(1, Math.max(0, u / D.CROSS_TIME));
  const carrier = { x: carrierX, y: flightY };

  const release = dropReleaseTime(dropGx);
  const dropX = dropGx * T + T / 2;
  const restY = restCenterY(badge);

  if (u < release) {
    // Still slung under it. The badge rides at the drone's own x, so the release
    // reads as a release rather than as a teleport.
    return {
      phase: 'carrying',
      dropGx,
      carrier,
      carrying: true,
      badge: { x: carrierX, y: flightY + SLING },
      remaining: 0,
      progress: u / Math.max(0.0001, release),
    };
  }

  const fallU = u - release;
  if (fallU < D.FALL_TIME) {
    const p = fallU / D.FALL_TIME;
    return {
      phase: 'falling',
      dropGx,
      carrier,
      carrying: false,
      badge: { x: dropX, y: flightY + SLING + (restY - flightY - SLING) * p * p },
      remaining: 0,
      progress: p,
    };
  }

  const liveU = fallU - D.FALL_TIME;
  if (liveU < D.LIFETIME) {
    return {
      phase: 'live',
      dropGx,
      carrier,
      carrying: false,
      badge: { x: dropX, y: restY },
      remaining: D.LIFETIME - liveU,
      progress: liveU / D.LIFETIME,
    };
  }

  return {
    phase: 'gone',
    dropGx,
    carrier,
    carrying: false,
    badge: { x: dropX, y: restY },
    remaining: 0,
    progress: 1,
  };
}

/**
 * The pickup hitbox, or null when there is nothing on the ground to take.
 *
 * Only ever non-null in the `live` phase: a parcel in the air is scenery, and an
 * expired one is gone. This is the single function the simulation collides
 * against, so "is the badge takeable" has exactly one answer per frame.
 */
export function dropBoxAt(badge: BadgeSpec, t: number): AABB | null {
  const view = dropStateAt(badge, t);
  if (view.phase !== 'live') return null;
  return boxAround(view.badge.x, view.badge.y);
}

/** True when this badge is delivered rather than hung on a rail. */
export function isAirdropped(badge: BadgeSpec): boolean {
  return badge.delivery === 'airdrop';
}

/**
 * The resting box of delivery `n` — where the badge *will* lie, ignoring time.
 *
 * The validator's reachability flood needs a target that does not move, the same
 * job `badgeLowestBox` does for the rail. Every authored column gets checked,
 * because a drop the player cannot reach is a badge that does not exist.
 */
export function dropRestBox(badge: BadgeSpec, n = 0): AABB {
  const cols = dropColumns(badge);
  const gx = cols[n % cols.length]!;
  return boxAround(gx * T + T / 2, restCenterY(badge));
}

/** Every authored drop column (defaulted), for validation and tests. */
export function dropColumnsOf(badge: BadgeSpec): readonly number[] {
  return dropColumns(badge);
}
