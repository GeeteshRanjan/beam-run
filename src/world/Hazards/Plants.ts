/**
 * Swaying Plants (Screen 3 — Compliance Maze).
 *
 * Maps to legal / tax / entity compliance. Several plants sway laterally in a
 * fixed range, each on its own phase offset, so the player must read the gaps
 * between multiple independent sway cycles (never chasing). Touching a plant
 * while it is in your path is lethal. The Pass-through badge (timed) lets Beam
 * walk straight through (immunity handled by Powerups.protectsFrom('plant')).
 *
 * Distinguished by shape + motion (upright swaying stalk), not colour — rendered
 * in the brand palette for colour-blind safety.
 */
import { RESOLUTION, HAZARDS } from '../../data/tuning.config';
import type { Plant as PlantData } from '../../data/levels';
import { type AABB, aabbOverlap } from '../Physics';
import type { Player } from '../Player';
import type { Hazard, DeathCause, HazardContext } from '../types';

const T = RESOLUTION.TILE;
const TWO_PI = Math.PI * 2;

/** Plant hitbox (narrower/taller than a tile so lateral threading matters). */
const PLANT_W = 26;
const PLANT_H = 56;

interface PlantEntry {
  baseX: number;
  baseY: number;
  phase: number;
}

export interface PlantState {
  /** Current centre x (px). */
  cx: number;
  /** Top of the hitbox (px). */
  topY: number;
  sway: number;
}

export class Plants implements Hazard {
  private readonly plants: PlantEntry[];
  private t = 0;

  constructor(plants: PlantData[]) {
    this.plants = plants.map((p) => ({ baseX: p.gx * T, baseY: p.gy * T, phase: p.phase }));
  }

  solids(): AABB[] {
    return [];
  }

  speedMultAt(): number {
    return 1;
  }

  private swayOffset(phase: number): number {
    return Math.sin((this.t / HAZARDS.PLANTS.SWAY_PERIOD + phase) * TWO_PI) * HAZARDS.PLANTS.SWAY_AMPLITUDE;
  }

  private box(p: PlantEntry): AABB {
    const cx = p.baseX + T / 2 + this.swayOffset(p.phase);
    return { x: cx - PLANT_W / 2, y: p.baseY - (PLANT_H - T), w: PLANT_W, h: PLANT_H };
  }

  update(dt: number, player: Player, _ctx: HazardContext): DeathCause | null {
    this.t += dt;
    for (const p of this.plants) {
      if (aabbOverlap(player.box, this.box(p))) return 'plant';
    }
    return null;
  }

  reset(): void {
    this.t = 0;
  }

  plantStates(): PlantState[] {
    return this.plants.map((p) => ({
      cx: p.baseX + T / 2 + this.swayOffset(p.phase),
      topY: p.baseY - (PLANT_H - T),
      sway: this.swayOffset(p.phase),
    }));
  }
}
