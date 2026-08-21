/**
 * BrickBreaker — THE ENGINE ROOM, the secret stage under the ANSR Tech Park.
 *
 * Headless and deterministic like everything else in `world/`: no DOM, no
 * `Math.random`, every number from `BONUS` in `tuning.config.ts`. It owns the whole
 * of the bonus stage — the room's solids, the opening sequence, the tray, the ball,
 * the wall of blocks and the draught that takes the player home — and it is handed
 * the `Player` so it can move him, because in here the room does two things to him
 * that no screen does: it gives him a skateboard and it sucks him up a shaft.
 *
 * WHY IT IS NOT A `Hazard`, AND NOT A SCREEN
 * ------------------------------------------
 * A `Hazard` is a thing on a screen that can cost the player a life. This costs
 * nothing: it books no months, it spends no lives, it carries no ANSR badge and it is
 * not in `levels.json`. That is the deal that lets a secret exist at all — the run has
 * exactly two stakes and they measure the same thing (HANDOFF §4.1), so a bonus that
 * could take a life would hide the argument's own currency behind a door most players
 * never open, and one that paid months would make the benchmark a matter of finding a
 * secret. What it *is* is the one place the game says what happens **after** go-live,
 * which is the half of ANSR's offer the six screens have no room for.
 *
 * THE SEQUENCE (owner's, in order, and the order is the design)
 * ------------------------------------------------------------
 *  1. `dropping` — he falls in through the mouth at the top centre and lands on the
 *     bottom centre of the floor.
 *  2. `arming` — at `BEAT.TRAY_AT` a tray on a skateboard comes down the same shaft,
 *     lands, slides to him and is equipped without being asked for. A second later
 *     (`BEAT.BRICKS_AT`) the wall materialises, row by row from the top.
 *  3. `rally` — the cannon **hanging on the far side wall** turns onto its line, charges,
 *     and throws an ANSR mark across the room **onto the tray**. It bounces off the tray,
 *     off the walls and the ceiling, and takes a block out of the wall each time it lands
 *     on one. A mark that reaches the floor lies there, fades, and the machine on
 *     whichever side is now the far one throws the next — the wall keeps whatever damage
 *     it already had, so a miss costs momentum and nothing else.
 *  4. `cleared` → `leaving` — with the wall down the shaft starts to draw, in a
 *     straight line the width of the mouth. Walk into the column and it lifts him out,
 *     back onto the plaza he dropped from.
 *
 * The ball is a **breakout ball, not a falling body**: constant speed, pure reflection.
 * Gravity on top of it would make every miss the room's fault rather than the player's.
 *
 * WHY THE SERVE IS A THROW FROM THE WALL AND NOT A DROP FROM THE SHAFT
 * --------------------------------------------------------------------
 * It used to drop out of the mouth in the ceiling, which is at x 640 — i.e. **inside the
 * wall's own footprint** (87..1193 across, 132..322 down). Every serve therefore opened
 * with two or three blocks coming down before the player had touched the mark: the room
 * played the first move of every rally for them.
 *
 * It is now thrown by a machine **bracketed to a side wall**, aimed at the tray, across
 * the band between the bottom course and the bounce line — the only path in this room
 * that reaches the tray without meeting a block. So the mark is something the player
 * **catches**, and the wall is opened from underneath, by their own return, in the order
 * the four rows are authored to be read (footprint, people, capability, run it better).
 */
import { BONUS, PLAYER, RESOLUTION } from '../data/tuning.config';
import type { InputState } from '../core/Input';
import { aabbOverlap, type AABB } from './Physics';
import type { Player } from './Player';

const R = BONUS.ROOM;
const BEAT = BONUS.BEAT;
const P = BONUS.PADDLE;
const B = BONUS.BALL;
const W = BONUS.BRICKS;
const EXIT = BONUS.EXIT;
const C = BONUS.CANNON;

/** Ball radius. It is drawn at exactly `D`, so the art is the hitbox. */
const BALL_R = B.D / 2;

/** Left and right faces of the play area (inside the walls). */
const PLAY_LEFT = R.WALL;
const PLAY_RIGHT = RESOLUTION.WIDTH - R.WALL;

/** The shaft, as an x span. One number for the fall, the suction and the mouth. */
export const TUNNEL_LEFT = R.TUNNEL_CX - R.TUNNEL_W / 2;
export const TUNNEL_RIGHT = R.TUNNEL_CX + R.TUNNEL_W / 2;

/** Largest ball displacement resolved in one sub-step (px) — see `Physics.MAX_STEP`. */
const BALL_STEP = 8;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export type BonusPhase = 'dropping' | 'arming' | 'rally' | 'cleared' | 'leaving' | 'done';

/**
 * One of the two wall-hung cannons, as the renderer needs it. `side` is -1 for the one
 * bracketed to the left wall and +1 for the right.
 *
 * The barrel's direction is handed over as a **unit vector**, not an angle, because it
 * is the aim: it points along the line the throw will take, and the simulation is the
 * only thing that knows where the tray was when the shot was laid.
 *
 * `aim` and `flash` are what make it read as a machine that is about to do something and
 * then did: `aim` runs 0..1 over `CANNON.AIM` before the shot, `flash` runs 1..0 over
 * `CANNON.RECOIL` after it. Both come off the sim clock, so a replay charges and recoils
 * on the same frames.
 */
export interface CannonState {
  /** The barrel's pivot — the centre of the yoke hanging off the wall bracket. */
  pivotX: number;
  pivotY: number;
  /** The yoke's size. The bracket and barrel are drawn off the pivot. */
  w: number;
  h: number;
  side: -1 | 1;
  /** Unit vector the barrel is laid along. */
  ux: number;
  uy: number;
  /** 0 while it is cold, 0..1 while it is charging the next shot. */
  aim: number;
  /** 1 on the frame it fires, decaying to 0 over `CANNON.RECOIL`. */
  flash: number;
}

/** The two pivots: bracketed off the inside face of each side wall, one height. */
const PIVOT_X: readonly [number, number] = [PLAY_LEFT + C.REACH, PLAY_RIGHT - C.REACH];
const PIVOT_Y = C.MOUNT_Y;

/**
 * Where the throw is aimed at, vertically: a few pixels **into** the tray rather than at
 * its top face.
 *
 * Not a detail. The mark's own centre reaching y = `PADDLE.TOP` is the one case the
 * overlap test does *not* catch (box bottom 540 against a paddle top of 540 is a tangent,
 * not an overlap), so a throw laid exactly on the bounce line can pass through the tray
 * it was aimed at. Aim inside it and contact resolves a frame before the mark gets there.
 */
const AIM_Y = P.TOP + 6;

/** One block on the wall. `label` is null on the blanks (owner call: not all of them). */
export interface BrickState {
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
  col: number;
  /** Theme name, which is what the colour coding is keyed on (`render/brickBreaker.ts`). */
  tone: string;
  label: string | null;
  alive: boolean;
  /** Seconds since it was broken, or null while it still stands. */
  sinceBroken: number | null;
  /** 0..1 through this row's reveal, so the wall builds itself top row first. */
  reveal: number;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  d: number;
}

/** The mark lying on the floor after a miss: `fade` runs 0..1 and then it is gone. */
export interface LostBallState {
  x: number;
  y: number;
  fade: number;
}

export interface TrayState {
  phase: 'waiting' | 'falling' | 'sliding' | 'held';
  /** Centre of the tray. */
  x: number;
  /** Top of the tray. */
  y: number;
  w: number;
  h: number;
}

export class BrickBreaker {
  /** The room's static collidables: the floor and the two side walls. */
  readonly solids: readonly AABB[];

  private t = 0;
  private _phase: BonusPhase = 'dropping';
  private readonly bricks: BrickState[] = [];
  private ball: BallState | null = null;
  private lost: LostBallState | null = null;
  private nextServeAt: number = BEAT.SERVE_AT;
  /**
   * The throw that is being laid, or the last one thrown: which machine, and the line it
   * is on. Set when the barrel starts moving (`CANNON.AIM` before the shot), so what the
   * player sees pointing at them is the actual trajectory. Kept after firing, because a
   * barrel that snaps back to a parked angle the moment it fires reads as a reset.
   */
  private shot: { index: 0 | 1; ux: number; uy: number } | null = null;
  /** True once the shot for `nextServeAt` has been laid. */
  private aimed = false;
  private firedAt: number | null = null;
  private tray: TrayState;
  private trayVy = 0;
  private slideT = 0;
  private slideFrom = { x: 0, y: 0 };
  private broken = 0;
  private clearedAt: number | null = null;
  private _carrying = false;
  private rngState: number;

  // --- monotonic counters, read by the host for sound (never a callback) ------
  /** Marks served out of the tunnel. */
  serves = 0;
  /** Bounces off the tray. */
  paddleHits = 0;
  /** Bounces off a wall or the ceiling. */
  wallHits = 0;
  /** Blocks taken out of the wall. */
  breaks = 0;
  /** Marks that reached the floor. */
  losses = 0;
  /** Times the watchdog has had to steer the mark out of a closed path. */
  nudges = 0;

  /** s since the last block came down — the watchdog's clock (see `steer`). */
  private sinceBreak = 0;
  /** Marks lost since the last block came down — see `aimAtWall`. */
  private missesSinceBreak = 0;

  constructor() {
    this.solids = [
      { x: 0, y: R.FLOOR_Y, w: RESOLUTION.WIDTH, h: RESOLUTION.HEIGHT - R.FLOOR_Y },
      { x: 0, y: 0, w: R.WALL, h: RESOLUTION.HEIGHT },
      { x: PLAY_RIGHT, y: 0, w: R.WALL, h: RESOLUTION.HEIGHT },
    ];
    /*
     * The cannons are NOT in this list. They hang 190px over the walking line, so the
     * hero passes under them: the pair that stood on the floor were solid (a machine you
     * walk through is scenery) and the moment they went up the wall that stopped being a
     * question. It also gives the room its full width back — the tray reaches the side
     * walls again, which is what makes a throw laid into the far corner catchable.
     */
    /*
     * The ceiling slab is deliberately NOT a solid. The ball reflects off its underside
     * in this module's own arithmetic (tunnel mouth included — the shaft has a grille),
     * and the player never meets it: he falls in *through* it and jumping is suppressed
     * in here (see `update`). A slab in this list would catch him on the way in.
     */
    this.rngState = B.SEED >>> 0;
    this.tray = { phase: 'waiting', x: R.TUNNEL_CX, y: R.CEILING, w: P.W, h: P.H };
    this.buildWall();
  }

  /** Where the player enters: above the mouth, so he falls down the shaft. */
  static spawnPoint(): { x: number; y: number } {
    return { x: R.TUNNEL_CX - PLAYER.WIDTH / 2, y: -PLAYER.HEIGHT - 24 };
  }

  private buildWall(): void {
    const cols = W.ROWS[0]!.labels.length;
    const span = cols * W.W + (cols - 1) * W.GAP_X;
    const left = Math.round((RESOLUTION.WIDTH - span) / 2);
    W.ROWS.forEach((row, r) => {
      row.labels.forEach((label, c) => {
        this.bricks.push({
          x: left + c * (W.W + W.GAP_X),
          y: W.TOP + r * (W.H + W.GAP_Y),
          w: W.W,
          h: W.H,
          row: r,
          col: c,
          tone: row.tone,
          label,
          alive: true,
          sinceBroken: null,
          reveal: 0,
        });
      });
    });
  }

  /** Seeded LCG. The serve angles come off this and nothing else does. */
  private rnd(): number {
    this.rngState = (Math.imul(this.rngState, 1664525) + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  }

  // --- read-only view --------------------------------------------------------

  get phase(): BonusPhase {
    return this._phase;
  }
  /** Seconds since the player dropped in. Sim time, so a replay is identical. */
  get clock(): number {
    return this.t;
  }
  get brickStates(): readonly BrickState[] {
    return this.bricks;
  }
  get ballState(): BallState | null {
    return this.ball;
  }
  get lostBall(): LostBallState | null {
    return this.lost;
  }
  get trayState(): TrayState {
    return this.tray;
  }
  /** True once the tray is in his hands — which is also the skateboard under his feet. */
  get equipped(): boolean {
    return this.tray.phase === 'held';
  }
  get remaining(): number {
    return this.bricks.length - this.broken;
  }
  get total(): number {
    return this.bricks.length;
  }
  /** True while the shaft is drawing. The renderer paints the column from this. */
  get suctionOn(): boolean {
    return this.clearedAt !== null && this.t >= this.clearedAt + EXIT.SUCK_DELAY;
  }
  /** True while the shaft actually has hold of him. */
  get carrying(): boolean {
    return this._carrying;
  }
  /** True once he is out of the frame and the Tech Park can have him back. */
  get finished(): boolean {
    return this._phase === 'done';
  }

  /**
   * The two cannons, for the renderer. Both of them every frame, because they are
   * furniture that is always there — what changes is which one is charging.
   */
  get cannonStates(): readonly CannonState[] {
    const from = this.nextServeAt - C.AIM;
    const charging = this.aimed && !this.ball && Number.isFinite(this.nextServeAt);
    return ([0, 1] as const).map<CannonState>((i) => {
      const mine = this.shot?.index === i;
      const aim = charging && mine ? clamp01((this.t - from) / C.AIM) : 0;
      const flash =
        this.firedAt !== null && mine
          ? Math.max(0, 1 - (this.t - this.firedAt) / C.RECOIL)
          : 0;
      // Parked, until this machine has laid a shot: down into the room at `REST_DEG`,
      // pointing inboard, so a cannon that has never fired still reads as aimed at the
      // floor it serves rather than at the wall it is bolted to.
      const rest = (C.REST_DEG * Math.PI) / 180;
      const inboard = i === 0 ? 1 : -1;
      return {
        pivotX: PIVOT_X[i]!,
        pivotY: PIVOT_Y,
        w: C.W,
        h: C.H,
        side: i === 0 ? -1 : 1,
        ux: mine && this.shot ? this.shot.ux : Math.sin(rest) * inboard,
        uy: mine && this.shot ? this.shot.uy : Math.cos(rest),
        aim,
        flash,
      };
    });
  }

  /** The tray's hitbox: the line the ball bounces off. */
  paddleBox(): AABB {
    return { x: this.tray.x - P.W / 2, y: this.tray.y, w: P.W, h: P.H };
  }

  /**
   * Advance one fixed step. Returns true on the frame the player has left through
   * the shaft, which is the only way this stage ends.
   *
   * The player is moved here rather than by the Simulation because two of the things
   * that happen to him belong to the room: the skateboard's extra pace, and the
   * draught that lifts him out. Jump is masked off for the whole stage — the tray is
   * carried over his head, so a jump would take the bounce line with it, and there is
   * nothing in the room to jump onto.
   */
  update(dt: number, player: Player, input: InputState): boolean {
    this.t += dt;
    // Age the broken blocks wherever the stage is up to, so the last one's shatter
    // still plays out over the frames the room is already clearing.
    for (const brick of this.bricks) {
      if (brick.sinceBroken !== null) brick.sinceBroken += dt;
    }

    if (this._carrying) {
      this.lift(dt, player);
      return this._phase === 'done';
    }

    const moveOnly: InputState = { ...input, jumpPressed: false, jumpHeld: false };
    player.update(dt, moveOnly, this.solids, this.equipped ? P.SKATE_SPEED_MULT : 1);

    if (this._phase === 'dropping' && player.onGround) this._phase = 'arming';

    this.updateTray(dt, player);
    this.updateWall();
    this.updateBall(dt);

    if (this.clearedAt !== null) this.updateExit(player);

    return false;
  }

  /** The tray's own fall, and the moment it becomes his. */
  private updateTray(dt: number, player: Player): void {
    const tray = this.tray;
    if (tray.phase === 'waiting') {
      if (this.t < BEAT.TRAY_AT) return;
      // Released over the player's own column, not over the middle of the room: a gift
      // that lands somewhere else and then slides to him reads as a bug, and a gift
      // that teleports into his hands is not a delivery at all.
      tray.phase = 'falling';
      tray.x = player.box.x + player.box.w / 2;
      tray.y = R.CEILING;
      this.trayVy = 0;
      return;
    }
    if (tray.phase === 'falling') {
      this.trayVy = Math.min(this.trayVy + PLAYER.GRAVITY * dt, PLAYER.MAX_FALL_SPEED);
      tray.y += this.trayVy * dt;
      if (tray.y + tray.h >= R.FLOOR_Y) {
        tray.y = R.FLOOR_Y - tray.h;
        tray.phase = 'sliding';
        this.slideT = 0;
        this.slideFrom = { x: tray.x, y: tray.y };
      }
      return;
    }
    if (tray.phase === 'sliding') {
      this.slideT += dt;
      const k = Math.min(1, this.slideT / BEAT.EQUIP_SLIDE);
      const toX = player.box.x + player.box.w / 2;
      tray.x = this.slideFrom.x + (toX - this.slideFrom.x) * k;
      tray.y = this.slideFrom.y + (P.TOP - this.slideFrom.y) * k;
      if (k >= 1) tray.phase = 'held';
      return;
    }
    // Held: the tray is the player, clamped so it can never leave the room.
    tray.x = Math.max(
      PLAY_LEFT + P.W / 2,
      Math.min(PLAY_RIGHT - P.W / 2, player.box.x + player.box.w / 2),
    );
    tray.y = P.TOP;
  }

  /** The wall's reveal, and the serve clock that waits for it. */
  private updateWall(): void {
    if (this.t < BEAT.BRICKS_AT) return;
    for (const brick of this.bricks) {
      const from = BEAT.BRICKS_AT + brick.row * BEAT.ROW_REVEAL;
      brick.reveal = Math.max(0, Math.min(1, (this.t - from) / BEAT.ROW_REVEAL));
    }
    if (this._phase === 'arming') this._phase = 'rally';
  }

  /**
   * Lay the throw: pick the machine, pick the mark on the tray line it is aimed at, and
   * turn the barrel onto that line. Runs `CANNON.AIM` seconds before the shot, which is
   * what gives the player something to read.
   *
   * **The far cannon throws.** Not an alternation: the one on the other side of the room
   * is the one whose throw crosses the whole floor, so it is in the air for over a second
   * and the player has time to place the tray under it. The near one would drop the mark
   * 190px onto somebody's head.
   *
   * **Where it lands is a decision, not a direction** (owner call). It is aimed at the
   * middle of the tray with a seeded offset: `CANNON.ON_TRAY` of throws land inside
   * `NEAR` (±44, i.e. a catch without moving, since the tray plus the mark is ±86), the
   * rest inside `WIDE` (±118 — a step, never a different part of the room). The tray is
   * read *now*, at the start of the aim, so the barrel is telling the truth for the whole
   * of the wind-up and the player can move off it if they choose to.
   */
  private takeAim(): void {
    const trayX = this.tray.phase === 'held' ? this.tray.x : R.TUNNEL_CX;
    const index: 0 | 1 = trayX > RESOLUTION.WIDTH / 2 ? 0 : 1;
    if (this.missesSinceBreak >= C.RESCUE_AFTER) {
      this.aimAtWall(index);
      return;
    }
    const near = this.rnd() < C.ON_TRAY;
    const spread = near ? C.NEAR : C.WIDE;
    const offset = (near ? 0 : C.NEAR) + this.rnd() * (spread - (near ? 0 : C.NEAR));
    const sign = this.rnd() < 0.5 ? -1 : 1;
    // Kept off the side walls: a throw laid into the corner is one the tray cannot get
    // its middle under, and this room does not punish.
    const target = Math.max(
      PLAY_LEFT + P.W / 2,
      Math.min(PLAY_RIGHT - P.W / 2, trayX + offset * sign),
    );
    const dx = target - PIVOT_X[index]!;
    const dy = AIM_Y - PIVOT_Y;
    const mag = Math.hypot(dx, dy) || 1;
    this.shot = { index, ux: dx / mag, uy: dy / mag };
    this.aimed = true;
  }

  /**
   * The machine gives up on the tray and throws **at the wall**, after
   * `CANNON.RESCUE_AFTER` marks have been lost without a block coming down.
   *
   * The room's only exit is an empty wall, so it has to be clearable — and a throw aimed
   * at a tray nobody is moving is not: a player parked against a side wall can only return
   * the mark up their own end, so the far columns stand for ever. This is the same kind of
   * guarantee as `steer`, and it is *visible* rather than hidden: the barrel swings up off
   * the tray line and points at the brickwork, which is the machine telling the player it
   * has stopped passing to them.
   *
   * It aims at the **lowest** block that is far enough across to keep the throw off the
   * vertical (`MIN_BOUNCE_DEG` is a soft lock, not a preference), and the lowest one
   * because it is the one with clear air under it.
   */
  private aimAtWall(prefer: 0 | 1): void {
    /*
     * **The machine is chosen for the block, not the block for the machine**, and that is
     * the whole of why this works. The first cut kept the far-from-the-tray machine and
     * looked for a block at least `MIN_ACROSS` to one side of it: when the survivor was
     * the column directly overhead there was no such block, so the throw came out
     * vertical, `keepAngleHonest` bent it off the vertical it had to be bent off — and it
     * missed. For ever. One block left after ten minutes, which is a stuck room.
     *
     * So: for each machine, the lowest block far enough across to keep the shot off the
     * vertical. Take one, preferring the far side because that is where the barrel already
     * is; if neither has one (both survivors overhead), take the widest shot available.
     */
    const MIN_ACROSS = 120;
    const pick = (index: 0 | 1): BrickState | null => {
      const from = PIVOT_X[index]!;
      let best: BrickState | null = null;
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        if (Math.abs(brick.x + brick.w / 2 - from) < MIN_ACROSS) continue;
        if (!best || brick.y > best.y) best = brick;
      }
      return best;
    };
    const other: 0 | 1 = prefer === 0 ? 1 : 0;
    let index = prefer;
    let target = pick(prefer);
    if (!target) {
      target = pick(other);
      if (target) index = other;
    }
    if (!target) {
      // Nothing is far enough from either machine. Take the widest line there is, and let
      // the angle floor sort the rest out.
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        for (const i of [0, 1] as const) {
          const reach = Math.abs(brick.x + brick.w / 2 - PIVOT_X[i]!);
          const bestReach = target ? Math.abs(target.x + target.w / 2 - PIVOT_X[index]!) : -1;
          if (reach > bestReach) {
            target = brick;
            index = i;
          }
        }
      }
    }
    if (!target) return;
    const dx = target.x + target.w / 2 - PIVOT_X[index]!;
    const dy = target.y + target.h - PIVOT_Y;
    const mag = Math.hypot(dx, dy) || 1;
    this.shot = { index, ux: dx / mag, uy: dy / mag };
    this.aimed = true;
  }

  /**
   * Throw. Out of the muzzle of whichever machine laid the shot, along the line its
   * barrel has been pointing down for `CANNON.AIM` seconds — so it arrives on the tray.
   *
   * The mark leaves at the **mouth** of the barrel (`CANNON.BARREL` from the pivot) and
   * that is on the same ray as the aim, so where it lands is unchanged by where it
   * appears: the throw is one straight line from the machine to the tray.
   */
  private serve(): void {
    if (!this.shot) this.takeAim();
    const { index, ux, uy } = this.shot!;
    const speed = this.speedNow();
    this.ball = {
      x: PIVOT_X[index]! + ux * C.BARREL,
      y: PIVOT_Y + uy * C.BARREL,
      vx: ux * speed,
      vy: uy * speed,
      d: B.D,
    };
    // A block straight above the machine would leave on a vertical, which is the one line
    // this room cannot allow. Only the sideways floor: the *vertical* floor would bend a
    // flat throw off the block it is aimed at (see `keepOffVertical`).
    this.keepOffVertical(this.ball);
    this.serves += 1;
    this.sinceBreak = 0;
    this.firedAt = this.t;
    // Nothing is scheduled until a mark is lost; the barrel stays where it fired.
    this.aimed = false;
    this.nextServeAt = Number.POSITIVE_INFINITY;
  }

  /** The wall speeds up as it thins, capped. */
  private speedNow(): number {
    return Math.min(B.MAX_SPEED, B.SPEED + this.broken * B.SPEED_GAIN);
  }

  private updateBall(dt: number): void {
    if (this.lost) {
      this.lost.fade = Math.min(1, this.lost.fade + dt / B.LOST_FADE);
      if (this.lost.fade >= 1) this.lost = null;
    }
    if (this._phase !== 'rally') return;
    if (!this.ball) {
      // The barrel moves first and the shot follows: `takeAim` reads the tray where it is
      // now, so the wind-up the player is watching is the trajectory they will get.
      if (!this.aimed && this.t >= this.nextServeAt - C.AIM) this.takeAim();
      if (this.t >= this.nextServeAt) this.serve();
      return;
    }
    const ball = this.ball;
    this.sinceBreak += dt;
    if (this.sinceBreak >= B.STALL_NUDGE_AFTER) this.steer(ball);
    const dist = Math.hypot(ball.vx, ball.vy) * dt;
    const steps = Math.max(1, Math.ceil(dist / BALL_STEP));
    for (let i = 0; i < steps; i += 1) {
      ball.x += (ball.vx * dt) / steps;
      ball.y += (ball.vy * dt) / steps;
      this.bounceRoom(ball);
      this.bounceTray(ball);
      this.hitBricks(ball);
      if (this.checkLost(ball)) return;
      // The last block ends the rally mid-sweep: there is nothing left to move.
      if (!this.ball) return;
    }
  }

  private bounceRoom(ball: BallState): void {
    if (ball.x - BALL_R < PLAY_LEFT) {
      ball.x = PLAY_LEFT + BALL_R;
      ball.vx = Math.abs(ball.vx);
      this.wallHits += 1;
    } else if (ball.x + BALL_R > PLAY_RIGHT) {
      ball.x = PLAY_RIGHT - BALL_R;
      ball.vx = -Math.abs(ball.vx);
      this.wallHits += 1;
    }
    if (ball.y - BALL_R < R.CEILING) {
      ball.y = R.CEILING + BALL_R;
      ball.vy = Math.abs(ball.vy);
      this.wallHits += 1;
    }
  }

  /**
   * The tray. Deliberately forgiving: any contact while the mark is falling counts as
   * a top hit and puts it back above the tray, so a mark that clips the tray's edge is
   * returned rather than swallowed. This is the one bonus stage in a game about being
   * helped; a pixel-exact paddle would be the only place in it that punishes.
   */
  private bounceTray(ball: BallState): void {
    if (ball.vy <= 0) return;
    const box: AABB = { x: ball.x - BALL_R, y: ball.y - BALL_R, w: B.D, h: B.D };
    if (!aabbOverlap(box, this.paddleBox())) return;
    const offset = Math.max(-1, Math.min(1, (ball.x - this.tray.x) / (P.W / 2 + BALL_R)));
    let deg = offset * P.MAX_BOUNCE_DEG;
    /*
     * Never straight up (`MIN_BOUNCE_DEG`). A vertical return in a column that has
     * already been emptied is a closed orbit between the tray and the ceiling, and this
     * room's only exit is an empty wall — so the ball has to leave every bounce with
     * somewhere to go. A dead-centre hit leans the way the mark was already travelling,
     * which is the reading a player expects of a flat surface anyway.
     */
    if (Math.abs(deg) < P.MIN_BOUNCE_DEG) {
      deg = (ball.vx >= 0 ? 1 : -1) * P.MIN_BOUNCE_DEG;
    }
    const angle = (deg * Math.PI) / 180;
    const speed = Math.max(this.speedNow(), Math.hypot(ball.vx, ball.vy));
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.max(Math.cos(angle), B.MIN_VY_FRACTION) * speed;
    ball.y = this.tray.y - BALL_R;
    this.paddleHits += 1;
  }

  /**
   * The watchdog: a mark that has not taken a block in `STALL_NUDGE_AFTER` seconds is
   * turned by `NUDGE_DEG`, deterministically, until it does.
   *
   * It exists because the exit is an empty wall. `MIN_BOUNCE_DEG` rules out the vertical
   * orbit; this rules out every other path that closes on itself, and it can never fire
   * during a real rally — five seconds without touching the wall is not one. The turn is
   * signalled (`nudges`) so the host can put a sound on it: something moving on its own
   * with nothing to hear reads as a defect.
   */
  private steer(ball: BallState): void {
    const sign = this.rnd() > 0.5 ? 1 : -1;
    const rad = (sign * B.NUDGE_DEG * Math.PI) / 180;
    // Both components come off the ORIGINAL vector: assigning vx first and reading it
    // back for vy is not a rotation, it is a shear, and it does not preserve the speed.
    const { vx, vy } = ball;
    ball.vx = vx * Math.cos(rad) - vy * Math.sin(rad);
    ball.vy = vx * Math.sin(rad) + vy * Math.cos(rad);
    this.keepAngleHonest(ball);
    this.sinceBreak = 0;
    this.nudges += 1;
  }

  /**
   * Hold the mark off both axes, keeping its speed.
   *
   * Every place the direction is *chosen* has to run through here, and the watchdog is
   * the one that proves why: a nudge is a rotation, so turning a mark that was already
   * at 20 degrees by 18 can land it at 2 — which is precisely the closed vertical orbit
   * the nudge exists to break. Right in code, wrong in effect, and only a test that
   * measures the ball on *every* frame catches it.
   */
  /**
   * The half of the rule above that **every** direction obeys, including a throw: the mark
   * always has somewhere to go sideways, because a vertical in an emptied column is a
   * closed orbit and this room's only exit is an empty wall.
   *
   * The other half — the `MIN_VY_FRACTION` floor — is a rule about the mark once it is *in
   * play*, and applying it to a throw is a defect that cost this pass an hour: the wall
   * throw at the end of a stalled rally is aimed at a specific block, and a shot laid at
   * 2 degrees off the horizontal was bent to 20 and sailed over it. Every time. One block
   * left after ten minutes, from a clamp that was right in general and wrong here.
   */
  private keepOffVertical(ball: BallState): void {
    const speed = Math.hypot(ball.vx, ball.vy) || 1;
    const minVx = Math.sin((P.MIN_BOUNCE_DEG * Math.PI) / 180) * speed;
    if (Math.abs(ball.vx) < minVx) {
      ball.vx = Math.sign(ball.vx || 1) * minVx;
      ball.vy = Math.sign(ball.vy || 1) * Math.sqrt(Math.max(0, speed * speed - minVx * minVx));
    }
  }

  private keepAngleHonest(ball: BallState): void {
    this.keepOffVertical(ball);
    const speed = Math.hypot(ball.vx, ball.vy) || 1;
    const minVy = B.MIN_VY_FRACTION * speed;
    if (Math.abs(ball.vy) < minVy) {
      ball.vy = Math.sign(ball.vy || 1) * minVy;
      ball.vx = Math.sign(ball.vx || 1) * Math.sqrt(Math.max(0, speed * speed - minVy * minVy));
    }
  }

  /**
   * One block per sub-step, resolved on the shallower axis — the standard breakout
   * answer, and the only one that gets a corner hit right.
   */
  private hitBricks(ball: BallState): void {
    if (this.t < BEAT.BRICKS_AT) return;
    const box: AABB = { x: ball.x - BALL_R, y: ball.y - BALL_R, w: B.D, h: B.D };
    for (const brick of this.bricks) {
      if (!brick.alive || brick.reveal < 1) continue;
      if (!aabbOverlap(box, brick)) continue;
      const overlapX =
        ball.vx > 0 ? box.x + box.w - brick.x : brick.x + brick.w - box.x;
      const overlapY =
        ball.vy > 0 ? box.y + box.h - brick.y : brick.y + brick.h - box.y;
      if (overlapX < overlapY) {
        ball.vx = -ball.vx;
        ball.x += ball.vx > 0 ? overlapX : -overlapX;
      } else {
        ball.vy = -ball.vy;
        ball.y += ball.vy > 0 ? overlapY : -overlapY;
      }
      brick.alive = false;
      brick.sinceBroken = 0;
      this.broken += 1;
      this.breaks += 1;
      this.sinceBreak = 0;
      this.missesSinceBreak = 0;
      // Re-scale to the new speed, keeping the direction the bounce just chose.
      const speed = this.speedNow();
      const mag = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = (ball.vx / mag) * speed;
      ball.vy = (ball.vy / mag) * speed;
      if (this.remaining === 0) {
        // The last block takes the mark with it: it goes back up the shaft it came
        // out of, and the room's business is finished.
        this.ball = null;
        this.clearedAt = this.t;
        this._phase = 'cleared';
      }
      return;
    }
  }

  /**
   * A miss. The mark reaches the floor, lies there and fades (owner: "once the logo
   * hits the ground it vanishes in some time"), and **the other cannon** loads the next
   * one — with the wall exactly as the last one left it.
   */
  private checkLost(ball: BallState): boolean {
    if (ball.y + BALL_R < R.FLOOR_Y) return false;
    this.lost = { x: ball.x, y: R.FLOOR_Y - BALL_R, fade: 0 };
    this.ball = null;
    this.losses += 1;
    this.missesSinceBreak += 1;
    this.nextServeAt = this.t + B.LOST_FADE + B.RESPAWN_GAP;
    this.aimed = false;
    return true;
  }

  /** The draught, and the moment it takes hold. */
  private updateExit(player: Player): void {
    if (!this.suctionOn) return;
    if (this._phase === 'cleared') this._phase = 'leaving';
    const box = player.box;
    const inside = box.x + box.w > TUNNEL_LEFT && box.x < TUNNEL_RIGHT;
    if (inside) this._carrying = true;
  }

  /**
   * Being drawn up the shaft — **the one place in this stage where the room moves the
   * player**, which is why nothing else is simulated on these frames.
   *
   * He is centred in the column as he rises (`CENTRE_SPEED`) so he never scrapes the
   * mouth, and `prevX`/`prevY` are kept by hand because `Player.update` is not the
   * thing doing the moving.
   */
  private lift(dt: number, player: Player): void {
    player.prevX = player.box.x;
    player.prevY = player.box.y;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    const targetX = R.TUNNEL_CX - player.box.w / 2;
    const dx = targetX - player.box.x;
    const step = EXIT.CENTRE_SPEED * dt;
    player.box.x += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    player.box.y -= EXIT.SUCK_SPEED * dt;
    if (player.box.y + player.box.h <= 0) this._phase = 'done';
  }
}
