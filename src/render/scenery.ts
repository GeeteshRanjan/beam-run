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
  2: {
    face: '#7A5A3C', shade: '#553D28', highlight: '#A2794F', mortar: '#2A1B10',
    brickW: 20, brickH: 20, speckle: 0.1, edge: '#C29A66',
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
  3: {
    face: '#28383D', shade: '#1A2528', highlight: '#42585E', mortar: '#101819',
    brickW: 40, brickH: 40, speckle: 0.03, edge: '#63797F',
    faces: ['#28383D', '#233237', '#2C3E43', '#1F2E32'],
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
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_TOP);
  grad.addColorStop(0, '#00212B');
  grad.addColorStop(0.6, '#002B37');
  grad.addColorStop(1, horizonTint);
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
  /** Centres of the four strip fittings. */
  LIGHTS: [200, 500, 800, 1100] as const,
  /**
   * The aperture a fitting sits in — **exactly two tiles**, so it lands on the same
   * grid the holes do. At 168 it overhung its tiles by 4px each side, which was
   * enough to eat the corner of a missing tile at 640 (`workplace.test.ts` states
   * the relationship rather than the numbers).
   */
  FIT_W: 160,
  FIT_Y: 54,
  FIT_H: 32,
} as const;

/** Left edge of each workstation pod, and where its monitor screen sits. */
export const WORK_PODS = [190, 430, 668] as const;
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
export const CABINETS = { rackX: 100, x: 290, y: GROUND_TOP - 100, w: 104, drawerH: 24 } as const;
/** The glazing on the right third — the market, outside, where it belongs. */
export const WINDOW = { x: 830, y: 176, w: W - 830 - 40, h: 210 } as const;

/** A monitor: shell, bezel and screen. `screen` decides whether it is awake. */
function drawMonitor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  screen: string,
): void {
  pxRect(ctx, '#04161B', x - 4, y - 4, w + 8, h + 8, 2); // shell
  pxRect(ctx, '#2A7C90', x - 4, y - 4, w + 8, 3, 2); // lit top edge of the shell
  pxRect(ctx, screen, x, y, w, h, 2);
  pxRect(ctx, '#04161B', x + w / 2 - 5, y + h + 4, 10, 6, 2); // neck
  pxRect(ctx, '#0C2E38', x + w / 2 - 14, y + h + 10, 28, 4, 2); // foot
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
  pxRect(ctx, '#072229', x, b - 50, 196, 50, 2); // divider panel
  pxRect(ctx, '#2A7C90', x, b - 50, 196, 4, 2); // lit top rail
  pxRect(ctx, '#04161B', x + 4, b - 44, 188, 4, 2); // shadow under the rail
  pxRect(ctx, '#0C3340', x + 92, b - 44, 3, 44, 2); // the joint between two panels

  // Desk: a slab on a modesty panel, with the light catching its front edge.
  pxRect(ctx, '#04161B', x + 18, b - 30, 152, 30, 2);
  pxRect(ctx, '#17566A', x + 12, b - 36, 164, 8, 2);
  pxRect(ctx, '#46A6BC', x + 12, b - 36, 164, 3, 2);

  drawMonitor(ctx, x + POD_SCREEN.dx, b + POD_SCREEN.dy, POD_SCREEN.w, POD_SCREEN.h, '#0C3340');
  // Keyboard, a mug and a stack of paper — stable positions, never a scatter.
  pxRect(ctx, '#0E3B47', x + 30, b - 40, 46, 4, 2);
  pxRect(ctx, '#9FBAC2', x + 104, b - 44, 10, 8, 2);
  pxRect(ctx, '#A9BEC4', x + 124, b - 40, 30, 4, 2);
  pxRect(ctx, '#8CA8B4', x + 124, b - 44, 30, 4, 2);

  // Task chair, pushed in on one pod and out on the next so the row is not a
  // pattern. It is drawn in front of the desk, which is where a chair is.
  const out = hash2(seed, 3) > 0.5 ? 34 : 6;
  const cx = x + 60 + out;
  pxRect(ctx, '#051A20', cx - 20, b - 56, 40, 28, 2); // back
  pxRect(ctx, '#2A7C90', cx - 20, b - 56, 40, 3, 2);
  pxRect(ctx, '#04161B', cx - 24, b - 28, 48, 7, 2); // seat
  pxRect(ctx, '#17566A', cx - 24, b - 28, 48, 3, 2);
  pxRect(ctx, '#04161B', cx - 3, b - 21, 6, 14, 2); // post
  pxRect(ctx, '#0C2E38', cx - 22, b - 7, 44, 4, 2); // base
  pxRect(ctx, '#0C2E38', cx - 22, b - 3, 6, 3, 2);
  pxRect(ctx, '#0C2E38', cx + 16, b - 3, 6, 3, 2);
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
  pxRect(ctx, '#0A2A33', rackX - 6, GROUND_TOP - 216, 88, 216, 2);
  pxRect(ctx, '#154C5A', rackX - 6, GROUND_TOP - 216, 88, 4, 2);
  for (let ry = GROUND_TOP - 204; ry < GROUND_TOP - 20; ry += 18) {
    pxRect(ctx, '#123F4C', rackX, ry, 62, 11, 2);
    pxRect(ctx, '#08222A', rackX, ry + 11, 62, 3, 2);
    // One status light per shelf, stable (hash2) rather than blinking at random.
    pxRect(ctx, hash2(ry, 5) > 0.45 ? '#2E7F5E' : '#0E3B47', rackX + 66, ry + 3, 5, 5, 2);
  }
  // Cabinet bank, four drawers, closed. The damage layer pulls two of them out.
  // Same value rule as the pods: a dark mass with one lit edge per drawer.
  pxRect(ctx, '#051A20', x, y, w, GROUND_TOP - y, 2);
  pxRect(ctx, '#2A7C90', x, y, w, 4, 2);
  for (let i = 0; i < 4; i += 1) {
    const dy = y + 6 + i * drawerH;
    pxRect(ctx, '#0C3340', x + 6, dy, w - 12, drawerH - 6, 2);
    pxRect(ctx, '#17566A', x + 6, dy, w - 12, 3, 2);
    pxRect(ctx, '#04161B', x + 6, dy + drawerH - 6, w - 12, 3, 2);
    pxRect(ctx, '#8CA8B4', x + w / 2 - 12, dy + 8, 24, 4, 2); // handle
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
  pxRect(ctx, '#0A2A33', x - 5, y - 5, w + 10, h + 10, 2); // shadow
  pxRect(ctx, '#123F4C', x - 4, y - 4, w + 8, h + 8, 2); // frame
  pxRect(ctx, '#2A7C90', x - 4, y - 4, w + 8, 3, 2);
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
  pxRect(ctx, '#123F4C', x - 4, y + h + 4, w + 8, 7, 2); // pen tray
  pxRect(ctx, '#8CA8B4', x + 20, y + h + 4, 22, 3, 2); // a marker on it
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
  ctx.fillStyle = '#0A2B33';
  ctx.fillRect(0, 0, W, GROUND_TOP);
  ctx.fillStyle = '#0E3846';
  ctx.fillRect(0, 160, W, 300);
  pxRect(ctx, '#175565', 0, 156, W, 4, 2);
  // A dado rail two thirds of the way down the light register. Without it that
  // register is 300px of one value, and 300px of one value is a painted flat
  // whatever is standing in front of it.
  pxRect(ctx, '#0C3441', 0, 334, W, 126, 2);
  pxRect(ctx, '#175565', 0, 330, W, 4, 2);
  ctx.fillStyle = '#0A2E39';
  ctx.fillRect(0, 460, W, GROUND_TOP - 460);
  pxRect(ctx, '#12475A', 0, 458, W, 3, 2);
  // Panel joints: an office wall is a run of panels, and the joints are what stop
  // each band reading as one continuous surface.
  for (let x = 0; x < W; x += 160) pxRect(ctx, 'rgba(0,18,26,0.30)', x, 160, 3, 300, 1);
  pxRect(ctx, '#06202A', 0, GROUND_TOP - 22, W, 22, 2); // skirting
  pxRect(ctx, '#15606E', 0, GROUND_TOP - 25, W, 3, 2);

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

  // Services under the ceiling: a duct and a cable tray, the horizontal that ties
  // the top of the frame to the room.
  pxRect(ctx, '#0C2E38', 0, 108, W, 24, 2);
  pxRect(ctx, '#154C5A', 0, 108, W, 4, 2);
  pxRect(ctx, '#06202A', 0, 128, W, 4, 2);
  for (let x = 20; x < W; x += 120) {
    pxRect(ctx, '#0C2E38', x, CEILING.H, 6, 8, 2); // hanger into the ceiling
    pxRect(ctx, '#154C5A', x + 40, 132, 44, 4, 2); // a run of trunking dropping away
  }

  // --- glazing -----------------------------------------------------------
  const { x: winX, y: winY, w: winW, h: winH } = WINDOW;
  ctx.save();
  ctx.beginPath();
  ctx.rect(winX, winY, winW, winH);
  ctx.clip();
  ctx.fillStyle = '#06303C';
  ctx.fillRect(winX, winY, winW, winH);
  // The skyline generator draws up from the ground band, so it is lifted into the
  // opening. Its windows are two values up on the old call: through glass, on the
  // one screen with no sky, the city is the only daylight in the room.
  ctx.translate(0, winY + winH - GROUND_TOP + 60);
  drawSkyline(ctx, 67, '#083744', '#9FD2DE', t, reduced);
  ctx.restore();
  // Frame, transom and mullions, so it reads as glazing rather than as a hole.
  const bar = '#175565';
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
  pxRect(ctx, '#061C23', cx - R, cy - R, R * 2, R * 2, 4); // shadow of the case
  pxRect(ctx, '#123F4C', cx - R + 4, cy - R + 4, R * 2 - 8, R * 2 - 8, 4);
  pxRect(ctx, '#2A7C90', cx - R + 4, cy - R + 4, R * 2 - 8, 4, 4); // lit top of the bezel
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
function drawHeatShimmer(ctx: CanvasRenderingContext2D): void {
  // One course of dithered cells just above the ground, densest at the dragon's end.
  // Whole cells, so it stays 8-bit.
  for (let x = 420; x < W; x += 8) {
    const f = (x - 420) / (W - 420);
    for (let y = GROUND_TOP - 24; y < GROUND_TOP; y += 8) {
      const n = hash2(x >> 3, y >> 3);
      if (n > 0.1 + f * 0.22) continue;
      pxRect(ctx, 'rgba(255,176,122,0.22)', x, y, 8, 8, 8);
    }
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
      drawSky(ctx, '#062E38');
      drawSkyline(ctx, 51, '#04262F', '#8FCAD6', t, reduced);
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
      drawSky(ctx, '#2A1A18'); // an ember horizon, warm into the scorched ground
      drawSkyline(ctx, 37, '#062930', '#8A3A2A', t, reduced);
      /*
       * **The crag is gone.** It was authored under a dragon that *hovered* over this
       * end of the level, and it worked: a boss holding one end of a screen needs that
       * end to look like its own. The beast now stands on the floor in exactly the
       * columns the crag occupied, and two dark warm masses in the same place is one
       * mass — rasterised, the animal lost its silhouette completely and the head read
       * as a hole in the rock. What holds the far end now is the beast itself, plus the
       * scorch on the ground it is standing on (`render/dragon.ts`).
       */
      drawHeatShimmer(ctx);
      // The queue of candidates: who the five inside the costume are waiting to join.
      drawPerson(ctx, 120, GROUND_TOP, '#0B3B45');
      drawPerson(ctx, 150, GROUND_TOP, '#0E4854');
      drawPerson(ctx, 178, GROUND_TOP, '#0B3B45');
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
