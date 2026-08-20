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
  coneAxisY,
  coneHalfAt,
  type FireState,
  type CandidateState,
  type DragonState,
  type SteamState,
  type WaterState,
} from '../world/Hazards/Dragon';

const { TILE: T } = RESOLUTION;
/*
 * `const CONE = HAZARDS.DRAGON` used to be here, for `CONE_NEAR_H`/`CONE_FAR_H`: this
 * module painted the flame's band per column and worked its thickness out from the same two
 * constants the hazard did. Two copies of one profile is the `badgeFloat` defect waiting
 * for somebody to change one of them, and the pass that gave the flame a floor run and a
 * 3.4× taper would have been exactly that occasion. Both the axis and the half-thickness
 * now come from `coneAxisY`/`coneHalfAt` — the functions the hitbox itself is stepped from —
 * so this module has no opinion about the fire's shape at all, and no reason to read the
 * dragon's numbers.
 */
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
/** Every third belly course, so the plates read as plates rather than as one stripe. */
const BELLY_SHADE = '#C9B184';
/** Horns, teeth, claws, spines. */
const BONE = '#EFE4C8';
const BONE_DARK = '#BCAE8C';
const MAW = '#2E070B';
const EYE = '#FFC24D';

/*
 * `GLASS_FRAME`/`LENS`/`LENS_CRACK` used to be here — the costume, by the time it was one
 * pair of glasses. The owner removed them ("remove the spectacles from the Godzilla"), and
 * the three tones went with them from both places they were painted: the animal's face and
 * the trophy beside the fallen suit. `dragon.test.ts` names all three as colours that must
 * not reappear, which is the only form of "the beast wears nothing" that survives a rebuild.
 */

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
 * The Godzilla, authored as **one 46×38 grid** and drawn at scale 5 → 230×190.
 *
 * Rebuilt from the 30×24-at-scale-10 version the owner rejected ("the Godzilla is not
 * at all refined and looks like blocks of red colour — make it look like a real
 * Godzilla, just in 8-bit … also decrease the size"). Both halves of that note pull the
 * same way and the answer to both is **cells, not pixels**: the beast is *smaller* on
 * the frame (230×190 against 300×240) and made of **1,748 cells instead of 720**,
 * because 10px cells cannot describe an animal — at that size a leg is two cells wide
 * and every curve in the silhouette is a 10px stair, which is exactly what "blocks of
 * red colour" describes. This is the same lesson the sun and the clouds on screen 2
 * paid for: when something reads as too pixelated, count the steps in its outline
 * before reaching for a bigger cell.
 *
 * It still deliberately breaks the "a big creature is composed, not authored as one
 * grid" rule, for the reasons that rule already concedes: the creature **is** a
 * silhouette (no clothing to register against it), a row of the wrong width is caught
 * **mechanically** by a test that measures the grid, and one grid **mirrors for free**.
 * What made 1,748 cells affordable is that they are not hand-typed: the silhouette was
 * authored as per-row spans in a throwaway generator, which derives the outline, the
 * three-band shading, the belly plates, the dorsal plates and the hide bands
 * mechanically, and the **output** was pasted in here. Nothing generated ships.
 *
 * What the grid spends its cells on is the silhouette, which is what makes a shape read
 * as Godzilla rather than as a lizard — and four of these were fixed against a raster
 * that the code could not have shown:
 *  · **a deep, blocky skull** with a short muzzle, a heavy brow, a two-cell amber eye
 *    and teeth on both lips. The first three cuts drew a long snout and every one of
 *    them rasterised as a crocodile or a raptor;
 *  · **a short thick neck, set back and narrower than both the skull and the
 *    shoulders** — the narrowing that stops the head merging into the chest;
 *  · **an upright stance** on two thick legs with the room showing through between
 *    them, and feet with lit top planes and claws;
 *  · **four big dorsal plates** (`f`, base row `c`), narrow at the top and widest at
 *    the base, with a clear row of air between each pair. Wider or taller and they
 *    merge into one pale mass along the spine, which reads as fur;
 *  · **a heavy tail** that lies FLAT along the floor for its last third. Tapered all
 *    the way to a point down a straight diagonal it read as a blade;
 *  · **hide bands** — runs of three darker cells with gaps of three on every fourth
 *    row. Single darker cells on a grid rasterise as polka dots, which is a costume.
 *
 * `B`/`b` are the belly plates, `H` the lit planes, `S` the shade, `A`/`p` the eye,
 * `m`/`h` the maw and its teeth, `c` claws and plate bases. There are **no horns and no
 * wings** — both were on the dragon this replaced, and both are exactly what said
 * "this animal is not a Godzilla".
 */
const BEAST: readonly string[] = [
  '............................KKKKKKKK..........',
  '...........................KSSSHHHHHKK........',
  '..........................KSSSsssHHHHHHH......',
  '..........................KSSSsssSSAApHHK.....',
  '..........................KSSSssssspAHHKK.....',
  '..........................KSSSssmhmhmhmhm.....',
  '...........................KSSSsssshHHhK......',
  '............................KSSssssKKK........',
  '..........................KKHsssHHK...........',
  '..................Kf....KKHHsssssHHK..........',
  '.................Kff..KKHHSsssHHHHHHHK........',
  '.................Kff.KHHSSSsssSSSsHBBBK.......',
  '................KcccKHSSSSsssssssssbSSSK......',
  '....................KSSSSSsssssssssBBBBHKK....',
  '.................KfKHSSSSsssssssssHBBBBKKsKK..',
  '................KffKSSSSSssSSSsssSsbbbK..Kssc.',
  '...............KfffKSSSSSsssssssssHBBBK...KKc.',
  '..............Kffff.KSSSSssssssssHBBBK........',
  '.............Kcfccc.KSSSSsssssssHHbbK.........',
  '...............cKK..KSSSSSSsssSSsHBBK.........',
  '...............cKc..KSSSSsssssssHBBK..........',
  '...............Kcc..KSSSSsssssssHHbbK.........',
  '............c.Kccc.KHSSSSssssssssHBBBK........',
  '............cKccccKHSSSSsssSSSsssssBBBK.......',
  '............KcccccHSSSSSsssssssssHHbbbK.......',
  '...........KHHssssKSSSSSsssssssssHBBBK........',
  '.........c.KHsssSKcKSSSSSssssssssHBBBK........',
  '.........cKHSSSSKcc.KSSSSSSKKsSSsHHHK.........',
  '.........KHsssSKccc.KSSSSsK..KssHHHHK.........',
  '........KHssSSSKKK..KSSSSsK..KssHHHHK.........',
  '........KssSSSK......KSSSSK..KsssHHHK.........',
  '......cKsSSSKK.......KSSSSK...KsssssK.........',
  '...c..KHssSK.........KSSSsK...KsHHHK..........',
  '...KKKHssSK...........KSSSK...KsHHHK..........',
  '...KsssSSK............KSSSK...KsHHHK..........',
  '...KssSKK.............KSSSK...KSSHHHK.........',
  '...KKKK..............HHHKHH...HHHHHHHK........',
  '..................ccKKKKKKK...KKKKKKKKccc.....',
];

const BEAST_PALETTE: Palette = {
  K: OUTLINE,
  s: SCALE,
  S: SCALE_DARK,
  H: SCALE_LIT,
  B: BELLY,
  b: BELLY_SHADE,
  f: BONE,
  A: EYE,
  p: '#140806',
  m: MAW,
  h: BONE,
  c: BONE_DARK,
};

/**
 * Scale 5 — half the cell the rejected version used, and the whole reason this one
 * reads.
 *
 * 10px cells made a *bead* picture: a 200px animal has 20 beads across it, so a leg is
 * two cells, a jaw is one, and every diagonal is a 10px stair. That is what the owner
 * saw as "blocks of red colour". At 5px the same animal is 46 cells across, which is
 * where a muzzle, a brow, a plated belly and four dorsal plates can all exist at once —
 * and it is still twice the maze monster's cell, so the beast stays chunkier than
 * anything else on the frame.
 */
const BEAST_SCALE = 5;
const BEAST_COLS = maxWidth(BEAST);
export const BEAST_W = BEAST_COLS * BEAST_SCALE;
export const BEAST_H = BEAST.length * BEAST_SCALE;

/**
 * Where the grid is pinned inside the body box.
 *
 * The box is 200×190 (`HAZARDS.DRAGON.BODY_W/H`) and the grid is 230×190, so it is
 * centred with 15px hanging out of each side: the tail's tip at the back, the muzzle and
 * the forelimb's claws at the front. The legs and torso sit inside the box, which is
 * what a water jet has to hit. The bottom row lands on the ground band, which is what
 * "two feet on the ground" is, measured.
 */
const BEAST_OFFSET_X = -15;
const BEAST_OFFSET_Y = 0;

/**
 * The jaw, in grid cells: where the mouth line is, where it hinges and where it ends.
 *
 * Read off the drawn grid, like `MOUTH_*_FRACTION` in the hazard — the mouth row is the
 * one carrying the `mhmhmh` teeth and the muzzle tip is its last column. Nothing here may
 * be guessed: an opening jaw that hinges in the wrong column is a head coming apart.
 *
 * The eye's cell (`EYE_COL`/`EYE_ROW`) used to live here too, because a pair of glasses had
 * to be registered to it. The owner removed the glasses, and the eye is now just part of
 * the grid like every other feature.
 */
const JAW_ROW = 5;
const JAW_HINGE_COL = 30;
const JAW_TIP_COL = 40;
/** Cells the muzzle end of the jaw drops when the mouth is fully open. */
const JAW_MAX_CELLS = 5;

/**
 * The costume, **lying on the floor with one side unzipped** — 52×13 at scale 5 → 260×65.
 *
 * This is the owner's ending, and it replaces a heap of spectacle frames: "the Godzilla
 * for the dying effect dies on the ground and on one side the Godzilla's costume opens up
 * and from there the 5 candidates come out one by one saying HIRED, and the costume after
 * some time vanishes." So what the fight leaves behind is not wreckage, it is a **suit**:
 * something five people were plainly inside, with a way out of it.
 *
 * The silhouette is a slumped profile interpolated between control points — the skull
 * lying on its cheek with the jaw open at one end, the shoulders still holding their
 * shape, the hips, then the tail trailing away. Authored as flat runs it rasterised as a
 * row of boxes with vertical cliffs between them, which is the same "count the steps in
 * the outline" lesson the clouds taught.
 *
 * `i` is the dark inside of the suit, `z`/`Z` the zip. Those cells are painted **only as
 * far as the zip has run** (`openness`), which is what makes the opening an event rather
 * than a state: before it, the same columns are the suit's own body, so it lies there
 * intact for a beat first.
 */
const COSTUME: readonly string[] = [
  '....................................................',
  '.......................cf...........................',
  '.................cf.KKKKKKKKcf......................',
  '......KK..........KKsZzZzZzZzKKKKcf.................',
  '....KKHHKK......KKssBiiiiiiiiZzZHKKK................',
  '....sHppssK..cfKsssssiiiiiiiiiiiBHHHKKcf............',
  '...KspsssssKK.KssssssiiiiiiiiiiisSSSssKKK...........',
  '..KssssssssssKsssssssiiiiiiiiiiisssssssssKK.........',
  '..ssssSSssssssssssSSSiiiiiiiiiiiSssssssssssKK.......',
  '.KssSSSSSSSssssSSSSSSiiiiiiiiiiiSSSSSSsssssssKK.....',
  'KsSSSSSSSSSSSSSSSSSSSiiiiiiiiiiiSSSSSSSSSSSssssKKK..',
  'KhmhmhmhSSSSSSSSSSSSSiiiiiiiiiiiSSSSSSSSSSSSSSSsssKK',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
];

const COSTUME_SCALE = 5;
/** Where the zip runs, in grid columns: the opening the five come out of. */
const COSTUME_OPEN_FROM = 21;
const COSTUME_OPEN_TO = 31;

const COSTUME_PALETTE: Palette = {
  K: OUTLINE,
  s: SCALE,
  S: SCALE_DARK,
  H: SCALE_LIT,
  B: BELLY,
  f: BONE,
  c: BONE_DARK,
  p: '#140806',
  m: MAW,
  h: BONE,
  i: '#180509',
  z: BONE_DARK,
  Z: BONE,
};

/**
 * The empty suit on the floor, its zip run back as far as `openness`, fading out at
 * `fade`.
 *
 * Three things it has to say, in this order: something *died* here (it is the animal's own
 * hide, lying in the puddle the water cannon left), somebody was *inside* it (the dark
 * interior, and the zip), and it is *over* (it goes). The frame's own timing lives in the
 * hazard — this only paints what it is told.
 */
function drawFallenCostume(
  ctx: CanvasRenderingContext2D,
  cx: number,
  flip: boolean,
  openness: number,
  fade: number,
): void {
  const prev = ctx.globalAlpha;
  const alpha = Math.max(0, 1 - fade);
  if (alpha <= 0) return;
  ctx.globalAlpha = prev * alpha;

  const w = maxWidth(COSTUME) * COSTUME_SCALE;
  const h = COSTUME.length * COSTUME_SCALE;
  const x0 = Math.round(cx - w / 2);
  const y0 = GROUND_TOP - h;

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

  const cols = maxWidth(COSTUME);
  // Exclusive: at `openness` 0 not one cell of the inside shows, or the suit arrives already
  // open and the opening stops being an event.
  const openTo =
    COSTUME_OPEN_FROM - 1 + (COSTUME_OPEN_TO - COSTUME_OPEN_FROM + 1) * openness;
  for (let r = 0; r < COSTUME.length; r += 1) {
    const row = COSTUME[r]!;
    for (let c = 0; c < row.length; c += 1) {
      let ch = row[c]!;
      if (ch === '.' || ch === ' ') continue;
      const isOpening = ch === 'i' || ch === 'z' || ch === 'Z';
      if (isOpening && c > openTo) {
        // Not unzipped this far yet: the suit is still itself here.
        ch = r < 4 ? 's' : 'S';
      }
      const color = COSTUME_PALETTE[ch];
      if (!color) continue;
      const dx = flip ? cols - 1 - c : c;
      pxRect(ctx, color, x0 + dx * COSTUME_SCALE, y0 + r * COSTUME_SCALE, COSTUME_SCALE, COSTUME_SCALE, 1);
    }
  }

  /*
   * **The glasses that used to lie beside the suit are gone too** (owner call: "remove the
   * spectacles from the Godzilla"). They were the trophy — cracked, off the snout, with two
   * drips still coming off them — and a trophy for an object the player never saw on the
   * animal is a prop nobody can read.
   *
   * What is left in their place is the puddle and the empty suit, which is the whole story:
   * water won, and five people were inside it. The **hose** is what beat it, so a couple of
   * cells of standing water is the right souvenir, and the wet patch above already carries
   * them.
   */
  const dir = flip ? -1 : 1;
  // A last few drips running off the suit's own edge. Few cells at full alpha — the halo
  // lesson — and on the suit rather than beside it, so they belong to something.
  pxRect(ctx, WATER_LIT, cx + dir * (w / 2 - 30), GROUND_TOP - 18, 3, 10, 1);
  pxRect(ctx, WATER, cx + dir * (w / 2 - 58), GROUND_TOP - 14, 3, 7, 1);

  ctx.globalAlpha = prev;
}

/**
 * The beast **going down**: the standing grid sheared over and sunk into the floor.
 *
 * Drawn cell by cell rather than through `drawPixels` because a topple is a shear, and a
 * shear is the cheapest honest way to show a 190px animal falling without authoring a
 * second animation. Each row is offset sideways in proportion to its height off the floor
 * and the whole thing squashes down, so the head travels furthest and the feet stay put —
 * which is what falling looks like. It leans **away from the player** (the side it is
 * facing is where the five will walk out).
 */
function drawTopplingBeast(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  flip: boolean,
  p: number,
): void {
  const rows = BEAST.length;
  const cols = BEAST_COLS;
  const dir = flip ? 1 : -1;
  const lean = p * p * 150;
  const sink = p * 26;
  const squash = 1 - p * 0.42;
  for (let r = 0; r < rows; r += 1) {
    const row = BEAST[r]!;
    const height = (rows - 1 - r) / (rows - 1);
    const shear = dir * lean * height;
    const y = y0 + sink + r * BEAST_SCALE * squash;
    for (let c = 0; c < row.length; c += 1) {
      const ch = row[c]!;
      if (ch === '.' || ch === ' ') continue;
      const color = BEAST_PALETTE[ch];
      if (!color) continue;
      const dx = flip ? cols - 1 - c : c;
      pxRect(
        ctx,
        color,
        x0 + dx * BEAST_SCALE + shear,
        y,
        BEAST_SCALE,
        Math.max(2, BEAST_SCALE * squash + 1),
        1,
      );
    }
  }
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

  /*
   * Beaten: there is no beast standing any more (owner call). What is on the floor is the
   * **costume it was**, unzipped down one side, and it goes when the last hire is out —
   * `state.costume` carries both dials and null once it has gone. The people who came out
   * of it are `drawHiredCandidates`.
   */
  if (state.phase === 'beaten') {
    const c = state.costume;
    if (c) drawFallenCostume(ctx, cx, flip, c.openness, c.fade);
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

  /*
   * Going down (owner call: "it dies on the ground"). The last frames of the fight are a
   * **topple**, not a fade: the standing grid shears over and sinks, the empty suit builds
   * up underneath it, and one becomes the other. A creature that dissolved on the spot
   * left nothing that could then be *opened*, which is the whole ending.
   */
  const prev = ctx.globalAlpha;
  if (stripping) {
    const p = state.progress;
    drawFallenCostume(ctx, cx, flip, 0, Math.max(0, 1 - p * 1.6));
    ctx.globalAlpha = prev * Math.max(0, 1 - Math.max(0, p - 0.55) * 2.2);
    drawTopplingBeast(ctx, drawX, drawY, flip, p);
    ctx.globalAlpha = prev;
    return;
  }

  drawPixels(ctx, BEAST, BEAST_PALETTE, drawX, drawY, { scale: BEAST_SCALE, flip });

  /*
   * --- the open jaw ---------------------------------------------------------
   *
   * Owner call: "while throwing the flame the Godzilla doesn't open its mouth — make it
   * open it." So the mouth is a **wedge cut into the head**, hinged at the back of the jaw
   * and swinging down at the muzzle, and it is drawn in *cell* coordinates so it mirrors
   * with the grid exactly like the rest of the animal.
   *
   * It is a hole rather than a sprite: dark maw, one course of teeth along the upper lip
   * and one along the dropped lower jaw, and a hot throat at the hinge once the fire is
   * lit. A separate open-mouthed head grid was the alternative and it is the wrong trade —
   * two 4,700-cell heads that have to stay in agreement, to say something one wedge says.
   *
   * `jawOpen` also carries the whole wind-up telegraph now that the floor marks are gone
   * (see `drawCone`), which is why it is ramped rather than switched: the jaw parting *is*
   * the warning.
   */
  if (state.jawOpen > 0.02) {
    const open = Math.min(1, state.jawOpen);
    const hot = state.phase === 'burning' || state.phase === 'charging';
    for (let c = JAW_HINGE_COL; c <= JAW_TIP_COL; c += 1) {
      // The wedge: nothing at the hinge, deepest at the muzzle, so the jaw rotates.
      const along = (c - JAW_HINGE_COL) / Math.max(1, JAW_TIP_COL - JAW_HINGE_COL);
      const depth = Math.round(open * JAW_MAX_CELLS * along);
      if (depth <= 0) continue;
      const top = cellRect(c, JAW_ROW, 1, depth);
      pxRect(ctx, MAW, top.x, top.y, top.w, top.h, 2);
      // The throat, lit from inside while it is charging or burning: light in a mouth is
      // what makes an open mouth read as an open mouth rather than as a bite taken out
      // of the head.
      if (hot && depth > 1) {
        const glow = cellRect(c, JAW_ROW, 1, Math.max(1, depth - 1));
        pxRect(
          ctx,
          along < 0.4 ? FIRE_CORE : along < 0.75 ? FIRE_MID : FIRE_DEEP,
          glow.x,
          glow.y,
          glow.w,
          Math.max(BEAST_SCALE, glow.h * 0.55),
          2,
        );
      }
      // Teeth: one cell on the upper lip and one on the lower, every other column, so the
      // jaw has a bite rather than two smooth edges.
      if (c % 2 === 0) {
        const upper = cellRect(c, JAW_ROW, 1, 1);
        pxRect(ctx, BONE, upper.x, upper.y, upper.w, upper.h, 2);
      }
      const lower = cellRect(c, JAW_ROW + depth, 1, 1);
      pxRect(ctx, c % 2 === 0 ? BONE : BONE_DARK, lower.x, lower.y, lower.w, lower.h, 2);
    }
  }

  /*
   * **There is no costume on the animal at all any more** (owner call: "remove the
   * spectacles from the Godzilla").
   *
   * What was here: a brow bar, a rim, a temple arm and a translucent lens over the eye,
   * cracking once per hit and sliding off the snout on the fourth. It went through three
   * corrections of its own (a welding mask, then a blindfold, then a bar that landed on the
   * mouth line) and it was also the screen's **health bar** — the state of the glass was
   * how you knew how the fight was going.
   *
   * So this deletion and "add a better, more visible life readout" are the same note, and
   * the readout below is what replaced it. The `layers`/`dissolve` mechanics are untouched:
   * `dissolve` now paints as **water on the hide** (below), which is the honest picture for
   * a beast that is being hosed rather than one whose glasses are running.
   */
  const dis = state.dissolve;
  const p = dis ? dis.progress : 0;
  if (p > 0) {
    // A hit playing out: the water is on it. A soaked, lit patch where the jet landed,
    // running down the body and thinning as it goes — drawn over the hide, so the animal
    // stays the animal.
    const runX = flip ? box.x + 30 : box.x + box.w - 74;
    pxRect(ctx, `rgba(168,236,250,${0.5 * (1 - p * 0.6)})`, runX, dis!.hitY - 12, 44, 24, 4);
    for (let i = 0; i < 3; i += 1) {
      const n = hash2(i, 53);
      pxRect(
        ctx,
        `rgba(79,190,220,${0.6 * (1 - p)})`,
        runX + 6 + i * 14,
        dis!.hitY + 10,
        6,
        18 + p * (40 + n * 30),
        4,
      );
    }
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
     * 200px to the inside and **low, just above the floor**, is the one window that is
     * clear of everything: clear of the chrome, clear of the animal, on the side the
     * player is coming from — and *under* the fire. Level with the chest (where it used to
     * sit) was clear of all three until the beast shrank and the cone narrowed, and then
     * the flame ran straight through the plaque: the jet leaves a 190px animal's jaw and
     * crosses exactly the band a chest-height label lives in. Below the lane there is
     * 90px of unlit floor that nothing else uses.
     */
    const plateX = cx - 200;
    const plateY = GROUND_TOP - 72;
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
    /*
     * **The health readout: a real bar** (owner call: "remove the life visibility of the
     * Godzilla and add a better one, a more visible one").
     *
     * What it replaces is two things, and they went together. The visible one was four
     * 8×5 pips under the name plate — 32px of lit cells on a 1280px frame, next to a
     * 200px animal, which is not a readout so much as a rumour. The *other* one was the
     * glasses themselves: their cracks were the real health bar, and the same note deleted
     * them, so this has to carry the whole job on its own.
     *
     * Four decisions, all of them measured against the ones the game already made:
     *
     *  · **Under the name plate**, in the one window on this screen proven clear of the
     *    HUD's right-hand column, of the animal, and of the fire lane (see the plate's own
     *    note). 28px of floor below it, which is why it goes under rather than over.
     *  · **192px wide**, i.e. six times the pips, and the same width as the beast is tall.
     *  · **It does not change width as it empties** — the frame and the empty cells stay,
     *    which is the rule the HUD's lives plaque paid for: a readout that shrinks is a
     *    readout that moves.
     *  · **Cyan, filling from the left, with a dark keyline and a lit top rail.** Cyan
     *    because on this screen it is *water* that takes the beast down, so the bar is the
     *    same colour as the answer — and orange on this screen means fire.
     */
    const barW = 192;
    const barH = 18;
    const barX = plateX - barW / 2;
    const barY = plateY + 30;
    pxRect(ctx, 'rgba(10,20,26,0.85)', barX - 3, barY - 3, barW + 6, barH + 6, 1);
    pxRect(ctx, 'rgba(26,10,14,0.9)', barX, barY, barW, barH, 1);
    const seg = (barW - 5 * 3) / 4;
    for (let i = 0; i < 4; i += 1) {
      const sx = barX + 3 + i * (seg + 3);
      const held = i < state.layers;
      pxRect(ctx, held ? WATER_DEEP : 'rgba(90,110,120,0.28)', sx, barY + 3, seg, barH - 6, 1);
      if (held) {
        pxRect(ctx, WATER, sx, barY + 3, seg, barH - 9, 1);
        // One lit rail along the top of each held segment: the difference between a bar
        // that is a strip of colour and a bar that reads as a gauge.
        pxRect(ctx, WATER_LIT, sx, barY + 3, seg, 3, 1);
      }
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
     * **The floor lane and the sight line are GONE** (owner call: "there are dashed lines,
     * one on the floor till where the flame will come and one in the path of the flame —
     * those don't look nice, remove them, only keep the flame").
     *
     * What was there: 32px cream dashes marching out along the floor with orange chevrons
     * over every other one, eight stepping cells down the axis, and a bracketed bar at the
     * far end. All three were built to answer the rule that every hazard telegraphs where
     * the player is looking, and all three of them are dashed lines drawn across the
     * picture. They went in one note.
     *
     * **So the telegraph moved onto the animal, and it had to grow to carry it.** This is
     * the one place in the game where a tell was deleted rather than moved, and the reason
     * it is still fair is that the beast is a 200×190 object in plain view doing three
     * visible things for the whole 0.65s:
     *
     *  · its **jaw opens** (`DragonState.jawOpen`, ramped over the wind-up — owner call in
     *    the same pass, and the two notes turn out to be one change);
     *  · the **throat charges**, a ring of cells tightening at the mouth;
     *  · **embers fall out of the open mouth**, which is new here and is what gives the
     *    tell a vertical extent — a glow inside a head is 30px of change on a busy
     *    backdrop, and something dropping out of that head is legible at the far end of
     *    the frame.
     *
     * The rhythm is untouched: `BURST_WINDUP` is still 0.65s and the burst still commits
     * its lane at the start of it, so a player who has read one cycle knows the floor in
     * front of the beast is about to be on fire. What they no longer get is a diagram of
     * exactly how far.
     */
    for (let i = 0; i < 6; i += 1) {
      const ang = (i / 6) * Math.PI * 2 + p * 3;
      const rr = 14 - p * 6; // tightening, not spreading: it is drawing breath
      pxRect(
        ctx,
        `rgba(255,84,0,${0.35 + 0.5 * p})`,
        mouth.x + Math.cos(ang) * rr - 4,
        mouth.y + Math.sin(ang) * rr - 4,
        8,
        8,
        4,
      );
    }
    pxRect(ctx, `rgba(255,242,208,${0.85 * p})`, mouth.x - 8, mouth.y - 8, 16, 16, 4);
    // Embers falling out of the open jaw. Stable positions (`hash2`), whole cells, and
    // they only start once the mouth is properly open — before that there is nowhere for
    // them to come from.
    if (p > 0.35) {
      const drip = (p - 0.35) / 0.65;
      for (let i = 0; i < 5; i += 1) {
        const n = hash2(i, 17 + (reduced ? 0 : Math.floor(t * 8) % 4));
        const fall = ((n + drip) % 1) * 70;
        pxRect(
          ctx,
          fall < 34 ? FIRE_HOT : FIRE_DEEP,
          mouth.x + dir * (4 + n * 18),
          mouth.y + 8 + fall,
          6,
          6,
          2,
        );
      }
    }
    return;
  }

  /*
   * Burning, painted **column by column inside the hazard's own boxes**.
   *
   * The version this replaces drew three stacked rectangles per segment, which is eight
   * flat bars in three colours: at 190px deep that was a wide orange girder lying across
   * the screen, and it is half of what the owner meant by "the fire it throws is too bad"
   * (the other half was the width, and that is `CONE_NEAR_H`/`CONE_FAR_H`).
   *
   * What reads as fire is a **profile**: a 4px cell grid where every column has its own
   * top and bottom, pinched in by a stable per-column bite so both edges are ragged, with
   * three courses inside it (deep shell, mid body, thin cream core on the axis). Same
   * technique as the clouds on screen 2 — a height per column rather than a few big
   * rectangles — and the same reason: what reads as 8-bit is the cell size plus the
   * silhouette, and a shape with no steps in its outline has no silhouette.
   *
   * The bite is keyed to the column's own x (not to a clock) so the flame does not crawl,
   * and to one of two frames of flicker so it lives. Everything stays inside the box: the
   * cells are clamped to it, which is what keeps "what is painted" and "what burns" the
   * same geometry.
   */
  const boxes = fire.boxes;
  const q = fire.quenched;
  const cell = 4;
  const frame = reduced ? 0 : Math.floor(t * 14) % 3;
  if (boxes.length > 0) {
    const from = Math.min(...boxes.map((b) => b.x));
    const to = Math.max(...boxes.map((b) => b.x + b.w));
    const axis = target.x - mouth.x;
    for (let x = from; x < to; x += cell) {
      /*
       * The flame's own band at this column, from the SAME numbers `Dragon.coneBoxes`
       * steps — not from the box it happens to fall in. That distinction is the whole
       * fix: a box is an AABB over a whole segment, so painting box-height columns
       * rasterised as eight rectangular blocks with hard steps between them, i.e. an
       * orange girder. The true band is a subset of its box, so this is still strictly
       * inside the hitbox — it just paints the cone instead of the cone's bounding boxes.
       */
      const f = Math.max(0, Math.min(1, (x + cell / 2 - mouth.x) / (axis === 0 ? 1 : axis)));
      /*
       * The axis and the half-thickness both come from the **hazard's own functions**
       * (`coneAxisY`, `coneHalfAt`) rather than from a lerp written out again here. They
       * were inlined until the pass that gave the flame a touchdown and a 3.4× taper, and
       * two copies of a hazard's profile is the `badgeFloat` defect with a different
       * costume: the picture and the hitbox drift and nobody notices until a player is
       * burnt by empty floor.
       */
      const ay = coneAxisY(mouth, target, f);
      // …tapered over the last few columns, so the jet has a NOSE. Cut off square at
      // full thickness it read as a length of pipe rather than as the end of a flame.
      const nose = f > 0.93 ? 1 - ((f - 0.93) / 0.07) * 0.6 : 1;
      const half = nose * coneHalfAt(f);
      const k = Math.round(x / cell);
      const n = reduced ? 0.5 : hash2(k, 11 + frame);
      const n2 = reduced ? 0.5 : hash2(k, 29 + frame);
      // Both edges bite INWARDS, never outwards: a lip outside the hitbox is fire that
      // cannot hurt anybody, which is the hazard-sprite rule broken the wrong way.
      const top = ay - half + Math.round((2 + n * 14) / cell) * cell;
      const bottom = Math.min(GROUND_TOP, ay + half) - Math.round((1 + n2 * 10) / cell) * cell;
      const h = Math.max(cell, bottom - top);
      const w = Math.min(cell, to - x);
      const near = f < 0.25;
      pxRect(ctx, FIRE_DEEP, x, top, w, h, cell);
      // The body of the flame, inset from its own shell.
      const inner = Math.max(cell, h * 0.6);
      pxRect(ctx, FIRE_MID, x, top + (h - inner) / 2, w, inner, cell);
      // The core: thin, on the axis, and hottest near the jaw. A core as wide as the
      // flame rasterised as a rocket exhaust.
      const core = Math.max(cell, h * (near ? 0.32 : 0.2));
      pxRect(ctx, near ? FIRE_HOT : FIRE_CORE, x, top + (h - core) / 2, w, core, cell);
    }
  }
  // The root, at the jaw: two cells at full value where the jet leaves the mouth, so the
  // fire is visibly coming out of the animal rather than starting in the air near it.
  if (boxes.length > 0) {
    // Kept on the fire's own side of the jaw, because the first segment starts AT the
    // mouth: a root centred on it hangs half its width outside the hitbox, which is the
    // rule this whole function exists to keep.
    const rx = dir > 0 ? mouth.x + 2 : mouth.x - 18;
    pxRect(ctx, FIRE_HOT, rx, mouth.y - 14, 16, 28, 4);
    pxRect(ctx, FIRE_CORE, rx, mouth.y - 6, 16, 12, 4);
  }
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

  /*
   * The reason for the fire, **written on the fire** (owner call: "the text that depicts
   * what this flame represents should be an overlay on top of the flame itself, in the same
   * angle the flame is in, and it should be present on the flame; it should not come
   * forward with the flame — while the flame is there it is there too").
   *
   * Four things that sentence asks for, and each one is a line here:
   *
   *  · **on the flame** — `labelAt` is a point on the axis at `LABEL_F`, not a clearance
   *    above the whole shape. The plaque is gone with it: a framed dark plate over burning
   *    fire is a sign in front of the fire, which is the picture being replaced.
   *  · **at the flame's angle** — `ctx.rotate(fire.labelAngle)`, the axis's own descent,
   *    computed once in the hazard so the words cannot disagree with the shape.
   *  · **it does not come forward** — the point is committed when the burst commits, so the
   *    flame grows *through* the words rather than pushing them along.
   *  · **it is there as long as the flame is** — this is inside the burning branch, and the
   *    wind-up returns before it.
   *
   * Legibility is a keyline rather than a background: near-black type would vanish into the
   * deep shell and cream type alone would vanish into the core, so it is cream with a dark
   * outline, which reads on all three courses of the fire.
   */
  ctx.save();
  ctx.translate(fire.labelAt.x, fire.labelAt.y);
  ctx.rotate(fire.labelAngle);
  drawText(ctx, fire.label, 0, -7, {
    scale: 2,
    color: '#FFF6E2',
    align: 'center',
    outline: 'rgba(26,6,2,0.95)',
    alpha: 0.98,
  });
  ctx.restore();
}

/**
 * The ground the dragon has already burnt.
 *
 * Painted over the level material rather than into it, because it is the *hazard's*
 * history: `scenery.ts` has no business knowing where a dragon has been standing.
 * The scorch is anchored to the roost, so it reads as this animal's own patch.
 */
export function drawScorchedGround(
  ctx: CanvasRenderingContext2D,
  roostX: number,
  /**
   * 0..1 — how far the screen has come good since the beast was beaten (`Dragon.relief`).
   *
   * The scorch **recedes** as the light comes up and grass comes through it, because "the
   * environment turns all bright and happy" (owner call) cannot be true with a burnt patch
   * still sitting under the line-up. Recedes rather than vanishes: something did happen
   * here, and the receipt for it is part of the picture.
   */
  relief = 0,
): void {
  /*
   * **The charred field is gone** (owner call: "below the Godzilla, on the bricks, there
   * are some dirty/black spots on the brick — can you clean that").
   *
   * It was a 600×24 dither of `#180A08`/`#2A120C` cells over the ground band under the
   * roost, densest at the middle: a scatter of near-black 8px squares on brickwork. On
   * paper it is the animal's own history; on the frame it is dirt, and this is the fourth
   * time this build has been told that low-value loose cells read as dirt rather than as
   * whatever they were meant to be (the badge's dithered halo, the drifting embers, the
   * confetti across the frame, now this).
   *
   * The lesson generalises, and it is worth writing down in this shape: **a texture that
   * is a scatter of dark cells over a lit material will always read as dirt on that
   * material.** Scorch has to be a *change to the brick* — a courseful of darker faces,
   * say — rather than a layer of spots on top of it. What is left here is the payoff: this
   * function now draws nothing at all until the beast is beaten, and then it grows grass.
   */
  const half = 300;
  if (relief <= 0.15) return;
  /*
   * Grass coming through the scorch: three blades a tuft, uneven, with a lit tip — the one
   * thing on this floor that says the ground itself recovered rather than just got
   * brighter. Whole cells and stable positions (`hash2`), so it is 8-bit and it does not
   * crawl; and it is *on* the floor rather than floating over it, which is the difference
   * between this and the drifting embers that were deleted for reading as dirt.
   */
  const grass = Math.max(0, (relief - 0.15) / 0.85);
  for (let x = roostX - half; x < roostX + half; x += 24) {
    const n = hash2(Math.round(x / 24), 71);
    if (n > 0.55 * grass) continue;
    const h = 8 + Math.round(n * 14 * grass);
    for (const [dx, dh] of [
      [0, h],
      [5, h * 0.6],
      [9, h * 0.8],
    ] as const) {
      pxRect(ctx, '#2C6B3A', x + dx, GROUND_TOP - dh, 3, dh, 1);
      pxRect(ctx, '#7BC46A', x + dx, GROUND_TOP - dh, 3, 3, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// The player, on fire
// ---------------------------------------------------------------------------

/**
 * The hero **burning**, on the frames a life is lost to the dragon's fire (owner call:
 * "for the dying effect of our character, make the character burn upon touching the fire").
 *
 * The game's fourth death pose, and it follows the rule the other three set: build it out
 * of the obstacle's own vocabulary. A stamp flattens him, the Workplace figure tapes him
 * up, a compliance monster files him — and fire *burns*, so what is painted is the hero
 * going to soot: a charred silhouette over the figure, flame licking up the body from the
 * feet, embers coming off the top of it and a plume of smoke above his head.
 *
 * Drawn **over** the hero rather than instead of him, like the tape and the paperwork: the
 * sim booked the delay the instant the flame touched him, and this is a picture of that
 * frame, so the person underneath has to still be recognisable.
 *
 * `p` is 0..1 through `LIVES.LOST_HOLD`, so the fire takes hold and the smoke rises over
 * the beat rather than appearing whole.
 */
export function drawBurningHero(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  feetY: number,
  p: number,
  t: number,
  reduced: boolean,
): void {
  const q = Math.max(0, Math.min(1, p));
  // The drawn hero is 48×60 (16×20 at scale 3), and the burn is measured against that
  // rather than against his 28×44 hitbox — the same rule that sizes every hazard here.
  const w = 48;
  const h = 60;
  const x = centerX - w / 2;
  const top = feetY - h;
  const frame = reduced ? 0 : Math.floor(t * 12) % 3;

  /*
   * 1. Charring, from the feet up. Whole cells at high alpha in a soot black, taking the
   *    figure's colour away in the order fire would: a low-alpha wash over the whole body
   *    reads as a shadow, which is the dithered-halo trap in another costume.
   */
  const charTop = top + h * (1 - Math.min(1, 0.35 + q * 0.75));
  for (let cy = feetY - 4; cy > charTop; cy -= 4) {
    const f = (feetY - cy) / h;
    for (let cx2 = x + 6; cx2 < x + w - 6; cx2 += 4) {
      const n = hash2(Math.round(cx2 / 4), Math.round(cy / 4));
      if (n > 0.85 - f * 0.35) continue;
      pxRect(ctx, n < 0.4 ? '#180C0A' : '#2A1410', cx2, cy, 4, 4, 4);
    }
  }

  /*
   * 2. The flame on him: **separate tongues with air between them**, not a column of cells
   *    per 4px of body.
   *
   *    The first cut did the latter and every column reached a similar height, so it
   *    rasterised as an orange box with a man's head sticking out of the top — the same
   *    defect as the fire cone's eight rectangles, one screen object later. What reads as
   *    burning is few tongues, at very different heights, each tapering to a single cell,
   *    with the person visible between them.
   */
  const tongue = (tx: number, baseY: number, th: number) => {
    if (th < 6) return;
    const cell = 4;
    for (let dy = 0; dy < th; dy += cell) {
      const f = dy / th; // 0 at the base, →1 at the tip
      const tw = f > 0.72 ? cell : f > 0.4 ? cell * 2 : cell * 3;
      const cxr = tx - tw / 2;
      const y = baseY - dy - cell;
      pxRect(ctx, f > 0.55 ? FIRE_MID : FIRE_DEEP, cxr, y, tw, cell, cell);
      // The hot heart of the tongue: one cell wide, in the lower third only. Any more cream
      // than this and seven tongues read as white streaks rather than as fire.
      if (f < 0.3) pxRect(ctx, f < 0.12 ? FIRE_CORE : FIRE_HOT, tx - cell / 2, y, cell, cell, cell);
    }
    // A hot tip: one cell at full value, which is what says "flame" rather than "orange".
    pxRect(ctx, FIRE_HOT, tx - 2, baseY - th - 2, 4, 4, 4);
  };
  // Seven fixed roots across the body, heights varied per root and per flicker frame. The
  // tallest are at the silhouette's edges, where fire climbs.
  const roots = [0.06, 0.2, 0.34, 0.5, 0.66, 0.8, 0.94];
  const heights = [0.9, 0.5, 0.75, 0.42, 0.8, 0.55, 0.95];
  roots.forEach((rf, i) => {
    const n = reduced ? 0.5 : hash2(i, 17 + frame);
    const th = Math.round(h * (0.28 + q * 0.62) * heights[i]! * (0.75 + n * 0.5));
    tongue(x + rf * w, feetY - 2, th);
  });
  // Two more over the head, so the fire has taken the whole of him — separate tongues
  // again, because a filled band up there reads as a hat.
  if (q > 0.35) {
    tongue(centerX - 7, top + 8, Math.round(14 + q * 20));
    tongue(centerX + 6, top + 6, Math.round(10 + q * 26));
  }
  // Embers leaving the fire. Few cells at full value — the halo lesson.
  if (!reduced) {
    pxRect(ctx, FIRE_HOT, centerX - 18 + frame * 4, top - 22 - q * 20, 4, 4, 4);
    pxRect(ctx, FIRE_CORE, centerX + 14 - frame * 3, top - 34 - q * 26, 4, 4, 4);
  }

  /*
   * 3. Smoke, rising and spreading: a **pale** grey, because it has to read against a dark
   *    sky, and few cells at whole-cell steps rather than a soft plume. It is what carries
   *    "this is over" once the flame has done its work.
   */
  for (let i = 0; i < 5; i += 1) {
    const n = hash2(i, 53);
    const rise = 40 + i * 18 + q * 44;
    const s = 8 + Math.round(n * 6) + i * 2;
    pxRect(
      ctx,
      `rgba(206,210,208,${(0.34 - i * 0.05) * q})`,
      centerX - s / 2 + (n - 0.5) * 30 + (i % 2 === 0 ? -5 : 5),
      top - rise,
      s,
      s,
      4,
    );
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
 * The cannon, authored 32×17 and drawn at scale 2 → a 64×34 tool.
 *
 * Bigger than the Workplace cutter (36×26) in the barrel and deliberately so — the
 * owner asked for a *big* water weapon, and it has to read as the thing that beats
 * a dragon from across the frame. Cyan, not orange: on this screen the value accent
 * is already spoken for by the fire, and a tool the same colour as the thing it
 * fights is a tool nobody can see working. This is the one place that rule bends,
 * and the reserved orange stays on the badge and the HUD chip instead.
 *
 * **Rebuilt** after the owner's note ("the water cannon and the throw of water is also
 * bad, it's like blocks just put together — make it more refined and well-finished"). The
 * 26×13 version was a pale housing, a parallel-sided tube and a lit rectangle for a mouth,
 * i.e. three blocks. What it is made of now: a pressure tank with a band and a valve, a
 * **mid-value** housing carrying one lit rail (the rule a thing the hero *carries* has to
 * obey, since it is held in front of whatever he happens to be standing against), a grip
 * and trigger, and a mouth that **flares in whole-cell steps** to a dark aperture with two
 * lit cells in it. The flare is the ceiling spotlight's lesson pointed at a weapon: a can
 * with parallel sides is a pipe, and a bright plate on the end of one is a flag.
 *
 * **…and then made to look DANGEROUS** (owner call: "make the water gun look more
 * dangerous"), which turned out to be three specific things rather than a mood:
 *
 *  · **the bell got a real flare.** It went from two cells of collar to a mouth that
 *    steps out over four columns and stands 10 cells tall against a 4-cell bore — the
 *    silhouette of something that lets go of a lot of water at once. A gun looks
 *    dangerous at the end you are pointing.
 *  · **the bore went black.** It was `WATER_LIT` across the whole aperture; a lit plate is
 *    a torch, and a dark hole with pressure lit *inside* it is a barrel.
 *  · **it got bigger and heavier**: 36×18 at scale 2 (72×36, from 64×34), a full-width
 *    pressure tank with a valve at each end, and a double keyline where the housing meets
 *    the barrel. Sized against the drawn hero (48×60) it is now plainly a two-handed tool
 *    rather than a sidearm — which is the read the owner is after, and it is also honest,
 *    because it is a hose being held open rather than a trigger being pulled.
 */
const CANNON: readonly string[] = [
  '.....KKKKKKKKKKK....................',
  '....KLTTTTTTTTTTLK..................',
  '....KttttttttttttK..................',
  '....KKttttttttttKK..................',
  '...KBBBBBBBBBBBBBBBK.........KK.....',
  '...KbbbbbbbbbbbbbbbK........KCCK....',
  '...KbbbbbbbbbbbbbbbKKKKKKKKKCCCCK...',
  '...KbbbbbbbbbbbbbbbKccccccccCaaaaCK.',
  '...KbbbbbbbbbbbbbbbKccccccccCaooooaK',
  '...KbbbbbbbbbbbbbbbKccccccccCaooooaK',
  '...KbbbbbbbbbbbbbbbKccccccccCaaaaCK.',
  '...KbbbbbbbbbbbbbbbKKKKKKKKKCCCCK...',
  '...KKKbbbbbKKbbbbbKK........KCCK....',
  '......KGGGK.KggggK...........KK.....',
  '......KgggK.KKKKKK..................',
  '.......KgggK........................',
  '.......KgggK........................',
  '........KKKK........................',
];

const CANNON_PALETTE: Palette = {
  K: '#10222A',
  b: '#33505C', // housing — a MID body, never a pale one: it is held at chest height
  B: '#CFE6EC', // the one lit rail, along the housing's top course
  t: WATER_DEEP, // the pressure tank on top
  T: WATER,
  L: WATER_LIT, // its valve
  c: WATER_DEEP, // barrel, collar and the flared bell
  C: WATER,
  /*
   * The bore itself, and it is **dark**. A hole seen side-on is a hole: the version this
   * replaced painted the whole aperture in `WATER_LIT`, which is a bright plate on the end
   * of a tube, i.e. a flag on a stick. Same rule the ceiling spotlight's aperture paid for.
   */
  a: '#06131A',
  o: WATER_LIT, // the lit cells *inside* the bore, where the pressure is
  g: '#233A44', // grip
  G: '#3C5C69',
};

/**
 * Scale 2 → 64×34.
 *
 * It earns its width in the **barrel and the bell** rather than the housing, which is how
 * it stays a *weapon* instead of the plank scale 3 turned the Workplace cutter into next to
 * a 48-wide hero.
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
  // Held at chest height on a 60px hero, and the muzzle is read off the GRID's own bore
  // row rather than guessed: the jet has to leave the hole that is drawn.
  const y = feetY - 46;
  const x = facing === 1 ? centerX + 2 - kick : centerX - 2 - w + kick;
  const muzzleY = y + 8 * CANNON_SCALE;
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
    // Across the line of travel, for the stream's thickness and its droplets.
    const nx = -j.dy;
    const ny = j.dx;
    /*
     * The stream behind the head: a **tapering line of 4px cells**, not five squares.
     *
     * The version this replaces stepped 24 → 9px blocks every 20px along the line, which
     * at 20px spacing is a dashed row of rectangles with the sky showing between them —
     * "like blocks just put together", in the owner's words, and it is the same defect the
     * tape ribbon on the Workplace paid for. 4px cells every 4px make a continuous jet,
     * and the thickness comes off a profile so it is thickest a little behind the head and
     * thins to nothing at the tail, which is what a hose line does.
     */
    const cell = 4;
    const len = 132;
    for (let d = len; d >= 0; d -= cell) {
      const f = d / len;
      // Thickest just behind the head, thinning to a wisp at the far end.
      const th = Math.max(cell, Math.round(((1 - f) * 0.7 + 0.3) * box.h * (f > 0.85 ? 0.4 : 1)));
      const px = cx - j.dx * d;
      const py = cy - j.dy * d;
      const shell = `rgba(28,127,166,${0.35 + 0.5 * (1 - f)})`;
      pxRect(ctx, shell, px - cell / 2, py - th / 2, cell, th, cell);
      // A lit spine down the middle of the stream, two cells thick.
      const lit = Math.max(cell, th * 0.34);
      pxRect(ctx, f < 0.5 ? WATER : `rgba(79,190,220,${0.75 - f * 0.4})`, px - cell / 2, py - lit / 2, cell, lit, cell);
    }
    // The head: the hitbox exactly, with a stepped nose in front of it and a lit crown,
    // so the leading edge reads as rounded water rather than as a brick.
    pxRect(ctx, WATER, box.x, box.y, box.w, box.h, 2);
    pxRect(ctx, WATER_DEEP, box.x, box.y + box.h - 4, box.w, 4, 2);
    for (let i = 1; i <= 3; i += 1) {
      const s = box.h - i * 5;
      if (s <= 0) continue;
      pxRect(ctx, i === 1 ? WATER : `rgba(79,190,220,${0.9 - i * 0.2})`, cx + j.dx * (box.w / 2 + i * 4) - 2, cy + j.dy * (box.w / 2 + i * 4) - s / 2, 4, s, 2);
    }
    pxRect(ctx, WATER_LIT, cx - 9 + j.dx * 7, cy - 6, 18, 10, 2);
    // Droplets shaken off, offset ACROSS the line of travel and at full alpha: few bright
    // cells say water, many faint ones say rendering fault.
    pxRect(ctx, WATER_LIT, cx + nx * 17 - 3 - j.dx * 12, cy + ny * 17 - 3 - j.dy * 12, 6, 6, 2);
    pxRect(ctx, WATER, cx - nx * 19 - 3 - j.dx * 26, cy - ny * 19 - 3 - j.dy * 26, 5, 5, 2);
    pxRect(ctx, WATER_LIT, cx + nx * 12 - 2 - j.dx * 48, cy + ny * 12 - 2 - j.dy * 48, 4, 4, 2);
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
 * people. They **walk out of the suit's unzipped side one at a time** (owner call),
 * take their place in a line-up, and cheer — and the word over them is the only
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
      /*
       * Walking out of the suit (owner call), not dropping out of a chest. So the tell is a
       * **stride**: the body bobs one cell and the far leg is thrown forward, keyed to the
       * distance walked rather than to a clock — the same reason the Workplace trudge is
       * distance-driven, and it is what stops five people marching in lockstep.
       */
      const step = Math.floor(c.progress * 9) % 2 === 0;
      const bob = reduced ? 0 : step ? 0 : 3;
      drawPixels(ctx, CANDIDATE, palette, x, y + bob, {
        scale: CANDIDATE_SCALE,
        flip: c.dir < 0,
      });
      if (!reduced) {
        // The leading leg, thrown out in front. Two cells: at this size a leg is a mark,
        // not a limb.
        pxRect(ctx, palette.l!, x + (c.dir < 0 ? -6 : w - 2), y + h - 14 + bob, 9, 7, 2);
      }
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

  /*
   * Confetti, **over the line-up and nowhere else**, once the first of them is down.
   *
   * It used to be 24 six-pixel cells scattered across the whole frame, and against the
   * bright sky the payoff now brings up they read as specks of dirt on the screen — the exact
   * defect that deleted this screen's drifting embers. Fewer, bigger, and only in the band
   * above the people they are being thrown over: a cell has to be somewhere for a reason.
   * Stable positions (`hash2`) so it reads as thrown rather than as per-frame noise, and it
   * stops entirely under reduced motion.
   */
  if (reduced) return;
  const landed = candidates.filter((c) => c.landed);
  if (landed.length === 0) return;
  const from = Math.min(...landed.map((c) => c.x)) - 60;
  const to = Math.max(...landed.map((c) => c.x)) + 60;
  for (let i = 0; i < 14; i += 1) {
    const x = from + hash2(i, 91) * (to - from);
    const drop = ((t * (50 + hash2(i, 7) * 70) + hash2(i, 13) * 400) % 300) + GROUND_TOP - 320;
    const c = i % 3 === 0 ? '#9FE6C4' : i % 3 === 1 ? WATER_LIT : '#FFF2D0';
    pxRect(ctx, c, x, drop, 8, 8, 4);
  }
}
