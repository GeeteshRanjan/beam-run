/**
 * Where a PERCHED badge is: on the top course of a brick wall, and nowhere else.
 *
 * The third of the game's three delivery models, and the simplest by a distance.
 * Four screens hang the mark on a levitating rail (`world/badgeFloat.ts`); Hire
 * Under Fire has it flown in and dropped on a floating brick (`world/badgeDrop.ts`);
 * the Compliance maze has it **standing on a wall** (owner call: "remove the ANSR
 * powerup rail we have and instead make a 4 or 8 brick wall which will have an ANSR
 * powerup on it, so the user can jump and grab it").
 *
 * Why it is a module at all, when the answer is one rectangle:
 *
 *  - **One source of position, like the other two.** The simulation collides against
 *    this box and the renderer paints the mark from the same call, so the pickup can
 *    never be visible somewhere the collision is not — the rule the rail and the drop
 *    both exist to keep, applied to the easy case as well as the hard ones.
 *  - **The validator reads it too.** "It rests on top of a solid, it is out of a
 *    standing player's reach, and it is reachable" are geometric claims about *this*
 *    box, and a second opinion about where the badge sits would make them claims
 *    about nothing.
 *
 * It takes no clock: a perched badge does not move and does not expire. That is the
 * point of it on this screen — the mark is the answer to a whole maze, so the work
 * belongs in the maze rather than in catching a drifting pickup. The rail's actual
 * rule ("a jump, never a walk-through") still holds, and here it holds by
 * construction: the wall is two courses tall, so the mark stands 36px above a
 * standing head and the player has to get on top of the wall to touch it.
 */
import { RESOLUTION } from '../data/tuning.config';
import type { BadgeSpec } from '../data/levels';
import type { AABB } from './Physics';

const T = RESOLUTION.TILE;
/** Top of the ground band — the fallback surface, as in `badgeDrop.ts`. */
const GROUND_TOP = 15 * T;

/** True when this badge stands on a surface rather than floating or arriving. */
export function isPerched(badge: BadgeSpec): boolean {
  return badge.delivery === 'perch';
}

/**
 * The pickup hitbox: one tile, sitting on the top face of row `restGy`.
 *
 * `restGy` is the row whose top it stands on — the same meaning the air-drop gives
 * it — so a wall authored two courses tall at rows 13-14 carries its mark in the tile
 * directly above, 480..520.
 */
export function perchBox(badge: BadgeSpec): AABB {
  const surface = badge.restGy === undefined ? GROUND_TOP : badge.restGy * T;
  return { x: badge.gx * T, y: surface - T, w: T, h: T };
}

/** The mark's centre, for the renderer and for the pickup burst. */
export function perchCenter(badge: BadgeSpec): { x: number; y: number } {
  const box = perchBox(badge);
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}
