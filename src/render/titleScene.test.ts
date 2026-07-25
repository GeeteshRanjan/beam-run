import { describe, it, expect } from 'vitest';
import { titleLayout, TITLE_GROUND_Y } from './titleScene';
import { RESOLUTION } from '../data/tuning.config';

describe('titleLayout (attract screen)', () => {
  it('is deterministic — the title screen looks identical on every load', () => {
    expect(titleLayout()).toEqual(titleLayout());
  });

  it('stands every tower on the ground line, inside the frame', () => {
    const l = titleLayout();
    expect(l.groundY).toBe(TITLE_GROUND_Y);
    expect(l.groundY).toBeLessThan(RESOLUTION.HEIGHT);
    for (const tw of l.towers) {
      expect(tw.y + tw.h).toBe(l.groundY); // sitting on the ground, not floating
      expect(tw.y).toBeGreaterThan(0); // never clipped by the top edge
      expect(tw.lit).toBeGreaterThanOrEqual(0);
      expect(tw.lit).toBeLessThanOrEqual(1);
    }
  });

  it('rises left to right towards the ANSR tower, which is the tallest', () => {
    const l = titleLayout();
    const first = l.towers[0]!;
    const last = l.towers[l.towers.length - 1]!;
    expect(last.h).toBeGreaterThan(first.h);
    expect(last.lit).toBeGreaterThan(first.lit);
    expect(l.ansr.h).toBeGreaterThan(Math.max(...l.towers.map((t) => t.h)));
    expect(l.ansr.y + l.ansr.h).toBe(l.groundY);
    expect(l.ansr.x + l.ansr.w).toBeLessThanOrEqual(RESOLUTION.WIDTH);
  });

  it('places the hero on the ground, well left of the destination', () => {
    const l = titleLayout();
    expect(l.hero.feetY).toBe(l.groundY);
    expect(l.hero.x).toBeLessThan(l.ansr.x);
    expect(l.hero.x).toBeGreaterThan(0);
    // The sun sits behind the tower, above the horizon.
    expect(l.sun.y).toBeLessThan(l.groundY);
    expect(Math.abs(l.sun.x - (l.ansr.x + l.ansr.w / 2))).toBeLessThan(1);
  });
});
