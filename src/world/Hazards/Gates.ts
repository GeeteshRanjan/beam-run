/**
 * Approval gates (Screen 3 — Compliance).
 *
 * Replaces the old "swaying plant": a carnivorous plant said nothing about tax,
 * GST or audit. The *mechanic* was always right — several independent barriers,
 * each on its own phase, so you have to line up unsynchronised approval windows.
 * Only the object was wrong. These are stamped barrier arms on filing-cabinet
 * posts, sweeping across the path.
 *
 * Before the badge (struggle) you time each barrier by hand and squeeze through.
 *
 * After the badge (relief) the verb is CLEAR: GCC-BOT files on your behalf, so
 * barriers within `OPEN_RADIUS` **lift for good** as you approach. The system
 * starts working with you rather than against you — you are still moving and
 * steering, the world just stops blocking.
 *
 * Distinguished by shape + motion (an upright post with a sweeping arm), not
 * colour, so it stays colour-blind safe in the brand palette.
 */
import { RESOLUTION, HAZARDS } from '../../data/tuning.config';
import type { Gate as GateData } from '../../data/levels';
import { type AABB, aabbOverlap } from '../Physics';
import type { Player } from '../Player';
import type { Hazard, SetbackCause, HazardContext } from '../types';

const T = RESOLUTION.TILE;
const TWO_PI = Math.PI * 2;

/** Barrier hitbox (narrower/taller than a tile so lateral threading matters). */
const GATE_W = 26;
const GATE_H = 56;

interface GateEntry {
  baseX: number;
  baseY: number;
  phase: number;
  /** Permanently lifted by GCC-BOT. */
  open: boolean;
  /** Seconds spent lifting (for the animation). */
  openT: number;
}

export interface GateState {
  /** Current centre x (px). */
  cx: number;
  /** Top of the hitbox (px). */
  topY: number;
  sway: number;
  /** 0 = down and blocking, 1 = fully lifted/cleared. */
  open: number;
}

export class Gates implements Hazard {
  private readonly gates: GateEntry[];
  private t = 0;

  constructor(gates: GateData[]) {
    this.gates = gates.map((g) => ({
      baseX: g.gx * T,
      baseY: g.gy * T,
      phase: g.phase,
      open: false,
      openT: 0,
    }));
  }

  solids(): AABB[] {
    return [];
  }

  speedMultAt(): number {
    return 1;
  }

  private swayOffset(phase: number): number {
    return (
      Math.sin((this.t / HAZARDS.GATES.SWAY_PERIOD + phase) * TWO_PI) *
      HAZARDS.GATES.SWAY_AMPLITUDE
    );
  }

  private box(g: GateEntry): AABB {
    const cx = g.baseX + T / 2 + this.swayOffset(g.phase);
    return { x: cx - GATE_W / 2, y: g.baseY - (GATE_H - T), w: GATE_W, h: GATE_H };
  }

  update(dt: number, player: Player, ctx: HazardContext): SetbackCause | null {
    this.t += dt;
    const px = player.box.x + player.box.w / 2;

    for (const g of this.gates) {
      // GCC-BOT clears the filing: lift anything within reach, for good.
      if (ctx.assisted && !g.open) {
        if (Math.abs(g.baseX + T / 2 - px) <= HAZARDS.GATES.OPEN_RADIUS) g.open = true;
      }
      if (g.open) {
        g.openT = Math.min(HAZARDS.GATES.OPEN_TIME, g.openT + dt);
        continue; // a lifted barrier can never cost you time again
      }
      if (aabbOverlap(player.box, this.box(g))) return 'gate';
    }
    return null;
  }

  reset(): void {
    this.t = 0;
    for (const g of this.gates) {
      g.open = false;
      g.openT = 0;
    }
  }

  gateStates(): GateState[] {
    return this.gates.map((g) => ({
      cx: g.baseX + T / 2 + this.swayOffset(g.phase),
      topY: g.baseY - (GATE_H - T),
      sway: this.swayOffset(g.phase),
      open: g.open ? Math.min(1, g.openT / HAZARDS.GATES.OPEN_TIME) : 0,
    }));
  }

  /** How many filings GCC-BOT has cleared (for the on-screen proof). */
  get clearedCount(): number {
    return this.gates.filter((g) => g.open).length;
  }
}
