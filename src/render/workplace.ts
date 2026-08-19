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
 * Caution yellow (`#E8C23A`) is machinery yellow and carries the *problem*: tape,
 * barricades, cones, signs. The reserved value orange appears exactly once, on the
 * cutter the badge puts in the player's hand, because the tool *is* the ANSR
 * capability. Nothing else on this screen is allowed to be orange.
 */
import { RESOLUTION } from '../data/tuning.config';
import type { ClutterSpec } from '../data/levels';
import { pxRect, drawPixels, hash2, type Palette } from './PixelArt';
import { drawText } from './PixelText';
import { CEILING, WORK_PODS, POD_SCREEN, CABINETS, WINDOW } from './scenery';
import type { MummyState, ShotState } from '../world/Hazards/Workplace';

const { WIDTH: W, HEIGHT: H, TILE: T } = RESOLUTION;
const GROUND_TOP = 15 * T;

/** Authored at 20×26 and drawn at scale 3, i.e. exactly the 60×78 hitbox. */
export const SCALE = 3;
const COLS = 20;

const TAPE = '#E8C23A';
const TAPE_SHADE = '#B8942A';
const TAPE_TICK = '#1A1A1A';
const BANDAGE = '#EFE9DA';
const BANDAGE_SHADE = '#C6BEA8';
const BANDAGE_DEEP = '#948C77';
const OUTLINE = '#10222A';

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
  '..KKKKKKKKK.........',
  '..KhhhhhhhK.........',
  '..KfffffffK.........',
  '..KeEeeEeeK.........',
  '..KeeeeeeeK.........',
  '..KfffffffK.........',
  '...KfffffK..........',
  '....KfffK...........',
  '.KTTTTTTTTTTTK......',
  '.KaTTTTTTTTTaKKKKKKK',
  '.KaTTTTTTTTTarrrrHHK',
  '.KaTTTTTTTTTarrrrHHK',
  '.KaTTTTTTTTTaKKKKKKK',
  '.KTTTTTTTTTTTK......',
  '.KSSSSSSSSSSSK......',
  '..KSSSSSSSSSK.......',
  '..KlllllllllK.......',
  '..KllllKllllK.......',
  '..KlLLLKLLLlK.......',
  '..KlLLLKLLLlK.......',
  '..KlLLLKLLLlK.......',
  '..KlLLLKLLLlK.......',
  '..KllllKllllK.......',
  '..KllllKllllK.......',
  '..KooooKooooK.......',
  '..KKKKKKKKKKK.......',
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
  // Outermost: brow, jaw, waist, shin. Never across the eye slit — that gap is the
  // single thing that makes the head read as a head. All of them are ONE cell tall:
  // the first authoring used two- and three-row bands and nine of those cover 40% of
  // the body, at which point the tape stops being an accent on wound cloth and
  // becomes the material he is made of.
  { row: 2, h: 1, col: 3, w: 7, need: 3 },
  { row: 6, h: 1, col: 4, w: 5, need: 3 },
  { row: 13, h: 1, col: 2, w: 11, need: 3 },
  { row: 22, h: 1, col: 3, w: 9, need: 3 },
  // Second layer: chest, the inner half of the reach, thighs.
  { row: 9, h: 1, col: 2, w: 11, need: 2 },
  // Only the inner half of the arm: taped to the elbow, so the wrapped fist at the
  // end of the reach stays pale and the outstretched arm reads as an arm rather than
  // as one more strip of tape sticking out of him.
  { row: 10, h: 2, col: 13, w: 2, need: 2 },
  { row: 19, h: 1, col: 3, w: 9, need: 2 },
  // Last layer: the two that actually hold his arms in.
  { row: 11, h: 2, col: 2, w: 11, need: 1 },
  { row: 17, h: 1, col: 3, w: 9, need: 1 },
];

/** One strip of hazard tape: yellow ground, sheared black ticks, big pixels. */
function tapeStrip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 1,
  tickPhase = 0,
): void {
  if (w <= 0 || h <= 0) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  pxRect(ctx, TAPE, x, y, w, h, 2);
  pxRect(ctx, TAPE_SHADE, x, y + h - 2, w, 2, 2);
  for (let i = tickPhase % 12; i < w - 2; i += 12) {
    pxRect(ctx, TAPE_TICK, x + i, y, Math.min(5, w - i), h - 2, 2);
  }
  ctx.globalAlpha = prev;
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

    // Looping back to the start column: harmless the whole beat, and drawn
    // *arriving* rather than simply appearing. The ramp IS the telegraph.
    const arriving = m.phase === 'returning';
    const alpha = arriving ? 0.12 + 0.88 * m.progress : 1;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * alpha;

    // Trudge: a two-frame lurch every 24px of floor, plus the stiff-legged lean
    // that goes with it. Zero under reduced motion.
    const gait = reduced ? 0 : Math.floor(box.x / 24) % 2;
    const bob = wrapped ? gait * 2 : 0;
    const top = box.y + bob;

    // Contact shadow, so he is planted on the floor rather than hovering over it.
    pxRect(ctx, 'rgba(0,14,20,0.4)', box.x + 4, box.y + box.h - 3, box.w - 8, 4, 1);

    // Loose ends trailing off the wrap — the tell that he is *bound*, not just
    // badly dressed. They shorten with every layer that comes off.
    if (wrapped) {
      // Two ends, one off the shoulder and one off the hip, each stepping downward
      // to a curl. Three long horizontal strips were tried first and rasterised as
      // a small ladder standing next to him: a hanging end has to *fall*.
      // One short end off the hip, three steps, tucked against the body. Longer
      // versions and a second end were both tried and both rasterised as a small
      // yellow ladder standing beside him: an end has to read as attached, and the
      // figure carries the mummy read on its own.
      const wag = reduced ? 0 : Math.round(Math.sin(t * 5) * 3) * 3;
      const back = flip ? 1 : -1;
      const rootX = flip ? box.x + box.w - 12 : box.x + 3;
      for (let k = 0; k < 3; k += 1) {
        tapeStrip(ctx, rootX + back * (3 + k * 5), top + 46 + k * 6 + wag, 9, 5, 0.85, k * 4);
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
      for (const b of BANDS) {
        if (layers < b.need) continue;
        // Flip mirrors the band's column window too, so the arm wrap stays on the
        // arm when he faces the other way.
        const col = flip ? COLS - b.col - b.w : b.col;
        tapeStrip(ctx, box.x + col * SCALE, top + b.row * SCALE, b.w * SCALE, b.h * SCALE, fade, b.row * 3);
      }
    }

    // The tape coming off him as the last layer goes.
    if (m.phase === 'unravelling') {
      for (let i = 0; i < 7; i += 1) {
        const fall = m.progress * (56 + i * 18);
        const drift = (i % 2 === 0 ? -1 : 1) * m.progress * 16;
        tapeStrip(ctx, box.x - 10 + i * 12 + drift, top + 16 + fall, 16, 6, 1 - m.progress, i * 5);
      }
    }

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
        alpha: 0.85 * alpha,
      });
      // Three pips: layers left, so the shot count is legible in the world instead
      // of in a HUD element.
      for (let i = 0; i < 3; i += 1) {
        pxRect(
          ctx,
          i < m.layers ? TAPE : 'rgba(207,230,236,0.22)',
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
    tapeStrip(ctx, x + (w - ww) / 2 + off, top + dy, ww, 7, 0.95, dy);
  }
  // Loose ends whipping off both sides, and a shred settling on the floor.
  for (let k = 0; k < 3; k += 1) {
    tapeStrip(ctx, x - 8 - k * 6, top + 30 + k * 5 + jitter, 9, 5, 0.85, k * 4);
    tapeStrip(ctx, x + w - 2 + k * 6, top + 44 - k * 5 - jitter, 9, 5, 0.85, k * 4);
  }
  tapeStrip(ctx, x + 8, feetY - 5, 26, 5, 0.7, 4);
}

// ---------------------------------------------------------------------------
// The cutter
// ---------------------------------------------------------------------------

/**
 * The cutter, authored 16×9 and drawn at scale 2 → a 32×18 tool.
 *
 * Deliberately a substantial object rather than a few rectangles: it is the only
 * thing in the game the player *holds*, it is the proof the badge did something,
 * and at this size it reads as a tool at a glance from across the frame.
 */
const CUTTER: readonly string[] = [
  '......KKKK........',
  '.....KyYYyK.......',
  '.....KyYYyK.......',
  '..KKKKKKKKKKK.....',
  '..KbbbbbbbbbKKKKK.',
  '..KbBBBBBBBbMMMMK.',
  '..KbBBBBBBBbMoooMK',
  '..KbBBBBBBBbMMMMK.',
  '..KbbbbbbbbbKKKKK.',
  '..KKKgGgKKKKK.....',
  '....KgGgK.........',
  '....KgGgK.........',
  '....KKKKK.........',
];

const CUTTER_PALETTE: Palette = {
  K: OUTLINE,
  b: '#4E7A88', // receiver shade — the dark that gives the tool its shape
  B: '#CFE6EC', // lit face
  y: TAPE_SHADE, // the reel of tape it takes off him, mounted on top
  Y: TAPE,
  M: '#FF5400', // muzzle housing (the one orange the player carries)
  o: '#FFF2D0', // bore
  g: '#233A44', // grip
  G: '#3C5C69',
};

/**
 * Authored 18×13, drawn at scale 2 → a 36×26 tool.
 *
 * Scale 3 was tried first and rasterised badly: at 54×39 the cutter was as wide as
 * the hero and read as a plank across his chest rather than as something he was
 * holding. 36×26 still lands as a substantial object beside a 48×60 figure while
 * leaving his silhouette intact.
 */
const CUTTER_SCALE = 2;

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
  const w = 18 * CUTTER_SCALE;
  // Barrel on the pulse's own line: chest, not hip.
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
    pxRect(ctx, '#FFF2D0', muzzleX - 4, muzzleY - 6, 8, 4, 2);
    pxRect(ctx, '#FFF2D0', muzzleX - 4, muzzleY + 8, 8, 4, 2);
  } else if (!reduced) {
    // Armed and idle: two full-alpha pilot cells at the muzzle. A low-alpha glow
    // field was tried here and did exactly what the badge's dithered halo did —
    // over the dark room it desaturated into a grey-brown box that read as a
    // rendering fault. Few cells at full alpha say "live"; many at low alpha do not.
    pxRect(ctx, '#FFB07A', muzzleX - (facing === 1 ? 0 : 4), muzzleY + 2, 4, 4, 2);
    pxRect(ctx, '#FFF2D0', muzzleX - (facing === 1 ? -2 : 6), muzzleY + 2, 2, 4, 2);
  }
}

/** The cutter's pulse: a bright core, a warm wake, and shreds of tape behind it. */
export function drawShots(ctx: CanvasRenderingContext2D, shots: ShotState[]): void {
  for (const s of shots) {
    const { box } = s;
    const tail = s.dir === 1 ? box.x - 20 : box.x + box.w;
    pxRect(ctx, 'rgba(255,84,0,0.28)', tail, box.y + 1, 20, box.h - 2, 2);
    pxRect(ctx, '#FF7A2A', box.x, box.y - 1, box.w, box.h + 2, 2);
    pxRect(ctx, '#FFF2D0', box.x + (s.dir === 1 ? box.w - 8 : 0), box.y - 1, 8, box.h + 2, 2);
    // A shred of tape spinning off the cut, two big pixels, offset by direction.
    pxRect(ctx, TAPE, tail + 4, box.y - 8, 5, 4, 2);
    pxRect(ctx, TAPE_SHADE, tail + 10, box.y + 10, 5, 4, 2);
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
  pxRect(ctx, '#F4DC7A', x, y, w, 2, 2);
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
  // A hazard lamp on the top rail — the amber blinker every barrier carries.
  pxRect(ctx, '#1A2E38', x - 7, top - 12, 14, 12, 2);
  pxRect(ctx, '#FFD9A8', x - 5, top - 10, 10, 8, 2);
  pxRect(ctx, 'rgba(0,16,22,0.32)', left, base - 3, w, 3, 1);
}

/** Traffic cone. Yellow and black rather than road orange: orange means value. */
function cone(ctx: CanvasRenderingContext2D, x: number): void {
  const base = GROUND_TOP;
  const h = 48;
  for (let i = 0; i < h; i += 4) {
    const half = 3 + (i / h) * 15;
    const band = i > 14 && i < 26;
    pxRect(ctx, band ? '#E6E6E6' : TAPE, x - half, base - h + i, half * 2, 4, 2);
  }
  pxRect(ctx, TAPE_SHADE, x - 22, base - 6, 44, 6, 2);
  pxRect(ctx, TAPE_TICK, x - 22, base - 6, 44, 2, 2);
  pxRect(ctx, 'rgba(0,16,22,0.3)', x - 22, base - 2, 44, 2, 1);
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

/** A-frame wet floor sign, with the black figure everyone recognises. */
function wetFloorSign(ctx: CanvasRenderingContext2D, x: number): void {
  const base = GROUND_TOP;
  const h = 56;
  const w = 38;
  for (let i = 0; i < h; i += 4) {
    const half = 5 + (i / h) * (w / 2);
    pxRect(ctx, i < 6 ? TAPE_SHADE : TAPE, x - half, base - h + i, half * 2, 4, 2);
  }
  pxRect(ctx, TAPE_TICK, x - 5, base - 44, 7, 7, 2);
  pxRect(ctx, TAPE_TICK, x - 2, base - 36, 5, 12, 2);
  pxRect(ctx, TAPE_TICK, x + 3, base - 29, 9, 4, 2);
  pxRect(ctx, TAPE_TICK, x - 12, base - 17, 22, 3, 2);
  pxRect(ctx, 'rgba(0,16,22,0.3)', x - w / 2, base - 3, w, 3, 1);
}

/** Tape stand: weighted base, chrome post, a reel of tape at the top. */
function tapePost(ctx: CanvasRenderingContext2D, x: number): void {
  const base = GROUND_TOP;
  pxRect(ctx, '#1E353E', x - 14, base - 8, 28, 8, 2);
  pxRect(ctx, '#33505C', x - 5, base - 142, 10, 136, 2);
  pxRect(ctx, '#7CA6B4', x - 5, base - 142, 3, 136, 2);
  pxRect(ctx, TAPE, x - 11, base - 138, 22, 12, 2);
  pxRect(ctx, TAPE_TICK, x - 11, base - 138, 5, 10, 2);
  pxRect(ctx, 'rgba(0,16,22,0.3)', x - 14, base - 3, 28, 3, 1);
}

/**
 * Tape strung between two posts, sagging under its own weight.
 *
 * Two runs, one above the other, because a single line rasterised as a wire rather
 * than as a taped-off area. Both are stepped in whole pixels, never rotated.
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
    for (let i = 0; i < span; i += 10) {
      const u = i / span;
      const dy = Math.round((sag * 4 * u * (1 - u)) / 4) * 4;
      tapeStrip(ctx, x0 + i, y + dy, 10, 9, 1, i + phase);
    }
  }
}

// ---------------------------------------------------------------------------
// The light, and the damage
// ---------------------------------------------------------------------------

/**
 * One recessed strip fitting, drawn into the aperture `scenery.ts` left for it.
 *
 * The aperture is shared geometry rather than a number written twice: a lamp that
 * misses its own hole in the ceiling is the same class of defect as a pickup drawn
 * where its hitbox is not.
 */
function stripLight(ctx: CanvasRenderingContext2D, cx: number, lit: number): void {
  const { FIT_W: w, FIT_Y: y, FIT_H: h } = CEILING;
  const x = cx - w / 2;
  pxRect(ctx, '#0A2730', x, y, w, h, 2); // tray
  pxRect(ctx, '#154C5A', x, y, w, 3, 2);
  /*
   * ONE diffuser panel with two ribs across it, not two separate tubes.
   *
   * Drawn as two pale bars in a dark tray it rasterised as a *vent* — which is
   * exactly what a pair of thin light strips in a housing looks like from across a
   * frame, and there is already a duct on this screen for anybody to compare it
   * with. A fitting is a lit rectangle; the ribs are what say it is a fitting and
   * not a hole.
   */
  pxRect(ctx, `rgba(234,250,255,${(0.08 + 0.92 * lit).toFixed(3)})`, x + 8, y + 6, w - 16, h - 12, 2);
  for (const dy of [12, 18]) pxRect(ctx, 'rgba(10,39,48,0.55)', x + 8, y + dy, w - 16, 2, 2);
  const cheek = `rgba(180,226,238,${(0.08 + 0.4 * lit).toFixed(3)})`;
  pxRect(ctx, cheek, x + 3, y + 4, 4, h - 8, 2);
  pxRect(ctx, cheek, x + w - 7, y + 4, 4, h - 8, 2);
  // The ceiling itself catching it, all the way round the aperture.
  if (lit > 0.05) {
    const lip = `rgba(226,246,252,${(0.4 * lit).toFixed(3)})`;
    pxRect(ctx, lip, x - 4, y + h, w + 8, 4, 2);
    pxRect(ctx, `rgba(226,246,252,${(0.16 * lit).toFixed(3)})`, x - 22, y + h + 4, w + 44, 6, 2);
    pxRect(ctx, lip, x - 4, y - 4, w + 8, 4, 2);
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
  pxRect(ctx, a(0.13), cx - 104, CEILING.H + 4, 208, 10, 2); // wall under the ceiling
  pxRect(ctx, a(0.2), cx - 92, 108, 184, 4, 2); // top of the services duct
  pxRect(ctx, a(0.1), cx - 112, 330, 224, 4, 2); // the dado rail
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
   * The widest band is 140, i.e. 280px of floor per fitting.
   *
   * It was 192 first, and four pools that wide simply *met*: 8→392, 308→692,
   * 608→992, 908→1292, which paints the entire ground band one value lighter and
   * reads as the floor's own top edge rather than as light falling on it. A pool
   * only says "light" if there is unlit floor either side of it — the dark between
   * the pools is as much of the picture as the pools are.
   */
  // Seven steps rather than four: the pool has to *slope*. Four wide bands read as
  // three stacked rectangles, i.e. as patches painted on the floor; a profile that
  // widens a little on every step reads as light spreading away from the fitting.
  const bands: readonly [number, number, number, number][] = [
    [54, 0, 6, 0.5],
    [70, 6, 8, 0.4],
    [88, 14, 10, 0.31],
    [106, 24, 12, 0.23],
    [124, 36, 14, 0.16],
    [142, 50, 16, 0.1],
    [160, 66, 18, 0.06],
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
  pxRect(ctx, `rgba(226,246,252,${(0.3 * lit).toFixed(3)})`, cx - 70, GROUND_TOP - 3, 140, 3, 1);
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
  pxRect(ctx, '#17566A', x, b - 40, 30, 40, 2); // back, now on its side
  pxRect(ctx, '#46A6BC', x, b - 40, 30, 3, 2);
  pxRect(ctx, '#1E6478', x + 30, b - 34, 8, 34, 2); // seat, edge on
  pxRect(ctx, '#0C3340', x + 38, b - 22, 22, 6, 2); // post, lying flat
  pxRect(ctx, '#0C3340', x + 58, b - 30, 5, 26, 2); // base, in the air
  pxRect(ctx, '#17566A', x + 60, b - 32, 14, 5, 2);
  pxRect(ctx, '#17566A', x + 60, b - 12, 14, 5, 2);
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
    pxRect(ctx, '#1E6478', x + w - 6, dy, out, drawerH - 6, 2);
    pxRect(ctx, '#46A6BC', x + w - 6, dy, out, 3, 2);
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
    [214, 372, false],
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
    pxRect(ctx, '#17566A', bx + dx, b - dy, s, s - 2, 2);
    pxRect(ctx, '#46A6BC', bx + dx, b - dy, s, 4, 2);
    pxRect(ctx, '#C6D4D9', bx + dx + 6, b - dy + 10, s - 12, 3, 2);
  }
  pxRect(ctx, '#17566A', bx + 40, b - 24, 40, 24, 2);
  pxRect(ctx, '#46A6BC', bx + 40, b - 24, 40, 3, 2);
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
  ctx.fillStyle = `rgba(170,225,240,${(0.075 * r).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);

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
    // Somebody back at two of the three desks. "A workplace that works" is this
    // screen's meaning tag, and this is the picture of it — the room does not just
    // stop being broken, it starts being used.
    if (i === 0 || i === 2) deskWorker(ctx, x + 164);
  }
  // Daylight lifting in the glazing, and the floor catching all of it.
  pxRect(ctx, `rgba(159,216,228,${(0.1 * r).toFixed(3)})`, WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, 2);
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
    stripLight(ctx, cx, lit);
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
