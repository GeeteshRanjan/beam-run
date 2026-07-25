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

const SVG_NS = 'http://www.w3.org/2000/svg';

export { LOGO_ORANGE };

export interface LockupOptions {
  /** Sub-line after the rule (the edition). Omitted → mark + wordmark only. */
  title?: string;
  /** Wordmark next to the sunburst. Defaults to the game name (`ANSRcade`). */
  wordmark?: string;
  /** Smaller lockup, for screens where the copy is the hero. */
  compact?: boolean;
}

/** The ANSR sunburst as an inline SVG (decorative — the lockup carries the name). */
function createSunburst(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', ANSR_MARK_VIEWBOX);
  svg.setAttribute('class', 'beam-run__brand-mark');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ANSR_MARK_PATH);
  path.setAttribute('fill', LOGO_ORANGE);
  svg.appendChild(path);
  return svg;
}

/**
 * Create the lockup: sunburst + ANSR wordmark, optionally followed by a hairline
 * rule and the game title.
 */
export function createBrandLockup(doc: Document, opts: LockupOptions = {}): HTMLDivElement {
  const wordmark = opts.wordmark ?? COPY.meta.name;
  const el = doc.createElement('div');
  el.className = 'beam-run__brand' + (opts.compact ? ' beam-run__brand--compact' : '');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', opts.title ? `${wordmark} \u2014 ${opts.title}` : wordmark);

  el.appendChild(createSunburst(doc));

  // The wordmark and the edition share a row of their own so they can sit on a
  // common BASELINE. Centring them against each other (which is what a single
  // flex row does) left the smaller edition text visibly low against the much
  // larger wordmark.
  const text = doc.createElement('span');
  text.className = 'beam-run__brand-text';

  const word = doc.createElement('span');
  word.className = 'beam-run__brand-word';
  word.textContent = wordmark;
  text.appendChild(word);

  if (opts.title) {
    const rule = doc.createElement('span');
    rule.className = 'beam-run__brand-rule';
    rule.setAttribute('aria-hidden', 'true');
    const title = doc.createElement('span');
    title.className = 'beam-run__brand-title';
    title.textContent = opts.title;
    text.append(rule, title);
  }
  el.appendChild(text);
  return el;
}
