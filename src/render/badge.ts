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
 *  3. **A chevron on the ground** under the shaft. The band no longer dips into a
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
 * The whole pickup: shaft, mark, wake and ground chevron. No ring round the mark — see
 * the note above `CHEVRON` for the four that were tried and why none of them stayed.
 *
 * Pure: same view in, same cells out. The host owns the clock and the
 * reduced-motion decision.
 */
export function drawBadgePickup(ctx: CanvasRenderingContext2D, v: BadgePickupView): void {
  drawShaft(ctx, v);
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
 * The badge STANDING ON SOMETHING: the Compliance maze's mark on its brick wall.
 *
 * No shaft, no band, no chevron — all three of those describe a pickup that moves,
 * and this one does not (`world/badgePerch.ts`). What is left has to do two jobs the
 * rail got for free:
 *
 *  1. **Say "pickup", not "ornament".** A 40px logo sitting still on masonry is a
 *     decoration; the lit plinth and four flare cells at full alpha are what make
 *     it a thing to go and take. Same call, and the same reasoning, as the four flare
 *     cells on the air-dropped mark lying on scorched brick.
 *  2. **Say where it is standing.** A lit course under the mark plus a short shadow
 *     ties it to the wall's top — without it the mark floats a tile above the
 *     brickwork, which is precisely the picture the rail used to draw.
 *
 * Pure, like the rest of this module: the host owns the phase and the reduced-motion
 * decision, and `surfaceY` is the top of the wall it stands on.
 */
export function drawBadgePerch(
  ctx: CanvasRenderingContext2D,
  v: { cx: number; cy: number; surfaceY: number; phase: number },
): void {
  // Contact shadow on the top course, so the mark is *on* the wall.
  pxRect(ctx, 'rgba(0,16,22,0.35)', v.cx - 14, v.surfaceY, 28, 3, 1);
  // The course it stands on, lit: a plinth two cells deep, which is what tells the
  // player the wall's top is a place they can be.
  pxRect(ctx, 'rgba(255,138,77,0.55)', v.cx - 18, v.surfaceY - 4, 36, 4, 2);

  drawAnsrBadgeMark(ctx, v.cx, v.cy, BADGE_MARK_D, Math.floor(v.phase * 8) % 2 === 0 ? 0 : 1);

  // Four flare cells off the mark, at full alpha and few — the halo lesson. They are
  // what carry the read from the far side of the frame, where the mark itself is 40px.
  for (const [dx, dy] of [
    [-26, -6],
    [26, -6],
    [-14, -26],
    [14, -26],
  ] as const) {
    pxRect(ctx, RAY_LIT, v.cx + dx - 2, v.cy + dy - 2, 5, 5, 1);
  }
}

/**
 * The mark on its way out of a ceiling spotlight (the Workplace).
 *
 * The fourth delivery's painting, and it has one job the other three do not: for the
 * first three seconds of every cycle the pickup is **visible and untakeable**, and the
 * picture has to say so. It does it with the two things a pixel screen has — position
 * and a countdown:
 *
 *  - `held` — the mark hangs under the fitting's lens with two short cables to it, and a
 *    lit plate under the lens, so it reads as *in the fitting* rather than as floating in
 *    the room. Nothing on the floor is marked yet.
 *  - `falling` — the cables are gone, a wake of three cells trails above it, and a
 *    contact shadow grows on the cabinet top it is heading for. The shadow is the whole
 *    of the "it is going to land *there*" read, and it is what lets a player start the
 *    run-up before it lands.
 *  - `live` — the perch treatment (`drawBadgePerch`) plus a countdown: four pips over the
 *    mark that go out one by one, and the whole thing blinking through the last
 *    `WARN_TIME`. Blinking is the one honest way to say "now or never" at this size.
 *
 * Pure, like the rest of this module: it takes the delivery's own numbers and a phase.
 */
export function drawBadgeCeilingDrop(
  ctx: CanvasRenderingContext2D,
  v: {
    phase: 'held' | 'falling' | 'live' | 'gone';
    source: { x: number; y: number };
    badge: { x: number; y: number };
    restY: number;
    remaining: number;
    progress: number;
    /** Animation phase for the mark's own two-frame shimmer. */
    tick: number;
    /** Seconds of life at which it starts blinking (`POWERUPS.CEILING.WARN_TIME`). */
    warnAt: number;
    /**
     * The y the mark hangs FROM: the bottom of the spotlight's lens
     * (`CEILING.SPOT_BOTTOM`), supplied by the host because it is the room's geometry
     * rather than the pickup's.
     *
     * It is not `source.y`, and that distinction is a defect this drawing shipped once: in
     * the `held` phase the mark *is* at `source`, so cables drawn between the two had zero
     * length and the mark rasterised **floating in mid-air 50px under the fitting with
     * nothing above it**. The pickup has to be visibly attached to the thing it is about
     * to fall out of, or the whole delivery reads as a bug.
     */
    hangFromY: number;
  },
): void {
  if (v.phase === 'gone') return;
  const { x: cx } = v.badge;

  if (v.phase === 'held') {
    // Two cables from the lens down to the mark. Paired, because one cable is a fishing
    // line — and they stop at the mark's top edge rather than at its centre.
    const drop = v.badge.y - BADGE_MARK_D / 2 - v.hangFromY;
    for (const dx of [-8, 6]) {
      pxRect(ctx, 'rgba(255,246,220,0.75)', cx + dx, v.hangFromY, 2, Math.max(2, drop), 1);
    }
    // A clip at the top of each, on the lens itself, so they are fixed to something.
    pxRect(ctx, 'rgba(255,250,232,0.9)', cx - 10, v.hangFromY, 20, 3, 1);
  }

  if (v.phase === 'falling') {
    // A three-cell wake above it, and the shadow on the surface it is aimed at.
    for (let i = 1; i <= 3; i += 1) {
      pxRect(ctx, `rgba(${SHAFT}, ${0.5 - i * 0.13})`, cx - P / 2, v.badge.y - i * P * 3, P, P, P);
    }
    const tight = 6 + 14 * (1 - v.progress);
    pxRect(ctx, 'rgba(0,16,22,0.4)', cx - tight, v.restY + BADGE_MARK_D / 2 - 3, tight * 2, 3, 1);
  }

  if (v.phase === 'live') {
    // Blink through the last seconds of its life: the "now or never" tell, and the one
    // thing that separates this pickup from a perched one that waits for ever.
    if (v.remaining < v.warnAt && Math.floor(v.tick * 8) % 2 === 0) return;
    drawBadgePerch(ctx, {
      cx,
      cy: v.badge.y,
      surfaceY: v.badge.y + BADGE_MARK_D / 2,
      phase: v.tick,
    });
    // Four pips going out, so the clock is legible without any type.
    const lit = Math.ceil(4 * (1 - v.progress));
    for (let i = 0; i < 4; i += 1) {
      pxRect(
        ctx,
        i < lit ? RAY_LIT : 'rgba(207,230,236,0.22)',
        cx - 17 + i * 9,
        v.badge.y - 30,
        6,
        4,
        2,
      );
    }
    return;
  }

  drawAnsrBadgeMark(ctx, cx, v.badge.y, BADGE_MARK_D, Math.floor(v.tick * 8) % 2 === 0 ? 0 : 1);
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

/*
 * **There is no halo round the mark any anymore, and this is the fifth and final entry in
 * that story** (owner call: "remove the halo effect that is around the ANSR powerup").
 *
 * What was tried, in order, and what each one actually looked like:
 *  - **A dithered field.** Warm cells at 0.15-0.4 alpha over the teal sky desaturate to
 *    grey-brown, so the mark came ringed in what looked like dirt. Stepped low-alpha bands
 *    did the same at 40px. Dither belongs on the player's bubble, where it is 46px of field
 *    around a figure, not 12px of edge around an icon.
 *  - **Four lone cells** off the ray tips: detached dots, not light.
 *  - **A radial corona** of short ticks. It reads beautifully as light — and also as *more
 *    rays*, so the brand mark stopped being a closed shape and became the middle of a
 *    bigger sunburst. Rejected on fidelity: the logo has to read as itself.
 *  - **A tangential dashed ring** (2px cells, 28px radius, crawling one cell per held
 *    frame), which is what shipped for several passes. Round a 40px mark it reads as a
 *    lasso drawn round the logo rather than as light coming off it, and on the Compliance
 *    perch — where the mark stands still on masonry — there is nothing to explain why the
 *    ring is turning.
 *
 * So the answer is **nothing**. The mark is the brand asset and it is allowed to be the
 * brand asset. What carries "this is a pickup" is everything that is *not* the logo: the
 * levitation shaft and its wake, the ground chevron, and on a perch the lit plinth plus
 * four flare cells at full alpha. Do not add a fifth ring.
 */

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
