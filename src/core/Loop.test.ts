import { describe, it, expect } from 'vitest';
import { advanceAccumulator, Loop } from './Loop';

const FIXED = 1 / 60;
const MAXDT = 0.25;

describe('advanceAccumulator', () => {
  it('runs exactly one step for a nominal 60 Hz frame', () => {
    const r = advanceAccumulator(0, FIXED, FIXED, MAXDT);
    expect(r.steps).toBe(1);
    expect(r.alpha).toBeCloseTo(0, 5);
  });

  it('runs two steps for a 30 Hz frame', () => {
    const r = advanceAccumulator(0, 1 / 30, FIXED, MAXDT);
    expect(r.steps).toBe(2);
  });

  it('clamps a long frame (tab-away) to avoid a spiral of death', () => {
    const r = advanceAccumulator(0, 10, FIXED, MAXDT);
    expect(r.clampedDt).toBeCloseTo(MAXDT, 5);
    // 0.25s / (1/60) = 15 steps max.
    expect(r.steps).toBe(15);
  });

  it('carries the remainder across frames deterministically', () => {
    let acc = 0;
    let total = 0;
    for (let i = 0; i < 3; i += 1) {
      const r = advanceAccumulator(acc, 1 / 100, FIXED, MAXDT);
      acc = r.acc;
      total += r.steps;
    }
    // 3 * 0.01 = 0.03s of sim → 1 full step (0.0167), remainder carried.
    expect(total).toBe(1);
    expect(acc).toBeCloseTo(0.03 - FIXED, 5);
  });

  it('scales sim speed with timeScale (assist slow mode)', () => {
    const full = advanceAccumulator(0, 1 / 30, FIXED, MAXDT, 1).steps;
    const slow = advanceAccumulator(0, 1 / 30, FIXED, MAXDT, 0.5).steps;
    expect(full).toBe(2);
    expect(slow).toBe(1);
  });
});

describe('Loop', () => {
  it('drives fixed steps from injected clock/raf', () => {
    let steps = 0;
    let renders = 0;
    const loop = new Loop({
      step: () => (steps += 1),
      render: () => (renders += 1),
      now: () => 0,
      raf: () => 1,
      caf: () => {},
    });
    loop.start();
    loop.frame(17); // 17ms → 1 step (remainder carried)
    expect(steps).toBe(1);
    expect(renders).toBe(1);
    loop.frame(51); // +34ms → 2 steps
    expect(steps).toBe(3);
    expect(renders).toBe(2);
  });

  it('does nothing after stop()', () => {
    let steps = 0;
    const loop = new Loop({
      step: () => (steps += 1),
      render: () => {},
      now: () => 0,
      raf: () => 1,
      caf: () => {},
    });
    loop.start();
    loop.stop();
    loop.frame(100);
    expect(steps).toBe(0);
  });
});
