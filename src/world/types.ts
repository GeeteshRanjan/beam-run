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
export type SetbackCause = 'stamp' | 'fire' | 'monster' | 'mummy' | 'fall';

/** Per-step context passed to hazards from the Simulation. */
export interface HazardContext {
  /**
   * The screen's ANSR capability is engaged (its badge has been collected).
   * Each hazard family answers this differently — that is the whole point:
   *  - DENIED stamps slow right down and can no longer press the player;
   *  - the compliance monsters stop scowling, raise the toll arms they were
   *    holding down, and walk off up the maze's own stairs to the landing;
   *  - the Workplace cutter appears, and `shoot` starts doing something;
   *  - the hiring dragon's fire stops being lethal *and* the water cannon appears,
   *    which makes it the only badge that both protects and arms.
   */
  assisted: boolean;
  /** Extra telegraph seconds from the assist menu. */
  extraTelegraph: number;
  /**
   * The shoot button went down this step.
   *
   * Optional because only two hazards have a verb of their own (the Workplace
   * cutter and the hiring dragon's water cannon) and the other two would have to
   * carry a field they ignore. It is an *edge*, not a held state: the sim passes
   * `input.shootPressed` straight through, so a hazard can never auto-fire from a
   * held button.
   */
  shoot?: boolean;
}

/**
 * A hazard family (stamps / maze / workplace / dragon). Each screen has at most one.
 * Hazards are headless and deterministic.
 *
 * The interface used to carry two more optional hooks, `blocksJump` and
 * `jumpMultAt`, so the red-tape sludge could stop the pit being hopped. That
 * hazard is gone (see `Stamps.ts`) and nothing else ever needed them, so they
 * went with it — the reasoning is preserved in `docs/JOURNAL.md`.
 */
export interface Hazard {
  /**
   * Extra collidable AABBs this hazard contributes. None of the four do: even
   * the maze's toll gates are lethal rather than solid, because a solid gate on
   * the only route would make the screen impossible without the badge, and no
   * screen in this game is.
   */
  solids(): AABB[];
  /** Horizontal speed multiplier applied to the player (1 = untouched). */
  speedMultAt(player: Player): number;
  /**
   * Optional: contact with this hazard is harmless once its badge is taken, so
   * the host may draw the player shielded. The DENIED stamps, the compliance maze
   * and the hiring dragon set it; the Workplace deliberately does not, because
   * there the badge makes the obstacle *solvable* rather than harmless, and a
   * shield visual on a screen where contact still costs months would be a lie.
   */
  readonly shieldsPlayer?: boolean;
  /** Advance the hazard; return a setback cause if it costs the player time this step. */
  update(dt: number, player: Player, ctx: HazardContext): SetbackCause | null;
  /** Reset transient state on (re)entry. */
  reset(): void;
}
