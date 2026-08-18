/**
 * badge.ts — the floating ANSR pickup, in 8-bit.
 *
 * The badge used to be a teal disc with a white "A" on it, glowing through a
 * canvas radial gradient and hanging on a solid 3px cyan line. Three things were
 * wrong with that: the mark was not the ANSR mark, the gradient was the one thing
 * on screen that was not pixel art (the same defect the player's bubble had), and
 * the rail read as a rope rather than as the path the pickup travels.
 *
 * What is here now, all built from whole cells:
 *
 *  1. **The mark.** An authored 21×21 reduction of the real brand sunburst — the
 *     ring of rays around an empty core (`render/ansrLogo.ts` draws the true
 *     vector path, which is right for the Tech Park plaza at 92px but turns to
 *     mush at badge size, and is not 8-bit). Rays come in two classes so the
 *     palette can swap them for a shimmer; at scale 2 the grid is 42px, which is
 *     the 40px pickup hitbox plus a cell of overhang.
 *  2. **A levitation shaft** marking the band the badge travels: dashed cells with
 *     a bracket at each end of the swing, plus a short bright wake behind the
 *     badge so which way it is heading is readable at a glance.
 *  3. **A flare** — eight bright cells off the ray tips, alternating cardinals and
 *     diagonals in two held frames. Never a gradient.
 *  4. **A chevron on the ground** under the shaft. The band no longer dips into a
 *     standing player, so taking the badge is a jump; the chevron says where to
 *     stand to make it, which is the affordance a platformer owes the player.
 *
 * Everything animated is a pure function of the phase the host passes in, so
 * `prefers-reduced-motion` is a matter of passing a constant — the artwork holds
 * mid-shimmer rather than disappearing. The badge's *position* is not decided
 * here: it comes from `world/badgeFloat.ts`, the one source the simulation reads
 * too (see the invariant in HANDOFF §6).
 */
import { drawPixels, pxRect, maxWidth, type Palette } from './PixelArt';
import { LOGO_ORANGE } from '../ui/ansrMark';

/**
 * The ANSR sunburst at 19×19 (the mark's own bounding box — no empty border, so
 * at scale 2 it is 38px inside the 40px pickup hitbox). Four cardinal rays (`R`), four diagonals, eight
 * shorter rays between them (`r`) and a hub ring where they all spring from
 * (`h`), every cell mirrored eight ways so the mark is exactly symmetric — an odd
 * grid is what makes that possible, because the centre is a real cell and no ray
 * is forced to two cells wide. `K` is the core the brand mark leaves empty, kept
 * here as a faint dark backing so the rays still read against the fire screen's
 * warm sky.
 *
 * The hub ring is not in the brand asset and is not decoration: without it the
 * mark was sixteen loose hairs at 42px and read as a smudge (rasterised and
 * compared side by side). With it the sunburst has a body, which is what the real
 * logo's density gives you at poster size.
 */
const MARK: readonly string[] = [
  '.........R.........',
  '.........R.........',
  '..R...r..R..r...R..',
  '...R...r.R.r...R...',
  '....R..rhRhr..R....',
  '.....RhhKKKhhR.....',
  '..r..h.KKKKK.h..r..',
  '...rrhKKKKKKKhrr...',
  '....hKKKKKKKKKh....',
  'RRRRRKKKKKKKKKRRRRR',
  '....hKKKKKKKKKh....',
  '...rrhKKKKKKKhrr...',
  '..r..h.KKKKK.h..r..',
  '.....RhhKKKhhR.....',
  '....R..rhRhr..R....',
  '...R...r.R.r...R...',
  '..R...r..R..r...R..',
  '.........R.........',
  '.........R.........',
];

/** Brand orange, and a lighter tint of it for the shimmer. */
const RAY = LOGO_ORANGE;
const RAY_LIT = '#ff8a4d';
const CORE = 'rgba(1, 28, 38, 0.66)';

/**
 * Two palettes, swapped on alternate shimmer frames: the long rays and the short
 * ones trade brightness while the hub stays lit, which is how an 8-bit machine
 * animated anything glowing — swap the palette, never the pixels.
 */
const MARK_PALETTES: readonly Palette[] = [
  { R: RAY, r: RAY_LIT, h: RAY_LIT, K: CORE },
  { R: RAY_LIT, r: RAY, h: RAY_LIT, K: CORE },
];

/** Cells across the mark grid — the badge is `CELLS * scale` px wide. */
export const BADGE_CELLS = maxWidth(MARK);

/** Cyan, the "this is a path, not a thing" colour. Also the shaft's colour. */
const SHAFT = '92, 226, 244';

/** One field cell. Everything here is a multiple of it. */
const P = 4;

/**
 * Draw the ANSR mark centred on (cx, cy). `twinkle` (0 or 1) picks which ray
 * class is the lit one; hold it constant for a static mark.
 */
export function drawAnsrBadgeMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  twinkle: 0 | 1 = 0,
): void {
  const size = BADGE_CELLS * scale;
  drawPixels(ctx, MARK, MARK_PALETTES[twinkle]!, cx - size / 2, cy - size / 2, { scale });
}

export interface BadgePickupView {
  /** Badge centre, from `badgeCenter` with the simulation clock. */
  cx: number;
  cy: number;
  /** The extremes of the float band (the authored anchor ± amplitude). */
  bandTop: number;
  bandBottom: number;
  /** Top of the ground band, where the chevron sits. */
  groundY: number;
  /** Presentation phase in turns (0..1). Constant under reduced motion. */
  phase: number;
  /** Signed vertical direction, -1 rising, +1 falling. Drives the wake. */
  rising: boolean;
  /** Authored pixel size of the mark (2 → a 42px badge). */
  scale?: number;
}

/**
 * The whole pickup: shaft, halo, mark, wake and ground chevron.
 *
 * Pure: same view in, same cells out. The host owns the clock and the
 * reduced-motion decision.
 */
export function drawBadgePickup(ctx: CanvasRenderingContext2D, v: BadgePickupView): void {
  const scale = v.scale ?? 2;
  drawShaft(ctx, v);
  drawFlare(ctx, v.cx, v.cy, v.phase);
  drawAnsrBadgeMark(ctx, v.cx, v.cy, scale, Math.floor(v.phase * 8) % 2 === 0 ? 0 : 1);
  drawGroundChevron(ctx, v.cx, v.groundY, v.phase);
}

/**
 * The shaft: a dashed cell line down the middle of the band with a bracket at
 * each end, plus a three-cell wake behind the badge. It is drawn only while the
 * badge is uncollected (the caller stops calling), so it never gets confused with
 * the "help is active" read, which lives on the player.
 */
function drawShaft(ctx: CanvasRenderingContext2D, v: BadgePickupView): void {
  const x = v.cx - P / 2;
  for (let y = v.bandTop; y <= v.bandBottom; y += P * 2) {
    pxRect(ctx, `rgba(${SHAFT}, 0.2)`, x, y, P, P, P);
  }
  // Brackets: the two ends of the swing, so the band itself is legible.
  for (const [y, dir] of [
    [v.bandTop, 1],
    [v.bandBottom, -1],
  ] as const) {
    pxRect(ctx, `rgba(${SHAFT}, 0.45)`, v.cx - P * 2.5, y, P * 5, P, P);
    pxRect(ctx, `rgba(${SHAFT}, 0.45)`, v.cx - P * 2.5, y + dir * P, P, P, P);
    pxRect(ctx, `rgba(${SHAFT}, 0.45)`, v.cx + P * 1.5, y + dir * P, P, P, P);
  }
  // Wake: brightest cell nearest the badge, trailing the direction of travel.
  const back = v.rising ? 1 : -1;
  for (let i = 1; i <= 3; i += 1) {
    const y = v.cy + back * (P * 5 + i * P * 2);
    if (y < v.bandTop - P * 2 || y > v.bandBottom + P * 2) continue;
    pxRect(ctx, `rgba(${SHAFT}, ${0.5 - i * 0.12})`, v.cx - P / 2, y, P, P, P);
  }
}

/**
 * The flare: eight bright cells sitting just off the ray tips, the cardinal set
 * and the diagonal set alternating with the phase, so the mark throws light in
 * two held frames.
 *
 * This started life as a dithered halo — a chequer of low-alpha cells thinning
 * outwards, the trick the player's bubble uses. Rasterised at badge size it did
 * not work: a warm colour at 0.15–0.4 alpha over the deep teal sky desaturates to
 * grey-brown, so the mark came with a ring of what looked like dirt or damage. A
 * *few* cells at high alpha, placed symmetrically, read as light; many cells at
 * low alpha read as a rendering fault. The dither belongs on the bubble, where it
 * is 46px of field around a figure, not 12px of edge round an icon.
 */
function drawFlare(ctx: CanvasRenderingContext2D, cx: number, cy: number, phase: number): void {
  // The rays reach ~20px; 26 leaves a clear gap so the sunburst keeps its
  // silhouette instead of merging into an orange blob.
  const r = 26;
  const diagonals = Math.floor(phase * 8) % 2 === 1;
  for (let k = 0; k < 4; k += 1) {
    const ang = (k / 4) * Math.PI * 2 + (diagonals ? Math.PI / 4 : 0);
    // Solid, not translucent, for the same reason: a flat orange cell reads as a
    // spark, the same colour at 35% reads as grime.
    pxRect(ctx, RAY_LIT, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, P, P, P);
  }
}

/** The "stand here and hop" chevron, on the ground under the shaft. */
const CHEVRON: readonly string[] = ['..C..', '.C.C.', 'C...C'];
const CHEVRON_PALETTE: Palette = { C: `rgba(${SHAFT}, 0.68)` };

function drawGroundChevron(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  phase: number,
): void {
  // Two frames of a rising chevron, held (steps) rather than eased — an 8-bit
  // machine would not interpolate it.
  const lift = Math.floor(phase * 4) % 2 === 0 ? 0 : P;
  drawPixels(ctx, CHEVRON, CHEVRON_PALETTE, cx - 7.5, groundY - 18 - lift, { scale: 3 });
  pxRect(ctx, `rgba(${SHAFT}, 0.34)`, cx - P * 3, groundY - P, P * 6, P, P);
}
