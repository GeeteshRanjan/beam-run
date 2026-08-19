/**
 * The hiring dragon's painting (screen 4).
 *
 * Pure: level data, the hazard's snapshot and a clock in, canvas out. No wall
 * clock read inside, no DOM, no host state — so the whole screen rasterises on its
 * own, which is the only way any of it gets checked.
 *
 * **Why this is composed and not one grid.** Every other creature in this game is
 * a single authored string grid (the maze monster is 7×13, the Workplace figure
 * 20×26). At 200×190 the dragon would be a 40×38 grid: 1,520 hand-placed cells, in
 * a file where a mistyped row is invisible until it rasterises. So it is built the
 * way the Workplace *props* are built — one small grid (the head) placed by a
 * composer, with the torso, neck, tail and legs stepped out of `pxRect` runs. Same
 * 8-bit output, one order of magnitude less to get wrong.
 *
 * **It stands on the ground on two feet, and it has no wings** (owner call, third
 * art pass). The reference is a Godzilla, not a wyvern: the body box's bottom edge
 * *is* the ground band, so the two clawed feet are planted on the floor, the tail
 * lies along it behind him, and the head is carried low and forward over the feet
 * rather than up on a raised neck. The wings are deleted outright — they were the
 * one part of the silhouette that said "this thing is in the air", and a thing in
 * the air cannot be a thing standing between the player and the exit.
 *
 * **Colour** (owner call). It was green, and green is the one colour that says
 * "friendly cartoon lizard". It is **oxblood crimson**, with a bone belly, ivory
 * horns, teeth and claws: a red dragon, which is what the word means to most
 * people. The separation from its own fire is carried by *value* rather than hue —
 * the beast is the darkest warm thing on the screen and every flame is the
 * lightest, cream-cored — plus the fact that nothing on the body is orange and
 * nothing in the fire is crimson. Water, the halo and the cannon stay cyan, the one
 * family on the screen that is the opposite of the fire.
 *
 * **The costume is one piece, and it is the health bar.** Glasses, and nothing else
 * — no jacket and no tie (owner call, third pass). Four water jets fog them, crack
 * them twice and then wash them off the snout. Nothing draws a bar or a number: the
 * state of the fight is legible from the state of the glass, backed by the pips.
 * And when the last hit lands the **beast goes with the costume** — what is left on
 * the floor is the wreckage of what it was wearing and the five people who were
 * inside it, never a dragon standing there undressed.
 */
import { RESOLUTION } from '../data/tuning.config';
import { pxRect, drawPixels, hash2, maxWidth, type Palette } from './PixelArt';
import { drawText, drawLabelPlaque } from './PixelText';
import {
  MOUTH_X_FRACTION,
  MOUTH_Y_FRACTION,
  type FireState,
  type CandidateState,
  type DragonState,
  type SteamState,
  type WaterState,
} from '../world/Hazards/Dragon';

const { WIDTH: W, TILE: T } = RESOLUTION;
const GROUND_TOP = 15 * T;

// --- palette ---------------------------------------------------------------

const OUTLINE = '#1A0A0E';
/**
 * Oxblood crimson: mid, shade, highlight. A red dragon, and never the fire's orange.
 *
 * Lighter than the first attempt at this palette (#8A2A33), which rasterised as a
 * dark mass against the dark teal sky — the silhouette was there in the file and not
 * on the screen. The separation from the fire is carried by value in the other
 * direction: every flame is cream-cored and *lighter* than this.
 */
const SCALE = '#9B2F38';
const SCALE_DARK = '#5C1620';
const SCALE_LIT = '#C24A50';
/** Bone belly plates — the lightest thing on the body, so the mass reads. */
const BELLY = '#E7D3A6';
/** Horns, teeth, claws, spines. */
const BONE = '#EFE4C8';
const BONE_DARK = '#BCAE8C';
const MAW = '#2E070B';
const EYE = '#FFC24D';

/** The costume: one pair of glasses, and never orange. */
const GLASS_FRAME = '#16232A';
const LENS = 'rgba(207,230,236,0.42)';
const LENS_CRACK = '#0B1418';

/** Fire. The one place the value orange is allowed on this screen. */
const FIRE_CORE = '#FFF2D0';
const FIRE_HOT = '#FFB07A';
const FIRE_MID = '#FF7A2A';
const FIRE_DEEP = '#FF5400';

/** Water, the halo and the cannon: the answer, and the opposite of the fire. */
const WATER_DEEP = '#1C7FA6';
const WATER = '#4FBEDC';
const WATER_LIT = '#A8ECFA';

// ---------------------------------------------------------------------------
// The beast
// ---------------------------------------------------------------------------

/**
 * The Godzilla, authored as **one 30×24 grid** and drawn at scale 8 → 240×192.
 *
 * This deliberately breaks the "a big creature is composed, not authored as one
 * grid" rule, and the reason is the owner's reference: a *bead-grid Godzilla*. The
 * rule exists because a 40×38 grid is 1,520 cells nobody can proof-read and because
 * a mistyped row is invisible until it rasterises. Neither objection survives here:
 *
 *  · the creature **is** a silhouette — one animal, no clothing to register against
 *    it, so there is nothing a composer would buy;
 *  · at scale 8 the grid is 30×24 = 720 cells, and every row is a handful of runs;
 *  · a row of the wrong width is caught **mechanically** by a test that measures the
 *    grid, so the "invisible until it rasterises" failure cannot happen;
 *  · and one grid mirrors for free. The composed version needed a `mirror()` helper
 *    threaded through every `pxRect` call precisely because `drawPixels` can flip a
 *    grid and stepped runs cannot — that whole class of "a left-facing dragon is a
 *    subtly different animal" bug is deleted with the runs.
 *
 * What the grid spends its cells on is the reference's silhouette, which is what
 * makes a shape read as Godzilla rather than as a lizard:
 *  · **upright stance** — the skull is the top of the picture, the spine runs down to
 *    the hips, and the mass is carried on two thick back legs;
 *  · **two feet planted on the floor**, claws forward and a heel behind, on the last
 *    row of the grid, which is the ground band;
 *  · **small arms held in front of the chest** (`c` claws at the ends) — not wings,
 *    and not legs;
 *  · **an enormous tail** leaving the hips and sweeping back and down until it lies
 *    flat along the floor, taking up half the width of the grid on its own;
 *  · **dorsal fins** (`f`) stepping down the back and along the tail, one per row, so
 *    the ridge reads as a jagged line rather than as a fringe.
 *
 * `B` is the pale belly, `H` the lit top planes, `S` the shaded underside, `A`/`p`
 * the eye and its slit, `m`/`h` the maw and its teeth. There are **no horns and no
 * wings** — both were on the dragon this replaced, and both are exactly what said
 * "this animal is not a Godzilla".
 */
const BEAST: readonly string[] = [
  '.................KKKKKKKK.....',
  '.................KsAAssssKK...',
  '.................KsAApsssnK...',
  '.................KssssssssK...',
  '...............KKsssmhmhmhK...',
  '..............fKsssssmhmhmK...',
  '............KKKHHHHHsK........',
  '...........fKSsssssssK........',
  '............KSsssssssBKKK.....',
  '...........fKSsssssssBBBK.....',
  '............KSssssssssBBBK....',
  '...........fKSssssssssBKKK....',
  '............KSsssssBBBK.......',
  '..........fKSssssssBBK........',
  '...........KSssssssBBK........',
  '......fKKKKHSSssssBBK.........',
  '.......KsssSSsssssBBK.........',
  '..fKKKKssssSSssKKsssK.........',
  '...KsssssKKsssK..KssK.........',
  'KKKSSSSSK..KssK..KssK.........',
  'KSSSSKKKK..KssK..KssK.........',
  'KSSSK......KssK..KssK.........',
  'KKKKK....KKssssKKssssKKK......',
  '.........KKKKKKKKKKKKKKK......',
];

const BEAST_PALETTE: Palette = {
  K: OUTLINE,
  s: SCALE,
  S: SCALE_DARK,
  H: SCALE_LIT,
  B: BELLY,
  f: BONE,
  A: EYE,
  p: '#140806',
  m: MAW,
  h: BONE,
  n: '#3A0E12',
  c: BONE_DARK,
};

/**
 * Scale 8, i.e. cells twice the size of any other creature's in the game.
 *
 * That is the reference again: the beads in the owner's image are big and few, and a
 * 200px animal built out of 4px cells reads as a detailed drawing rather than as a
 * monster. It also means the whole beast is 720 cells instead of the 5,000 a scale-4
 * version of the same silhouette would need.
 */
const BEAST_SCALE = 10;
const BEAST_COLS = maxWidth(BEAST);
export const BEAST_W = BEAST_COLS * BEAST_SCALE;
export const BEAST_H = BEAST.length * BEAST_SCALE;

/**
 * Where the grid is pinned inside the body box.
 *
 * The box is 200×190 and the grid is 240×192, and the difference is all tail: the
 * legs and torso sit inside the box (which is what a water jet has to hit) and the
 * tail hangs 56px out of the back of it. The bottom row lands on the ground band,
 * which is what "two feet on the ground" is, measured.
 */
const BEAST_OFFSET_X = -25;
const BEAST_OFFSET_Y = 0;

/** The eye's cell, and therefore where a pair of glasses has to sit. */
const EYE_COL = 19;
const EYE_ROW = 1;

/**
 * The wreck of the costume, on the floor.
 *
 * This is what the end of the fight looks like (owner call): **no beast at all.**
 * An earlier build left it standing there at a third alpha with nothing on, which
 * read as a defeated animal rather than as a problem that had been solved, and it
 * put a 200px silhouette behind the five people who are the actual payoff. So the
 * body goes with the glasses, and what is left is the wreckage of what it was
 * wearing: a bent frame, a cracked lens, the puddle the water cannon left, and the
 * scorch it had been standing on.
 *
 * `p` is 0..1 as the costume comes apart, so the heap can be grown under the beast
 * while it fades rather than appearing the frame it goes.
 */
function drawCostumeWreck(
  ctx: CanvasRenderingContext2D,
  cx: number,
  p: number,
  flip: boolean,
): void {
  if (p <= 0) return;
  const a = Math.min(1, p * 1.4);
  const dir = flip ? -1 : 1;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * a;

  // The wet patch it all came down in: whole cells, dithered at the edges, never a
  // soft gradient.
  for (let x = cx - 150; x < cx + 150; x += 10) {
    const f = 1 - Math.abs(x - cx) / 150;
    const n = hash2(Math.round(x / 10), 13);
    if (n > 0.2 + f * 0.75) continue;
    pxRect(
      ctx,
      n < 0.3 ? 'rgba(28,127,166,0.5)' : 'rgba(11,58,71,0.45)',
      x,
      GROUND_TOP - 6,
      10,
      10,
      2,
    );
  }

  // The frame, bent open on the floor: two temple arms and the rims it fell out of.
  const fx = cx + dir * 26;
  pxRect(ctx, GLASS_FRAME, fx - 46, GROUND_TOP - 16, 42, 7, 2);
  pxRect(ctx, GLASS_FRAME, fx + 2, GROUND_TOP - 22, 40, 7, 2);
  pxRect(ctx, GLASS_FRAME, fx - 10, GROUND_TOP - 20, 8, 12, 2);
  // One lens still in it, and one in pieces beside it. The crack is what says the
  // water won rather than that somebody took them off.
  pxRect(ctx, LENS, fx - 42, GROUND_TOP - 14, 30, 12, 2);
  pxRect(ctx, LENS_CRACK, fx - 34, GROUND_TOP - 14, 3, 12, 1);
  for (let i = 0; i < 4; i += 1) {
    const n = hash2(i, 41);
    pxRect(
      ctx,
      i % 2 === 0 ? LENS : 'rgba(168,236,250,0.6)',
      fx + 14 + i * 13 + n * 6,
      GROUND_TOP - 12 - n * 6,
      7,
      6,
      2,
    );
  }
  // Two drips still coming off the heap, at full alpha and few — the halo lesson.
  pxRect(ctx, WATER_LIT, fx - 24, GROUND_TOP - 26, 3, 8, 1);
  pxRect(ctx, WATER, fx + 30, GROUND_TOP - 24, 3, 6, 1);

  ctx.globalAlpha = prev;
}

/**
 * The beast, and the one thing it is wearing.
 *
 * `box` is the drawn body and **not a player hitbox** — nothing about touching this
 * thing costs the player anything, which is why the art is allowed to sprawl past it
 * (the tail, and the claws). That is the exact opposite of the rule every other
 * creature here follows, and it is only safe because the fire is the hazard. The box
 * *is* what a water jet has to reach, so it is a target rather than a threat.
 *
 * Everything about the animal is in `BEAST`; this function's job is to place it, put
 * the glasses on its face in the right state of damage, and hang the name plate
 * somewhere the HUD is not.
 */
export function drawDragon(
  ctx: CanvasRenderingContext2D,
  state: DragonState,
  t: number,
  reduced: boolean,
): void {
  const { box } = state;
  const flip = state.dir < 0;
  const cx = box.x + box.w / 2;
  const stripping = state.phase === 'stripping';

  // Beaten: there is no beast any more (owner call). Only what it was wearing, on
  // the floor, and the people who came out of it — drawn by `drawHiredCandidates`.
  if (state.phase === 'beaten') {
    drawCostumeWreck(ctx, cx, 1, flip);
    return;
  }

  const drawX = box.x + (flip ? box.w - BEAST_W - BEAST_OFFSET_X : BEAST_OFFSET_X);
  const drawY = box.y + BEAST_OFFSET_Y;
  /**
   * A run of grid cells, in pixels, mirrored the same way the grid is.
   *
   * Anything drawn *on* the animal (the glasses, their cracks) has to be registered
   * to its cells rather than to the box, or it slides off the face the moment the
   * grid or the offsets change — and it has to mirror by the same arithmetic
   * `drawPixels` uses, or the glasses end up on the back of a left-facing head.
   */
  const cellRect = (c: number, r: number, wCells: number, hCells: number) => ({
    x: flip
      ? drawX + (BEAST_COLS - c - wCells) * BEAST_SCALE
      : drawX + c * BEAST_SCALE,
    y: drawY + r * BEAST_SCALE,
    w: wCells * BEAST_SCALE,
    h: hCells * BEAST_SCALE,
  });

  // Coming apart: the beast fades out as the wreck builds up, so one becomes the
  // other rather than one being swapped for it.
  const prev = ctx.globalAlpha;
  if (stripping) {
    drawCostumeWreck(ctx, cx, state.progress, flip);
    ctx.globalAlpha = prev * Math.max(0, 1 - state.progress * 1.15);
  }

  drawPixels(ctx, BEAST, BEAST_PALETTE, drawX, drawY, { scale: BEAST_SCALE, flip });

  // --- the costume ---------------------------------------------------------
  // One pair of glasses, and nothing else (owner call: no jacket and no tie).
  // `layers` counts the hits left: each one cracks the glass a little more, and the
  // last one washes the frame off the snout. A layer is still drawn while it is
  // dissolving, because the rules take the hit the instant the jet lands and the
  // picture needs half a second to show it.
  const dis = state.dissolve;
  const p = dis ? dis.progress : 0;
  const finalHit = dis?.layer === 1;
  if (state.layers > 0 || p > 0) {
    const slide = finalHit ? p : 0;
    const dx = (flip ? -1 : 1) * slide * 26;
    const dy = slide * 74;
    const at = (c: number, r: number, wc: number, hc: number) => {
      const rect = cellRect(c, r, wc, hc);
      return { ...rect, x: rect.x + dx, y: rect.y + dy };
    };
    const put = (color: string, c: number, r: number, wc: number, hc: number) => {
      const rect = at(c, r, wc, hc);
      pxRect(ctx, color, rect.x, rect.y, rect.w, rect.h, 2);
    };
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * (1 - slide * 0.7);
    /*
     * A brow bar, a bar under the eye, and the temple arm running back along the
     * cheek. The arm is what makes it a pair rather than a monocle; there is no
     * bridge, because the head is side-on and a bridge does not survive at any size
     * here.
     *
     * Sized to the EYE and not to the head, which took a correction: the first version
     * was 8 cells wide with its lower bar on the jaw row, so at scale 10 it rasterised
     * as an 80px band strapped across the whole muzzle — a welding mask, and it hid
     * the teeth as well as the eye it was supposed to sit over.
     */
    put(GLASS_FRAME, EYE_COL - 1, EYE_ROW - 1, 5, 1);
    put(GLASS_FRAME, EYE_COL - 1, EYE_ROW + 2, 5, 1);
    put(GLASS_FRAME, EYE_COL - 4, EYE_ROW + 1, 3, 1);
    // The lens is translucent and the amber eye reads *through* it. An opaque block
    // over the eye region rasterised as a visor once — a dragon in a gas mask — and
    // glasses have to sit on a face you can still see.
    put(LENS, EYE_COL, EYE_ROW, 3, 2);
    // Cracks accumulate with the damage already taken, so the glass tells the story
    // of the fight without a bar or a number anywhere on the screen.
    const cracks = Math.max(0, 4 - state.layers);
    for (let i = 0; i < cracks; i += 1) {
      put(LENS_CRACK, EYE_COL + i, EYE_ROW, 1, 2);
    }
    // Fogged and running: the water is on the glass before it is off the face.
    if (p > 0) {
      const lens = at(EYE_COL, EYE_ROW, 3, 2);
      pxRect(ctx, `rgba(233,246,250,${0.4 * (1 - p)})`, lens.x, lens.y, lens.w, lens.h, 2);
      for (let i = 0; i < 2; i += 1) {
        pxRect(
          ctx,
          `rgba(168,236,250,${0.65 * (1 - p * 0.5)})`,
          lens.x + 4 + i * 18,
          lens.y + lens.h,
          4,
          12 + p * 26,
          2,
        );
      }
    }
    ctx.globalAlpha = alpha;
  }

  ctx.globalAlpha = prev;

  // --- the roar ------------------------------------------------------------
  // The opening beat, and the one thing on this screen that is loud and harmless.
  // Concentric arcs off the jaw plus the word, so a player who has never seen a boss
  // knows something is about to happen and that it has not happened yet.
  if (state.phase === 'roar') {
    // The hazard's own jaw position, never a second guess at it.
    const m = {
      x: cx + (flip ? -1 : 1) * (box.w * MOUTH_X_FRACTION),
      y: box.y + box.h * MOUTH_Y_FRACTION,
    };
    const rings = reduced ? 2 : 1 + (Math.floor(t * 6) % 3);
    for (let r = 0; r < rings; r += 1) {
      const d = 26 + r * 24;
      const a = 0.5 - r * 0.13;
      for (let s = -3; s <= 3; s += 1) {
        pxRect(ctx, `rgba(255,242,208,${a})`, m.x + (flip ? -d : d), m.y + s * 13, 6, 9, 2);
      }
    }
    drawText(ctx, 'ROAR', m.x + (flip ? -110 : 46), m.y - 66, {
      scale: 3,
      color: FIRE_HOT,
      align: flip ? 'right' : 'left',
      outline: 'rgba(0,20,26,0.9)',
      alpha: 0.95,
    });
  }

  // --- name plate + costume pips -------------------------------------------
  // Both stop the moment it stops being the obstacle, exactly like the Workplace
  // figure's plate: a label on something that has been answered is noise.
  if (!stripping) {
    /*
     * Name and pips sit out to the SIDE of the body, not over it, which is forced by
     * where this beast lives.
     *
     * It stands at the far right of the frame, and the HUD's right-hand column (clock
     * and delay log, `ui/Hud.ts`) hangs over exactly that corner. A plate over its
     * head would sit behind DOM chrome the rasteriser cannot see — the archive-wall
     * trap, on the other side of the screen. Underneath was tried too and rasterised
     * into the scorch and the crag.
     *
     * 220px to the inside and level with its chest is open sky on the side it is
     * facing: clear of the chrome, clear of the animal, and on the side the player is
     * coming from.
     */
    const plateX = cx - 220;
    const plateY = box.y + 96;
    // A real plaque rather than outlined text: out here it is over open sky rather
    // than over the beast's own body, and bare pixel type on a busy backdrop is the
    // thing `drawLabelPlaque` exists to prevent.
    drawLabelPlaque(ctx, state.name, plateX, plateY, {
      scale: 2,
      fg: '#F2D6C4',
      bg: 'rgba(26,10,14,0.78)',
      frame: 'rgba(155,47,56,0.8)',
      alpha: 0.92,
    });
    // Hits left, in the world rather than in a HUD element — the same reason the
    // Workplace shows tape layers as pips over the figure.
    for (let i = 0; i < 4; i += 1) {
      pxRect(
        ctx,
        i < state.layers ? WATER_LIT : 'rgba(207,230,236,0.22)',
        plateX - 21 + i * 11,
        plateY + 18,
        8,
        5,
        2,
      );
    }
  }
}


// ---------------------------------------------------------------------------
// Fire
// ---------------------------------------------------------------------------

/**
 * The cone: the lane it warns with, then the straight growing jet it throws.
 *
 * There are no fireballs and no rolling fronts any more (owner call) — nothing on
 * this screen travels, so this one function is the whole hazard.
 *
 * Two rules it exists to keep:
 *
 *  1. **The tell is on the ground, along the whole lane.** Chunky cream dashes from
 *     the jaw out to the end of the reach, each with a dark scorch cell under it so
 *     it reads against the brick. Cream, not orange: the value orange on this
 *     screen's terracotta floor rasterised as a muddy brown smudge on a brown floor.
 *  2. **What is painted is what burns.** Every flame cell is drawn inside
 *     `fire.boxes`, which is exactly the geometry the simulation collides against
 *     (`Dragon.coneBoxes`). The old rolling fronts leaned their bright lip 8px
 *     *outside* the hitbox on the side the player met first, which is the
 *     hazard-sprite rule broken in the worst possible direction.
 *
 * The taunt is drawn at `fire.labelAt` — fixed for the whole burst, over the middle
 * of the lane, and it does not travel with the flame (owner call). The next burst
 * brings the next taunt.
 */
export function drawCone(
  ctx: CanvasRenderingContext2D,
  fire: FireState | null,
  t: number,
  reduced: boolean,
): void {
  if (!fire) return;
  const { mouth, target } = fire;
  const dir = target.x >= mouth.x ? 1 : -1;

  if (fire.phase === 'windup') {
    const p = fire.progress;
    /*
     * 1. The lane, and it is the most important thing on the frame for 0.65s.
     *
     * Dashes marching *away* from the jaw along the floor the fire is about to run
     * down, lighting up in order so the mark itself reads as travelling outwards —
     * the same direction the flame will grow. The first version of this drew 12px
     * cells at 0.18–0.4 alpha and rasterised as a faint smudge on a warm floor.
     * Cream at 0.55–0.9 over its own shadow is a mark; cream at 0.2 is dirt.
     */
    const from = Math.min(mouth.x, target.x);
    const to = Math.max(mouth.x, target.x);
    const cell = 32;
    for (let x = from; x < to; x += cell) {
      // Fraction along the lane, measured from the jaw outwards.
      const f = Math.abs((dir > 0 ? x - mouth.x : mouth.x - x) / Math.max(1, to - from));
      const lit = p >= f * 0.85;
      pxRect(ctx, 'rgba(30,10,6,0.55)', x, GROUND_TOP - 4, cell - 10, 12, 2);
      pxRect(
        ctx,
        lit ? `rgba(255,242,208,${0.9 - 0.3 * f})` : 'rgba(255,176,122,0.28)',
        x,
        GROUND_TOP - 12,
        cell - 10,
        10,
        2,
      );
      // A chevron over every other dash, pointing the way the fire will travel.
      if (lit && Math.round(x / cell) % 2 === 0) {
        pxRect(
          ctx,
          `rgba(255,84,0,${0.7 - 0.3 * f})`,
          x + (dir > 0 ? cell - 16 : 0),
          GROUND_TOP - 22,
          6,
          8,
          2,
        );
      }
    }
    // 2. The sight line: cells stepping from the jaw along the axis, so a player
    // watching their own feet still sees something arriving.
    const steps = 8;
    for (let i = 1; i <= steps; i += 1) {
      const f = i / steps;
      const x = mouth.x + (target.x - mouth.x) * f;
      const y = mouth.y + (target.y - mouth.y) * f;
      const lit = p * (steps + 1) >= i;
      const s = 10 + Math.round(f * 12);
      pxRect(
        ctx,
        lit ? `rgba(255,242,208,${0.55 + 0.35 * p})` : 'rgba(255,176,122,0.22)',
        x - s / 2,
        y - s / 2,
        s,
        s,
        2,
      );
    }
    // 3. The far end, bracketed: a bright bar closing inwards to the width the flame
    // will actually be when it gets there, so the reach is a promise rather than a
    // surprise.
    const inset = (1 - p) * 26;
    pxRect(ctx, 'rgba(30,10,6,0.6)', target.x - 44, GROUND_TOP - 6, 88, 14, 2);
    pxRect(
      ctx,
      `rgba(255,242,208,${0.6 + 0.4 * p})`,
      target.x - 40 + inset,
      GROUND_TOP - 14,
      80 - inset * 2,
      14,
      2,
    );
    for (const bx of [target.x - 46, target.x + 38] as const) {
      pxRect(ctx, `rgba(255,84,0,${0.5 + 0.5 * p})`, bx, GROUND_TOP - 28, 8, 28, 2);
    }
    // …and the throat charging, so the two ends of the attack are connected. A ring
    // of cells rather than one filled square: at 28×28 the square rasterised as a
    // brown box stuck to the dragon's face.
    for (let i = 0; i < 6; i += 1) {
      const ang = (i / 6) * Math.PI * 2 + p * 3;
      const rr = 8 + p * 8;
      pxRect(
        ctx,
        `rgba(255,84,0,${0.35 + 0.45 * p})`,
        mouth.x + Math.cos(ang) * rr - 4,
        mouth.y + Math.sin(ang) * rr - 4,
        8,
        8,
        4,
      );
    }
    pxRect(ctx, `rgba(255,242,208,${0.8 * p})`, mouth.x - 6, mouth.y - 6, 12, 12, 4);
    return;
  }

  // Burning. One box per cone segment — the hazard's own geometry, painted.
  //
  // Three courses per segment (deep shell, mid, cream core) with the core kept thin
  // and centred on the axis: a cream core as wide as the flame rasterised as a rocket
  // exhaust rather than as fire. The shell is inset by a stable per-segment bite so
  // the silhouette is ragged *inwards*, which says "flame" without promising a pixel
  // of reach the rules do not give.
  const boxes = fire.boxes;
  const q = fire.quenched;
  boxes.forEach((b, i) => {
    const bite = reduced ? 0.5 : 0.3 + 0.5 * hash2(i, 7 + (Math.floor(t * 12) % 2));
    const inset = Math.min(6, Math.round(b.h * 0.05 * bite));
    const y = b.y + inset;
    const h = Math.max(4, b.h - inset * 2);
    pxRect(ctx, FIRE_DEEP, b.x, y, b.w, h, 4);
    pxRect(ctx, FIRE_MID, b.x, y + h * 0.18, b.w, h * 0.64, 4);
    pxRect(ctx, i < 2 ? FIRE_HOT : FIRE_CORE, b.x, y + h * 0.38, b.w, Math.max(4, h * 0.24), 4);
  });
  // Where it hits the floor: uneven tongues licking up off the far end, which is what
  // separates "fire running along the ground" from "a bar of light ending". Kept
  // inside the last segment's own span.
  const last = boxes[boxes.length - 1];
  if (last) {
    for (let i = 0; i < 5; i += 1) {
      const n = hash2(Math.round(last.x / 8) + i, 43);
      const h = 14 + n * 26;
      pxRect(ctx, FIRE_DEEP, last.x + i * (last.w / 5), GROUND_TOP - h, 12, h, 4);
      pxRect(ctx, FIRE_MID, last.x + 2 + i * (last.w / 5), GROUND_TOP - h * 0.6, 7, h * 0.6, 4);
    }
  }
  // Steam where the water is winning, boiling off the top of the jet.
  //
  // Two staggered rows of varied cells, not one row of equal ones: the first version
  // was five identical 12×10 blocks on a single y and rasterised as a dashed line
  // ruled across the flame. Steam has to have a top and a bottom to be steam.
  if (q > 0.01) {
    for (let i = 0; i < 7; i += 1) {
      const n = hash2(i, 23);
      const f = i / 6;
      const s = 10 + Math.round(n * 12);
      const sx = mouth.x + (target.x - mouth.x) * f;
      const sy = mouth.y + (target.y - mouth.y) * f - 40 - Math.round(n * 26) - (i % 2) * 14;
      pxRect(ctx, `rgba(233,246,250,${0.5 + 0.4 * q * n})`, sx, sy, s, s, 4);
    }
  }

  // The reason for the fire, on a plaque over the middle of the lane. It is fixed
  // for the whole burst and it does not ride the flame (owner call) — a caption on
  // the lane, replaced by a different one on the next burst.
  drawLabelPlaque(ctx, fire.label, fire.labelAt.x, fire.labelAt.y, {
    scale: 2,
    fg: '#FFF2D0',
    bg: 'rgba(28,10,4,0.78)',
    frame: 'rgba(255,84,0,0.65)',
    alpha: 0.95,
  });
}

/**
 * The ground the dragon has already burnt.
 *
 * Painted over the level material rather than into it, because it is the *hazard's*
 * history: `scenery.ts` has no business knowing where a dragon has been standing.
 * The scorch is anchored to the roost, so it reads as this animal's own patch.
 */
export function drawScorchedGround(ctx: CanvasRenderingContext2D, roostX: number): void {
  // A charred field under the roost, densest at the middle, dithered out at the
  // edges in whole cells so it never reads as a soft gradient.
  const half = 300;
  for (let x = roostX - half; x < roostX + half; x += 8) {
    const f = 1 - Math.abs(x - roostX) / half;
    for (let y = GROUND_TOP; y < GROUND_TOP + 24; y += 8) {
      const n = hash2(Math.round(x / 8), Math.round(y / 8));
      if (n > 0.15 + f * 0.7) continue;
      pxRect(ctx, n < 0.25 ? '#180A08' : '#2A120C', x, y, 8, 8, 8);
    }
  }
}

/**
 * The floating brick the badge is delivered onto.
 *
 * Authored in `levels.json` as a solid with `role: "pedestal"` and drawn here rather
 * than as level material, because it is not part of the ground: it is a block
 * hanging in the air over the lane, and the drone puts the ANSR mark on top of it
 * (owner call — the badge used to land on the floor, where a player could walk into
 * it without ever leaving the ground).
 *
 * Every cell stays inside the authored rect, because the rect is the collision: a
 * block drawn wider than its solid promises a ledge that is not there. What is
 * *outside* it is only signposting — the shadow line under it and the four corner
 * studs are drawn on the edge, never past it.
 */
export function drawFloatingBrick(
  ctx: CanvasRenderingContext2D,
  rects: readonly { x: number; y: number; w: number; h: number }[],
  t: number,
  reduced: boolean,
): void {
  for (const r of rects) {
    // The block: warm stone in two values, coursed, with dark mortar. Deliberately
    // *cool* against this screen's terracotta ground so it reads as a placed object
    // rather than as a lump of the floor that happens to be in the air.
    pxRect(ctx, '#20343C', r.x, r.y, r.w, r.h, 2);
    const rows = 4;
    const rh = r.h / rows;
    for (let i = 0; i < rows; i += 1) {
      const y = r.y + i * rh;
      pxRect(ctx, i % 2 === 0 ? '#6E8894' : '#5A727C', r.x + 2, y + 2, r.w - 4, rh - 3, 2);
      // One mortar joint per course, offset every other row, which is what makes it
      // brick rather than a tile.
      pxRect(ctx, '#20343C', r.x + (i % 2 === 0 ? r.w / 2 - 1 : r.w / 4 - 1), y + 2, 3, rh - 3, 1);
    }
    // A lit top face, because the badge sits on it and the eye has to be told there
    // is something to land on.
    pxRect(ctx, '#A8C2CC', r.x + 2, r.y + 2, r.w - 4, 4, 2);
    // Four studs, in the delivery's own cyan: this block is ANSR's, like the drone.
    for (const [dx, dy] of [
      [3, 3],
      [r.w - 9, 3],
      [3, r.h - 9],
      [r.w - 9, r.h - 9],
    ] as const) {
      pxRect(ctx, WATER, r.x + dx, r.y + dy, 6, 6, 2);
    }
    // It floats, so it says so: a shadow on the ground under it, and two cells of
    // lift under its own base. Held still under reduced motion.
    const bob = reduced ? 0 : Math.round(Math.sin(t * 1.6) * 2);
    pxRect(ctx, 'rgba(0,14,20,0.35)', r.x + 6, GROUND_TOP - 4, r.w - 12, 4, 1);
    pxRect(ctx, `rgba(79,190,220,0.5)`, r.x + 8, r.y + r.h + 4 + bob, r.w - 16, 3, 1);
  }
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

/**
 * The cannon, authored 26×13 and drawn at scale 2 → a 52×26 tool.
 *
 * Bigger than the Workplace cutter (36×26) in the barrel and deliberately so — the
 * owner asked for a *big* water weapon, and it has to read as the thing that beats
 * a dragon from across the frame. Cyan, not orange: on this screen the value accent
 * is already spoken for by the fire, and a tool the same colour as the thing it
 * fights is a tool nobody can see working. This is the one place that rule bends,
 * and the reserved orange stays on the badge and the HUD chip instead.
 */
const CANNON: readonly string[] = [
  '...KKKKKK.................',
  '..KtTTTTtK................',
  '..KtTTTTtK................',
  '..KtTTTTtK.....KKKKKKKK...',
  '.KKKKKKKKKKKKKKbbbbbbbbKK.',
  '.KbbbbbbbbbbbKKcccccccCCKK',
  '.KbBBBBBBBBBbKKcCCCCCCoooK',
  '.KbBBBBBBBBBbKKcCCCCCCoooK',
  '.KbbbbbbbbbbbKKcccccccCCKK',
  '.KKKKgGgKKKKKKKbbbbbbbbKK.',
  '.....KgGgK.....KKKKKKKK...',
  '.....KgGgK................',
  '.....KKKKK................',
];

const CANNON_PALETTE: Palette = {
  K: '#10222A',
  b: '#33505C', // housing shade
  B: '#CFE6EC', // lit face
  t: WATER_DEEP, // the tank on top
  T: WATER,
  c: WATER_DEEP, // barrel
  C: WATER,
  o: WATER_LIT, // bore
  g: '#233A44', // grip
  G: '#3C5C69',
};

/**
 * Scale 2 → 52×26.
 *
 * It earns its width in the barrel and the tank rather than the housing, which is
 * how it stays a *weapon* instead of the plank scale 3 turned the Workplace cutter
 * into next to a 48-wide hero.
 */
const CANNON_SCALE = 2;

/**
 * The cannon in the player's hands.
 *
 * Drawn by the host *after* the hero so it reads as held. Unlike the cutter it is
 * aimed: the barrel tips towards the dragon, because a jet that leaves at a visible
 * angle and a jet that flies at an angle are the same object, and if they are not,
 * the weapon looks broken.
 */
export function drawWaterCannon(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  feetY: number,
  facing: -1 | 1,
  sinceShot: number,
  reduced: boolean,
): void {
  const flash = sinceShot < 0.1;
  const kick = sinceShot < 0.14 ? Math.round((1 - sinceShot / 0.14) * 7) : 0;
  const w = maxWidth(CANNON) * CANNON_SCALE;
  const y = feetY - 42;
  const x = facing === 1 ? centerX + 2 - kick : centerX - 2 - w + kick;
  const muzzleY = y + 6 * CANNON_SCALE;
  const muzzleX = facing === 1 ? x + w : x;

  drawPixels(ctx, CANNON, CANNON_PALETTE, x, y, { scale: CANNON_SCALE, flip: facing === -1 });

  if (flash) {
    // A burst of spray at the muzzle. Over inside a tenth of a second: a punch,
    // never a strobe.
    const f = 1 - sinceShot / 0.1;
    for (let i = 0; i < 3; i += 1) {
      const len = (10 + i * 8) * f;
      const th = 14 - i * 4;
      pxRect(
        ctx,
        i === 0 ? WATER_LIT : i === 1 ? WATER : 'rgba(79,190,220,0.5)',
        facing === 1 ? muzzleX : muzzleX - len,
        muzzleY + 2 - th / 2,
        len,
        th,
        2,
      );
    }
  } else if (!reduced) {
    // Charged and idle: two full-alpha cells at the bore. Few cells at full alpha
    // say "live"; many at low alpha say "rendering fault" (the badge halo lesson).
    pxRect(ctx, WATER, muzzleX - (facing === 1 ? 0 : 4), muzzleY + 2, 4, 4, 2);
    pxRect(ctx, WATER_LIT, muzzleX - (facing === 1 ? -2 : 6), muzzleY + 2, 2, 4, 2);
  }
}

/**
 * The jets: a bright head, a stream trailing back along the line of travel, and
 * droplets shaken off it.
 *
 * Drawn as a *stream* rather than as a projectile. A jet of water is the one hazard
 * answer in this game that should not look like a bullet — five cells stepping back
 * from the head, each a little smaller and dimmer, so what crosses the frame reads
 * as a continuous hose line even though the simulation only owns one box.
 */
export function drawWaterShots(ctx: CanvasRenderingContext2D, jets: WaterState[]): void {
  for (const j of jets) {
    const { box } = j;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    // The stream behind the head. Furthest and faintest first.
    for (let k = 5; k >= 1; k -= 1) {
      const d = k * 20;
      const s = 24 - k * 3;
      pxRect(
        ctx,
        k <= 2 ? WATER : `rgba(28,127,166,${0.62 - k * 0.06})`,
        cx - j.dx * d - s / 2,
        cy - j.dy * d - s / 2,
        s,
        s,
        2,
      );
    }
    // The head: the hitbox exactly, with a lit crown on the leading edge.
    pxRect(ctx, WATER, box.x, box.y, box.w, box.h, 2);
    pxRect(ctx, WATER_DEEP, box.x, box.y + box.h - 5, box.w, 5, 2);
    pxRect(ctx, WATER_LIT, cx - 10 + j.dx * 8, cy - 7, 20, 12, 2);
    // Droplets shaken off, offset across the line of travel.
    pxRect(ctx, 'rgba(168,236,250,0.75)', cx - j.dy * 20 - 4, cy + j.dx * 20 - 4, 9, 9, 2);
    pxRect(ctx, 'rgba(168,236,250,0.5)', cx + j.dy * 22 - 3, cy - j.dx * 22 - 3, 7, 7, 2);
    pxRect(ctx, 'rgba(79,190,220,0.5)', cx - j.dy * 34 - 3, cy + j.dx * 34 - 3, 6, 6, 2);
  }
}

/** Steam where water met fire — the receipt for the exchange. */
export function drawSteam(ctx: CanvasRenderingContext2D, puffs: SteamState[]): void {
  for (const s of puffs) {
    const p = s.progress;
    const a = (1 - p) * 0.75;
    const r = 10 + p * 26;
    for (let i = 0; i < 4; i += 1) {
      const ang = (i / 4) * Math.PI * 2 + p * 2;
      pxRect(
        ctx,
        `rgba(221,238,242,${a})`,
        s.x + Math.cos(ang) * r - 5,
        s.y + Math.sin(ang) * r - p * 22 - 5,
        10,
        10,
        4,
      );
    }
    pxRect(ctx, `rgba(255,255,255,${a * 0.8})`, s.x - 6, s.y - p * 18 - 6, 12, 12, 4);
  }
}

// ---------------------------------------------------------------------------
// The payoff
// ---------------------------------------------------------------------------

/**
 * The five candidates who were inside the costume, each stamped HIRED.
 *
 * This is the screen's whole ending and the reason the fight is not a kill: what
 * comes out of a hiring process that has been beaten is not a corpse, it is
 * people. They come out, they land, they cheer, and the word over them is the only
 * green-lit thing on a screen that has been orange the entire time.
 */
const CANDIDATE: readonly string[] = [
  '..KKKK..',
  '.KhhhhK.',
  '.KffffK.',
  '.KfeefK.',
  '.KffffK.',
  'KKTTTTKK',
  'KaTTTTaK',
  'KaTTTTaK',
  '.KTTTTK.',
  '.KllllK.',
  '.KllKlK.',
  '.KllKlK.',
  '.KooKoK.',
  '.KKKKKK.',
];

/**
 * Scale 4 → a 32×56 person, against the hero's drawn 48×60.
 *
 * At scale 3 they were 24×42 and rasterised as children standing next to him, which
 * is the same mistake the Workplace figure made at 34×52 — the ending only works if
 * what comes out of the costume reads as five colleagues.
 */
const CANDIDATE_SCALE = 4;

/** Four shirt colours, so five people are five people and not one clone × 5. */
const CANDIDATE_PALETTES: readonly Palette[] = [
  { K: '#10222A', h: '#2A1C14', f: '#D9A57A', e: '#22323A', T: '#E9F1F5', a: '#E9F1F5', l: '#26454F', o: '#161616' },
  { K: '#10222A', h: '#160F0A', f: '#A9714A', e: '#22323A', T: '#9FE6C4', a: '#9FE6C4', l: '#1E3A44', o: '#161616' },
  { K: '#10222A', h: '#3A2A16', f: '#E9BE94', e: '#22323A', T: '#A8ECFA', a: '#A8ECFA', l: '#26454F', o: '#161616' },
  { K: '#10222A', h: '#1E1410', f: '#C08A5E', e: '#22323A', T: '#CFE6EC', a: '#CFE6EC', l: '#173039', o: '#161616' },
];

export function drawHiredCandidates(
  ctx: CanvasRenderingContext2D,
  candidates: CandidateState[],
  t: number,
  reduced: boolean,
): void {
  const w = maxWidth(CANDIDATE) * CANDIDATE_SCALE;
  const h = CANDIDATE.length * CANDIDATE_SCALE;

  candidates.forEach((c, i) => {
    if (c.progress <= 0) return;
    const palette = CANDIDATE_PALETTES[i % CANDIDATE_PALETTES.length]!;
    // Landed: a two-frame celebration hop. On the way out: a stepped lean, quantised
    // because an 8-bit sprite does not rotate smoothly.
    const hop = c.landed && !reduced ? (Math.floor(t * 6 + i) % 2) * 6 : 0;
    const x = c.x - w / 2;
    const y = c.y - h - hop;

    if (!c.landed) {
      const lean = reduced ? 0 : Math.floor(c.progress * 8 + i) % 2 === 0 ? 4 : -4;
      drawPixels(ctx, CANDIDATE, palette, x + lean, y, { scale: CANDIDATE_SCALE, flip: i % 2 === 0 });
    } else {
      drawPixels(ctx, CANDIDATE, palette, x, y, { scale: CANDIDATE_SCALE });
      // Arms up. Two cells each side at the shoulder — the cheapest possible cheer,
      // and the only pose that reads at this size.
      pxRect(ctx, palette.T!, x - 6, y + 12 - hop, 8, 16, 2);
      pxRect(ctx, palette.T!, x + w - 2, y + 12 - hop, 8, 16, 2);
      pxRect(ctx, 'rgba(0,14,20,0.4)', x + 2, GROUND_TOP - 3, w - 4, 4, 1);
    }

    // The stamp. Green, and the only green-lit words on the screen.
    drawLabelPlaque(ctx, 'HIRED', c.x, y - 22, {
      scale: 1,
      fg: '#0B2A1E',
      bg: '#9FE6C4',
      frame: 'rgba(11,42,30,0.8)',
      alpha: Math.min(1, c.progress * 2),
    });
  });

  // Confetti over the line-up, once the first of them is down. Stable positions
  // (hash2) so it reads as thrown rather than as per-frame noise, and it stops
  // entirely under reduced motion.
  if (reduced || !candidates.some((c) => c.landed)) return;
  for (let i = 0; i < 24; i += 1) {
    const x = 120 + hash2(i, 91) * (W - 240);
    const drop = ((t * (60 + hash2(i, 7) * 80) + hash2(i, 13) * 600) % 520) + 60;
    const c = i % 3 === 0 ? '#9FE6C4' : i % 3 === 1 ? WATER_LIT : '#FFF2D0';
    pxRect(ctx, c, x, drop, 6, 6, 3);
  }
}
