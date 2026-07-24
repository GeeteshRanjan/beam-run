/**
 * Fire (Screen 2 — Hire Under Fire).
 *
 * Maps to hiring quality talent fast, at scale, under pressure. Fire drops down
 * a few fixed lanes on a repeating cycle: a telegraph glow warns, then the lane
 * is lethal for a short ACTIVE window. Adjacent lanes are staggered out of phase
 * (`LANE_PHASE_OFFSET`) so the player reads moving safe gaps. The Fire Shield
 * badge grants timed immunity (handled by Powerups.protectsFrom('fire')).
 *
 * Lethal ONLY during ACTIVE — the telegraph is a smooth warning ramp, never a
 * strobe (seizure-safe), and never lethal.
 */
import { RESOLUTION, HAZARDS } from '../../data/tuning.config';
import type { FireLane } from '../../data/levels';
import { type AABB, aabbOverlap } from '../Physics';
import type { Player } from '../Player';
import type { Hazard, DeathCause, HazardContext } from '../types';

const T = RESOLUTION.TILE;

export type FirePhase = 'idle' | 'telegraph' | 'active';

export interface FireLaneState {
  x: number;
  state: FirePhase;
  /** 0..1 progress through the current phase (for rendering ramps). */
  progress: number;
}

export class Fire implements Hazard {
  private readonly lanes: { x: number; offset: number }[];
  private t = 0;
  private extra = 0;

  constructor(lanes: FireLane[]) {
    this.lanes = lanes.map((l) => ({
      x: l.gx * T,
      offset: l.phaseIndex * HAZARDS.FIRE.LANE_PHASE_OFFSET,
    }));
  }

  solids(): AABB[] {
    return [];
  }

  speedMultAt(): number {
    return 1;
  }

  private phaseOf(offset: number, extra: number): { state: FirePhase; progress: number } {
    const I = HAZARDS.FIRE.INTERVAL;
    const A = HAZARDS.FIRE.ACTIVE;
    const Tg = HAZARDS.FIRE.TELEGRAPH + extra;
    const phase = (((this.t + offset) % I) + I) % I;
    const activeStart = I - A;
    const telegraphStart = activeStart - Tg;
    if (phase >= activeStart) return { state: 'active', progress: (phase - activeStart) / A };
    if (phase >= telegraphStart) {
      return { state: 'telegraph', progress: (phase - telegraphStart) / Tg };
    }
    return { state: 'idle', progress: 0 };
  }

  /** Lane column AABB (full height so the whole lane must be cleared). */
  private column(x: number): AABB {
    return { x, y: 0, w: T, h: RESOLUTION.HEIGHT };
  }

  update(dt: number, player: Player, ctx: HazardContext): DeathCause | null {
    this.t += dt;
    this.extra = ctx.extraTelegraph;
    for (const lane of this.lanes) {
      const { state } = this.phaseOf(lane.offset, this.extra);
      if (state === 'active' && aabbOverlap(player.box, this.column(lane.x))) {
        return 'fire';
      }
    }
    return null;
  }

  reset(): void {
    this.t = 0;
  }

  /** Per-lane state snapshot for rendering. */
  laneStates(): FireLaneState[] {
    return this.lanes.map((l) => ({ x: l.x, ...this.phaseOf(l.offset, this.extra) }));
  }
}
