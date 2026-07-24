/**
 * Quicksand (Screen 1 — Setup Delays).
 *
 * Maps to the pain of slow, uncertain GCC setup. The quicksand acts as a soft
 * floor: Beam lands on it rather than dropping straight through, but standing
 * in it drags movement and, after `SINK_KILL_TIME` of continuous contact, is
 * lethal. Because the drag makes crossing the 7-tile pit take longer than the
 * kill window, the pit is uncrossable without the badge — which lays a
 * permanent flush bridge ("setup solved once"). See GDD §5.
 */
import { RESOLUTION, HAZARDS } from '../../data/tuning.config';
import type { QuicksandRect } from '../../data/levels';
import { type AABB, aabbOverlap, isOnGround } from '../Physics';
import type { Player } from '../Player';
import type { Hazard, DeathCause, HazardContext } from '../types';

const T = RESOLUTION.TILE;

export class Quicksand implements Hazard {
  readonly regions: AABB[];
  private contact = 0;

  constructor(rects: QuicksandRect[]) {
    this.regions = rects.map((r) => ({ x: r.gx * T, y: r.gy * T, w: r.w * T, h: r.h * T }));
  }

  /** The quicksand body is a soft floor so Beam rests on top instead of falling through. */
  solids(): AABB[] {
    return this.regions;
  }

  private inContact(player: Player): boolean {
    // Standing on the surface (1px probe) OR sunk into the body.
    return (
      isOnGround(player.box, this.regions) || this.regions.some((r) => aabbOverlap(player.box, r))
    );
  }

  speedMultAt(player: Player): number {
    return this.inContact(player) ? HAZARDS.QUICKSAND.WALK_SPEED_MULT : 1;
  }

  update(dt: number, player: Player, _ctx: HazardContext): DeathCause | null {
    if (this.inContact(player)) {
      this.contact += dt;
      if (this.contact >= HAZARDS.QUICKSAND.SINK_KILL_TIME) return 'quicksand';
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
    return Math.max(0, Math.min(1, this.contact / HAZARDS.QUICKSAND.SINK_KILL_TIME));
  }
}
