import { describe, it, expect } from 'vitest';
import { moveAndCollide, aabbOverlap, isOnGround, type AABB } from './Physics';
import { PLAYER } from '../data/tuning.config';

const groundAt = (topY: number): AABB => ({ x: -1000, y: topY, w: 4000, h: 200 });

describe('aabbOverlap', () => {
  it('detects overlap and separation', () => {
    expect(aabbOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(aabbOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 })).toBe(false);
  });
});

describe('moveAndCollide', () => {
  it('lands a body on top of the ground and reports onGround', () => {
    const box: AABB = { x: 100, y: 0, w: PLAYER.WIDTH, h: PLAYER.HEIGHT };
    const ground = groundAt(400);
    const r = moveAndCollide(box, 0, 2000, 1, [ground]); // huge downward velocity
    expect(r.y + box.h).toBeCloseTo(400, 1);
    expect(r.onGround).toBe(true);
    expect(r.vy).toBe(0);
  });

  it('never tunnels through a thin solid at terminal velocity', () => {
    // A single tile-thick solid; body starts above and slams down for 1s.
    const solid: AABB = { x: 0, y: 500, w: 40, h: 40 };
    const box: AABB = { x: 5, y: 0, w: PLAYER.WIDTH, h: PLAYER.HEIGHT };
    const r = moveAndCollide(box, 0, PLAYER.MAX_FALL_SPEED, 1, [solid]);
    // Must rest on top of the solid, not pass through it.
    expect(r.y + box.h).toBeLessThanOrEqual(500 + 0.5);
    expect(r.onGround).toBe(true);
  });

  it('stops at a wall when moving horizontally', () => {
    const wall: AABB = { x: 200, y: 0, w: 40, h: 400 };
    const box: AABB = { x: 100, y: 100, w: PLAYER.WIDTH, h: PLAYER.HEIGHT };
    const r = moveAndCollide(box, 4000, 0, 1, [wall]);
    expect(r.x + box.w).toBeCloseTo(200, 1);
    expect(r.hitWall).toBe(true);
    expect(r.vx).toBe(0);
  });

  it('bonks a ceiling when moving up', () => {
    const ceiling: AABB = { x: 0, y: 0, w: 400, h: 40 };
    const box: AABB = { x: 100, y: 200, w: PLAYER.WIDTH, h: PLAYER.HEIGHT };
    const r = moveAndCollide(box, 0, -2000, 1, [ceiling]);
    expect(r.y).toBeCloseTo(40, 1);
    expect(r.hitCeiling).toBe(true);
  });

  it('isOnGround probes 1px below', () => {
    const ground = groundAt(300);
    const resting: AABB = { x: 0, y: 300 - PLAYER.HEIGHT, w: PLAYER.WIDTH, h: PLAYER.HEIGHT };
    expect(isOnGround(resting, [ground])).toBe(true);
    const floating: AABB = { x: 0, y: 100, w: PLAYER.WIDTH, h: PLAYER.HEIGHT };
    expect(isOnGround(floating, [ground])).toBe(false);
  });
});
