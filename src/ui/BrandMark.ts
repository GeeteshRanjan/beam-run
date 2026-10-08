/**
 * BrandMark — the ANSRcade lockup for the DOM overlays.
 *
 * The mark is the **real ANSR sunburst**, taken from the brand SVG (see
 * `ansrMark.ts`) — the circle only, not the "ANSR" wordmark, which the lockup
 * sets in type instead. It replaces a procedural 24-ray approximation: the real
 * rays vary in length and angle, and no generated ring reproduces that.
 *
 * The whole lockup is one `role="img"` with a text alternative, so assistive
 * tech reads the name once instead of walking a decorative path.
 */

import { COPY } from '../data/copy';
import { ANSR_MARK_PATH, ANSR_MARK_VIEWBOX, LOGO_ORANGE } from './ansrMark';
import { setPixelText } from './PixelType';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Authored-pixel size of the lockup's two lines, as a % of the frame width (see
 * `PixelTextOptions.unit`). The wordmark matches the cap height the web type had
 * (~27px on a 1280 frame); the edition sits a step under it, at the body size the
 * rest of the overlays use. Both carry `maxShare` because the lockup row shrink-wraps
 * its contents, where the default percentage cap is circular.
 */
export const LOCKUP_PX = {
  full: {
    word: { unit: 0.3, minPx: 2.4, maxPx: 4.2, maxShare: 40 },
    title: { unit: 0.17, minPx: 1.6, maxPx: 2.6, maxShare: 40 },
  },
  compact: {
    word: { unit: 0.18, minPx: 1.8, maxPx: 2.6, maxShare: 30 },
    title: { unit: 0.13, minPx: 1.5, maxPx: 1.9, maxShare: 30 },
  },
} as const;

const WORD_INK = { color: '#FFFFFF', shadow: 'rgba(0,16,22,0.85)' } as const;
const EDITION_INK = { color: '#CFE6EC', shadow: 'rgba(0,16,22,0.85)' } as const;

export { LOGO_ORANGE };

export interface LockupOptions {
  /** Sub-line after the wordmark (the edition). Omitted → mark + wordmark only. */
  title?: string;
  /** Wordmark next to the sunburst. Defaults to the game name (`ANSRcade`). */
  wordmark?: string;
  /** Smaller lockup, for screens where the copy is the hero. */
  compact?: boolean;
}

/**
 * The ANSR sunburst as an inline SVG (decorative — the lockup carries the name). Also
 * the powerup on its own, no tag, on the death card that tells the player to take it.
 */
export function createSunburst(
  doc: Document,
  className = 'beam-run__brand-mark',
): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', ANSR_MARK_VIEWBOX);
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ANSR_MARK_PATH);
  path.setAttribute('fill', LOGO_ORANGE);
  svg.appendChild(path);
  return svg;
}

/**
 * Create the lockup: sunburst + ANSR wordmark, optionally followed by the edition.
 */
export function createBrandLockup(doc: Document, opts: LockupOptions = {}): HTMLDivElement {
  const wordmark = opts.wordmark ?? COPY.meta.name;
  const el = doc.createElement('div');
  el.className = 'beam-run__brand' + (opts.compact ? ' beam-run__brand--compact' : '');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', opts.title ? `${wordmark} \u2014 ${opts.title}` : wordmark);

  el.appendChild(createSunburst(doc));

  // The wordmark and the edition share a row of their own, centred on one line.
  // Both are set in the game's 5×7 bitmap font (owner call), like every other line
  // on the overlays: in web type the lockup was the one piece of Moderat left on
  // screens that are otherwise all pixel art. `setPixelText` keeps the real string
  // in a hidden span, so `textContent` still reads "ANSRcade" with its casing.
  const text = doc.createElement('span');
  text.className = 'beam-run__brand-text';
  const spec = opts.compact ? LOCKUP_PX.compact : LOCKUP_PX.full;

  const word = doc.createElement('span');
  word.className = 'beam-run__brand-word';
  setPixelText(word, wordmark, { ...spec.word, ...WORD_INK, maxChars: 40 });
  text.appendChild(word);

  // No divider between the wordmark and the edition (owner call): the row gap
  // and the step down in size separate them on their own.
  if (opts.title) {
    const title = doc.createElement('span');
    title.className = 'beam-run__brand-title';
    setPixelText(title, opts.title, { ...spec.title, ...EDITION_INK, maxChars: 40 });
    text.appendChild(title);
  }
  el.appendChild(text);
  return el;
}
