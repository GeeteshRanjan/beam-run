/**
 * Shared world/hazard types. Kept separate from Simulation to avoid import
 * cycles (hazards implement `Hazard`; Simulation orchestrates them).
 */
import type { AABB } from './Physics';
import type { Player } from './Player';

/**
 * What went wrong. These are *setbacks*, not deaths — there are no lives and no
 * game over. Each one books months on the journey clock and pushes the player
 * back a little; the run always continues.
 */
export type SetbackCause = 'delay' | 'fire' | 'gate' | 'spike' | 'fall';

/** Per-step context passed to hazards from the Simulation. */
export interface HazardContext {
  /**
   * The screen's ANSR capability is engaged (its badge has been collected).
   * Each hazard family answers this differently — that is the whole point:
   *  - quicksand ignores it (the laid bridge *is* the relief);
   *  - fire lanes ahead go out for good as you approach;
   *  - approval gates ahead lift for good as you approach;
   *  - spike columns become foreseen (landing spots shown, no setbacks).
   */
  assisted: boolean;
  /** Extra telegraph seconds from the assist menu. */
  extraTelegraph: number;
}

/**
 * A hazard family (quicksand / fire / gates / spikes). Each screen has at most
 * one. Hazards are headless and deterministic.
 */
export interface Hazard {
  /** Extra collidable AABBs this hazard contributes (e.g. the quicksand floor). */
  solids(): AABB[];
  /** Horizontal speed multiplier applied to the player (sludge drag; 1 otherwise). */
  speedMultAt(player: Player): number;
  /**
   * Optional: suppress jumping this step. Only the deep red-tape pit uses it —
   * you cannot leap out of red tape. Without this a player could wade a few
   * tiles and hop the pit, which would quietly falsify the whole point of
   * Screen 1 (that the 1Wrk bridge is what makes the crossing possible).
   */
  blocksJump?(player: Player): boolean;
  /**
   * Optional: scale jump strength this step (1 = normal). The shallow struggle
   * sludge uses it so the wade cannot be hopped over: with a full jump the
   * player cleared the whole zone in one leap and never felt the drag the screen
   * exists to demonstrate.
   */
  jumpMultAt?(player: Player): number;
  /** Advance the hazard; return a setback cause if it costs the player time this step. */
  update(dt: number, player: Player, ctx: HazardContext): SetbackCause | null;
  /** Reset transient state on (re)entry. */
  reset(): void;
}
