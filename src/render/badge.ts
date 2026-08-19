/**
 * badge.ts — the floating ANSR pickup: the real brand mark, on 8-bit staging.
 *
 * The badge used to be a teal disc with a white "A" on it, glowing through a
 * canvas radial gradient and hanging on a solid 3px cyan line. Three things were
 * wrong with that: the mark was not the ANSR mark, the gradient was the one thing
 * on screen that was not pixel art (the same defect the player's bubble had), and
 * the rail read as a rope rather than as the path the pickup travels.
 *
 * What is here now:
 *
 *  1. **The mark — the real ANSR logo** (`render/ansrLogo.ts`, the same path the
 *     DOM lockup and the Tech Park plaza draw), sized to span the pickup hitbox
 *     exactly. It replaced an authored 19×19 pixel reduction of the sunburst,
 *     which the owner rightly called out as not being the logo we have: the
 *     brand mark is a hollow ring of ~32 fine rays, and a 19-cell grid can only
 *     hold 16 fat ones around a filled core, so it read as a generic star.
 *     Rasterised side by side at 40px, the real path is legible and unmistakably
 *     the logo; every attempt to quantise it to cells needed ~28 cells (56px, far
 *     wider than the hitbox) before the ray ring survived, and at 20 cells it
 *     collapsed into a blob. See the pass entry in `docs/JOURNAL.md` for the
 *     contact sheet. Precedent: the plaza mark and the attract-screen tower
 *     facade were switched from procedural approximations to this same path for
 *     the same reason, on the same instruction.
 *  2. **A levitation shaft** marking the band the badge travels: dashed cells with
 *     a bracket at each end of the swing, plus a short bright wake behind the
 *     badge so which way it is heading is readable at a glance.
 *  3. **A halo** — a dashed ring of 2px cells 8px clear of the ray tips, brighter
 *     across the upper-left where the light comes from, with the dash pattern
 *     crawling one cell per held frame. It replaced four lone cells that sat off
 *     the ray tips and alternated cardinals/diagonals: the owner called those out,
 *     and they were detached dots rather than light. Never a gradient.
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
import { drawPixels, pxRect, type Palette } from './PixelArt';
import { drawAnsrLogo } from './ansrLogo';
import { LOGO_ORANGE } from '../ui/ansrMark';
import { RESOLUTION } from '../data/tuning.config';

/** Brand orange, and a lighter tint of it for the shimmer. */
const RAY = LOGO_ORANGE;
const RAY_LIT = '#ff8a4d';

/**
 * The two shimmer tones, held on alternate frames. The old pixel mark shimmered
 * by swapping ray *classes* between them; the real mark is one path, so the whole
 * sunburst glints instead. Both tones are brand orange, so it reads as light
 * catching the mark rather than as a colour change.
 */
const MARK_TONES: readonly string[] = [RAY, RAY_LIT];

/**
 * Diameter of the mark, in px: exactly the pickup hitbox (`RESOLUTION.TILE`, the
 * box `badgeBoxAt` returns), so the thing you can see is the thing you can take.
 * Drawing it larger would promise reach the rules do not give — the same rule the
 * hazards follow ("a hazard sprite is its hitbox"), pointing the other way.
 */
export const BADGE_MARK_D = RESOLUTION.TILE;

/**
 * A dark backing for the void at the centre of the mark: a 4×4 block of whole
 * cells with the corners cut, 20px across at the badge's own size.
 *
 * The brand mark's core is empty, which is right on a page and wrong on a small
 * moving object: rasterised over screen 1's skyline, a lit cyan office window sat
 * inside the ring and the pickup read as a hole in the art rather than as a mark.
 * Kept translucent so it stays a shadow behind the rays, not a filled disc — and
 * kept to whole cells, because everything else in the world is.
 */
const CORE_CELLS: readonly string[] = ['.CC.', 'CCCC', 'CCCC', '.CC.'];
const CORE_PALETTE: Palette = { C: 'rgba(1, 28, 38, 0.86)' };

/** Cyan, the "this is a path, not a thing" colour. Also the shaft's colour. */
const SHAFT = '92, 226, 244';

/** One field cell. Everything here is a multiple of it. */
const P = 4;

/**
 * Draw the ANSR mark centred on (cx, cy). `twinkle` (0 or 1) picks the tone; hold
 * it constant for a static mark.
 *
 * `diameter` defaults to the pickup hitbox. Where `Path2D` is unavailable (jsdom)
 * `drawAnsrLogo` is a no-op, so the shaft, flare and chevron still mark the spot —
 * the pickup is never invisible, just unbranded.
 */
export function drawAnsrBadgeMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  diameter: number = BADGE_MARK_D,
  twinkle: 0 | 1 = 0,
): void {
  // Core first, so the rays always sit on top of their own backing.
  // 0.12 of the diameter per cell (20px of 40) fills the void with a cell to
  // spare on every side. Measured against the rasterised mark, not guessed: at
  // 0.10 the window edges still showed at 3 and 9 o'clock.
  const core = Math.round(diameter * 0.12);
  drawPixels(ctx, CORE_CELLS, CORE_PALETTE, cx - core * 2, cy - core * 2, { scale: core });
  drawAnsrLogo(ctx, cx, cy, diameter, 0, MARK_TONES[twinkle]!);
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
  /** Mark diameter in px. Defaults to the pickup hitbox ({@link BADGE_MARK_D}). */
  diameter?: number;
}

/**
 * The whole pickup: shaft, halo, mark, wake and ground chevron.
 *
 * Pure: same view in, same cells out. The host owns the clock and the
 * reduced-motion decision.
 */
export function drawBadgePickup(ctx: CanvasRenderingContext2D, v: BadgePickupView): void {
  drawShaft(ctx, v);
  drawHalo(ctx, v.cx, v.cy, v.phase);
  drawAnsrBadgeMark(
    ctx,
    v.cx,
    v.cy,
    v.diameter ?? BADGE_MARK_D,
    Math.floor(v.phase * 8) % 2 === 0 ? 0 : 1,
  );
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
 * The halo, in one cell size: a dashed ring 8px clear of the ray tips, lit across
 * the upper-left, its dash pattern crawling one cell per held frame.
 *
 * Three earlier attempts and why they failed, so nobody spends the afternoon again
 * (all four rasterised side by side on screens 1, 2 and 5 — see `docs/JOURNAL.md`):
 *  - **A dithered field.** Warm cells at 0.15–0.4 alpha over the teal sky
 *    desaturate to grey-brown, so the mark came ringed in what looked like dirt.
 *    Same for stepped low-alpha *bands*: at 40px they read as a smudge, not a glow.
 *    Dither belongs on the player's bubble, where it is 46px of field around a
 *    figure, not 12px of edge around an icon.
 *  - **Four lone cells** off the ray tips (what shipped, and what the owner
 *    rejected). Detached dots read as stray pixels, not as light.
 *  - **A radial corona** of short ticks. It reads beautifully as light — and it
 *    also reads as *more rays*, so the brand mark stops being a closed shape and
 *    starts being the middle of a bigger sunburst. Rejected on fidelity: the logo
 *    has to read as itself.
 *
 * A tangential dashed ring says "halo" without adding rays, and it is the same
 * device as the ANSR bubble's rim on the player, so the two read as one family.
 * `HALO_PX` is deliberately 2, not the `P` = 4 field cell: at 4px the ring is as
 * thick as the ray tips are long and it swallows the mark.
 */
const HALO_PX = 2;
/** Ring radius in halo cells (14 × 2px = 28px, clear of the 20px ray tips). */
const HALO_R = 14;
/** Dash pattern, in cells: 3 lit, 2 blank. */
const HALO_ON = 3;
const HALO_OFF = 2;

function drawHalo(ctx: CanvasRenderingContext2D, cx: number, cy: number, phase: number): void {
  const period = HALO_ON + HALO_OFF;
  const steps = Math.round(2 * Math.PI * HALO_R);
  // Two dash cycles per turn, in held steps — an 8-bit machine would not ease it.
  const spin = Math.floor(phase * period * 2) % period;
  // Snap the ring's origin the way `drawPixels` snaps a sprite's, so the cells sit
  // on a stable lattice as the badge drifts instead of shivering against it.
  const ox = Math.round(cx);
  const oy = Math.round(cy);
  for (let i = 0; i < steps; i += 1) {
    if ((i + spin) % period >= HALO_ON) continue;
    const ang = (i / steps) * Math.PI * 2;
    // Radius in whole cells, so the ring is a real circle on the lattice.
    const dx = Math.round(Math.cos(ang) * HALO_R) * HALO_PX;
    const dy = Math.round(Math.sin(ang) * HALO_R) * HALO_PX;
    // The upper-left quadrant catches the light, the way every 8-bit sphere does.
    const lit = Math.cos(ang + Math.PI * 0.75) > 0.35;
    pxRect(ctx, lit ? RAY_LIT : RAY, ox + dx, oy + dy, HALO_PX, HALO_PX, HALO_PX);
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
