/**
 * Falling Spikes (Screen 4 — Lack of Local Expertise).
 *
 * Maps to missing on-the-ground local knowledge: threats that drop without
 * warning unless you know the terrain. Each column runs its own mini state
 * machine on a repeating cycle:
 *
 *   telegraph (warning marker at the column top, NOT lethal)
 *     → falling (spike descends at FALL_SPEED to the ground top, LETHAL)
 *     → resting (spike sits on the ground as an obstacle, LETHAL)
 *     → despawning (fades out, NOT lethal)
 *
 * Columns are staggered by a per-column phase offset (from `phaseIndex`) so the
 * player reads independent drop rhythms rather than a single global beat.
 *
 * Lethal ONLY during `falling` + `resting`. Spikes are HAZARDS, not solids —
 * the player jumps over/around a resting spike (they are never added to the
 * collidable set). The global Freeze badge (Powerups.protectsFrom('spike'))
 * grants immunity; additionally, when `ctx.freeze` is set this hazard pauses
 * ALL motion (time does not advance) and never kills, so Freeze visibly stops
 * every spike on screen.
 *
 * Distinguished by shape + motion (steel triangular spikes falling from above),
 * not colour — colour-blind safe in the brand palette.
 */
import { RESOLUTION, HAZARDS } from '../../data/tuning.config';
import type { SpikeColumn } from '../../data/levels';
import { type AABB, aabbOverlap } from '../Physics';
import type { Player } from '../Player';
import type { Hazard, DeathCause, HazardContext } from '../types';

const T = RESOLUTION.TILE;

/** Spike body is roughly one tile square. */
const SPIKE_H = T;
/** Top of the ground band (row 15). Resting spike sits with its base here. */
const GROUND_TOP = 15 * T;
/** Y where a resting spike's top edge sits (base flush with the ground). */
const REST_TOP_Y = GROUND_TOP - SPIKE_H; // 560
/** Spikes drop from the top of the screen. */
const START_Y = 0;

export type SpikePhase = 'telegraph' | 'falling' | 'resting' | 'despawning';

export interface SpikeState {
  /** Column left edge (px). */
  x: number;
  /** Current top edge of the spike body (px). */
  y: number;
  state: SpikePhase;
  /** 0..1 progress through the current phase (for render ramps/fade). */
  progress: number;
}

interface Column {
  x: number;
  offset: number;
}

export class Spikes implements Hazard {
  private readonly columns: Column[];
  private t = 0;
  private extra = 0;

  private readonly fallTime = (REST_TOP_Y - START_Y) / HAZARDS.SPIKES.FALL_SPEED;

  constructor(columns: SpikeColumn[]) {
    // Per-column phase offset spaced by INTERVAL/4 (keeps drops staggered).
    this.columns = columns.map((c) => ({
      x: c.gx * T,
      offset: c.phaseIndex * (HAZARDS.SPIKES.INTERVAL / 4),
    }));
  }

  solids(): AABB[] {
    // Spikes are hazards, never collidable — the player jumps over/around them.
    return [];
  }

  speedMultAt(): number {
    return 1;
  }

  /** Full cycle length: telegraph → fall → rest → despawn. */
  private get cycle(): number {
    const Tg = HAZARDS.SPIKES.TELEGRAPH + this.extra;
    return Tg + this.fallTime + HAZARDS.SPIKES.REST_TIME + HAZARDS.SPIKES.DESPAWN_FADE;
  }

  private phaseOf(offset: number): { state: SpikePhase; progress: number; y: number } {
    const Tg = HAZARDS.SPIKES.TELEGRAPH + this.extra;
    const rest = HAZARDS.SPIKES.REST_TIME;
    const fade = HAZARDS.SPIKES.DESPAWN_FADE;
    const cycle = this.cycle;
    const phase = (((this.t + offset) % cycle) + cycle) % cycle;

    const fallStart = Tg;
    const restStart = fallStart + this.fallTime;
    const despawnStart = restStart + rest;

    if (phase < fallStart) {
      return { state: 'telegraph', progress: phase / Tg, y: START_Y };
    }
    if (phase < restStart) {
      const p = (phase - fallStart) / this.fallTime;
      return { state: 'falling', progress: p, y: START_Y + p * (REST_TOP_Y - START_Y) };
    }
    if (phase < despawnStart) {
      return { state: 'resting', progress: (phase - restStart) / rest, y: REST_TOP_Y };
    }
    return { state: 'despawning', progress: (phase - despawnStart) / fade, y: REST_TOP_Y };
  }

  /** Spike hitbox at the given top-Y. */
  private box(x: number, y: number): AABB {
    return { x, y, w: T, h: SPIKE_H };
  }

  update(dt: number, player: Player, ctx: HazardContext): DeathCause | null {
    // Freeze pauses ALL spikes: no time advance, no positions change, no kill.
    if (ctx.freeze) return null;
    this.extra = ctx.extraTelegraph;
    this.t += dt;
    for (const col of this.columns) {
      const { state, y } = this.phaseOf(col.offset);
      // Lethal only while falling or resting (never telegraph/despawning).
      if (state === 'falling' || state === 'resting') {
        if (aabbOverlap(player.box, this.box(col.x, y))) return 'spike';
      }
    }
    return null;
  }

  reset(): void {
    this.t = 0;
  }

  /** Per-column snapshot for rendering. */
  spikeStates(): SpikeState[] {
    return this.columns.map((c) => ({ x: c.x, ...this.phaseOf(c.offset) }));
  }
}
