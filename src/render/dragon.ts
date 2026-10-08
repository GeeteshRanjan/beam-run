/**
 * The hiring dragon's painting (screen 4).
 *
 * Pure: level data, the hazard's snapshot and a clock in, canvas out. No wall
 * clock read inside, no DOM, no host state — so the whole screen rasterises on its
 * own, which is the only way any of it gets checked.
 *
 * **The beast is ONE authored grid, and this note used to say the opposite.** It was
 * composed — a head grid placed by a composer with the torso, neck, tail and legs
 * stepped out of `pxRect` runs — on the argument that 1,500 hand-placed cells in a
 * file where a mistyped row is invisible is the expensive way to draw an animal. That
 * argument was sound and the conclusion was wrong: a composer cannot see a silhouette,
 * and the composed version rasterised as a hunched lizard through three art rounds. It
 * is one 80×63 grid now (`BEAST`), generated against a PNG in a throwaway script and
 * pasted in, which is what made the cell count affordable. The `pxRect` runs that are
 * left belong to the fire, the water and the chrome.
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
 * **It wears nothing, and the fight is read off a real bar.** The glasses that used to
 * be its costume *and* its health readout are gone (owner call), and four water jets
 * now show as water on the hide with a 192px cyan bar under the name plate carrying the
 * count. And when the last hit lands the **beast goes with the costume** — what is left
 * on the floor is the suit five people were inside, never a dragon standing there
 * undressed.
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
  type StompState,
  type WaterState,
} from '../world/Hazards/Dragon';

const { TILE: T } = RESOLUTION;
/*
 * `const CONE = HAZARDS.DRAGON` used to be here, for `CONE_NEAR_H`/`CONE_FAR_H`: this
 * module painted the flame's band per column and worked its thickness out from the same two
 * constants the hazard did. Two copies of one profile is the `badgeFloat` defect waiting
 * for somebody to change one of them, and the pass that gave the flame a floor run and a
 * 3.4× taper would have been exactly that occasion. The jet now arrives as `fire.points`
 * (from `Dragon.flameStream`, the same samples the hitbox squares are built from), so this
 * module has no opinion about the fire's shape at all, and no reason to read the dragon's
 * numbers.
 */
const GROUND_TOP = 15 * T;

// --- palette ---------------------------------------------------------------

const OUTLINE = '#0C1110';
/**
 * Charcoal hide with a green cast: mid, shade, highlight (owner call: "make the Godzilla
 * look like actual Godzilla — this looks more like a bigger lizard/frog"). It was oxblood
 * crimson with pink plates, and a red animal with pink fins is a salamander however the
 * silhouette is cut. The real thing is near-black; this is held a value up from that so
 * the mass still separates from the ember night sky, and the lit planes are what carry
 * the contour. Fire stays the only warm, bright thing on the screen.
 */
const SCALE = '#4A5650';
const SCALE_DARK = '#28302D';
const SCALE_LIT = '#77877D';
/** Chest and abdominal segments — a step lighter than the hide, never a cream bib. */
const BELLY = '#9AA595';
/** Every third chest course, so the plates read as ridges rather than as one stripe. */
const BELLY_SHADE = '#78836F';
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
 * The Godzilla, authored as **one 80×63 grid** and drawn at scale 3 → 240×189.
 *
 * **Rebuilt a fifth time** (owner: "make the Godzilla look better and like actual Godzilla,
 * this looks more like a bigger lizard/frog"). Same grid size, same jaw registration
 * (`JAW_*`), new animal: charcoal hide instead of crimson, a **small head** on a thick neck
 * over a **pear-shaped body** that is heaviest at the thighs, short arms held forward and
 * bent, and a row of big **bone dorsal plates** anchored on the real back edge and growing
 * largest over the shoulders — pink triangles pinned along a red back were most of the
 * "lizard". Generated from part masks (tail, legs, torso, neck, head, arm) lit per part from
 * the upper front, in a throwaway generator; only the output ships.
 *
 * **Then muscle and a rounder face** (owner: "make it look muscular, abdomen and above, and the
 * face has too-sharp features — Godzilla has rounder, muscular, defined features"). The skull is
 * a union of ellipses sloping smoothly from dome to a blunt snout, with a jaw muscle at the
 * cheek; the upper body carries a shoulder/trapezius mass, a pectoral shelf with a shadow under
 * it, four stacked **abdominal segments** (lit top, crease under each, a crease line off the
 * flank) in the chest tones, and rounded quad and calf masses, each lit on its own contour.
 *
 * **Then a fuller head** (owner: "the face still looks too sharp and elongated — make it
 * fuller, muscular, defined, and carry some weight"). Same mouth registration (`JAW_*`, row
 * 10, hinge 62, tip 77), so the fire and the opening jaw are untouched; the weight went
 * *vertically*. The skull is two rows taller at the dome (rows 1–16, was 2–14), the upper
 * muzzle is deep and blunt instead of sloping to a point, the lower jaw is one broad mass
 * with a flat underside reaching row 16 (it was a thin strip under the teeth, which is what
 * made the head read as a wedge), the cheek/jowl muscle is bigger and carries a crease back
 * from the corner of the mouth, the brow is a lit ridge over a shadow shelf, and the neck is
 * thicker so the heavier head sits on something. A long head is a raptor; a head as deep as
 * it is long is a Godzilla.
 *
 * **Third resolution, same animal** (owner: "reduce the pixel size on the entire
 * Godzilla, right now it's not looking very good and not at all refined" — plus the mouth,
 * below). The lineage is the whole lesson: 30×24 at **scale 10** was rejected as "blocks of
 * red colour", 48×38 at **scale 5** answered that and was still coarse enough to read as
 * beads, and this is 80×63 at **scale 3** — **2,414 cells against 1,748 and 720**, at the
 * same 240px on the frame. Every pass has been the same trade in the same direction, and
 * nothing about the silhouette had to change to buy it: the size on screen is fixed by what
 * a boss has to be next to a 48×60 person, so refinement is only ever available in the
 * cell.
 *
 * **Scale 3 is the hero's own cell** (`Game.drawPlayer` draws the 16×20 hero at 3), which
 * is the argument for stopping here rather than going finer: the boss and the player are
 * now on one pixel grid, so the screen has a single resolution instead of a coarse animal
 * standing next to a fine one. Below 3 the beast would be *finer* than the player and the
 * 8-bit direction starts to come apart.
 *
 * It still deliberately breaks the "a big creature is composed, not authored as one
 * grid" rule, for the reasons that rule already concedes: the creature **is** a
 * silhouette (no clothing to register against it), a row of the wrong width is caught
 * **mechanically** by a test that measures the grid, and one grid **mirrors for free**.
 * What makes 2,414 cells affordable is that they are not hand-typed: the silhouette is
 * authored as interpolated control rows in a throwaway generator, which derives the
 * outline, the shading, the belly plates, the dorsal plates and the hide bands
 * mechanically, and the **output** is pasted in here. Nothing generated ships.
 *
 * What the grid spends its cells on is the silhouette, which is what makes a shape read
 * as Godzilla rather than as a lizard. Each of these was fixed against a raster, and the
 * ones marked (3) are what the finer cell was spent on:
 *  · **a deep skull** with a short muzzle, a heavy brow, an amber eye with a slit pupil
 *    and an **overbite** — the upper jaw reaches one cell further forward than the lower
 *    (3). The first three cuts drew a long snout and every one rasterised as a raptor;
 *  · **a mouth that is a jaw and not a slot** (3) — see `JAW_ROW` below;
 *  · **a head lit down its own CONTOUR**, per column, not by the horizontal three-band
 *    the body uses (3): shaded like the body, the back half of the skull came out at
 *    `SCALE_DARK` and the head rasterised as a hole with an eye in it;
 *  · **a short thick neck, set back and narrower than both the skull and the
 *    shoulders** — the narrowing that stops the head merging into the chest;
 *  · **an upright stance** on two thick legs with the room showing through between
 *    them, and feet with lit top planes and claws;
 *  · **dorsal plates as separate LEAVES** with air (or a keyline) between (3). Grown row
 *    by row off the back edge — which is how the 48-wide version drew them — they merge
 *    into one pale wedge over the shoulders, and a pale wedge on a back is a **wing**;
 *  · **rounded MAPLE plates, not triangles** (owner: "give me less pointy ones"). Each
 *    plate keeps the anchor and direction of the triangle it replaced, rebuilt as a dome
 *    with three round lobes at its crown (the 1954/Heisei plate), shaded `F` rim / `f`
 *    face / `d` root. Triangles at this size read as spikes — a stegosaur, not a Godzilla;
 *  · **a domed, blunt skull** (owner: "less beaky, less inclined forward, more weight on
 *    top"). The crown is a row higher (row 0) and three cells further back, so its high
 *    point sits over the eye, and the front of the face drops near-vertically to the
 *    snout instead of running down one long diagonal from forehead to tip — that diagonal
 *    was the beak. Rows 0–10 only: the mouth row, teeth and lower jaw are untouched, so
 *    `JAW_*` still registers;
 *  · **a heavy tail** that lies FLAT along the floor for its last third, its plates
 *    continuing down it. Tapered all the way to a point down a straight diagonal it read
 *    as a blade;
 *  · **a tapered belly** (3) — the plated abdomen narrows at both ends. A rectangle of
 *    cream on the front of the animal reads as a bib, which is the same defect as the
 *    "scarf" the version before it drew;
 *  · **hide bands** — runs of five darker cells on every sixth row. Single darker cells
 *    on a grid rasterise as polka dots, which is a costume.
 *
 * `B`/`b` are the belly plates, `H` the lit planes, `S` the shade, `A`/`p` the eye,
 * `m`/`h` the maw and its teeth, `c` the upper teeth and claws, `F`/`f`/`d` the dorsal
 * plates. There are **no horns and no
 * wings** — both were on the dragon this replaced, and both are exactly what said
 * "this animal is not a Godzilla".
 */
export const BEAST: readonly string[] = [
  '............................................................KKKKKKKKKKK.........',
  '.......................................KKK................KKSsHHHHHHHHHHK.......',
  '......................................KdFFK..............KSSsssHHHHHHHHHHHK.....',
  '....................................KKdfffFKK...........KSSSssssssssssssHHHK....',
  '...................................KdFfffffFFKKK.......KSSSssssssHHHHHHHssHHK...',
  '..................................KdfffffffffFFFK....KKSSsssssssSSSSSSSSsssHHK..',
  '..................................KdffffffffffffdK.KKKHHHSSssssssssSAApSsssKHHK.',
  '..................................KdfffffffffffdK.KHHHHHHSSsHHHHssssSSSsssssHHK.',
  '..................................KdfffffffffdddKKHHHHHHSSsSHssHHHsssssSssssHHK.',
  '...................................KdffffffdddKKHHsssHHHSSssSssssHsssssssSSsHHK.',
  '...............................KKKKdfffffdddKKHHHssssHHHSSsssSmmmmmmccmmccmmccK.',
  '..............................KdFFKdffffddKKHHHssssssHHsSSssssssmhhmmhhmmhhmmK..',
  '............................KKdfffFKdffddKHHHssssssssHssKSsssssssHHHHHHHHHHHK...',
  '...........................KdFffffFKKddKKssssssssssssHSsKSSssssssSssssssssHHK...',
  '..........................KdfffffffFFKKKSsssssHHHHHHHsSssKSSsssssSssssssssKK....',
  '..........................KdfffffffffdKKSsssssHssssHHHSsssKKSSSSSSSSsssKKK......',
  '..........................KdfffffffffdKSSsssssssHHHHsHSsssssKKKKKKKKKKK.........',
  '..........................KdffffffffddKSSsSSsssHHHHHHHHsssssssK.................',
  '..........................KdfffffffddKSSSsSSsssssssssHHHsssssK..................',
  '..........................KdfffffffdKHSSSsSSSsssssssssHSBBBSK...................',
  '..........................KddfdfffddKHSSSsSSSsssssSBBBBBHKKKK...................',
  '...........................KKdKddfdKHHSSSSsSSssssSbbbbbHKsHHHK..................',
  '.............................KKKKddKHHSSSSssSSssssSSSSssKSsHHHK.................',
  '......................KK...KKKdK.KdKHHSSSSsssSSSSBBBBBsHKSSssssK................',
  '....................KKdFKKKdFFFK..KKHHHSSSSssssSBBBBBBBHKSSsssssK...............',
  '...................KdFffFFFfffFK..KSHHHSSSSSssssSbbbbbbbHKSsssssK...............',
  '...................KdffffffffffFK.KSHHHHSSSSSSSsssSSSSSSHHKKssssHK..............',
  '..................KdfffffffffffFKKSSssHHHSSSSSSSSSSSBBBBBBHHKSSSHK..............',
  '..................KdfffffffffffFKKSSsssHHHSSSSSSSSSSBBBBBBBBHKSSHHK.............',
  '..................KdfffffffffffFKKSSssssHHHHSSSSSSSSbbbbbbbbK.KSSHK.............',
  '..................KdffffffffffdddKSSsssssHHHHSssssssSSSSSSSHK..KSsHK............',
  '..................KdffffffffdddKKSSSssssssHHHSssssssSBBBBBBHK...KSSK............',
  '..................KdfffffffddKKHHSSSssssssssHSsssssSBBBBBBBBK....KSK............',
  '..................KdffffffddKHHHHSSSsssssssssSsssssSbbbbbbbbK....KKKc...........',
  '.................KKdfffffddKssHHHSSSssssssssssSsssssHHHHHHSSK....c.c............',
  '................KdFKdffdddKSSSHHHSSSssssssssssSSssHHHHHHHHHHK.....c.............',
  '...............KdffFKdfdKKSSSsHHHSSSSssssssssssSSsHHHHHHHHHHK...................',
  '...............KdfffFKddKSSSSSHHHSSSSsssssssssSSKssssHHHHHHHHK..................',
  '...............KdfffFKdKSSSSSSHHHSSSSssssssssssKSsssssssssHHHHK.................',
  '...............KKdffddKSSSSSSHHHHHSSSSssssssssHKSssssssssssHHHK.................',
  '..............KdKddddKSSSSSSsHHSHHSSSSssssssHHKSSsssssssssssHHHK................',
  '.............KdFKddKKSSSSSSSHHHSsHHSSSSssssHHHKSSsSsssssssssHHHK................',
  '.............KdfFKdKSSSSSSSSHHHSSHHSSSSssssHHHKSSsSssssssssssHHK................',
  '............KdffddKSSSSSSSSSHHHSSHHSSSSSsssHHHKSSsSssssssssssHHK................',
  '............KddddKSSSSSSSSSSHHHSSSHSSSSSSSSHHHKSSsSsssssssssHHHK................',
  '............KddKKSSSSSSSSSSSHHHKSSsHSHSSSSSHHHKSSSSsssssssssssHK................',
  '.............KKKSSSSSSSSSSSSsHHHKSSsSSHSSSSSsHKSSSSSssssssssssHK................',
  '.............KKSSSSSSSSSSSSSSHHHKSSssSSSKKSSSsKSSSsSSssssssssHHK................',
  '.............KSSSSSSSSSSSSSSsHHHKSSSssHSSSKKKSsKSSSsSSssssSsssK.................',
  '...........KKSSSSSSSSSSSSSSSSsHHHKSSsssHHHHHHKKKSSSHHHHSSSSsssK.................',
  '...........KSSSSSSSSSSSSSSSSSSssKKSSSsssHHHHHK..KSssssHHsssssK..................',
  '........KKKsSSSSSSSSSSSSSSSSSSKK.KSSSSSsssHHK....KsssssHssssK...................',
  '........KsssSSSSSSSSSSSSSSSSSK..KSSSSSSSSsHK......KssssHsssK....................',
  '.......KsssssSSSSSSSSSSSSSKKK...KSSSSSSSSHHK......KssssHsHHK....................',
  '......KSSSSSSSSSSSSSSSSSKK......KSSSSSSSSHHK......KssssssHHK....................',
  '....KKsSSSSSSSSSSSSSSSKK........KSSSSSSSSHHK......KssssssHHK....................',
  '...KHssSSSSSSSSSSSSKKK..........KSSSSSSSSHHK......KSSSSssHHK....................',
  '.KKHssSSSSSSSSSSSKK.............KSSSSSSSSHHK.....KSSssssssHHK...................',
  'KSSsSSSSSSSSSSKKK...............KSSSSSSSSsHHK....KSSssssssssHKK.................',
  'KSSSSSSSSSSKKK..................KSSSSSSSSssHHK...KSSssssssssHHHK................',
  'KSSSSSKKKKK.....................KSSSSSSSSSSsHHK..KSSSSSSSSSSsHHHK...............',
  'KKKKKK..........................KSSSSSSSSSSSSSK.cKSSSSSSSSSSSSSsKc..............',
  '................................KKKKKKKKKcKcKcK.cKKKKKKKKKcKcKcKKc..............',
];

/**
 * Dorsal plates: weathered bone, the lightest large shape on the animal. Three tones per
 * plate (maple pass): `F` the lit top/front rim, `f` the face, `d` the back edge and the
 * root where the plate meets the hide — so a rounded plate reads as a solid lobe rather
 * than a flat cut-out.
 */
const DORSAL = '#CFCBB8';
const DORSAL_LIT = '#E6E2D0';
const DORSAL_ROOT = '#9E9A88';
const BEAST_PALETTE: Palette = {
  K: OUTLINE,
  s: SCALE,
  S: SCALE_DARK,
  H: SCALE_LIT,
  B: BELLY,
  b: BELLY_SHADE,
  F: DORSAL_LIT,
  f: DORSAL,
  d: DORSAL_ROOT,
  A: EYE,
  p: '#140806',
  m: MAW,
  h: BONE,
  c: BONE_DARK,
};

/**
 * Scale 3 — a third of the cell the first version used, and the whole reason this one
 * reads as an animal.
 *
 * 10px cells made a *bead* picture: a 200px animal is 20 beads across, so a leg was two
 * cells, a jaw one, and every diagonal a 10px stair. 5px halved that and bought a muzzle,
 * a brow and a plated belly, and it is still what the owner saw as "not at all refined":
 * at 5px a **mouth** is one cell deep, an eye is two cells, and there is nowhere to put a
 * chin. At 3px the same animal is 80 cells across — the hero's own cell, so the boss and
 * the player share one pixel grid — and it is where an overbite, interlocking teeth, a
 * slit pupil and a contour-lit skull can all exist at once.
 */
const BEAST_SCALE = 3;
const BEAST_COLS = maxWidth(BEAST);
export const BEAST_W = BEAST_COLS * BEAST_SCALE;
export const BEAST_H = BEAST.length * BEAST_SCALE;

/**
 * Where the grid is pinned inside the body box.
 *
 * The box is 200×190 (`HAZARDS.DRAGON.BODY_W/H`) and the grid is 240×189, so it is
 * centred with 20px hanging out of each side: the tail's tip at the back, the muzzle and
 * the forelimb's claws at the front. The legs and torso sit inside the box, which is
 * what a water jet has to hit.
 *
 * **`BEAST_OFFSET_Y` is 1, and it is arithmetic rather than taste.** 63 rows at scale 3 is
 * 189px in a 190px box, so the grid is pushed down by the missing pixel and the bottom row
 * lands *exactly* on the ground band — which is what "two feet on the ground" is, measured,
 * and what `dragon.test.ts` asserts. A grid whose height divides the box exactly is a
 * luxury of the cell size; the alternative was 95 rows at scale 2, i.e. a beast finer than
 * the hero.
 */
const BEAST_OFFSET_X = -20;
const BEAST_OFFSET_Y = 1;

/**
 * The jaw, in grid cells: where the mouth line is, where it hinges and where it ends.
 *
 * Read off the drawn grid, like `MOUTH_*_FRACTION` in the hazard — the mouth row is the
 * upper of the two carrying the teeth, and the muzzle tip is its last column. Nothing here
 * may be guessed: an opening jaw that hinges in the wrong column is a head coming apart.
 *
 * **The shut mouth is a JAW, not a slot** (owner call: "the Godzilla's mouth can be made a
 * bit better, it's not well shaped right now"). Four things the 5px cell could not hold,
 * all of them in the grid rather than here:
 *  · the two dark courses **taper to nothing at the hinge**, so the mouth closes into a
 *    corner instead of ending as a squared-off cut with the same thickness as the middle;
 *  · **the teeth interlock** — 2-cell blocks in the lower course alternating with 2-cell
 *    blocks in the upper — so the line has a bite. A single bone row is a zip, and 1-cell
 *    teeth are 3px and vanish;
 *  · **the upper jaw overbites** the lower by a cell, and the muzzle is rounded off above
 *    it rather than running flat into the grid's last column;
 *  · a **lit chin plane** under the mouth and a shadow course under the mandible, which is
 *    the difference between a jawline and a throat.
 *
 * The eye's cell (`EYE_COL`/`EYE_ROW`) used to live here too, because a pair of glasses had
 * to be registered to it. The owner removed the glasses, and the eye is now just part of
 * the grid like every other feature.
 */
const JAW_ROW = 10;
const JAW_HINGE_COL = 62;
const JAW_TIP_COL = 77;
/**
 * Cells the muzzle end of the jaw drops when the mouth is fully open (5 × 3px = 15px).
 *
 * Was 8 (owner call: "the face when throwing fire still feels elongated, maybe 2–3 pixels").
 * The jaw drops as a rigid piece, so every cell of drop is a cell of extra head height: at 8
 * the open head was half as tall again as the shut one; at 5 it is a wide bite (~18° off a
 * 15-cell jaw) and the skull still reads as the same skull.
 */
const JAW_MAX_CELLS = 5;
/** Last grid row of the lower jaw (the mandible's keyline). Rows `JAW_ROW + 1`..this swing. */
const JAW_BOTTOM_ROW = 16;

/*
 * --- the moving parts ------------------------------------------------------
 *
 * Owner call: "the feet of the Godzilla don't move and that makes it look weird — make it
 * move naturally, and other muscles of the body where required", and "when it's throwing
 * flame the lower jaw is getting elongated".
 *
 * The grid is still one authored animal; what moves is **which cells go where**. Every cell
 * is assigned to one part once, at load, from where it sits in `BEAST`, and each frame a
 * part is offset by whole cells — so the art stays on the hero's 3px grid and mirrors
 * exactly as before. The boundaries are read off the drawn grid, like `JAW_*`:
 *  · **legs** — everything from `LEG_TOP_ROW` down, split at `NEAR_LEG_COL`. Below that row
 *    the two shins, and the tail, are separated by air in every row, so a leg can swing
 *    without tearing anything. A leg is **sheared** from the knee (0 at `LEG_TOP_ROW`, full
 *    at the claws) and its foot lifted by compressing the shin, never stretching it: every
 *    row moves up by at least as much as the one above, so no row can open a gap;
 *  · **the tail** — every column left of `TAIL_COL`, moved as whole columns so the tail
 *    bends rather than tearing: its root rides with the hips and its tip lifts;
 *  · **the near arm** — the forearm and claws below `ARM_TOP_ROW`, where they hang clear of
 *    the chest, swinging against the near leg;
 *  · **the lower jaw** — rows `JAW_ROW + 1`..`JAW_BOTTOM_ROW` in front of the hinge, moved
 *    **as a rigid piece** (each column dropped by its distance from the hinge) with the maw
 *    opening in the gap it leaves. The previous build painted a thin mandible *under* a
 *    growing hole while the shut jaw stayed where it was, so an open mouth was a jaw
 *    stretched to twice its depth. A jaw that moves keeps its depth by construction.
 */
const LEG_TOP_ROW = 50;
/** First row of the feet (where they widen into the toes); below it a foot moves rigidly. */
const FOOT_TOP_ROW = 57;
const FOOT_ROW = BEAST.length - 1;
const NEAR_LEG_COL = 47;
const TAIL_COL = 32;
const ARM_TOP_ROW = 29;
const ARM_BOTTOM_ROW = 35;
const ARM_COL = 61;
/**
 * px of ground covered by one full gait cycle (two steps). The phase is read off the body's
 * own position, so a planted foot moves backwards under the hips at exactly the speed the
 * body moves forwards — it stays put on the bricks instead of skating. A quarter of this
 * (15px, five cells) is how far a foot reaches either side of its hip.
 */
const STRIDE_PX = 60;
/** Cells a foot clears the floor at mid-swing. Heavy and low: this is not a sprinter. */
const LIFT_CELLS = 3;
/** Cells the tail tip rises: on each step while walking, and held while it roars or breathes. */
const TAIL_LIFT_CELLS = 2;
/** How far the near forearm swings, as a fraction of the near foot's reach (the other way). */
const ARM_SWING = 0.35;

type BeastPart = 'body' | 'tail' | 'jaw' | 'arm' | 'far' | 'near';
interface BeastCell {
  r: number;
  c: number;
  fill: string;
  part: BeastPart;
}

/**
 * Every painted cell of `BEAST` with its part, in paint order: row-major, except that the
 * near leg goes last so it always crosses *in front of* the far one mid-stride.
 */
const BEAST_CELLS: readonly BeastCell[] = (() => {
  const partOf = (r: number, c: number): BeastPart => {
    if (c < TAIL_COL) return 'tail';
    if (r >= LEG_TOP_ROW) return c >= NEAR_LEG_COL ? 'near' : 'far';
    if (r > JAW_ROW && r <= JAW_BOTTOM_ROW && c > JAW_HINGE_COL) return 'jaw';
    if (r >= ARM_TOP_ROW && r <= ARM_BOTTOM_ROW && c >= ARM_COL) return 'arm';
    return 'body';
  };
  const rest: BeastCell[] = [];
  const near: BeastCell[] = [];
  BEAST.forEach((row, r) => {
    for (let c = 0; c < row.length; c += 1) {
      const fill = BEAST_PALETTE[row[c]!];
      if (!fill) continue;
      const cell = { r, c, fill, part: partOf(r, c) };
      (cell.part === 'near' ? near : rest).push(cell);
    }
  });
  return [...rest, ...near];
})();

/** One leg's pose: px its foot sits from under its hip (world x), and cells it is lifted. */
interface LegPose {
  reach: number;
  lift: number;
}
interface BeastPose {
  /** Cells the whole body sinks — 1 on a heavy footfall, 0 as the legs pass. Never up. */
  bob: number;
  near: LegPose;
  far: LegPose;
  /** Cells the tail tip is raised. */
  tail: number;
  /** px (world x) the near claws swing at full length. */
  arm: number;
}

/**
 * One leg at `psi` through its cycle: planted for the first half (the foot travels from a
 * quarter-stride ahead of the hip to a quarter behind it, at exactly the body's speed), then
 * lifted and carried forward for the second half.
 */
function legPose(psi: number, amount: number): LegPose {
  const q = STRIDE_PX / 4;
  if (psi < 0.5) return { reach: amount * (q - psi * STRIDE_PX), lift: 0 };
  const s = (psi - 0.5) * 2;
  return {
    reach: amount * (-q + s * (STRIDE_PX / 2)),
    lift: amount * LIFT_CELLS * Math.sin(Math.PI * s),
  };
}

/**
 * Where every moving part is this frame.
 *
 * The **stride** follows `gait` (the hazard eases it in and out) and is dropped under
 * reduced motion, exactly as the hero's own run cycle is (`Game.drawPlayer`'s `still`). The
 * **tail lift** that goes with an open jaw is a pose, not a cycle — it rises with the jaw
 * through the roar and the wind-up and falls with it — so it is state and survives reduced
 * motion the way the jaw does.
 */
function beastPose(state: DragonState, reduced: boolean, pinned = false): BeastPose {
  const g = reduced ? 0 : Math.max(0, Math.min(1, state.gait));
  const x = state.box.x + state.box.w / 2;
  const phi = (((x / STRIDE_PX) % 1) + 1) % 1;
  const tension = Math.min(1, Math.max(0, state.jawOpen)) * TAIL_LIFT_CELLS;
  const s = state.stomp;
  if (s || pinned) {
    /*
     * A stomp owns the front leg, and it is a telegraph, so it is drawn under reduced
     * motion too (like the jaw). The far leg takes the weight, planted; the tail comes up
     * with the foot; the body drops a cell as the foot lands — that part is juice.
     */
    const near = stompLeg(s, pinned);
    const landed = pinned || (s?.phase === 'recover' && s.progress < 0.3);
    return {
      bob: landed && !reduced ? 1 : 0,
      near,
      far: { reach: 0, lift: 0 },
      tail: Math.max(tension, (near.lift / STOMP_LIFT_CELLS) * TAIL_LIFT_CELLS),
      arm: 0,
    };
  }
  const near = legPose(phi, g);
  const far = legPose((phi + 0.5) % 1, g);
  // Both feet down and spread at phi 0 and 0.5: that is where the weight lands.
  const bob = Math.round(g * Math.abs(Math.cos(2 * Math.PI * phi)));
  const sway = g * TAIL_LIFT_CELLS * (0.5 + 0.5 * Math.sin(4 * Math.PI * phi));
  return { bob, near, far, tail: Math.max(sway, tension), arm: -ARM_SWING * near.reach };
}

/** Cells the front foot is raised at the top of a stomp's wind-up. */
const STOMP_LIFT_CELLS = 6;
/** Cells it rests above the floor on the frames it is standing on a flattened player. */
const PIN_LIFT_CELLS = 2;

/**
 * The front leg through a stomp: up and over the committed spot for the wind-up (eased,
 * so it rises fast and hangs — the hang is the warning), straight down for the slam,
 * planted where it landed for the first half of the recovery, then one short step home.
 * `pinned` is the life-lost beat: the foot is down, on him.
 */
function stompLeg(s: StompState | null, pinned: boolean): LegPose {
  const reach = s ? s.x - s.home : 0;
  if (pinned || !s) return { reach, lift: PIN_LIFT_CELLS };
  const ease = (u: number) => 1 - (1 - u) * (1 - u);
  if (s.phase === 'lift') {
    const e = ease(s.progress);
    return { reach: reach * e, lift: STOMP_LIFT_CELLS * e };
  }
  if (s.phase === 'slam') return { reach, lift: STOMP_LIFT_CELLS * (1 - s.progress) };
  if (s.progress < 0.5) return { reach, lift: 0 };
  const u = (s.progress - 0.5) * 2;
  return { reach: reach * (1 - u), lift: 2 * Math.sin(Math.PI * u) };
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Cells a lower-jaw column drops at `open`: none at the hinge, `JAW_MAX_CELLS` at the tip. */
function jawDrop(c: number, open: number): number {
  if (c <= JAW_HINGE_COL) return 0;
  const along = Math.min(1, (c - JAW_HINGE_COL) / (JAW_TIP_COL - JAW_HINGE_COL));
  return Math.round(open * JAW_MAX_CELLS * along);
}

/**
 * Paint the standing animal in `pose`, with the lower jaw dropped by `open`.
 *
 * The maw is painted **only in the gap the jaw leaves**, from the lower lip's resting row
 * down to where the lip now is — the upper lip (row `JAW_ROW`, with its teeth) never moves,
 * and the lower teeth and the whole mandible arrive with the jaw. While it is charging or
 * burning the back of that gap is lit from inside, because light in a mouth is what makes an
 * open mouth read as a mouth rather than as a bite taken out of the head.
 */
function drawPosedBeast(
  ctx: CanvasRenderingContext2D,
  drawX: number,
  drawY: number,
  flip: boolean,
  pose: BeastPose,
  open: number,
  hot: boolean,
  only?: BeastPart,
): void {
  const S = BEAST_SCALE;
  const ox = Math.round(drawX);
  const oy = Math.round(drawY);
  const colX = (c: number) => ox + (flip ? BEAST_COLS - 1 - c : c) * S;
  const cellsOf = (px: number) => Math.round(px / S) * S;

  if (open > 0.02 && !only) {
    const top = oy + (JAW_ROW + 1 + pose.bob) * S;
    for (let c = JAW_HINGE_COL + 1; c <= JAW_TIP_COL; c += 1) {
      const d = jawDrop(c, open);
      if (d <= 0) continue;
      ctx.fillStyle = MAW;
      ctx.fillRect(colX(c), top, S, d * S);
      if (hot && d > 1) {
        const along = (c - JAW_HINGE_COL) / (JAW_TIP_COL - JAW_HINGE_COL);
        ctx.fillStyle = along < 0.4 ? FIRE_CORE : along < 0.75 ? FIRE_MID : FIRE_DEEP;
        ctx.fillRect(colX(c), top, S, Math.max(1, Math.round((d - 1) * 0.6)) * S);
      }
    }
  }

  const legSpan = FOOT_ROW - LEG_TOP_ROW;
  const armSpan = ARM_BOTTOM_ROW - ARM_TOP_ROW + 1;
  for (const cell of BEAST_CELLS) {
    if (only && cell.part !== only) continue;
    let dx = 0;
    let dy = pose.bob;
    switch (cell.part) {
      case 'jaw':
        dy += jawDrop(cell.c, open);
        break;
      case 'arm':
        dx = cellsOf((pose.arm * (cell.r - ARM_TOP_ROW + 1)) / armSpan);
        break;
      case 'tail':
        // Whole columns, so the tail bends: the root rides the hips, the tip lifts.
        dy =
          Math.round(pose.bob * clamp01((cell.c - 8) / 20)) -
          Math.round(pose.tail * clamp01((22 - cell.c) / 22));
        break;
      case 'near':
      case 'far': {
        const leg = cell.part === 'near' ? pose.near : pose.far;
        const f = (cell.r - LEG_TOP_ROW) / legSpan;
        // Sinks with the hips at the knee, planted (or lifted) at the claws. The lift is
        // taken up by the SHIN alone: the foot block from `FOOT_TOP_ROW` down rises as one
        // piece, so a raised foot keeps its mass instead of flattening into a strip of claws.
        const up = Math.min(1, (cell.r - LEG_TOP_ROW) / (FOOT_TOP_ROW - LEG_TOP_ROW));
        dy = Math.round(pose.bob * (1 - f) - leg.lift * up);
        dx = cellsOf(leg.reach * f);
        break;
      }
      default:
        break;
    }
    ctx.fillStyle = cell.fill;
    ctx.fillRect(colX(cell.c) + dx, oy + (cell.r + dy) * S, S, S);
  }
}

/** Dust kicked off the bricks where a stomp landed — pale, low, and gone in half a beat. */
const STOMP_DUST = '207,198,176';

function drawStompDust(ctx: CanvasRenderingContext2D, state: DragonState, reduced: boolean): void {
  const s = state.stomp;
  if (reduced || !s || s.phase !== 'recover' || s.progress >= 0.5) return;
  const u = s.progress / 0.5;
  const a = 0.75 * (1 - u);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i += 1) {
      const d = FOOT_HALF_PX + 4 + u * (18 + i * 14);
      const size = 9 - i * 2;
      pxRect(
        ctx,
        `rgba(${STOMP_DUST},${a})`,
        s.x + side * d - size / 2,
        GROUND_TOP - size - i * 4 - u * 8,
        size,
        size,
        3,
      );
    }
  }
}
/** Half the front foot's drawn width (18 cells at 3px), where the dust leaves from. */
const FOOT_HALF_PX = 27;

/**
 * The front foot again, **on top of** the player, for the life-lost beat of a stomp.
 *
 * The host draws the hero after the hazards, so a flattened hero painted under a foot
 * would come out lying on top of it. This repaints just that leg, in the pinned pose,
 * after him — the same trick the DENIED stamp uses to hold him flat, from the other side.
 */
export function drawDragonFoot(
  ctx: CanvasRenderingContext2D,
  state: DragonState,
  reduced: boolean,
): void {
  if (state.phase === 'beaten' || state.phase === 'stripping') return;
  const { box } = state;
  const flip = state.dir < 0;
  const drawX = box.x + (flip ? box.w - BEAST_W - BEAST_OFFSET_X : BEAST_OFFSET_X);
  drawPosedBeast(
    ctx,
    drawX,
    box.y + BEAST_OFFSET_Y,
    flip,
    beastPose(state, reduced, true),
    0,
    false,
    'near',
  );
}

/**
 * The costume, **lying on the floor with one side unzipped** — 87×22 at scale 3 → 261×66.
 *
 * **Re-authored at the beast's new cell** (scale 5 → 3) in the same pass, and not for
 * tidiness: the suit and the standing animal are on screen **together** through the whole
 * of `stripping`, cross-fading into one another, so two cell sizes there would be one
 * animal visibly turning into a coarser one. When the creature's resolution changes, so
 * does the resolution of everything it becomes.
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
  '........................................K..............................................',
  '.......................................KfK.......K.....................................',
  '..............................K........cff......KfK....................................',
  '.............................KfK.KKKKKKKKKKKKK..cff......K.............................',
  '.............................cffKssZzzZzzZzzZzKKKK......KfK............................',
  '...........KK.................KsssBZzzZzzZzzZzzZzzKKKK..cff............................',
  '.........KKHHKK.............KKssssBiiiiiiiiiiizZzzZzzHKKKK.............................',
  '.......KKHHppssKK..........KsssssssiiiiiiiiiiiiiiiZzzBHHHHKK.....K.....................',
  '......KsHppssssssK.....K..KssssssssiiiiiiiiiiiiiiiiiiBHHHHHHKK..KfK....................',
  '......sspsssssssssK...KfKKsssssssssiiiiiiiiiiiiiiiiiisSSSSHHssKKcff....................',
  '.....KsssssssssssssKK.cffssssssssssiiiiiiiiiiiiiiiiiisssssSSssssKKK....................',
  '....KssssssssssssssssK.KsssssssssssiiiiiiiiiiiiiiiiiissssssssssssssKK..................',
  '...KssssssssssssssssssKssssssssssSSiiiiiiiiiiiiiiiiiissssssssssssssssKK................',
  '...ssssssssSSsssssssssssssssssSSSSSiiiiiiiiiiiiiiiiiiSsssssssssssssssssKK..............',
  '..KssssSSSSSSSSSSssssssssssSSSSSSSSiiiiiiiiiiiiiiiiiiSSSSSSSsssssssssssssKK............',
  '.KssssSSSSSSSSSSSSSssssssSSSSSSSSSSiiiiiiiiiiiiiiiiiiSSSSSSSSSSSsssssssssssKK..........',
  '.sssSSSSSSSSSSSSSSSSSSsSSSSSSSSSSSSiiiiiiiiiiiiiiiiiiSSSSSSSSSSSSSSSSssssssssKK........',
  'KssSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSiiiiiiiiiiiiiiiiiiSSSSSSSSSSSSSSSSSSSSssssssKKK.....',
  'KSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSiiiiiiiiiiiiiiiiiiSSSSSSSSSSSSSSSSSSSSSSSSsssssKKK..',
  'KShhmhhmhhmhhSSSSSSSSSSSSSSSSSSSSSSiiiiiiiiiiiiiiiiiiSSSSSSSSSSSSSSSSSSSSSSSSSSSSSsssKK',
  'KSmmmmmmmmmmmSSSSSSSSSSSSSSSSSSSSSSiiiiiiiiiiiiiiiiiiSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSK',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
];

const COSTUME_SCALE = 3;

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
  for (let r = 0; r < COSTUME.length; r += 1) {
    const row = COSTUME[r]!;
    for (let c = 0; c < row.length; c += 1) {
      let ch = row[c]!;
      if (ch === '.' || ch === ' ') continue;
      // The authored opening cells now describe where the fabric folds, not a hole
      // that appears as a rectangular void. Paint the base suit intact; the shaped
      // side hatch below is the only interior the player sees.
      if (ch === 'i' || ch === 'z' || ch === 'Z') ch = r < 7 ? 's' : 'S';
      const color = COSTUME_PALETTE[ch];
      if (!color) continue;
      const dx = flip ? cols - 1 - c : c;
      pxRect(ctx, color, x0 + dx * COSTUME_SCALE, y0 + r * COSTUME_SCALE, COSTUME_SCALE, COSTUME_SCALE, 1);
    }
  }

  // A side hatch peels open around the point the candidates actually emerge from.
  // Its tapered silhouette and two displaced lips read as flexible costume fabric,
  // not a black rectangle cut through a wall.
  if (openness > 0.02) {
    /*
     * Every number here is in CELLS and the cell changed under it this pass (5 → 3), so all
     * of them were re-derived to hold the hatch at the same *pixels*: it is the door five
     * 48×60 people walk out of, and a hatch that shrank with the cell would be a door they
     * no longer fit through. 57 cells ≈ the 170px the 34th cell of the coarse grid stood at;
     * ±8 cells ≈ the ±25px the coarse half-width gave; 13 courses ≈ its 40px of height.
     */
    const authoredDoor = 57;
    const doorCol = flip ? cols - 1 - authoredDoor : authoredDoor;
    const doorX = x0 + doorCol * COSTUME_SCALE;
    const doorY = y0 + 12 * COSTUME_SCALE;
    const openCells = Math.max(1, Math.round(openness * 8));
    const rowHalf = [2, 4, 5, 6, 7, 8, 8, 8, 7, 6, 5, 4, 2];
    rowHalf.forEach((fullHalf, r) => {
      const half = Math.max(1, Math.round(fullHalf * openness));
      for (let c = -half; c <= half; c += 1) {
        pxRect(ctx, '#180509', doorX + c * COSTUME_SCALE, doorY + (r - 6) * COSTUME_SCALE, COSTUME_SCALE, COSTUME_SCALE, 1);
      }
      const edgeY = doorY + (r - 6) * COSTUME_SCALE;
      const peel = Math.round(openCells * (1 - Math.abs(r - 6) / 13));
      pxRect(ctx, SCALE_LIT, doorX - (half + 1) * COSTUME_SCALE - peel, edgeY, 6, COSTUME_SCALE, 1);
      pxRect(ctx, SCALE_DARK, doorX + (half + 1) * COSTUME_SCALE + peel, edgeY, 6, COSTUME_SCALE, 1);
      if (r % 2 === 0) {
        pxRect(ctx, BONE_DARK, doorX - (half + 1) * COSTUME_SCALE - peel + 3, edgeY + 1, 3, 3, 1);
        pxRect(ctx, BONE, doorX + (half + 1) * COSTUME_SCALE + peel, edgeY + 1, 3, 3, 1);
      }
    });
    // The pull travels down the seam while the hatch spreads around it.
    const sliderY = doorY - 6 * COSTUME_SCALE + Math.round(openness * 11) * COSTUME_SCALE;
    pxRect(ctx, OUTLINE, doorX - 5, sliderY - 3, 13, 11, 1);
    pxRect(ctx, BONE, doorX - 3, sliderY - 5, 9, 8, 1);
    pxRect(ctx, MAW, doorX, sliderY - 3, 3, 3, 1);
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
  const eased = p * p * (3 - 2 * p);
  const angle = eased * 1.32;
  const fallDir = flip ? 1 : -1;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const pivotX = x0 + cols * BEAST_SCALE * 0.48;
  const pivotY = GROUND_TOP - BEAST_SCALE;
  const impact = Math.max(0, (p - 0.78) / 0.22);
  const compression = 1 - impact * 0.16;
  /*
   * Rotating a CELL GRID spreads its cells apart: at 45° the centres are 1.41× further
   * apart than the cell is wide, so drawing them at their authored size leaves the
   * animal riddled with holes — which rasterised as a speckled, half-transparent beast,
   * i.e. this build's oldest art trap (loose cells over a lit material read as dirt).
   * Growing every cell by the rotation's own spread closes the seams exactly.
   */
  const cell = Math.ceil(BEAST_SCALE * (Math.abs(cos) + Math.abs(sin)));

  for (let r = 0; r < rows; r += 1) {
    const row = BEAST[r]!;
    for (let c = 0; c < row.length; c += 1) {
      const ch = row[c]!;
      if (ch === '.' || ch === ' ') continue;
      const color = BEAST_PALETTE[ch];
      if (!color) continue;
      const dc = flip ? cols - 1 - c : c;
      const sx = x0 + (dc + 0.5) * BEAST_SCALE;
      const sy = y0 + (r + 0.5) * BEAST_SCALE;
      const dx = sx - pivotX;
      const dy = sy - pivotY;
      const x = pivotX + dx * cos - fallDir * dy * sin - BEAST_SCALE / 2;
      const rotatedY = pivotY + (fallDir * dx * sin + dy * cos) * compression;
      const y = Math.min(GROUND_TOP - 2, rotatedY - BEAST_SCALE / 2);
      pxRect(ctx, color, x, y, cell, cell, 1);
    }
  }

  // The final fifth of the fall has a readable impact: a short ground shadow and
  // two outward dust kicks. They are tied to sim progress, and therefore remain an
  // informative state change under reduced motion rather than decorative flicker.
  if (impact > 0) {
    pxRect(ctx, `rgba(26,10,14,${0.45 * impact})`, pivotX - 112, GROUND_TOP - 5, 224, 5, 1);
    for (const side of [-1, 1]) {
      pxRect(ctx, `rgba(231,211,166,${0.55 * impact})`, pivotX + side * (70 + impact * 34), GROUND_TOP - 12 - impact * 18, 10, 10, 2);
      pxRect(ctx, `rgba(188,174,140,${0.45 * impact})`, pivotX + side * (92 + impact * 24), GROUND_TOP - 7 - impact * 10, 7, 7, 2);
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
  pinned = false,
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

  /*
   * The animal, posed: legs stepping while it shifts its weight, the tail and forearm moving
   * with them, and the lower jaw dropped as one piece (see `drawPosedBeast`).
   *
   * `jawOpen` carries the whole wind-up telegraph now that the floor marks are gone (see
   * `drawCone`), which is why it is ramped rather than switched: the jaw parting *is* the
   * warning. The hinge and the tip are `JAW_*`, read off the grid, so the mouth opens where
   * the hazard's fire leaves it.
   */
  drawPosedBeast(
    ctx,
    drawX,
    drawY,
    flip,
    beastPose(state, reduced, pinned),
    Math.min(1, Math.max(0, state.jawOpen)),
    state.phase === 'burning' || state.phase === 'charging',
  );
  drawStompDust(ctx, state, reduced);

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

  /*
   * --- the roar ------------------------------------------------------------
   * The opening beat, and the one thing on this screen that is loud and harmless.
   * Concentric arcs off the jaw, so a player who has never seen a boss knows something
   * is about to happen and that it has not happened yet.
   *
   * **The word ROAR is gone** (owner call: "remove the roar text from screen"). The
   * arcs were always the cue; the word was a caption on them, at scale 3 in the hottest
   * colour on the frame, on a screen that is already carrying a name plate, a costume
   * pip row and a taunt printed on the fire. It was also the one string in the game that
   * described a *sound* rather than naming a problem — everything else on this screen is
   * a hiring word.
   *
   * The `roar` **phase** is untouched: it is the guaranteed-safe opening window
   * (`HAZARDS.DRAGON.ROAR_TIME`) and the only beat the boss cannot be hit in.
   */
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
 *     (`Dragon.streamBoxes`). The old rolling fronts leaned their bright lip 8px
 *     *outside* the hitbox on the side the player met first, which is the
 *     hazard-sprite rule broken in the worst possible direction.
 *
 * The taunt is drawn at `fire.labelAt` — on the flame, and it does not travel with the
 * *growing* front (owner call). When the aim swings after the player (`AIM_*`) the words
 * go with the jet they are written on. The next burst brings the next taunt.
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
     * The rhythm is untouched: `BURST_WINDUP` is still 0.65s, and the aim is held for it,
     * so the jet lights where the beast was looking when it drew breath and then chases.
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
   * Burning, painted **point by point inside the hazard's own squares** (`fire.points` /
   * `fire.boxes`).
   *
   * The jet is aimed at the player now (owner call), so it can leave the jaw at any angle
   * and bend while it swings; the old pass painted per x-column and assumed a flame lying
   * along the floor, which a steep or rising jet is not. Each point is a square as wide as
   * the flame there, and every course is painted *inside* it:
   *
   *  · a deep shell, whose four edges each bite inwards by a stable per-point amount so the
   *    outline is ragged rather than a staircase of equal blocks;
   *  · a mid body that wanders about the axis instead of forming a second straight stripe;
   *  · a broken cream core — hot and continuous near the jaw, pinched and intermittent
   *    further out, so it never reads as a ruler through the orange.
   *
   * Three passes over all the points, not three rects per point, so the courses never
   * interleave where neighbouring squares overlap. The last points taper to a nose. Bites
   * go inwards only: a lip outside the hitbox is fire that cannot hurt anybody.
   */
  const pts = fire.points;
  const q = fire.quenched;
  const cell = 4;
  const frame = reduced ? 0 : Math.floor(t * 14) % 3;
  const n = pts.length;
  const snap = (v: number) => Math.round(v / cell) * cell;
  const noseAt = (i: number) => (n > 4 && i >= n - 3 ? 1 - ((i - (n - 4)) / 3) * 0.45 : 1);
  const shells: { x: number; y: number; w: number; h: number; half: number; cy: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const p = pts[i]!;
    const half = p.half * noseAt(i);
    const a = reduced ? 0.5 : hash2(i, 11 + frame);
    const b = reduced ? 0.5 : hash2(i, 29 + frame);
    const bite = Math.min(half * 0.5, 2 + a * half * 0.35);
    const biteLow = Math.min(half * 0.5, 1 + b * half * 0.25);
    const left = p.x - half + snap(bite * b);
    const right = p.x + half - snap(bite * (1 - b));
    const top = p.y - half + snap(bite);
    const bottom = Math.min(GROUND_TOP, p.y + half) - snap(biteLow);
    const w = Math.max(cell, right - left);
    const h = Math.max(cell, bottom - top);
    shells.push({ x: left, y: top, w, h, half, cy: p.y });
    pxRect(ctx, FIRE_DEEP, left, top, w, h, cell);
  }
  for (let i = 0; i < n; i += 1) {
    const s = shells[i]!;
    const a = reduced ? 0.5 : hash2(i, 37 + frame);
    const inner = Math.max(cell, s.h * (0.46 + a * 0.16));
    const innerW = Math.max(cell, s.w * 0.7);
    const iy = Math.max(s.y, Math.min(s.y + s.h - inner, s.cy - inner / 2 + (a - 0.5) * s.h * 0.2));
    pxRect(ctx, FIRE_MID, s.x + (s.w - innerW) / 2, iy, innerW, inner, cell);
  }
  for (let i = 0; i < n; i += 1) {
    const s = shells[i]!;
    const near = i < n * 0.25;
    if (!near && (i + frame) % 5 === 0) continue;
    const a = reduced ? 0.5 : hash2(i, 43 + frame);
    const core = Math.max(cell, s.h * (near ? 0.3 : 0.14 + a * 0.07));
    const coreW = Math.max(cell, s.w * (near ? 0.6 : 0.4));
    const cy = Math.max(s.y, Math.min(s.y + s.h - core, s.cy - core / 2));
    pxRect(ctx, near ? FIRE_HOT : FIRE_CORE, s.x + (s.w - coreW) / 2, cy, coreW, core, cell);
  }
  // The root, on the first point: the fire is visibly coming out of the animal rather
  // than starting in the air near it. Centred on that point's square, so it stays inside
  // it at whatever angle the jet leaves the jaw.
  const first = pts[0];
  if (first) {
    pxRect(ctx, FIRE_HOT, first.x - 8, first.y - 12, 16, 24, 4);
    pxRect(ctx, FIRE_CORE, first.x - 8, first.y - 4, 16, 8, 4);
  }
  // Where it has landed: uneven tongues licking up off the floor, which is what separates
  // "fire splashing on the ground" from "a bar of light ending". Each tongue stays inside
  // the square of the point it rises from (that square's bottom is the floor).
  for (let i = 0; i < n; i += 2) {
    const p = pts[i]!;
    if (!p.onFloor) continue;
    for (let k = 0; k < 2; k += 1) {
      const r = hash2(i * 3 + k, 43);
      const h = Math.min(p.half * 2 - 4, 14 + r * 26);
      const x = p.x - p.half + 4 + ((k + r) / 2) * (p.half * 2 - 20);
      pxRect(ctx, FIRE_DEEP, x, GROUND_TOP - h, 12, h, 4);
      pxRect(ctx, FIRE_MID, x + 2, GROUND_TOP - h * 0.6, 7, h * 0.6, 4);
    }
  }
  // Steam where the water is winning, boiling off the top of the jet: two staggered rows
  // of varied cells, so it has a top and a bottom rather than reading as a dashed line.
  if (q > 0.01 && n > 1) {
    for (let i = 0; i < 7; i += 1) {
      const r = hash2(i, 23);
      const p = pts[Math.round((i / 6) * (n - 1))]!;
      const s = 10 + Math.round(r * 12);
      const sy = p.y - p.half - 10 - Math.round(r * 26) - (i % 2) * 14;
      pxRect(ctx, `rgba(233,246,250,${0.5 + 0.4 * q * r})`, p.x - s / 2, sy, s, s, 4);
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
   *  · **at the flame's angle** — `ctx.rotate(fire.labelAngle)`, the jet's own direction
   *    there, computed once in the hazard so the words cannot disagree with the shape.
   *  · **it does not come forward** — the point is a fraction of the *whole* jet's length,
   *    not of the grown part, so the flame grows *through* the words rather than pushing
   *    them along; when the aim swings, the words go with the jet.
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
 *
 * **…and then the bell came off** (owner call: the tip "looks like a dickhead"). A thin
 * shaft running into a round, symmetric knob with a slit across its face is exactly that
 * silhouette, and the idle drip hanging off the end made it worse. What replaced it is
 * built to be asymmetric and hard-edged, which is what a machine looks like:
 *
 *  · a **top rail** over the barrel, flush with the housing's lit rail, so the top line
 *    runs straight from the tank to the muzzle and there is no "neck";
 *  · a **boxy nozzle block** that sits *low* (rows 6–13 against the barrel's 7–10), with a
 *    flat front face, a chamfered bottom corner and two vent slots down its side — a
 *    muzzle brake, not a bulb;
 *  · the bore as a **dark notch in the face** with the pressure lit behind it, framed by a
 *    lit lip above and below;
 *  · a **foregrip** under the barrel, which is also the second hand the size promised.
 *
 * The bore stays on rows 8–9, so `muzzleY` and the jet's exit line are unchanged.
 */
const CANNON: readonly string[] = [
  '.....KKKKKKKKKKK....................',
  '....KLTTTTTTTTTTLK..................',
  '....KttttttttttttK..................',
  '....KKttttttttttKK..................',
  '...KBBBBBBBBBBBBBBBKKKKKKKKKKKKKK...',
  '...KbbbbbbbbbbbbbbbKBBBBBBBBBBBBK...',
  '...KbbbbbbbbbbbbbbbKKKKKKKKKKKKKKKKK',
  '...KbbbbbbbbbbbbbbbKCCCCCCCKNNNNNNCK',
  '...KbbbbbbbbbbbbbbbKcccccccKnnnnnoaa',
  '...KbbbbbbbbbbbbbbbKcccccccKnananoaa',
  '...KbbbbbbbbbbbbbbbKcccccccKnanannCK',
  '...KbbbbbbbbbbbbbbbKKKKKKKKKnanannCK',
  '...KKKbbbbbKKbbbbbKK.KGGK..KnnnnnnK.',
  '......KGGGK.KggggK...KggK..KKKKKKK..',
  '......KgggK.KKKKKK...KKKK...........',
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
  c: WATER_DEEP, // barrel
  C: WATER, // its lit top course, and the lip around the bore
  n: '#24424D', // the nozzle block — steel, a step darker than the housing
  N: '#4E7280', // its top course
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
    // Charged and idle: a pilot light on the housing (grid cols 15–16, rows 8–9). It used
    // to be two cells hanging off the end of the bore, which on this silhouette read as a
    // drip — the last thing the tip needed. Few cells at full alpha say "live"; many at
    // low alpha say "rendering fault" (the badge halo lesson).
    const pilotX = facing === 1 ? x + 15 * CANNON_SCALE : x + 19 * CANNON_SCALE;
    pxRect(ctx, WATER, pilotX, y + 8 * CANNON_SCALE, 4, 4, 2);
    pxRect(ctx, WATER_LIT, pilotX + (facing === 1 ? 2 : 0), y + 8 * CANNON_SCALE, 2, 2, 2);
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
const CANDIDATES_ART: readonly (readonly string[])[] = [
  [
    '...KKKK...', '..KhhhhK..', '.KhffffhK.', '.KhfeefhK.', '..KffffK..',
    '.KKTTTTKK.', 'KaaTTTTaaK', '.KaTTTTaK.', '..KTTTTK..', '..KllllK..',
    '..KllKlK..', '..Kl..lK..', '..Ko..oK..', '.Koo..ooK.', '.KKK..KKK.',
  ],
  [
    '..KKKKKK..', '.KhhhhhhK.', 'KhhffffhhK', 'KhffefffhK', '.KffffffK.',
    '.KTTTTTTK.', 'KaTTTTTTaK', 'KaTTTTTTaK', '.KTTTTTTK.', '..KllllK..',
    '..KllKlK..', '..Kl..lK..', '..Ko..oK..', '.Koo..ooK.', '.KKK..KKK.',
  ],
  [
    '...KKKK...', '..KhffhK..', '..KffffK..', '..KfeefK..', '..KffffK..',
    '.KTTTTTTK.', 'KaTTTTTTaK', 'KaTTTTTTaK', '.KTTTTTTK.', '..KllllK..',
    '..KllKlK..', '..Kl..lK..', '..Ko..oK..', '.Koo..ooK.', '.KKK..KKK.',
  ],
  [
    '..KKKKKK..', '.KhhhhhhK.', '.KhffffhK.', '.KhfeefhK.', '.KhffffhK.',
    'KhhTTTThhK', 'KhaTTTTahK', '.KaTTTTaK.', '..KTTTTK..', '..KllllK..',
    '..KllKlK..', '..Kl..lK..', '..Ko..oK..', '.Koo..ooK.', '.KKK..KKK.',
  ],
  [
    '...KKKK...', '..KffffK..', '..KfeefK..', '..KffffK..', '..KfhhfK..',
    '.KKTTTTKK.', 'KaaTTTTaaK', '.KaTTTTaK.', '..KTTTTK..', '..KllllK..',
    '..KllKlK..', '..Kl..lK..', '..Ko..oK..', '.Koo..ooK.', '.KKK..KKK.',
  ],
];

/** Scale 4 → a 40×60 adult, aligned with the hero's drawn 48×60 silhouette. */
const CANDIDATE_SCALE = 4;

/** Distinct skin, hair, clothing and trouser values; silhouette differences live above. */
const CANDIDATE_PALETTES: readonly Palette[] = [
  { K: '#10222A', h: '#2A1C14', f: '#D9A57A', e: '#22323A', T: '#E9F1F5', a: '#D9A57A', l: '#26454F', o: '#161616' },
  { K: '#10222A', h: '#160F0A', f: '#A9714A', e: '#22323A', T: '#9FE6C4', a: '#A9714A', l: '#1E3A44', o: '#161616' },
  { K: '#10222A', h: '#3A2A16', f: '#E9BE94', e: '#22323A', T: '#A8ECFA', a: '#E9BE94', l: '#26454F', o: '#161616' },
  { K: '#10222A', h: '#1E1410', f: '#C08A5E', e: '#22323A', T: '#CFE6EC', a: '#C08A5E', l: '#173039', o: '#161616' },
  { K: '#10222A', h: '#4B2E20', f: '#B97952', e: '#22323A', T: '#F0D9A7', a: '#B97952', l: '#203B48', o: '#161616' },
];

export function drawHiredCandidates(
  ctx: CanvasRenderingContext2D,
  candidates: CandidateState[],
  t: number,
  reduced: boolean,
): void {
  const artW = Math.max(...CANDIDATES_ART.map((art) => maxWidth(art)));
  const artH = Math.max(...CANDIDATES_ART.map((art) => art.length));
  const w = artW * CANDIDATE_SCALE;
  const h = artH * CANDIDATE_SCALE;

  candidates.forEach((c, i) => {
    if (c.progress <= 0) return;
    const art = CANDIDATES_ART[i % CANDIDATES_ART.length]!;
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
      drawPixels(ctx, art, palette, x, y + bob, {
        scale: CANDIDATE_SCALE,
        flip: c.dir < 0,
      });
      if (!reduced) {
        // The leading leg, thrown out in front. Two cells: at this size a leg is a mark,
        // not a limb.
        pxRect(ctx, palette.l!, x + (c.dir < 0 ? -6 : w - 2), y + h - 14 + bob, 9, 7, 2);
      }
    } else {
      drawPixels(ctx, art, palette, x, y, { scale: CANDIDATE_SCALE });
      // Distinct celebration silhouettes: alternating high/side arms keep the five
      // from resolving into one repeated row even when their clothes share a value.
      const leftHigh = i % 2 === 0;
      const leftY = y + (leftHigh ? 5 : 14);
      const rightY = y + (leftHigh ? 14 : 5);
      pxRect(ctx, palette.T!, x - 7, leftY, 9, leftHigh ? 18 : 13, 2);
      pxRect(ctx, palette.T!, x + w - 2, rightY, 9, leftHigh ? 13 : 18, 2);
      pxRect(ctx, palette.a!, x - 6, leftY - 4, 6, 6, 2);
      pxRect(ctx, palette.a!, x + w, rightY - 4, 6, 6, 2);
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
