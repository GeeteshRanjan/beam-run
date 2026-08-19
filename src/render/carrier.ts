/**
 * carrier.ts — the ANSR supply drone that delivers the badge on Hire Under Fire.
 *
 * Five screens hang their badge on a levitation rail (`render/badge.ts`). This one
 * has it **flown in** (owner call): a machine crosses the sky with the ANSR mark
 * slung under it, releases it over the ground, and the mark lies there for a few
 * seconds before it is gone. So this module draws three things — the drone, the
 * mark falling out of it, and the mark on the ground with its clock running out.
 *
 * Why a machine and not a bird: the screen already has a beast in it. A second
 * creature would be one more animal to read, where a drone is instantly the *other*
 * kind of thing on the frame — engineered, on our side, and unbothered by the
 * dragon. It is drawn in the brand's teals with one orange stripe, which is the only
 * orange on this screen that is not fire, and that is the point: help arriving,
 * marked with the same accent the badge itself carries.
 *
 * Pure, like every other render module here: the view and a phase in, cells out. The
 * *positions* come from `world/badgeDrop.ts`, which the simulation collides against —
 * so what is drawn and what can be taken cannot disagree.
 */
import { RESOLUTION, POWERUPS } from '../data/tuning.config';
import { pxRect, drawPixels, maxWidth, hash2, type Palette } from './PixelArt';
import { drawAnsrBadgeMark, BADGE_MARK_D } from './badge';
import { drawLabelPlaque } from './PixelText';
import type { DropView } from '../world/badgeDrop';

const { TILE: T } = RESOLUTION;
const GROUND_TOP = 15 * T;

const HULL_OUT = '#04222B';
const HULL = '#0F5A6C';
const HULL_LIT = '#3AB4CA';
const HULL_DARK = '#083A47';
const GLASS = '#9FD8E4';
const ACCENT = '#FF5400';
const CABLE = '#0B3E4A';
const CYAN = '92, 226, 244';

/**
 * The hull, authored 22×8 and drawn at scale 3 → a 66×24 machine.
 *
 * Small on purpose. It is not a character and it must never compete with the dragon
 * or the badge: a lozenge with a lit canopy, an orange stripe, two rotor masts and
 * two skids is the whole of it, and everything that moves (blades, cable sway) is
 * drawn procedurally on top so the grid stays proof-readable.
 */
const HULL_GRID: readonly string[] = [
  '.....KKKKKKKKKKKK.....',
  '...KKhhhhhhhhhhhhKK...',
  '..KhhHHHHHHHHHHHHhhK..',
  '.KhHggggHHHHHHHHHHHhK.',
  '.KhHggggHHHaaaaHHHHhK.',
  '..KhhHHHHHHaaaaHHHhK..',
  '...KKddKKKKKKKKddKK...',
  '.....KddK....KddK.....',
];

const HULL_PALETTE: Palette = {
  K: HULL_OUT,
  h: HULL_DARK,
  H: HULL,
  g: GLASS,
  a: ACCENT,
  d: HULL_LIT,
};

/**
 * Scale 4 → an 88×32 machine.
 *
 * Scale 3 was tried and rasterised *smaller than the badge it was carrying*, which
 * reads as a toy dropping a parcel bigger than itself. It still has to stay well
 * under the dragon's 200px, so the machine is small and busy rather than big.
 */
const HULL_SCALE = 4;
export const DRONE_W = maxWidth(HULL_GRID) * HULL_SCALE;
export const DRONE_H = HULL_GRID.length * HULL_SCALE;

/**
 * The drone, at the position `world/badgeDrop.ts` puts it.
 *
 * `phase` is the presentation clock in turns (constant under reduced motion). The
 * rotors are quantised to three frames — an 8-bit machine does not ease a blade —
 * and under reduced motion they hold on the widest one, which is a rotor rather
 * than no rotor.
 */
export function drawDrone(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  phase: number,
  reduced: boolean,
): void {
  const x = Math.round(cx - DRONE_W / 2);
  const y = Math.round(cy - DRONE_H / 2);

  // Rotor masts and blades, one over each shoulder of the hull. The blade sits ON the
  // mast, not floating above it: at a 10px gap the two blades rasterised as a pair of
  // detached cyan dashes in the sky.
  const frame = reduced ? 0 : Math.floor(phase * 24) % 3;
  const span = [38, 20, 30][frame]!;
  for (const mx of [x + 16, x + DRONE_W - 22] as const) {
    pxRect(ctx, HULL_DARK, mx, y - 9, 7, 12, 2);
    pxRect(ctx, HULL_OUT, mx - span / 2 + 3, y - 9, span, 5, 1);
    pxRect(ctx, HULL_LIT, mx - span / 2 + 3, y - 9, span, 2, 1);
  }

  drawPixels(ctx, HULL_GRID, HULL_PALETTE, x, y, { scale: HULL_SCALE });

  // Down-draught: three cells under the hull, held under reduced motion. Few cells
  // at full alpha rather than a wash — the badge halo lesson.
  if (!reduced) {
    for (let i = 0; i < 3; i += 1) {
      const n = (phase * 3 + i / 3) % 1;
      pxRect(ctx, `rgba(${CYAN}, ${0.5 - n * 0.4})`, x + 14 + i * 18, y + DRONE_H + n * 16, 5, 5, 5);
    }
  }
}

/**
 * The whole delivery: drone, cable, the mark under it or falling, and the landing
 * spot it is aimed at.
 *
 * The aiming chevron on the ground is not decoration — it is the affordance. The
 * badge is going to be takeable for a few seconds only, so the player has to be
 * able to start running *before* it lands, which means the ground has to say where
 * it will be while it is still in the air.
 */
export function drawBadgeDelivery(
  ctx: CanvasRenderingContext2D,
  view: DropView,
  phase: number,
  reduced: boolean,
): void {
  if (view.phase === 'gone') return;
  const dropX = view.dropGx * T + T / 2;

  // The drone keeps crossing after it has let go — it is still in the air until the
  // far edge, and cutting to nothing the instant the badge lands read as the machine
  // vanishing. It is only skipped once the whole delivery is over, by which time it
  // is off-frame anyway.
  drawDrone(ctx, view.carrier.x, view.carrier.y, phase, reduced);

  if (view.phase === 'carrying' || view.phase === 'falling') {
    // The landing spot, while the badge is still on its way: a bracket on the floor
    // with a chevron stepping up out of it.
    const lift = reduced ? 0 : Math.floor(phase * 6) % 2 === 0 ? 0 : 4;
    pxRect(ctx, `rgba(${CYAN}, 0.5)`, dropX - 22, GROUND_TOP - 5, 44, 5, 1);
    pxRect(ctx, `rgba(${CYAN}, 0.5)`, dropX - 22, GROUND_TOP - 14, 5, 10, 1);
    pxRect(ctx, `rgba(${CYAN}, 0.5)`, dropX + 17, GROUND_TOP - 14, 5, 10, 1);
    for (let i = 0; i < 3; i += 1) {
      pxRect(ctx, `rgba(${CYAN}, ${0.55 - i * 0.14})`, dropX - 3 + i * 0, GROUND_TOP - 22 - i * 8 - lift, 6, 5, 2);
      pxRect(ctx, `rgba(${CYAN}, ${0.35 - i * 0.1})`, dropX - 11, GROUND_TOP - 18 - i * 8 - lift, 5, 5, 2);
      pxRect(ctx, `rgba(${CYAN}, ${0.35 - i * 0.1})`, dropX + 6, GROUND_TOP - 18 - i * 8 - lift, 5, 5, 2);
    }
  }

  if (view.phase === 'carrying') {
    // The cable: it hangs from the hull to the mark, so the two are one object.
    const top = view.carrier.y + DRONE_H / 2 - 4;
    pxRect(ctx, CABLE, view.badge.x - 2, top, 4, view.badge.y - top - BADGE_MARK_D / 2, 2);
    pxRect(ctx, HULL_LIT, view.badge.x - 6, view.badge.y - BADGE_MARK_D / 2 - 6, 12, 6, 2);
  }

  if (view.phase === 'falling') {
    // Falling: a short wake above it so the drop reads as a drop, plus the mark.
    for (let i = 1; i <= 3; i += 1) {
      pxRect(
        ctx,
        `rgba(${CYAN}, ${0.4 - i * 0.1})`,
        view.badge.x - 3,
        view.badge.y - BADGE_MARK_D / 2 - i * 14,
        6,
        9,
        3,
      );
    }
  }

  drawAnsrBadgeMark(
    ctx,
    view.badge.x,
    view.badge.y,
    BADGE_MARK_D,
    Math.floor(phase * 8) % 2 === 0 ? 0 : 1,
  );

  if (view.phase === 'live') drawExpiryClock(ctx, view, phase, reduced);
}

/**
 * The badge on the ground, and the seconds it has left.
 *
 * Two cues, because "it is about to go" has to be legible from anywhere on the
 * frame and at a glance:
 *
 *  1. **A ring of cells that empties.** Twelve cells round the mark, one going out
 *     for each twelfth of the lifetime spent. A ring reads as a clock; a shrinking
 *     bar under a 40px icon reads as damage.
 *  2. **A blink in the last `WARN_TIME`.** Held frames, not a fade, and the ground
 *     bracket blinks with it so the cue is at the player's feet as well as on the
 *     pickup. Under reduced motion the blink is replaced by a steady warning tone on
 *     the same cells — the information stays, the flashing does not.
 */
function drawExpiryClock(
  ctx: CanvasRenderingContext2D,
  view: DropView,
  phase: number,
  reduced: boolean,
): void {
  const { x, y } = view.badge;
  const left = 1 - view.progress;
  const urgent = view.remaining <= POWERUPS.DROP.WARN_TIME;
  const blink = urgent && !reduced ? Math.floor(phase * 16) % 2 === 0 : true;

  // Landing dust it kicked up, stable per column so it does not shimmer.
  for (let i = 0; i < 5; i += 1) {
    const n = hash2(Math.round(x / 8) + i, 19);
    pxRect(ctx, 'rgba(198,182,150,0.35)', x - 26 + i * 12, GROUND_TOP - 4 - n * 4, 8, 4, 2);
  }
  // Four flare cells off the mark, at full alpha. A 40px logo lying on scorched brick
  // is a dark disc on a dark floor; four bright cells are what make it a *pickup*
  // from across the frame. Full alpha and few, never a wash — the halo lesson.
  for (const [dx, dy] of [
    [-26, -6],
    [26, -6],
    [-14, -26],
    [14, -26],
  ] as const) {
    pxRect(ctx, ACCENT, x + dx - 2, y + dy - 2, 5, 5, 1);
  }

  // The clock ring.
  const cells = 12;
  for (let i = 0; i < cells; i += 1) {
    if (i / cells > left) continue;
    const ang = (i / cells) * Math.PI * 2 - Math.PI / 2;
    const r = BADGE_MARK_D * 0.78;
    const cx = Math.round(x + Math.cos(ang) * r);
    const cy = Math.round(y + Math.sin(ang) * r);
    const color = urgent ? (blink ? '#FF5400' : 'rgba(255,84,0,0.25)') : `rgba(${CYAN}, 0.75)`;
    pxRect(ctx, color, cx - 2, cy - 2, 4, 4, 2);
  }

  // The bracket on the floor, so the pickup has a footprint rather than hovering.
  const foot = urgent && blink ? '#FF5400' : `rgba(${CYAN}, 0.55)`;
  pxRect(ctx, foot, x - 22, GROUND_TOP - 5, 44, 5, 1);

  // "NOW" plaque in the last beat: the one moment this screen tells the player to
  // hurry, and it says it in words because the ring alone is a shape nobody has
  // been taught yet.
  if (urgent && blink) {
    drawLabelPlaque(ctx, 'TAKE IT', x, y - BADGE_MARK_D - 6, {
      scale: 1,
      fg: '#FFF2D0',
      bg: 'rgba(40,12,0,0.8)',
      frame: 'rgba(255,84,0,0.75)',
      alpha: 0.95,
    });
  }
}
