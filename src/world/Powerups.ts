/**
 * Powerups — the ANSR "badge" system.
 *
 * Each badge behaves structurally differently so the metaphor lands (GDD §4):
 *  - PLACE_TILE (Setup Delays): permanently lays a solid bridge — "solved once".
 *    No timer; cleared only on respawn (re-collect required).
 *  - FIRE_SHIELD / PASS_THROUGH / FREEZE: timed enablers with a duration.
 *
 * Orange (the "value" accent) is reserved for the active-power indicator.
 */
import { POWERUPS } from '../data/tuning.config';
import type { BadgeSpec, BadgeType } from '../data/levels';
import { RESOLUTION } from '../data/tuning.config';
import type { AABB } from './Physics';
import type { DeathCause } from './types';

const T = RESOLUTION.TILE;

const DURATION: Partial<Record<BadgeType, number>> = {
  FIRE_SHIELD: POWERUPS.FIRE_SHIELD.duration,
  PASS_THROUGH: POWERUPS.PASS_THROUGH.duration,
  FREEZE: POWERUPS.FREEZE.duration,
};

export interface ActivePowerView {
  type: BadgeType;
  name: string;
  remaining: number;
  duration: number;
}

const POWER_NAME: Record<BadgeType, string> = {
  PLACE_TILE: 'Bridge',
  FIRE_SHIELD: 'Fire Shield',
  PASS_THROUGH: 'Pass-through',
  FREEZE: 'Freeze',
};

export class Powerups {
  collected = false;
  placedTile: AABB | null = null;
  private active: { type: BadgeType; remaining: number; duration: number } | null = null;

  reset(): void {
    this.collected = false;
    this.placedTile = null;
    this.active = null;
  }

  /** Collect a badge. Returns true if this call collected it. */
  collect(badge: BadgeSpec): boolean {
    if (this.collected) return false;
    this.collected = true;
    if (badge.type === 'PLACE_TILE' && badge.placesTileAt) {
      const t = badge.placesTileAt;
      this.placedTile = { x: t.gx * T, y: t.gy * T, w: t.w * T, h: t.h * T };
    } else {
      const duration = DURATION[badge.type] ?? 0;
      this.active = { type: badge.type, remaining: duration, duration };
    }
    return true;
  }

  update(dt: number): void {
    if (this.active) {
      this.active.remaining -= dt;
      if (this.active.remaining <= 0) this.active = null;
    }
  }

  get isShield(): boolean {
    return this.active?.type === 'FIRE_SHIELD';
  }
  get isPassThrough(): boolean {
    return this.active?.type === 'PASS_THROUGH';
  }
  get isFreeze(): boolean {
    return this.active?.type === 'FREEZE';
  }

  /** Whether an active power grants immunity to a given death cause. */
  protectsFrom(cause: DeathCause): boolean {
    if (cause === 'fire') return this.isShield;
    if (cause === 'plant') return this.isPassThrough;
    if (cause === 'spike') return this.isFreeze;
    return false;
  }

  extraSolids(): AABB[] {
    return this.placedTile ? [this.placedTile] : [];
  }

  /** HUD view — null for the permanent tile (no timer shown per GDD §8). */
  hudModel(): ActivePowerView | null {
    if (!this.active) return null;
    return {
      type: this.active.type,
      name: POWER_NAME[this.active.type],
      remaining: this.active.remaining,
      duration: this.active.duration,
    };
  }
}
