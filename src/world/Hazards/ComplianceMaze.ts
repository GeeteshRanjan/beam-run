/**
 * The Compliance maze (Screen 2) — owner-specified rebuild of the whole screen,
 * authored from the owner's sketch.
 *
 * What replaced what: Compliance used to be a row of swaying approval barriers on
 * the flat, and before that a carnivorous plant. Both were one obstacle repeated,
 * and both could be walked past on a single level. Compliance is not like that.
 * The screen is now a **staircase maze** (geometry in `levels.json`: no route
 * along the ground, so the exit is only reachable by climbing the lower stair,
 * crossing the registry block, climbing back up to the registers platform, up the
 * upper stair to the approvals gallery, over the statutory wall and down the
 * clearance lift) and the things moving in it are the headaches themselves —
 * **TAX, GST, LEGAL, ENTITY, AUDIT** — one wandering each corridor.
 *
 * Four behaviours, and the reasoning for each:
 *
 *  1. **A monster IS its toll gate.** The creature is the barrier: it holds a
 *     striped boom arm down while it scowls. There is no separate gate object —
 *     that split put two obstacles in a corridor where the owner's design has one.
 *  2. **They wander; they never hunt.** At every junction — a column boundary, or
 *     either end of its corridor — a monster re-rolls direction and speed from its
 *     own seeded generator. The player's position is not an input anywhere in this
 *     file. A monster that chased would say compliance is out to get you; one that
 *     mills about unpredictably says you cannot plan around it, which is the thing
 *     ANSR is sold against.
 *  3. **Touch one unassisted and the stage stalls** (`'monster'`). Single contact,
 *     the same rule every other hazard uses.
 *  4. **Assisted, they go home the long way.** GCC-BOT files everything: every
 *     monster smiles, raises its arm, and walks its authored `route` — along its
 *     corridor, down or up the maze's own staircases, corner by corner — to sit on
 *     the landing together. They do not drift diagonally through the stone (owner
 *     call: that read as a bug, not as a resolution).
 *
 * Contact is harmless from the moment they turn, so this hazard sets
 * `shieldsPlayer` and the host draws the ANSR bubble. Help never lapses.
 *
 * It also owns the one moving solid in the game, the clearance lift, because the
 * hazard is the only per-screen object with an update hook — and owning it means
 * the box handed to the player's collision list is the same one the renderer
 * paints.
 *
 * Headless and deterministic: no `Math.random`, no wall clock, no DOM. Every
 * monster carries its own mulberry32 seeded from level data, so a replay of the
 * same inputs produces the same maze.
 */
import { RESOLUTION, HAZARDS } from '../../data/tuning.config';
import type { GridPos, LiftSpec, MonsterSpec } from '../../data/levels';
import { type AABB, aabbOverlap } from '../Physics';
import type { Player } from '../Player';
import type { Hazard, SetbackCause, HazardContext } from '../types';

const T = RESOLUTION.TILE;
const M = HAZARDS.MAZE;

/**
 * mulberry32 — the same small generator `core/Effects.ts` uses for particles,
 * duplicated here rather than imported because `world/*` must not depend on
 * `core/*` (Effects owns the render layer's RNG; this one is gameplay).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface MonsterEntry {
  readonly name: string;
  /** Corridor ends for the monster's CENTRE (px), inset by half its width. */
  readonly minX: number;
  readonly maxX: number;
  /** Surface row at `minX`, and how it steps per column (staircase support). */
  readonly baseRow: number;
  readonly fromX: number;
  readonly slope: number;
  /** Columns per step of `slope` — the staircase's run (1 unless authored). */
  readonly slopeRun: number;
  readonly seed: number;
  /** The way home, in pixels: [centre x, surface y] per corner. */
  readonly route: { x: number; y: number }[];
  cx: number;
  /** Top of the surface the monster is standing on (px). */
  feetY: number;
  dir: -1 | 1;
  speed: number;
  /** Column it last made a decision in, so a junction fires exactly once. */
  tile: number;
  rand: () => number;
  /** How far along `route` it is on the way home. */
  leg: number;
  /** Reached the landing and sat down (assisted only). */
  settled: boolean;
  /** 0..1 — how far the boom arm has swung up. */
  arm: number;
}

export interface MonsterState {
  name: string;
  /** Hitbox — exactly what is drawn (see `render/maze.ts`). */
  box: AABB;
  /** −1 facing left, 1 facing right. */
  dir: -1 | 1;
  /** px/s right now, so the art can lean into a fast one. */
  speed: number;
  /** GCC-BOT has filed everything: it is smiling and on its way out. */
  friendly: boolean;
  /** 0 = boom arm down and blocking, 1 = fully raised. */
  arm: number;
  /** Arrived at the landing. */
  settled: boolean;
}

export interface LiftState {
  box: AABB;
  /** 0 parked at the top, 1 all the way down. */
  progress: number;
  /** px of descent still to go — the renderer draws the rail from this. */
  remaining: number;
  /** The player is on board, so it is descending. */
  carrying: boolean;
}

export class ComplianceMaze implements Hazard {
  private readonly monsters: MonsterEntry[];
  private readonly gather: GridPos | null;
  /**
   * Contact is harmless once GCC-BOT has filed everything — every monster is
   * smiling with its arm up — so the host may draw the ANSR bubble.
   */
  readonly shieldsPlayer = true;
  private friendly = false;

  /** The clearance lift, or null on a screen that has none. */
  private readonly lift: {
    readonly x: number;
    readonly w: number;
    readonly topY: number;
    readonly bottomY: number;
    y: number;
    carrying: boolean;
  } | null;

  constructor(monsters: MonsterSpec[], gather?: GridPos, lift?: LiftSpec) {
    const n = monsters.length;
    this.monsters = monsters.map((m, i) => {
      // Everyone aims at the same cell, spread out so they huddle rather than
      // stack. The offset is applied to the last leg only.
      const spread = (i - (n - 1) / 2) * M.GATHER_SPACING;
      const route = (m.route ?? []).map((p, j) => ({
        x: p.gx * T + T / 2 + (j === (m.route ?? []).length - 1 ? spread : 0),
        y: p.gy * T,
      }));
      const entry: MonsterEntry = {
        name: m.name,
        minX: m.from * T + M.MONSTER_W / 2,
        maxX: (m.to + 1) * T - M.MONSTER_W / 2,
        baseRow: m.gy,
        fromX: m.from * T,
        slope: m.slope ?? 0,
        slopeRun: Math.max(1, m.slopeRun ?? 1),
        seed: m.seed,
        route,
        cx: 0,
        feetY: 0,
        dir: 1,
        speed: 0,
        tile: 0,
        rand: mulberry32(m.seed),
        leg: 0,
        settled: false,
        arm: 0,
      };
      this.startOf(entry);
      return entry;
    });
    this.gather = gather ?? null;
    this.lift = lift
      ? {
          x: lift.gx * T,
          w: lift.w * T,
          topY: lift.gy * T,
          bottomY: lift.toGy * T,
          y: lift.gy * T,
          carrying: false,
        }
      : null;
  }

  /** Park a monster at the start of its corridor with a fresh generator. */
  private startOf(m: MonsterEntry): void {
    m.rand = mulberry32(m.seed);
    m.cx = m.minX;
    m.dir = 1;
    m.speed = this.rollSpeed(m);
    m.tile = Math.floor(m.cx / T);
    m.leg = 0;
    m.settled = false;
    m.arm = 0;
    m.feetY = this.surfaceTop(m, m.cx);
  }

  private rollSpeed(m: MonsterEntry): number {
    return M.SPEED_MIN + m.rand() * (M.SPEED_MAX - M.SPEED_MIN);
  }

  /**
   * The surface under a monster at `cx`. Stepped, not sloped: a staircase is
   * whole tiles, so a monster on one walks the same treads the player does.
   *
   * `slopeRun` is how many columns make up one tread. The maze's flights have
   * two-column treads, so a monster rises one row every 80px rather than every
   * 40px — and the row stays a whole number, which is the point: a fractional
   * slope would stand it 20px inside the stone.
   */
  private surfaceTop(m: MonsterEntry, cx: number): number {
    const step = Math.floor((cx - m.fromX) / (T * m.slopeRun));
    return (m.baseRow + m.slope * Math.max(0, step)) * T;
  }

  private box(m: MonsterEntry): AABB {
    return {
      x: m.cx - M.MONSTER_W / 2,
      y: m.feetY - M.MONSTER_H,
      w: M.MONSTER_W,
      h: M.MONSTER_H,
    };
  }

  /**
   * The lift is the only body this hazard contributes, and the only moving solid
   * in the game. The monsters are lethal, never climbable.
   */
  solids(): AABB[] {
    const box = this.liftBox();
    return box ? [box] : [];
  }

  private liftBox(): AABB | null {
    if (!this.lift) return null;
    return { x: this.lift.x, y: this.lift.y, w: this.lift.w, h: M.LIFT_H };
  }

  speedMultAt(): number {
    return 1;
  }

  /**
   * Run the lift. It goes **down only while the player is standing on it** and
   * returns only while it is empty — which is both the read the owner asked for
   * ("that is supposed to bring the character down") and the safe rule: a
   * platform that rose into an occupied box would push the player through it,
   * because `moveAndCollide` is driven by the player's motion, not the world's.
   */
  private runLift(dt: number, player: Player): void {
    const l = this.lift;
    if (!l) return;
    const feet = player.box.y + player.box.h;
    const overlapsX = player.box.x + player.box.w > l.x && player.box.x < l.x + l.w;
    // A rider is anyone whose feet are within a few px of the plate: on a plate
    // that is sinking under them the player is technically airborne most frames.
    l.carrying = overlapsX && feet >= l.y - 10 && feet <= l.y + 10;
    if (l.carrying) {
      l.y = Math.min(l.bottomY, l.y + M.LIFT_DOWN_SPEED * dt);
    } else if (!overlapsX || feet > l.y + M.LIFT_H) {
      l.y = Math.max(l.topY, l.y - M.LIFT_UP_SPEED * dt);
    }
  }

  update(dt: number, player: Player, ctx: HazardContext): SetbackCause | null {
    this.runLift(dt, player);

    if (ctx.assisted) {
      // GCC-BOT filed everything: arms up, smiles on, and off home up the stairs.
      this.friendly = true;
      for (const m of this.monsters) {
        m.arm = Math.min(1, m.arm + dt / M.ARM_LIFT_TIME);
        this.walkHome(m, dt);
      }
      return null;
    }

    for (const m of this.monsters) {
      this.wander(m, dt);
      if (aabbOverlap(player.box, this.box(m))) return 'monster';
    }
    return null;
  }

  /**
   * One monster's step. Direction and speed are re-rolled at every junction, and
   * a corridor end is a junction that also forces the turn — nothing here reads
   * the player.
   */
  private wander(m: MonsterEntry, dt: number): void {
    m.cx += m.dir * m.speed * dt;
    if (m.cx <= m.minX) {
      m.cx = m.minX;
      m.dir = 1;
      m.speed = this.rollSpeed(m);
      m.tile = Math.floor(m.cx / T);
    } else if (m.cx >= m.maxX) {
      m.cx = m.maxX;
      m.dir = -1;
      m.speed = this.rollSpeed(m);
      m.tile = Math.floor(m.cx / T);
    } else {
      const tile = Math.floor(m.cx / T);
      if (tile !== m.tile) {
        m.tile = tile;
        m.speed = this.rollSpeed(m);
        if (m.rand() < M.TURN_CHANCE) m.dir = m.dir === 1 ? -1 : 1;
      }
    }
    m.feetY = this.surfaceTop(m, m.cx);
  }

  /**
   * The exodus, one corner at a time along the authored route: it walks its own
   * corridor to the end, then takes the maze's stairs.
   *
   * **It is a walk.** `GATHER_SPEED` was 420 px/s — 1.6× the player's own walk —
   * and at that pace five obstacles left the screen faster than anything else on
   * it moves, which is what the owner meant by "not natural". It is 160 now, just
   * above the top of their own wander range.
   *
   * Both axes move at that same pace while a leg still has ground to cover, so a
   * leg that changes level reads as walking a flight at 45° rather than sliding
   * through it. The one exception is the **leftover vertical part of a descent**
   * (LEGAL and AUDIT each finish a leg by coming down a stair well): a body
   * lowering itself at walking pace reads as floating, so that part *drops*, at
   * `GATHER_DROP_SPEED`. Slowing the walk is what made that visible.
   *
   * A monster with no route (or no gather cell) simply stops where it is, still
   * harmless — a screen is never left with a monster stuck mid-air.
   */
  private walkHome(m: MonsterEntry, dt: number): void {
    if (m.settled || m.route.length === 0) {
      m.settled = true;
      return;
    }
    const step = M.GATHER_SPEED * dt;
    const target = m.route[Math.min(m.leg, m.route.length - 1)]!;
    const dx = target.x - m.cx;
    const dy = target.y - m.feetY;
    if (dx !== 0) {
      m.dir = dx > 0 ? 1 : -1;
      m.cx += Math.sign(dx) * Math.min(Math.abs(dx), step);
    }
    if (dy !== 0) {
      // Falling only once the walking part of this leg is spent, and only downwards:
      // a climb stays a climb.
      const dropping = dy > 0 && Math.abs(dx) <= step;
      const stepY = dropping ? M.GATHER_DROP_SPEED * dt : step;
      m.feetY += Math.sign(dy) * Math.min(Math.abs(dy), stepY);
    }
    m.speed = M.GATHER_SPEED;
    if (Math.abs(target.x - m.cx) < 0.5 && Math.abs(target.y - m.feetY) < 0.5) {
      m.cx = target.x;
      m.feetY = target.y;
      if (m.leg >= m.route.length - 1) m.settled = true;
      else m.leg += 1;
    }
  }

  reset(): void {
    this.friendly = false;
    for (const m of this.monsters) this.startOf(m);
    if (this.lift) {
      this.lift.y = this.lift.topY;
      this.lift.carrying = false;
    }
  }

  /** Per-monster snapshot for rendering. */
  monsterStates(): MonsterState[] {
    return this.monsters.map((m) => ({
      name: m.name,
      box: this.box(m),
      dir: m.dir,
      speed: m.speed,
      friendly: this.friendly,
      arm: m.arm,
      settled: m.settled,
    }));
  }

  /** The lift's live box + how far down it is (for painting). */
  liftState(): LiftState | null {
    const box = this.liftBox();
    if (!box || !this.lift) return null;
    const travel = this.lift.bottomY - this.lift.topY;
    return {
      box,
      progress: travel === 0 ? 0 : (this.lift.y - this.lift.topY) / travel,
      remaining: this.lift.bottomY - this.lift.y,
      carrying: this.lift.carrying,
    };
  }

  /** Where the monsters are headed once the badge is taken (px), if authored. */
  get gatherAt(): { x: number; y: number } | null {
    if (!this.gather) return null;
    return { x: this.gather.gx * T + T / 2, y: this.gather.gy * T };
  }

  /** True once GCC-BOT has filed everything. */
  get isFriendly(): boolean {
    return this.friendly;
  }

  /** How many monsters have raised their arm (the on-screen proof). */
  get clearedCount(): number {
    return this.monsters.filter((m) => m.arm >= 1).length;
  }

  /** How many monsters have reached the landing. */
  get gatheredCount(): number {
    return this.monsters.filter((m) => m.settled).length;
  }
}
