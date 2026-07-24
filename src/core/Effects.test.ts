import { describe, it, expect } from 'vitest';
import { Effects } from './Effects';

describe('Effects (feel/juice layer)', () => {
  it('shake decays over its duration and reads non-zero while active', () => {
    const fx = new Effects(false);
    fx.addShake(8, 0.25);
    expect(fx.shakeActive).toBe(true);
    const o = fx.shakeOffset();
    expect(Math.abs(o.x) + Math.abs(o.y)).toBeGreaterThan(0);
    fx.update(0.3);
    expect(fx.shakeActive).toBe(false);
    expect(fx.shakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it('accumulates a trail and ages it out', () => {
    const fx = new Effects(false);
    fx.pushTrail(10, 20);
    fx.pushTrail(12, 22);
    expect(fx.trailSamples().length).toBe(2);
    fx.update(1); // > TRAIL_LIFE
    expect(fx.trailSamples().length).toBe(0);
  });

  it('emits particle bursts and dust that expire', () => {
    const fx = new Effects(false);
    fx.emitBurst(100, 100, '#FF5400', 12);
    fx.emitDust(100, 100, '#E6E6E6', 8);
    expect(fx.activeParticles().length).toBe(20);
    fx.update(1); // longer than any particle life
    expect(fx.activeParticles().length).toBe(0);
  });

  it('death flash rises then clears; hit-stop pauses briefly', () => {
    const fx = new Effects(false);
    fx.addFlash(0.2);
    expect(fx.flashAlpha()).toBeGreaterThan(0);
    fx.addHitStop(0.06);
    expect(fx.hitStopActive).toBe(true);
    fx.update(0.2);
    expect(fx.flashAlpha()).toBe(0);
    expect(fx.hitStopActive).toBe(false);
  });

  it('REDUCED MOTION disables shake, trail, particles, flash and hit-stop', () => {
    const fx = new Effects(true);
    fx.addShake(10, 0.3);
    fx.addFlash(0.3);
    fx.addHitStop(0.1);
    fx.pushTrail(1, 2);
    fx.emitBurst(0, 0, '#fff', 20);
    fx.emitDust(0, 0, '#fff', 20);
    expect(fx.shakeActive).toBe(false);
    expect(fx.shakeOffset()).toEqual({ x: 0, y: 0 });
    expect(fx.flashAlpha()).toBe(0);
    expect(fx.hitStopActive).toBe(false);
    expect(fx.trailSamples().length).toBe(0);
    expect(fx.activeParticles().length).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const a = new Effects(false, 12345);
    const b = new Effects(false, 12345);
    a.addShake(8, 0.25);
    b.addShake(8, 0.25);
    expect(a.shakeOffset()).toEqual(b.shakeOffset());
  });

  it('pools particles: never exceeds the cap and returns to zero (memory stable)', () => {
    const fx = new Effects(false);
    // Over-emit well beyond the pool cap.
    for (let i = 0; i < 50; i += 1) fx.emitBurst(0, 0, '#fff', 16);
    expect(fx.activeParticles().length).toBeLessThanOrEqual(140);
    // Many emit/age cycles must stay bounded and eventually drain.
    for (let i = 0; i < 200; i += 1) {
      fx.emitDust(0, 0, '#fff', 8);
      fx.update(1 / 60);
      expect(fx.activeParticles().length).toBeLessThanOrEqual(140);
    }
    for (let i = 0; i < 120; i += 1) fx.update(1 / 60);
    expect(fx.activeParticles().length).toBe(0);
  });

  it('caps the trail ring and clear() drains pools', () => {
    const fx = new Effects(false);
    for (let i = 0; i < 100; i += 1) fx.pushTrail(i, i);
    expect(fx.trailSamples().length).toBeLessThanOrEqual(14);
    fx.emitBurst(0, 0, '#fff', 16);
    fx.clear();
    expect(fx.trailSamples().length).toBe(0);
    expect(fx.activeParticles().length).toBe(0);
  });
});
