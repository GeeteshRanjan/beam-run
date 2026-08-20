/**
 * The Compliance maze's weather — the sun and the cloud bank.
 *
 * These two were rebuilt because the owner called them "way too pixelated and not
 * refined": the first version drew each cloud as three stacked rectangles and the sun as
 * eight 8px rows, which is 8-bit in the sense that a barcode is. What replaced them is a
 * *silhouette* — a height per 4px column for a cloud, and a real pixel circle for the sun.
 *
 * So the assertions here are about that distinction, because it is the one that was got
 * wrong: everything is whole cells of one size (it must still be pixel art), and the
 * shapes have to have *many* steps rather than a handful of slabs. Nothing checks colours
 * beyond the two rules this screen cannot break — the weather never paints the reserved
 * value orange, and the dial moves the picture rather than switching it.
 */
import { describe, it, expect } from 'vitest';
import {
  drawCloudBank,
  drawRain,
  drawReliefWash,
  drawSceneBackground,
  drawSunBreak,
  stepLabelAnchor,
  WEATHER_CELL as C,
} from './scenery';
import { BRAND, RESOLUTION } from '../data/tuning.config';
import { SCREENS } from '../data/levels';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

function recorder() {
  const rects: Rect[] = [];
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, fill: String((this as { fillStyle: string }).fillStyle) });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

describe('the sun that breaks through', () => {
  it('is not drawn at all until the sky starts to open', () => {
    const { ctx, rects } = recorder();
    drawSunBreak(ctx, 0);
    expect(rects).toHaveLength(0);
  });

  it('is a real pixel circle: one cell size, and many steps in its edge', () => {
    const { ctx, rects } = recorder();
    drawSunBreak(ctx, 1);
    // Whole cells of one size — the disc, the bands and the rays all use the same 4px
    // cell as the rain and the clouds.
    for (const r of rects) {
      expect(r.w).toBe(C);
      expect(r.h).toBe(C);
    }
    // Rows of different widths are what make it round. The version this replaced had
    // eight rows, and at eight steps a "circle" reads as a polygon; a 64px disc on a 4px
    // cell has sixteen, and every row from the middle outwards is a different width.
    const rows = new Map<number, number>();
    for (const r of rects) rows.set(r.y, (rows.get(r.y) ?? 0) + 1);
    expect(rows.size).toBeGreaterThanOrEqual(16);
    expect(new Set(rows.values()).size).toBeGreaterThanOrEqual(8);
  });

  it('has three concentric bands, lit from the upper left', () => {
    const { ctx, rects } = recorder();
    drawSunBreak(ctx, 1);
    const tones = new Set(rects.map((r) => r.fill));
    // Core, face, rim, plus two ray alphas: five values, all of them opaque enough to be
    // light rather than grime (the halo lesson — nothing here is under 0.45).
    expect(tones.size).toBe(5);
    for (const t of tones) {
      const alpha = Number(t.slice(t.lastIndexOf(',') + 1, -1));
      expect(alpha).toBeGreaterThanOrEqual(0.45);
    }
    // The brightest tone's cells sit up and to the left of the disc's centre, which is
    // what makes a disc read as a sphere of light rather than as a coin.
    const brightest = rects.filter((r) => r.fill.startsWith('rgba(255,250,226'));
    const cx = rects.reduce((s, r) => s + r.x, 0) / rects.length;
    const bx = brightest.reduce((s, r) => s + r.x, 0) / brightest.length;
    expect(bx).toBeLessThan(cx);
  });

  it('fades in with the dial rather than appearing', () => {
    const early = recorder();
    drawSunBreak(early.ctx, 0.2);
    const full = recorder();
    drawSunBreak(full.ctx, 1);
    expect(early.rects).toHaveLength(full.rects.length);
    const alphaOf = (r: Rect) => Number(r.fill.slice(r.fill.lastIndexOf(',') + 1, -1));
    expect(alphaOf(early.rects[0]!)).toBeLessThan(alphaOf(full.rects[0]!));
  });

  it('is cream, never the value orange', () => {
    const { ctx, rects } = recorder();
    drawSunBreak(ctx, 1);
    for (const r of rects) expect(r.fill.toUpperCase()).not.toContain(BRAND.ORANGE);
  });
});

describe('the rain', () => {
  const frame = (t: number, wet = 1): Rect[] => {
    const { ctx, rects } = recorder();
    drawRain(ctx, t, false, wet);
    return rects;
  };

  it('falls CONTINUOUSLY: each drop wraps on its own, and the sheet never rewinds', () => {
    /*
     * This is the test the pass exists for. The first version shared one offset across
     * every drop — `drift = (t * 620) % 240` — so twice a second the entire field jumped
     * back up the screen: "a boomerang loop that's going on and not continuous". The
     * property that rules that out is per-particle wrapping, and it is checkable: between
     * two consecutive frames almost every streak must have moved DOWN, and the handful
     * that wrapped must have gone all the way round (leaving the bottom, re-entering the
     * top) rather than stepping backwards.
     */
    let wraps = 0;
    let total = 0;
    for (let f = 0; f < 40; f += 1) {
      const a = frame(f / 60);
      const b = frame((f + 1) / 60);
      // A fixed number of streaks, which is what lets one drop be followed by index.
      expect(b).toHaveLength(a.length);
      for (let i = 0; i < a.length; i += 1) {
        const dy = b[i]!.y - a[i]!.y;
        total += 1;
        if (dy < 0) {
          wraps += 1;
          // A wrap is a whole span, not a step backwards: it left at the bottom and came
          // back in at the top.
          expect(dy).toBeLessThan(-400);
        } else {
          expect(dy).toBeGreaterThan(0);
        }
      }
    }
    // Some drops do wrap over 40 frames — otherwise this proves nothing — but only a few
    // of them per frame, because they are staggered.
    expect(wraps).toBeGreaterThan(0);
    expect(wraps / total).toBeLessThan(0.1);
  });

  it('is two sheets at different speeds, so it has depth', () => {
    const a = frame(0);
    const b = frame(0.1);
    const speeds = new Set<number>();
    for (let i = 0; i < a.length; i += 1) {
      const dy = b[i]!.y - a[i]!.y;
      if (dy > 0) speeds.add(Math.round(dy));
    }
    // Two distinct fall rates (each sheet's streak is drawn in two cells, so the same two
    // numbers repeat), and the near one is the faster.
    expect(speeds.size).toBe(2);
    const [slow, fast] = [...speeds].sort((x, y) => x - y);
    expect(fast!).toBeGreaterThan(slow! * 1.4);
  });

  it('leans the way it travels, in whole cells', () => {
    const rects = frame(0.5);
    for (const r of rects) {
      expect([2, 3]).toContain(r.w);
      expect(r.h).toBeGreaterThanOrEqual(5);
    }
    // Lower cells sit to the RIGHT of the cell above them: the streak is on the same slant
    // as the fall, rather than being a tilted sprite dropping straight down.
    const leaning = rects.filter((r, i) => i % 2 === 1 && r.x > rects[i - 1]!.x);
    expect(leaning.length).toBeGreaterThan(rects.length * 0.4);
  });

  it('thins out as the sky clears, and stops rather than fading to a ghost', () => {
    expect(frame(0.5, 1).length).toBeGreaterThan(frame(0.5, 0.4).length);
    const { ctx, rects } = recorder();
    drawRain(ctx, 0.5, false, 0);
    expect(rects).toHaveLength(0);
    // …and every drop it does draw is bright enough to be rain rather than grime.
    for (const r of frame(0.5, 1)) {
      const alpha = Number(r.fill.slice(r.fill.lastIndexOf(',') + 1, -1));
      expect(alpha).toBeGreaterThanOrEqual(0.28);
    }
  });

  it('holds still under reduced motion instead of disappearing', () => {
    const a = recorder();
    drawRain(a.ctx, 0, true, 1);
    const b = recorder();
    drawRain(b.ctx, 5, true, 1);
    expect(a.rects.length).toBeGreaterThan(0);
    expect(b.rects).toEqual(a.rects);
  });
});

describe('the cloud bank', () => {
  /** Cells that belong to the cloud around x, as a column → top-edge map. */
  function tops(rects: Rect[], from: number, to: number): Map<number, number> {
    const top = new Map<number, number>();
    for (const r of rects) {
      if (r.x < from || r.x > to) continue;
      const at = top.get(r.x);
      if (at === undefined || r.y < at) top.set(r.x, r.y);
    }
    return top;
  }

  it('is a lobed silhouette, one cell per column — not a stack of bars', () => {
    const { ctx, rects } = recorder();
    drawCloudBank(ctx, 1);
    for (const r of rects) expect(r.w).toBe(C);
    // The shape this replaced had three widths and three heights in it. A profile has a
    // different top edge every few columns, and the whole point is that the number of
    // distinct heights is large.
    const edge = tops(rects, 240, 600);
    expect(edge.size).toBeGreaterThan(40);
    expect(new Set(edge.values()).size).toBeGreaterThanOrEqual(6);
  });

  it('has a flat base, because a cumulus sits on its own level', () => {
    const { ctx, rects } = recorder();
    drawCloudBank(ctx, 1);
    // Per column, the lowest cell: the body run and the shaded underside both end on the
    // cloud's own base line, so every column agrees on where the bottom is. (Measured per
    // column because the crown cells end wherever the silhouette put them.)
    const base = new Map<number, number>();
    for (const r of rects) {
      if (r.x < 240 || r.x > 600) continue;
      base.set(r.x, Math.max(base.get(r.x) ?? 0, r.y + r.h));
    }
    expect(base.size).toBeGreaterThan(20);
    expect(new Set(base.values()).size).toBe(1);
  });

  it('contracts and lightens as the sky clears, rather than fading out', () => {
    const gloom = recorder();
    drawCloudBank(gloom.ctx, 0);
    const clear = recorder();
    drawCloudBank(clear.ctx, 1);
    // Fewer columns: the lid closes towards each cloud's own centre. A cloud that fades
    // reads as a rendering fault; a cloud that shrinks reads as weather.
    const columns = (rs: Rect[]) => new Set(rs.map((r) => r.x)).size;
    expect(columns(clear.rects)).toBeLessThan(columns(gloom.rects) * 0.7);
    // …and the bank lifts: the base line moves UP, which is what "the sky opens" looks
    // like. (The clouds are also smaller, so their crowns end up lower than the overcast
    // lid's — the base is the honest measure of the lift.)
    const base = (rs: Rect[]) => Math.max(...rs.map((r) => r.y + r.h));
    expect(base(clear.rects)).toBeLessThan(base(gloom.rects));
    // Every tone is lighter than its overcast equivalent.
    const mean = (rs: Rect[]) => {
      const tones = [...new Set(rs.map((r) => r.fill))];
      const lum = (hex: string) =>
        [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);
      return tones.reduce((s, t) => s + lum(t), 0) / tones.length;
    };
    expect(mean(clear.rects)).toBeGreaterThan(mean(gloom.rects) * 3);
  });

  it('never paints the value orange, whatever the weather', () => {
    for (const c of [0, 0.5, 1]) {
      const { ctx, rects } = recorder();
      drawCloudBank(ctx, c);
      for (const r of rects) expect(r.fill.toUpperCase()).not.toContain(BRAND.ORANGE);
    }
  });
});

describe("Hire Under Fire's payoff: the environment comes good", () => {
  /*
   * Owner call: "when the Godzilla dies make the environment beautiful and well lit up, and
   * from the dangerous environment it turns all bright and happy". The dial is
   * `Dragon.relief`; this backdrop is handed a plain number, exactly like the maze's weather.
   *
   * The rule both screens share, and the one that was paid for on screen 2: the change has
   * to be visible across the **whole frame**, or it rasterises as a bright sky in front of an
   * unchanged dark level. So there are two layers, and both are tested here — the sky (which
   * `drawSceneBackground` owns) and the wash over the masonry (`drawReliefWash`).
   */
  const scene = (relief: number): Rect[] => {
    const { ctx, rects } = recorder();
    // The sky band is the one thing on this backdrop drawn with a real gradient, so the
    // recorder has to answer `createLinearGradient` — it is stubbed rather than measured,
    // because a gradient is not a cell and nothing here is asking about it.
    (ctx as unknown as { createLinearGradient: () => unknown }).createLinearGradient = () => ({
      addColorStop: () => undefined,
    });
    drawSceneBackground(ctx, 4, 1.3, true, 0, relief);
    return rects;
  };
  const lum = (fill: string) => {
    if (fill.startsWith('#')) {
      return [1, 3, 5].reduce((s, i) => s + parseInt(fill.slice(i, i + 2), 16), 0) / 3;
    }
    const parts = fill.slice(fill.indexOf('(') + 1, -1).split(',').map(Number);
    return (parts[0]! + parts[1]! + parts[2]!) / 3;
  };

  it('is a night of embers at 0 and a bright morning at 1', () => {
    const night = scene(0);
    const morning = scene(1);
    // Cells only: the sky's own gradient is not a colour this recorder can weigh.
    const mean = (rs: Rect[]) => {
      const cells = rs.filter((r) => r.fill.startsWith('#') || r.fill.startsWith('rgba('));
      return (
        cells.reduce((s, r) => s + lum(r.fill) * r.w * r.h, 0) /
        cells.reduce((s, r) => s + r.w * r.h, 0)
      );
    };
    expect(mean(morning)).toBeGreaterThan(mean(night) * 1.6);
  });

  it('brings the sun and the clouds up, and only after it has been beaten', () => {
    // The same sun and cloud bank screen 2 uses: there is one of each in this game.
    // The sun's own tones, not "anything warm": the heat haze is rgba(255,176,122) and it is
    // the *danger's* signature, so matching on 255 alone counts the wrong thing.
    const cream = (rs: Rect[]) => rs.filter((r) => /^rgba\(255,2/.test(r.fill));
    expect(cream(scene(0))).toHaveLength(0);
    expect(cream(scene(1)).length).toBeGreaterThan(20);
  });

  it('takes the heat haze away with the danger', () => {
    // The shimmer is the *hazard's* signature, so it goes when the hazard does.
    const haze = (rs: Rect[]) => rs.filter((r) => r.fill === 'rgba(255,176,122,0.22)');
    expect(haze(scene(0)).length).toBeGreaterThan(20);
    expect(haze(scene(1))).toHaveLength(0);
  });

  it('opens the market: awnings only in daylight, lit windows only at night', () => {
    // The middle distance carries the change too, which is what stops the payoff being a
    // sky. Stalls trade in the morning; at night the only thing you can see is a lit window.
    const awning = (rs: Rect[]) => rs.filter((r) => r.fill.startsWith('rgba(88,168,150'));
    const litWindow = (rs: Rect[]) => rs.filter((r) => r.fill.startsWith('rgba(226,138,86'));
    expect(awning(scene(0))).toHaveLength(0);
    expect(awning(scene(1)).length).toBeGreaterThan(3);
    expect(litWindow(scene(0)).length).toBeGreaterThan(3);
    expect(litWindow(scene(1))).toHaveLength(0);
  });

  it('keeps the middle distance clear of the beast, so the animal keeps its silhouette', () => {
    // The lesson the deleted crag paid for: two dark warm masses in the same columns is one
    // mass. The roost is gx 23-29, i.e. x 920 onwards.
    // Measured on the market row's own tones rather than "anything dark": the skyline behind
    // it is allowed to run the full width, because it is a distant silhouette rather than a
    // warm mass at the beast's own value.
    const marketTones = ['#08191F', '#0A222A', '#153A44'];
    const market = scene(0).filter((r) => marketTones.includes(r.fill.toUpperCase()));
    expect(market.length).toBeGreaterThan(10);
    for (const r of market) expect(r.x + r.w).toBeLessThan(880);
  });

  it('washes the WHOLE frame, in both directions', () => {
    const veil = recorder();
    drawReliefWash(veil.ctx, 0);
    expect(veil.rects).toHaveLength(1);
    expect(veil.rects[0]!.w).toBe(RESOLUTION.WIDTH);
    expect(veil.rects[0]!.h).toBe(RESOLUTION.HEIGHT);
    expect(veil.rects[0]!.fill).toContain('6,14,22');

    const lit = recorder();
    drawReliefWash(lit.ctx, 1);
    expect(lit.rects).toHaveLength(1);
    expect(lit.rects[0]!.fill).toContain('226,240,236');

    // Half way it is both: "un-gloomed" is not "lit", so the veil lifting and the light
    // coming up are two layers rather than one dial doing both jobs.
    const half = recorder();
    drawReliefWash(half.ctx, 0.5);
    expect(half.rects).toHaveLength(2);
  });
});

/**
 * Reception's three tutorial labels.
 *
 * There is only one thing worth pinning here and it is arithmetic rather than art: a
 * label is centred on the **block** it names, which is not the same as being centred
 * on that block's first tile. `drawStepLabel` took `gx`/`gy` only for the whole life
 * of this screen and centred every plaque on `gx * TILE + TILE / 2`, so BUDGET — the
 * one step that is two tiles wide — hung half a tile to the left of the thing it
 * labels, and no amount of reading the call site could show it (owner call: "the
 * three tags for the hurdles are not properly aligned with the brick obstacles").
 *
 * The screen's real geometry is the fixture on purpose: a tidy invented one would not
 * have contained the two-tile case the bug lives in.
 */
describe('the Reception step labels', () => {
  const steps = SCREENS.find((s) => s.id === 0)!.solids.filter((s) =>
    s.role?.startsWith('step-'),
  );

  it('names all three of the tutorial steps and nothing else', () => {
    expect(steps.map((s) => s.role)).toEqual([
      'step-business-case',
      'step-board-approval',
      'step-budget',
    ]);
  });

  it('centres each plaque on its own block, at any block width', () => {
    for (const s of steps) {
      const { cx } = stepLabelAnchor(s.gx, s.gy, s.w);
      const box = { left: s.gx * RESOLUTION.TILE, right: (s.gx + s.w) * RESOLUTION.TILE };
      expect(cx).toBe((box.left + box.right) / 2);
    }
    // Stated the other way too, because "centre of the block" and "centre of the first
    // tile" agree on every one-tile step and this is the only screen with a wider one.
    const wide = steps.find((s) => s.w > 1)!;
    expect(stepLabelAnchor(wide.gx, wide.gy, wide.w).cx).not.toBe(
      wide.gx * RESOLUTION.TILE + RESOLUTION.TILE / 2,
    );
  });

  it('leaves the plaque clear of the step, with room for the leader between them', () => {
    for (const s of steps) {
      const { plaqueTop, blockTop } = stepLabelAnchor(s.gx, s.gy, s.w);
      // The plaque is 24px tall, so its bottom edge is the gap above the block.
      expect(blockTop - (plaqueTop + 24)).toBe(16);
      expect(plaqueTop).toBeGreaterThan(0);
    }
  });
});
