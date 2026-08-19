/**
 * The Compliance maze's cast: the five compliance monsters, the landing they walk
 * off to, and the clearance lift.
 *
 * The creature is **the one that is on GitHub** — `Game.drawGates` on `origin/main`,
 * i.e. the deployed build (owner call, four times: "pull the monster we have in
 * github" · "I don't want these eyes and mouth" · "I want the variant of the
 * creature that we have on github" · "still you haven't brought the full version,
 * I want exactly those creatures in both the states").
 *
 * **It is a creature in two parts, and that is the whole point.** A slate filing
 * cabinet standing on the floor — lit top course, two dark drawer seams — a gap,
 * and then a pale rounded approval head **floating above it** with one dark slot
 * through the middle (the "PENDING" bar, and deliberately not a face: no eyes, no
 * mouth, no horns). Between them lies the striped boom arm. 35×65 px in total.
 * Both states are one object: pending is a pale head with a dark-red slot and the
 * boom down across the body; cleared is a mint head with a dark-green slot and the
 * boom swung up clear on the diagonal. The cabinet does not change colour in
 * either — only the head does, which is what makes the change read.
 *
 * **Why this is the fourth version, and what the first three each got wrong.**
 * Pass one drew a horned, fanged animal. Pass two kept the deployed *palette* and
 * a *description* of the shape, then re-authored it at 34×52, which rasterises as a
 * parking meter. Pass three transcribed the deployed drawing code, cell for cell —
 * and still shipped **only the head**, because it rendered `drawGates` with the
 * head and the cabinet anchored to the same row, which stacks them into one 30×30
 * lump. The deployed screen does not do that: its gates are authored at **gy 14**
 * while `drawGates` anchors the *cabinet* to the screen floor (`groundY = 15 * TILE`)
 * and the *head and arm* to the gate's own row. One row of difference, and the
 * creature has a body, a gap and a floating head instead of a hat. Rendering the
 * code with its real level data instead of a convenient ground line is what found
 * it — **transcribe the data as well as the drawing.**
 *
 * Transcribed offsets, all from `git show HEAD:src/core/Game.ts` at `PX = 5`, and
 * all reproduced here to the pixel against the monster's feet:
 * head 65→40px above the feet · boom 45→35 · a 5px gap · cabinet the bottom 30.
 *
 * Pure canvas: it takes the hazard's own snapshot and paints it, with no wall
 * clock, no DOM and no Simulation, so the module can be rasterised on its own to
 * check the pixels and the picture is identical under `prefers-reduced-motion`
 * (everything that moves here is gameplay).
 *
 * Three rules the art obeys:
 *
 *  - **The sprite is the hitbox.** The authored grid is 7×13 cells at scale 5 =
 *    exactly `MONSTER_W`×`MONSTER_H` (35×65), and a test guards it. The boom at rest
 *    is exactly the grid's width, so a *blocking* monster paints nothing outside its
 *    own box; the only thing that ever leaves it is the boom once raised, which is
 *    legal precisely because a friendly monster cannot cost anything.
 *  - **One grid, two states.** `H` (the head) and `c` (the slot through it) are the
 *    only cells that change meaning; the cabinet is shared. That keeps a second grid
 *    out of a 90 KB budget, and it is also true to the original.
 *  - **No orange.** Orange is the value accent. These read by shape (a head on a
 *    cabinet, a striped arm) and by motion (aimless wandering), never by colour.
 *
 * The names are the joke and the argument at once: the things blocking the build
 * are TAX, GST, LEGAL, ENTITY and AUDIT. They are set in the 5×7 bitmap font
 * on a framed plaque **over each monster** — which is where the owner asked for
 * the TAX/GST/AUDIT signage to live, instead of on boards hanging in the sky.
 */
import { drawPixels, pxRect, type Palette } from './PixelArt';
import { drawLabelPlaque } from './PixelText';
import type { LiftState, MonsterState } from '../world/Hazards/ComplianceMaze';

/**
 * One authored cell = 5 screen px — the deployed build's own `PX`, so every piece
 * is transcribed cell for cell rather than resampled. 7×13 cells is the hitbox.
 */
export const MONSTER_SCALE = 5;

/**
 * 7 wide × 13 tall — exactly `MONSTER_W`×`MONSTER_H` (35×65) at scale 5. Read from
 * the deployed build's absolute geometry, which lands every piece on the same 5px
 * grid: head 535–560, boom 555–565, cabinet 570–600, with the feet at 600.
 *
 * Rows 0–4 — **the head**, verbatim from `Game.drawGates`:
 * `' HHHH '` / `'HHHHHH'` / `'HccccH'` / `'HHHHHH'` / `' HHHH '`, 6 cells wide.
 * `c` is the dark slot cut straight through the middle. That is the whole "face",
 * and it is meant to be featureless.
 *
 * Row 5 — where the boom lies while it blocks (drawn separately, since it moves).
 *
 * Row 6 — **the gap**. It is not padding: the head floats, and the space between
 * it and the cabinet is what the deployed screen shows. Closing it turns the
 * creature into a stamp wearing a hat, which is the defect the last pass shipped.
 *
 * Rows 7–12 — **the cabinet**: lit top course (`L`), face (`P`), and the two drawer
 * seams (`d`) at the deployed build's own rows. 4 cells wide against the head's 6,
 * so the head reads as wider than the body it rides on.
 *
 * Column 6 is only ever used by the boom, which is 7 cells wide. That is why the
 * grid is 7 and not 6: the boom at rest must fit inside the hitbox.
 *
 * The grid is left–right symmetric, so the sprite is never flipped: which way a
 * monster is going is carried by the fact that it is *going*, not by its face —
 * which is the point of a rubber stamp as an antagonist.
 */
export const MONSTER: readonly string[] = [
  '.HHHH..',
  'HHHHHH.',
  'HccccH.',
  'HHHHHH.',
  '.HHHH..',
  '.......',
  '.......',
  '.LLLL..',
  '.PPPP..',
  '.PddP..',
  '.PPPP..',
  '.PddP..',
  '.PPPP..',
];

const SHARED: Palette = {
  L: '#4E7280', // cabinet top course, lit — the deployed build's own highlight
  P: '#33505C', // cabinet face
  d: '#1E353E', // drawer seams
};

/** Pending: the pale approval head with the dark slot through it. */
const ANGRY: Palette = {
  ...SHARED,
  H: '#CFE6EC', // head — the lightest thing on a brown wall, so the silhouette wins
  c: '#3A1414', // the slot: the deployed barrier's "PENDING" core, unchanged
};

/** Cleared: the same head and the same slot, filed. */
const SMILING: Palette = {
  ...SHARED,
  H: '#9FE6C4',
  c: '#0A3A2A',
};

/** px wide, derived from the grid so the boom and the sprite can never disagree. */
const MONSTER_PX_W = MONSTER[0]!.length * MONSTER_SCALE;

/**
 * The monsters, and the boom arm each one raises when it turns friendly.
 *
 * `friendly` is the only thing that changes the face, and it is the point of the
 * badge on this screen, so it has to be legible at a glance from across the frame:
 * colour, brows, mouth and the arm all move together.
 */
export function drawMonsters(ctx: CanvasRenderingContext2D, monsters: MonsterState[]): void {
  for (const m of monsters) {
    const cx = m.box.x + m.box.w / 2;
    const x0 = Math.round(m.box.x);
    // Contact shadow, so a monster on a stair tread does not look airborne.
    pxRect(ctx, 'rgba(0,16,22,0.35)', m.box.x + 4, m.box.y + m.box.h - 2, m.box.w - 8, 3, 1);

    // The striped boom arm, painted BEHIND the head exactly as the deployed build
    // paints it. That draw order is part of the picture: at rest the head covers the
    // boom's inner cells, so what shows is a striped bar tucked under the jaw with
    // its ends poking out either side, and the barrier *swings out* as it rises.
    // Painted on top instead (tried, rastered, rejected) it is a head with a white
    // bar across it, which is a different object.
    //
    // Geometry from `Game.drawGates`, verbatim: it sits at the head's fifth row
    // (`armY = topY + PX * 2`), rises `open * PX * 7`, and each 5px segment is lifted
    // a further `open * seg * 0.55`, so the boom pivots rather than sliding. Seven
    // cells wide, which is exactly the hitbox: the deployed arm was 35px wide on a
    // 26px box, and this grid is 7 cells precisely so that the same 35px arm fits
    // inside this one. Raised it leaves the box, which is legal because a friendly
    // monster cannot cost the player anything.
    const ARM_H = MONSTER_SCALE * 2;
    const armY = m.box.y + MONSTER_SCALE * 4 - m.arm * MONSTER_SCALE * 7;
    for (let i = 0; i < MONSTER_PX_W / MONSTER_SCALE; i += 1) {
      const seg = i * MONSTER_SCALE;
      // Two cells on, two off: the hazard stripe reads without colour.
      const stripe = Math.floor(i / 2) % 2 === 0 ? '#E6E6E6' : '#233A44';
      pxRect(ctx, stripe, x0 + seg, armY - m.arm * seg * 0.55, MONSTER_SCALE, ARM_H, 1);
    }

    drawPixels(ctx, MONSTER, m.friendly ? SMILING : ANGRY, m.box.x, m.box.y, {
      scale: MONSTER_SCALE,
    });

    // Name plate — a framed plaque, the same one the backdrop's filing cabinets
    // used to carry, moved onto the thing it names (owner call: "I don't want the
    // TAX, AUDIT and other overlays in the sky, rather on top of monsters"). It is
    // the screen's only signage now, so it can afford to be legible: scale 2 on a
    // solid dark plaque, cool grey while the filing is pending and mint once it is
    // through. Dropped once a monster has sat down on the landing, because five
    // names shoulder to shoulder render as one unreadable word — and by then they
    // have made their point.
    //
    // It steps up out of the way as the boom rises, because raised the boom reaches
    // above the head and that is exactly where the plaque sits — an earlier raster
    // had five booms hidden behind five name plates.
    if (!m.settled) {
      drawLabelPlaque(ctx, m.name, cx, m.box.y - 26 - m.arm * 34, {
        scale: 2,
        fg: m.friendly ? '#9FE6C4' : '#CFE6EC',
        bg: 'rgba(0,20,27,0.82)',
        frame: m.friendly ? 'rgba(90,190,150,0.55)' : 'rgba(28,120,142,0.6)',
        padX: 6,
        padY: 4,
        alpha: 0.95,
      });
    }
  }
}

/**
 * Where the monsters go once GCC-BOT has filed everything. Drawn only while they
 * are actually on their way (or sitting there), because before the badge it would
 * be a marker for something that has not been offered yet.
 */
export function drawGatherPad(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number } | null,
  show: boolean,
): void {
  if (!at || !show) return;
  const w = 190;
  // A dashed pad on the landing, in the "cleared" mint the rest of the game uses
  // for resolved obstacles — never the value orange.
  for (let i = 0; i < w; i += 8) {
    pxRect(ctx, 'rgba(159,230,196,0.5)', at.x - w / 2 + i, at.y - 4, 4, 4, 2);
  }
}

/**
 * The clearance lift — the plate that carries the player down into the far bay.
 *
 * It is the only thing in this level painted in its own colour rather than the
 * screen's stone material, and that is the point: everything else here is filed
 * paper stacked into architecture, and this is a machine that moves. A brick
 * texture said "another ledge" (owner call).
 *
 * The yellow is machinery yellow, not the reserved value orange (`#FF5400`) — the
 * same signal a real lift carries. The travel is drawn as well as the plate: a
 * dashed guide rail down the shaft says "this goes down" before the player has
 * stepped on, exactly the way the badge's rail says "this floats".
 */
export function drawLift(ctx: CanvasRenderingContext2D, lift: LiftState | null): void {
  if (!lift) return;
  const { box } = lift;
  const cx = box.x + box.w / 2;

  // Travel cue: chunky down-chevrons stepping through whatever descent the plate
  // has left, which is the owner's reference sketch's big arrow rendered in the
  // art's own idiom. It was a 4px dashed line, and a hairline down a 400px shaft
  // read as a wire rather than as "this goes down" — the affordance has to be the
  // size of the thing it is describing. They fade towards the bottom so the eye
  // travels the right way along them.
  // A chevron is 24px deep, so the loop has to leave room for the WHOLE glyph
  // inside the remaining travel — the rail may never draw past where the plate can
  // actually go (a test pins that, and a half-chevron hanging below the bottom of
  // the shaft would promise a descent the lift does not have).
  const railBottom = box.y + box.h + lift.remaining;
  const span = Math.max(1, lift.remaining);
  const CH = 6;
  for (let y = box.y + box.h + 14; y + CH * 4 + 2 <= railBottom; y += 44) {
    const fade = 0.34 - 0.2 * ((y - box.y - box.h) / span); // brightest under the plate
    const c = `rgba(239,201,76,${Math.max(0.1, fade).toFixed(2)})`;
    for (let i = 0; i < 4; i += 1) {
      // Two arms stepping down and inwards: a chevron, in whole 6px cells.
      pxRect(ctx, c, cx - 20 + i * CH, y + i * CH, CH, CH, 2);
      pxRect(ctx, c, cx + 14 - i * CH, y + i * CH, CH, CH, 2);
    }
  }

  // Plate: dark underside, yellow face, lit top edge — a machined slab.
  pxRect(ctx, '#3A2E08', box.x, box.y, box.w, box.h, 2);
  pxRect(ctx, '#EFC94C', box.x + 2, box.y + 2, box.w - 4, box.h - 6, 2);
  pxRect(ctx, lift.carrying ? '#FFF0B0' : '#FFE68A', box.x + 2, box.y + 2, box.w - 4, 4, 2);
  pxRect(ctx, '#8A6E22', box.x, box.y + box.h - 4, box.w, 4, 2);

  // Down chevrons on the plate: the sketch's arrow, in the art's own idiom.
  for (let i = -1; i <= 1; i += 1) {
    const ox = cx + i * 26;
    pxRect(ctx, '#6B5410', ox - 6, box.y + 5, 4, 4, 2);
    pxRect(ctx, '#6B5410', ox - 2, box.y + 9, 4, 4, 2);
    pxRect(ctx, '#6B5410', ox + 2, box.y + 5, 4, 4, 2);
  }
}
