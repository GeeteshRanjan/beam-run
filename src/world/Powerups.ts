/**
 * Powerups — the ANSR "badge" system.
 *
 * One badge per screen, anchored early on the path and floating vertically (see
 * `world/badgeFloat.ts`), and it does NOT expire. A five-second shield would say
 * "ANSR helps you briefly and then leaves"; help lasts for the rest of the
 * screen. It is cleared only when the screen is re-entered — including the
 * re-entry that follows a lost life, so the badge is always there to be taken
 * again on the retry.
 *
 * Each badge is a structurally different verb, mirroring a real service line
 * (see `CAPABILITIES` in data/copy.ts):
 *
 *  - `PLACE_TILE` BUILD  — lays a permanent bridge across the pit (1Wrk)
 *  - `EXTINGUISH` STAFF  — fire lanes ahead go out for good (Talent500)
 *  - `CLEAR_PATH` CLEAR  — approval gates ahead lift for good (GCC-BOT)
 *  - `FORESIGHT`  KNOW   — spike landing spots are shown (500Leaders)
 *
 * The hazards themselves implement the behaviour via `HazardContext.assisted`;
 * this class only tracks *whether* the capability is engaged, plus the one piece
 * of geometry a badge can add (the bridge).
 *
 * Orange (the "value" accent) is reserved for the engaged-capability indicator.
 */
import { RESOLUTION } from '../data/tuning.config';
import { COPY, capabilityFor } from '../data/copy';
import type { BadgeSpec, BadgeType } from '../data/levels';
import type { AABB } from './Physics';

const T = RESOLUTION.TILE;

export interface ActivePowerView {
  type: BadgeType;
  /** Short outcome label for the HUD chip ("Roles filled"). */
  name: string;
  /** Real ANSR product name ("Talent500"). */
  product: string;
}

export class Powerups {
  collected = false;
  placedTile: AABB | null = null;
  private activeType: BadgeType | null = null;

  reset(): void {
    this.collected = false;
    this.placedTile = null;
    this.activeType = null;
  }

  /** Collect a badge. Returns true if this call collected it. */
  collect(badge: BadgeSpec): boolean {
    if (this.collected) return false;
    this.collected = true;
    this.activeType = badge.type;
    if (badge.type === 'PLACE_TILE' && badge.placesTileAt) {
      const t = badge.placesTileAt;
      this.placedTile = { x: t.gx * T, y: t.gy * T, w: t.w * T, h: t.h * T };
    }
    return true;
  }

  /** Whether this screen's ANSR capability is engaged (drives hazard behaviour). */
  get isAssisted(): boolean {
    return this.collected;
  }

  get type(): BadgeType | null {
    return this.activeType;
  }

  /** Geometry a badge contributes (the laid bridge). */
  extraSolids(): AABB[] {
    return this.placedTile ? [this.placedTile] : [];
  }

  /**
   * HUD view — a persistent chip, no countdown bar (help does not expire).
   *
   * `SAFE_PASSAGE` (the badge on the two screens with nothing to defend against)
   * has no entry in `CAPABILITIES`, so it has no product name; the chip falls
   * back to the brand rather than rendering an empty plaque.
   */
  hudModel(): ActivePowerView | null {
    if (!this.activeType) return null;
    const cap = capabilityFor(this.activeType);
    return {
      type: this.activeType,
      name: COPY.powers[this.activeType] ?? this.activeType,
      product: cap?.product ?? COPY.meta.name,
    };
  }
}
