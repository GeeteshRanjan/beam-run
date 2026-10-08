/**
 * actPrompt.ts — the in-world "this key does this" prompt: an 8-bit key cap and a verb
 * plaque beside it, drawn on the canvas.
 *
 * Two users. The Tech Park's secret hatch (`render/brickBreaker.ts`, "↓ DROP IN") and
 * the two tools a powerup puts in the player's hands (owner call: "when we get the gun,
 * show in the game itself that you press F"): the Workplace cutter and the hiring
 * dragon's water cannon, prompted over the hero's head the moment they are armed.
 *
 * On touch the host passes `cap: null` and only the verb is drawn — there is no key to
 * name, and the act pad appearing beside the jump button is the other half of the
 * prompt there. A key cap on a phone is a guide to a keyboard nobody is holding.
 *
 * Pure: the host owns the clock, the fade and the reduced-motion decision.
 */
import { pxRect } from './PixelArt';
import { drawText, drawLabelPlaque, measureText, TEXT_LINE_H } from './PixelText';

/** Cap height, which is exactly the scale-2 plaque's own height. */
export const CAP_H = 26;
/** Cap width for a one-glyph key. */
export const KEY_CAP_W = 26;

/**
 * One 8-bit key cap, in the same treatment as the briefing cards' control legend and the
 * overlay buttons: solid fill, a light bevel on two sides, a dark rail on the other two,
 * no radius. `(x, y)` is the top-left corner.
 */
export function drawKeyCap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  w: number = KEY_CAP_W,
): void {
  const h = CAP_H;
  pxRect(ctx, 'rgba(4,20,26,0.9)', x - 2, y - 2, w + 4, h + 4, 1);
  pxRect(ctx, '#12414F', x, y, w, h, 1);
  pxRect(ctx, '#8FE0EE', x, y, w, 3, 1);
  pxRect(ctx, '#8FE0EE', x, y, 3, h, 1);
  pxRect(ctx, '#062A34', x, y + h - 3, w, 3, 1);
  pxRect(ctx, '#062A34', x + w - 3, y, 3, h, 1);
  drawText(ctx, label, x + w / 2, y + 6, { scale: 2, color: '#DCE8FF', align: 'center' });
}

export interface ActPromptView {
  /** Horizontal centre of the whole prompt (cap + plaque). */
  cx: number;
  /** Top edge of the cap and the plaque. */
  y: number;
  /** The key's glyph, or null on touch (verb only). */
  cap: string | null;
  /** The verb, in the pixel font's alphabet (A-Z 0-9 and a little punctuation). */
  label: string;
  /** 0..1 fade. */
  alpha?: number;
  /**
   * A word printed before the cap — "PRESS" on the tool prompt (owner call: "while in
   * game we show F we need to write Press F"). Ignored when there is no cap (touch).
   * With a lead the prompt becomes **one strip** rather than a cap beside a plaque:
   * three separate boxes in a row read as three buttons.
   */
  lead?: string;
}

/** Plaque fill and frame, shared by both layouts so they are the same object. */
const PLAQUE_BG = 'rgba(4,20,26,0.82)';
const PLAQUE_FRAME = 'rgba(127,216,232,0.65)';
const VERB_INK = '#DCE8FF';
/** The lead word is one step quieter than the verb: the verb is the news. */
const LEAD_INK = '#9FC8D2';
/** Padding inside the strip, and the gap between its three parts. */
const STRIP_PAD = 8;
/** The cap is inset by this much top and bottom, so its rail sits inside the strip. */
const STRIP_INSET = 4;
/** Height of the lead strip: the cap plus its inset on both sides. */
export const LEAD_STRIP_H = CAP_H + STRIP_INSET * 2;

/** Inner width of the lead strip (frame excluded). An empty label drops the verb segment. */
function leadStripW(lead: string, label: string): number {
  const leadW = measureText(lead.toUpperCase(), 2, 1);
  const verb = label ? STRIP_PAD + measureText(label.toUpperCase(), 2, 1) : 0;
  return STRIP_PAD + leadW + STRIP_PAD + KEY_CAP_W + verb + STRIP_PAD;
}

/**
 * PRESS [F] (and, if a label is given, a verb after the cap) as one framed strip,
 * centred on `cx`. The words sit on the strip's vertical centre line, the cap is inset
 * by the same amount above and below, and the padding at each end equals the gap
 * between the parts — so the strip is symmetric about both axes of its contents.
 *
 * The in-game tool prompt passes **no label** (owner call: "just keep Press [F]"), and
 * PRESS then takes the bright ink: with no verb after it, it is the whole sentence.
 */
function drawLeadStrip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  lead: string,
  cap: string,
  label: string,
): void {
  const leadW = measureText(lead.toUpperCase(), 2, 1);
  const w = leadStripW(lead, label);
  const x = Math.round(cx - w / 2);
  const top = Math.round(y);
  ctx.fillStyle = PLAQUE_FRAME;
  ctx.fillRect(x - 2, top - 2, w + 4, LEAD_STRIP_H + 4);
  ctx.fillStyle = PLAQUE_BG;
  ctx.fillRect(x, top, w, LEAD_STRIP_H);
  const textY = top + (LEAD_STRIP_H - TEXT_LINE_H * 2) / 2;
  drawText(ctx, lead, x + STRIP_PAD, textY, { scale: 2, color: label ? LEAD_INK : VERB_INK });
  const capX = x + STRIP_PAD + leadW + STRIP_PAD;
  drawKeyCap(ctx, capX, top + STRIP_INSET, cap);
  if (label) {
    drawText(ctx, label, capX + KEY_CAP_W + STRIP_PAD, textY, { scale: 2, color: VERB_INK });
  }
}

/** Full drawn width of a prompt, frame included — for keeping it inside the play frame. */
export function actPromptWidth(v: Pick<ActPromptView, 'cap' | 'label' | 'lead'>): number {
  const verbW = measureText(v.label.toUpperCase(), 2, 1);
  if (v.cap && v.lead) return leadStripW(v.lead, v.label) + 4;
  const plaqueW = verbW + 16 + 4;
  return v.cap ? KEY_CAP_W + 4 + 8 + plaqueW : plaqueW;
}

/** Cap + verb plaque, centred as one unit on `cx`. */
export function drawActPrompt(ctx: CanvasRenderingContext2D, v: ActPromptView): void {
  const alpha = v.alpha ?? 1;
  if (alpha <= 0) return;
  if (v.cap && v.lead) {
    ctx.save();
    ctx.globalAlpha *= alpha * 0.96;
    drawLeadStrip(ctx, v.cx, v.y, v.lead, v.cap, v.label);
    ctx.restore();
    return;
  }
  const capW = v.cap ? KEY_CAP_W : 0;
  const plaqueW = measureText(v.label, 2, 1) + 16;
  const shift = v.cap ? (capW + 8) / 2 : 0;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (v.cap) drawKeyCap(ctx, v.cx - shift - plaqueW / 2, v.y, v.cap, capW);
  drawLabelPlaque(ctx, v.label, v.cx + shift, v.y, {
    scale: 2,
    fg: VERB_INK,
    bg: PLAQUE_BG,
    frame: PLAQUE_FRAME,
    padX: 8,
    padY: 6,
    alpha: 0.96,
  });
  ctx.restore();
}
