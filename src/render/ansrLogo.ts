/**
 * ansrLogo.ts — the real ANSR sunburst, on canvas.
 *
 * The DOM lockup on the start and end screens draws the brand asset itself (see
 * `ui/ansrMark.ts`), but the ANSR Tech Park plaza — the payoff at the end of the
 * run, the one place in the *world* that carries the brand — was still painting a
 * procedural 28-ray approximation. Same data now feeds both, so the mark on the
 * plaza is the actual logo.
 *
 * The path is compiled once into a `Path2D` and cached. `Path2D` is available in
 * every browser we target; where it is missing (jsdom in tests) the caller gets
 * `null` and simply skips the mark rather than throwing.
 */
import { ANSR_MARK_PATH, ANSR_MARK_W, ANSR_MARK_H, LOGO_ORANGE } from '../ui/ansrMark';

export { LOGO_ORANGE };

let cached: Path2D | null | undefined;

/** The compiled logo path, or null where Path2D is unavailable. */
export function ansrMarkPath(): Path2D | null {
  if (cached === undefined) {
    cached = typeof Path2D === 'function' ? new Path2D(ANSR_MARK_PATH) : null;
  }
  return cached;
}

/** Scale factor that fits the mark into a circle of the given diameter. */
export function ansrMarkScale(diameter: number): number {
  return diameter / Math.max(ANSR_MARK_W, ANSR_MARK_H);
}

/**
 * Draw the logo centred on (cx, cy), sized so its longest side spans `diameter`.
 * `rotation` (radians) turns the whole mark — the sunburst reads well slowly
 * revolving, and callers pass 0 under reduced motion.
 */
export function drawAnsrLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  diameter: number,
  rotation = 0,
  color = LOGO_ORANGE,
): void {
  const path = ansrMarkPath();
  if (!path) return;
  const scale = ansrMarkScale(diameter);
  ctx.save();
  ctx.translate(cx, cy);
  if (rotation !== 0) ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.translate(-ANSR_MARK_W / 2, -ANSR_MARK_H / 2);
  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.restore();
}
