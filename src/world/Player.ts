/**
 * Player — "Beam".
 *
 * Movement feel (all values from tuning.config PLAYER):
 *  - separate ground/air acceleration + friction toward a target walk speed;
 *  - semi-implicit Euler gravity clamped to MAX_FALL_SPEED;
 *  - variable-height jump: releasing early cuts upward velocity once;
 *  - coyote-time: a short grace window to jump after leaving a ledge;
 *  - jump-buffer: an early press is remembered until landing;
 *  - spawn i-frames: brief invulnerability after (re)spawn.
 *
 * Deterministic and headless — no rendering here. `prevX/prevY` snapshot the
 * pre-step position so the renderer can interpolate.
 */
import { PLAYER } from '../data/tuning.config';
import type { InputState } from '../core/Input';
import { type AABB, moveAndCollide } from './Physics';

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
}

export class Player {
  readonly box: AABB;
  vx = 0;
  vy = 0;
  prevX: number;
  prevY: number;

  onGround = false;
  facing: 1 | -1 = 1;

  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private jumpCutApplied = false;
  invulnTimer = 0;

  constructor(x: number, y: number) {
    this.box = { x, y, w: PLAYER.WIDTH, h: PLAYER.HEIGHT };
    this.prevX = x;
    this.prevY = y;
  }

  /** Move to a spawn point and reset motion + grant spawn i-frames. */
  respawn(x: number, y: number): void {
    this.box.x = x;
    this.box.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpCutApplied = false;
    this.invulnTimer = PLAYER.SPAWN_INVULN;
  }

  get isInvulnerable(): boolean {
    return this.invulnTimer > 0;
  }

  /**
   * Advance one fixed step.
   * @param speedMult horizontal drag from surfaces like quicksand (default 1).
   */
  update(dt: number, input: InputState, solids: readonly AABB[], speedMult = 1): void {
    this.prevX = this.box.x;
    this.prevY = this.box.y;

    // Coyote-time counts down from the last frame we were grounded.
    this.coyoteTimer = this.onGround ? PLAYER.COYOTE_TIME : Math.max(0, this.coyoteTimer - dt);

    // Jump buffer remembers an early press.
    this.jumpBufferTimer = input.jumpPressed
      ? PLAYER.JUMP_BUFFER
      : Math.max(0, this.jumpBufferTimer - dt);

    // Horizontal acceleration toward the target walk speed.
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) this.facing = dir > 0 ? 1 : -1;
    const target = dir * PLAYER.WALK_SPEED * speedMult;
    if (dir !== 0) {
      const accel = this.onGround ? PLAYER.GROUND_ACCEL : PLAYER.AIR_ACCEL;
      this.vx = approach(this.vx, target, accel * dt);
    } else {
      const friction = this.onGround ? PLAYER.GROUND_FRICTION : PLAYER.AIR_FRICTION;
      this.vx = approach(this.vx, 0, friction * dt);
    }

    // Jump (coyote + buffer). Consume both on success.
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.vy = PLAYER.JUMP_VELOCITY;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      this.onGround = false;
      this.jumpCutApplied = false;
    }

    // Variable-height: cut the rise once when the button is released mid-jump.
    if (!input.jumpHeld && this.vy < 0 && !this.jumpCutApplied) {
      this.vy *= PLAYER.JUMP_CUT_MULTIPLIER;
      this.jumpCutApplied = true;
    }

    // Gravity (semi-implicit Euler) with terminal-velocity clamp.
    this.vy = Math.min(this.vy + PLAYER.GRAVITY * dt, PLAYER.MAX_FALL_SPEED);

    // Integrate + resolve.
    const res = moveAndCollide(this.box, this.vx, this.vy, dt, solids);
    this.box.x = res.x;
    this.box.y = res.y;
    this.vx = res.vx;
    this.vy = res.vy;
    this.onGround = res.onGround;

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
  }
}
