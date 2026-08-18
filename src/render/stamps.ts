/**
 * The DENIED stamps of Screen 1, painted.
 *
 * Pure canvas: it takes the hazard's own snapshot and draws it, with no access to
 * the wall clock, the DOM or the Simulation. Everything here is derived from
 * `StampState`, which is derived from sim time — so the picture is identical
 * under `prefers-reduced-motion` (there is no decorative motion to switch off)
 * and the module can be rasterised on its own to check the pixels.
 *
 * Three readability jobs beyond "draw a stamp":
 *
 *  1. every column carries a permanent **ink pad** on the floor, so a parked
 *     stamp is still a marked danger column rather than an ambush;
 *  2. a **rail** runs from the ceiling to the handle, so the thing reads as a
 *     mechanism pressing down and not as a random falling block;
 *  3. a floor **shadow** tightens and darkens as the head bears down — the one
 *     cue that survives a 0.14s slam.
 *
 * Slate and light grey only. Orange stays reserved for value, and the hazard is
 * told apart by shape and motion, not by colour.
 */
import { RESOLUTION, HAZARDS } from '../data/tuning.config';
import type { StampState } from '../world/Hazards/Stamps';
import { pxRect } from './PixelArt';
import { drawText } from './PixelText';

const S = HAZARDS.STAMPS;
const GROUND_TOP = 15 * RESOLUTION.TILE;
const PX = 4;

/** The floor mark under every stamp column. Drawn whether the stamp is up or not. */
export function drawInkPads(ctx: CanvasRenderingContext2D, columns: number[]): void {
  const inset = S.WIDTH / 2 - PX;
  for (const cx of columns) {
    pxRect(ctx, 'rgba(6, 26, 33, 0.55)', cx - inset, GROUND_TOP, inset * 2, PX * 2, PX);
    pxRect(ctx, 'rgba(207, 230, 236, 0.18)', cx - inset, GROUND_TOP, inset * 2, PX, PX);
  }
}

/**
 * Paint the stamps. `slowed` is the assisted state: the same object, gone quiet,
 * because ANSR is holding the mechanism at a pace you can walk through.
 */
export function drawStamps(
  ctx: CanvasRenderingContext2D,
  states: StampState[],
  slowed: boolean,
  revealAt: number | null = null,
): void {
  const W = S.WIDTH;
  const headH = S.HEAD_H;

  for (const s of states) {
    const cx = s.cx;
    // On the life-lost frames the guilty stamp recoils, so the flattened player
    // is visible underneath instead of buried inside an 88px block.
    const lift = revealAt !== null && Math.abs(cx - revealAt) < 1 ? S.REVEAL_LIFT : 0;
    const bottom = s.bottomY - lift;
    const top = bottom - headH;

    // Rail from the ceiling down to the handle.
    pxRect(ctx, 'rgba(120, 158, 170, 0.30)', cx - PX / 2, 0, PX, Math.max(0, top - PX * 5), PX);

    // Floor shadow: tightens and darkens as the head bears down. Drawn on the
    // ground band over the ink pad, so the pad visibly darkens under an incoming
    // stamp rather than the two cues fighting for the same 4px.
    const drop = Math.max(0, Math.min(1, s.press));
    const halfW = (W / 2) * (0.55 + 0.45 * drop);
    pxRect(
      ctx,
      `rgba(2, 14, 18, ${0.18 + 0.5 * drop})`,
      cx - halfW,
      GROUND_TOP,
      halfW * 2,
      PX * 2,
      PX,
    );

    // Handle + neck above the head.
    pxRect(ctx, '#2A4550', cx - PX * 5, top - PX * 6, PX * 10, PX * 3, PX);
    pxRect(ctx, '#3E6472', cx - PX * 5, top - PX * 6, PX * 10, PX, PX);
    pxRect(ctx, '#2A4550', cx - PX * 2, top - PX * 3, PX * 4, PX * 3, PX);

    // Head block. Exactly `WIDTH` wide — never wider than the hitbox.
    pxRect(ctx, '#33505C', cx - W / 2, top, W, headH, PX);
    pxRect(ctx, '#4E7280', cx - W / 2, top, W, PX, PX); // lit top edge
    pxRect(ctx, '#1E353E', cx - W / 2, bottom - PX * 3, W, PX * 3, PX); // rubber pad

    // Face plate carrying the word.
    const plateY = top + PX * 3;
    const plateH = headH - PX * 8;
    pxRect(
      ctx,
      slowed ? '#9FB6BE' : '#E6E6E6',
      cx - W / 2 + PX * 2,
      plateY,
      W - PX * 4,
      plateH,
      PX,
    );
    pxRect(ctx, '#0E2A33', cx - W / 2 + PX * 2, plateY, W - PX * 4, PX, PX);
    drawText(ctx, 'DENIED', cx, plateY + plateH / 2 - 7, {
      scale: 2,
      color: slowed ? '#2C4A55' : '#3A1414',
      align: 'center',
    });

    // Wind-up. The slam itself is 0.14s, far too fast to react to, so this is the
    // cue the player actually plays against: the head cocks back a few pixels and
    // the column it is about to print lights up from the floor. Both ramp smoothly
    // (never a strobe) and neither moves the hitbox.
    if (s.warn > 0) {
      const w = s.warn;
      const lit = `rgba(207, 230, 236, ${0.18 + 0.5 * w})`;
      // A dashed column between the parked head and the floor it is about to
      // print on — the same "this lane is next" language the fire lanes use. It
      // has to be the column rather than a cue on the head itself: a parked stamp
      // hangs mostly above the frame, so anything drawn up there is not seen.
      for (let y = bottom + PX * 2; y < GROUND_TOP - PX; y += PX * 4) {
        pxRect(ctx, lit, cx - PX, y, PX * 2, PX * 2, PX);
      }
      // Brightening print line + chevrons closing in on the pad.
      pxRect(ctx, lit, cx - W / 2 + PX, GROUND_TOP, W - PX * 2, PX, PX);
      const half = Math.round((W / 2 - PX * 2) * (0.9 - 0.45 * w));
      for (let i = 0; i < 3; i += 1) {
        const inset = Math.round((half * i) / 4);
        pxRect(ctx, lit, cx - half + inset, GROUND_TOP - PX * (i + 1), PX, PX, PX);
        pxRect(ctx, lit, cx + half - inset - PX, GROUND_TOP - PX * (i + 1), PX, PX, PX);
      }
    }

    // Backing off a player it cannot press: a short upward tick on both flanks so
    // the refusal reads as the stamp being stopped, not as a miss.
    if (s.retracting) {
      pxRect(ctx, 'rgba(159, 230, 196, 0.7)', cx - W / 2 - PX * 2, bottom - PX * 5, PX, PX * 5, PX);
      pxRect(ctx, 'rgba(159, 230, 196, 0.7)', cx + W / 2 + PX, bottom - PX * 5, PX, PX * 5, PX);
    }
  }
}
