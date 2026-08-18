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
export type SetbackCause = 'stamp' | 'fire' | 'gate' | 'spike' | 'fall';

/** Per-step context passed to hazards from the Simulation. */
export interface HazardContext {
  /**
   * The screen's ANSR capability is engaged (its badge has been collected).
   * Each hazard family answers this differently — that is the whole point:
   *  - DENIED stamps slow right down and can no longer press the player;
   *  - fire lanes ahead go out for good as you approach;
   *  - approval gates ahead lift for good as you approach;
   *  - spike columns become foreseen (landing spots shown, no setbacks).
   */
  assisted: boolean;
  /** Extra telegraph seconds from the assist menu. */
  extraTelegraph: number;
}

/**
 * A hazard family (stamps / fire / gates / spikes). Each screen has at most one.
 * Hazards are headless and deterministic.
 *
 * The interface used to carry two more optional hooks, `blocksJump` and
 * `jumpMultAt`, so the red-tape sludge could stop the pit being hopped. That
 * hazard is gone (see `Stamps.ts`) and nothing else ever needed them, so they
 * went with it — the reasoning is preserved in `docs/JOURNAL.md`.
 */
export interface Hazard {
  /** Extra collidable AABBs this hazard contributes. None of the four do today. */
  solids(): AABB[];
  /** Horizontal speed multiplier applied to the player (1 = untouched). */
  speedMultAt(player: Player): number;
  /**
   * Optional: contact with this hazard is harmless once its badge is taken, so
   * the host may draw the player shielded. Only the DENIED stamps set it — a
   * shield visual on a screen where contact still costs months would be a lie.
   */
  readonly shieldsPlayer?: boolean;
  /** Advance the hazard; return a setback cause if it costs the player time this step. */
  update(dt: number, player: Player, ctx: HazardContext): SetbackCause | null;
  /** Reset transient state on (re)entry. */
  reset(): void;
}
