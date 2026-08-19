import { describe, it, expect } from 'vitest';
import { DELAY_FLIGHT_TIME, delayFlightPose } from './delayFlight';
import { LIVES } from '../data/tuning.config';

const FROM = { x: 300, y: 540 };
const TO = { x: 1120, y: 120 };

describe('the delay flying from the place of death to the log', () => {
  it('finishes before the stage restarts and covers the frame', () => {
    // The whole animation lives inside the life-lost beat. Longer than that and the
    // title card lands on top of a label still in the air.
    expect(DELAY_FLIGHT_TIME).toBeLessThan(LIVES.LOST_HOLD);
  });

  it('starts on the body and lands on the panel', () => {
    const start = delayFlightPose(FROM, TO, 0);
    expect(start.x).toBeCloseTo(FROM.x, 5);
    expect(start.y).toBeCloseTo(FROM.y, 5);
    const end = delayFlightPose(FROM, TO, 1);
    expect(end.x).toBeCloseTo(TO.x, 5);
    expect(end.y).toBeCloseTo(TO.y, 5);
  });

  it('is held over the body long enough to be read before it travels', () => {
    // A label that starts moving on the frame it appears is a thing you notice
    // rather than a thing you read.
    const held = delayFlightPose(FROM, TO, 0.2);
    expect(Math.abs(held.x - FROM.x)).toBeLessThan(1);
    expect(held.alpha).toBe(1);
  });

  it('arcs above the straight line rather than sliding across it', () => {
    const mid = delayFlightPose(FROM, TO, 0.65);
    const straightY = FROM.y + (TO.y - FROM.y) * 0.5;
    expect(mid.y).toBeLessThan(straightY);
  });

  it('travels monotonically towards the panel once it sets off', () => {
    let prev = -Infinity;
    for (let p = 0.3; p <= 1.0001; p += 0.05) {
      const pose = delayFlightPose(FROM, TO, p);
      expect(pose.x).toBeGreaterThanOrEqual(prev - 0.001);
      prev = pose.x;
    }
  });

  it('holds still under reduced motion, and still fades out', () => {
    for (const p of [0, 0.5, 0.9]) {
      const pose = delayFlightPose(FROM, TO, p, true);
      expect(pose.x).toBe(FROM.x);
      expect(pose.y).toBe(FROM.y);
    }
    expect(delayFlightPose(FROM, TO, 1, true).alpha).toBeCloseTo(0, 5);
  });

  it('is at full strength while it is being read and while it travels', () => {
    expect(delayFlightPose(FROM, TO, 0.5).alpha).toBe(1);
    expect(delayFlightPose(FROM, TO, 0.79).alpha).toBe(1);
    expect(delayFlightPose(FROM, TO, 1).alpha).toBeCloseTo(0, 5);
  });
});
