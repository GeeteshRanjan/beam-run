/**
 * Red-tape sludge (Screen 1 — Setup Delays).
 *
 * Two grades, which is what makes this screen a before/after of one problem:
 *
 *  - **shallow** (`deep: false`) sits flush with the ground band *before* the
 *    badge. It only drags you down — friction you feel, never a setback. This
 *    is the struggle zone: the buyer's current reality.
 *  - **deep** (`deep: true`) is the pit *after* the badge. Standing in it books
 *    a delay after `SINK_SETBACK_TIME` of continuous contact, and it is 7 tiles
 *    wide — past Beam's max jump distance — so the 1Wrk bridge is what makes
 *    the crossing possible. That bridge is the relief.
 *
 * Deliberately ignores `ctx.assisted`: the laid bridge *is* the assistance, so
 * the sludge itself never goes soft (otherwise a player could simply wade the
 * pit and the level would stop meaning anything).
 */
import { RESOLUTION, HAZARDS } from '../../data/tuning.config';
import type { QuicksandRect } from '../../data/levels';
import { type AABB, aabbOverlap, isOnGround } from '../Physics';
import type { Player } from '../Player';
import type { Hazard, SetbackCause, HazardContext } from '../types';

const T = RESOLUTION.TILE;

export interface SludgeRegion {
  box: AABB;
  deep: boolean;
}

export class Quicksand implements Hazard {
  readonly rects: SludgeRegion[];
  private contact = 0;

  constructor(rects: QuicksandRect[]) {
    this.rects = rects.map((r) => ({
      box: { x: r.gx * T, y: r.gy * T, w: r.w * T, h: r.h * T },
      deep: r.deep ?? true,
    }));
  }

  /** All sludge behaves as a soft floor so Beam rests in it instead of falling through. */
  solids(): AABB[] {
    return this.rects.map((r) => r.box);
  }

  /** Every region drags (that is the felt friction). */
  private touching(player: Player, deepOnly: boolean): boolean {
    const boxes = this.rects.filter((r) => !deepOnly || r.deep).map((r) => r.box);
    return this.overlapsAny(player, boxes);
  }
  private overlapsAny(player: Player, boxes: AABB[]): boolean {
    if (boxes.length === 0) return false;
    return isOnGround(player.box, boxes) || boxes.some((b) => aabbOverlap(player.box, b));
  }
  /**
   * The shallow sludge's drag box, raised by `SLUDGE_AIR_HEIGHT` so the air just
   * above the wade drags too. Without this, hop-chaining crossed the zone in a
   * third of the walking time: each hop left the sludge box for most of its arc
   * and regained full acceleration, so the drag the screen exists to demonstrate
   * was optional. (Only the *drag* uses this band; setbacks and the jump damping
   * still require real contact.)
   */
  private shallowDragBoxes(): AABB[] {
    const lift = HAZARDS.QUICKSAND.SLUDGE_AIR_HEIGHT;
    return this.rects
      .filter((r) => !r.deep)
      .map((r) => ({ x: r.box.x, y: r.box.y - lift, w: r.box.w, h: r.box.h + lift }));
  }

  /**
   * Two grades of drag. Shallow sludge is a wade you cannot miss; the deep pit
   * is near-immobilising, which is what makes standing in it feel like the trap
   * it is rather than a slightly slower stroll.
   */
  speedMultAt(player: Player): number {
    if (this.touching(player, true)) return HAZARDS.QUICKSAND.DEEP_WALK_SPEED_MULT;
    return this.overlapsAny(player, this.shallowDragBoxes())
      ? HAZARDS.QUICKSAND.WALK_SPEED_MULT
      : 1;
  }

  /**
   * You cannot leap out of red tape. Deep sludge suppresses jumping, so the pit
   * genuinely cannot be crossed by wading a few tiles and hopping — the bridge
   * is the only way over. (Shallow struggle sludge still allows jumping; it is
   * friction, not a trap.)
   */
  blocksJump(player: Player): boolean {
    return this.touching(player, true);
  }
  /**
   * Shallow sludge also weighs your jumps down. Speed alone was not enough: a
   * full-strength jump carries ~140px, so the wade could be cleared in a single
   * leap (and chained hops skipped whatever length it was). Damped jumps turn
   * that into short, laboured hops — the drag is unavoidable, and it *looks*
   * like struggling rather than just reading as a smaller number.
   */
  jumpMultAt(player: Player): number {
    return this.touching(player, false) ? HAZARDS.QUICKSAND.SLUDGE_JUMP_MULT : 1;
  }

  update(dt: number, player: Player, _ctx: HazardContext): SetbackCause | null {
    if (this.touching(player, true)) {
      this.contact += dt;
      if (this.contact >= HAZARDS.QUICKSAND.SINK_SETBACK_TIME) {
        this.contact = 0; // booked — do not immediately re-book on the next step
        return 'delay';
      }
    } else {
      this.contact = 0;
    }
    return null;
  }

  reset(): void {
    this.contact = 0;
  }

  /** 0..1 sink progress for rendering (cosmetic). */
  get sinkProgress(): number {
    return Math.max(0, Math.min(1, this.contact / HAZARDS.QUICKSAND.SINK_SETBACK_TIME));
  }
}
