/**
 * Tech Park finale scene — the one hand-crafted "wow" moment (GDD art spec).
 *
 * This module is the PURE, headless layout for the finale: given the canvas size
 * and the (non-collidable) tower-facade rectangle from the level data, it returns
 * every piece of geometry the renderer paints. Keeping the layout pure makes it
 * snapshot-testable without a canvas and guarantees the scene is identical at 1×
 * and 2× (all coordinates are in internal px, so the HiDPI transform only scales
 * the final blit — never the composition).
 *
 * The scene is the *payoff* of the run, so it is the densest picture in the game:
 * a stepped dawn sky and rising sun, a distant city skyline for depth, then the
 * ANSR tower with a crown, a beacon, a signed facade and a lit entrance the
 * player literally walks into, standing on a plaza with lamps, planters, a
 * welcoming crowd and the logo inlaid in the pavement.
 *
 * Everything here is arithmetic — no RNG — so the arrival looks the same every
 * single run.
 */
import { RESOLUTION } from '../data/tuning.config';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One solid band of the stepped sky (8-bit machines had no smooth gradients). */
export interface SkyBand {
  y: number;
  h: number;
  color: string;
}

export interface FinaleLayout {
  /** Vertical sky gradient stops (offset 0..1 → colour) the bands derive from. */
  sky: { offset: number; color: string }[];
  /** The sky as solid bands, top → horizon. */
  skyBands: SkyBand[];
  /** Rising sun behind the tower. */
  sun: { x: number; y: number; r: number };
  /** Distant city silhouette (depth behind the tower). */
  skyline: Rect[];
  plaza: Rect;
  tower: Rect;
  /** Window cells on the tower face (glass grid), minus any the sign/doors take. */
  windows: Rect[];
  /** Stepped crown on top of the tower, plus its mast and blinking beacon. */
  crown: Rect;
  mast: Rect;
  beacon: { x: number; y: number; r: number };
  /** Signed facade panel: the ANSR mark + wordmark. */
  sign: Rect;
  /** Where the ANSR mark sits inside the sign. */
  mark: { x: number; y: number; r: number };
  /** The logo inlaid in the plaza pavement, below the walking line. */
  medallion: { x: number; y: number; r: number };
  /** Lit doorway at the tower base — the finish line is walking through it. */
  entrance: Rect;
  canopy: Rect;
  /** Plaza furniture, all standing on the ground line. */
  lamps: { x: number; h: number }[];
  planters: { x: number }[];
  /** Welcoming crowd, flanking the doors. */
  people: { x: number; tone: number }[];
  /** Bloom focus (glow) at the crown of the tower. */
  bloom: { x: number; y: number; r: number };
  horizonY: number;
}

/** Default tower facade from levels.json screen 5 (gx22,gy8,w8,h7 in tiles). */
const DEFAULT_TOWER: Rect = {
  x: 22 * RESOLUTION.TILE,
  y: 8 * RESOLUTION.TILE,
  w: 8 * RESOLUTION.TILE,
  h: 7 * RESOLUTION.TILE,
};

/** Mix two #rrggbb colours; used to derive the stepped sky from its stops. */
function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => Number.parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => Number.parseInt(b.slice(i, i + 2), 16));
  const mix = pa.map((v, i) => Math.round(v + (pb[i]! - v) * t));
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Sample a stop list at `p` (0..1). */
function sampleStops(stops: { offset: number; color: string }[], p: number): string {
  let lo = stops[0]!;
  let hi = stops[stops.length - 1]!;
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (p >= stops[i]!.offset && p <= stops[i + 1]!.offset) {
      lo = stops[i]!;
      hi = stops[i + 1]!;
      break;
    }
  }
  const span = hi.offset - lo.offset || 1;
  return mixHex(lo.color, hi.color, (p - lo.offset) / span);
}

/** Do two rects overlap, with `pad` of slack around the second? */
function hits(a: Rect, b: Rect, pad = 0): boolean {
  return (
    a.x < b.x + b.w + pad &&
    a.x + a.w > b.x - pad &&
    a.y < b.y + b.h + pad &&
    a.y + a.h > b.y - pad
  );
}

export function finaleLayout(
  width: number = RESOLUTION.WIDTH,
  height: number = RESOLUTION.HEIGHT,
  tower: Rect = DEFAULT_TOWER,
): FinaleLayout {
  const horizonY = 15 * RESOLUTION.TILE; // ground band top (600)

  // Layered sky: deep teal up top warming to an orange dawn at the horizon
  // behind the tower (orange = the "value" accent, earned at the end).
  const sky = [
    { offset: 0, color: '#00242E' },
    { offset: 0.55, color: '#00394A' },
    { offset: 0.82, color: '#0A5566' },
    { offset: 1, color: '#8A4A2A' },
  ];

  // Stepped, not smooth: 12 solid bands sampled off the stops above.
  const BANDS = 12;
  const bandH = Math.ceil(horizonY / BANDS);
  const skyBands: SkyBand[] = [];
  for (let i = 0; i < BANDS; i += 1) {
    const y = i * bandH;
    skyBands.push({
      y,
      h: Math.min(bandH, horizonY - y),
      color: sampleStops(sky, (i + 0.5) / BANDS),
    });
  }

  const plaza: Rect = { x: 0, y: horizonY, w: width, h: height - horizonY };

  // Tower base sits on the plaza; keep the given crown height.
  const t: Rect = { x: tower.x, y: tower.y, w: tower.w, h: horizonY - tower.y };
  const cx = t.x + t.w / 2;

  const sun = { x: cx, y: horizonY - 132, r: 126 };

  // Distant skyline: deterministic, and it never rises above the ANSR tower.
  const skyline: Rect[] = [];
  {
    let x = -24;
    let i = 0;
    while (x < width + 24) {
      const w = 68 + ((i * 37) % 58);
      const h = 64 + ((i * 53) % 104);
      skyline.push({ x, y: horizonY - h, w, h });
      x += w + 12 + ((i * 29) % 24);
      i += 1;
    }
  }

  // Crown, mast, beacon.
  const crown: Rect = { x: t.x + 24, y: t.y - 26, w: t.w - 48, h: 26 };
  const mast: Rect = { x: cx - 4, y: crown.y - 54, w: 8, h: 54 };
  const beacon = { x: cx, y: mast.y - 6, r: 7 };

  // Signed facade panel, and the mark inside it.
  const sign: Rect = { x: cx - 106, y: t.y + 40, w: 212, h: 56 };
  const mark = { x: sign.x + 30, y: sign.y + sign.h / 2, r: 21 };

  // Lit doorway at the base + its canopy. The win trigger sits here, so the run
  // ends by walking in through the doors.
  const entrance: Rect = { x: cx - 44, y: horizonY - 92, w: 88, h: 92 };
  const canopy: Rect = { x: entrance.x - 26, y: entrance.y - 16, w: entrance.w + 52, h: 16 };

  // Window grid (glass panes) inset into the tower face, skipping the panes the
  // sign and the entrance/canopy occupy.
  const windows: Rect[] = [];
  const pad = 14;
  // A denser grid than the original 4×8: once the sign and the doors take their
  // panes out, a coarse grid left the facade looking empty rather than glazed.
  const cols = 5;
  const rows = 10;
  const cellW = (t.w - pad * 2) / cols;
  const cellH = (t.h - pad * 2) / rows;
  const gw = cellW * 0.72;
  const gh = cellH * 0.62;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const pane: Rect = {
        x: t.x + pad + c * cellW + (cellW - gw) / 2,
        y: t.y + pad + r * cellH + (cellH - gh) / 2,
        w: gw,
        h: gh,
      };
      if (hits(pane, sign, 3)) continue;
      if (hits(pane, entrance, 3) || hits(pane, canopy, 3)) continue;
      windows.push(pane);
    }
  }

  const bloom = { x: cx, y: t.y + 6, r: 190 };
  // The logo inlaid in the pavement, below the walking line so it reads as floor.
  const medallion = { x: width * 0.34, y: horizonY + plaza.h * 0.46, r: 30 };

  const lamps = [{ x: 168, h: 116 }, { x: 452, h: 116 }, { x: 700, h: 116 }];
  const planters = [{ x: 300 }, { x: 580 }, { x: 812 }];
  // A welcoming line either side of the doors (tones alternate for depth).
  const people = [
    { x: t.x - 46, tone: 0 },
    { x: t.x - 18, tone: 1 },
    { x: entrance.x - 58, tone: 1 },
    { x: entrance.x - 30, tone: 0 },
    { x: entrance.x + entrance.w + 22, tone: 0 },
    { x: entrance.x + entrance.w + 50, tone: 1 },
    { x: t.x + t.w + 16, tone: 1 },
  ];

  return {
    sky,
    skyBands,
    sun,
    skyline,
    plaza,
    tower: t,
    windows,
    crown,
    mast,
    beacon,
    sign,
    mark,
    medallion,
    entrance,
    canopy,
    lamps,
    planters,
    people,
    bloom,
    horizonY,
  };
}
