/**
 * The Workplace screen's painting (screen 3).
 *
 * Pure: everything here takes level data, the hazard's snapshot and a clock, then
 * draws. No wall clock read inside, no DOM, no host state — so the whole screen
 * rasterises on its own, which is the only way any of it gets checked.
 *
 * The picture has two states and the badge is the hinge between them:
 *
 *  - **Found:** the lights strike and fail, the floor is cold and wet, striped
 *    barricades and cones stand across it, tape is strung post to post, and one
 *    figure is mummified in three layers of that same tape, trudging one way.
 *  - **Restored:** the colleague who was under the tape is at the terminal, the
 *    chime has gone, and every barricade, cone, sign, strip of tape and all of the
 *    gloom went with it. Nothing here fades on a timer — `restore` only moves
 *    because somebody made it move, which is the argument of the screen.
 *
 * **Two hazard tapes, and they are deliberately different colours.** Caution yellow
 * (`#E8C23A`) is machinery yellow and belongs to the *room*: barricades, cones,
 * signs, the tape strung post to post. The figure is bound in **red barrier tape**
 * (`WRAP_TAPE`) instead. That is an owner call and it is a legibility one — a
 * wrapped man in the same yellow as nine props standing round him merged into the
 * set, which is the whole problem the props' 0.78 alpha was already working around.
 * Red also means the right thing on him: the room is *cautioned off*, he is
 * *condemned*, and it is the one warm value on the screen the fire orbs can burn
 * *away from* rather than into.
 *
 * The reserved value orange appears in two places, both of them the ANSR
 * capability itself: the cutter the badge puts in the player's hand, and the fire it
 * throws. Nothing else on this screen is allowed to be orange.
 */
import { RESOLUTION } from '../data/tuning.config';
import type { ClutterSpec } from '../data/levels';
import { pxRect, drawPixels, hash2, type Palette } from './PixelArt';
import { drawText } from './PixelText';
import { CEILING, WORK_PODS, POD_SCREEN, CABINETS, WINDOW } from './scenery';
import type { BandageState, MummyState, ShotState } from '../world/Hazards/Workplace';
import type { AABB } from '../world/Physics';

const { WIDTH: W, HEIGHT: H, TILE: T } = RESOLUTION;
const GROUND_TOP = 15 * T;

/** Authored at 20×26 and drawn at scale 3, i.e. exactly the 60×78 hitbox. */
export const SCALE = 3;
const COLS = 20;

/** The ROOM's caution tape: machinery yellow, black ticks. Props only. */
const TAPE = '#E8C23A';
const TAPE_SHADE = '#B8942A';
const TAPE_TICK = '#1A1A1A';
const TAPE_LIT = '#F4DC7A';

/**
 * The FIGURE's tape: red barrier tape with pale ticks.
 *
 * A separate palette rather than a separate alpha, because the two tapes are
 * doing different jobs and the first cut proved that no amount of holding the props
 * back separates them: nine yellow shapes and one yellow figure is ten yellow
 * shapes. Red against pale cloth is the highest-contrast pairing available here
 * that is not the reserved orange, and it survives the burn — an ember front
 * running along a red band is legible in a way one running along a yellow band is
 * not, because the ember is the lighter of the two.
 */
const WRAP_TAPE = '#D2402C';
const WRAP_TAPE_SHADE = '#8E2216';
/**
 * Near-black, where the room's tape has near-black ticks against yellow and this one
 * first had *near-white* ones against red.
 *
 * Pale ticks on red over pale cloth rasterised as holes punched in the tape — the
 * ticks were the cloth's own value, so the band read as a red frame round bits of
 * bandage rather than as a strip laid over it. A tick has to be darker than both the
 * tape and the thing under it.
 */
const WRAP_TAPE_TICK = '#3E0C04';
const WRAP_TAPE_LIT = '#E86A52';

/*
 * The DAMAGE props' tones: warm, and a value or two above the furniture.
 *
 * The rule they obey is unchanged — a thing that has gone wrong has to be the thing you
 * notice, so it is lighter than the furniture it stands next to (the inverse of the rule
 * the furniture itself obeys against the wall). What changed is the temperature. They were
 * `#17566A`/`#46A6BC`, i.e. the same teal the desks used to be, and against the warm room
 * the owner asked for they rasterised as blue plastic trays in a brown cabinet. The room
 * moved; the mess had to move with it.
 */
const DAMAGE = '#5E5445';
const DAMAGE_LIT = '#A2937A';
const DAMAGE_DEEP = '#332C22';

const BANDAGE = '#EFE9DA';
const BANDAGE_SHADE = '#C6BEA8';
const BANDAGE_DEEP = '#948C77';
const OUTLINE = '#10222A';

/** Fire, in the order it cools: white-hot core → flame → ember → ash → soot. */
const FIRE_CORE = '#FFF6DC';
const FIRE_HOT = '#FFB04A';
const FIRE = '#FF5400';
const FIRE_DEEP = '#8E1F0A';
const ASH = '#6E6A63';
const SOOT = '#3A3630';

/** One tape's three tones, so the strip and band code can paint either kind. */
interface TapeTone {
  ground: string;
  shade: string;
  tick: string;
  lit: string;
}
const ROOM_TAPE: TapeTone = { ground: TAPE, shade: TAPE_SHADE, tick: TAPE_TICK, lit: TAPE_LIT };
const BODY_TAPE: TapeTone = {
  ground: WRAP_TAPE,
  shade: WRAP_TAPE_SHADE,
  tick: WRAP_TAPE_TICK,
  lit: WRAP_TAPE_LIT,
};

/**
 * One figure, one silhouette, two palettes.
 *
 * The pose is the mummy read: arms straight out ahead, shoulders square, legs
 * stiff. It is also, unchanged, the pose of somebody reaching for a keyboard —
 * which is why there is no second sprite. Swapping grids at the unwrap would have
 * made it a substitution (monster becomes human) and the whole point of the screen
 * is that it never was one: the same body is under the tape the entire time, and
 * stripping a layer reveals more of the same man.
 *
 * Region characters, so one grid can be read as bandages or as a colleague:
 * `h` hair · `f` face · `e` eye slit · `T`/`S` torso + shade ·
 * `a` upper arm (sleeve) · `r` forearm (bare — the rolled sleeves) · `H` the fist
 * at the end of the reach · `l`/`L` leg + shade · `o` shoe · `K` outline.
 *
 * The body sits in columns 1–13 with the reach running out to 19, so only three of
 * the sixty pixels of the hitbox are empty. It was nine on the first authoring
 * (columns 0–2 unused, mirrored to the other side when he turns) — the hazard sprite
 * rule pointing the wrong way, i.e. a strip of box that hits the player from
 * nothing.
 */
export const FIGURE: readonly string[] = [
  // Head: six rows, corners cut top and bottom, so the skull is a rounded box
  // rather than the flat-topped 8-row slab this used to be. That slab was 31% of
  // the figure's height and it is what made him read as a bollard: a head is worth
  // about a sixth of a person, and the rows it gives back are what the legs needed.
  '....KKKKKKK.........',
  '...KhhhhhhhK........',
  '...KfffffffK........',
  '...KeeeeeeeK........',
  '...KeEeeeEeK........',
  '....KfffffK.........',
  // A neck. Without one the head and the shoulders are one mass, which is the other
  // half of why the old silhouette had no joints in it.
  '.....KfffK..........',
  // Shoulders slope in one step before the torso reaches full width.
  '..KTTTTTTTTTK.......',
  '.KaTTTTTTTTTaKKKKKKK',
  '.KaTTTTTTTTTarrrrHHK',
  '.KaTTTTTTTTTarrrrHHK',
  '.KaTTTTTTTTTaKKKKKKK',
  '.KTTTTTTTTTTTK......',
  '.KTTTTTTTTTTTK......',
  '.KSSSSSSSSSSSK......',
  '..KSSSSSSSSSK.......',
  '..KlllllllllK.......',
  // …and TWO legs, with a real gap between them.
  //
  // The old grid split the legs with a single outline column, i.e. 3px of dark
  // inside a solid slab, and rasterised as one block with a line scored down it.
  // Nine rows of 9px leg either side of a transparent column — with the room
  // showing through — is what makes a walk cycle possible to see at all.
  '..KlllK.KlllK.......',
  '..KlLLK.KLLlK.......',
  '..KlLLK.KLLlK.......',
  '..KlLLK.KLLlK.......',
  '..KlLLK.KLLlK.......',
  '..KlLLK.KLLlK.......',
  '..KlllK.KlllK.......',
  '..KoooK.KoooK.......',
  '..KKKKK.KKKKK.......',
];

/**
 * The colleague: shirt, sleeves rolled to the forearm, work trousers.
 *
 * Row 3 is the trick that lets one grid be both readings. Wrapped it is a
 * continuous dark slit across the head — the single most recognisable thing about
 * a mummy. Freed, the same row is skin with two eyes in it (`E`), because `e`
 * paints as skin here and as void in the wrap.
 */
const HUMAN: Palette = {
  K: OUTLINE,
  h: '#2A1C14',
  f: '#D9A57A',
  e: '#D9A57A',
  E: '#22323A',
  T: '#E9F1F5',
  S: '#BED0D9',
  a: '#E9F1F5',
  r: '#D9A57A',
  H: '#C08F66',
  l: '#26454F',
  L: '#173039',
  o: '#161616',
};

/**
 * The same body under the wrap.
 *
 * Near-white on purpose. The first pass used a beige at roughly the tape's own
 * value and the two merged: rasterised, the figure was a yellow striped pillar
 * rather than a wrapped man with tape on him. Cloth has to be the *lightest* thing
 * on a dark floor for the silhouette to carry, and the tape has to sit on it as
 * accent rather than as camouflage.
 */
const WRAP: Palette = {
  K: OUTLINE,
  h: BANDAGE,
  f: BANDAGE,
  e: '#0A1418',
  E: '#0A1418',
  T: BANDAGE,
  S: BANDAGE_SHADE,
  a: BANDAGE_SHADE,
  r: BANDAGE,
  H: BANDAGE_SHADE,
  l: BANDAGE,
  L: BANDAGE_SHADE,
  o: BANDAGE_DEEP,
};

/**
 * The wound cloth: a seam on every other row of the silhouette.
 *
 * This, not the tape, is what makes him a mummy. It was every *third* row in the
 * deepest bandage tone, and against nine broad bands of caution yellow it did not
 * register at all — rasterised, the figure was a yellow striped pillar with a dark
 * visor, i.e. a man in protective kit. Wrapping is a *close, repeating* pattern, so
 * the seams run every two rows and the tape came down to a few narrow accents
 * (`BANDS`). Two tones alternate so the cloth has a direction to it.
 *
 * Derived from the grid rather than authored again, so it can never drift out of the
 * silhouette.
 */
const SEAMS: readonly string[] = FIGURE.map((row, r) =>
  r % 2 === 1
    ? // The eye cells are held out. Row 3 is odd, so the first version of this
      // painted a seam straight over the slit and closed it — and the dark slit is
      // the one feature the head has. Anything that draws *across* the silhouette
      // has to know which cells are holes in it.
      row.replace(/[eE]/g, '.').replace(/[^K.]/g, r % 4 === 1 ? 'w' : 'v')
    : '.'.repeat(row.length),
);
const SEAM_PALETTE: Palette = { w: BANDAGE_DEEP, v: BANDAGE_SHADE };

/**
 * The tape layers, in the order they come off.
 *
 * `need` is how many layers must still be on for a band to show, so three hits
 * peel him in three legible steps rather than fading one sprite out: at 3 he is
 * bound head to shoe *and* across the arms, at 2 the shirt shows through, at 1
 * only the chest and shins are still tied. Rows/columns are authored cells.
 */
export const BANDS: readonly { row: number; h: number; col: number; w: number; need: number }[] = [
  // Outermost: brow, jaw, waist, one round each shin. Never across the eye slit —
  // that gap is the single thing that makes the head read as a head. All of them are
  // ONE cell tall: the first authoring used two- and three-row bands and nine of
  // those cover 40% of the body, at which point the tape stops being an accent on
  // wound cloth and becomes the material he is made of.
  { row: 2, h: 1, col: 4, w: 7, need: 3 },
  { row: 5, h: 1, col: 5, w: 5, need: 3 },
  { row: 14, h: 1, col: 2, w: 11, need: 3 },
  // Below the hips a band has to be authored PER LEG. There is a transparent column
  // between the legs now, and one strip spanning both would tape the gap shut —
  // which is the same class of error as the seam pass closing the eye slit, and it
  // would undo the silhouette the gap exists to buy.
  { row: 22, h: 1, col: 3, w: 3, need: 3 },
  { row: 22, h: 1, col: 9, w: 3, need: 3 },
  // Second layer: chest, the inner half of the reach, thighs.
  { row: 8, h: 1, col: 2, w: 11, need: 2 },
  // Only the inner half of the arm: taped to the elbow, so the wrapped fist at the
  // end of the reach stays pale and the outstretched arm reads as an arm rather than
  // as one more strip of tape sticking out of him.
  { row: 9, h: 2, col: 13, w: 2, need: 2 },
  { row: 18, h: 1, col: 3, w: 3, need: 2 },
  { row: 18, h: 1, col: 9, w: 3, need: 2 },
  // Last layer: the two that actually hold his arms in, and one round each knee.
  { row: 10, h: 2, col: 2, w: 11, need: 1 },
  { row: 20, h: 1, col: 3, w: 3, need: 1 },
  { row: 20, h: 1, col: 9, w: 3, need: 1 },
];

/**
 * One strip of hazard tape: a coloured ground, sheared ticks, big pixels.
 *
 * `tone` decides which of the two tapes it is — the room's yellow or the figure's
 * red. It is a parameter rather than two near-identical functions because the
 * stepping arithmetic is the only thing here worth having once.
 */
function tapeStrip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 1,
  tickPhase = 0,
  tone: TapeTone = ROOM_TAPE,
): void {
  if (w <= 0 || h <= 0) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  pxRect(ctx, tone.ground, x, y, w, h, 2);
  if (h >= 6) pxRect(ctx, tone.lit, x, y, w, 2, 2);
  pxRect(ctx, tone.shade, x, y + h - 2, w, 2, 2);
  for (let i = tickPhase % 12; i < w - 2; i += 12) {
    pxRect(ctx, tone.tick, x + i, y, Math.min(5, w - i), h - 2, 2);
  }
  ctx.globalAlpha = prev;
}

/**
 * A band of the figure's tape mid-burn: an ember front eating along it, ash behind.
 *
 * This is the picture of a hit the simulation booked several frames ago
 * (`MummyState.burn`), and it is the whole point of the fire orbs — the owner asked
 * for the tape to be seen *burning and getting ashed* rather than simply switching
 * off. Three zones, in 2px cells, left to right:
 *
 *  - behind the front: **ash**, thinning and dropping away, so the band does not
 *    just shorten (a band that shortens reads as a wipe);
 *  - the front itself: three cells of white-hot core and flame, the only place on
 *    this figure anything is that bright;
 *  - ahead of the front: tape that has not caught yet.
 *
 * The front runs in the direction the orb was travelling, which is why `dir` is
 * passed: fire that eats towards the shot is fire that reads backwards.
 */
function burningBand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  p: number,
  dir: -1 | 1,
): void {
  if (w <= 0 || h <= 0) return;
  const cell = 2;
  const front = w * Math.min(1, p * 1.15);
  for (let i = 0; i < w; i += cell) {
    // Distance of this cell *behind* the front, measured along the burn.
    const u = dir === 1 ? i : w - cell - i;
    const d = u - front;
    const cx = x + i;
    if (d > 4) {
      // Not caught yet.
      pxRect(ctx, WRAP_TAPE, cx, y, cell, h, cell);
      pxRect(ctx, WRAP_TAPE_SHADE, cx, y + h - cell, cell, cell, cell);
    } else if (d > -2) {
      pxRect(ctx, FIRE_CORE, cx, y - cell, cell, h + cell * 2, cell);
    } else if (d > -8) {
      pxRect(ctx, FIRE, cx, y - cell, cell, h + cell, cell);
      pxRect(ctx, FIRE_HOT, cx, y - cell, cell, cell, cell);
    } else if (d > -16) {
      pxRect(ctx, FIRE_DEEP, cx, y, cell, h, cell);
    } else {
      // Ash: the band is still there for a moment, grey and coming apart. Cells drop
      // out on a stable hash, so it crumbles rather than fading as a whole.
      const n = hash2(Math.round(cx / cell), Math.round(y / cell) + 11);
      if (n > p * 0.9) pxRect(ctx, n > 0.6 ? ASH : SOOT, cx, y, cell, h, cell);
    }
  }
}

/**
 * What is left where a band used to be: a soot mark on the cloth.
 *
 * Permanent for the rest of the screen, and the reason the three hits read as
 * progress on the *body* rather than only on the three pips over his head. Low alpha
 * on near-white cloth is legitimate here — it is dirt on a light surface, which is
 * the one thing low-alpha dark is good for.
 */
function scorchBand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  pxRect(ctx, 'rgba(58,54,48,0.5)', x, y, w, h, 2);
  for (let i = 0; i < w; i += 4) {
    if (hash2(Math.round((x + i) / 4), Math.round(y / 4) + 3) > 0.55) {
      pxRect(ctx, 'rgba(58,54,48,0.32)', x + i, y - 2, 4, 2, 2);
    }
  }
}

// ---------------------------------------------------------------------------
// The figure
// ---------------------------------------------------------------------------

/**
 * The figure on the floor: the body, the wrap, the tape and the loose ends.
 *
 * The hitbox is the sprite and nothing but the sprite (20×32 at scale 2 = the
 * authored 40×64). Only the trailing bandage ends fall outside it, and they are
 * drawn *behind* him and only while he is wrapped, so they can never promise reach
 * the rules do not give.
 *
 * The trudge is driven by his own x position, not by the clock: a distance-driven
 * gait can never look like it is running on the spot, and it stays in step with a
 * position the simulation owns.
 */
export function drawMummies(
  ctx: CanvasRenderingContext2D,
  mummies: MummyState[],
  t: number,
  reduced: boolean,
): void {
  for (const m of mummies) {
    const { box } = m;
    const cx = box.x + box.w / 2;
    const flip = m.dir < 0;
    const wrapped = m.layers > 0;

    // He never teleports any more, so nothing here needs to be faded in. The old
    // `returning` ramp existed because he snapped back to his start column; pacing
    // to and fro means the only thing to draw at either end is the pivot itself.
    const prev = ctx.globalAlpha;

    // Trudge: a two-frame lurch every 24px of floor, plus the stiff-legged lean
    // that goes with it. Held at the low frame through the turn — he is standing
    // still, and a figure bobbing on the spot is the treadmill read the
    // distance-driven gait exists to avoid. Zero under reduced motion.
    const still = m.phase === 'turning' || m.phase === 'winding';
    const gait = reduced || still ? 0 : Math.floor(box.x / 24) % 2;
    const bob = wrapped ? gait * 2 : 0;
    const top = box.y + bob;

    // Contact shadow, so he is planted on the floor rather than hovering over it.
    pxRect(ctx, 'rgba(0,14,20,0.4)', box.x + 4, box.y + box.h - 3, box.w - 8, 4, 1);

    // Loose ends trailing off the wrap — the tell that he is *bound*, not just
    // badly dressed. They shorten with every layer that comes off.
    if (wrapped) {
      // One short end off the hip, three steps, tucked against the body. Longer
      // versions and a second end were both tried and both rasterised as a small
      // ladder standing beside him: an end has to read as attached, and the
      // figure carries the mummy read on its own.
      const wag = reduced ? 0 : Math.round(Math.sin(t * 5) * 3) * 3;
      const back = flip ? 1 : -1;
      const rootX = flip ? box.x + box.w - 12 : box.x + 3;
      for (let k = 0; k < 3; k += 1) {
        tapeStrip(
          ctx,
          rootX + back * (3 + k * 5),
          top + 46 + k * 6 + wag,
          9,
          5,
          0.85,
          k * 4,
          BODY_TAPE,
        );
      }
    }

    drawPixels(ctx, FIGURE, HUMAN, box.x, top, { scale: SCALE, flip });

    if (wrapped || m.phase === 'unravelling') {
      // The wrap thins as it comes off: opaque while he is fully bound, half there
      // on the last layer, gone through the unravel.
      const cover =
        m.phase === 'unravelling'
          ? 1 - m.progress
          : m.layers >= 3
            ? 1
            : m.layers === 2
              ? 0.82
              : 0.5;
      drawPixels(ctx, FIGURE, WRAP, box.x, top, { scale: SCALE, flip, alpha: cover });
      drawPixels(ctx, SEAMS, SEAM_PALETTE, box.x, top, {
        scale: SCALE,
        flip,
        alpha: cover * 0.9,
      });

      const layers = m.phase === 'unravelling' ? Math.ceil(1 - m.progress) : m.layers;
      const fade = m.phase === 'unravelling' ? 1 - m.progress : 1;
      /*
       * Three states per band, and the middle one is the whole owner note.
       *
       *  · still on   → tape;
       *  · **burning** → an ember front eating along it and ash coming off, for
       *    `BURN_TIME` after the orb landed (`burningBand`);
       *  · gone       → a soot mark on the cloth, permanently (`scorchBand`), so the
       *    body carries the score rather than only the pips over his head.
       *
       * The burn is driven off the hazard's own clock, never a render-local timer, for
       * the same reason the badge's position has one source: two opinions about which
       * layer is coming off is a picture that contradicts the rules.
       */
      const burnDir: -1 | 1 = flip ? -1 : 1;
      for (const b of BANDS) {
        // Flip mirrors the band's column window too, so the arm wrap stays on the
        // arm when he faces the other way.
        const col = flip ? COLS - b.col - b.w : b.col;
        const bx = box.x + col * SCALE;
        const by = top + b.row * SCALE;
        const bw = b.w * SCALE;
        const bh = b.h * SCALE;
        if (layers >= b.need) {
          tapeStrip(ctx, bx, by, bw, bh, fade, b.row * 3, BODY_TAPE);
        } else if (b.need === m.burning && m.burn < 1) {
          burningBand(ctx, bx, by, bw, bh, m.burn, burnDir);
        } else {
          scorchBand(ctx, bx, by, bw, bh);
        }
      }
      // Ash flaking off whatever is burning, falling clear of the body.
      if (m.burning > 0 && m.burn < 1) {
        for (let i = 0; i < 6; i += 1) {
          const fall = m.burn * (18 + i * 9);
          const drift = (i % 2 === 0 ? -1 : 1) * m.burn * 6;
          pxRect(
            ctx,
            i % 3 === 0 ? FIRE_HOT : i % 3 === 1 ? ASH : SOOT,
            box.x + 8 + i * 9 + drift,
            top + 26 + i * 6 + fall,
            3,
            3,
            1,
          );
        }
      }
    }

    // The last of it going: ash and ember, not tape. By this point every band has
    // been burnt off, so strips of intact tape falling away would contradict the
    // three burns the player just watched.
    if (m.phase === 'unravelling') {
      for (let i = 0; i < 9; i += 1) {
        const fall = m.progress * (48 + i * 16);
        const drift = (i % 2 === 0 ? -1 : 1) * m.progress * 14;
        const a = 1 - m.progress;
        const prevA = ctx.globalAlpha;
        ctx.globalAlpha = prevA * a;
        pxRect(
          ctx,
          i % 4 === 0 ? FIRE_HOT : i % 4 === 1 ? ASH : i % 4 === 2 ? SOOT : FIRE_DEEP,
          box.x - 4 + i * 8 + drift,
          top + 14 + fall,
          4 + (i % 3) * 2,
          4,
          2,
        );
        ctx.globalAlpha = prevA;
      }
    }

    // Winding up a throw: the coil rises out of his fist and the chevrons step out
    // along the line the roll will take. Drawn after the body and the tape, because it
    // is held in front of him.
    if (m.wind > 0) throwWindUp(ctx, box, flip, m.wind);

    // At the keyboard: the outstretched hand is already in the right place, so the
    // work is a two-frame lift of it plus the keystrokes landing. Cheap, and it is
    // the difference between "standing at a desk" and "fixing this".
    if (m.phase === 'working' || m.phase === 'restored') {
      const hit = reduced ? 0 : Math.floor(t * 9) % 2;
      const handX = flip ? box.x + 6 : box.x + box.w - 24;
      pxRect(ctx, '#D9A57A', handX, top + 30 + hit * 4, 18, 8, 2);
      if (!reduced && hit === 1) {
        pxRect(ctx, '#9FE6C4', handX + (flip ? -8 : 20), top + 26, 4, 4, 2);
      }
    }

    ctx.globalAlpha = prev;

    if (wrapped) {
      // Name plate: it labels the obstacle while it *is* one, and stops the moment
      // he stops being one. Cool grey — being taped off is the opposite of value,
      // so it never gets the orange.
      drawText(ctx, m.name, cx, box.y - 14, {
        scale: 1,
        color: '#CFE6EC',
        align: 'center',
        outline: 'rgba(0,20,26,0.9)',
        alpha: 0.85,
      });
      // Three pips: layers left, so the shot count is legible in the world instead
      // of in a HUD element. In HIS tape's colour, not the room's — a yellow pip
      // over a red-taped figure counts something that is not on him.
      for (let i = 0; i < 3; i += 1) {
        pxRect(
          ctx,
          i < m.layers ? WRAP_TAPE : 'rgba(207,230,236,0.22)',
          cx - 13 + i * 10,
          box.y - 28,
          8,
          5,
          2,
        );
      }
    } else if (m.phase === 'working') {
      drawText(ctx, 'ON IT', cx, box.y - 14, {
        scale: 1,
        color: '#9FE6C4',
        align: 'center',
        outline: 'rgba(0,20,26,0.9)',
        alpha: 0.9,
      });
    }
  }
}

/**
 * The coil he raises before he throws — this screen's only telegraph.
 *
 * Owner call: the figure throws his bandages at the player. A ranged attack on a screen
 * whose whole promise is "you can read this man" needs its wind-up to be *on him*, and
 * to grow: the coil rises out of the fist at the end of his reach over `THROW_WINDUP`,
 * gaining a course and a ring as it goes, and three chevrons step out along the line the
 * roll will travel. Everything here is drawn from `MummyState.wind`, which is the
 * simulation's own count of the wind-up, so the tell cannot promise a throw that is not
 * coming (or arrive late for one that is).
 *
 * It is in the figure's red, like every other piece of his tape, and the chevrons are
 * pale rather than orange: orange on this screen is the ANSR capability and nothing else.
 */
function throwWindUp(
  ctx: CanvasRenderingContext2D,
  box: AABB,
  flip: boolean,
  wind: number,
): void {
  const back = flip ? -1 : 1;
  // The fist is at the far end of the reach (columns 17-18 of the grid), which is where
  // the coil has to appear — a wind-up that starts anywhere else is a different animation
  // of a different action.
  const handX = flip ? box.x + 3 : box.x + box.w - 21;
  const handY = box.y + 9 * SCALE;
  const rings = 1 + Math.floor(wind * 3);
  for (let k = 0; k < rings; k += 1) {
    const rw = 18 - k * 2;
    tapeStrip(ctx, handX + (18 - rw) / 2, handY - 4 - k * 5, rw, 5, 1, k * 5, BODY_TAPE);
  }
  // A short length already unwound and hanging off the coil, so it reads as tape rather
  // than as a stack of bars.
  pxRect(ctx, WRAP_TAPE_SHADE, handX + 6, handY + 6, 5, Math.round(6 + wind * 10), 2);
  // Three chevrons stepping out along the throw line — the "it is coming this way" half.
  for (let k = 0; k < 3; k += 1) {
    const on = wind > (k + 1) / 4;
    if (!on) continue;
    const cxx = handX + back * (26 + k * 16);
    /*
     * Each chevron gets a dark backing cell.
     *
     * Rasterised without one they landed on the wet floor sign and the barricades — pale
     * cream over caution yellow — and disappeared. A telegraph's colour has to beat the
     * surface it lands on, and on this floor the only value that beats everything is a
     * light mark with a dark keyline behind it. Same lesson as the dragon's cream
     * wind-up mark, one screen along.
     */
    pxRect(ctx, 'rgba(4,14,18,0.8)', cxx - 2, handY + 16, 12, 16, 2);
    pxRect(ctx, 'rgba(239,233,218,0.9)', cxx, handY + 22, 6, 4, 2);
    pxRect(ctx, 'rgba(239,233,218,0.65)', cxx + back * 4, handY + 18, 4, 4, 2);
    pxRect(ctx, 'rgba(239,233,218,0.65)', cxx + back * 4, handY + 26, 4, 4, 2);
  }
}

/**
 * A thrown bandage in the air: a roll of his own tape, unwinding as it goes.
 *
 * The hitbox is the roll and nothing else (`THROW_W`×`THROW_H`) — the streamers behind
 * it are drawn outside the box and are inert, the same licence the cutter's orb has for
 * its wake. Two things carry the read at 26px:
 *
 *  - it **spins**, and the spin is driven by the distance it has travelled rather than
 *    by a clock, so it can never look like it is rotating on the spot (the same rule the
 *    figure's trudge and the orb's flicker obey);
 *  - it **unwinds**, with two streamers trailing back from it in the tape's shade tone.
 *    A roll with nothing behind it is a wheel.
 */
export function drawBandages(ctx: CanvasRenderingContext2D, bandages: BandageState[]): void {
  for (const b of bandages) {
    const { box } = b;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const back = -b.dir;
    // Streamers: three lengths stepping back from the roll, sagging as they go.
    for (let k = 0; k < 3; k += 1) {
      const sx = cx + back * (box.w / 2 + 2 + k * 9);
      pxRect(ctx, k === 0 ? WRAP_TAPE : WRAP_TAPE_SHADE, sx, cy - 3 + k * 3, 9, 5, 2);
    }
    /*
     * The roll is a DISC, built from a stepped half-width profile.
     *
     * Its first cut was the hitbox filled in — a 26×22 red rectangle with a dark keyline,
     * two dark bars across it and a small hole. Rasterised, that is a red warning box
     * flying down the corridor, not a roll of tape; it is exactly the "round things need a
     * profile, not nested squares" rule the fire orb and the dragon's bursts have each
     * paid for, arriving on a third object. Every column of the box still carries pixels,
     * so the sprite-fills-its-hitbox rule holds.
     */
    const profile: readonly [number, number][] = [
      [1, 13],
      [3, 12],
      [5, 11],
      [7, 9],
      [9, 5],
    ];
    for (const [dy, half] of profile) {
      for (const sign of [-1, 1] as const) {
        const ry = cy + sign * dy - (sign === -1 ? 2 : 0);
        pxRect(ctx, OUTLINE, cx - half, ry, half * 2, 2, 2);
      }
    }
    for (const [dy, half] of profile) {
      for (const sign of [-1, 1] as const) {
        const ry = cy + sign * dy - (sign === -1 ? 2 : 0);
        const inset = 2;
        pxRect(ctx, WRAP_TAPE, cx - half + inset, ry, (half - inset) * 2, 2, 2);
      }
    }
    // Lit crown and shaded base: it is a cylinder seen end-on, so the light is on top.
    pxRect(ctx, WRAP_TAPE_LIT, cx - 9, cy - 9, 18, 2, 2);
    pxRect(ctx, WRAP_TAPE_SHADE, cx - 9, cy + 7, 18, 2, 2);
    /*
     * The core, and two spokes that STEP ROUND with the distance travelled.
     *
     * A pale cardboard core is what says "roll" rather than "ball", and the spokes are the
     * spin: four authored positions, chosen by distance rather than by a clock, so it can
     * never rotate on the spot (the same rule the figure's trudge and the orb's flicker
     * obey).
     */
    const spin = Math.floor(b.travelled / 8) % 4;
    const spokes: readonly [number, number, number, number][] = [
      [-9, -1, 18, 2],
      [-1, -9, 2, 18],
      [-7, -7, 14, 2],
      [-7, 5, 14, 2],
    ];
    const [sx, sy, sw, sh] = spokes[spin]!;
    pxRect(ctx, WRAP_TAPE_TICK, cx + sx, cy + sy, sw, sh, 2);
    pxRect(ctx, BANDAGE_SHADE, cx - 5, cy - 4, 10, 8, 2);
    pxRect(ctx, BANDAGE_DEEP, cx - 3, cy - 2, 6, 4, 2);
  }
}

/**
 * The overhead storage cabinet the ANSR mark falls onto (`role: "pedestal"` in
 * `levels.json`, so the level material never paints over it).
 *
 * It is the owner's "cabinet or something which is before the partition wall", and it is
 * drawn as what it structurally is: a **wall-mounted** unit with brackets back to the
 * plaster, not a cupboard standing on the floor. That distinction is the whole of why
 * the badge is a decision on this screen — the unit floats, leaving 36px over a standing
 * head, so a player holding right walks underneath it and takes nothing, and getting on
 * top means clearing 120px of a 140px jump. Draw it standing on the ground and the
 * pickup is on the path, which is the trap the Compliance perch already paid for.
 */
export function drawOverheadCabinet(
  ctx: CanvasRenderingContext2D,
  rects: readonly AABB[],
  restore: number,
): void {
  const r = Math.max(0, Math.min(1, restore));
  for (const box of rects) {
    // Brackets back to the wall, drawn first so the carcase covers their front edge.
    for (const bx of [box.x + 6, box.x + box.w - 16]) {
      pxRect(ctx, '#1A1712', bx, box.y + box.h, 10, 8, 2);
    }
    pxRect(ctx, OUTLINE, box.x - 2, box.y - 2, box.w + 4, box.h + 4, 2);
    pxRect(ctx, '#1D1A15', box.x, box.y, box.w, box.h, 2); // carcase
    // Two doors with a handle each, and the lit top face the mark stands on. That top
    // edge is doing real work: it is the surface the player has to see they can land on.
    for (let i = 0; i < 2; i += 1) {
      const dx = box.x + 4 + i * (box.w / 2 - 2);
      pxRect(ctx, '#2A251E', dx, box.y + 6, box.w / 2 - 6, box.h - 10, 2);
      pxRect(ctx, '#6F7570', dx + box.w / 4 - 9, box.y + box.h - 12, 12, 3, 2);
    }
    pxRect(ctx, '#3A3328', box.x, box.y, box.w, 4, 2);
    pxRect(ctx, `rgba(226,246,252,${(0.28 + 0.4 * r).toFixed(3)})`, box.x, box.y, box.w, 2, 2);
    pxRect(ctx, '#100E0A', box.x, box.y + box.h - 3, box.w, 3, 2); // its underside, in shadow
  }
}

/**
 * What being caught by him looks like on the player.
 *
 * Drawn over the hero on the frames that follow the delay — the same job the
 * flattened stamp pose does on Setup Delays, and for the same reason: a hazard
 * that stops the stage has to be *seen* to have stopped it, or the overlay reads
 * as arbitrary. Here the room does to the player exactly what it did to the man he
 * walked into: it tapes him up where he stands, arms pinned, one loose end
 * twitching. Presentation only — the sim booked the delay on contact.
 */
export function drawTangled(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  feetY: number,
  t: number,
  reduced: boolean,
): void {
  const w = 46;
  const x = centerX - w / 2;
  const top = feetY - 60;
  const jitter = reduced ? 0 : (Math.floor(t * 10) % 2) * 3 - 1;

  // Three bindings: arms pinned to the ribs, waist, knees together. The head stays
  // clear — the first pass wrapped him from the crown down and rasterised as a
  // stack of yellow bricks with a person somewhere inside it. You have to be able
  // to see whose day this is.
  for (const [dy, ww] of [
    [26, w],
    [40, w - 4],
    [52, w - 14],
  ] as const) {
    const off = dy % 2 === 0 ? jitter : -jitter;
    tapeStrip(ctx, x + (w - ww) / 2 + off, top + dy, ww, 7, 0.95, dy, BODY_TAPE);
  }
  // Loose ends whipping off both sides, and a shred settling on the floor. His
  // tape, not the room's: what caught the player is the figure, and the pose has to
  // say who did it.
  for (let k = 0; k < 3; k += 1) {
    tapeStrip(ctx, x - 8 - k * 6, top + 30 + k * 5 + jitter, 9, 5, 0.85, k * 4, BODY_TAPE);
    tapeStrip(ctx, x + w - 2 + k * 6, top + 44 - k * 5 - jitter, 9, 5, 0.85, k * 4, BODY_TAPE);
  }
  tapeStrip(ctx, x + 8, feetY - 5, 26, 5, 0.7, 4, BODY_TAPE);
}

// ---------------------------------------------------------------------------
// The cutter
// ---------------------------------------------------------------------------

/**
 * The cutter: authored 20×14, drawn at scale 2 → a 40×28 tool.
 *
 * Rebuilt on the owner's note that it was not noticeable enough. What it was: a
 * pale receiver with four orange cells at the nose, i.e. a light box on a screen
 * whose lightest values already belong to the whiteboard and the wrapped figure.
 * Three changes, and all of them are about the tool *announcing itself* rather than
 * about size (scale 3 is still out — at 60×42 it is a plank across the hero's
 * chest, which is the trap this drawing already paid for once):
 *
 *  · the receiver went **dark** with one lit rail, the same rule the room's
 *    furniture obeys, so the bright parts of the tool are the parts that are hot;
 *  · a **glowing ember tank** (`F`/`f`) replaces the reel of tape on top — the tool
 *    burns the tape off rather than slicing it, so a spool of it was the wrong
 *    promise, and a lit tank is the one thing on the hero that says "loaded";
 *  · the **muzzle is a real barrel** — a five-cell housing with a white-hot bore
 *    and two flared cheeks, which is what puts the orange at the end of a shape
 *    instead of on a corner of it.
 */
const CUTTER: readonly string[] = [
  '.......KKKKK........',
  '......KfFFFfK.......',
  '......KfFFFfK.......',
  '...KKKKKKKKKKK......',
  '...KbbbbbbbbbKKKKKK.',
  '...KbBBBBBBBbMMMMMK.',
  '...KbBBBBBBBbMoOoMK.',
  '...KbBBBBBBBbMoOoMK.',
  '...KbbbbbbbbbMMMMMK.',
  '...KKKgGgKKKKKKKKK..',
  '.....KgGgK..........',
  '.....KgGgK..........',
  '.....KgGgK..........',
  '.....KKKKK..........',
];

const CUTTER_PALETTE: Palette = {
  K: OUTLINE,
  /*
   * MID value with a bright rail, not dark.
   *
   * The dark receiver was tried and rasterised as nothing: the tool is held at chest
   * height, which on this screen is exactly where the dark furniture is, so a dark
   * tool in front of dark furniture left the player holding four orange cells. The
   * "furniture goes darker than the wall" rule is about *the room*; a thing the hero
   * carries has to read against whatever he happens to be standing in front of, and
   * the only value that does that here is a mid tone with a lit top rail and a black
   * keyline round the whole shape.
   */
  b: '#1E5A6B', // receiver body
  B: '#8FC4D2', // its lit face
  f: '#8E1F0A', // ember tank, banked
  F: FIRE, // …and burning
  M: FIRE, // muzzle housing (the one orange the player carries)
  o: FIRE_HOT,
  O: FIRE_CORE, // bore, white hot
  g: '#233A44', // grip
  G: '#3C5C69',
};

/** One authored pixel of the tool, in internal px. */
const CUTTER_SCALE = 2;
/** Authored width, so the muzzle and the recoil are derived rather than guessed. */
const CUTTER_COLS = 20;

/**
 * The cutter in the player's hands.
 *
 * Drawn by the host *after* the hero, so it reads as held rather than worn, and
 * only where the badge has armed it. This is the one place the reserved value
 * orange lands on the player: the tool is the active ANSR capability, so the
 * muzzle — and only the muzzle — is allowed to be it.
 *
 * `sinceShot` drives the recoil and the flash. Both come from the hazard's own
 * clock, so neither can disagree with the pulse that actually left the barrel.
 */
export function drawCutter(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  feetY: number,
  facing: -1 | 1,
  sinceShot: number,
  reduced: boolean,
): void {
  const flash = sinceShot < 0.09;
  const kick = sinceShot < 0.12 ? Math.round((1 - sinceShot / 0.12) * 6) : 0;
  const w = CUTTER_COLS * CUTTER_SCALE;
  // Barrel on the orb's own line: chest, not hip.
  const y = feetY - 40;
  const x = facing === 1 ? centerX + 4 - kick : centerX - 4 - w + kick;
  const muzzleY = y + 6 * CUTTER_SCALE;
  const muzzleX = facing === 1 ? x + w : x;

  drawPixels(ctx, CUTTER, CUTTER_PALETTE, x, y, {
    scale: CUTTER_SCALE,
    flip: facing === -1,
  });

  if (flash) {
    // Three-step starburst. The whole flash is over inside a tenth of a second, so
    // it is a punch rather than a strobe.
    const f = 1 - sinceShot / 0.09;
    for (let i = 0; i < 3; i += 1) {
      const len = (8 + i * 7) * f;
      const th = 12 - i * 4;
      pxRect(
        ctx,
        i === 0 ? '#FFF2D0' : i === 1 ? '#FFB07A' : 'rgba(255,84,0,0.5)',
        facing === 1 ? muzzleX : muzzleX - len,
        muzzleY + 2 - th / 2,
        len,
        th,
        2,
      );
    }
    pxRect(ctx, FIRE_CORE, muzzleX - 4, muzzleY - 6, 8, 4, 2);
    pxRect(ctx, FIRE_CORE, muzzleX - 4, muzzleY + 8, 8, 4, 2);
  } else if (!reduced) {
    // Armed and idle: a pilot flame at the bore, at full alpha. A low-alpha glow
    // field was tried here and did exactly what the badge's dithered halo did —
    // over the dark room it desaturated into a grey-brown box that read as a
    // rendering fault. Few cells at full alpha say "live"; many at low alpha do not.
    pxRect(ctx, FIRE, muzzleX - (facing === 1 ? 0 : 6), muzzleY + 2, 6, 4, 2);
    pxRect(ctx, FIRE_CORE, muzzleX - (facing === 1 ? -2 : 6), muzzleY + 2, 2, 4, 2);
  }
}

/**
 * The cutter's ammunition: a small orb of fire.
 *
 * The owner's brief for it, in full — "the bullets can be small orbs of fire that
 * is burning the bandages". It was an 18×6 sliver with a rectangular white nose,
 * i.e. a laser bolt, and a laser does not explain why anything chars.
 *
 * Round, at this size, means a **stepped half-width profile that narrows away from the
 * centre line** — four widths either side, 2px cells — because nested rectangles
 * rasterise as a box inside a box (the rule the dragon's ground bursts paid for), and a
 * profile listed the other way up is a box as well: the first cut of this had its widest
 * rows at the poles and rasterised as an orange brick with a hot corner. Three concentric
 * values with the core pushed *forward and up*, the way every 8-bit sphere is lit,
 * plus a tail of ember cells behind it and two sparks shedding off. The flicker is
 * driven by the orb's own **position**, never a clock: a fire that flickers on a
 * timer strobes when the frame rate moves, and a position-driven one cannot.
 *
 * The whole orb is inside its hitbox except the tail and the sparks, which trail
 * *behind* the direction of travel — so nothing outside the box can ever be the
 * thing that lands the hit.
 */
export function drawShots(ctx: CanvasRenderingContext2D, shots: ShotState[]): void {
  const cell = 2;
  for (const s of shots) {
    const { box } = s;
    const fwd = s.dir;
    // The disc sits at the leading end of the box; the rest of the box is its wake.
    const d = box.h; // 16 → a 16px disc in a 20px box
    const cx = fwd === 1 ? box.x + box.w - d / 2 : box.x + d / 2;
    const cy = box.y + box.h / 2;
    const flick = Math.floor(box.x / 6);

    // Wake: three ember cells stepping back from the disc, thinning as they go.
    for (let k = 0; k < 3; k += 1) {
      const wx = cx - fwd * (d / 2 + 2 + k * 5);
      const wob = ((hash2(flick + k, 5) * 3) | 0) - 1;
      pxRect(
        ctx,
        k === 0 ? FIRE : k === 1 ? FIRE_DEEP : 'rgba(142,31,10,0.55)',
        wx - 2,
        cy - 3 + wob * 2 + k,
        5,
        6 - k * 2,
        cell,
      );
    }

    /*
     * The disc: rows of 2px cells whose widths follow a circle's half-width.
     * `[dy, half]` for the top half; the bottom half mirrors, which is what keeps
     * it a sphere rather than a stack of bars.
     */
    const profile: readonly [number, number][] = [
      [1, 8],
      [3, 8],
      [5, 6],
      [7, 4],
    ];
    for (const [dy, half] of profile) {
      for (const sign of [-1, 1] as const) {
        const ry = cy + sign * dy - (sign === -1 ? cell : 0);
        pxRect(ctx, FIRE_DEEP, cx - half, ry, half * 2, cell, cell);
      }
    }
    // Flame body, one step inside the rim.
    for (const [dy, half] of [
      [1, 6],
      [3, 5],
      [5, 3],
    ] as const) {
      for (const sign of [-1, 1] as const) {
        const ry = cy + sign * dy - (sign === -1 ? cell : 0);
        pxRect(ctx, FIRE, cx - half, ry, half * 2, cell, cell);
      }
    }
    // Core, pushed forward and up: the light is *ahead* of the orb, which is where
    // the thing it is about to set alight is.
    const kx = cx + fwd * 2;
    pxRect(ctx, FIRE_HOT, kx - 4, cy - 5, 8, 8, cell);
    pxRect(ctx, FIRE_CORE, kx - 2, cy - 4, 4, 4, cell);

    // Two sparks shedding off the back, on a stable hash so they never strobe.
    for (let k = 0; k < 2; k += 1) {
      const n = hash2(flick, k + 7);
      pxRect(
        ctx,
        FIRE_HOT,
        cx - fwd * (d / 2 + 6 + n * 10),
        cy + (k === 0 ? -8 : 7) + (n > 0.5 ? 2 : -2),
        cell,
        cell,
        cell,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// The room
// ---------------------------------------------------------------------------

/**
 * A striped rail, with the stripes running on the *diagonal*.
 *
 * That diagonal is the whole difference between a barricade and a yellow plank —
 * it is the pattern every roadworks barrier on earth uses, and the first pass,
 * which reused the tape's vertical ticks, rasterised as exactly that plank. The
 * diagonal is stepped in whole pixels (4 across per 4 down) rather than drawn as a
 * rotated shape, so it stays 8-bit.
 */
function stripedRail(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  pxRect(ctx, TAPE, x, y, w, h, 2);
  for (let s = -h; s < w; s += 20) {
    for (let r = 0; r < h; r += 4) {
      const sx = x + s + (h - r);
      const clipL = Math.max(x, sx);
      const clipR = Math.min(x + w, sx + 10);
      if (clipR > clipL) pxRect(ctx, TAPE_TICK, clipL, y + r, clipR - clipL, 4, 2);
    }
  }
  pxRect(ctx, TAPE_SHADE, x, y + h - 3, w, 3, 2);
  pxRect(ctx, TAPE_LIT, x, y, w, 2, 2);
  // A dark keyline all the way round. Without it the rail's own diagonals run into
  // whatever it is standing in front of, which is what made the first barricades
  // read as a stripe pattern floating on the wall rather than as a panel.
  pxRect(ctx, OUTLINE, x - 2, y - 2, w + 4, 2, 2);
  pxRect(ctx, OUTLINE, x - 2, y + h, w + 4, 2, 2);
  pxRect(ctx, OUTLINE, x - 2, y - 2, 2, h + 4, 2);
  pxRect(ctx, OUTLINE, x + w, y - 2, 2, h + 4, 2);
}

/**
 * Under-construction trestle — the room's "no", and the tallest piece of dressing
 * on the floor so the barricades read as barriers rather than as kerbstones.
 */
function barricade(ctx: CanvasRenderingContext2D, x: number): void {
  const base = GROUND_TOP;
  const w = 96;
  const top = base - 84;
  const left = x - w / 2;
  // Crossed legs, in frame steel.
  for (let i = 0; i < 78; i += 6) {
    const spread = 8 + (i / 78) * 26;
    pxRect(ctx, '#33505C', left + 10 + spread - 8, top + 6 + i, 6, 6, 2);
    pxRect(ctx, '#33505C', left + w - 10 - spread + 2, top + 6 + i, 6, 6, 2);
  }
  pxRect(ctx, '#1E353E', left, base - 6, 30, 6, 2);
  pxRect(ctx, '#1E353E', left + w - 30, base - 6, 30, 6, 2);
  // Two rails: the tall one you read from across the room, and a lower brace.
  stripedRail(ctx, left, top, w, 20);
  stripedRail(ctx, left + 12, top + 34, w - 24, 14);
  /*
   * A hazard lamp on the top rail — the amber blinker every barrier carries.
   *
   * It was a 10×8 pale cell in a dark box, which at this distance is a sticker. A
   * lamp is a *lens in a housing with a hood over it*, so it now has a bracket down
   * to the rail, a black hood, a graded lens (hot centre, warm rim) and four short
   * flare cells at full alpha off the corners. Same rule as the cutter's pilot
   * flame: few cells at full alpha say "lit", many at low alpha say "smudge".
   */
  pxRect(ctx, '#1A2E38', x - 3, top - 6, 6, 8, 2); // bracket
  pxRect(ctx, OUTLINE, x - 10, top - 24, 20, 18, 2); // housing
  pxRect(ctx, '#33505C', x - 10, top - 26, 20, 4, 2); // hood
  // Lens in the caution YELLOW family, not amber. The first cut used `#FFB04A` over
  // `#B85E12`, which is orange in everything but name, and four of them sitting on
  // the floor put the reserved value accent in competition with the badge that is
  // levitating two columns to the left of them.
  pxRect(ctx, TAPE_SHADE, x - 7, top - 21, 14, 12, 2); // lens rim
  pxRect(ctx, TAPE_LIT, x - 5, top - 19, 10, 8, 2);
  pxRect(ctx, '#FFF6DC', x - 3, top - 17, 6, 4, 2); // filament
  for (const [dx, dy] of [
    [-14, -18],
    [12, -18],
    [-14, -8],
    [12, -8],
  ] as const) {
    pxRect(ctx, TAPE_LIT, x + dx, top + dy, 3, 3, 1);
  }
  pxRect(ctx, 'rgba(0,16,22,0.32)', left, base - 3, w, 3, 1);
}

/**
 * Traffic cone. Yellow and black rather than road orange: orange means value.
 *
 * Refined against the wet floor sign, because the two used to be the same picture —
 * a solid yellow triangle each, 48 and 56 tall, standing on the same floor. Three
 * things separate them now and none is colour: the cone is **taller and much
 * narrower** (a 2.4:1 silhouette against the sign's 1.5:1), it carries **two white
 * reflective collars** rather than one, and it stands on a **square black base
 * plate** wider than the cone itself — which is the detail that says "cone" from
 * across a frame. The sign gets the A-frame gap.
 */
function cone(ctx: CanvasRenderingContext2D, x: number): void {
  const base = GROUND_TOP;
  const h = 62;
  const top = base - h;
  for (let i = 0; i < h - 6; i += 4) {
    const u = i / (h - 6);
    // A cone's profile is not a straight line: it flares near the base. The curve is
    // what stops it reading as a wedge.
    const half = 3 + u * u * 10 + u * 5;
    const collar = (i > 16 && i < 26) || (i > 34 && i < 42);
    pxRect(ctx, collar ? '#EDEDED' : TAPE, x - half, top + i, half * 2, 4, 2);
    // Lit left cheek, so the cone is round rather than flat.
    pxRect(ctx, collar ? '#FFFFFF' : TAPE_LIT, x - half, top + i, 3, 4, 2);
    pxRect(ctx, collar ? '#BFC5C5' : TAPE_SHADE, x + half - 3, top + i, 3, 4, 2);
  }
  // Base plate: black, square, and wider than the cone.
  pxRect(ctx, OUTLINE, x - 24, base - 8, 48, 8, 2);
  pxRect(ctx, '#33505C', x - 24, base - 8, 48, 2, 2);
  pxRect(ctx, 'rgba(0,16,22,0.34)', x - 26, base - 2, 52, 2, 1);
}

/**
 * A step ladder left standing where somebody gave up.
 *
 * It is here for height as much as for meaning: on a screen with one flat floor,
 * every other prop tops out around knee height and the middle of the frame was
 * empty. A ladder is 150px of "work in progress" and it reads instantly.
 */
function stepLadder(ctx: CanvasRenderingContext2D, x: number): void {
  const base = GROUND_TOP;
  const h = 150;
  const top = base - h;
  // Two stiles leaning together, with rungs between them. Aluminium blue-grey, not
  // the bandage tone: near-white belongs to the wrapped figure alone, and a ladder
  // in the same value competed with him for the eye across the whole floor.
  for (let i = 0; i < h; i += 6) {
    const spread = 6 + (i / h) * 30;
    pxRect(ctx, '#8CA8B4', x - spread - 5, top + i, 6, 6, 2);
    pxRect(ctx, '#5A7C89', x + spread - 1, top + i, 6, 6, 2);
  }
  for (let r = 22; r < h - 10; r += 30) {
    const spread = 6 + (r / h) * 30;
    pxRect(ctx, '#A6C0CA', x - spread, top + r, spread * 2, 5, 2);
  }
  // Paint tin on the top step, and the tape somebody wrapped round the stiles.
  pxRect(ctx, '#33505C', x - 9, top - 10, 18, 11, 2);
  pxRect(ctx, '#7CA6B4', x - 9, top - 10, 18, 3, 2);
  tapeStrip(ctx, x - 26, base - 58, 52, 7, 0.95, 4);
  pxRect(ctx, 'rgba(0,16,22,0.3)', x - 34, base - 3, 68, 3, 1);
}

/**
 * A-frame wet floor sign — and the **A-frame is the whole point of the redraw**.
 *
 * It was a solid triangle, which is a cone. What a folding sign actually looks like
 * is two boards hinged at the top with daylight between their feet, so the gap is
 * authored: the near board is drawn as a panel with a dark border, the far board
 * shows behind it as a thin sliver, and the bottom third has the floor showing
 * through the middle. Add the pictogram everybody already knows — the falling
 * figure over a slick — and the two props stop being interchangeable yellow
 * triangles.
 */
function wetFloorSign(ctx: CanvasRenderingContext2D, x: number): void {
  const base = GROUND_TOP;
  const h = 64;
  const top = base - h;
  const bw = 24; // one board's width
  const lean = 22; // how far each foot travels out from the hinge
  /*
   * TWO BOARDS, not one filled triangle.
   *
   * A filled triangle is a cone, and that is precisely what this prop was: two yellow
   * triangles 8px apart in height, standing on the same floor, doing the same job. A
   * folding sign is two boards hinged at the top with the room showing through
   * between their feet, so the boards are drawn as boards — near-parallelograms that
   * step outward as they descend — and the *gap* is what carries the read.
   *
   * Far board first, a value down, so the near one paints over it at the hinge.
   */
  for (let i = 0; i < h - 4; i += 4) {
    const u = i / h;
    const rx = x - 4 + u * lean;
    pxRect(ctx, TAPE_SHADE, rx, top + i, bw - 6, 4, 2);
    pxRect(ctx, OUTLINE, rx + bw - 8, top + i, 2, 4, 2);
  }
  for (let i = 0; i < h - 4; i += 4) {
    const u = i / h;
    const lx = x + 4 - bw - u * lean;
    pxRect(ctx, TAPE, lx, top + i, bw, 4, 2);
    pxRect(ctx, OUTLINE, lx, top + i, 2, 4, 2);
    pxRect(ctx, OUTLINE, lx + bw - 2, top + i, 2, 4, 2);
    pxRect(ctx, TAPE_LIT, lx + 2, top + i, 3, 4, 2);
  }
  pxRect(ctx, OUTLINE, x - 8, top - 2, 16, 4, 2); // the hinge
  // Feet: a black shoe on each board, which is what stops the boards floating.
  pxRect(ctx, OUTLINE, x + 4 - bw - lean - 3, base - 5, bw + 6, 5, 2);
  pxRect(ctx, OUTLINE, x - 4 + lean - 2, base - 5, bw - 2, 5, 2);
  /*
   * The pictogram, on the near board and leaning with it: a figure going over
   * backwards over a slick. Positioned from the board's own centre at each row rather
   * than from the prop's centre — a badge of ink painted at the prop's midpoint would
   * hang off the side of a board that has already leaned 12px away from it.
   */
  const at = (row: number): number => x + 4 - bw / 2 - (row / h) * lean;
  pxRect(ctx, TAPE_TICK, at(16) - 5, top + 14, 7, 7, 2); // head
  pxRect(ctx, TAPE_TICK, at(24) - 2, top + 21, 5, 10, 2); // body
  pxRect(ctx, TAPE_TICK, at(22) + 3, top + 18, 7, 3, 2); // arm out
  pxRect(ctx, TAPE_TICK, at(32) + 1, top + 30, 8, 3, 2); // leg up
  pxRect(ctx, TAPE_TICK, at(34) - 9, top + 33, 8, 3, 2); // …and the one that went
  pxRect(ctx, TAPE_TICK, at(40) - 9, top + 40, 20, 2, 2); // the slick
  pxRect(ctx, 'rgba(0,16,22,0.34)', x - bw - lean, base - 2, (bw + lean) * 2, 2, 1);
}

/**
 * Tape stand: weighted base, chrome post, a reel of tape at the top.
 *
 * The base is now a proper cast foot with a lit chamfer, and there is a second reel
 * clipped lower down the post — a stand with one reel at the very top read as a
 * flagpole, and it is the tape spool that says what the post is for.
 */
function tapePost(ctx: CanvasRenderingContext2D, x: number): void {
  const base = GROUND_TOP;
  pxRect(ctx, OUTLINE, x - 17, base - 10, 34, 10, 2);
  pxRect(ctx, '#33505C', x - 15, base - 10, 30, 3, 2);
  pxRect(ctx, '#1E353E', x - 6, base - 142, 12, 134, 2);
  pxRect(ctx, '#7CA6B4', x - 6, base - 142, 3, 134, 2);
  pxRect(ctx, OUTLINE, x + 3, base - 142, 3, 134, 2);
  // The reel at the head of the post, and a spare clipped to it.
  pxRect(ctx, OUTLINE, x - 13, base - 142, 26, 16, 2);
  pxRect(ctx, TAPE, x - 11, base - 140, 22, 12, 2);
  pxRect(ctx, TAPE_LIT, x - 11, base - 140, 22, 2, 2);
  pxRect(ctx, TAPE_TICK, x - 11, base - 140, 5, 10, 2);
  pxRect(ctx, TAPE_TICK, x + 2, base - 140, 5, 10, 2);
  pxRect(ctx, OUTLINE, x - 10, base - 76, 20, 12, 2);
  pxRect(ctx, TAPE_SHADE, x - 8, base - 74, 16, 8, 2);
  pxRect(ctx, 'rgba(0,16,22,0.34)', x - 18, base - 2, 36, 2, 1);
}

/**
 * Tape strung between two posts, sagging under its own weight.
 *
 * Two runs, one above the other, because a single line rasterised as a wire rather
 * than as a taped-off area. Both are stepped in whole pixels, never rotated.
 *
 * Refined on the polish pass: the segments used to be 10px strips laid end to end
 * with a 1px shade line, and at this distance that reads as a dashed rule. Real
 * barrier tape is a *continuous ribbon that twists*, so a segment every fifth step
 * is drawn narrow and in the shade tone — the flat of the tape turning edge-on —
 * and the whole ribbon carries a lit top course. A ribbon with a few twists in it is
 * the cheapest thing in the world to draw and it is the difference between "tape"
 * and "dashes".
 */
function tapeRun(ctx: CanvasRenderingContext2D, x0: number, x1: number): void {
  const span = x1 - x0;
  if (span <= 0) return;
  const sag = Math.min(30, span * 0.08);
  // Both runs sit ABOVE the wrapped figure's head (he is 78 tall, so his crown is
  // at GROUND_TOP−78). The first pass strung them at his chest, where the lower run
  // lined up exactly with the tape on his outstretched arm and the two became one
  // unreadable yellow bar across the picture.
  for (const [y, phase] of [
    [GROUND_TOP - 130, 0],
    [GROUND_TOP - 94, 6],
  ] as const) {
    let k = 0;
    for (let i = 0; i < span; i += 8) {
      const u = i / span;
      const dy = Math.round((sag * 4 * u * (1 - u)) / 4) * 4;
      const w = Math.min(8, span - i);
      if (k % 5 === 4) {
        // The twist: the ribbon turning through edge-on, so it is thin, dark and
        // pinched vertically.
        pxRect(ctx, TAPE_SHADE, x0 + i, y + dy + 2, w, 5, 1);
        pxRect(ctx, OUTLINE, x0 + i, y + dy + 2, w, 1, 1);
      } else {
        tapeStrip(ctx, x0 + i, y + dy, w, 9, 1, i + phase);
      }
      k += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// The light, and the damage
// ---------------------------------------------------------------------------

/**
 * One of the room's four **spotlights**, hanging out of the aperture `scenery.ts` left
 * for it and pointing straight down.
 *
 * Owner call: "add 4 big spot lights from the ceiling facing down, glow up when things
 * restore." It replaced a recessed strip fitting — a lit rectangle flush with the
 * ceiling — and the two rules that survived the change are the ones that matter:
 *
 *  - **the aperture is shared geometry** (`CEILING.FIT_*`), never a number written
 *    twice, because a lamp that misses its own hole in the ceiling is the same class of
 *    defect as a pickup drawn where its hitbox is not. The canopy sits in the aperture
 *    and the barrel hangs below it, so the fitting and the hole are one object;
 *  - **there is still no beam.** A spot is allowed to be a visible *object* — a barrel
 *    is a barrel — but the light it makes is a lit lens face, the pool on the floor
 *    (`floorPool`) and the up-facing edges under it (`litSurfaces`). The moment a
 *    low-alpha cone is drawn from the lens to the floor this becomes the grey wedge
 *    hanging in mid-air that Reception and this screen have each shipped once.
 *
 * `lit` runs 0..1 and is driven by `restore`, which is the "glow up when things restore"
 * half: at 0 the barrel is a dark can with a dead lens, at 1 the lens is white-hot, the
 * cowl's inner rim is catching it and there are four flare cells at full alpha off the
 * mouth. Few cells at full alpha say "lit"; many at low alpha say "smudge".
 */
function spotLight(ctx: CanvasRenderingContext2D, cx: number, lit: number): void {
  const { FIT_W: w, FIT_Y: y, FIT_H: h, SPOT_BOTTOM: bottom } = CEILING;
  /*
   * The silhouette is the whole job here, and the first cut got it wrong in a way that
   * is invisible in code: a 160px canopy plate filling the whole aperture, then a 64×44
   * barrel with a flat cowl. Rasterised, that is a **box hanging off the ceiling** —
   * wider than it is tall, no taper, and indistinguishable from the services duct 20px
   * away from it. What says "spotlight" side-on is a *narrow mounting* and a can that
   * **flares towards its mouth**, so the outline steps outward on the way down. The
   * aperture stays a dark recess behind it, which is what a fitting in a service void
   * looks like and what keeps the fitting and its hole one object.
   */
  pxRect(ctx, '#061C23', cx - w / 2, y, w, h, 2); // the recess, kept dark
  // Canopy: half the aperture's width, so the hole still reads as a hole.
  const capW = 80;
  pxRect(ctx, '#0A2730', cx - capW / 2, y + 4, capW, h - 6, 2);
  pxRect(ctx, '#154C5A', cx - capW / 2, y + 4, capW, 3, 2);
  // Stem, short and narrow: it is what makes the can read as *hung* rather than as part
  // of the ceiling.
  pxRect(ctx, OUTLINE, cx - 11, y + h, 22, 12, 2);
  pxRect(ctx, '#123F4C', cx - 9, y + h, 18, 12, 2);
  pxRect(ctx, '#2A7C90', cx - 9, y + h, 4, 12, 2);

  /*
   * The can: four stepped courses flaring 44 → 72 down to the mouth. Stepping the width
   * outward is the only thing that says "this points down"; a straight cylinder reads as
   * a pipe whichever way up it is.
   */
  const top = y + h + 12;
  const courses: readonly [number, number][] = [
    [44, 0],
    [52, 10],
    [62, 20],
    [72, 30],
  ];
  for (const [cw, dy] of courses) {
    pxRect(ctx, OUTLINE, cx - cw / 2 - 2, top + dy, cw + 4, 12, 2);
    pxRect(ctx, '#123F4C', cx - cw / 2, top + dy, cw, 10, 2);
    pxRect(ctx, '#2A7C90', cx - cw / 2, top + dy, 4, 10, 2); // lit cheek, all the way down
    pxRect(ctx, '#061C23', cx + cw / 2 - 5, top + dy, 5, 10, 2); // …and the dark one
  }
  // Rim, one step wider again and dark: the lip a lens sits behind.
  pxRect(ctx, OUTLINE, cx - 42, bottom - 12, 84, 5, 2);

  // The lens, across the mouth, facing the floor. This is the light.
  const lens = `rgba(255,250,232,${(0.06 + 0.94 * lit).toFixed(3)})`;
  pxRect(ctx, lens, cx - 32, bottom - 8, 64, 8, 2);
  if (lit > 0.05) {
    // The inside of the rim catching its own lamp, and the ceiling above the recess.
    pxRect(ctx, `rgba(255,246,220,${(0.5 * lit).toFixed(3)})`, cx - 36, bottom - 10, 72, 2, 2);
    const lip = `rgba(226,246,252,${(0.4 * lit).toFixed(3)})`;
    pxRect(ctx, lip, cx - w / 2 - 4, y - 4, w + 8, 4, 2);
  }
  if (lit > 0.6) {
    // Two flare cells at the corners of the lens, at FULL alpha: the tell that this thing
    // is on. They were four, sitting *below* the mouth, and rasterised as feet under a
    // white box — few cells at full alpha say "lit", but only if they are on the lamp.
    for (const dx of [-38, 32]) pxRect(ctx, FIRE_CORE, cx + dx, bottom - 8, 6, 4, 2);
  }
}

/**
 * What a lit fitting does to everything under it: the up-facing edges catch it.
 *
 * This is the other half of "light is a surface". A pool on the floor says where
 * the light lands; these say the light is *in the room* — the top of the duct, the
 * dado rail, and a band of wall right under the ceiling. Every one of them is an
 * edge or a face that is genuinely turned upwards, which is why none of them can
 * be mistaken for the grey wedge hanging in mid-air that this screen (and
 * Reception before it) shipped once.
 */
function litSurfaces(ctx: CanvasRenderingContext2D, cx: number, lit: number): void {
  if (lit <= 0.05) return;
  const a = (v: number): string => `rgba(226,246,252,${(v * lit).toFixed(3)})`;
  /*
   * The services duct is **cut** around every spotlight now (`CEILING.DUCT_GAP`), so the
   * lit line along its top has to stop where the duct does. One 184px band centred on the
   * fitting was mostly painted across the 96px gap — a pale line lying in a hole, which is
   * the light-as-an-object defect in its purest form. Two bands, from the cut's edge
   * outwards, land on duct that is actually there.
   */
  const half = CEILING.DUCT_GAP / 2;
  for (const dir of [-1, 1] as const) {
    pxRect(ctx, a(0.26), cx + dir * half - (dir < 0 ? 62 : 0), 108, 62, 4, 2);
  }
  pxRect(ctx, a(0.16), cx - 104, CEILING.H + 4, 208, 8, 2); // wall under the ceiling
  pxRect(ctx, a(0.14), cx - 112, 330, 224, 4, 2); // the dado rail
  // Two more up-facing faces, both of them real: the sill course above the skirting
  // and the top edge of the mid-wall register. Between the duct and the dado there
  // was 220px of wall with nothing in it catching anything, which is why "the lights
  // came good" used to be four brighter bars in the same dark room.
  pxRect(ctx, a(0.1), cx - 116, 458, 232, 3, 2);
  pxRect(ctx, a(0.09), cx - 120, 156, 240, 4, 2);
}

/**
 * The pool a fitting puts on the floor.
 *
 * **This is where the light lives, and it is deliberately not a cone.** The first
 * version of this screen threw a tall gradient wedge from every fitting down to the
 * floor, which is exactly what Reception's downlights did before they were deleted:
 * rasterised, a pale wedge hanging in a dark room reads as a grey *object*
 * suspended from the ceiling, never as light. A pool is a surface — stepped bands
 * lying on the floor, widest nearest the camera, plus the walkable edge catching
 * the light along the line the player actually runs.
 */
function floorPool(ctx: CanvasRenderingContext2D, cx: number, lit: number): void {
  if (lit <= 0.03) return;
  /*
   * The widest band is 160, i.e. 320px of floor per fitting.
   *
   * It was 192 first, and four pools that wide simply *met*: 8→392, 308→692,
   * 608→992, 908→1292, which paints the entire ground band one value lighter and
   * reads as the floor's own top edge rather than as light falling on it. A pool
   * only says "light" if there is unlit floor either side of it — the dark between
   * the pools is as much of the picture as the pools are.
   */
  /*
   * The profile NARROWS downwards, and that is the fix the owner's third note
   * bought.
   *
   * It used to widen on every step — 54 → 160 half-width over seven bands — and
   * rasterised as a flat-topped stepped **pyramid** sitting on the floor: an object,
   * which is the exact defect the beams and the gradient wedges were deleted for,
   * arriving for the third time in a different costume. Light on a floor seen side-on
   * is brightest where the floor meets the wall, i.e. at the top of the band, and it
   * dies towards the camera. Widest and brightest at the floor line, narrowing and
   * dimming down: that reads as light *lying on* the floor.
   */
  /*
   * …and 130 rather than 160, now that the fittings are spots.
   *
   * At 160 the four pools were 320px wide on a 300px pitch, i.e. they overlapped: 60→380
   * against 340→660, which paints one continuous lighter band and reads as the floor's
   * own top edge. 130 leaves 40px of unlit floor between each pair, which is the whole
   * point — the dark between the pools is as much of the picture as the pools are. A
   * spotlight also *should* throw a tighter pool than a strip fitting, so the number and
   * the fixture agree.
   */
  const bands: readonly [number, number, number, number][] = [
    [130, 0, 5, 0.36],
    [122, 5, 7, 0.28],
    [112, 12, 9, 0.21],
    [100, 21, 11, 0.15],
    [84, 32, 13, 0.1],
    [64, 45, 15, 0.06],
  ];
  for (const [half, dy, h, a] of bands) {
    pxRect(
      ctx,
      `rgba(226,246,252,${(a * lit).toFixed(3)})`,
      cx - half,
      GROUND_TOP + dy,
      half * 2,
      h,
      4,
    );
  }
  /*
   * A dithered fringe, so the pool's edge is not a staircase.
   *
   * Hard steps are right for a *silhouette* (the clouds, the sun) and wrong for the
   * boundary of a light, because a light has no edge. Six banded steps plus a
   * chequer of 4px cells along the bottom and the two sides is the 8-bit way to say
   * "this fades out" — and it is ~30 fills, not the 1,700 a fully dithered pool
   * would have cost.
   */
  for (let i = -136; i < 136; i += 8) {
    const edge = 1 - Math.abs(i) / 136;
    const dy = 58 + Math.round(edge * 10);
    if (hash2(Math.round((cx + i) / 8), 21) < 0.35 + edge * 0.4) {
      pxRect(ctx, `rgba(226,246,252,${(0.05 * lit).toFixed(3)})`, cx + i, GROUND_TOP + dy, 8, 8, 4);
    }
  }
  // The walkable edge catching it — the line the player actually runs along.
  pxRect(ctx, `rgba(226,246,252,${(0.34 * lit).toFixed(3)})`, cx - 68, GROUND_TOP - 3, 136, 3, 1);
}

/**
 * A task chair on its side. Nothing says "walked out of" faster than this.
 *
 * Every damage prop is drawn a value or two ABOVE the furniture it stands next to,
 * for the same reason the furniture is drawn below the wall: a thing that has gone
 * wrong has to be the thing you notice, and the first pass painted all of it in the
 * furniture's own dark tones, where it disappeared completely.
 */
function toppledChair(ctx: CanvasRenderingContext2D, x: number): void {
  const b = GROUND_TOP;
  pxRect(ctx, DAMAGE, x, b - 40, 30, 40, 2); // back, now on its side
  pxRect(ctx, DAMAGE_LIT, x, b - 40, 30, 3, 2);
  pxRect(ctx, DAMAGE_DEEP, x + 30, b - 34, 8, 34, 2); // seat, edge on
  pxRect(ctx, DAMAGE_DEEP, x + 38, b - 22, 22, 6, 2); // post, lying flat
  pxRect(ctx, DAMAGE_DEEP, x + 58, b - 30, 5, 26, 2); // base, in the air
  pxRect(ctx, DAMAGE, x + 60, b - 32, 14, 5, 2);
  pxRect(ctx, DAMAGE, x + 60, b - 12, 14, 5, 2);
  pxRect(ctx, 'rgba(0,16,22,0.32)', x - 2, b - 3, 78, 3, 1);
}

/** A bucket under a hole in the ceiling, and the wet floor round it. */
function dripBucket(ctx: CanvasRenderingContext2D, x: number): void {
  const b = GROUND_TOP;
  pxRect(ctx, `rgba(120,196,214,0.2)`, x - 40, b - 4, 80, 4, 2); // the wet patch
  for (let i = 0; i < 22; i += 4) {
    const half = 15 - i * 0.2;
    pxRect(ctx, '#5A7C89', x - half, b - 22 + i, half * 2, 4, 2);
  }
  pxRect(ctx, '#A6C0CA', x - 15, b - 22, 30, 3, 2); // rim
  pxRect(ctx, '#25606F', x - 11, b - 19, 22, 4, 2); // water in it
  pxRect(ctx, '#8CA8B4', x - 17, b - 30, 34, 3, 2); // handle
}

/**
 * The ceiling, missing two of its tiles.
 *
 * `scenery.ts` paints the grid intact, because that is the ceiling the fix leaves
 * behind; this cuts the holes in it. Each one is a void with a joist and a duct
 * behind it, four cables of different lengths spilling out, and — the piece that
 * carries the whole read — one tile hanging out of the grid by a single corner,
 * stepped in whole pixels rather than rotated.
 */
function drawCeilingDamage(
  ctx: CanvasRenderingContext2D,
  broken: number,
  t: number,
  reduced: boolean,
): void {
  if (broken <= 0.01) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * Math.min(1, broken * 1.5);
  const w = CEILING.TILE_W;
  for (const gap of CEILING.GAPS) {
    // The whole depth of the band, not just the near courses: a hole that stops
    // short of the top edge reads as a dark tile, i.e. as a ceiling that is dirty
    // rather than one that is missing.
    pxRect(ctx, '#020C10', gap, 0, w, CEILING.H, 2);
    pxRect(ctx, '#123F4C', gap, 40, w, 7, 2); // a joist across it, catching light
    pxRect(ctx, '#0C3340', gap + 8, 0, 14, CEILING.H, 2); // duct behind
    // Cables spilling out, each to its own length, ending in a connector. Light
    // enough to be seen against the void: the first pass drew them one value off
    // black inside a black hole.
    for (let i = 0; i < 4; i += 1) {
      const cx = gap + 26 + i * 14;
      const drop = 26 + Math.floor(hash2(gap + i, 7) * 54);
      const sway = reduced ? 0 : Math.round(Math.sin(t * 1.4 + i) * 2) * 2;
      pxRect(ctx, '#2C5866', cx, 40, 4, drop, 2);
      pxRect(ctx, '#2C5866', cx + Math.min(0, sway), 40 + drop, 4 + Math.abs(sway), 8, 2);
      // Cable colours, not caution yellow. A ferrule up in the ceiling void is not
      // part of the tape story, and painting it in the tape's own colour put the one
      // reserved-meaning colour on this screen at full alpha in a place the fix does
      // not reach — which `workplace.test.ts` now states as a rule.
      pxRect(ctx, i % 2 === 0 ? '#4E8898' : '#2C5866', cx - 2 + sway, 48 + drop, 8, 7, 2);
    }
    // …and the tile itself, hanging out of the grid by one corner, stepping down and
    // out of the opening. Drawn in the tile's own light value and painted OVER the
    // services duct below it, because a tile hanging *behind* the duct is a tile
    // nobody can see — which is what the first version was.
    // The steps OVERLAP (16px cells advancing 8 and 6): stepped by less than their
    // own size they read as one plate on the slant, and stepped by more they read as
    // a dashed diagonal line, which is what the first version rasterised as. Same
    // rule the maze's boom arm is drawn under — a diagonal's snap has to be finer
    // than its stride.
    const tx = gap + w - 16;
    for (let k = 0; k < 5; k += 1) {
      pxRect(ctx, '#17566A', tx + k * 8, CEILING.H - 14 + k * 6, 16, 16, 2);
    }
    pxRect(ctx, '#2A7C90', tx, CEILING.H - 14, 16, 4, 2);
    pxRect(ctx, '#0C3340', tx + 32, CEILING.H + 18, 16, 4, 2);
  }

  // Where the ceiling has not gone but has been leaking: a stain across two tiles,
  // with a bucket under it (the damage layer draws that on the floor).
  const s = CEILING.STAIN;
  pxRect(ctx, 'rgba(4,18,22,0.55)', s - 34, 8, 68, 40, 2);
  pxRect(ctx, 'rgba(4,18,22,0.35)', s - 46, 14, 92, 26, 2);
  pxRect(ctx, 'rgba(120,196,214,0.16)', s - 20, 40, 40, 6, 2);
  ctx.globalAlpha = prev;
}

/**
 * The room as it was walked out of: drawers hanging open, a chair over, a wall
 * panel off, a bucket under the hole, a stack of boxes that went with it.
 *
 * All of it is *the building*, so it sits under the gloom and under the tape
 * dressing — the dressing is the set, this is the state of the room, and the
 * wrapped figure is the only actor. None of it survives the fix.
 */
function drawRoomDamage(ctx: CanvasRenderingContext2D, broken: number): void {
  if (broken <= 0.01) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * Math.min(1, broken * 1.5);
  const b = GROUND_TOP;

  // Two drawers out of the cabinet bank, with paper standing up over the lip. A
  // filing cabinet left hanging open is the cheapest "nobody is in control" there
  // is, and it is the one that belongs on a screen about a workplace.
  const { x, y, w, drawerH } = CABINETS;
  for (const [i, out] of [
    [0, 20],
    [2, 32],
  ] as const) {
    const dy = y + 6 + i * drawerH;
    pxRect(ctx, DAMAGE, x + w - 6, dy, out, drawerH - 6, 2);
    pxRect(ctx, DAMAGE_LIT, x + w - 6, dy, out, 3, 2);
    pxRect(ctx, '#04161B', x + w - 6, dy + drawerH - 9, out, 3, 2);
    pxRect(ctx, '#C6D4D9', x + w - 2, dy - 7, out - 6, 8, 2); // paper over the lip
  }

  // A4 notices taped straight onto the wall, one of them hanging off by a corner.
  // Somebody printed the problem out and stuck it up rather than fixing it, which is
  // the most office thing that can happen to a broken floor — and it puts the
  // *tape* on the wall as well as the floor, so the whole room reads as taped.
  for (const [nx, ny, hanging] of [
    [508, 208, false],
    [560, 232, false],
    [600, 200, true],
    // Not at 214 any more: that column is the ANSR mark's fall line (it drops out of
    // the first spotlight at x=220 onto the cabinet under it), and a notice taped to
    // the wall behind a falling pickup is a notice the pickup is read against.
    [420, 372, false],
  ] as const) {
    pxRect(ctx, '#A9BEC4', nx, ny, 34, 46, 2);
    pxRect(ctx, '#6E8C97', nx + 5, ny + 8, 24, 3, 2);
    pxRect(ctx, '#6E8C97', nx + 5, ny + 16, 24, 3, 2);
    pxRect(ctx, '#6E8C97', nx + 5, ny + 24, 16, 3, 2);
    if (hanging) {
      // Curled off the wall at the bottom: two cells stepping away from it.
      pxRect(ctx, '#93AAB3', nx + 4, ny + 46, 30, 6, 2);
      pxRect(ctx, '#7A959F', nx + 10, ny + 52, 22, 5, 2);
      tapeStrip(ctx, nx + 6, ny - 5, 22, 6, 0.9, 2);
    } else {
      tapeStrip(ctx, nx + 4, ny - 4, 26, 6, 0.9, 4);
    }
  }

  toppledChair(ctx, WORK_PODS[1]! + 152);
  // Under the ceiling stain rather than under either hole. A bucket has to stand on
  // clear floor to be seen at all, and both holes are over columns that already have
  // something in them — which is why the stain exists: it puts a reason for the
  // bucket over the one stretch of empty floor there is.
  dripBucket(ctx, CEILING.STAIN);

  // Archive boxes, stacked and then knocked over: two still up, one on its face
  // with the files out of it. Past the terminal, at the end of the floor the player
  // is walking towards, so the mess is the last thing they pass rather than the
  // first thing in front of the figure.
  const bx = 1136;
  for (const [dx, dy, s] of [
    [0, 34, 34],
    [4, 66, 30],
  ] as const) {
    pxRect(ctx, DAMAGE, bx + dx, b - dy, s, s - 2, 2);
    pxRect(ctx, DAMAGE_LIT, bx + dx, b - dy, s, 4, 2);
    pxRect(ctx, '#C6D4D9', bx + dx + 6, b - dy + 10, s - 12, 3, 2);
  }
  pxRect(ctx, DAMAGE, bx + 40, b - 24, 40, 24, 2);
  pxRect(ctx, DAMAGE_LIT, bx + 40, b - 24, 40, 3, 2);
  pxRect(ctx, '#C6D4D9', bx + 74, b - 16, 22, 5, 2);
  pxRect(ctx, '#A9BEC4', bx + 78, b - 9, 26, 5, 2);
  ctx.globalAlpha = prev;
}

/**
 * A colleague standing at a desk, 26×62 — slimmer than the 48×60 hero on purpose,
 * so a figure that appears on the floor the player is running along reads as part
 * of the room rather than as something to avoid. Same convention as the candidate
 * queue on Hire Under Fire.
 */
function deskWorker(ctx: CanvasRenderingContext2D, x: number): void {
  const b = GROUND_TOP;
  pxRect(ctx, '#2A1C14', x - 7, b - 62, 14, 5, 2); // hair
  pxRect(ctx, '#D9A57A', x - 7, b - 57, 14, 12, 2); // head
  pxRect(ctx, '#E9F1F5', x - 13, b - 45, 26, 18, 2); // shirt
  pxRect(ctx, '#BED0D9', x - 13, b - 27, 26, 6, 2);
  pxRect(ctx, '#26454F', x - 12, b - 21, 10, 21, 2); // legs
  pxRect(ctx, '#26454F', x + 2, b - 21, 10, 21, 2);
  pxRect(ctx, '#161616', x - 12, b - 5, 10, 5, 2);
  pxRect(ctx, '#161616', x + 2, b - 5, 10, 5, 2);
}

/**
 * The payoff: the monitors awake, two people back at their desks, daylight in the
 * glazing and a floor with nothing on it.
 *
 * Both the screens and the glazing are drawn from the geometry `scenery.ts`
 * exports, so a lit monitor lands on a monitor. It is the same reasoning as the
 * light and its aperture, and the reason this layer can be this cheap: the intact
 * room is already underneath, and this only has to turn it on.
 */
function drawRestored(ctx: CanvasRenderingContext2D, r: number): void {
  if (r <= 0.02) return;
  /*
   * The room is LIT, not merely un-gloomed.
   *
   * Taking the 0.28 shadow layer off gets you back to the room as authored, which is
   * a *neutral* room — and "the lights come good" has to be a change you can see
   * across the whole frame, not four brighter fittings in the same dark space. This
   * is the exact inverse of the gloom, and it is a legitimate surface argument: every
   * face in the room is now catching light from four working fittings instead of two.
   * It lands under the terminal, the colleague and the player, so the figures stay
   * saturated against it.
   */
  ctx.fillStyle = `rgba(178,230,244,${(0.11 * r).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);

  /*
   * …and the room gets LIGHT FITTINGS IT DID NOT HAVE (owner call: "add lights once
   * things are restored in the office").
   *
   * Four ceiling fittings coming up to full is a change in four places; a working
   * office floor is lit from more than four. So the fix brings on a **continuous
   * cove** behind the ceiling line, an **uplit dado course**, and a row of **task
   * lamps on the desks**. All three obey the no-beam rule — a cove is a lit face at
   * the top of a wall, a dado course is a lit face two thirds down it, and a task
   * lamp is a small lit head plus the pool it puts on its own desk. Nothing hangs in
   * the air, and every one of them is a surface that is genuinely turned upwards.
   */
  const cove = (v: number): string => `rgba(226,246,252,${(v * r).toFixed(3)})`;
  pxRect(ctx, cove(0.3), 0, CEILING.H, W, 4, 2); // the cove itself
  pxRect(ctx, cove(0.14), 0, CEILING.H + 4, W, 10, 2); // …and the wall it washes
  pxRect(ctx, cove(0.16), 0, 326, W, 4, 2); // the dado course, uplit
  pxRect(ctx, cove(0.1), 0, 455, W, 3, 2);

  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * r;
  const { dx, dy, w, h } = POD_SCREEN;
  for (let i = 0; i < WORK_PODS.length; i += 1) {
    const x = WORK_PODS[i]!;
    const sy = GROUND_TOP + dy;
    pxRect(ctx, '#155E48', x + dx, sy, w, h, 2);
    for (let k = 0; k < 3; k += 1) {
      pxRect(ctx, '#9FE6C4', x + dx + 5, sy + 6 + k * 8, 14 + k * 9, 3, 2);
    }
    // A task lamp on each desk: a shade, a stem, and the patch of desktop under it.
    // Small, but it is four more *sources* in the frame, which is what "the lights
    // come good" has to mean if the ceiling was already the only thing that changed.
    const lx = x + 150;
    const deskTop = GROUND_TOP - 36;
    pxRect(ctx, '#123F4C', lx - 2, deskTop - 26, 4, 26, 2); // stem
    pxRect(ctx, '#154C5A', lx - 11, deskTop - 34, 22, 8, 2); // shade
    pxRect(ctx, '#FFF6DC', lx - 8, deskTop - 27, 16, 3, 2); // the lamp itself
    pxRect(ctx, 'rgba(226,246,252,0.26)', lx - 26, deskTop - 4, 52, 4, 2); // on the desk
    // Somebody back at every desk. "A workplace that works" is this screen's meaning
    // tag, and this is the picture of it — the room does not just stop being broken, it
    // starts being used. (It used to be two of three; the room has two pods now, because
    // the third stood in the partition wall's column — see `WORK_PODS`.)
    deskWorker(ctx, x + 164);
  }
  // Daylight lifting in the glazing, and the floor catching all of it. Twice what it
  // was: through the one window on the one screen with no sky, daylight is half the
  // reason a fixed office looks fixed.
  pxRect(ctx, `rgba(179,226,238,${(0.2 * r).toFixed(3)})`, WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, 2);
  pxRect(
    ctx,
    `rgba(226,246,252,${(0.26 * r).toFixed(3)})`,
    WINDOW.x,
    WINDOW.y + WINDOW.h + 7,
    WINDOW.w,
    4,
    2,
  );
  ctx.globalAlpha = prev;
}

/**
 * Everything the fix undoes: the broken ceiling, the room somebody walked out of,
 * the gloom, the failing fittings, and the barricades, cones, signs and tape.
 *
 * `restore` (0..1) is the single dial, and it is driven by the colleague finishing
 * at the terminal — never by a timer, so the room can only come good because
 * somebody made it come good.
 *
 * Order is load-bearing. The damage is *the building*, so it goes under the gloom;
 * the light goes **over** the gloom, because light that a shadow layer can dim is
 * not light; the tape dressing goes over both, because it is the newest thing in
 * the room; and the payoff goes last.
 */
export function drawOffice(
  ctx: CanvasRenderingContext2D,
  clutter: readonly ClutterSpec[],
  restore: number,
  t: number,
  reduced: boolean,
): void {
  const r = Math.max(0, Math.min(1, restore));
  const broken = 1 - r;

  drawCeilingDamage(ctx, broken, t, reduced);
  drawRoomDamage(ctx, broken);

  // --- the gloom ---------------------------------------------------------
  // 0.28, not the 0.4 the first pass used: at 0.4 the room went so flat that the
  // barricades and the figure lost their own shading and the screen rasterised as
  // one dark smear. Gloom has to be readable gloom.
  if (broken > 0.01) {
    ctx.fillStyle = `rgba(0,12,18,${0.28 * broken})`;
    ctx.fillRect(0, 0, W, H);
  }

  // --- the fittings, and the light they put on the room ------------------
  // Two of the four cannot hold a charge. The flicker is quantised into 8-bit
  // steps rather than eased: a strip light either strikes or it does not. Steady
  // under reduced motion, and steady once the terminal has chimed — which is the
  // readable half of "well lit".
  for (let i = 0; i < CEILING.LIGHTS.length; i += 1) {
    const cx = CEILING.LIGHTS[i]!;
    const faulty = i === 1 || i === 3;
    // A broken office is not a dark office, it is a *half-lit* one: two fittings
    // hold, two strike and drop out. Painting all four at one dim level rasterised
    // as four grey bars in a room with no light in it at all, which is a different
    // and much duller picture — and it left the whole floor lit by nothing, so
    // fixing the room had nothing to change.
    const base = faulty ? 0.05 : 0.62;
    const strike = reduced || r > 0.5 || !faulty ? 1 : hash2(Math.floor(t * 9), i) > 0.4 ? 1 : 0.1;
    const lit = Math.min(1, (base + (1 - base) * r) * strike);
    spotLight(ctx, cx, lit);
    litSurfaces(ctx, cx, lit);
    floorPool(ctx, cx, lit);
  }

  // --- the taped-off floor ----------------------------------------------
  // First to go: by mid-restore the room is already walkable, which is what makes
  // the fix feel like it landed rather than like a slow fade.
  const dressing = Math.max(0, 1 - r * 1.6);
  if (dressing > 0.01) {
    const prev = ctx.globalAlpha;
    // Held a step back from full brightness on purpose. The dressing and the hazard
    // are the same caution yellow, and at full alpha the wrapped figure — the one
    // thing on this floor that can cost the player a life — was just one more yellow
    // shape among nine. The props are the set; he is the actor.
    ctx.globalAlpha = prev * dressing * 0.78;
    // Posts are authored in pairs and tape is strung *within* a pair, never from
    // one pair to the next. Stringing it post to post drew one unbroken yellow
    // line from wall to wall, which read as a wire across the picture instead of
    // as three taped-off stretches of floor.
    let openPost: number | null = null;
    for (const c of clutter) {
      const x = c.gx * T + T / 2;
      if (c.kind === 'barricade') barricade(ctx, x);
      else if (c.kind === 'cone') cone(ctx, x);
      else if (c.kind === 'sign') wetFloorSign(ctx, x);
      else if (c.kind === 'ladder') stepLadder(ctx, x);
      else {
        if (openPost !== null) {
          tapeRun(ctx, openPost, x);
          openPost = null;
        } else {
          openPost = x;
        }
        tapePost(ctx, x);
      }
    }
    ctx.globalAlpha = prev;
  }

  // Puddles under the signs while the floor is still wet.
  if (broken > 0.2) {
    for (const c of clutter) {
      if (c.kind !== 'sign') continue;
      const x = c.gx * T + T / 2;
      pxRect(ctx, `rgba(120,196,214,${0.2 * broken})`, x - 44, GROUND_TOP - 4, 88, 4, 2);
      pxRect(ctx, `rgba(180,226,238,${0.14 * broken})`, x - 30, GROUND_TOP - 6, 40, 2, 2);
    }
  }

  // Debris on the floor while it is a building site: pulled-up cable, a shred of
  // tape, a fallen ceiling tile. Stable positions (hash2), never a per-frame
  // scatter, so it reads as mess rather than as noise.
  if (dressing > 0.01) {
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * dressing;
    for (let i = 0; i < 7; i += 1) {
      const x = 320 + Math.floor(hash2(i, 17) * (W - 460));
      const kind = i % 3;
      if (kind === 0) {
        // Loose cable snaking along the floor.
        for (let k = 0; k < 5; k += 1) {
          pxRect(ctx, '#16282F', x + k * 10, GROUND_TOP - 6 + (k % 2) * 3, 10, 4, 2);
        }
      } else if (kind === 1) {
        tapeStrip(ctx, x, GROUND_TOP - 6, 22, 5, 0.7, i * 3);
      } else {
        pxRect(ctx, '#3E4C4C', x, GROUND_TOP - 8, 26, 8, 2);
        pxRect(ctx, '#556666', x, GROUND_TOP - 8, 26, 3, 2);
      }
    }
    ctx.globalAlpha = prev;
  }

  // …and the payoff: a clean, lit floor once it is fixed, and the room awake.
  if (r > 0.01) {
    ctx.fillStyle = `rgba(226,246,252,${0.1 * r})`;
    ctx.fillRect(0, GROUND_TOP - 6, W, 6);
  }
  drawRestored(ctx, r);
}

/**
 * The sparking terminal — what the freed colleague runs to, and what puts the room
 * right.
 *
 * Before: dead screen, arcing sparks at the base. After: a lit screen carrying the
 * one word the moment is about. The sparks are the only part that stops under
 * `prefers-reduced-motion`; the state change is information, so it always shows.
 */
export function drawTerminal(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number } | null,
  working: boolean,
  restore: number,
  t: number,
  reduced: boolean,
): void {
  if (!at) return;
  const r = Math.max(0, Math.min(1, restore));
  const base = at.y;
  const deskTop = base - 44;

  /*
   * Bigger and brighter than the workstations behind it, on purpose.
   *
   * It is the same object three times over — the thing the freed colleague runs to,
   * the thing the whole screen is won on, and the only readout of that win — and at
   * the workstations' size and value it was a dark box in a row of dark boxes. A
   * prop the player has to *follow somebody to* has to be findable from the other
   * end of the frame.
   */
  pxRect(ctx, '#0A2E38', at.x - 62, deskTop, 124, 10, 2); // desk
  pxRect(ctx, '#46A6BC', at.x - 62, deskTop, 124, 3, 2);
  pxRect(ctx, '#04161B', at.x - 54, deskTop + 10, 10, 34, 2);
  pxRect(ctx, '#04161B', at.x + 44, deskTop + 10, 10, 34, 2);
  // Tower under the desk, and the cable nobody has tied back.
  pxRect(ctx, '#0C3340', at.x + 16, deskTop + 12, 24, 32, 2);
  pxRect(ctx, '#17566A', at.x + 16, deskTop + 12, 24, 3, 2);
  pxRect(ctx, r > 0.5 ? '#9FE6C4' : '#4A5A60', at.x + 21, deskTop + 18, 6, 6, 2);

  // Monitor, on a proper stand so it reads as a machine somebody works at.
  const scrY = deskTop - 66;
  pxRect(ctx, '#04161B', at.x - 44, scrY, 88, 62, 2);
  pxRect(ctx, r > 0.5 ? '#46A6BC' : '#1E6478', at.x - 44, scrY, 88, 4, 2);
  const screen = r > 0.5 ? '#1D6B4F' : working ? '#12505F' : '#0A1E26';
  pxRect(ctx, screen, at.x - 37, scrY + 7, 74, 48, 2);
  pxRect(ctx, '#04161B', at.x - 8, deskTop - 8, 16, 8, 2); // neck
  pxRect(ctx, '#0C3340', at.x - 20, deskTop - 6, 40, 6, 2); // foot
  // Keyboard.
  pxRect(ctx, '#17566A', at.x - 28, deskTop - 5, 52, 6, 2);

  if (r > 0.5) {
    drawText(ctx, 'OK', at.x, scrY + 18, { scale: 3, color: '#9FE6C4', align: 'center' });
    pxRect(ctx, '#9FE6C4', at.x - 26, scrY + 42, 52, 4, 2);
  } else if (working) {
    for (let i = 0; i < 4; i += 1) {
      const on = reduced || Math.floor(t * 8 + i) % 3 !== 0;
      pxRect(
        ctx,
        on ? 'rgba(159,230,196,0.85)' : 'rgba(159,230,196,0.25)',
        at.x - 30,
        scrY + 13 + i * 10,
        20 + i * 9,
        4,
        2,
      );
    }
  } else {
    pxRect(ctx, 'rgba(207,230,236,0.2)', at.x - 28, scrY + 27, 56, 4, 2);
  }

  // Sparks arcing out of the base while nothing has been fixed.
  if (r < 0.5 && (reduced || hash2(Math.floor(t * 14), 3) > 0.55)) {
    for (let i = 0; i < 4; i += 1) {
      const sx = at.x - 24 + i * 15;
      const sy = deskTop + 16 + (i % 2) * 10;
      pxRect(ctx, '#FFF2D0', sx, sy, 5, 5, 2);
      pxRect(ctx, TAPE, sx + 2, sy - 8, 3, 8, 2);
    }
  }
}
