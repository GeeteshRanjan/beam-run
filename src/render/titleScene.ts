/**
 * titleScene.ts — the attract screen behind the START overlay.
 *
 * Before this existed the start screen simply showed *level 0* behind a 92%
 * teal wash: a dim, half-legible backdrop with the in-world "MARKET ENTRY: ON
 * PAPER" sign showing through the copy. It read like a bug, not a title screen.
 *
 * This is a purpose-built 8-bit attract composition that says the whole pitch in
 * one picture: a lone executive standing on the left, a city skyline that *rises*
 * left→right (the market getting real), and the lit ANSR tower under a rising
 * sun on the right — the destination. Nothing is written here; all copy lives in
 * the DOM overlay (one source of truth, screen-reader friendly), so the art is
 * free to be art.
 *
 * The layout is pure and exported separately from the painting so it can be
 * asserted in tests without a canvas. Every animated element is gated on
 * `reduced` (prefers-reduced-motion): the scene is still beautiful frozen.
 */
import { RESOLUTION } from '../data/tuning.config';
import { drawBricks, hash2, pxRect } from './PixelArt';
import { tileMaterial } from './scenery';
import { drawHero } from './sprites';
import { drawAnsrLogo } from './ansrLogo';

const { WIDTH: W, HEIGHT: H } = RESOLUTION;

/** Top of the ground band (the attract scene has its own, lower horizon). */
export const TITLE_GROUND_Y = 624;

export interface TitleTower {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0..1 — how many windows are lit (the market waking up towards ANSR). */
  lit: number;
}

export interface TitleLayout {
  groundY: number;
  /** Distant skyline, ordered left → right, heights ramping upward. */
  towers: readonly TitleTower[];
  /** The ANSR tower — tallest, brightest, on the right. */
  ansr: { x: number; y: number; w: number; h: number };
  /** Rising sun behind the tower (the "go live" moment). */
  sun: { x: number; y: number; r: number };
  /** Where the hero stands, waiting to start. */
  hero: { x: number; feetY: number; scale: number };
}

/**
 * Pure geometry for the attract screen. Deterministic (hash noise only), so the
 * scene is identical every load and testable without a canvas.
 */
export function titleLayout(): TitleLayout {
  const groundY = TITLE_GROUND_Y;
  const towers: TitleTower[] = [];
  const count = 11;
  let x = -30;
  for (let i = 0; i < count; i += 1) {
    const n = hash2(i * 7 + 3, 19);
    const w = 74 + Math.floor(n * 56);
    // Heights ramp towards the ANSR tower: the closer to the destination, the
    // more of the market is standing.
    const ramp = i / (count - 1);
    const h = 60 + Math.round(ramp * 190 + n * 46);
    towers.push({ x, y: groundY - h, w, h, lit: 0.12 + ramp * 0.6 });
    x += w + 12 + Math.floor(hash2(i * 13 + 5, 29) * 24);
  }

  const ansr = { x: 966, y: groundY - 344, w: 178, h: 344 };
  const sun = { x: ansr.x + ansr.w / 2, y: groundY - 196, r: 148 };
  return {
    groundY,
    towers,
    ansr,
    sun,
    hero: { x: 214, feetY: groundY, scale: 4 },
  };
}

/** Pixel-banded retro sun: rows of rects with slits in the lower half. */
function drawPixelSun(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  const px = 6;
  for (let y = -r; y < r; y += px) {
    // Slits through the bottom half give the classic banded-sun silhouette.
    if (y > 0 && Math.floor(y / (px * 2)) % 2 === 1) continue;
    const half = Math.sqrt(Math.max(0, r * r - y * y));
    if (half < px) continue;
    const up = (y + r) / (2 * r); // 0 top → 1 bottom
    // Deep amber, deliberately duller than the reserved value-orange so the
    // primary CTA in the overlay stays the brightest orange on screen.
    const color = up < 0.34 ? '#7A3413' : up < 0.68 ? '#8E3E14' : '#A04A18';
    pxRect(ctx, color, cx - half, cy + y, half * 2, px, px);
  }
}

/**
 * Paint the attract scene into the internal 1280×720 space. `t` is a seconds
 * clock (pass 0 for a frozen frame); `reduced` freezes all motion.
 */
export function drawTitleScene(
  ctx: CanvasRenderingContext2D,
  t: number,
  reduced: boolean,
): void {
  const l = titleLayout();

  // --- sky ------------------------------------------------------------------
  const sky = ctx.createLinearGradient(0, 0, 0, l.groundY);
  sky.addColorStop(0, '#001B23');
  sky.addColorStop(0.55, '#00303D');
  sky.addColorStop(1, '#0A4B58');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, l.groundY);

  // Stars: stable positions, gentle twinkle (frozen under reduced motion).
  for (let i = 0; i < 74; i += 1) {
    const n = hash2(i * 17 + 1, 41);
    const m = hash2(i * 23 + 7, 53);
    const sx = Math.floor(n * W);
    const sy = Math.floor(m * 300) + 8;
    let a = 0.18 + n * 0.42;
    if (!reduced) a *= 0.62 + 0.38 * Math.sin(t * 1.7 + n * 40);
    pxRect(ctx, `rgba(207,230,236,${a.toFixed(3)})`, sx, sy, 3, 3, 3);
  }

  // --- sun + horizon glow ---------------------------------------------------
  drawPixelSun(ctx, l.sun.x, l.sun.y, l.sun.r);
  const glow = ctx.createRadialGradient(l.sun.x, l.groundY, 0, l.sun.x, l.groundY, 560);
  glow.addColorStop(0, 'rgba(255, 84, 0, 0.20)');
  glow.addColorStop(1, 'rgba(255, 84, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, l.groundY);

  // --- skyline --------------------------------------------------------------
  for (const tw of l.towers) {
    ctx.fillStyle = '#042630';
    ctx.fillRect(tw.x, tw.y, tw.w, tw.h);
    // Lit face on the sun-facing (right) edge + a roof highlight.
    pxRect(ctx, '#08343F', tw.x + tw.w - 6, tw.y, 6, tw.h, 3);
    pxRect(ctx, '#0A3D4A', tw.x, tw.y, tw.w, 4, 4);
    for (let wy = tw.y + 12; wy < l.groundY - 12; wy += 18) {
      for (let wx = tw.x + 9; wx < tw.x + tw.w - 9; wx += 15) {
        const n = hash2(wx, wy);
        if (n > tw.lit) continue;
        const flicker = reduced ? 1 : 0.72 + 0.28 * Math.sin(t * 0.9 + n * 40);
        pxRect(ctx, `rgba(159,216,228,${(0.5 * flicker).toFixed(3)})`, wx, wy, 6, 9, 3);
      }
    }
  }

  // --- the ANSR tower (the destination) -------------------------------------
  const a = l.ansr;
  const body = ctx.createLinearGradient(a.x, 0, a.x + a.w, 0);
  body.addColorStop(0, '#012F3B');
  body.addColorStop(0.5, '#0A5566');
  body.addColorStop(1, '#012F3B');
  ctx.fillStyle = body;
  ctx.fillRect(a.x, a.y, a.w, a.h);
  pxRect(ctx, '#5CE2F4', a.x, a.y, a.w, 4, 4); // crown edge
  // Warm lit windows — the one building that is fully awake.
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const wx = a.x + 16 + col * 30;
      const wy = a.y + 34 + row * 24;
      if (wy > l.groundY - 40) continue;
      const n = hash2(col * 3 + 1, row * 5 + 2);
      const lit = reduced ? 0.56 : 0.4 + 0.34 * (0.5 + 0.5 * Math.sin(t * 1.3 + n * 20));
      pxRect(ctx, `rgba(255,190,110,${lit.toFixed(3)})`, wx, wy, 16, 13, 4);
    }
  }
  // Bloom above the crown (orange = the value at the end of the journey).
  const pulse = reduced ? 1 : 0.88 + 0.12 * Math.sin(t * 1.8);
  const br = 132 * pulse;
  const bloom = ctx.createRadialGradient(a.x + a.w / 2, a.y, 0, a.x + a.w / 2, a.y, br);
  bloom.addColorStop(0, 'rgba(255, 84, 0, 0.42)');
  bloom.addColorStop(1, 'rgba(255, 84, 0, 0)');
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(a.x + a.w / 2, a.y, br, 0, Math.PI * 2);
  ctx.fill();
  // The real ANSR mark on the facade (same brand path the lockup and the Tech
  // Park plaza use — one logo everywhere, no approximations).
  drawAnsrLogo(ctx, a.x + a.w / 2, a.y + 96, 92, reduced ? 0 : t * 0.05);

  // --- ground ---------------------------------------------------------------
  drawBricks(ctx, 0, l.groundY, W, H - l.groundY, tileMaterial(0));
  const edge = tileMaterial(0).edge;
  if (edge) {
    ctx.fillStyle = edge;
    ctx.fillRect(0, l.groundY, W, 3);
  }

  // A faint trail of chevrons from the hero towards the tower: the journey the
  // player is about to walk. Static — it is a path, not an animation.
  for (let cx = l.hero.x + 96; cx < a.x; cx += 76) {
    pxRect(ctx, 'rgba(207,230,236,0.14)', cx, l.groundY + 26, 10, 4, 2);
    pxRect(ctx, 'rgba(207,230,236,0.14)', cx + 8, l.groundY + 22, 4, 12, 2);
  }

  // --- hero -----------------------------------------------------------------
  drawHero(
    ctx,
    { motion: 'idle', facing: 1, time: 0, still: true },
    l.hero.x,
    l.hero.feetY + 2,
    l.hero.scale,
  );
  // Grounding shadow so he doesn't float on the brick.
  pxRect(ctx, 'rgba(0,18,24,0.45)', l.hero.x - 30, l.hero.feetY + 2, 60, 5, 5);
}
