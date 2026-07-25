/**
 * Unknown unknowns (Screen 4 — Local Expertise).
 *
 * Things drop out of nowhere and then stay in your way. Each column runs its own
 * mini state machine on a repeating cycle:
 *
 *   telegraph (short warning marker, NOT a setback)
 *     → falling (descends at FALL_SPEED to the ground top, costs time)
 *     → resting (sits on the ground as an obstacle, costs time)
 *     → despawning (fades out, NOT a setback)
 *
 * Columns are staggered by a per-column phase offset so the player reads
 * independent rhythms rather than one global beat.
 *
 * Before the badge (struggle) the warning is short and it feels unfair — because
 * without local context, you genuinely could not have known.
 *
 * After the badge the verb is KNOW, not "freeze". Time does not stop; a market
 * does not pause because you hired an advisor. Instead every column becomes
 * **foreseen**: `timeToFall` is published so the renderer can show the landing
 * spot `FORESIGHT_TELEGRAPH` seconds ahead, and nothing costs you time — you saw
 * it coming and stepped around it. Knowledge, not magic. Crucially the cycle
 * timing is untouched, so nothing visibly teleports when the badge is picked up.
 *
 * Spikes are HAZARDS, not solids — never added to the collidable set.
 */
import { RESOLUTION, HAZARDS } from '../../data/tuning.config';
import type { SpikeColumn } from '../../data/levels';
import { type AABB, aabbOverlap } from '../Physics';
import type { Player } from '../Player';
import type { Hazard, SetbackCause, HazardContext } from '../types';

const T = RESOLUTION.TILE;

/** Spike body is roughly one tile square. */
const SPIKE_H = T;
/** Top of the ground band (row 15). A resting spike sits with its base here. */
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
  /** Local context engaged — draw the landing spot and the safe line. */
  foreseen: boolean;
  /** Seconds until this column next starts falling (for the foresight preview). */
  timeToFall: number;
}

interface Column {
  x: number;
  offset: number;
}

export class Spikes implements Hazard {
  private readonly columns: Column[];
  private t = 0;
  private extra = 0;
  private assisted = false;

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

  private phaseAt(offset: number): number {
    const cycle = this.cycle;
    return (((this.t + offset) % cycle) + cycle) % cycle;
  }

  private phaseOf(offset: number): { state: SpikePhase; progress: number; y: number } {
    const Tg = HAZARDS.SPIKES.TELEGRAPH + this.extra;
    const rest = HAZARDS.SPIKES.REST_TIME;
    const fade = HAZARDS.SPIKES.DESPAWN_FADE;
    const phase = this.phaseAt(offset);

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

  /** Seconds until this column next begins to fall. */
  private timeToFall(offset: number): number {
    const Tg = HAZARDS.SPIKES.TELEGRAPH + this.extra;
    const phase = this.phaseAt(offset);
    return phase < Tg ? Tg - phase : this.cycle - phase + Tg;
  }

  /** Spike hitbox at the given top-Y. */
  private box(x: number, y: number): AABB {
    return { x, y, w: T, h: SPIKE_H };
  }

  update(dt: number, player: Player, ctx: HazardContext): SetbackCause | null {
    this.extra = ctx.extraTelegraph;
    this.assisted = ctx.assisted;
    this.t += dt;
    // Foreseen: the drops still happen on the same rhythm, you just read them.
    if (ctx.assisted) return null;
    for (const col of this.columns) {
      const { state, y } = this.phaseOf(col.offset);
      // Costs time only while falling or resting (never telegraph/despawning).
      if (state === 'falling' || state === 'resting') {
        if (aabbOverlap(player.box, this.box(col.x, y))) return 'spike';
      }
    }
    return null;
  }

  reset(): void {
    this.t = 0;
    this.assisted = false;
  }

  /** Per-column snapshot for rendering. */
  spikeStates(): SpikeState[] {
    return this.columns.map((c) => ({
      x: c.x,
      ...this.phaseOf(c.offset),
      foreseen: this.assisted,
      timeToFall: this.timeToFall(c.offset),
    }));
  }

  /** How far ahead foresight shows an incoming drop (s). */
  static get previewWindow(): number {
    return HAZARDS.SPIKES.FORESIGHT_TELEGRAPH;
  }
}
