import { describe, it, expect } from 'vitest';
import { finaleLayout } from './finaleScene';
import { computeViewport } from './Renderer';
import { RESOLUTION } from '../data/tuning.config';

describe('finaleLayout (Tech Park hero scene)', () => {
  it('lays the tower on the plaza with a full window grid and bloom crown', () => {
    const l = finaleLayout();
    // Tower base rests on the ground band; crown keeps the level's facade top.
    expect(l.tower.y).toBe(8 * RESOLUTION.TILE);
    expect(l.tower.y + l.tower.h).toBe(l.horizonY);
    // Plaza fills below the horizon.
    expect(l.plaza.y).toBe(l.horizonY);
    expect(l.plaza.w).toBe(RESOLUTION.WIDTH);
    // 4×8 glass grid, all panes inside the tower face.
    expect(l.windows.length).toBe(32);
    for (const w of l.windows) {
      expect(w.x).toBeGreaterThanOrEqual(l.tower.x);
      expect(w.x + w.w).toBeLessThanOrEqual(l.tower.x + l.tower.w);
      expect(w.y).toBeGreaterThanOrEqual(l.tower.y);
      expect(w.y + w.h).toBeLessThanOrEqual(l.tower.y + l.tower.h);
    }
    // Bloom sits at the tower crown.
    expect(l.bloom.x).toBe(l.tower.x + l.tower.w / 2);
    expect(l.bloom.y).toBeLessThan(l.tower.y + 60);
  });

  it('is a stable, deterministic layout (snapshot)', () => {
    const l = finaleLayout();
    const compact = {
      horizonY: l.horizonY,
      plaza: l.plaza,
      tower: l.tower,
      bloom: l.bloom,
      mark: l.mark,
      skyStops: l.sky.map((s) => s.offset),
      windowCount: l.windows.length,
    };
    expect(compact).toMatchInlineSnapshot(`
      {
        "bloom": {
          "r": 190,
          "x": 1040,
          "y": 350,
        },
        "horizonY": 600,
        "mark": {
          "r": 46,
          "x": 204.8,
          "y": 450,
        },
        "plaza": {
          "h": 120,
          "w": 1280,
          "x": 0,
          "y": 600,
        },
        "skyStops": [
          0,
          0.55,
          0.82,
          1,
        ],
        "tower": {
          "h": 280,
          "w": 320,
          "x": 880,
          "y": 320,
        },
        "windowCount": 32,
      }
    `);
  });

  it('composes identically regardless of display scale (1× vs 2×)', () => {
    // Internal-space layout must not change with the device pixel ratio.
    expect(finaleLayout()).toEqual(finaleLayout());
    // A 2× display of the 1280×720 frame is an exact 2.0 contain-fit.
    const v1 = computeViewport(RESOLUTION.WIDTH, RESOLUTION.HEIGHT);
    const v2 = computeViewport(RESOLUTION.WIDTH * 2, RESOLUTION.HEIGHT * 2);
    expect(v1.scale).toBe(1);
    expect(v2.scale).toBe(2);
  });
});
