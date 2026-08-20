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
 * Contact is harmless from the moment they turn, and help never lapses. This is the
 * one screen that does **not** advertise that with the ANSR bubble on the player
 * (owner call): what it shows instead is the **weather clearing** — `skyClear`, a
 * 0..1 dial the host hands to the backdrop — so the change is painted on the market
 * rather than on the hero.
 *
 * It also owns the only moving solids in the game — the clearance **lift** (down)
 * and the clearance **hoist** (up, which replaced the long brown platform at gy 8) —
 * because the hazard is the only per-screen object with an update hook, and owning
 * them means the box handed to the player's collision list is the same one the
 * renderer paints.
 *
 * Headless and deterministic: no `Math.random`, no wall clock, no DOM. Every
 * monster carries its own mulberry32 seeded from level data, so a replay of the
 * same inputs produces the same maze.
 */
import { RESOLUTION, HAZARDS } from '../../data/tuning.config';
import type { GridPos, HoistSpec, LiftSpec, MonsterSpec } from '../../data/levels';
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

/**
 * One moving plate: the clearance lift (which goes **down**) and the clearance hoist
 * (which goes **up**) are the same machine with `travelY` on the other side of
 * `parkY`, so they share one implementation and one safety rule.
 *
 * That rule is the reason the direction is data rather than two classes: a plate may
 * only ever move **while it is carrying the player, or back to its park while it is
 * empty**. `moveAndCollide` is driven by the player's motion, not the world's, so a
 * plate that moved on its own clock could rise into an occupied box and push the
 * player straight through itself. Riding is the one case where the plate moves the
 * player, and it moves them by exactly its own delta.
 */
interface Plate {
  readonly x: number;
  readonly w: number;
  /** Top of the plate where it waits for a rider. */
  readonly parkY: number;
  /** Top of the plate at the far end of its travel. */
  readonly travelY: number;
  /** px/s towards `travelY` (loaded) and back to `parkY` (empty). */
  readonly travelSpeed: number;
  readonly returnSpeed: number;
  /** True when the travel is upwards, i.e. it carries the player with it. */
  readonly rises: boolean;
  y: number;
  carrying: boolean;
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
  /** Its surface is the hoist's live top, not a row (see `MonsterSpec.hoist`). */
  readonly onHoist: boolean;
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
  /**
   * This is the one that caught the player, on the frames the impact is drawn on.
   *
   * Same job as `Stamps.struckAt`: the simulation has already booked the delay and moved
   * to `LIFE_LOST`, and what the host needs is the *pose* — which creature is standing
   * over him with its arm down. Carried on the snapshot rather than as a separate getter
   * so the renderer cannot pair it with the wrong monster.
   */
  struck: boolean;
}

export interface LiftState {
  box: AABB;
  /** 0 parked, 1 at the far end of the travel. */
  progress: number;
  /** px of travel still to go — the renderer draws the rail from this. */
  remaining: number;
  /** The player is on board, so it is moving. */
  carrying: boolean;
}

export class ComplianceMaze implements Hazard {
  private readonly monsters: MonsterEntry[];
  private readonly gather: GridPos | null;
  /**
   * **This hazard does NOT set `shieldsPlayer`, and that is an owner call.**
   *
   * Contact really is harmless once GCC-BOT has filed everything, so the rules would
   * license the orange bubble on the player — every other screen where they do draws
   * it. The owner asked for the opposite here: no halo on the hero, and the change
   * shown on the *world* instead ("just when the user takes the powerup make the
   * gloomy weather brighter, signalling happiness and change and that the environment
   * is fresh"). So what "help is active" looks like on this screen is the weather
   * lifting — `skyClear` below — plus the five monsters walking off with their arms
   * up, which is a bigger read than a ring round a 46px figure ever was.
   *
   * Note the general rule this does *not* overturn: a bubble may only be drawn where
   * contact is harmless. This is the narrower case of a screen that has earned one and
   * has been given something better to say.
   */
  private friendly = false;

  /**
   * The monster that last caught the player, kept for the frames the impact is painted on.
   *
   * It deliberately survives everything except a fresh screen: `Simulation.setback()` does
   * not reset the hazard (that is an invariant — resetting wiped the pose the host paints
   * from), and a retry builds a new `ComplianceMaze`, so there is nothing to clear.
   */
  private struckBy: MonsterEntry | null = null;

  /**
   * The clearance lift (down) and the clearance hoist (up), in the order the
   * renderer wants them. Either may be absent on a screen that has none.
   */
  private readonly lift: Plate | null;
  private readonly hoist: Plate | null;

  /**
   * 0..1 — how far the weather has cleared. It is a dial rather than a flag so the
   * change is a *change* rather than a cut, and it lives here rather than in the
   * renderer because it is driven by simulation time, which makes it replayable.
   */
  private clearedSky = 0;

  constructor(monsters: MonsterSpec[], gather?: GridPos, lift?: LiftSpec, hoist?: HoistSpec) {
    // The plates are built FIRST: a monster whose surface is the hoist reads the
    // plate's live top the moment it is parked at the start of its corridor.
    this.lift = lift
      ? {
          x: lift.gx * T,
          w: lift.w * T,
          parkY: lift.gy * T,
          travelY: lift.toGy * T,
          travelSpeed: M.LIFT_DOWN_SPEED,
          returnSpeed: M.LIFT_UP_SPEED,
          rises: false,
          y: lift.gy * T,
          carrying: false,
        }
      : null;
    this.hoist = hoist
      ? {
          x: hoist.gx * T,
          w: hoist.w * T,
          parkY: hoist.gy * T,
          travelY: hoist.toGy * T,
          travelSpeed: M.HOIST_UP_SPEED,
          returnSpeed: M.HOIST_DOWN_SPEED,
          rises: hoist.toGy < hoist.gy,
          y: hoist.gy * T,
          carrying: false,
        }
      : null;
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
        onHoist: m.hoist === true,
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
    // A monster on the hoist stands on a surface that MOVES, so its feet come from
    // the plate's live top — the same box the player collides against. Deriving it
    // from level data instead would leave it standing in mid-air the moment somebody
    // rides the plate, which is the `badgeFloat` defect wearing a different hat.
    if (m.onHoist && this.hoist) return this.hoist.y;
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
   * The two plates are the only bodies this hazard contributes, and the only moving
   * solids in the game. The monsters are lethal, never climbable.
   */
  solids(): AABB[] {
    const out: AABB[] = [];
    for (const plate of [this.lift, this.hoist]) {
      if (plate) out.push(this.plateBox(plate));
    }
    return out;
  }

  private plateBox(plate: Plate): AABB {
    return { x: plate.x, y: plate.y, w: plate.w, h: M.LIFT_H };
  }

  speedMultAt(): number {
    return 1;
  }

  /**
   * Run one plate. It travels **only while the player is standing on it** and returns
   * to its park only while it is empty.
   *
   * That is the read the owner asked for on both machines ("that is supposed to bring
   * the character down"; "make it go up and down so the user can jump on this") *and*
   * the safe rule, which matters more for the hoist than it did for the lift: a plate
   * moving on its own clock would eventually rise into an occupied box and push the
   * player through itself, because `moveAndCollide` is driven by the player's motion
   * and not the world's. Rider-driven, the plate can only ever move *away* from a body
   * it is not carrying.
   *
   * A rising plate has to bring its rider with it, so this is the one place in the
   * game where the world moves the player: the plate advances and the rider's box is
   * offset by exactly the same delta. Nothing may be authored over a hoist's travel
   * for that reason — there is no ceiling test here, and 40px of masonry over the top
   * of the shaft would push a rider into it.
   */
  private runPlate(dt: number, player: Player, plate: Plate): void {
    const feet = player.box.y + player.box.h;
    const overlapsX = player.box.x + player.box.w > plate.x && player.box.x < plate.x + plate.w;
    // A rider is anyone whose feet are within a few px of the plate: on a plate that
    // is sinking under them the player is technically airborne most frames.
    plate.carrying = overlapsX && feet >= plate.y - 10 && feet <= plate.y + 10;
    const target = plate.carrying ? plate.travelY : plate.parkY;
    const speed = plate.carrying ? plate.travelSpeed : plate.returnSpeed;
    // An empty plate may only return once the player is clear of it, or off it.
    if (!plate.carrying && overlapsX && feet <= plate.y + M.LIFT_H) return;
    const dy = target - plate.y;
    if (dy === 0) return;
    const step = Math.sign(dy) * Math.min(Math.abs(dy), speed * dt);
    plate.y += step;
    if (plate.carrying && step < 0) player.box.y += step;
  }

  update(dt: number, player: Player, ctx: HazardContext): SetbackCause | null {
    for (const plate of [this.lift, this.hoist]) {
      if (plate) this.runPlate(dt, player, plate);
    }

    if (ctx.assisted) {
      // GCC-BOT filed everything: arms up, smiles on, and off home up the stairs —
      // and the weather over the market starts to lift.
      this.friendly = true;
      this.clearedSky = Math.min(1, this.clearedSky + dt / M.CLEAR_SKY_TIME);
      for (const m of this.monsters) {
        m.arm = Math.min(1, m.arm + dt / M.ARM_LIFT_TIME);
        this.walkHome(m, dt);
      }
      return null;
    }

    for (const m of this.monsters) {
      this.wander(m, dt);
      if (aabbOverlap(player.box, this.box(m))) {
        this.struckBy = m;
        return 'monster';
      }
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
    this.clearedSky = 0;
    this.struckBy = null;
    for (const plate of [this.lift, this.hoist]) {
      if (!plate) continue;
      plate.y = plate.parkY;
      plate.carrying = false;
    }
    for (const m of this.monsters) this.startOf(m);
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
      struck: this.struckBy === m,
    }));
  }

  /** The lift's live box + how far down it is (for painting). */
  liftState(): LiftState | null {
    return this.plateState(this.lift);
  }

  /** The hoist's live box + how far up it is (for painting). */
  hoistState(): LiftState | null {
    return this.plateState(this.hoist);
  }

  private plateState(plate: Plate | null): LiftState | null {
    if (!plate) return null;
    const travel = plate.travelY - plate.parkY;
    return {
      box: this.plateBox(plate),
      progress: travel === 0 ? 0 : (plate.y - plate.parkY) / travel,
      // Always positive: how much travel is left, whichever way it is going.
      remaining: Math.abs(plate.travelY - plate.y),
      carrying: plate.carrying,
    };
  }

  /**
   * 0..1 — how far the weather has cleared since GCC-BOT was engaged.
   *
   * This is what the badge looks like on this screen (owner call): no halo on the
   * player, the gloom lifting off the market instead. The host hands it to
   * `drawSceneBackground` as a weather dial, so the backdrop still knows nothing
   * about hazards or badges.
   */
  get skyClear(): number {
    return this.clearedSky;
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
