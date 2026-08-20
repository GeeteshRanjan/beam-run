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
 *  - `PLACE_TILE` SET UP — the DENIED stamps slow to a walk-through pace and can
 *                          no longer press you at all (1Wrk)
 *  - `EXTINGUISH` STAFF  — a teal halo the hiring dragon's fire cannot touch, plus
 *                          a water cannon that quenches that fire and then strips
 *                          the dragon's suit off, freeing five hires (Talent500)
 *  - `CLEAR_PATH` CLEAR  — every toll gate in the compliance maze stands open for
 *                          good and its monsters turn friendly (GCC-BOT)
 *  - `UNWRAP`     FREE   — a cutter that frees the taped-up colleague (500Leaders)
 *
 * The hazards themselves implement the behaviour via `HazardContext.assisted`;
 * this class only tracks *whether* the capability is engaged. It used to also own
 * the one piece of geometry a badge could add — 1Wrk's bridge over Setup Delays'
 * pit — but that screen's obstacles were replaced by the stamps, so no badge
 * builds anything any more and the geometry went with it.
 *
 * Orange (the "value" accent) is reserved for the engaged-capability indicator.
 */
import { COPY, capabilityFor } from '../data/copy';
import type { BadgeSpec, BadgeType } from '../data/levels';

export interface ActivePowerView {
  type: BadgeType;
  /** Short outcome label for the HUD chip ("Roles filled"). */
  name: string;
  /** Real ANSR product name ("Talent500"). */
  product: string;
}

export class Powerups {
  collected = false;
  private activeType: BadgeType | null = null;

  reset(): void {
    this.collected = false;
    this.activeType = null;
  }

  /** Collect a badge. Returns true if this call collected it. */
  collect(badge: BadgeSpec): boolean {
    if (this.collected) return false;
    this.collected = true;
    this.activeType = badge.type;
    return true;
  }

  /** Whether this screen's ANSR capability is engaged (drives hazard behaviour). */
  get isAssisted(): boolean {
    return this.collected;
  }

  get type(): BadgeType | null {
    return this.activeType;
  }

  /**
   * HUD view — a persistent chip, no countdown bar (help does not expire).
   *
   * The fallbacks are belt and braces rather than a live path: every badge type in
   * the game has a `CAPABILITIES` entry and a `COPY.powers` line now that the
   * no-effect `SAFE_PASSAGE` mark has gone with its last holder (owner call, the Tech
   * Park). `data.test.ts` states that as an equality, so a chip can never be blank.
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
