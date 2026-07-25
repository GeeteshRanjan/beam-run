/**
 * Hiring pressure (Screen 2 — Hire Under Fire).
 *
 * Fire drops down fixed lanes on a repeating cycle: a telegraph glow warns, then
 * the lane costs you time for a short ACTIVE window. Adjacent lanes are
 * staggered out of phase so the player reads moving safe gaps.
 *
 * Before the badge (struggle) you stop and wait at each lane — hurry up and
 * wait, which is exactly what hiring at scale feels like unaided.
 *
 * After the badge (relief) the verb is STAFF, not "immunity": Talent500 fills
 * the roles, so lanes within `EXTINGUISH_RADIUS` go **out for good** as you
 * approach. You keep moving at full speed instead of standing still — the
 * pleasure is momentum, and the doused lanes behind you are visible proof of
 * what was handled.
 *
 * Lethal ONLY during ACTIVE on a lane that is still burning — the telegraph is a
 * smooth warning ramp, never a strobe (seizure-safe), and never costs time.
 */
import { RESOLUTION, HAZARDS } from '../../data/tuning.config';
import type { FireLane } from '../../data/levels';
import { type AABB, aabbOverlap } from '../Physics';
import type { Player } from '../Player';
import type { Hazard, SetbackCause, HazardContext } from '../types';

const T = RESOLUTION.TILE;

export type FirePhase = 'idle' | 'telegraph' | 'active' | 'out';

export interface FireLaneState {
  x: number;
  state: FirePhase;
  /** 0..1 progress through the current phase (for rendering ramps). */
  progress: number;
  /** 0..1 how far through going out this lane is (1 = fully doused). */
  doused: number;
}

interface Lane {
  x: number;
  offset: number;
  /** Permanently extinguished by Talent500. */
  out: boolean;
  /** Seconds spent going out (for the douse animation). */
  douseT: number;
}

export class Fire implements Hazard {
  private readonly lanes: Lane[];
  private t = 0;
  private extra = 0;

  constructor(lanes: FireLane[]) {
    this.lanes = lanes.map((l) => ({
      x: l.gx * T,
      offset: l.phaseIndex * HAZARDS.FIRE.LANE_PHASE_OFFSET,
      out: false,
      douseT: 0,
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

  update(dt: number, player: Player, ctx: HazardContext): SetbackCause | null {
    this.t += dt;
    this.extra = ctx.extraTelegraph;
    const px = player.box.x + player.box.w / 2;

    for (const lane of this.lanes) {
      // Talent500 fills the roles: douse anything within reach, for good.
      if (ctx.assisted && !lane.out) {
        if (Math.abs(lane.x + T / 2 - px) <= HAZARDS.FIRE.EXTINGUISH_RADIUS) lane.out = true;
      }
      if (lane.out) {
        lane.douseT = Math.min(HAZARDS.FIRE.DOUSE_FADE, lane.douseT + dt);
        continue; // an extinguished lane can never cost you time again
      }
      const { state } = this.phaseOf(lane.offset, this.extra);
      if (state === 'active' && aabbOverlap(player.box, this.column(lane.x))) {
        return 'fire';
      }
    }
    return null;
  }

  reset(): void {
    this.t = 0;
    for (const lane of this.lanes) {
      lane.out = false;
      lane.douseT = 0;
    }
  }

  /** Per-lane state snapshot for rendering. */
  laneStates(): FireLaneState[] {
    return this.lanes.map((l) => {
      if (l.out) {
        return {
          x: l.x,
          state: 'out' as FirePhase,
          progress: 1,
          doused: Math.min(1, l.douseT / HAZARDS.FIRE.DOUSE_FADE),
        };
      }
      return { x: l.x, ...this.phaseOf(l.offset, this.extra), doused: 0 };
    });
  }

  /** How many lanes Talent500 has put out (for the on-screen proof). */
  get extinguishedCount(): number {
    return this.lanes.filter((l) => l.out).length;
  }
}
