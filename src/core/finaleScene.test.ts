import { describe, it, expect } from 'vitest';
import { finaleLayout, type Rect } from './finaleScene';
import { computeViewport } from './Renderer';
import { RESOLUTION } from '../data/tuning.config';
import { getScreen } from '../data/levels';

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('finaleLayout (Tech Park hero scene)', () => {
  it('lays the tower on the plaza, crowned and signed', () => {
    const l = finaleLayout();
    // Tower base rests on the ground band; crown keeps the level's facade top.
    expect(l.tower.y).toBe(4 * RESOLUTION.TILE);
    expect(l.tower.y + l.tower.h).toBe(l.horizonY);
    // A landmark is taller than it is wide — it used to be 320×280, which read
    // as a block rather than a tower.
    expect(l.tower.h).toBeGreaterThan(l.tower.w * 1.25);
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

  it('shows the sun instead of hiding it behind the tower', () => {
    const l = finaleLayout();
    // Regression: the sun used to be centred on the tower at r=126 against a
    // 320px-wide facade and drawn *before* it, so it sat entirely inside the
    // tower rect and was never visible. Its dome must clear the crown.
    expect(l.sun.y - l.sun.r).toBeLessThan(l.crown.y - 80);
    expect(l.sun.y - l.sun.r).toBeGreaterThan(0); // and stay inside the frame
    // Wider than the tower, so it reads either side of the silhouette too.
    expect(l.sun.r * 2).toBeGreaterThan(l.tower.w);
  });

  it('builds the middle of the frame with a campus ramping up to the tower', () => {
    const l = finaleLayout();
    // Regression: the tower occupied the right quarter and the other 69% of the
    // frame was bare plaza. Mid-ground blocks now fill it, left of the tower.
    expect(l.campus.length).toBeGreaterThanOrEqual(4);
    let prevH = 0;
    for (const b of l.campus) {
      expect(b.y + b.h).toBe(l.horizonY); // standing on the ground line
      expect(b.x + b.w).toBeLessThanOrEqual(l.tower.x); // never over the hero
      expect(b.y).toBeGreaterThan(l.tower.y); // and never taller than it
      expect(b.h).toBeGreaterThan(prevH); // heights ramp left → right
      prevH = b.h;
    }
    // ...and so does the share of lit windows (the campus waking up).
    expect(l.campus[l.campus.length - 1]!.lit).toBeGreaterThan(l.campus[0]!.lit);
    // The blocks cover the empty middle, not just the tower's doorstep.
    expect(l.campus[0]!.x).toBeLessThan(RESOLUTION.WIDTH * 0.1);
  });

  it('gates the campus at the spawn end and runs a lit path to the doors', () => {
    const l = finaleLayout();
    const jumpApexHeadY = l.horizonY - 140 - 60; // apex ≈140px, player 60 tall
    // The gate stands on the plaza near the spawn, and a full jump clears it.
    expect(l.gate.legs).toHaveLength(2);
    for (const leg of l.gate.legs) {
      expect(leg.y + leg.h).toBe(l.horizonY);
      expect(leg.x).toBeLessThan(RESOLUTION.WIDTH * 0.3);
    }
    expect(l.gate.header.y + l.gate.header.h).toBeLessThanOrEqual(jumpApexHeadY);
    expect(l.gate.header.y + l.gate.header.h).toBe(l.gate.legs[0]!.y);
    // The runner starts at the gate and ends at the doors, below the walk line.
    expect(l.carpet.y).toBeGreaterThan(l.horizonY);
    expect(l.carpet.y + l.carpet.h).toBeLessThan(RESOLUTION.HEIGHT);
    expect(l.carpet.x).toBeGreaterThan(l.gate.legs[0]!.x);
    expect(l.carpet.x + l.carpet.w).toBe(l.entrance.x + l.entrance.w);
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
    // Nothing grows out of a Growth Point: furniture clears all three pickups
    // (gx 8/14/19 → x 340/580/780) by more than a planter's half-width.
    for (const item of [...l.lamps, ...l.planters]) {
      for (const px of [340, 580, 780]) expect(Math.abs(item.x - px)).toBeGreaterThan(24);
    }
    // The medallion is inlaid *below* the walking line, so it reads as floor,
    // and it sits in front of the doors (where the run ends) rather than alone
    // in the middle of the plaza.
    expect(l.medallion.y).toBeGreaterThan(l.horizonY);
    expect(l.medallion.y).toBeLessThan(RESOLUTION.HEIGHT);
    expect(l.medallion.x).toBeCloseTo(l.entrance.x + l.entrance.w / 2, 6);
    // Distant skyline never rises above the ANSR tower.
    for (const b of l.skyline) expect(b.y).toBeGreaterThan(l.tower.y);
    // ...and it is a skyline, not a sawtooth: the old `(i*53)%104` term made the
    // heights alternate low/high/low/high right across the frame.
    const hs = l.skyline.map((b) => b.h);
    const zigzag = hs.filter(
      (h, i) => i > 0 && i < hs.length - 1 && (h - hs[i - 1]!) * (h - hs[i + 1]!) > 0,
    ).length;
    expect(zigzag).toBeLessThan(hs.length * 0.6);
  });

  it('mirrors the tower facade declared in levels.json', () => {
    // The renderer calls finaleLayout() with no argument, so its DEFAULT_TOWER is
    // what actually gets painted. The two silently disagreed for a whole pass
    // (data said gy8/h7 while the scene drew gy8/h7 from its own copy) — this
    // keeps the level data and the picture describing the same building.
    const facade = getScreen(5).solids.find((s) => s.role?.includes('tower-facade'));
    expect(facade).toBeDefined();
    const T = RESOLUTION.TILE;
    const l = finaleLayout();
    expect({ x: l.tower.x, y: l.tower.y, w: l.tower.w }).toEqual({
      x: facade!.gx * T,
      y: facade!.gy * T,
      w: facade!.w * T,
    });
    expect(facade!.gy + facade!.h).toBe(15); // base lands on the ground line
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
      gate: l.gate,
      carpet: l.carpet,
      counts: {
        bands: l.skyBands.length,
        skyline: l.skyline.length,
        campus: l.campus.length,
        windows: l.windows.length,
        people: l.people.length,
      },
    };
    expect(compact).toMatchInlineSnapshot(`
      {
        "carpet": {
          "h": 52,
          "w": 952,
          "x": 132,
          "y": 640,
        },
        "counts": {
          "bands": 12,
          "campus": 5,
          "people": 7,
          "skyline": 12,
          "windows": 41,
        },
        "crown": {
          "h": 26,
          "w": 272,
          "x": 904,
          "y": 134,
        },
        "entrance": {
          "h": 92,
          "w": 88,
          "x": 996,
          "y": 508,
        },
        "gate": {
          "header": {
            "h": 34,
            "w": 240,
            "x": 100,
            "y": 356,
          },
          "legs": [
            {
              "h": 210,
              "w": 20,
              "x": 120,
              "y": 390,
            },
            {
              "h": 210,
              "w": 20,
              "x": 320,
              "y": 390,
            },
          ],
        },
        "horizonY": 600,
        "mark": {
          "r": 24,
          "x": 987,
          "y": 236,
        },
        "medallion": {
          "r": 34,
          "x": 1040,
          "y": 660,
        },
        "sign": {
          "h": 60,
          "w": 200,
          "x": 940,
          "y": 206,
        },
        "sun": {
          "r": 180,
          "x": 1040,
          "y": 200,
        },
        "tower": {
          "h": 440,
          "w": 320,
          "x": 880,
          "y": 160,
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
