/**
 * Shared world/hazard types. Kept separate from Simulation to avoid import
 * cycles (hazards implement `Hazard`; Simulation orchestrates them).
 */
import type { AABB } from './Physics';
import type { Player } from './Player';

export type DeathCause = 'quicksand' | 'fire' | 'plant' | 'spike' | 'fall';

/** Per-step context passed to hazards from the Simulation. */
export interface HazardContext {
  /** Global Freeze power active (pauses spike motion). */
  freeze: boolean;
  /** Extra telegraph seconds from the assist menu. */
  extraTelegraph: number;
}

/**
 * A hazard family (quicksand / fire / plants / spikes). Each screen has at most
 * one. Hazards are headless and deterministic.
 */
export interface Hazard {
  /** Extra collidable AABBs this hazard contributes (e.g. quicksand floor, resting spikes). */
  solids(): AABB[];
  /** Horizontal speed multiplier applied to the player (quicksand drag; 1 otherwise). */
  speedMultAt(player: Player): number;
  /** Advance the hazard; return a death cause if it kills the player this step. */
  update(dt: number, player: Player, ctx: HazardContext): DeathCause | null;
  /** Reset transient state on (re)entry. */
  reset(): void;
}
