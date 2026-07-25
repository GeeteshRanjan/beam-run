import { describe, it, expect } from 'vitest';
import { finaleLayout, type Rect } from './finaleScene';
import { computeViewport } from './Renderer';
import { RESOLUTION } from '../data/tuning.config';

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('finaleLayout (Tech Park hero scene)', () => {
  it('lays the tower on the plaza, crowned and signed', () => {
    const l = finaleLayout();
    // Tower base rests on the ground band; crown keeps the level's facade top.
    expect(l.tower.y).toBe(8 * RESOLUTION.TILE);
    expect(l.tower.y + l.tower.h).toBe(l.horizonY);
    expect(l.plaza.y).toBe(l.horizonY);
    expect(l.plaza.w).toBe(RESOLUTION.WIDTH);

    // Crown, mast and beacon stack upward off the tower top, inside the frame.
    expect(l.crown.y + l.crown.h).toBe(l.tower.y);
    expect(l.mast.y + l.mast.h).toBe(l.crown.y);
    expect(l.beacon.y).toBeLessThan(l.mast.y);
    expect(l.beacon.y - l.beacon.r).toBeGreaterThan(0);
    // Everything vertical is centred on the tower.
    const cx = l.tower.x + l.tower.w / 2;
    for (const x of [l.mast.x + l.mast.w / 2, l.beacon.x, l.sign.x + l.sign.w / 2, l.bloom.x]) {
      expect(x).toBeCloseTo(cx, 6);
    }
  });

  it('sits the doors on the ground so the run ends by walking inside', () => {
    const l = finaleLayout();
    expect(l.entrance.y + l.entrance.h).toBe(l.horizonY);
    // Doorway and canopy stay within the tower footprint.
    expect(l.entrance.x).toBeGreaterThanOrEqual(l.tower.x);
    expect(l.entrance.x + l.entrance.w).toBeLessThanOrEqual(l.tower.x + l.tower.w);
    expect(l.canopy.y + l.canopy.h).toBe(l.entrance.y);
    expect(l.canopy.w).toBeGreaterThan(l.entrance.w);
    // The win trigger (gx26) is inside the doorway span, not past the tower.
    const triggerX = 26 * RESOLUTION.TILE;
    expect(triggerX).toBeGreaterThan(l.entrance.x - RESOLUTION.TILE);
    expect(triggerX).toBeLessThan(l.entrance.x + l.entrance.w + RESOLUTION.TILE);
  });

  it('keeps glass panes on the facade and clear of the sign and the doors', () => {
    const l = finaleLayout();
    // Panes are dropped where the sign/doors sit, so fewer than the 5×10 grid.
    expect(l.windows.length).toBeGreaterThan(20);
    expect(l.windows.length).toBeLessThan(50);
    for (const w of l.windows) {
      expect(w.x).toBeGreaterThanOrEqual(l.tower.x);
      expect(w.x + w.w).toBeLessThanOrEqual(l.tower.x + l.tower.w);
      expect(w.y).toBeGreaterThanOrEqual(l.tower.y);
      expect(w.y + w.h).toBeLessThanOrEqual(l.tower.y + l.tower.h);
      expect(overlaps(w, l.sign)).toBe(false);
      expect(overlaps(w, l.entrance)).toBe(false);
      expect(overlaps(w, l.canopy)).toBe(false);
    }
  });

  it('paves the sky in solid bands that tile it exactly', () => {
    const l = finaleLayout();
    expect(l.skyBands.length).toBe(12);
    expect(l.skyBands[0]!.y).toBe(0);
    const last = l.skyBands[l.skyBands.length - 1]!;
    expect(last.y + last.h).toBe(l.horizonY);
    for (const b of l.skyBands) expect(b.color).toMatch(/^#[0-9a-f]{6}$/);
    // Bands run from the deep-teal top to the warm dawn at the horizon.
    expect(l.skyBands[0]!.color).not.toBe(last.color);
  });

  it('stands the plaza furniture and the welcome party on the ground line', () => {
    const l = finaleLayout();
    expect(l.lamps.length).toBeGreaterThan(0);
    expect(l.planters.length).toBeGreaterThan(0);
    expect(l.people.length).toBeGreaterThan(0);
    for (const item of [...l.lamps, ...l.planters, ...l.people]) {
      expect(item.x).toBeGreaterThan(0);
      expect(item.x).toBeLessThan(RESOLUTION.WIDTH);
    }
    // The medallion is inlaid *below* the walking line, so it reads as floor.
    expect(l.medallion.y).toBeGreaterThan(l.horizonY);
    expect(l.medallion.y).toBeLessThan(RESOLUTION.HEIGHT);
    // Distant skyline never rises above the ANSR tower.
    for (const b of l.skyline) expect(b.y).toBeGreaterThan(l.tower.y);
  });

  it('is a stable, deterministic layout (snapshot)', () => {
    const l = finaleLayout();
    const compact = {
      horizonY: l.horizonY,
      tower: l.tower,
      crown: l.crown,
      sign: l.sign,
      mark: l.mark,
      entrance: l.entrance,
      sun: l.sun,
      medallion: l.medallion,
      counts: {
        bands: l.skyBands.length,
        skyline: l.skyline.length,
        windows: l.windows.length,
        people: l.people.length,
      },
    };
    expect(compact).toMatchInlineSnapshot(`
      {
        "counts": {
          "bands": 12,
          "people": 7,
          "skyline": 12,
          "windows": 23,
        },
        "crown": {
          "h": 26,
          "w": 272,
          "x": 904,
          "y": 294,
        },
        "entrance": {
          "h": 92,
          "w": 88,
          "x": 996,
          "y": 508,
        },
        "horizonY": 600,
        "mark": {
          "r": 21,
          "x": 964,
          "y": 388,
        },
        "medallion": {
          "r": 30,
          "x": 435.20000000000005,
          "y": 655.2,
        },
        "sign": {
          "h": 56,
          "w": 212,
          "x": 934,
          "y": 360,
        },
        "sun": {
          "r": 126,
          "x": 1040,
          "y": 468,
        },
        "tower": {
          "h": 280,
          "w": 320,
          "x": 880,
          "y": 320,
        },
      }
    `);
  });

  it('composes identically regardless of display scale (1× vs 2×)', () => {
    // Internal-space layout must not change with the device pixel ratio.
    expect(finaleLayout()).toEqual(finaleLayout());
    const v1 = computeViewport(RESOLUTION.WIDTH, RESOLUTION.HEIGHT);
    const v2 = computeViewport(RESOLUTION.WIDTH * 2, RESOLUTION.HEIGHT * 2);
    expect(v1.scale).toBe(1);
    expect(v2.scale).toBe(2);
  });
});
