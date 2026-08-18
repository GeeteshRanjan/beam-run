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
import { drawPixels, maxWidth, pxRect, hash2, type Palette } from './PixelArt';

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

/**
 * Flattened. Drawn only on the life-lost frames after a DENIED stamp lands on
 * the player: the figure is pressed out sideways into the floor, hair splayed,
 * blazer spread, shoes squeezed out of both ends. Wider and far shorter than the
 * other frames, which is why `drawHero` measures the frame it is drawing rather
 * than assuming the 16×20 grid.
 */
const SQUASH: readonly string[] = [
  '......HHHHHHHHHH......',
  '....HHhSSSSSSSShHH....',
  '..HHhSSOSSssSSOSSHH...',
  '..SSSSSssssssSSSSS....',
  'jJJLWWWWTTTTWWWWLJJj..',
  'jJJJWWWWWTTWWWWWJJJj..',
  '.SPPPPPPPPPPPPPPPPPS..',
  '.PPPPPPPPPPPPPPPPPPP..',
  'BBB..PPPPPPPPPPPP..BBB',
];

export const HERO_GRID_W = maxWidth(IDLE);
export const HERO_GRID_H = IDLE.length;

/**
 * The idle pose as raw rows. Exported for the static not-found page, which
 * paints the hero as SVG rects at build time (there is no canvas on that page).
 * Tree-shaken out of the game bundle, which reaches the grid through `drawHero`.
 */
export const HERO_IDLE: readonly string[] = IDLE;

export type HeroMotion = 'idle' | 'run' | 'jump' | 'fall' | 'squash';

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
  if (state.motion === 'squash') return SQUASH;
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
  // Measured per frame, not from the idle grid: the squash pose is 20×7, so a
  // fixed 16×20 assumption would draw it off-centre and floating.
  const w = maxWidth(grid) * scale;
  const h = grid.length * scale;
  drawPixels(ctx, grid, HERO_PALETTE, centerX - w / 2, feetY - h, {
    scale,
    flip: state.facing === -1,
    alpha,
  });
}

/*
 * The Growth Point sprite used to live here — a rising bar chart with an
 * up-arrow, drawn for the collectibles scattered across every screen. Those
 * collectibles are gone (owner call): they were a second score competing with
 * the only figure the game is arguing about, and picking one up said nothing
 * about ANSR. The badge below is now the one thing on a screen worth reaching
 * for, and it moves, so reaching for it is a decision.
 */

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

/**
 * The ANSR bubble around an ANSR-backed player: a hazy 8-bit force field.
 *
 * Built entirely out of 4px cells, because a smooth `arc()` stroke and a radial
 * gradient — which is what this was first — is the one thing on screen that is not
 * 8-bit, and it read as a vector circle pasted over pixel art. Three layers, all
 * chunky:
 *
 *  1. a **dithered haze** filling the outer band, thickening towards the rim. 8-bit
 *     hardware had no alpha channel and faked transparency with a chequer of solid
 *     pixels; that is the language here (the same trick the scene overlays use).
 *  2. a **dashed pixel rim** — alternate cells bright and dim, the alternation
 *     rotating with `phase`, so the shell shimmers like a shield rather than sitting
 *     there like an outline.
 *  3. a few **orbiting sparks** just outside the rim, which is what makes it read as
 *     powered rather than as a bubble of soap.
 *
 * The middle is deliberately left empty so the figure inside stays crisp — the
 * field is drawn *behind* the hero, and haze over his face would cost more than it
 * buys. `pulse` (0..1) and `phase` (turns) come from the host's presentation clock;
 * with both held constant the whole thing is static, which is exactly what
 * `prefers-reduced-motion` wants — a steady field, not no field.
 *
 * Orange is allowed here and nowhere else on the player: the active capability is
 * what the value accent is for.
 */
export function drawAnsrBubble(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  feetY: number,
  pulse: number,
  phase = 0,
): void {
  const P = 4; // one field cell
  const cy = feetY - 30;
  const r = 46 + pulse * 3;
  const band = r * 0.7; // haze lives in the outer band only
  const core = r * 0.5; // …and the middle stays clear for the figure
  const drift = Math.floor(phase * 6); // dither crawl, in cells

  // 1. Dithered haze. Confined to a band just inside the shell: filling the whole
  // disc with speckle made the hero look like he was standing in sand, and the
  // field is supposed to be around him, not on him.
  for (let oy = -r; oy <= r; oy += P) {
    for (let ox = -r; ox <= r; ox += P) {
      const d = Math.sqrt(ox * ox + oy * oy);
      if (d > r || d < core) continue;
      const n = hash2(Math.round(ox / P) + 97, Math.round(oy / P) + 43 + drift);
      if (d < band) {
        // A few charged motes drifting in the clear part of the field.
        if (n > 0.955) pxRect(ctx, 'rgba(255, 84, 0, 0.14)', centerX + ox, cy + oy, P, P, P);
        continue;
      }
      const t = (d - band) / (r - band); // 0 at the band's inner edge, 1 at the rim
      if (n > 0.82 - 0.42 * t) {
        const a = 0.1 + 0.22 * t;
        const hot = n > 0.985;
        pxRect(
          ctx,
          hot ? `rgba(255, 184, 122, ${a + 0.25})` : `rgba(255, 84, 0, ${a})`,
          centerX + ox,
          cy + oy,
          P,
          P,
          P,
        );
      }
    }
  }

  // 2. Dashed rim. Stepping by roughly one cell of arc keeps the circle unbroken
  // without drawing the same cell twice.
  const steps = Math.max(16, Math.round((2 * Math.PI * r) / P));
  const spin = Math.floor(phase * steps);
  for (let i = 0; i < steps; i += 1) {
    const ang = (i / steps) * Math.PI * 2;
    const bright = (i + spin) % 2 === 0;
    // The upper-left quadrant catches the light, the way every 8-bit sphere does.
    const lit = Math.cos(ang + Math.PI * 0.75) > 0.4;
    const a = bright ? (lit ? 0.9 : 0.5 + 0.25 * pulse) : 0.12;
    pxRect(
      ctx,
      bright && lit ? `rgba(255, 184, 122, ${a})` : `rgba(255, 84, 0, ${a})`,
      centerX + Math.cos(ang) * r,
      cy + Math.sin(ang) * r,
      P,
      P,
      P,
    );
  }

  // 3. Orbiting sparks, a little outside the shell.
  for (let k = 0; k < 5; k += 1) {
    const ang = (phase + k / 5) * Math.PI * 2;
    const rr = r + P * (1 + (k % 2));
    pxRect(
      ctx,
      `rgba(255, 184, 122, ${0.5 + 0.4 * pulse})`,
      centerX + Math.cos(ang) * rr,
      cy + Math.sin(ang) * rr,
      P,
      P,
      P,
    );
  }
}

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
