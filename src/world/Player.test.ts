import { describe, it, expect } from 'vitest';
import { Player } from './Player';
import { makeInput } from '../core/Input';
import { PLAYER, LOOP } from '../data/tuning.config';
import type { AABB } from './Physics';

const DT = LOOP.FIXED_DT;
const GROUND: AABB = { x: -2000, y: 400, w: 8000, h: 200 };
const REST_Y = 400 - PLAYER.HEIGHT;

function grounded(): Player {
  const p = new Player(100, REST_Y);
  for (let i = 0; i < 4; i += 1) p.update(DT, makeInput(), [GROUND]);
  return p;
}

describe('Player physics', () => {
  it('rests on the ground after settling', () => {
    const p = grounded();
    expect(p.onGround).toBe(true);
    expect(p.box.y).toBeCloseTo(REST_Y, 0);
    expect(p.vy).toBe(0);
  });

  it('reaches a full-jump apex of ~140px', () => {
    const p = grounded();
    const startY = p.box.y;
    p.update(DT, makeInput({ jumpPressed: true, jumpHeld: true }), [GROUND]);
    let minY = p.box.y;
    for (let i = 0; i < 400; i += 1) {
      p.update(DT, makeInput({ jumpHeld: true }), [GROUND]);
      minY = Math.min(minY, p.box.y);
      if (p.onGround) break;
    }
    const apex = startY - minY;
    expect(apex).toBeGreaterThan(130);
    expect(apex).toBeLessThan(160);
  });

  it('cuts the jump short when the button is released early (variable height)', () => {
    const full = grounded();
    full.update(DT, makeInput({ jumpPressed: true, jumpHeld: true }), [GROUND]);
    let fullApex = full.box.y;
    for (let i = 0; i < 400; i += 1) {
      full.update(DT, makeInput({ jumpHeld: true }), [GROUND]);
      fullApex = Math.min(fullApex, full.box.y);
      if (full.onGround) break;
    }

    const tap = grounded();
    const startY = tap.box.y;
    // Press once, then immediately release (no jumpHeld on subsequent frames).
    tap.update(DT, makeInput({ jumpPressed: true, jumpHeld: true }), [GROUND]);
    let tapApex = tap.box.y;
    for (let i = 0; i < 400; i += 1) {
      tap.update(DT, makeInput({}), [GROUND]);
      tapApex = Math.min(tapApex, tap.box.y);
      if (tap.onGround) break;
    }

    expect(startY - tapApex).toBeLessThan(startY - fullApex);
  });

  it('honours coyote-time: can jump shortly after leaving a ledge', () => {
    const p = grounded();
    // Walk off into empty space (no solids).
    p.update(DT, makeInput({}), []); // airborne, coyote counting from full
    p.update(DT, makeInput({ jumpPressed: true, jumpHeld: true }), []);
    expect(p.vy).toBeLessThan(-600); // a jump fired
  });

  it('rejects a jump once coyote-time has expired', () => {
    const p = grounded();
    for (let i = 0; i < 10; i += 1) p.update(DT, makeInput({}), []); // fall past coyote window
    p.update(DT, makeInput({ jumpPressed: true, jumpHeld: true }), []);
    expect(p.vy).toBeGreaterThan(0); // still falling, no jump
  });

  it('honours the jump-buffer: an early press fires on landing', () => {
    const p = new Player(100, REST_Y - 10); // just above the ground, airborne
    // Press jump while airborne; it should be buffered until we land.
    p.update(DT, makeInput({ jumpPressed: true, jumpHeld: true }), [GROUND]);
    let jumped = false;
    for (let i = 0; i < 20; i += 1) {
      p.update(DT, makeInput({ jumpHeld: true }), [GROUND]);
      if (p.vy < -500) {
        jumped = true;
        break;
      }
    }
    expect(jumped).toBe(true);
  });

  it('clamps to terminal velocity in free fall', () => {
    const p = new Player(0, 0);
    for (let i = 0; i < 400; i += 1) p.update(DT, makeInput({}), []);
    expect(p.vy).toBeLessThanOrEqual(PLAYER.MAX_FALL_SPEED);
    expect(p.vy).toBeCloseTo(PLAYER.MAX_FALL_SPEED, 0);
  });

  it('grants spawn i-frames that decay', () => {
    const p = new Player(0, REST_Y);
    p.respawn(100, REST_Y);
    expect(p.isInvulnerable).toBe(true);
    for (let i = 0; i < 60; i += 1) p.update(DT, makeInput(), [GROUND]);
    expect(p.isInvulnerable).toBe(false);
  });
});
