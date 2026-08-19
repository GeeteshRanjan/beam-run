/**
 * The DENIED stamps of Screen 1, painted as real office rubber stamps.
 *
 * The silhouette is the thing everyone recognises from a desk: a turned wooden
 * knob, a narrow stem, a flange, the body carrying its printed index label, and a
 * black rubber die at the bottom. It is authored as a pixel grid (like the hero
 * and the badge) rather than as a pile of rectangles, because that is the idiom
 * the rest of the art uses and because the grid is what makes the shape read at
 * 8-bit scale. `DENIED` itself is set in the 5×7 bitmap font on the label panel,
 * so there is exactly one font in the game.
 *
 * Two rules the geometry has to obey, both guarded by tests:
 *
 *  - the **body** is authored to exactly `HAZARDS.STAMPS.HEAD_H` and exactly
 *    `WIDTH`, so the picture is the hitbox. The knob and stem sit *above* the
 *    box: being level with a stamp's handle is not being under its die.
 *  - **nothing is drawn above the stamp.** There is no rail, rope or rod holding
 *    it up — it is a stamp coming down, not a pile driver.
 *
 * Pure canvas: it takes the hazard's own snapshot and draws it, with no access to
 * the wall clock, the DOM or the Simulation. Everything is derived from
 * `StampState`, so the picture is identical under `prefers-reduced-motion` (there
 * is no decorative motion to switch off) and the module can be rasterised on its
 * own to check the pixels.
 *
 * Readability, in the absence of a rail: every column carries a permanent inked
 * impression on the floor, a floor shadow tightens as the die bears down, and the
 * last `WARN_TIME` of the cycle is a visible cock-back plus a brightening print
 * line — the slam itself is 0.14s, so the wind-up is what the player plays against.
 *
 * Slate, graphite and light grey only. Orange stays reserved for value, and the
 * hazard is told apart by shape and motion, not by colour.
 */
import { RESOLUTION, HAZARDS } from '../data/tuning.config';
import type { StampState } from '../world/Hazards/Stamps';
import { drawPixels, pxRect, type Palette } from './PixelArt';
import { drawText } from './PixelText';

const S = HAZARDS.STAMPS;
const GROUND_TOP = 15 * RESOLUTION.TILE;
const PX = 4;

/** One authored pixel = 4 screen px, so the 24-cell body is exactly `WIDTH`. */
export const STAMP_SCALE = 4;

/**
 * **Values, not hues, are what made this object visible** (owner: "the stamp is
 * almost the same colour as the background").
 *
 * It used to be painted in the same dark blue-greys as the sky it hangs in —
 * body `#33505C`, die `#1E353E`, handle `#2A3F49` — against a `#00212B`..`#05303a`
 * sky and a skyline of `#042A33` towers. Rasterised, only the white label panel
 * read at all: the frame, the handle and the rubber die dissolved into the city
 * behind them, so what the player actually saw was a floating white card, not a
 * stamp coming down. Same class of error as the wrapped figure in beige, and the
 * fix is the same one: put the object at the opposite end of the value scale from
 * its background rather than at a different point on the same end.
 *
 * So the whole tool is now light — a pale machined frame around a near-white
 * plate — with a near-black keyline round the outside and a near-black rubber
 * die. That gives it three things the sky cannot take away: the lightest field on
 * the upper half of the frame, a hard outline against both the sky *and* the clay
 * ground it presses onto, and the darkest value in the picture at the business
 * end, which is the part that can cost you a life.
 *
 * Still slate/graphite only. Orange stays reserved for value.
 */
const STAMP_PALETTE: Palette = {
  K: '#07121A', // keyline / seams (near-black, so the silhouette holds anywhere)
  G: '#3E5C68', // handle body (turned grip, the darkest part of the tool above the die)
  g: '#5C8391', // handle lit face
  H: '#B4D3DD', // knob highlight
  L: '#C3D9E0', // flange / lit top edge
  B: '#93B2BC', // body frame — pale machined metal, the read that was missing
  b: '#6F919D', // body shade
  W: '#F6FBFC', // printed index label
  w: '#CBDADF', // label shade
  D: '#12181C', // rubber die (the darkest value on the screen)
};

/**
 * Rows 0–9 are the turned knob and stem, which sit *above* the hitbox and give the
 * object its recognisable desk-stamp profile. Rows 10–31 are the pressing body:
 * 22 rows × scale 4 = 88px = `HEAD_H`, and 24 cols × 4 = 96px = `WIDTH`.
 *
 * The body stays full width rather than being waisted like a real stamp, because
 * the label has to carry DENIED at bitmap scale 2 (71px) and every cell inset from
 * the edge is 4px off the panel. The silhouette is therefore carried by the knob
 * and stem, and the body is separated from the rubber die by shading and a lit
 * seam instead of by width. The die is the full width of the hitbox on purpose: a
 * die narrower than the box would clip you with pixels that are not there.
 */
const STAMP: readonly string[] = [
  '.......KKKKKKKKKK.......',
  '.....KGggggggggggGK.....',
  '...KGgggHHHHgggggggGK...',
  '...KGgggHHHHgggggggGK...',
  '...KGggggggggggggggGK...',
  '...KGGGGGGGGGGGGGGGGK...',
  '.....KKGGGGGGGGGGKK.....',
  '........KGggggGK........',
  '........KGggggGK........',
  '........KGggggGK........',
  'KLLLLLLLLLLLLLLLLLLLLLLK',
  'KLLLLLLLLLLLLLLLLLLLLLLK',
  'KBBBBBBBBBBBBBBBBBBBBBBK',
  'KBbbbbbbbbbbbbbbbbbbbbBK',
  'KBwwwwwwwwwwwwwwwwwwwwBK',
  'KBWWWWWWWWWWWWWWWWWWWWBK',
  'KBWWWWWWWWWWWWWWWWWWWWBK',
  'KBWWWWWWWWWWWWWWWWWWWWBK',
  'KBWWWWWWWWWWWWWWWWWWWWBK',
  'KBWWWWWWWWWWWWWWWWWWWWBK',
  'KBwwwwwwwwwwwwwwwwwwwwBK',
  'KBbbbbbbbbbbbbbbbbbbbbBK',
  'KBBBBBBBBBBBBBBBBBBBBBBK',
  'KbbBBBBBBBBBBBBBBBBBBbbK',
  'KKKKKKKKKKKKKKKKKKKKKKKK',
  'KLLLLLLLLLLLLLLLLLLLLLLK',
  'KDDDDDDDDDDDDDDDDDDDDDDK',
  'KDDDDDDDDDDDDDDDDDDDDDDK',
  'KDDDDDDDDDDDDDDDDDDDDDDK',
  'KDDDDDDDDDDDDDDDDDDDDDDK',
  'KDDDDDDDDDDDDDDDDDDDDDDK',
  'KKKKKKKKKKKKKKKKKKKKKKKK',
];

/** Rows of `STAMP` that are the pressing body, i.e. the hitbox. */
export const STAMP_BODY_ROWS = 22;
const STAMP_H = STAMP.length * STAMP_SCALE;
/** Label panel: the `w`/`W`/`w` rows, where DENIED is set. */
const LABEL_TOP_ROW = 14;
const LABEL_ROWS = 7;

/**
 * The inked impression under every stamp column, printed on the floor. Drawn
 * whether the stamp is up or down: with no rail overhead this is what tells the
 * player a column is a stamp column before anything moves.
 */
export function drawInkPads(ctx: CanvasRenderingContext2D, columns: number[]): void {
  const half = S.WIDTH / 2 - PX;
  for (const cx of columns) {
    // The impression the column has printed before, ink-dark against the clay so it
    // reads as a mark on the floor rather than as a shadow.
    pxRect(ctx, 'rgba(4, 22, 28, 0.72)', cx - half, GROUND_TOP, half * 2, PX * 4, PX);
    pxRect(ctx, 'rgba(4, 22, 28, 0.45)', cx - half - PX, GROUND_TOP + PX, half * 2 + PX * 2, PX * 2, PX);
    // A worn print line along the top edge, and stray flecks either side.
    pxRect(ctx, 'rgba(207, 230, 236, 0.22)', cx - half, GROUND_TOP, half * 2, PX, PX);
    pxRect(ctx, 'rgba(4, 22, 28, 0.4)', cx - half - PX * 3, GROUND_TOP + PX, PX, PX, PX);
    pxRect(ctx, 'rgba(4, 22, 28, 0.4)', cx + half + PX * 2, GROUND_TOP + PX, PX, PX, PX);
    /*
     * **The ghost of the word is no longer printed here** (owner: less to read).
     * A scale-1 "DENIED" on the ground was 5px tall — below the size anything in
     * this game is legible at — so it never said the word to anybody; it read as a
     * grey smudge on the clay, four times over, on a screen that already says
     * DENIED on every stamp face at scale 2. The pad itself (dark impression,
     * bright print line, two flecks) is what marks the column, and now that the
     * stamps are light enough to see, the column is marked by the stamp too.
     */
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

  for (const s of states) {
    const cx = s.cx;
    // On the life-lost frames the guilty stamp recoils, so the flattened player is
    // visible underneath instead of buried under the die.
    const reveal = revealAt !== null && Math.abs(cx - revealAt) < 1 ? S.REVEAL_LIFT : 0;
    // …and during the wind-up it cocks back, which is the tell. Now that the stamp
    // parks in view this can be on the object itself; when it parked at the ceiling
    // the only place a tell could live was the floor.
    const cock = Math.round(s.warn * S.WARN_LIFT);
    const bottom = s.bottomY - reveal - cock;
    const gridTop = bottom - STAMP_H;

    // Floor shadow: tightens and darkens as the die bears down. Drawn on the ground
    // band over the impression, so the print visibly darkens under an incoming
    // stamp rather than the two cues fighting for the same 4px.
    const drop = Math.max(0, Math.min(1, s.press));
    const halfW = (W / 2) * (0.5 + 0.5 * drop);
    pxRect(
      ctx,
      `rgba(2, 14, 18, ${0.18 + 0.5 * drop})`,
      cx - halfW,
      GROUND_TOP,
      halfW * 2,
      PX * 2,
      PX,
    );

    drawPixels(ctx, STAMP, STAMP_PALETTE, cx - W / 2, gridTop, { scale: STAMP_SCALE });

    // The printed index label. Cool and quiet while ANSR holds the mechanism back —
    // the same stamp, no longer shouting.
    const labelY = gridTop + LABEL_TOP_ROW * STAMP_SCALE;
    const labelH = LABEL_ROWS * STAMP_SCALE;
    if (slowed) {
      pxRect(ctx, '#9FB6BE', cx - W / 2 + PX * 2, labelY, W - PX * 4, labelH, PX);
    }
    drawText(ctx, 'DENIED', cx, labelY + labelH / 2 - 7, {
      scale: 2,
      color: slowed ? '#2C4A55' : '#3A1414',
      align: 'center',
    });

    if (s.warn > 0) {
      const lit = `rgba(219, 240, 246, ${0.3 + 0.6 * s.warn})`;
      // The column it is about to print lights up from the floor: the impression's
      // print line flares and two marks close in on it from either side. One cell
      // thick, not two — at 8px of near-white across 88px it stopped reading as a
      // line and became a pale lump on the clay.
      pxRect(ctx, lit, cx - W / 2 + PX, GROUND_TOP, W - PX * 2, PX, PX);
      // Two closing marks per side, not four. Four converged into one pale blob on
      // the clay — a cloud rather than a countdown — and the tell is carried by the
      // print line and the stamp's own cock-back anyway.
      const half = Math.round((W / 2 + PX) * (0.95 - 0.4 * s.warn));
      for (let i = 0; i < 2; i += 1) {
        const inset = Math.round((half * i) / 3);
        pxRect(ctx, lit, cx - half + inset, GROUND_TOP - PX * (i + 1), PX * 2, PX, PX);
        pxRect(ctx, lit, cx + half - inset - PX * 2, GROUND_TOP - PX * (i + 1), PX * 2, PX, PX);
      }
      // A lit edge along the die, so the cock-back reads as loading rather than as
      // the stamp drifting upwards.
      pxRect(ctx, lit, cx - W / 2 + PX * 2, bottom - PX, W - PX * 4, PX, PX);
    }

    // Backing off a player it cannot press. The refusal is drawn on the die's own
    // face in the value orange — the field pushed it back, so the cue belongs to
    // ANSR — with two sparks flicking up off the corners it was stopped at.
    if (s.retracting) {
      pxRect(ctx, 'rgba(255, 84, 0, 0.8)', cx - W / 2 + PX, bottom - PX, W - PX * 2, PX, PX);
      pxRect(ctx, 'rgba(255, 184, 122, 0.85)', cx - W / 2 + PX, bottom - PX * 3, PX, PX * 2, PX);
      pxRect(ctx, 'rgba(255, 184, 122, 0.85)', cx + W / 2 - PX * 2, bottom - PX * 3, PX, PX * 2, PX);
    }
  }
}
