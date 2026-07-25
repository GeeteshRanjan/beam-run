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
 * Composition (left → right is the direction the player runs, so the picture is
 * read as an approach):
 *
 *   gate ──── campus blocks stepping up ──── hero tower + rising sun
 *
 * Three things were wrong with the previous version and are fixed here:
 *
 *   1. The banded sun was centred on the tower at r=126 against a 320px-wide
 *      tower, and drawn *before* it — geometrically it sat entirely inside the
 *      tower rect, so the nicest element in the scene was never once visible.
 *      The sun is now bigger and raised so a wide dome reads above the crown and
 *      the tower silhouettes against it (contre-jour, which is also why the
 *      tower is rim-lit on both edges rather than one).
 *   2. The tower was 320×280 — wider than tall, which reads as a block, not a
 *      landmark — and it occupied only the right quarter, leaving 69% of the
 *      frame as bare plaza. The facade is now 320×440 and the empty middle is
 *      filled with the rest of the campus.
 *   3. The distant skyline alternated 64/117/66/119px in a mechanical sawtooth.
 *      It now uses two mixed hash terms, and a nearer mid-ground layer of ANSR
 *      campus blocks *ramps* upward towards the tower (the same left→right
 *      "market getting real" device the attract screen uses).
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

/** A mid-ground campus block: nearer than the skyline, behind the plaza. */
export interface CampusBlock extends Rect {
  /** 0..1 — fraction of its windows that are lit (ramps up towards ANSR). */
  lit: number;
}

export interface FinaleLayout {
  /** Vertical sky gradient stops (offset 0..1 → colour) the bands derive from. */
  sky: { offset: number; color: string }[];
  /** The sky as solid bands, top → horizon. */
  skyBands: SkyBand[];
  /** Rising sun behind the tower — the dome clears the crown, so it reads. */
  sun: { x: number; y: number; r: number };
  /** Distant city silhouette (depth behind the campus). */
  skyline: Rect[];
  /** ANSR campus blocks stepping up towards the hero tower. */
  campus: CampusBlock[];
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
  /** Campus entry gate the player runs through, just after the spawn. */
  gate: { header: Rect; legs: Rect[] };
  /** Lit runner across the plaza, from the gate to the doors. */
  carpet: Rect;
  /** The logo inlaid in the pavement, below the walking line. */
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

/**
 * Default tower facade, mirroring levels.json screen 5
 * (`gx22,gy4,w8,h11` in tiles → 320×440 px, base on the ground line).
 */
const DEFAULT_TOWER: Rect = {
  x: 22 * RESOLUTION.TILE,
  y: 4 * RESOLUTION.TILE,
  w: 8 * RESOLUTION.TILE,
  h: 11 * RESOLUTION.TILE,
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

/** Stable 0..1 noise from one integer — keeps the skyline varied but fixed. */
function noise(i: number): number {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export function finaleLayout(
  width: number = RESOLUTION.WIDTH,
  height: number = RESOLUTION.HEIGHT,
  tower: Rect = DEFAULT_TOWER,
): FinaleLayout {
  const horizonY = 15 * RESOLUTION.TILE; // ground band top (600)

  // Layered sky: deep teal up top warming to an orange dawn at the horizon
  // behind the tower (orange = the "value" accent, earned at the end).
  //
  // The top stays dark — the win overlay's copy sits up there and needs the
  // contrast — but the lower two thirds now genuinely brighten into sunrise.
  // Rendered, the old stops read as a midnight city rather than an arrival.
  const sky = [
    { offset: 0, color: '#00242E' },
    { offset: 0.4, color: '#043B4C' },
    { offset: 0.68, color: '#1A6577' },
    { offset: 0.86, color: '#7E5335' },
    { offset: 1, color: '#B9713C' },
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

  // Tower base sits on the plaza; keep the given facade top.
  const t: Rect = { x: tower.x, y: tower.y, w: tower.w, h: horizonY - tower.y };
  const cx = t.x + t.w / 2;

  // Sun centred on the tower but raised: its dome clears the crown by ~110px,
  // so the tower reads as a silhouette against it instead of hiding it.
  const sun = { x: cx, y: t.y + 40, r: 180 };

  // Distant skyline: deterministic, mixed noise (the old single modulo term
  // produced a low/high/low/high sawtooth), and never above the campus.
  const skyline: Rect[] = [];
  {
    let x = -24;
    let i = 0;
    while (x < width + 24) {
      const w = 54 + Math.round(noise(i + 1) * 76);
      const h = 58 + Math.round(noise(i * 3 + 7) * 96);
      skyline.push({ x, y: horizonY - h, w, h });
      x += w + 8 + Math.round(noise(i * 5 + 3) * 26);
      i += 1;
    }
  }

  // Mid-ground: the rest of the ANSR campus, stepping up towards the tower so
  // the eye is walked to the destination and the middle of the frame is built.
  const campus: CampusBlock[] = [
    { x: 24, w: 152, h: 148 },
    { x: 206, w: 132, h: 198 },
    { x: 396, w: 170, h: 246 },
    { x: 612, w: 148, h: 302 },
    { x: 790, w: 76, h: 358 },
  ].map((b, i, all) => ({
    x: b.x,
    y: horizonY - b.h,
    w: b.w,
    h: b.h,
    lit: 0.2 + (i / (all.length - 1)) * 0.62,
  }));

  // Crown, mast, beacon.
  const crown: Rect = { x: t.x + 24, y: t.y - 26, w: t.w - 48, h: 26 };
  const mast: Rect = { x: cx - 4, y: crown.y - 54, w: 8, h: 54 };
  const beacon = { x: cx, y: mast.y - 6, r: 7 };

  // Signed facade panel, and the mark inside it. The lockup (48px mark + 14px
  // gap + a 92px "ANSR" at scale 4) is 154 wide, so a 200-wide panel pads it
  // evenly on both sides.
  const sign: Rect = { x: cx - 100, y: t.y + 46, w: 200, h: 60 };
  const mark = { x: sign.x + 47, y: sign.y + sign.h / 2, r: 24 };

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
  const rows = 12;
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

  // Campus entry gate: the player spawns at gx1 and runs straight through it, so
  // the place is named at the moment of arrival rather than only at the tower.
  // The header clears a full jump (apex puts the player's head at ~y400).
  const gate = {
    header: { x: 100, y: 356, w: 240, h: 34 },
    legs: [
      { x: 120, y: 390, w: 20, h: horizonY - 390 },
      { x: 320, y: 390, w: 20, h: horizonY - 390 },
    ],
  };

  // A lit runner from the gate to the doors: the value path, read below the
  // walking line so it never competes with the player silhouette.
  const carpet: Rect = { x: 132, y: horizonY + 40, w: entrance.x + entrance.w - 132, h: 52 };

  // The logo inlaid in the pavement, below the walking line so it reads as floor
  // — directly in front of the doors, which is where the run ends and the eye
  // lands (it used to sit at x=435, alone in the middle of an empty plaza).
  const medallion = { x: cx, y: horizonY + plaza.h * 0.5, r: 34 };

  // Furniture is spaced to clear the three Growth Points (x=340/580/780) so a
  // pickup never has a lamp head or a planter growing out of it.
  const lamps = [
    { x: 398, h: 128 },
    { x: 642, h: 128 },
    { x: 820, h: 128 },
  ];
  const planters = [{ x: 250 }, { x: 478 }, { x: 700 }];
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
    campus,
    plaza,
    tower: t,
    windows,
    crown,
    mast,
    beacon,
    sign,
    mark,
    gate,
    carpet,
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
