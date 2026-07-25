/**
 * sprites.ts — hand-authored 8-bit sprite data for Beam Run.
 *
 * The hero is a HUMAN executive walking the market-entry journey (a deliberate
 * change from the abstract "Beam" orb): dark hair with a highlight, a face with
 * eyes and a hint of a smile, a light shirt + tie under a teal blazer with
 * lapels, trousers and shoes. The light shirt is intentional — it gives the
 * most gameplay-critical sprite a strong ≥3:1 silhouette against the teal
 * backdrops (accessibility), while the blazer keeps him on-brand.
 *
 * Orange is deliberately NOT used on the hero: the brand reserves orange for
 * "value unlocked" (active powers, badge burst), so the player character stays
 * teal/neutral and orange always means progress.
 *
 * Grids are 16×20 cells. Feet sit on the bottom row; the sprite is centred
 * horizontally on the player's hitbox and its bottom aligns to the feet.
 */
import { drawPixels, maxWidth, type Palette } from './PixelArt';

/** Human tones (skin/hair) sit alongside the brand palette — a believable
 * person can't be built from the 5 brand colours alone. */
export const HERO_PALETTE: Palette = {
  O: '#0A1416', // outline / eyes (near-black)
  H: '#241A12', // hair (dark brown)
  h: '#3A2A1C', // hair highlight
  S: '#E8B48C', // skin
  s: '#C98E64', // skin shadow (nose/mouth/jaw)
  J: '#005465', // blazer (brand Light Teal)
  j: '#013947', // blazer shadow / sleeve edge
  L: '#0A6B80', // lapel / blazer highlight
  W: '#E6E6E6', // shirt (brand Light Grey) — high-contrast core
  w: '#B9C2C4', // shirt shadow
  T: '#0A2A33', // tie (deep teal-dark)
  P: '#0A2A33', // trousers
  p: '#06181E', // trouser shadow
  B: '#0A1416', // shoes
};

// Head + torso + waist (rows 0..15) — shared across every pose.
const UPPER: readonly string[] = [
  '.....HHHHHH.....',
  '....HHHHHHHH....',
  '....HhSSSShH....',
  '....hSSSSSSh....',
  '.....SOSSOS.....',
  '.....SSSSSS.....',
  '.....SssssS.....',
  '......SSSS......',
  '.....WwTTwW.....',
  '..jJJLWTTWLJJj..',
  '..jJJLWTTWLJJj..',
  '..jJJLWTTWLJJj..',
  '..SJJLWTTWLJJS..',
  '....JJWWWWJJ....',
  '....PPPPPPPP....',
  '....PPPPPPPP....',
];

const IDLE: readonly string[] = [
  ...UPPER,
  '....PPP..PPP....',
  '....PPP..PPP....',
  '....pPP..PPp....',
  '....BBB..BBB....',
];

// Run frame A — legs open (stride).
const RUN_A: readonly string[] = [
  ...UPPER,
  '....PPP..PPP....',
  '...PPP....PPP...',
  '..pPP......PPp..',
  '..BBB......BBB..',
];

// Run frame B — legs together (passing). Alternating A/B reads as a walk cycle.
const RUN_B: readonly string[] = [
  ...UPPER,
  '....PPP..PPP....',
  '....PPP..PPP....',
  '......PPPP......',
  '......BBBB......',
];

// Airborne rising — knees tucked, feet lifted.
const JUMP: readonly string[] = [
  ...UPPER,
  '....PPP..PPP....',
  '...PPP....PPP...',
  '...BB......BB...',
  '................',
];

// Airborne falling — legs reaching down and spread.
const FALL: readonly string[] = [
  ...UPPER,
  '....PPP..PPP....',
  '....PPP..PPP....',
  '...pPP....PPp...',
  '...BBB....BBB...',
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
    return Math.floor(state.time * 8) % 2 === 0 ? RUN_A : RUN_B; // ~8 fps cadence
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
  drawPixels(ctx, grid, HERO_PALETTE, centerX - w / 2, feetY - h, {
    scale,
    flip: state.facing === -1,
    alpha,
  });
}

// --- Growth Point: a rising bar-chart with an up-arrow (company growth) ------

const POINT_GRID: readonly string[] = [
  '........A.......',
  '.......AAA......',
  '......A.A.A.....',
  '........A....GG.',
  '........A..GGGG.',
  '.....G..A.GGGGG.',
  '...GGG.GGGGGGGG.',
  '.GGGGG.GGGGGGGG.',
  'aaaaaaaaaaaaaaaa',
];

/*
 * Muted a step from the first "make it pop" pass, which came out shouting: the
 * separation is doing its work through the dark outline below, so the fill can
 * sit a shade under pure white and the mint can drop out of neon without the
 * pickup sinking back into the ground materials it has to read against.
 */
const POINT_PALETTE: Palette = {
  G: '#E8F2F4', // bars (near-white, a touch cool — still the brightest thing nearby)
  A: '#7FD9AE', // up-arrow (mint, off the neon)
  a: '#49A8BC', // baseline axis (mid teal)
};

/** Same grid, all-dark: painted at four offsets as a 1px contrast outline. */
const POINT_OUTLINE: Palette = { G: '#04141A', A: '#04141A', a: '#04141A' };

export const POINT_GRID_W = maxWidth(POINT_GRID);

/**
 * Draw a Growth Point centred at (cx,cy).
 *
 * No plate, no frame: the pickup is just the sprite, made to pop on its own.
 * Contrast comes from (a) the palette — pure white bars and a hot mint arrow,
 * both far brighter than any ground material we use — and (b) a one-pixel dark
 * outline traced around the silhouette, which is how pixel art has always kept
 * a sprite legible over both light and dark backgrounds. That's a border on the
 * *shape*, not a card behind it.
 */
export function drawGrowthPoint(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale = 2,
): void {
  const w = POINT_GRID_W * scale;
  const h = POINT_GRID.length * scale;
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2);

  // Outline: the same grid painted dark at four one-pixel offsets.
  for (const [dx, dy] of [
    [-scale, 0],
    [scale, 0],
    [0, -scale],
    [0, scale],
  ] as const) {
    drawPixels(ctx, POINT_GRID, POINT_OUTLINE, x + dx, y + dy, { scale });
  }
  drawPixels(ctx, POINT_GRID, POINT_PALETTE, x, y, { scale });
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
