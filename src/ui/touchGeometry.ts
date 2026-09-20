/**
 * touchGeometry — the sizes of the on-screen controls, as numbers rather than as CSS.
 *
 * WHY THIS IS A MODULE AND NOT FOUR LITERALS IN THE STYLESHEET. Upright, the control
 * band's constraint is the frame's *width*, and there can be **four** targets across it:
 * back, forward, the armed tool and jump. At the sizes this shipped with (76px pads and a
 * 104px jump, a 16px gap and a 14px edge inset) that row demands
 * `2*14 + 3*76 + 104 + 3*16 = 396px` — wider than a 390px iPhone frame, so on the single
 * most likely phone in this audience's pocket the move pad and the tool button
 * overlapped, and with the 12px hit slop on each they overlapped by more than they
 * looked like they did. Nothing caught it because a stylesheet cannot do arithmetic and
 * jsdom cannot do layout.
 *
 * So the portrait sizes are `clamp(min, N * --beam-run-u, max)` — frame-relative with a
 * floor and a ceiling, exactly like the bitmap type — the numbers live here, the CSS is
 * generated from them, and `rowWidthPx` lets a test check the fit at every phone width we
 * care about. The ceilings are the sizes that were tuned by hand and they are reached at
 * about 430px, so nothing changes on a normal phone; below that everything scales down
 * together instead of colliding.
 *
 * Landscape is deliberately NOT in here. Sideways the frame is wide (a tablet is ~1180px
 * across, against a row that wants under 400) and the constraint is the band's *height*,
 * so those sizes are fixed pixels in the stylesheet and the thing to check there is
 * vertical clearance, not fit.
 */

/** One clamped length: `clamp(min, u * --beam-run-u, max)`. */
export interface PadLength {
  /** Floor in CSS px. */
  min: number;
  /** Multiplier on `--beam-run-u` (1% of the frame width). */
  u: number;
  /** Ceiling in CSS px — the hand-tuned size, reached on a normal phone. */
  max: number;
}

export interface PadSpec {
  /** A secondary target: either move arrow, and the armed tool button. */
  pad: PadLength;
  /** The primary target. */
  jump: PadLength;
  /** Gap between two targets in the same cluster, and between the clusters. */
  gap: PadLength;
  /** Inset from the frame edge (before the device safe area, which is added on top). */
  edge: PadLength;
  /** How far the tool button sits above jump's baseline — the diagonal. */
  lift: PadLength;
  /** Invisible ring around each target, so a thumb does not have to be accurate. */
  slop: number;
}

/**
 * Upright sizes. The ceilings are the tuned ones; `u` is set so they are reached at
 * ~430px of frame and everything narrower shrinks in step.
 */
export const PAD_PORTRAIT: PadSpec = {
  pad: { min: 52, u: 18, max: 76 },
  jump: { min: 72, u: 26, max: 108 },
  gap: { min: 9, u: 3.4, max: 16 },
  edge: { min: 9, u: 3.4, max: 14 },
  /**
   * The lift is capped by the BAND, not by taste. The band is 180px, a home indicator
   * takes 34 of it and the zone's own inset another 16, so the tallest cluster has 130px
   * — and the tallest cluster is the lifted tool button (50 + 76), not jump (108). A lift
   * tuned to look right at 58px put it 4px outside the band, i.e. back over the gameplay,
   * which is the exact defect the band was introduced to fix.
   */
  lift: { min: 34, u: 11, max: 50 },
  slop: 12,
};

/**
 * The "larger controls" assist option, upright.
 *
 * On a 390px frame there is **no** horizontal headroom for four bigger circles — the
 * arithmetic below says the normal row already uses 378 of 390 — so what this option
 * buys on a narrow phone is mostly a wider hit ring, and the diameters only grow once
 * the frame can carry it. That is the honest version of the feature: pretending
 * otherwise is how the row came to overflow in the first place.
 */
export const PAD_PORTRAIT_LARGE: PadSpec = {
  pad: { min: 52, u: 18.5, max: 84 },
  jump: { min: 72, u: 26.5, max: 116 },
  gap: { min: 9, u: 3.4, max: 16 },
  edge: { min: 9, u: 3.4, max: 14 },
  /** Bigger circles leave the band less room for the diagonal, so the lift comes DOWN. */
  lift: { min: 34, u: 10.5, max: 44 },
  slop: 16,
};

/** Resolve one clamped length against a frame width, the way the browser will. */
export function padPx(len: PadLength, frameW: number): number {
  return Math.min(len.max, Math.max(len.min, (len.u * frameW) / 100));
}

/** `clamp()` text for the stylesheet. `u` is the frame unit (`--beam-run-u`). */
export function padCss(len: PadLength): string {
  return `clamp(${len.min}px, calc(${len.u} * var(--beam-run-u)), ${len.max}px)`;
}

/**
 * Total width the control row demands at a given frame width, with all FOUR targets
 * present — which is the case on the three screens that arm a tool, and the only case
 * worth measuring. Must come out under the frame width, or two clusters overlap.
 */
export function rowWidthPx(spec: PadSpec, frameW: number): number {
  const pad = padPx(spec.pad, frameW);
  const jump = padPx(spec.jump, frameW);
  const gap = padPx(spec.gap, frameW);
  const edge = padPx(spec.edge, frameW);
  // back + forward + tool + jump, three gaps between them, two edge insets.
  return 2 * edge + 3 * pad + jump + 3 * gap;
}

/**
 * Height the taller cluster demands, measured from the bottom of the frame: the lifted
 * tool button is the top of it, not jump. Must fit the band (180px by default) or the
 * controls climb back onto the gameplay, which is the defect the band exists to prevent.
 */
export function clusterHeightPx(spec: PadSpec, frameW: number, bottomInset: number): number {
  const lifted = padPx(spec.lift, frameW) + padPx(spec.pad, frameW);
  return bottomInset + Math.max(padPx(spec.jump, frameW), lifted);
}

/**
 * The pause button: small, square-ish, in the top band, and it has to clear both HUD
 * plaques.
 *
 * IT IS NOT CENTRED, AND THE FIRST CUT WAS. "Top-centre, because the corners are taken
 * by the two HUD stacks" is right about where the free space is and wrong about where the
 * middle of it is: the stage plaque is roughly twice the width of the lives plaque, so on
 * a 390px frame the gap between them runs from x 193 to x 288 — 96px wide, plenty — while
 * a centred 44px button sits at 173-217 and lands *inside the stage plaque*. The sum said
 * 96px of room and the raster showed a button overlapping a readout; the sum was
 * measuring the width of the gap instead of where the gap was.
 *
 * So it is anchored to the RIGHT edge, past the lives plaque, and the offset is built
 * from quantities the stylesheet can express rather than a measured width: the HUD gutter,
 * the lives plaque's own clamped width, the plaque chrome, and a little air. The lives
 * plaque is the right one to measure against because it is the width-*stable* one —
 * hollow hearts keep it from narrowing as lives are spent, and there is a test for that —
 * whereas the stage plaque's width depends on which level name is showing.
 *
 * A FIRST ATTEMPT USED THE LIVES READOUT'S `maxShare` AS THE BOUND, AND A SAFE BOUND IS
 * NOT THE SAME AS A TIGHT ONE. `maxShare` is 26% of the frame and the hearts never get
 * anywhere near it — they are 25 authored cells at 0.34 of a frame unit, i.e. about 8.5%
 * — so reserving 26% pushed the button 23px further left than it needed to go and back
 * onto the stage plaque. Reserving *more* space than something needs is how you collide
 * with the thing on the other side.
 */
export const PAUSE_BTN = {
  size: 44,
  radius: 10,
  /** Inset from the top of the frame, before the device safe area. */
  top: 10,
  /** Horizontal padding + rail on a plaque (HUD_PLAQUE_CHROME). */
  plaqueChrome: 28,
  /** Air between the lives plaque's worst case and this button. */
  clear: 10,
  /**
   * Below this frame width there is no horizontal gap to put it in *at all* — and that is
   * arithmetic, not a taste call, so no choice of anchor fixes it. On a 280px Galaxy Fold
   * cover screen the stage plaque ends at x 148 and the lives plaque starts at x 179: a
   * 31px slot for a 44px button, which is already the minimum target size. So under this
   * width the button drops BELOW the plaque row instead, which the band has room for.
   */
  narrowFrame: 340,
  /**
   * The drop, in CSS px from the top. The plaque row bottoms out at ~69px on a 280px
   * frame (the bitmap type is at its floor there: a 6-cell heart at 2.6px plus a caption
   * at 1.6px, plus the 5px stack gap, 14px of panel padding, the 6px rail and the stack's
   * own ~11px top offset), so 78 clears it — and 78 + 44 is 122 of the 180px band, so it
   * stays off the play frame, which is the point of the band.
   */
  narrowTop: 78,
} as const;

/**
 * The lives readout's art width, as the clamp the browser will resolve: 25 authored cells
 * (three 7-wide hearts with 2-cell gutters) at `HUD_PX.lives`, whose unit is 0.34 of a
 * frame unit with a 2.6px floor and a 5px ceiling. Restated here as plain numbers so this
 * module stays dependency-free, and `touchAndAssist.test.ts` asserts it against the real
 * `HUD_PX.lives` and `pipCells` so the two cannot drift.
 */
export const LIVES_PLAQUE: PadLength = { min: 65, u: 8.5, max: 125 };

/**
 * Where the left edge of the pause button lands, in CSS px from the left of the frame.
 * Used by the test that checks it clears the stage plaque on one side and the lives
 * plaque on the other.
 */
export function pauseLeftEdgePx(frameW: number): number {
  const gutter = Math.min(22, Math.max(8, frameW * 0.022));
  const lives = padPx(LIVES_PLAQUE, frameW) + PAUSE_BTN.plaqueChrome;
  return frameW - (gutter + lives + PAUSE_BTN.clear) - PAUSE_BTN.size;
}
