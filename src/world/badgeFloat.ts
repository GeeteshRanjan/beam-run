/**
 * Where the ANSR badge is *right now*.
 *
 * The badge is no longer a tile you bump into: it drifts along a straight
 * vertical line through a band around its authored anchor. That motion is
 * gameplay, not decoration — the pickup hitbox travels with it — so the
 * simulation and the renderer must never compute it twice. Both call this, with
 * the same simulation clock, and therefore agree exactly.
 *
 * Consequences worth knowing before editing:
 *  - It is a pure function of (anchor, t). No `Math.random()`, no wall clock, so
 *    `step()` stays deterministic and a replay lands the pickup identically.
 *  - It is NOT disabled under `prefers-reduced-motion`. Freezing it would move
 *    the hitbox, which is a rules change, not a comfort setting. (The badge's
 *    glow and label still respect the preference — those are juice.)
 *  - The band is authored so the badge is NEVER reachable from a standing
 *    position: its lowest point clears a standing player's head by ~40px, and
 *    the top of the swing rides just below the ceiling. Taking it is a timed
 *    jump — see `POWERUPS` in tuning.config.ts for the derivation, which is
 *    where the two clearances are measured. Level validation proves reachability
 *    against the lowest point, the easiest phase, using the real Player (so the
 *    jump is part of the proof).
 */
import { RESOLUTION, POWERUPS } from '../data/tuning.config';
import type { BadgeSpec } from '../data/levels';
import type { AABB } from './Physics';

const T = RESOLUTION.TILE;

export interface Point {
  x: number;
  y: number;
}

/** The badge's anchor centre in px (the authored grid cell). */
export function badgeAnchor(badge: BadgeSpec): Point {
  return { x: badge.gx * T + T / 2, y: badge.gy * T + T / 2 };
}

/**
 * Vertical offset from the anchor at simulation time `t` (s).
 *
 * **It starts in the MIDDLE of the rail, rises, and then falls** (owner call,
 * Setup Delays — the only rail screen left). That is `-sin`: offset 0 at t=0,
 * `-FLOAT_AMPLITUDE` (the top) a quarter of a period later, the bottom of the
 * band at three quarters. Not a plain `+sin` — that also starts mid-rail but
 * sinks first, which is the one thing the owner has ruled out twice.
 *
 * **This phase is a fairness change, not a look.** The two earlier shapes and what
 * each one costs, so nobody re-litigates it from the code alone:
 *  - `+cos` (the previous shape) put the badge at the *bottom* of the band on the
 *    frame the screen started, so a forward-only auto-runner took it on the way
 *    past with a 0.35s tap window.
 *  - `-sin` (now) has the mark climbing away as he arrives: his right edge reaches
 *    the column at t=0.40s with the box 255px over his head against a 140px jump,
 *    and the band's bottom does not come back until t=4.80s — by which time a
 *    forward-only run is at the exit. So **no single forward tap can take it**, and
 *    the pickup becomes a decision: stop under the rail (or hold BACK to come back
 *    to it) and jump when it drops — ~3.6s in, measured.
 * Both halves are pinned in `badgeReach.test.ts`. If the owner wants the pass-jump
 * back, the phase is the lever, not the band.
 */
export function badgeFloatOffset(t: number): number {
  const phase = (2 * Math.PI * t) / POWERUPS.FLOAT_PERIOD;
  return -POWERUPS.FLOAT_AMPLITUDE * Math.sin(phase);
}

/** The badge's centre at simulation time `t` (s). */
export function badgeCenter(badge: BadgeSpec, t: number): Point {
  const anchor = badgeAnchor(badge);
  return { x: anchor.x, y: anchor.y + badgeFloatOffset(t) };
}

/** The pickup hitbox — one tile, centred on the badge. */
export function badgeBoxAt(badge: BadgeSpec, t: number): AABB {
  const c = badgeCenter(badge, t);
  return { x: c.x - T / 2, y: c.y - T / 2, w: T, h: T };
}

/**
 * The hitbox at the bottom of the swing: the easiest phase to reach, and so the
 * one level validation proves is reachable from spawn.
 */
export function badgeLowestBox(badge: BadgeSpec): AABB {
  const anchor = badgeAnchor(badge);
  const cy = anchor.y + POWERUPS.FLOAT_AMPLITUDE;
  return { x: anchor.x - T / 2, y: cy - T / 2, w: T, h: T };
}
