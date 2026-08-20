/**
 * scenery.ts — per-level 8-bit environments where every element MEANS something.
 *
 * Each screen is a literal picture of a GCC market-entry stage (see GDD §4
 * "meaning map"). This module owns two things:
 *
 *   1. TILE_MATERIALS — how the ground/platforms of each level are textured, so
 *      the surface you stand on reads as part of that level's story (polished
 *      lobby floor → cracked red-tape ground → scorched brick → stamped
 *      compliance tile → weathered stone → bright plaza).
 *
 *   2. drawSceneBackground — the backdrop for each stage, rendered in chunky
 *      pixels and kept behind gameplay but legible: signage uses solid dark
 *      plaques so it holds up against a busy backdrop at any brightness.
 *
 *      Two of the six are INTERIORS and open on no sky at all: Reception, which is
 *      an office lobby (entrance glazing, desk, lift bank — the market is outside
 *      the glass), and the Workplace, which is the same building's floor with the
 *      ceiling out. The other four are the skyline of the market you are entering,
 *      plus that stage's own props: stalled paperwork, the compliance climb, the
 *      hiring crowd, and the Tech Park arrival.
 *
 * Every label here is deliberate. Reception names its three easy hops (business
 * case, board approval, budget) so the tutorial is also the first story beat; the
 * hazard screens name the real-world thing you are fighting.
 */
import { RESOLUTION } from '../data/tuning.config';
import { drawBricks, hash2, pxRect, type BrickOptions } from './PixelArt';
import { drawText, drawLabelPlaque } from './PixelText';
import { drawAnsrLogo, LOGO_ORANGE } from './ansrLogo';

const { WIDTH: W, TILE } = RESOLUTION;
const GROUND_TOP = 15 * TILE; // 600

export interface TileMaterial extends BrickOptions {
  /** Optional flat cap colour painted as the very top walkable edge. */
  edge?: string;
}

/**
 * Ground/platform material per screen id. Colours stay in the teal family
 * (brand) with per-level shifts that carry meaning.
 */
export const TILE_MATERIALS: Record<number, TileMaterial> = {
  // L0 Reception — a polished stone lobby floor: clean, inviting ("getting started
  // is easy"), and bright enough that the walkable ground lifts off the interior
  // behind it.
  //
  // Big slabs at very low speckle, where every other screen is a small rough
  // course: a lobby floor is *laid*, and the one thing that says "maintained" in a
  // material is the size and regularity of its joints. This is the same reasoning
  // that keeps the Workplace floor (screen 3) a scuffed 40×40 grey-green — the two
  // interiors separate on material, not on hue.
  0: {
    // Speckle is deliberately ZERO here, and it is the only material in the game
    // with none: every dot of it rasterised as litter on a floor whose whole job is
    // to look swept. What is left is the course grid at low contrast — laid stone.
    face: '#15788B', shade: '#12707F', highlight: '#1E8AA0', mortar: '#0F6376',
    brickW: 64, brickH: 32, speckle: 0, edge: '#7FEBFC',
  },
  /*
   * L1 Setup Delays — ink-stained clay brick. Warm and earthy, deliberately NOT
   * the reserved value-orange.
   *
   * Refined rather than redesigned (owner call: "make the brick a bit more
   * refined"). It was a 24×16 course at 0.22 speckle, which is the roughest
   * material in the game by a distance, and at that density the speckle stopped
   * being texture and became litter: the whole floor read as noise, and noise
   * directly under four slamming hazards is the last place it belongs. Three
   * changes, all of them in the same direction:
   *
   *  · **A calmer, larger course** (40×20 rather than 24×16), so the joints read as
   *    brickwork instead of as a mesh. It also matches the 40px grid, which means
   *    the small hurdle blocks between the stamp pairs are exactly one brick wide
   *    and two courses tall — they read as a low wall rather than as a cut tile.
   *  · **Speckle down to 0.08, with the variation moved brick-to-brick** (`faces`).
   *    Value variation across bricks is what makes masonry look laid; dots inside
   *    each brick just make it look dirty.
   *  · **A bevel**, i.e. the shadow each course casts on the one below, which is
   *    what gives the surface depth without adding another colour to the screen.
   */
  1: {
    face: '#6E4C3A', shade: '#4A3225', highlight: '#8F6448', mortar: '#2B1B14',
    brickW: 40, brickH: 20, speckle: 0.08, edge: '#A87A54',
    faces: ['#6E4C3A', '#66452F', '#755442', '#644430'],
    bevel: true,
  },
  // L2 Compliance maze — archive brick, warm brown (owner call: "the brick has to
  // be coloured brownish"). It used to be cool slate, which made the whole climb
  // one blue-grey mass against a blue-grey sky; brown is the market's other half
  // of the frame, so the maze now silhouettes against the teal skyline instead of
  // dissolving into it.
  //
  // It has to stay distinct from screen 1's clay, which is also brown. Two things
  // separate them and neither is the hue: this one is **lighter and more golden**
  // (kraft/manila — filed paper stacked into architecture, which is the read this
  // screen wants) and its course is a clean 20×20 grid at low speckle, where
  // screen 1's is a rough 24×16 at 0.22. Material, not colour.
  //
  // Refined on the same pass that gave this screen its weather (owner: "see what we
  // can do to make this look better and less cognitive overload"), the same three
  // moves that quietened screen 1's clay, for the same reasons. It was a 20×20 grid at
  // 0.1 speckle: a 20px course over a 240px block is 12 rows of joint, which reads as
  // a mesh laid over the whole climb rather than as masonry, and this screen has more
  // stone in it than any other. A 40×20 course halves the joint count and lands on the
  // tile grid, so a one-tile step is exactly one brick; the variation moves
  // brick-to-brick (`faces`) where it looks laid instead of dotted; and the `bevel`
  // gives each course its own shadow, which is what carries depth now that there is a
  // bright sky behind the maze to silhouette against.
  2: {
    face: '#6E5238', shade: '#4A3826', highlight: '#936E48', mortar: '#241708',
    brickW: 40, brickH: 20, speckle: 0.05, edge: '#C29A66',
    faces: ['#6E5238', '#66492F', '#75593D', '#614529'],
    bevel: true,
  },
  /*
   * L3 Workplace — office floor tile: a big cool grey-green square. Not the
   * compliance slate (that material is filed paper) and not warm: this floor is a
   * real office nobody has maintained. The room's grime and its light are painted
   * over it by `render/workplace.ts`, driven by the fix, so the material stays
   * neutral.
   *
   * Refined the same way screen 1's clay was, and for the same reason: at 0.16 the
   * speckle stopped being a scuff and became litter across the whole bottom of the
   * frame, which is where the player and the one lethal figure both live. Speckle
   * down to 0.05, the variation moved tile-to-tile (`faces`), and a `bevel` so the
   * courses have depth — a floor that is *laid* rather than a slab with dirt on it.
   */
  /*
   * …and then moved OFF the teal axis entirely (owner call: "the player and the
   * brick and background feels the same").
   *
   * It was `#28383D`, a cool grey-green two steps off the wall's own `#0A2B33` — so
   * the wall, the floor and a hero whose blazer is brand Light Teal were three
   * variations on one hue, and the frame read as a single dark field with shapes
   * scored into it. The floor is a **warm grey-olive** now: the same *value* family,
   * a different temperature, which is what buys the separation without introducing a
   * fifth colour to the screen or touching the hero (he appears on six screens and
   * cannot be tuned for one). Same reasoning as screen 2 going brown — two adjacent
   * surfaces may share a value if they do not share a temperature.
   *
   * It is also a step LIGHTER, and the walkable edge two steps lighter again, because
   * the one line on this screen the player has to read at a glance is the floor they
   * are standing on.
   */
  3: {
    face: '#3C443A', shade: '#282E27', highlight: '#5C6656', mortar: '#171B16',
    brickW: 40, brickH: 40, speckle: 0.03, edge: '#96A38C',
    faces: ['#3C443A', '#363E34', '#424B3F', '#313930'],
    bevel: true,
  },
  // L4 Hire Under Fire — scorched brick: warm burnt terracotta.
  4: {
    face: '#7C3E2E', shade: '#57271B', highlight: '#A65C3E', mortar: '#2A120C',
    brickW: 40, brickH: 20, speckle: 0.18, edge: '#C06B42',
  },
  // L5 Tech Park — bright plaza pavers: the payoff, brightest cyan of all.
  5: {
    face: '#1E92AA', shade: '#12708A', highlight: '#46C4DA', mortar: '#08414F',
    brickW: 40, brickH: 20, speckle: 0.05, edge: '#5CE2F4',
  },
};

export function tileMaterial(id: number): TileMaterial {
  return TILE_MATERIALS[id] ?? TILE_MATERIALS[0]!;
}

/** Paint one solid rectangle as textured level material. */
export function drawTileRect(
  ctx: CanvasRenderingContext2D,
  id: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const m = tileMaterial(id);
  drawBricks(ctx, x, y, w, h, m);
  if (m.edge) {
    ctx.fillStyle = m.edge;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 3);
  }
}

// ---------------------------------------------------------------------------
// Background scene
// ---------------------------------------------------------------------------

/** Vertical dithered sky (deep teal), with a per-level tint at the horizon. */
function drawSky(ctx: CanvasRenderingContext2D, horizonTint: string): void {
  drawSkyBand(ctx, ['#00212B', '#002B37', horizonTint]);
}

/**
 * The same sky, with all three stops given — top, 60% and horizon.
 *
 * Screen 2's weather moves every one of them (`mixHex`), so it cannot use the fixed
 * night-teal top the other four skies share.
 */
function drawSkyBand(ctx: CanvasRenderingContext2D, stops: [string, string, string]): void {
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_TOP);
  grad.addColorStop(0, stops[0]);
  grad.addColorStop(0.6, stops[1]);
  grad.addColorStop(1, stops[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, GROUND_TOP);

  // Chunky ordered-dither band near the horizon so the gradient reads 8-bit.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = GROUND_TOP - 96; y < GROUND_TOP; y += 8) {
    const density = (GROUND_TOP - y) / 96; // fewer dots higher up
    for (let x = 0; x < W; x += 8) {
      if (hash2(x >> 3, y >> 3) < 0.5 - density * 0.4) {
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }
}

/* ---------------------------------------------------------------------------
 * The Compliance maze's WEATHER (screen 2).
 *
 * This screen is the one place in the game where the badge's effect is painted on
 * the world instead of on the player (owner call: "when the user takes the powerup
 * just make the gloomy weather brighter, signalling happiness and change and that
 * the environment is fresh" — and no orange halo on the hero). So the backdrop needs
 * two states and a dial between them, exactly like the Workplace's `restore`:
 *
 *   clear = 0  a leaden overcast lid, rain, a dark horizon, dim windows
 *   clear = 1  daylight: a bright horizon, the cloud bank broken into small lit
 *              cumulus, the rain gone, and a low sun through the gap
 *
 * Two rules borrowed from that screen, both of them paid for there: the *good* state
 * is what the geometry is authored against and the gloom is a layer over it, and the
 * change has to be visible across the whole frame rather than in one corner (the
 * full-frame part is `drawWeatherWash` in `render/maze.ts`, which goes over the
 * masonry and under the cast).
 *
 * `clear` arrives as a plain number. `drawSceneBackground` still knows nothing about
 * hazards, badges or the simulation — it is handed a weather dial, and the fact that
 * a compliance monster is what moved it is none of its business.
 * ------------------------------------------------------------------------- */

/** Blend two `#rrggbb` strings. `f` 0 → a, 1 → b. */
function mixHex(a: string, b: string, f: number): string {
  const p = Math.max(0, Math.min(1, f));
  const ch = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * p));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The cloud bank, authored rather than random so it is the same picture every run.
 *
 * Each entry is a cloud's centre, its half-width and its row. Under gloom they are
 * drawn at full width in a value just above the sky, which is what an overcast lid
 * looks like — one continuous mass with no gaps. As `clear` rises they contract
 * towards their own centres and lighten to lit cumulus, so the sky *opens* rather
 * than the clouds fading out (a cloud that fades is a rendering fault; a cloud that
 * shrinks is weather).
 */
const CLOUDS: readonly { cx: number; hw: number; y: number; lobes: number }[] = [
  { cx: 120, hw: 150, y: 140, lobes: 0 },
  { cx: 420, hw: 190, y: 112, lobes: 1 },
  { cx: 700, hw: 160, y: 152, lobes: 2 },
  { cx: 980, hw: 200, y: 120, lobes: 0 },
  { cx: 1230, hw: 140, y: 148, lobes: 1 },
];

/**
 * One cell of weather. 4px — the same cell the rain, the sun and the badge's halo use.
 *
 * The first version of this sky drew each cloud as three stacked `pxRect`s snapped to 4,
 * which is 8-bit in the sense that a barcode is: the steps were 20px and 40px wide, so
 * the silhouette was a bar chart (owner: "way too pixelated and not refined"). A cloud
 * needs a *profile* — a height per column, quantised — which is what an 8-bit machine
 * would have drawn from a tile mask, and it costs one fill per column.
 */
export const WEATHER_CELL = 4;

/**
 * Cloud silhouettes, as overlapping lobes: `dx` is the lobe's centre across the cloud
 * (−1..1), `r` its half-width and `h` how tall it stands. Three authored sets, so the
 * five clouds are not one shape repeated, and authored rather than random so the sky is
 * the same picture every run.
 *
 * The lobes are what make a cumulus: a tall one off-centre, a couple of shoulders and a
 * low one trailing off. A single lobe is a hill and two symmetrical ones are a bow tie.
 */
const CLOUD_LOBES: readonly { dx: number; r: number; h: number }[][] = [
  [
    { dx: -0.58, r: 0.44, h: 0.52 },
    { dx: -0.12, r: 0.52, h: 0.9 },
    { dx: 0.36, r: 0.46, h: 0.66 },
    { dx: 0.78, r: 0.3, h: 0.4 },
  ],
  [
    { dx: -0.74, r: 0.32, h: 0.38 },
    { dx: -0.34, r: 0.44, h: 0.72 },
    { dx: 0.14, r: 0.5, h: 1 },
    { dx: 0.62, r: 0.42, h: 0.58 },
  ],
  [
    { dx: -0.5, r: 0.5, h: 0.8 },
    { dx: 0.06, r: 0.42, h: 0.56 },
    { dx: 0.5, r: 0.48, h: 0.86 },
  ],
];

/**
 * One cloud: a flat base with a lobed top, a lit crown and a shaded underside.
 *
 * Whole cells throughout, and every column's height is quantised to the cell — so it is
 * a hard-edged pixel silhouette rather than a smooth curve, which is the distinction
 * that matters. The light comes from the upper left (the same direction every other
 * object on these screens is lit from), so the crown is two cells thick on the left of
 * each lobe and one on the right.
 */
function drawCloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  hw: number,
  lobeSet: number,
  body: string,
  lit: string,
  crown: string,
  shade: string,
): void {
  const C = WEATHER_CELL;
  const cols = Math.max(6, Math.round((hw * 2) / C));
  const lobes = CLOUD_LOBES[lobeSet % CLOUD_LOBES.length]!;
  const tall = hw * 0.42; // a cumulus is about a fifth as tall as it is wide
  let prev = 0;
  for (let i = 0; i < cols; i += 1) {
    const u = ((i + 0.5) / cols) * 2 - 1;
    let h = 0;
    for (const l of lobes) {
      const d = (u - l.dx) / l.r;
      if (Math.abs(d) < 1) h = Math.max(h, Math.sqrt(1 - d * d) * l.h);
    }
    const height = Math.round((h * tall) / C) * C;
    if (height < C) {
      prev = 0;
      continue;
    }
    const x = cx - hw + i * C;
    const top = baseY - height;
    pxRect(ctx, body, x, top, C, height, C);
    // Crown: the lit cell along the top, thicker where the silhouette is climbing
    // (i.e. on the left flank of each lobe), which is what reads as a light source.
    pxRect(ctx, lit, x, top, C, C, C);
    if (height > prev && height > C * 2) pxRect(ctx, crown, x, top + C, C, C, C);
    // Shaded underside, so the cloud has a bottom instead of ending on nothing.
    pxRect(ctx, shade, x, baseY - C, C, C, C);
    prev = height;
  }
}

/**
 * The bank. Under gloom it is a wide, low, dark lid; as `clear` rises the clouds
 * **contract towards their own centres** and lighten into cumulus, so the sky opens.
 */
export function drawCloudBank(ctx: CanvasRenderingContext2D, clear: number): void {
  const body = mixHex('#0B333C', '#B4DAE4', clear);
  const lit = mixHex('#13454F', '#F2FBFD', clear);
  const crown = mixHex('#0F3D47', '#DCF1F6', clear);
  const shade = mixHex('#06222A', '#7FB0BF', clear);
  for (const c of CLOUDS) {
    drawCloud(
      ctx,
      c.cx,
      c.y - 26 * clear,
      c.hw * (1 - 0.42 * clear),
      c.lobes,
      body,
      lit,
      crown,
      shade,
    );
  }
}

/**
 * Rain — two parallax sheets of slanted streaks, falling continuously.
 *
 * **The version this replaced snapped back up the screen twice a second**, and it is
 * worth writing down why, because the code looked fine: the whole field shared one
 * offset, `drift = (t * 620) % 240`, so every drop advanced 240px and then *all of them*
 * jumped back to where they started at the same instant. The owner saw exactly what was
 * happening — "a boomerang loop that's going on and not continuous".
 *
 * The fix is the rule: **a scrolling field must wrap PER PARTICLE and over its OWN
 * span, never as a shared offset over a shorter one.** Each drop's position is
 * `(itsOwnPhase + t × speed) mod span`, where `span` is the full height it falls
 * through. Every drop then wraps at a different moment, and each wrap is a drop
 * *leaving at the bottom and re-entering at the top* — which is what rain does — instead
 * of the sheet rewinding.
 *
 * Three things make it read as weather rather than as dots:
 *  - **Two sheets at different speeds and values.** A single sheet is a pattern; near
 *    (fast, brighter, longer) over far (slow, dimmer, shorter) is depth, and it is what
 *    stops the eye locking onto individual drops.
 *  - **The streaks travel along their own slant.** A tilted sprite falling straight down
 *    reads as a stripe, not as a drop, so `x` is derived from the drop's own progress
 *    (`RAIN_TILT`) and the streak is stepped along the same line.
 *  - **Few and bright, never many and faint.** The near sheet is 0.5 alpha, the far one
 *    0.28, and both are three-pixel cells — a dense low-alpha field reads as grime on the
 *    screen, which this build has paid for three times (the badge's dithered halo, the
 *    dragon's embers, screen 1's speckle).
 *
 * `wet` (1 → 0 as the sky clears) thins the sheets by dropping whole lanes, so the rain
 * *stops* rather than fading to a ghost. Under `prefers-reduced-motion` the same drops
 * are drawn at their phase with no time term: a still sheet of rain, because the weather
 * is information on this screen and holding it is honest where hiding it is not.
 */
const RAIN_TILT = 0.16; // px sideways per px of fall — ~9° off vertical

interface RainSheet {
  /** px between lanes. */
  lane: number;
  /** px/s down. */
  speed: number;
  /** px between drops in one lane. */
  gap: number;
  /** streak length and cell width, in px. */
  len: number;
  w: number;
  tone: string;
  /** A brighter cell at the head of each streak (the near sheet only). */
  head?: string;
  seed: number;
}

const RAIN_NEAR: RainSheet = {
  lane: 46,
  speed: 880,
  gap: 210,
  len: 18,
  w: 3,
  tone: 'rgba(186,226,236,0.50)',
  head: 'rgba(226,246,250,0.72)',
  seed: 13,
};
const RAIN_FAR: RainSheet = {
  lane: 34,
  speed: 520,
  gap: 260,
  len: 11,
  w: 2,
  tone: 'rgba(146,192,204,0.28)',
  seed: 41,
};

function drawRainSheet(
  ctx: CanvasRenderingContext2D,
  t: number,
  reduced: boolean,
  wet: number,
  s: RainSheet,
): void {
  // The span is the whole fall plus a streak, so a drop is fully off the bottom before it
  // is reused at the top. Lanes start off-frame to the left because the fall drifts right.
  const span = GROUND_TOP + s.len;
  const lanes = Math.ceil((W + span * RAIN_TILT + s.lane * 2) / s.lane);
  for (let i = 0; i < lanes; i += 1) {
    const lane = -s.lane - span * RAIN_TILT + i * s.lane;
    const n = hash2(i, s.seed);
    // Whole lanes go out as the sky clears, so the rain thins rather than dimming.
    if (n > wet) continue;
    const drops = Math.ceil(span / s.gap);
    for (let j = 0; j < drops; j += 1) {
      // Its own phase: the lane's hash spreads the train, and `j` spaces it out.
      const phase = n * s.gap + j * s.gap;
      const pos = reduced ? phase % span : (phase + t * s.speed) % span;
      // No culling needed, and that is deliberate: `pos` is in [0, span) and
      // `span = GROUND_TOP + len`, so every drop is always inside the frame's fall. It
      // also means the sheet has a FIXED number of streaks, which is what lets a test
      // follow one drop from frame to frame and prove it never rewinds.
      const y = pos - s.len;
      const x = lane + pos * RAIN_TILT;
      // Two cells stepped along the slant: the streak leans the way it is travelling.
      const half = s.len / 2;
      pxRect(ctx, s.tone, x, y, s.w, half, 1);
      pxRect(ctx, s.head ?? s.tone, x + half * RAIN_TILT, y + half, s.w, half, 1);
    }
  }
}

export function drawRain(
  ctx: CanvasRenderingContext2D,
  t: number,
  reduced: boolean,
  wet: number,
): void {
  if (wet <= 0.02) return;
  drawRainSheet(ctx, t, reduced, wet, RAIN_FAR);
  drawRainSheet(ctx, t, reduced, wet, RAIN_NEAR);
}

/**
 * The sun through the gap, once the sky has started to open.
 *
 * Pale cream, never the value orange — orange on this screen would be the badge's own
 * accent, and a sunrise the size of a building is not a badge. It is placed left of
 * centre and low enough to clear the HUD's left stack (which reaches y≈150), directly
 * over the wall the ANSR mark stands on, so the light lands where the answer came from.
 */
export function drawSunBreak(ctx: CanvasRenderingContext2D, clear: number): void {
  if (clear <= 0.08) return;
  // 262/168 is measured, not chosen: it is the one clear patch of sky on the left of
  // this frame. At 322 it rasterised **behind the hoist's brick guide pier** (x 320-360)
  // and read as a lamp on a post — the occluded-sun defect this build has now paid for
  // twice. Its left ray reaches x=206, which keeps it clear of the HUD's left column
  // (x≈194), and its top is at y=112, above the badge wall it is lighting.
  const cx = 262;
  const cy = 168;
  const a = Math.min(1, (clear - 0.08) / 0.5);
  const C = WEATHER_CELL;
  const R = 32;
  const core = `rgba(255,250,226,${a.toFixed(2)})`;
  const face = `rgba(255,238,186,${a.toFixed(2)})`;
  const rim = `rgba(252,214,138,${a.toFixed(2)})`;
  const ray = `rgba(255,228,158,${(0.85 * a).toFixed(2)})`;
  const rayFar = `rgba(255,228,158,${(0.45 * a).toFixed(2)})`;
  /*
   * A real pixel circle: every 4px cell whose centre is inside R, and three bands inside
   * it — a bright core, a face and a rim.
   *
   * The two earlier versions were both **profiles of 8px rows**, and that is why they
   * kept coming out wrong (a light bulb, then a light bulb with a gap). At 8px a 64px
   * sun has eight rows, so the "curve" is eight steps and every one of them is visible as
   * a slab; at 4px it has sixteen, which is where a stepped circle stops reading as a
   * polygon. The bands are concentric and the light source is up-left, so the core sits
   * slightly off centre — which is what makes a disc read as a sphere of light rather
   * than as a coin.
   */
  for (let dy = -R; dy < R; dy += C) {
    for (let dx = -R; dx < R; dx += C) {
      const px = dx + C / 2;
      const py = dy + C / 2;
      const d = Math.sqrt(px * px + py * py);
      if (d > R) continue;
      const off = Math.sqrt((px + 5) * (px + 5) + (py + 5) * (py + 5));
      const tone = off < R * 0.46 ? core : d < R * 0.82 ? face : rim;
      pxRect(ctx, tone, cx + dx, cy + dy, C, C, C);
    }
  }
  /*
   * Twelve rays, in whole cells, tapering outwards: three cells on the cardinals and two
   * on the rest, starting one cell clear of the rim.
   *
   * Few and bright rather than many and faint — the halo lesson, third time. Twelve short
   * spokes read as light *coming off* the disc; the four long bars this replaced sat out
   * at 34-48px with a hole between them and the sun, so they read as four detached
   * dashes. Nothing here is a gradient and nothing is under 0.45 alpha.
   */
  for (let k = 0; k < 12; k += 1) {
    const ang = (k / 12) * Math.PI * 2;
    const long = k % 3 === 0;
    for (let j = 0; j < (long ? 3 : 2); j += 1) {
      const r = R + C + j * C;
      pxRect(
        ctx,
        j === 0 ? ray : rayFar,
        cx + Math.cos(ang) * r - C / 2,
        cy + Math.sin(ang) * r - C / 2,
        C,
        C,
        C,
      );
    }
  }
}

/**
 * Distant city skyline — "the market you are entering." Present on every level
 * for continuity; a few windows twinkle (steady under reduced motion).
 */
function drawSkyline(
  ctx: CanvasRenderingContext2D,
  seed: number,
  color: string,
  winColor: string,
  t: number,
  reduced: boolean,
): void {
  const baseY = GROUND_TOP;
  let x = -20;
  let i = 0;
  while (x < W + 20) {
    const bw = 60 + Math.floor(hash2(seed + i, 3) * 70);
    const bh = 90 + Math.floor(hash2(seed + i, 9) * 190);
    const bx = x;
    const by = baseY - bh;
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bw, bh);
    // Window grid.
    for (let wy = by + 10; wy < baseY - 10; wy += 16) {
      for (let wx = bx + 8; wx < bx + bw - 8; wx += 14) {
        const n = hash2(wx, wy);
        const lit = reduced ? n > 0.5 : n > 0.5 && Math.sin(t * 0.8 + n * 30) > -0.2;
        ctx.fillStyle = lit ? winColor : 'rgba(0,0,0,0.18)';
        ctx.fillRect(wx, wy, 6, 8);
      }
    }
    x += bw + 10 + Math.floor(hash2(seed + i, 21) * 26);
    i += 1;
  }
}

/** A small potted plant silhouette (lobby greenery). */
function drawPottedPlant(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  pxRect(ctx, '#0C4B3A', x + 4, baseY - 34, 4, 22, 2); // stem
  pxRect(ctx, '#0F6B4E', x - 6, baseY - 44, 24, 16, 2); // foliage
  pxRect(ctx, '#083726', x - 2, baseY - 36, 16, 8, 2); // foliage shadow
  pxRect(ctx, '#123', x - 2, baseY - 12, 16, 12, 2); // pot base
  pxRect(ctx, '#1C6', x - 2, baseY - 12, 16, 3, 2);
}

/*
 * `drawBoard` used to live here — a framed panel ruled every 8px across its full
 * width. Its last caller was the Workplace whiteboard, and it went with that pass:
 * even ruling is what a *blind* looks like, and a board covered in handwriting needs
 * runs of uneven length (`drawWhiteboard`). Nothing else in the game used it.
 */

/**
 * A background "floor directory" sign that names the stage's problem, read as an
 * office building sign. Sits behind gameplay but stays readable, which is why the
 * plaque is a solid dark fill rather than a faint wash.
 */
function drawFloorSign(ctx: CanvasRenderingContext2D, cx: number, midY: number, text: string): void {
  drawLabelPlaque(ctx, text, cx, midY, {
    scale: 3,
    fg: '#B8DCE6',
    bg: 'rgba(0,20,27,0.8)',
    frame: 'rgba(28,120,142,0.75)',
    padX: 10,
    padY: 7,
    alpha: 0.9,
  });
}

/** A small caption on a background prop (e.g. a board title). */
function drawPropLabel(ctx: CanvasRenderingContext2D, cx: number, topY: number, text: string): void {
  drawText(ctx, text, cx, topY, {
    scale: 2,
    color: '#9FCEDB',
    align: 'center',
    outline: 'rgba(0,18,24,0.85)',
    alpha: 0.92,
  });
}

/**
 * A label pinned just above one of the Reception steps. The three easy hops are
 * the three things that genuinely *are* easy — the paperwork before any of the
 * real work starts — so naming them turns tutorial geometry into the first beat
 * of the story ("on paper, this all looks fine").
 */
function drawStepLabel(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  text: string,
): void {
  drawLabelPlaque(ctx, text, gx * TILE + TILE / 2, gy * TILE - 34, {
    scale: 2,
    fg: '#CFE6EC',
    bg: 'rgba(0,20,27,0.78)',
    frame: 'rgba(28,120,142,0.6)',
    padX: 7,
    padY: 5,
    alpha: 0.95,
  });
}

/** A person silhouette (hiring crowd / candidates). */
function drawPerson(ctx: CanvasRenderingContext2D, x: number, baseY: number, tone: string): void {
  pxRect(ctx, tone, x + 2, baseY - 40, 10, 10, 2); // head
  pxRect(ctx, tone, x - 2, baseY - 28, 18, 20, 2); // torso
  pxRect(ctx, tone, x, baseY - 8, 6, 8, 2); // legs
  pxRect(ctx, tone, x + 8, baseY - 8, 6, 8, 2);
}

/*
 * `drawReceptionDesk` used to live here: a 120px block with a hanging sign over
 * it, drawn against a sky. Reception is an interior now and its desk is part of a
 * room (`drawLobbyDesk`) — a counter, a feature wall behind it and the real brand
 * mark on that wall — so the old prop had nothing left to do.
 */

/** Stacked boxes / stalled paperwork (Setup Delays). */
function drawStalledStacks(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  const box = (bx: number, by: number, s: number): void => {
    pxRect(ctx, '#0A3642', bx, by, s, s, 2);
    pxRect(ctx, '#06272F', bx, by, s, 4, 2);
    pxRect(ctx, '#125', bx + 4, by + 6, s - 8, 3, 2); // tape line
  };
  box(x, baseY - 34, 34);
  box(x + 40, baseY - 60, 34);
  box(x + 6, baseY - 68, 30);
  box(x + 44, baseY - 26, 26);
}

/**
 * A slow wall clock — time slipping away during setup, and the one prop on this
 * screen that says what the level is *about* rather than what it looks like.
 *
 * Rebuilt at twice the size and in whole pixels. It was a 32px box with its hands
 * drawn as 2px anti-aliased `stroke()` lines: the only vector strokes left in any
 * backdrop, and at that size the hands were a grey fuzz inside a dark square, so
 * the prop read as a small window rather than as a clock. Now it is a 64px case
 * with a pale dial, a marked twelve/three/six/nine, and hands stepped out of
 * `pxRect` cells — same idiom as everything else on the frame.
 */
function drawClock(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, reduced: boolean): void {
  const R = 40;
  // Bracket, so it hangs off something rather than floating in the sky.
  pxRect(ctx, '#0A3A47', cx - 4, cy - R - 16, 8, 16, 4);
  pxRect(ctx, '#062730', cx - R, cy - R, R * 2, R * 2, 4); // shadowed surround
  pxRect(ctx, '#12657A', cx - R + 4, cy - R + 4, R * 2 - 8, R * 2 - 8, 4); // case
  pxRect(ctx, '#1E88A0', cx - R + 4, cy - R + 4, R * 2 - 8, 4, 4); // lit top of the case
  pxRect(ctx, '#DCF1F6', cx - R + 12, cy - R + 12, R * 2 - 24, R * 2 - 24, 4); // dial
  // Twelve hour ticks, the four quarters heavier: a dial nobody can mistake for a
  // window, which is what the old 32px version rasterised as.
  for (let i = 0; i < 12; i += 1) {
    const a0 = (i / 12) * Math.PI * 2;
    const quarter = i % 3 === 0;
    const r = R - 18;
    pxRect(
      ctx,
      quarter ? '#0B3542' : '#5C8B99',
      cx + Math.sin(a0) * r - 2,
      cy - Math.cos(a0) * r - 2,
      4,
      4,
      4,
    );
  }
  // Hands, stepped in whole cells. The minute hand runs four times the hour hand,
  // which is enough to read as "a clock that is moving" at a glance.
  const a = reduced ? -1.1 : t * 0.5 - 1.6;
  const hand = (angle: number, len: number, thick: number, color: string): void => {
    for (let i = 0; i <= len; i += 3) {
      pxRect(ctx, color, cx + Math.cos(angle) * i - thick / 2, cy + Math.sin(angle) * i - thick / 2, thick, thick, 4);
    }
  };
  hand(a, 22, 6, '#0B3542');
  hand(a * 0.25 - 1.2, 14, 6, '#0B3542');
  pxRect(ctx, '#8A2A18', cx - 4, cy - 4, 8, 8, 4); // spindle
}

/* ---------------------------------------------------------------------------
 * The Workplace floor (screen 3), seen from inside.
 *
 * This module owns the *sound* building: the shell, the suspended ceiling grid,
 * the glazing, the workstations, the storage wall and the whiteboard. Everything
 * that the fix undoes — the missing ceiling tiles, the dead fittings, the gloom,
 * the toppled chair, the pulled-out drawers, the tape and the debris — belongs to
 * `render/workplace.ts`, because it is driven by the hazard's `restore` dial and a
 * backdrop function has no business knowing whether the room has been fixed.
 *
 * So this function paints the room as it will be *after* the colleague gets to the
 * terminal, and the damage is laid over the top of it. That split is what makes
 * the payoff a real change rather than a slow fade: the restored room already
 * exists underneath.
 *
 * Geometry the two halves share is exported below rather than written twice — a
 * light that misses its own aperture, or a lit screen that misses its own monitor,
 * is the same class of defect as deriving a pickup's position twice.
 * ------------------------------------------------------------------------- */

/**
 * The suspended ceiling and the fittings recessed into it.
 *
 * The old ceiling was a 34px strip of hairlines at the very top of the frame and
 * rasterised as nothing at all — which mattered, because "the ceiling is out" is
 * the first thing this screen has to say. It is 96px of tile grid now, drawn as
 * four courses receding upwards, and the fittings sit in it rather than hanging
 * under it (a lamp hung below a soffit reads as a pendant — Reception paid for
 * that one).
 */
export const CEILING = {
  /** Depth of the ceiling band, in internal px. */
  H: 96,
  /** One tile's width; the T-bar joints run on this pitch. */
  TILE_W: 80,
  /**
   * Left edge of each tile that is missing.
   *
   * **They have to fall in the gaps BETWEEN the fittings.** The first pair sat at
   * 480 and 720, and a 168px fitting centred on 500 is painted over 416–584: it
   * covered the whole lower half of the first hole, so a missing tile rasterised as
   * a dark smudge above a light fitting. On this pitch the free spans are 284–416,
   * 584–716, 884–1016 and 1184–1280, and a tile is 80 wide.
   */
  GAPS: [320, 640] as const,
  /** Where the ceiling is stained rather than gone, and a bucket stands under it. */
  STAIN: 500,
  /**
   * Centres of the four ceiling **spotlights** (owner call: "add 4 big spot lights
   * from the ceiling facing down, glow up when things restore" — `render/workplace.ts`
   * draws the fittings themselves).
   *
   * The first one is at **220 rather than 200**, and that is not a nudge: it is the
   * badge's own column (gx 5). The Workplace's rail is gone and the mark now falls out
   * of this fitting straight down its own axis onto the cabinet under it
   * (`world/badgeCeiling.ts`), so the light's centre and the pickup's centre are one
   * number. Moving it means moving the badge, the cabinet and the level data together.
   *
   * The spacing is what keeps the floor pools apart: at 130px of half-width (see
   * `floorPool`) four pools 300px apart leave 40px of unlit floor between them, and the
   * dark between the pools is as much of the picture as the pools are.
   */
  LIGHTS: [220, 500, 800, 1100] as const,
  /**
   * The aperture a fitting sits in — **exactly two tiles**, so it lands on the same
   * grid the holes do. At 168 it overhung its tiles by 4px each side, which was
   * enough to eat the corner of a missing tile at 640 (`workplace.test.ts` states
   * the relationship rather than the numbers).
   */
  FIT_W: 160,
  FIT_Y: 54,
  FIT_H: 32,
  /**
   * How wide a hole the services duct leaves for each spotlight to come through.
   *
   * The fittings are **spots hanging below the ceiling line** now, not strips recessed
   * into it, so the duct at y 108–132 is in their way. `render/workplace.ts` draws a
   * 64px barrel; 96 gives it 16px of daylight either side, which is what makes the two
   * read as one piece of ceiling equipment rather than as one drawn over the other.
   */
  DUCT_GAP: 96,
  /** The bottom of a spotlight's barrel — where its lens is, and what the mark hangs under. */
  SPOT_BOTTOM: 130,
} as const;

/**
 * Left edge of each workstation pod, and where its monitor screen sits.
 *
 * **There are two, and there used to be three at [190, 430, 668].** The one at 190 was
 * the defect the owner reported ("the first computer screen that comes after things are
 * restored is overlaying on the brick obstacle we have in the beginning"): its divider
 * ran 190–386 and its monitor 224–272, straight through the partition wall's column —
 * so the lit screen of the payoff was painted on top of the one solid the player has to
 * jump. That is the "a backdrop prop may not stand in a column a solid stands in" rule,
 * and this screen now has *three* solids to keep clear of, not one: the partition at
 * 280–320 and the badge cabinet floating at 160–240.
 *
 * Which leaves the floor right of 340 for furniture, and 196px pods do not fit three
 * times between there and the terminal (922). So the room lost a pod and the two that
 * are left were redrawn properly, which is the other half of the same note ("the desk
 * and computer screen doesn't look refined").
 */
export const WORK_PODS = [470, 690] as const;
/** Monitor screen, relative to a pod's left edge and to the floor line. */
export const POD_SCREEN = { dx: 34, dy: -76, w: 48, h: 30 } as const;
/**
 * The storage wall on the left: the server rack, and the cabinet bank whose drawers
 * the damage layer hangs open.
 *
 * `x` is 290 rather than the left edge for two reasons that both bite. The HUD's
 * opaque left column reaches x≈194, so anything with a *readable* detail behind it
 * is art nobody can see (the rack is a repeating shelf pattern, so it is allowed to
 * run under there; a drawer hanging open is not). And the wrapped figure starts
 * every sweep at x 360–420, which level data keeps clear of props for exactly the
 * same reason.
 */
export const CABINETS = { rackX: 56, x: 340, y: GROUND_TOP - 100, w: 104, drawerH: 24 } as const;
/** The glazing on the right third — the market, outside, where it belongs. */
export const WINDOW = { x: 830, y: 176, w: W - 830 - 40, h: 210 } as const;

/**
 * The Workplace's shell, off the teal axis (owner call: "change the background wall
 * colour, it's almost the same colour as the outer view from the window and also almost
 * the same colour as our character").
 *
 * The complaint is one problem with three sides to it. The wall registers were
 * `#0A2B33` / `#0E3846` / `#051B23`, the glazing behind them `#06303C`, and the hero's
 * blazer brand Light Teal `#005465` — four dark teals, so the room, the view and the
 * person were one field with shapes scored into it. The hero cannot move (he is on six
 * screens), so the fix is on the room, and it is the same move the floor already made
 * and screen 2 made going brown: **same value family, different temperature.** The
 * plaster is a warm grey-olive now, the ceiling grid and the services stay cool slate —
 * which gives the room two materials where it had one — and the glazing goes the other
 * way entirely, up to a genuine cool daylight (below).
 *
 * Values are held close to what they replaced on purpose, because the value structure
 * of this screen was already right: dark at the top, a lighter mid register the
 * furniture reads against, and the darkest band at the bottom, which is the 140px the
 * hero's whole body stands against.
 */
const WALL = {
  /** 0–160: the upper wall, in shadow under the services. */
  upper: '#231F1A',
  /** 160–460: the register the furniture is read against. */
  mid: '#35322A',
  /** 334–460: the dado panel, a step down from the mid register. */
  dado: '#2C2A23',
  /** 460–ground: the darkest band on the wall — the hero stands against this one. */
  base: '#1A1712',
  /** Up-facing edges: the mid rail, the dado rail, the sill course, the skirting top. */
  rail: '#4A4536',
  /** …and the brightest of them, on the skirting, where the floor throws light back. */
  railLit: '#5E5847',
  /** Panel joints, so a 300px register is a run of panels rather than one surface. */
  joint: 'rgba(12,9,5,0.34)',
  /** Skirting board. */
  skirting: '#1E1B15',
} as const;

/**
 * The Workplace's FURNITURE palette — warm dark, off the teal axis.
 *
 * Owner call: "change the colour of the desks, it's interfering with the character."
 * Every piece of furniture on this floor was in the teal family (`#17566A` worktops,
 * `#46A6BC` lit edges) and so is the hero's blazer, so at floor level — which is the
 * only level he is ever at — he was one more teal shape in a row of them. The rule that
 * furniture goes *darker than the wall with one lit edge each* is untouched; what
 * changes is the temperature, which is the one axis left once the values are decided
 * and the hero is fixed. Now the only teal below the dado rail is the player.
 */
const FURN = {
  /** Carcase and modesty panels: the darkest thing in the room after the ceiling void. */
  body: '#1D1A15',
  /** A step up, for a face that is turned towards the camera. */
  face: '#2A251E',
  /** Worktops and drawer fronts. */
  top: '#3A3328',
  /** The one lit edge per object — warm pale, the colour the ceiling spots throw. */
  lit: '#8E8672',
  /** …and its quieter version, for a second edge that must not compete with the first. */
  edge: '#5E5747',
  /** Shadow line under a lit edge, which is what gives the edge its thickness. */
  shade: '#100E0A',
  /** Aluminium: monitor stands, drawer handles, chair frames. Neutral, not teal. */
  metal: '#6F7570',
} as const;

/**
 * A monitor: shell, bezel, screen, stand.
 *
 * Refined on the owner's note that the desk and the computer screen did not look
 * finished. What it was: one dark rectangle, one screen rectangle, a 10px neck and a
 * 28px foot — a television on a stick. What a monitor actually reads as at this size is
 * a **thin bezel with a wide screen inside it**, a shallow lower chin, a slim stand and
 * a *wide* flat foot, plus the one detail that says the thing is switched off rather
 * than missing: a highlight running along the top of the bezel.
 */
function drawMonitor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  screen: string,
): void {
  pxRect(ctx, FURN.shade, x - 5, y - 5, w + 10, h + 16, 2); // keyline / shadow
  pxRect(ctx, FURN.face, x - 3, y - 3, w + 6, h + 12, 2); // bezel
  pxRect(ctx, FURN.lit, x - 3, y - 3, w + 6, 2, 2); // lit top edge of the bezel
  pxRect(ctx, screen, x, y, w, h, 2); // the panel itself
  pxRect(ctx, 'rgba(255,255,255,0.06)', x, y, w, 3, 2); // reflection on the glass
  pxRect(ctx, FURN.edge, x + w / 2 - 4, y + h + 3, 8, 4, 2); // chin badge
  pxRect(ctx, FURN.metal, x + w / 2 - 3, y + h + 9, 6, 7, 2); // stand
  pxRect(ctx, FURN.metal, x + w / 2 - 17, y + h + 15, 34, 3, 2); // foot
  pxRect(ctx, FURN.shade, x + w / 2 - 17, y + h + 18, 34, 2, 2);
}

/**
 * One workstation: a low divider, a desk, a monitor, a task chair and the litter
 * of somebody's day.
 *
 * Every height is measured against the DRAWN hero (48×60 with his feet on the
 * ground band), not against the 600px wall — the wall is the one thing on this
 * screen at architectural scale, and the first version of Reception's counter
 * proved what happens to furniture sized to fill it. Divider at his chest, desk at
 * his hip, monitor a head above the desk.
 */
function drawWorkPod(ctx: CanvasRenderingContext2D, x: number, seed: number): void {
  const b = GROUND_TOP;
  /*
   * Everything here is DARKER than the wall behind it, with one lit edge each.
   *
   * The first version painted the furniture a value *up* from the wall, on the
   * reasoning that lighter things read better. It rasterised as a mush: three pods,
   * a cabinet bank and the terminal all within two values of the wall and of each
   * other, so the whole bottom of the frame was one indistinct field — with the
   * player, the one lethal figure and nine props standing in it. Dark mass plus a
   * lit rail is how furniture reads at this size, and it also leaves the light
   * values on this screen to the three things that have earned them: the wrapped
   * figure, the whiteboard and the light itself.
   */
  /*
   * The divider is 50px, i.e. the drawn hero's shoulder — a real 1.4m screen against
   * a 1.75m person. It was 62 (his full height), which is not just slightly wrong:
   * a divider as tall as a person hides anybody standing at the desk *and* the
   * monitor on it, so the pod had nothing in it but a wall. At 50 the monitor crests
   * it and the payoff can put somebody back behind it.
   */
  /*
   * The divider: a fabric panel in a frame, not a flat slab.
   *
   * Two courses of a slightly different value with a post at each end and one in the
   * middle is what an office screen looks like; one rectangle with a rail on top is a
   * wall. It costs four fills and it is most of why the pod now reads as furniture.
   */
  pxRect(ctx, FURN.body, x, b - 50, 196, 50, 2); // panel
  pxRect(ctx, FURN.face, x + 6, b - 44, 184, 20, 2); // upper fabric course
  pxRect(ctx, FURN.body, x + 6, b - 24, 184, 20, 2); // lower course, a value down
  pxRect(ctx, FURN.lit, x, b - 50, 196, 3, 2); // lit top rail
  pxRect(ctx, FURN.shade, x + 4, b - 47, 188, 3, 2); // shadow under the rail
  for (const px of [x + 2, x + 95, x + 190]) pxRect(ctx, FURN.edge, px, b - 47, 4, 47, 2); // posts

  /*
   * Desk: a worktop with a real front apron, a cable tray under it and a drawer
   * pedestal at one end.
   *
   * The old desk was a 30px black box with an 8px slab on top, which at this size is a
   * shelf. What says "desk" is the *thickness* of the top, the shadow it casts on the
   * apron under it, and something in the leg space — so there is a tray of cables and a
   * three-drawer pedestal, and the pedestal alternates ends pod to pod.
   */
  pxRect(ctx, FURN.body, x + 18, b - 30, 152, 30, 2); // modesty panel / leg space
  pxRect(ctx, FURN.shade, x + 18, b - 30, 152, 4, 2); // shadow the top casts on it
  pxRect(ctx, FURN.metal, x + 40, b - 18, 108, 3, 2); // cable tray
  pxRect(ctx, FURN.top, x + 12, b - 36, 164, 8, 2); // worktop
  pxRect(ctx, FURN.lit, x + 12, b - 36, 164, 3, 2); // its lit front edge
  pxRect(ctx, FURN.shade, x + 12, b - 29, 164, 2, 2);
  const pedX = hash2(seed, 11) > 0.5 ? x + 20 : x + 122;
  pxRect(ctx, FURN.face, pedX, b - 28, 46, 28, 2); // drawer pedestal
  for (let i = 0; i < 3; i += 1) {
    pxRect(ctx, FURN.top, pedX + 4, b - 25 + i * 9, 38, 6, 2);
    pxRect(ctx, FURN.metal, pedX + 16, b - 23 + i * 9, 14, 2, 2); // handle
  }

  drawMonitor(ctx, x + POD_SCREEN.dx, b + POD_SCREEN.dy, POD_SCREEN.w, POD_SCREEN.h, '#22343A');
  // Keyboard, a mug and a stack of paper — stable positions, never a scatter. The mug
  // and the paper are the only light values on the desk, so they are what the eye finds.
  pxRect(ctx, FURN.face, x + 30, b - 40, 46, 4, 2);
  pxRect(ctx, FURN.metal, x + 30, b - 40, 46, 2, 2);
  pxRect(ctx, '#B9AE96', x + 104, b - 45, 11, 9, 2); // mug
  pxRect(ctx, '#8E8672', x + 113, b - 43, 4, 5, 2); // …and its handle
  pxRect(ctx, '#A9A08A', x + 124, b - 41, 30, 5, 2); // paper
  pxRect(ctx, '#C4BCA6', x + 126, b - 44, 30, 4, 2);

  // Task chair, pushed in on one pod and out on the next so the row is not a
  // pattern. It is drawn in front of the desk, which is where a chair is.
  const out = hash2(seed, 3) > 0.5 ? 34 : 6;
  const cx = x + 60 + out;
  pxRect(ctx, FURN.body, cx - 20, b - 58, 40, 30, 2); // back
  pxRect(ctx, FURN.edge, cx - 20, b - 58, 40, 3, 2);
  pxRect(ctx, FURN.face, cx - 16, b - 52, 32, 18, 2); // its upholstered face
  pxRect(ctx, FURN.face, cx - 24, b - 28, 48, 7, 2); // seat
  pxRect(ctx, FURN.edge, cx - 24, b - 28, 48, 3, 2);
  pxRect(ctx, FURN.metal, cx - 3, b - 21, 6, 14, 2); // post
  pxRect(ctx, FURN.metal, cx - 22, b - 7, 44, 4, 2); // base
  pxRect(ctx, FURN.body, cx - 22, b - 3, 6, 3, 2);
  pxRect(ctx, FURN.body, cx + 16, b - 3, 6, 3, 2);
}

/**
 * The storage wall: a bank of filing cabinets under a run of shelving.
 *
 * It is what fills the left end of a 600px wall without asking the player to read
 * anything, and it is the thing whose drawers the damage layer hangs open.
 */
function drawStorageWall(ctx: CanvasRenderingContext2D): void {
  const { rackX, x, y, w, drawerH } = CABINETS;
  // Server rack, floor to head height: the one piece of equipment on this floor at
  // more than furniture scale, so the left end of the room has a vertical in it.
  pxRect(ctx, FURN.body, rackX - 6, GROUND_TOP - 216, 88, 216, 2);
  pxRect(ctx, FURN.lit, rackX - 6, GROUND_TOP - 216, 88, 3, 2);
  for (let ry = GROUND_TOP - 204; ry < GROUND_TOP - 20; ry += 18) {
    pxRect(ctx, FURN.face, rackX, ry, 62, 11, 2);
    pxRect(ctx, FURN.shade, rackX, ry + 11, 62, 3, 2);
    // One status light per shelf, stable (hash2) rather than blinking at random. Kept
    // in the cool greens — a live LED is the one thing in this room that may be.
    pxRect(ctx, hash2(ry, 5) > 0.45 ? '#2E7F5E' : '#1E2A2C', rackX + 66, ry + 3, 5, 5, 2);
  }
  // Cabinet bank, four drawers, closed. The damage layer pulls two of them out.
  // Same value rule as the pods: a dark mass with one lit edge per drawer.
  pxRect(ctx, FURN.body, x, y, w, GROUND_TOP - y, 2);
  pxRect(ctx, FURN.lit, x, y, w, 3, 2);
  for (let i = 0; i < 4; i += 1) {
    const dy = y + 6 + i * drawerH;
    pxRect(ctx, FURN.top, x + 6, dy, w - 12, drawerH - 6, 2);
    pxRect(ctx, FURN.edge, x + 6, dy, w - 12, 3, 2);
    pxRect(ctx, FURN.shade, x + 6, dy + drawerH - 6, w - 12, 3, 2);
    pxRect(ctx, FURN.metal, x + w / 2 - 12, dy + 8, 24, 4, 2); // handle
  }
}

/**
 * A whiteboard with somebody's plan still on it.
 *
 * `drawBoard` was used here first and it rules the surface every 8px across its
 * full width, which rasterises as a barcode: a board covered in *even* lines is a
 * blind, not handwriting. Scrawl is uneven — runs of different lengths, indented,
 * with a boxed diagram and an arrow — and at this size that unevenness is the only
 * thing that says a person wrote it.
 */
function drawWhiteboard(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const w = 196;
  const h = 116;
  pxRect(ctx, FURN.shade, x - 5, y - 5, w + 10, h + 10, 2); // shadow
  pxRect(ctx, FURN.face, x - 4, y - 4, w + 8, h + 8, 2); // frame
  pxRect(ctx, FURN.lit, x - 4, y - 4, w + 8, 3, 2);
  /*
   * The surface is a mid grey-teal, not the near-white a real whiteboard is.
   *
   * Painted at #AFC8D0 it was the largest light shape on the screen by a distance
   * and it pulled the eye clean off the one thing that matters here — the wrapped
   * figure, whose cloth is deliberately the lightest value in the room. A backdrop
   * prop may be the lightest thing on the WALL; it may not be the lightest thing in
   * the frame.
   */
  pxRect(ctx, '#8CA6AE', x, y, w, h, 2); // surface
  pxRect(ctx, '#A6BEC6', x, y, w, 4, 2);
  // Left column: three runs of writing, uneven, with an indent on the last.
  const runs: readonly [number, number, number][] = [
    [8, 10, 70],
    [8, 22, 96],
    [18, 34, 58],
    [8, 52, 84],
    [18, 64, 46],
  ];
  for (const [dx, dy, len] of runs) pxRect(ctx, '#5E8794', x + dx, y + dy, len, 4, 2);
  // Right: a boxed step, an arrow out of it, and a second box. The one diagram
  // every office wall has.
  pxRect(ctx, '#5E8794', x + 116, y + 16, 44, 3, 2);
  pxRect(ctx, '#5E8794', x + 116, y + 44, 44, 3, 2);
  pxRect(ctx, '#5E8794', x + 116, y + 16, 3, 31, 2);
  pxRect(ctx, '#157287', x + 157, y + 16, 3, 31, 2);
  pxRect(ctx, '#157287', x + 132, y + 56, 3, 26, 2);
  pxRect(ctx, '#157287', x + 126, y + 74, 15, 3, 2);
  pxRect(ctx, '#5E8794', x + 112, y + 90, 60, 4, 2);
  pxRect(ctx, FURN.face, x - 4, y + h + 4, w + 8, 7, 2); // pen tray
  pxRect(ctx, FURN.metal, x + 20, y + h + 4, 22, 3, 2); // a marker on it
}

/**
 * The Workplace floor's shell, in the state the fix leaves it in.
 *
 * Three value registers rather than two, because a room with one value is a flat
 * field and everything standing in it loses its silhouette: an upper wall, a
 * lighter mid register that the furniture reads against, and a darker band at the
 * floor so the ground has something to sit on.
 */
function drawOfficeInterior(ctx: CanvasRenderingContext2D, t: number, reduced: boolean): void {
  /*
   * The plaster is WARM now, and the ceiling above it stays cool (see `WALL`).
   *
   * Owner call, and the third time this screen has paid the same bill: the wall, the
   * view through the window and the hero were three dark teals, so the room read as one
   * field. The hero is on six screens and cannot be tuned for this one, so the room
   * moves — same values, different temperature. Keeping the *ceiling* cool is what stops
   * that reading as a sepia filter: plaster and painted metal are different materials
   * and now they look like it.
   */
  ctx.fillStyle = WALL.upper;
  ctx.fillRect(0, 0, W, GROUND_TOP);
  ctx.fillStyle = WALL.mid;
  ctx.fillRect(0, 160, W, 300);
  pxRect(ctx, WALL.rail, 0, 156, W, 4, 2);
  // A dado rail two thirds of the way down the light register. Without it that
  // register is 300px of one value, and 300px of one value is a painted flat
  // whatever is standing in front of it.
  pxRect(ctx, WALL.dado, 0, 334, W, 126, 2);
  pxRect(ctx, WALL.rail, 0, 330, W, 4, 2);
  /*
   * The lowest register — the 140px the hero's whole body stands against — is the
   * DARKEST thing on the wall.
   *
   * This is the other half of the answer to "the player and the background feel the
   * same". The floor moved off the teal axis; the hero cannot move at all, so the
   * band directly behind him had to. His blazer is brand Light Teal `#005465`, and
   * against a warm near-black at a third of its value the whole figure reads rather
   * than just his shirt. It costs nothing, because the register is behind furniture for
   * most of its length and behind a lit skirting course at its foot.
   */
  ctx.fillStyle = WALL.base;
  ctx.fillRect(0, 460, W, GROUND_TOP - 460);
  pxRect(ctx, WALL.rail, 0, 458, W, 3, 2);
  // Panel joints: an office wall is a run of panels, and the joints are what stop
  // each band reading as one continuous surface.
  for (let x = 0; x < W; x += 160) pxRect(ctx, WALL.joint, x, 160, 3, 300, 1);
  pxRect(ctx, WALL.skirting, 0, GROUND_TOP - 22, W, 22, 2); // skirting
  pxRect(ctx, WALL.railLit, 0, GROUND_TOP - 25, W, 3, 2);

  // --- suspended ceiling -------------------------------------------------
  // Four courses of tile receding upwards, darkest at the top, on a T-bar grid.
  // Seen slightly from below, which is how every side-on office reads.
  pxRect(ctx, '#04161B', 0, 0, W, CEILING.H, 2);
  const courses = ['#0A2C36', '#0D3542', '#103E4C', '#124655'];
  for (let i = 0; i < 4; i += 1) {
    const y = i * 24;
    pxRect(ctx, courses[i]!, 0, y, W, 24, 2);
    pxRect(ctx, '#17566A', 0, y, W, 2, 2); // T-bar along the course
    for (let x = 0; x < W; x += CEILING.TILE_W) pxRect(ctx, '#17566A', x, y, 2, 24, 2);
  }
  // Apertures for the four fittings, cut into the two nearest courses. The lamp
  // itself is the light layer's job (`render/workplace.ts`).
  for (const cx of CEILING.LIGHTS) {
    pxRect(ctx, '#061C23', cx - CEILING.FIT_W / 2, CEILING.FIT_Y, CEILING.FIT_W, CEILING.FIT_H, 2);
  }

  /*
   * Services under the ceiling: a duct and a cable tray, the horizontal that ties the
   * top of the frame to the room — **cut around every spotlight.**
   *
   * It used to run the full width, and it had to stop doing that the moment the
   * fittings became spotlights that hang *below* the ceiling line (owner call: four big
   * spots facing down). A 52px barrel coming through an unbroken duct is two objects
   * occupying one space, and no draw order rescues it. Real services drop out where a
   * fitting comes through, so these do: `DUCT_GAP` is the aperture plus a margin, and
   * the run is painted in the spans between.
   */
  const gaps = CEILING.LIGHTS.map(
    (cx) => [cx - CEILING.DUCT_GAP / 2, cx + CEILING.DUCT_GAP / 2] as const,
  );
  let from = 0;
  for (const [gapL, gapR] of [...gaps, [W, W] as const]) {
    const to = Math.min(gapL, W);
    if (to > from) {
      pxRect(ctx, '#0C2E38', from, 108, to - from, 24, 2);
      pxRect(ctx, '#154C5A', from, 108, to - from, 4, 2);
      pxRect(ctx, '#06202A', from, 128, to - from, 4, 2);
      // A capped end where the run stops at a fitting, so it reads as cut rather than
      // as a duct that happens to be missing.
      if (gapL < W) pxRect(ctx, '#061C23', to - 4, 108, 4, 24, 2);
      if (from > 0) pxRect(ctx, '#061C23', from, 108, 4, 24, 2);
    }
    from = Math.max(from, gapR);
  }
  for (let x = 20; x < W; x += 120) {
    if (gaps.some(([l, r]) => x + 6 > l && x < r)) continue;
    pxRect(ctx, '#0C2E38', x, CEILING.H, 6, 8, 2); // hanger into the ceiling
    if (!gaps.some(([l, r]) => x + 84 > l && x + 40 < r)) {
      pxRect(ctx, '#154C5A', x + 40, 132, 44, 4, 2); // a run of trunking dropping away
    }
  }

  // --- glazing -----------------------------------------------------------
  const { x: winX, y: winY, w: winW, h: winH } = WINDOW;
  ctx.save();
  ctx.beginPath();
  ctx.rect(winX, winY, winW, winH);
  ctx.clip();
  /*
   * The view out is COOL DAYLIGHT, and it is the other half of the owner's colour note.
   *
   * It was `#06303C` behind a `#083744` skyline: a dark teal city in a dark teal
   * opening, in a dark teal wall. Two surfaces at the same end of the value scale in the
   * same hue is an invisible object, and here it made the window a slightly different
   * patch of wall. Daylight is the one thing on this screen that is genuinely *outside*,
   * so it goes the other way — a graded cool sky, brightest at the top, with the city in
   * near-silhouette against it. Value discipline still applies: at `#7FA8B8` the sky is
   * a long way below the wrapped figure's near-white cloth, so the window is the
   * lightest thing on the WALL and never the lightest thing in the frame.
   */
  // Six stepped courses rather than a gradient: hard steps are how this build says
  // "sky", and inside a 210px opening six of them is plenty to read as a graded one.
  const daylight = ['#8FB6C4', '#86AEBE', '#7CA6B6', '#729EAE', '#6995A6', '#5F8C9E'];
  for (let i = 0; i < daylight.length; i += 1) {
    const bandH = Math.ceil(winH / daylight.length);
    pxRect(ctx, daylight[i]!, winX, winY + i * bandH, winW, bandH, 2);
  }
  // The skyline generator draws up from the ground band, so it is lifted into the
  // opening. Dark against the daylight now, with its windows only a step lighter —
  // a city read as silhouette is a city that stays outside the room.
  ctx.translate(0, winY + winH - GROUND_TOP + 60);
  drawSkyline(ctx, 67, '#2C4652', '#5E7E8C', t, reduced);
  ctx.restore();
  // Frame, transom and mullions, so it reads as glazing rather than as a hole. Dark
  // against the daylight, which is what a frame does when the light is behind it.
  const bar = '#1B2620';
  pxRect(ctx, bar, winX - 7, winY - 7, winW + 14, 7, 2);
  pxRect(ctx, bar, winX - 7, winY + winH, winW + 14, 7, 2);
  pxRect(ctx, bar, winX - 7, winY, 7, winH, 2);
  pxRect(ctx, bar, winX + winW, winY, 7, winH, 2);
  for (let x = winX + 100; x < winX + winW; x += 100) pxRect(ctx, bar, x, winY, 5, winH, 2);
  pxRect(ctx, bar, winX, winY + 96, winW, 4, 2);
  pxRect(ctx, 'rgba(159,216,228,0.09)', winX, winY, winW, 96, 2); // sheen on the upper lights
  pxRect(ctx, '#0C3340', winX - 10, winY + winH + 7, winW + 20, 8, 2); // sill

  // --- the floor ---------------------------------------------------------
  drawStorageWall(ctx);
  for (let i = 0; i < WORK_PODS.length; i += 1) drawWorkPod(ctx, WORK_PODS[i]!, i * 7 + 1);

  // Whiteboard: the prop that says this floor does work, with somebody's plan
  // still on it. Light face, because a board is the lightest thing on an office
  // wall and the only way it reads at this value is as a light shape.
  drawWhiteboard(ctx, 286, 202);
  drawPropLabel(ctx, 384, 182, 'SPRINT');

  // Wall clock, because a broken office is a story about time. At 80px with whole
  // pixel hands — the 46px version rasterised as a small window on the wall,
  // which is the same defect screen 1's clock was rebuilt to fix.
  drawWallClock(ctx, 706, 246, t, reduced);
}

/**
 * An office wall clock: 80px case, pale dial, stepped hands.
 *
 * Not `drawClock` — that one hangs off a bracket in a sky and has a brass spindle.
 * This is the flush plastic thing screwed to a plasterboard wall, and it is the
 * only round object in the room, so it is worth the cells.
 */
function drawWallClock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  t: number,
  reduced: boolean,
): void {
  const R = 40;
  pxRect(ctx, FURN.shade, cx - R, cy - R, R * 2, R * 2, 4); // shadow of the case
  pxRect(ctx, FURN.face, cx - R + 4, cy - R + 4, R * 2 - 8, R * 2 - 8, 4);
  pxRect(ctx, FURN.lit, cx - R + 4, cy - R + 4, R * 2 - 8, 4, 4); // lit top of the bezel
  // A mid grey dial, not the near-white a clock face is: it is a 56px light shape in
  // the middle of the wall, and near-white on this screen belongs to the wrapped
  // figure's cloth. Same call as the whiteboard's surface.
  pxRect(ctx, '#BFD6DE', cx - R + 12, cy - R + 12, R * 2 - 24, R * 2 - 24, 4); // dial
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const r = R - 18;
    pxRect(
      ctx,
      i % 3 === 0 ? '#0B3542' : '#5C8B99',
      cx + Math.sin(a) * r - 2,
      cy - Math.cos(a) * r - 2,
      4,
      4,
      4,
    );
  }
  const a = reduced ? -1.1 : t * 0.5 - 1.6;
  for (const [angle, len] of [
    [a, 22],
    [a * 0.25 - 1.2, 14],
  ] as const) {
    for (let i = 0; i <= len; i += 3) {
      pxRect(ctx, '#0B3542', cx + Math.cos(angle) * i - 3, cy + Math.sin(angle) * i - 3, 6, 6, 4);
    }
  }
  pxRect(ctx, '#0B3542', cx - 4, cy - 4, 8, 8, 4);
}

/* ---------------------------------------------------------------------------
 * Reception — an office lobby, seen from inside (owner call).
 *
 * This screen used to open on a sky and a city skyline with a desk standing in
 * front of it, which is a street with a desk on it. It is now the *inside* of a
 * building: the market is outside the glass on the left, where you came in from.
 *
 * It is deliberately the most finished-looking screen in the game, because it is
 * the first one anybody sees and because that is the joke the level is making —
 * "on paper, this all looks fine". Everything here is orderly: a coffered ceiling
 * with downlights on a regular pitch, a symmetrical desk with the mark centred
 * behind it, a lift bank whose two cars line up, plants at both ends. Nothing is
 * broken, nothing is taped off. Two screens later the Workplace floor is the same
 * building with the ceiling out and the tape up, and the contrast is the argument.
 *
 * It also has to stay clearly distinct from that Workplace interior, which is a
 * different room in the same idiom. Four things separate them and none is the hue:
 * this ceiling is a solid coffered soffit with lit fittings where that one is a
 * suspended grid with two tiles missing; the glazing is a full-height entrance
 * wall on the LEFT rather than a window band on the right; the furniture is
 * hospitality (desk, lounge, planters) rather than workstations; and the whole
 * room is a value or two lighter, because it is lit and maintained.
 *
 * Nothing is authored in the columns the three tutorial steps stand in (gx 9, 16
 * and 23, i.e. x 360-400, 640-680 and 920-1000): a prop behind a step reads as
 * one shape with it, and those three steps are the only thing on this screen the
 * player has to learn.
 * ------------------------------------------------------------------------- */

/**
 * Recessed downlight: the fitting, flush in the soffit, plus the wash it throws.
 *
 * The fitting is drawn *inside* the ceiling band rather than hanging under it — the
 * first pass hung a housing below the soffit and rasterised as a row of pendant
 * blobs, which is a different (and much less finished) kind of light. A recessed
 * lamp is a lit hole in a solid ceiling, and that is what says "maintained".
 */
function drawDownlight(ctx: CanvasRenderingContext2D, cx: number, y: number): void {
  pxRect(ctx, '#04161C', cx - 11, y - 12, 22, 12, 2); // the hole
  pxRect(ctx, '#DCF1F6', cx - 7, y - 8, 14, 6, 2); // lamp
  pxRect(ctx, '#8FC9D6', cx - 11, y, 22, 2, 2); // lit lip
  /*
   * **There is no light cone under these.** The first pass drew the wash as three
   * stepped rectangles of low-alpha white, on the reasoning that hard steps are more
   * 8-bit than a gradient. Rasterised, a 20px column of pale grey hanging 90px below
   * each fitting did not read as light at all — it read as eight grey objects
   * suspended from the ceiling, which is the exact thing recessing the lamps was
   * meant to avoid. The room is lit by the cove behind the desk and by the daylight
   * in the entrance glazing, both of which are *surfaces* rather than beams.
   */
}

/**
 * The entrance wall: full-height glazing with the market outside it, an automatic
 * door in the middle bay and a mat inside.
 *
 * The city is drawn *through* the glass rather than behind the building, which is
 * the whole point of moving this screen indoors: the skyline is where you have
 * come from, and the lobby is the first room of the thing you are building.
 */
function drawEntranceWall(
  ctx: CanvasRenderingContext2D,
  t: number,
  reduced: boolean,
): void {
  const x = 0;
  const w = 330;
  const top = 120;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, top, w, GROUND_TOP - top);
  ctx.clip();
  // Daylight outside, deliberately the brightest field on the screen: it is what
  // makes the room read as *inside*, and it puts real light at the end the player
  // walks in from. (Every other screen's sky is a night teal; this is glass, and
  // glass with a night sky behind it rasterised as three dark holes in a wall.)
  ctx.fillStyle = '#0C4C5E';
  ctx.fillRect(x, top, w, GROUND_TOP - top);
  // The skyline generator draws up from the ground band, so it is lifted to sit
  // on the pavement outside rather than on this floor.
  ctx.translate(0, -54);
  drawSkyline(ctx, 11, '#0A3F51', '#C6EAF2', t, reduced);
  ctx.restore();

  // Glazing bars: a heavy frame, three bays, and a transom at door head height.
  const bar = '#1A5E70';
  pxRect(ctx, bar, x, top - 6, w + 6, 8, 2);
  pxRect(ctx, bar, x + w, top - 6, 6, GROUND_TOP - top + 6, 2);
  for (const bx of [108, 222]) pxRect(ctx, bar, bx, top, 5, GROUND_TOP - top, 2);
  pxRect(ctx, bar, x, 300, w, 5, 2);
  // Highlight on the upper half of the glass, so it reads as glazing.
  pxRect(ctx, 'rgba(159,216,228,0.07)', x, top, w, 180, 2);

  // The automatic door in the middle bay: two leaves parted, with a threshold.
  pxRect(ctx, '#0E4655', 113, 300, 44, GROUND_TOP - 300, 2);
  pxRect(ctx, '#0E4655', 176, 300, 44, GROUND_TOP - 300, 2);
  pxRect(ctx, '#2A7C90', 113, 300, 44, 5, 2);
  pxRect(ctx, '#2A7C90', 176, 300, 44, 5, 2);
  // Entrance mat, on the floor line, dark against the polished stone.
  pxRect(ctx, '#062B36', 96, GROUND_TOP - 8, 150, 8, 2);
}

/**
 * The reception desk, the feature wall behind it and the ANSR mark on it.
 *
 * The mark is the real brand asset (`drawAnsrLogo`), never an interpretation of
 * it — and because that function is a silent no-op without `Path2D`, the wordmark
 * underneath carries the read on its own wherever the vector cannot be drawn.
 */
function drawLobbyDesk(ctx: CanvasRenderingContext2D, cx: number): void {
  const baseY = GROUND_TOP;
  /*
   * Feature wall: a lit bay behind the desk, one value LIGHTER than the room.
   *
   * It was darker on the first pass, on the reasoning that the mark would then be
   * the lightest thing in the middle of the frame. Rasterised, that gave the room a
   * dark slab in the middle of it and — worse — left the desk in front of it with
   * nothing to read against, because the desk is dark too. Lighter wall, dark desk:
   * the counter now has a silhouette, which is the only reliable way to make a prop
   * read at this size.
   */
  pxRect(ctx, '#12586A', cx - 136, 190, 272, 410, 2);
  pxRect(ctx, '#1E7B8F', cx - 136, 190, 272, 6, 2);
  pxRect(ctx, '#0A3F4E', cx - 136, 190, 8, 410, 2); // shadowed reveal, left
  pxRect(ctx, '#0A3F4E', cx + 128, 190, 8, 410, 2); // …and right
  // Cove light along the head of the bay: the one device that says "designed".
  pxRect(ctx, '#CFE6EC', cx - 122, 202, 244, 3, 2);
  pxRect(ctx, 'rgba(207,230,236,0.10)', cx - 122, 205, 244, 22, 2);
  // Two tall panels rather than a dozen bands: the first pass ruled this wall every
  // 44px and it rasterised as a roller shutter.
  pxRect(ctx, 'rgba(0,26,34,0.22)', cx - 6, 232, 12, 356, 2);

  // The mark, centred on the bay, with the wordmark under it. Real brand asset;
  // `drawAnsrLogo` is a silent no-op without Path2D, so the wordmark under it has
  // to carry the read on its own.
  drawAnsrLogo(ctx, cx, 282, 64, 0, LOGO_ORANGE);
  drawText(ctx, 'ANSR', cx, 326, { scale: 3, color: '#F2FBFD', align: 'center' });

  /*
   * Desk: a dark counter with a lit reveal under the top.
   *
   * It is **96px either side of centre and no wider**, which is a level-data
   * constraint rather than a compositional one: the tutorial steps stand at gx 9 and
   * gx 16 (x 360-400 and 640-680), and the first version of this counter was 126
   * either side plus a returned end, so it ran under both of them. Rasterised, the
   * first step and the desk's front panel merged into one dark shape — a step you
   * have to jump reading as furniture. The bay *behind* it is still full width,
   * because a lit wall behind a step is what gives the step its silhouette.
   *
   * Every height here is measured against the DRAWN hero (48×60, feet on the ground
   * band), not chosen to fill the wall. The first version had an 88px counter — half
   * again the height of the person standing at it, i.e. a desk nobody could be served
   * over — because the wall above the floor band is 600px tall and anything sized
   * against *that* comes out at three times human scale. 62px puts the top at his
   * eye line, which is what a reception counter is.
   */
  pxRect(ctx, '#06303C', cx - 96, baseY - 54, 192, 54, 2); // body
  pxRect(ctx, '#04222B', cx - 80, baseY - 42, 160, 30, 2); // recessed front panel
  pxRect(ctx, '#1E7B8F', cx - 106, baseY - 62, 212, 10, 2); // counter top
  pxRect(ctx, '#8FD6E4', cx - 106, baseY - 62, 212, 3, 2); // polished top edge
  pxRect(ctx, '#CFE6EC', cx - 98, baseY - 50, 196, 3, 2); // LED reveal
  // Monitor on the counter, angled away from the player.
  pxRect(ctx, '#04222B', cx + 22, baseY - 90, 48, 28, 2);
  pxRect(ctx, '#2A93A8', cx + 26, baseY - 86, 40, 20, 2);
  // A visitor book and a pen pot, because a lobby desk is never empty.
  pxRect(ctx, '#F2FBFD', cx - 74, baseY - 66, 34, 4, 2);
  pxRect(ctx, '#0A3F4E', cx - 30, baseY - 72, 9, 10, 2);
}

/**
 * A pair of lift doors with a lit floor indicator over each.
 *
 * The doors are 170px, which is ~2.8 drawn heroes: taller than a real door against
 * a real person, and deliberately so — this is the one piece of architecture in the
 * room, and a 75px opening in a 600px wall read as a hatch. Everything a person
 * *touches* (the counter, the seat, the call panel) is at human scale; the openings
 * are not. The first pass had them at 270 and they dwarfed the room.
 */
function drawLiftBank(ctx: CanvasRenderingContext2D, x: number): void {
  // Stone surround, so the two cars read as one piece of architecture.
  pxRect(ctx, '#0A303C', x - 14, 396, 216, 204, 2);
  pxRect(ctx, '#13586B', x - 14, 396, 216, 6, 2);
  for (const dx of [0, 108]) {
    const dxx = x + dx;
    pxRect(ctx, '#2A7C90', dxx, 424, 84, 176, 2); // frame
    pxRect(ctx, '#125C70', dxx + 6, 430, 72, 170, 2); // doors
    pxRect(ctx, '#0A3543', dxx + 41, 430, 3, 170, 2); // the parting line
    pxRect(ctx, 'rgba(159,216,228,0.10)', dxx + 6, 430, 72, 60, 2); // brushed sheen
    // Indicator over the doors: a lit arrow cell and a dark one, so the pair reads
    // as a display rather than as two lamps.
    pxRect(ctx, '#06222B', dxx + 22, 402, 40, 16, 2);
    pxRect(ctx, '#9FE0EE', dxx + 28, 406, 8, 8, 2);
    pxRect(ctx, '#123F4C', dxx + 48, 406, 8, 8, 2);
    // Call panel beside each car, at the height a hand reaches.
    pxRect(ctx, '#0E4655', dxx + 88, 520, 12, 24, 2);
    pxRect(ctx, '#CFE6EC', dxx + 92, 526, 4, 4, 2);
  }
}

/** Lounge seating: a two-seat bench, a low table and a magazine on it. */
function drawLounge(ctx: CanvasRenderingContext2D, x: number): void {
  const baseY = GROUND_TOP;
  // Seat height, back height and table height are all measured against the drawn
  // hero (60px): a seat at his knee, a back at his hip. The first version had a
  // back 92px tall, which is a sofa taller than the person sitting on it.
  pxRect(ctx, '#12586A', x, baseY - 34, 128, 22, 2); // seat
  pxRect(ctx, '#2A93A8', x, baseY - 38, 128, 7, 2); // seat edge, catching the light
  pxRect(ctx, '#0E4655', x + 4, baseY - 64, 120, 30, 2); // back
  pxRect(ctx, '#1E7B8F', x + 4, baseY - 64, 120, 4, 2);
  pxRect(ctx, '#082F3A', x + 8, baseY - 12, 10, 12, 2); // legs
  pxRect(ctx, '#082F3A', x + 110, baseY - 12, 10, 12, 2);
  // Low table with a magazine squared up on it.
  pxRect(ctx, '#0E5063', x + 146, baseY - 24, 66, 6, 2);
  pxRect(ctx, '#082F3A', x + 152, baseY - 18, 7, 18, 2);
  pxRect(ctx, '#082F3A', x + 199, baseY - 18, 7, 18, 2);
  pxRect(ctx, '#DCF1F6', x + 162, baseY - 27, 26, 3, 2);
}

/**
 * The lobby. Ceiling and lighting first, then the room's three pieces of
 * architecture (entrance, desk bay, lifts), then the loose furniture.
 */
function drawLobbyInterior(
  ctx: CanvasRenderingContext2D,
  t: number,
  reduced: boolean,
): void {
  // Walls: a lighter upper register over a darker dado, with a shadow gap at the
  // floor so the ground band has something to sit against.
  ctx.fillStyle = '#0B3240';
  ctx.fillRect(0, 0, W, GROUND_TOP);
  ctx.fillStyle = '#0E3B4A';
  ctx.fillRect(0, 120, W, 300);
  pxRect(ctx, '#164F5F', 0, 418, W, 4, 2);
  pxRect(ctx, '#093040', 0, 422, W, GROUND_TOP - 422, 2);
  pxRect(ctx, '#06222C', 0, GROUND_TOP - 26, W, 26, 2); // skirting shadow

  // Coffered soffit: a solid, maintained ceiling — the opposite of the Workplace
  // screen's missing tiles — with the fittings on a regular pitch.
  pxRect(ctx, '#06222C', 0, 0, W, 44, 2);
  pxRect(ctx, '#0F4152', 0, 44, W, 6, 2);
  for (let x = 0; x < W; x += 160) {
    pxRect(ctx, '#0A2E3A', x + 12, 8, 136, 28, 2);
    pxRect(ctx, '#12495A', x + 12, 8, 136, 3, 2);
  }
  for (let x = 80; x < W; x += 160) drawDownlight(ctx, x, 44);

  drawEntranceWall(ctx, t, reduced);
  drawLobbyDesk(ctx, 516);
  drawLiftBank(ctx, 1046);
  drawLounge(ctx, 700);
  // Two framed panels over the lounge. They exist because the wall between the desk
  // bay and the lifts was 380px of nothing, and an empty wall at this value reads as
  // an unfinished room rather than as a quiet one.
  for (const px of [706, 800]) {
    pxRect(ctx, '#0A3F4E', px, 392, 74, 96, 2);
    pxRect(ctx, '#12586A', px + 6, 398, 62, 84, 2);
    pxRect(ctx, '#1E7B8F', px + 6, 398, 62, 4, 2);
  }
  /*
   * Planters bookending the room. Both sit clear of the three steps, which is a
   * tighter constraint than it looks: the free floor between the entrance frame and
   * the first step is 24px, so a planter authored there was drawn entirely *behind*
   * a step and could not be seen at all. One goes inside the entrance instead (in
   * front of the glass, where a lobby planter actually stands) and one in the far
   * corner past the lifts.
   */
  drawPottedPlant(ctx, 296, GROUND_TOP);
  drawPottedPlant(ctx, 1246, GROUND_TOP);
}

/**
 * A band of heat shimmer over the ground at the dragon's end.
 *
 * **The rising embers that used to be in here are gone** (owner call): fourteen small
 * glowing cells drifting up the frame read as floating specks of dirt on the screen
 * rather than as hot air, and on a screen whose only hazard is fire, loose warm dots
 * in the sky are also fourteen things that look like they might hurt you. What is
 * left is the shimmer, which is *on* the floor rather than floating over it.
 */
function drawHeatShimmer(ctx: CanvasRenderingContext2D, amount = 1): void {
  // One course of dithered cells just above the ground, densest at the dragon's end.
  // Whole cells, so it stays 8-bit. `amount` takes it away with the danger.
  for (let x = 420; x < W; x += 8) {
    const f = (x - 420) / (W - 420);
    for (let y = GROUND_TOP - 24; y < GROUND_TOP; y += 8) {
      const n = hash2(x >> 3, y >> 3);
      if (n > (0.1 + f * 0.22) * amount) continue;
      pxRect(ctx, 'rgba(255,176,122,0.22)', x, y, 8, 8, 8);
    }
  }
}

/**
 * The market behind the fire lane (screen 4): a ridge of low roofs, a water tower and two
 * stall canopies, all of it **left of x=760**.
 *
 * The screen was a sky, a skyline and three small figures, which is why the owner's first
 * note on it was that it "doesn't look refined and polished": between the horizon and the
 * floor there was 200px of nothing, so the eye had the brick band, the beast, and no middle
 * distance to place either of them in. This is that middle distance, and it obeys the rule
 * the deleted crag paid for — **nothing dark in the beast's own columns**, because two dark
 * warm masses in one place is one mass and the animal loses its silhouette.
 *
 * `rel` brightens it with the morning and puts awnings and lit windows on it: the same
 * buildings, open for business rather than shuttered.
 */
function drawMarketRow(ctx: CanvasRenderingContext2D, rel: number): void {
  const base = GROUND_TOP;
  const roof = mixHex('#0A222A', '#2B4E56', rel);
  const roofLit = mixHex('#153A44', '#4E7C84', rel);
  const wall = mixHex('#08191F', '#22434B', rel);
  // Four low blocks with pitched-looking stepped roofs, uneven heights and widths.
  const blocks: [number, number, number][] = [
    [60, 168, 96],
    [240, 120, 74],
    [372, 200, 110],
    [560, 148, 88],
  ];
  for (const [x, w, h] of blocks) {
    pxRect(ctx, wall, x, base - h, w, h, 4);
    // A stepped parapet, so a block is a building rather than a rectangle.
    pxRect(ctx, roof, x - 4, base - h, w + 8, 10, 4);
    pxRect(ctx, roofLit, x - 4, base - h, w + 8, 4, 4);
    // Windows: dark by night with a couple lit, all of them out by morning.
    for (let wy = base - h + 22; wy < base - 26; wy += 26) {
      for (let wx = x + 10; wx < x + w - 14; wx += 24) {
        const n = hash2(wx >> 3, wy >> 3);
        const lit = n < 0.3 ? 1 - rel : 0;
        pxRect(
          ctx,
          lit > 0.4 ? 'rgba(226,138,86,0.75)' : mixHex('#04121A', '#38626B', rel),
          wx,
          wy,
          12,
          14,
          2,
        );
      }
    }
  }
  // A water tower on legs over the second block: one tall silhouette breaks a row of boxes.
  pxRect(ctx, wall, 250, base - 200, 56, 44, 4);
  pxRect(ctx, roofLit, 250, base - 200, 56, 5, 4);
  pxRect(ctx, roof, 246, base - 208, 64, 8, 4);
  for (const lx of [256, 296]) pxRect(ctx, wall, lx, base - 156, 6, 36, 2);
  // Two market canopies at street level, striped, and only in daylight is anybody trading:
  // by night they are down (a shuttered stall is a dark box, which is what the wall does).
  if (rel > 0.25) {
    const a = Math.min(1, (rel - 0.25) / 0.75);
    for (const [cx2, wid] of [
      [188, 92],
      [470, 108],
    ] as const) {
      const y = base - 78;
      for (let i = 0; i < wid; i += 12) {
        pxRect(
          ctx,
          i % 24 === 0 ? `rgba(226,232,232,${0.9 * a})` : `rgba(88,168,150,${0.9 * a})`,
          cx2 - wid / 2 + i,
          y,
          12,
          10,
          2,
        );
      }
      pxRect(ctx, `rgba(10,26,32,${0.9 * a})`, cx2 - wid / 2, y + 10, wid, 4, 2);
      for (const px of [cx2 - wid / 2 + 2, cx2 + wid / 2 - 6]) {
        pxRect(ctx, `rgba(20,44,50,${0.9 * a})`, px, y + 14, 4, 64, 2);
      }
    }
  }
}

/**
 * The queue of candidates waiting to be hired, behind a rope (screen 4).
 *
 * Three loose figures used to stand here and read as three teal smudges. A **queue** says
 * what they are — people waiting on this process — and the rope and posts are what make it
 * a queue rather than a group. They warm up and turn to face the line-up once the beast is
 * beaten, because by then the thing they were waiting for has happened.
 */
function drawHiringQueue(ctx: CanvasRenderingContext2D, rel: number): void {
  const tone = (base: string) => mixHex(base, '#2E6E7A', rel * 0.8);
  const at = [104, 136, 168, 200];
  for (const [i, x] of at.entries()) {
    drawPerson(ctx, x, GROUND_TOP, tone(i % 2 === 0 ? '#0B3B45' : '#0E4854'));
  }
  // Two posts and the rope between them, at hand height on a 60px figure.
  const y = GROUND_TOP - 34;
  for (const px of [86, 224]) {
    pxRect(ctx, mixHex('#123039', '#3C6C74', rel), px, y - 4, 6, 38, 2);
    pxRect(ctx, mixHex('#1E4E58', '#5A8E96', rel), px - 2, y - 10, 10, 7, 2);
  }
  for (let x = 92; x < 224; x += 8) {
    // A sag, so it is a rope and not a rail: two courses, dipping in the middle.
    const f = Math.abs(x - 158) / 66;
    pxRect(ctx, mixHex('#1E4E58', '#6E9AA0', rel), x, y + Math.round((1 - f * f) * 6), 8, 4, 2);
  }
}

/**
 * The full-frame half of the payoff (screen 4), drawn over the level material and under
 * the cast — the same two layers the Compliance maze's weather needs, for the same reason:
 * brightening the sky alone rasterises as a bright sky in front of an unchanged dark level.
 *
 * A cool dark veil that lifts, and a pale wash that comes up. "Un-gloomed" is not "lit",
 * so both halves are here rather than only the first.
 */
export function drawReliefWash(ctx: CanvasRenderingContext2D, relief: number): void {
  const rel = Math.max(0, Math.min(1, relief));
  const veil = 0.2 * (1 - rel);
  if (veil > 0.01) {
    ctx.fillStyle = `rgba(6,14,22,${veil})`;
    ctx.fillRect(0, 0, W, RESOLUTION.HEIGHT);
  }
  if (rel > 0.01) {
    ctx.fillStyle = `rgba(226,240,236,${0.085 * rel})`;
    ctx.fillRect(0, 0, W, RESOLUTION.HEIGHT);
  }
}

/**
 * Paint the full backdrop for `id`. Coordinates are internal px; everything
 * sits above the ground band (drawn separately as textured tiles).
 */
export function drawSceneBackground(
  ctx: CanvasRenderingContext2D,
  id: number,
  t: number,
  reduced: boolean,
  /**
   * 0..1 weather dial, read by screen 2 only: 0 is the overcast the maze opens under,
   * 1 is the daylight GCC-BOT leaves behind. A number rather than a flag so the change
   * is a change, and a *weather* dial rather than a badge one so this module stays
   * ignorant of the simulation.
   */
  weather = 0,
  /**
   * 0..1 relief dial, read by screen 4 only: 0 while the beast holds the far end, 1 once
   * it is beaten and the five have walked out (owner call: "when the Godzilla dies make the
   * environment beautiful and well lit up — from the dangerous environment it turns all
   * bright and happy").
   *
   * A **second** parameter rather than a second meaning for `weather`, because the two
   * dials mean different things on different screens and one number doing both jobs is the
   * sort of economy that reads as a bug the first time a screen wants both.
   */
  relief = 0,
): void {
  switch (id) {
    case 0: {
      /*
       * Reception is INDOORS (owner call) — an office lobby, not a desk standing in
       * the street. So there is no sky here: the market is outside the entrance
       * glazing on the left, which is where the player has just walked in from.
       * See `drawLobbyInterior` for what the room is made of and why it has to stay
       * distinct from the Workplace floor two screens later.
       */
      drawLobbyInterior(ctx, t, reduced);
      // The sign sets the honest frame — none of this is hard yet, because none of
      // it has left the slide deck. It hangs on the wall under the soffit rather
      // than in a sky that no longer exists.
      drawFloorSign(ctx, W * 0.5, 100, 'MARKET ENTRY: ON PAPER');
      // Name the three easy hops (geometry from levels.json screen 0).
      drawStepLabel(ctx, 9, 14, 'BUSINESS CASE');
      drawStepLabel(ctx, 16, 13, 'BOARD APPROVAL');
      drawStepLabel(ctx, 23, 12, 'BUDGET');
      break;
    }
    case 1: {
      /*
       * Setup Delays, quietened down (owner call: refine it, and take the cognitive
       * load out of it — without leaving the 8-bit idiom).
       *
       * Three things were competing for the same frame here, and only one of them
       * is the game. Four stamps park in the upper half of the screen at all times;
       * behind them ran a skyline whose lit windows were `#7FC4D2`, i.e. *lighter
       * than the stamps themselves*, so the hazard was reading against a field of a
       * hundred brighter dots. And in the middle of that sat a floor sign, a clock,
       * a framed PERMITS board and its caption — four separate things to read,
       * stacked in the one column of sky the player looks through.
       *
       * So: the skyline's windows drop two values and its towers go darker
       * (`drawSkyline` is shared, so this is done per call and nothing else moves);
       * the PERMITS board and its label are **deleted** — a form saying PERMITS
       * behind four stamps saying DENIED is the same sentence twice, and the duller
       * copy of it; and the clock is rebuilt at twice the size in whole pixels,
       * because "the setup is taking months" is the one thing on this backdrop
       * worth reading. Two props, one sign.
       */
      drawSky(ctx, '#05303a');
      drawSkyline(ctx, 23, '#032027', '#3E7280', t, reduced);
      drawFloorSign(ctx, W * 0.5, 70, 'SETUP DELAYS');
      drawStalledStacks(ctx, 60, GROUND_TOP);
      drawStalledStacks(ctx, W - 150, GROUND_TOP);
      drawClock(ctx, W * 0.5 + 20, 190, t, reduced);
      // The floor label used to name a sludge wade at col 8. That is now a stamp
      // column, and the stamps say DENIED loudly enough on their own — a label
      // under a slamming block is a label nobody reads.
      break;
    }
    case 2: {
      /*
       * The one screen with WEATHER, and the one screen where the badge's effect is
       * painted on the world rather than on the player (owner call — see the block
       * above `mixHex`). `weather` is 0 while the market is under an overcast lid and
       * 1 once GCC-BOT has filed everything and the sky has opened.
       *
       * The old backdrop here was a flat night sky, a skyline with `#8FCAD6` windows
       * and one sign. Two things were wrong with it and the weather fixed both: those
       * windows were the brightest thing on the frame, brighter than the monsters they
       * sat behind (screen 1 paid for exactly this), and a screen whose whole subject
       * is "this is grinding" had nothing in it that said so.
       */
      const clear = Math.max(0, Math.min(1, weather));
      drawSkyBand(ctx, [
        mixHex('#001A22', '#0A4E63', clear),
        mixHex('#032B36', '#12708A', clear),
        mixHex('#083A44', '#59B3C6', clear),
      ]);
      drawCloudBank(ctx, clear);
      drawSunBreak(ctx, clear);
      // The skyline hazes and its windows dim as the light comes up: at night the lit
      // windows are the only thing in the city you can see, and in daylight they are
      // the last. Both values stay under the monsters' pale heads, which is the rule
      // screen 1's invisible stamps taught us.
      drawSkyline(
        ctx,
        51,
        mixHex('#04262F', '#1E6274', clear),
        mixHex('#3E7280', '#2C6E7E', clear),
        t,
        reduced,
      );
      drawRain(ctx, t, reduced, 1 - clear);
      /*
       * Nothing hangs in this sky but the stage sign (owner call, twice).
       *
       * Two attempts have now put the TAX / GST / AUDIT / LEGAL / ENTITY signage
       * up here — first as five suspended boards, then as a wall of labelled
       * filing cabinets — and both were rejected for the same reason: those five
       * words are the *monsters'* names, so a copy of them floating behind the
       * climb is a second, duller label layer competing with the one that matters.
       * They live on the monsters now, as framed plaques over each one
       * (`render/maze.ts`). Do not put them back in the sky.
       *
       * What is left is the sky, the skyline of the market you are entering, and
       * the floor sign — all of it above and behind the climb.
       */
      drawFloorSign(ctx, W * 0.5, 70, 'COMPLIANCE');
      break;
    }
    case 3: {
      /*
       * The Workplace is the one screen that is INDOORS (owner call), so it is the
       * one screen that does not open with a sky. Every other backdrop says "the
       * market you are entering"; this one says "the floor you have taken", and a
       * city skyline behind an office is the wrong picture — the market belongs
       * outside the window, which is exactly where it is put here.
       *
       * What is *not* here: the gloom, the strip lights, the barricades, the tape
       * and the terminal. All of those are driven by the hazard's `restore` dial and
       * live in `render/workplace.ts`, because a backdrop function has no business
       * knowing whether the room has been fixed.
       */
      drawOfficeInterior(ctx, t, reduced);
      // On the wall under the services run, not in the ceiling: the ceiling band is
      // 96px deep now and the sign used to sit inside it.
      drawFloorSign(ctx, W * 0.5, 146, 'WORKPLACE');
      break;
    }
    case 4: {
      /*
       * The dragon screen, and the backdrop has one job: make the far end of the
       * frame feel like somewhere a dragon lives, without adding anything the player
       * has to read.
       *
       * Two things changed on the art pass that moved the dragon to that end:
       *
       *  · **The skyline's windows are no longer the fire's orange.** They were
       *    `#FFB07A` — the exact tone of the flame highlights — which put a hundred
       *    warm dots across the whole backdrop and left the fire competing with the
       *    scenery for the one colour that is supposed to mean danger here. They are
       *    a dim burnt ember now, so the only *bright* warm things on the screen are
       *    the ones that can cost a life.
       *  · **There is a crag at the right-hand end**, under the roost. A boss that
       *    holds one end of a level needs that end to look like its own: the last
       *    third of this backdrop is a scorched outcrop with a cave mouth in it, and
       *    the skyline steps down into it, so "further right is worse" is visible
       *    before anything is on fire.
       */
      /*
       * **Two states and a dial between them**, the same shape as the Compliance maze's
       * weather (owner call). `relief` is 0 while the beast holds the far end and 1 once it
       * has been beaten and the five have walked out of its costume.
       *
       *   relief = 0  an ember night: a warm dark horizon over a scorched market, the
       *               skyline in near-silhouette with dim burnt windows, heat coming off
       *               the floor
       *   relief = 1  morning: a clear teal-blue sky, a sun up over the city, small lit
       *               clouds, the skyline in daylight with its windows out, no heat haze —
       *               and a market that is open rather than under siege
       *
       * The rule this screen inherits from that one: the change has to be visible across
       * the **whole frame** or it reads as a bright sky in front of an unchanged dark level.
       * The other half of it (the wash over the masonry and under the cast) is
       * `drawReliefWash`, drawn from `Game.drawDragonScreen`.
       */
      const rel = Math.max(0, Math.min(1, relief));
      drawSkyBand(ctx, [
        mixHex('#150F18', '#0A4E63', rel),
        mixHex('#241A1E', '#1E7E96', rel),
        mixHex('#3A2320', '#8FC9D2', rel),
      ]);
      if (rel > 0.02) {
        // The morning comes UP over the city rather than being switched on: the sun and the
        // cloud bank are the same two functions screen 2 uses, so there is one sun in this
        // game and one set of clouds.
        drawCloudBank(ctx, rel);
        drawSunBreak(ctx, rel);
      }
      drawSkyline(
        ctx,
        37,
        mixHex('#062930', '#2C6E7E', rel),
        // Burnt embers by night, and the windows go OUT in the morning: lit windows are the
        // only thing you can see of a city at night and the last thing you see of one in
        // daylight, which is the same value discipline screen 2's skyline follows.
        mixHex('#8A3A2A', '#4F8A96', rel),
        t,
        reduced,
      );
      /*
       * **The crag is gone.** It was authored under a dragon that *hovered* over this
       * end of the level, and it worked: a boss holding one end of a screen needs that
       * end to look like its own. The beast now stands on the floor in exactly the
       * columns the crag occupied, and two dark warm masses in the same place is one
       * mass — rasterised, the animal lost its silhouette completely and the head read
       * as a hole in the rock. What holds the far end now is the beast itself, plus the
       * scorch on the ground it is standing on (`render/dragon.ts`).
       */
      // The market this screen is set in, in two registers: a low ridge of dark roofs
      // behind the skyline's feet, and the street furniture the queue stands among. Both
      // stop well short of the roost — anything dark in the beast's own columns takes its
      // silhouette away, which is what the deleted crag proved.
      drawMarketRow(ctx, rel);
      // The heat coming off the floor is the *danger's* signature, so it goes with it.
      if (rel < 0.98) drawHeatShimmer(ctx, 1 - rel);
      // The queue of candidates waiting to join, behind a rope: who the five inside the
      // costume are, before anybody gets them out.
      drawHiringQueue(ctx, rel);
      drawFloorSign(ctx, W * 0.42, 70, 'HIRE UNDER FIRE');
      /*
       * The suspended job board and its HIRING label are gone (they hung at y≈130).
       * Same call as the compliance boards: the dragon now flies through that band
       * with a name plate and a taunt plaque of its own, and signage behind a boss
       * is signage nobody reads. The two candidates who used to stand at the right
       * are gone with it — that ground is the dragon's lane now, and the only thing
       * standing in a fire lane should be something that can be hit.
       */
      break;
    }
    case 5: {
      // Finale keeps its bespoke hero scene (drawn in Game.drawFinale); here we
      // only lay a brighter arrival sky + distant skyline behind it.
      drawSky(ctx, '#0E5566');
      drawSkyline(ctx, 83, '#0a4553', '#FFD9A8', t, reduced);
      break;
    }
    default: {
      drawSky(ctx, '#053642');
      drawSkyline(ctx, 11, '#053039', '#9FD8E4', t, reduced);
    }
  }
}
