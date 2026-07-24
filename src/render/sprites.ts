/**
 * sprites.ts — hand-authored 8-bit sprite data for Beam Run.
 *
 * The hero is a HUMAN founder/executive walking the market-entry journey (a
 * deliberate change from the abstract "Beam" orb): dark hair, skin, a light
 * shirt with a teal blazer and dark trousers. The light shirt is intentional —
 * it gives the most gameplay-critical sprite a strong ≥3:1 silhouette against
 * the teal backdrops (accessibility), while the blazer keeps him on-brand.
 *
 * Orange is deliberately NOT used on the hero: the brand reserves orange for
 * "value unlocked" (active powers, badge burst), so the player character stays
 * teal/neutral and orange always means progress.
 *
 * All grids are 12×16 cells. Feet sit on the bottom row; the sprite is centred
 * horizontally on the player's hitbox and its bottom aligns to the feet.
 */
import { drawPixels, maxWidth, type Palette } from './PixelArt';

/** Extra human tones live alongside the brand palette (skin/hair are needed
 * for a believable person and cannot come from the 5 brand colours). */
export const HERO_PALETTE: Palette = {
  O: '#0A1416', // outline / eyes (near-black)
  H: '#241A12', // hair (dark brown)
  S: '#E8B48C', // skin
  s: '#C98E64', // skin shadow
  J: '#005465', // blazer (brand Light Teal)
  j: '#013947', // blazer shadow / tie
  W: '#E6E6E6', // shirt (brand Light Grey) — high-contrast core
  P: '#0A2A33', // trousers (deep teal-dark)
  B: '#0A1416', // shoes
};

// Shared upper body (head + torso + arms), rows 0..12.
const UPPER: readonly string[] = [
  '    HHHH    ',
  '   HHHHHH   ',
  '   HSSSSH   ',
  '   SSSSSS   ',
  '   SOssOS   ',
  '   SSssSS   ',
  '    SSSS    ',
  '   jWPPWj   ',
  '  jJWPPWJj  ',
  '  JJWPPWJJ  ',
  '  JJWPPWJJ  ',
  '  SJWPPWJS  ',
  '   PPPPPP   ',
];

const IDLE: readonly string[] = [
  ...UPPER,
  '    PPPP    ',
  '    PPPP    ',
  '    BBBB    ',
];

// Run frame A — legs open (stride).
const RUN_A: readonly string[] = [
  ...UPPER,
  '    PPPP    ',
  '  PP    PP  ',
  '  BB    BB  ',
];

// Run frame B — legs together (passing). Alternating A/B reads as a walk cycle.
const RUN_B: readonly string[] = [
  ...UPPER,
  '    PPPP    ',
  '    PPPP    ',
  '    BBBB    ',
];

// Airborne rising — legs tucked/spread for lift.
const JUMP: readonly string[] = [
  ...UPPER,
  '   PPPPPP   ',
  '  PP    PP  ',
  '  BB    BB  ',
];

// Airborne falling — legs reaching for ground.
const FALL: readonly string[] = [
  ...UPPER,
  '   PPPPPP   ',
  '   PP  PP   ',
  '   BB  BB   ',
];

export const HERO_GRID_W = maxWidth(IDLE);
export const HERO_GRID_H = IDLE.length;

export type HeroMotion = 'idle' | 'run' | 'jump' | 'fall';

export interface HeroDrawState {
  motion: HeroMotion;
  facing: 1 | -1;
  /** Presentation clock (s); drives the run cadence. */
  time: number;
  /** Static pose (reduced-motion): always idle, no cycle. */
  still?: boolean;
}

/** Choose the frame grid for the current motion state. */
function heroFrame(state: HeroDrawState): readonly string[] {
  if (state.motion === 'jump') return JUMP;
  if (state.motion === 'fall') return FALL;
  if (state.motion === 'run' && !state.still) {
    // ~8 fps leg cadence.
    return Math.floor(state.time * 8) % 2 === 0 ? RUN_A : RUN_B;
  }
  return IDLE;
}

/**
 * Draw the hero. `centerX` is the hitbox centre; `feetY` is the bottom of the
 * hitbox (where the shoes land). `scale` sizes one authored pixel.
 */
export function drawHero(
  ctx: CanvasRenderingContext2D,
  state: HeroDrawState,
  centerX: number,
  feetY: number,
  scale: number,
  alpha = 1,
): void {
  const grid = heroFrame(state);
  const w = HERO_GRID_W * scale;
  const h = HERO_GRID_H * scale;
  const x = centerX - w / 2;
  const y = feetY - h;
  drawPixels(ctx, grid, HERO_PALETTE, x, y, {
    scale,
    flip: state.facing === -1,
    alpha,
  });
}

// --- Growth Point: a rising line-graph glyph (fits "growing the company") ---

const POINT_GRID: readonly string[] = [
  '......GG',
  '.....G..',
  '...GG...',
  '..G.....',
  'GG......',
  'a.......',
  'a.......',
  'aaaaaaaa',
];

const POINT_PALETTE: Palette = {
  G: '#E6E6E6', // trend line (light grey)
  a: '#2E7D8C', // axes (teal)
};

/** Draw a Growth Point centred at (cx,cy). */
export function drawGrowthPoint(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale = 3,
): void {
  const w = maxWidth(POINT_GRID) * scale;
  const h = POINT_GRID.length * scale;
  drawPixels(ctx, POINT_GRID, POINT_PALETTE, cx - w / 2, cy - h / 2, { scale });
}

// --- ANSR badge: a teal disc carrying a white "A" mark ----------------------

const BADGE_GRID: readonly string[] = [
  '....eeee....',
  '..eeCCCCee..',
  '.eCCCCCCCCe.',
  '.eCCCWWCCCe.',
  'eCCCWWWWCCCe',
  'eCCWWCCWWCCe',
  'eCCWWWWWWCCe',
  'eCCWWCCWWCCe',
  '.eCWWCCWWCe.',
  '.eCCCCCCCCe.',
  '..eeCCCCee..',
  '....eeee....',
];

const BADGE_PALETTE: Palette = {
  e: '#013947', // rim (deep teal)
  C: '#005465', // face (light teal)
  W: '#FFFFFF', // mark
};

export const BADGE_GRID_W = maxWidth(BADGE_GRID);

/** Draw the ANSR badge disc centred at (cx,cy) at the given pixel scale. */
export function drawBadgeDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
): void {
  const w = BADGE_GRID_W * scale;
  const h = BADGE_GRID.length * scale;
  drawPixels(ctx, BADGE_GRID, BADGE_PALETTE, cx - w / 2, cy - h / 2, { scale });
}
