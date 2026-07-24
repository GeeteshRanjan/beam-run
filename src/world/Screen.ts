/**
 * Screen — one fixed-camera screen, built fresh from `levels.json`.
 *
 * Task 3 scope: static solids, spawn, and the exit / win-trigger thresholds,
 * all converted from tile units to internal pixels. Hazards, badge and Growth
 * Points layer in during Tasks 4–9. A Screen is reconstructed on entry and on
 * respawn, so any mutation (e.g. the quicksand placed tile) is naturally reset.
 */
import { RESOLUTION, PLAYER } from '../data/tuning.config';
import { type ScreenData, getScreen } from '../data/levels';
import type { AABB } from './Physics';

const T = RESOLUTION.TILE;

export interface PointPickup {
  id: string;
  x: number;
  y: number;
  collected: boolean;
}

export class Screen {
  readonly data: ScreenData;
  /** Static, non-lethal collidables (ground, walls, platforms). */
  readonly solids: AABB[] = [];
  readonly spawnX: number;
  readonly spawnY: number;
  readonly exitX?: number;
  readonly winTriggerX?: number;
  points: PointPickup[] = [];

  constructor(idOrData: number | ScreenData) {
    this.data = typeof idOrData === 'number' ? getScreen(idOrData) : idOrData;

    for (const s of this.data.solids) {
      // Non-collidable decorative facades (e.g. the Tech Park tower) are skipped.
      if (s.role && s.role.includes('noncollide')) continue;
      this.solids.push({ x: s.gx * T, y: s.gy * T, w: s.w * T, h: s.h * T });
    }

    // Spawn: feet on the top of the given tile, near far-left.
    this.spawnX = this.data.spawn.gx * T;
    this.spawnY = this.data.spawn.gy * T - PLAYER.HEIGHT;

    this.exitX = this.data.exit ? this.data.exit.gx * T : undefined;
    this.winTriggerX = this.data.winTrigger ? this.data.winTrigger.gx * T : undefined;

    this.points = (this.data.points ?? []).map((p, i) => ({
      id: `s${this.data.id}-p${i}`,
      x: p.gx * T + T / 2,
      y: p.gy * T + T / 2,
      collected: false,
    }));
  }

  get id(): number {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }
}
