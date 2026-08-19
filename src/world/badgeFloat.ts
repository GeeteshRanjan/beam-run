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
 * **Cosine, not sine, and that is the owner's "it goes up first" (do not flip it
 * back).** A sine started the badge at the *middle* of the band moving DOWN, so
 * the first thing the mark did on entering a screen was sink — and it only
 * reached the bottom of the swing three quarters of a cycle later, which on a
 * one-tap auto-run pass is long after the player has walked past the column.
 *
 * Cosine starts it at `+FLOAT_AMPLITUDE`, i.e. at the **bottom** of the band, and
 * sends it up. So the badge rises first, comes back down, and — the part that
 * matters for fairness — it is at its most reachable on the frame the screen
 * starts, which is the generous end of the change rather than the harsh one
 * (`badgeReach.test.ts` re-proves the one-tap window either way).
 */
export function badgeFloatOffset(t: number): number {
  const phase = (2 * Math.PI * t) / POWERUPS.FLOAT_PERIOD;
  return POWERUPS.FLOAT_AMPLITUDE * Math.cos(phase);
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
