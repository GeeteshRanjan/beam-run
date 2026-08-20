/**
 * Screen — one fixed-camera screen, built fresh from `levels.json`.
 *
 * Static solids, spawn, and the exit / win-trigger thresholds, all converted
 * from tile units to internal pixels. A Screen is reconstructed on entry and
 * whenever a life is lost, so any mutation (e.g. the quicksand placed tile) is
 * naturally reset.
 *
 * There are no collectible pickups here. The Growth Points that used to be
 * scattered across every screen are gone (owner call): they were a second score
 * competing with the only figure that matters, and picking them up said nothing
 * about ANSR. The badge is now the one thing on a screen worth reaching for, and
 * it lives in level data, not here.
 */
import { RESOLUTION, PLAYER } from '../data/tuning.config';
import { type ScreenData, getScreen } from '../data/levels';
import type { AABB } from './Physics';

const T = RESOLUTION.TILE;

export class Screen {
  readonly data: ScreenData;
  /** Static, non-lethal collidables (ground, walls, platforms). */
  readonly solids: AABB[] = [];
  /**
   * The subset of `solids` the screen's own render module paints as a **prop**
   * rather than as level material (role `pedestal`).
   *
   * Same objects, by reference, so nothing is derived twice: they collide like any
   * other solid and the host simply skips them when it lays the brickwork. The ones
   * on Hire Under Fire it is the single floating brick the badge is dropped onto (there were three;
   * the owner removed two on the pass that slowed the drone down) —
   * level material would draw them as lumps of scorched ground hanging in the air,
   * and the whole point of them is that they are placed blocks with a pickup on top.
   */
  readonly propRects: AABB[] = [];
  readonly spawnX: number;
  readonly spawnY: number;
  readonly exitX?: number;
  readonly winTriggerX?: number;

  constructor(idOrData: number | ScreenData) {
    this.data = typeof idOrData === 'number' ? getScreen(idOrData) : idOrData;

    for (const s of this.data.solids) {
      // Non-collidable decorative facades (e.g. the Tech Park tower) are skipped.
      if (s.role && s.role.includes('noncollide')) continue;
      const box: AABB = { x: s.gx * T, y: s.gy * T, w: s.w * T, h: s.h * T };
      this.solids.push(box);
      if (s.role?.includes('pedestal')) this.propRects.push(box);
    }

    // Spawn: feet on the top of the given tile, near far-left.
    this.spawnX = this.data.spawn.gx * T;
    this.spawnY = this.data.spawn.gy * T - PLAYER.HEIGHT;

    this.exitX = this.data.exit ? this.data.exit.gx * T : undefined;
    this.winTriggerX = this.data.winTrigger ? this.data.winTrigger.gx * T : undefined;
  }

  get id(): number {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }
}
