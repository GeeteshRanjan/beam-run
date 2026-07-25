/**
 * PixelType — the game's 5×7 bitmap font, rendered into the DOM as inline SVG.
 *
 * The overlays used to set their headlines in Moderat/system-sans, which is why
 * the start and end screens read like a web page laid over a pixel game rather
 * than part of it. There is no pixel web font to ship (and no budget for one),
 * so headings are drawn from the *same* glyph data the canvas uses: one rect per
 * lit pixel, `shape-rendering: crispEdges`, scaling with the frame and staying
 * sharp at any size.
 *
 * Accessibility: the SVG is always decorative (`aria-hidden`) and the real
 * sentence ships alongside it in a visually-hidden span, so screen readers get
 * clean prose (with punctuation and casing the bitmap font doesn't carry) and
 * `textContent` still reads as the plain string.
 */
import { FONT, GLYPH_W, GLYPH_H } from '../render/PixelText';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Cells between glyphs (matches the canvas renderer's default letter spacing). */
const LETTER = 1;

/**
 * Characters the 5×7 font has no glyph for, mapped to the nearest one it does.
 * Without this an em dash or an arrow silently renders as a hole in the word.
 */
const SUBSTITUTES: Record<string, string> = {
  '\u2014': '-', // em dash
  '\u2013': '-', // en dash
  '\u2192': '>', // right arrow
  '\u00b7': '.', // middle dot
  '\u2019': '', // curly apostrophe (dropped: no glyph, reads fine without)
  "'": '',
  '\u201c': '',
  '\u201d': '',
  '"': '',
};

/** Uppercase and fold every character down to something the font can draw. */
export function normalizeForPixels(text: string): string {
  let out = '';
  for (const raw of text.toUpperCase()) {
    const ch = SUBSTITUTES[raw] ?? raw;
    if (ch === '') continue;
    out += FONT[ch] ? ch : ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}

export interface PixelTextOptions {
  /** Size of one authored pixel, in CSS px, at the element's intrinsic size. */
  scale?: number;
  /**
   * Size of one authored pixel as a percentage of the *play frame* width. Set
   * this and the headline scales with the game (like the canvas art) instead of
   * with the browser window, and stays the same glyph size whether the string is
   * one word or three lines. `0` keeps the intrinsic px size.
   */
  unit?: number;
  /**
   * Floor and ceiling for one authored pixel, in CSS px. The floor matters: a
   * 390px-wide portrait frame would otherwise render a headline at ~1.6px per
   * pixel, i.e. 11px glyphs — technically proportional, practically unreadable.
   */
  minPx?: number;
  maxPx?: number;
  /** Glyph colour. */
  color?: string;
  /** Hard 8-bit drop shadow, offset by one authored pixel. */
  shadow?: string;
  /** Extra class on the <svg>. */
  className?: string;
  /**
   * Hard ceiling on the rendered width as a % of the *play frame*, replacing the
   * default `min(96%, …)` cap.
   *
   * The percentage cap is right inside a fixed-width column (the overlay stack),
   * but wrong inside a box that shrink-wraps its contents — a HUD plaque or a
   * button — because there the panel width comes from the glyph width, so a
   * percentage is circular. Frame units (`--beam-run-u`, a container query unit
   * on the stage) have no such dependency, and they also let the glyphs shrink
   * gracefully on very narrow frames instead of overflowing.
   */
  maxShare?: number;
}

/** Width of a rendered line in authored cells (glyphs + inter-glyph spacing). */
function lineCells(text: string): number {
  return text.length === 0 ? 0 : text.length * GLYPH_W + (text.length - 1) * LETTER;
}

/**
 * Build a decorative SVG of `lines` in the bitmap font. Intrinsic width/height
 * come from the glyph grid, so CSS `max-width: 100%; height: auto` keeps it from
 * ever overflowing a narrow frame.
 */
export function createPixelSvg(
  doc: Document,
  lines: readonly string[],
  opts: PixelTextOptions = {},
): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'beam-run__pixels' + (opts.className ? ` ${opts.className}` : ''));
  paintPixelSvg(svg, lines, opts);
  return svg;
}

/** (Re)paint an existing pixel SVG — used by the closing months count-up. */
export function paintPixelSvg(
  svg: SVGSVGElement,
  lines: readonly string[],
  opts: PixelTextOptions = {},
): void {
  const doc = svg.ownerDocument;
  const scale = opts.scale ?? 4;
  const color = opts.color ?? '#FFFFFF';
  const rows = lines.map((l) => normalizeForPixels(l)).filter((l) => l.length > 0);
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const lineGap = 3; // cells between baselines
  const cols = Math.max(1, ...rows.map(lineCells));
  const cells = rows.length * GLYPH_H + Math.max(0, rows.length - 1) * lineGap;
  const w = cols + (opts.shadow ? 1 : 0);
  const h = Math.max(1, cells) + (opts.shadow ? 1 : 0);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', `${w * scale}`);
  svg.setAttribute('height', `${h * scale}`);
  // Frame-relative sizing: one authored pixel = `unit`% of the frame width, so
  // the glyphs are the same size on every headline, clamped to a readable range
  // and capped at 96% of the container (with `height: auto`) so nothing ever
  // overflows a narrow frame.
  if (opts.unit) {
    const ideal = `calc(var(--beam-run-u) * ${(w * opts.unit).toFixed(2)})`;
    const floor = `${(w * (opts.minPx ?? 2)).toFixed(0)}px`;
    const ceil = `${(w * (opts.maxPx ?? 12)).toFixed(0)}px`;
    const cap = opts.maxShare ? `calc(var(--beam-run-u) * ${opts.maxShare})` : '96%';
    svg.style.width = `min(${cap}, clamp(${floor}, ${ideal}, ${ceil}))`;
  }

  const paint = (dx: number, dy: number, fill: string): void => {
    const path: string[] = [];
    for (let r = 0; r < rows.length; r += 1) {
      const text = rows[r]!;
      // Centre each line on the widest one (classic arcade centred headline).
      const offset = Math.round((cols - lineCells(text)) / 2);
      const top = r * (GLYPH_H + lineGap);
      for (let i = 0; i < text.length; i += 1) {
        const glyph = FONT[text[i]!];
        if (!glyph) continue;
        const gx = offset + i * (GLYPH_W + LETTER);
        for (let gy = 0; gy < GLYPH_H; gy += 1) {
          const line = glyph[gy]!;
          for (let c = 0; c < GLYPH_W; c += 1) {
            if (line[c] !== '#') continue;
            path.push(`M${gx + c + dx} ${top + gy + dy}h1v1h-1z`);
          }
        }
      }
    }
    if (path.length === 0) return;
    const el = doc.createElementNS(SVG_NS, 'path');
    el.setAttribute('d', path.join(''));
    el.setAttribute('fill', fill);
    el.setAttribute('shape-rendering', 'crispEdges');
    svg.appendChild(el);
  };

  if (opts.shadow) paint(1, 1, opts.shadow);
  paint(0, 0, color);
}

/**
 * Greedy word wrap for a bitmap label, in authored characters.
 *
 * Button copy runs long ("Plan your real journey → GCC Opportunity Navigator"),
 * and bitmap glyphs cannot reflow the way web type does — one line would either
 * overflow the frame or shrink to nothing. Wrapping is done here rather than
 * hand-authored per button so a copy change can't quietly break a screen.
 */
export function wrapPixelLabel(text: string, maxChars = 26): string[] {
  const words = normalizeForPixels(text).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars || line === '') line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

/**
 * The headline scale, shared by every screen that sets a title: ~38px glyphs at
 * native frame width, never under 21px. Exported so the assist dialog's heading
 * matches the overlays instead of falling back to web type.
 */
export const PIXEL_TITLE = {
  unit: 0.42,
  minPx: 3,
  maxPx: 7,
  // Headings are flex items in a centred column, i.e. shrink-wrapped, so they
  // need the frame-unit cap too — with the percentage one they came out ~10%
  // under size (the fallback is the SVG's own intrinsic width).
  maxShare: 72,
  color: '#FFFFFF',
  shadow: 'rgba(0,16,22,0.85)',
} as const;

export interface PixelLineOptions extends PixelTextOptions {
  /** Wrap width in authored characters (see `wrapPixelLabel`). */
  maxChars?: number;
}

/**
 * Set an element's text as bitmap artwork plus a visually-hidden copy of the
 * real string, so `textContent`, `aria-label` and assistive tech are unchanged.
 * Empty text clears the element (used by the win screen's conditional line).
 */
export function setPixelText(el: Element, text: string, opts: PixelLineOptions): void {
  const doc = el.ownerDocument;
  while (el.firstChild) el.removeChild(el.firstChild);
  if (text === '') return;
  const sr = doc.createElement('span');
  sr.className = 'beam-run__sr';
  sr.textContent = text;
  el.append(sr, createPixelSvg(doc, wrapPixelLabel(text, opts.maxChars ?? 26), opts));
}

export type PixelButtonVariant = 'primary' | 'ghost' | 'default';

/**
 * Type scale and ink per button variant.
 *
 * The primary cap is set one step larger, which is how it keeps the emphasis it
 * used to get from `font-size: 1.12em` on the title screen. Its fill is orange,
 * so its dark glyphs need no drop shadow — a light halo under dark type only
 * muddies edges whose whole point is that they are hard.
 *
 * `maxShare` matters here: "Plan your real journey → GCC Opportunity Navigator"
 * wraps to 25 characters, whose floor width alone would overflow a phone frame.
 */
const BUTTON_TYPE: Record<PixelButtonVariant, PixelTextOptions> = {
  primary: { unit: 0.19, minPx: 2.1, maxPx: 3, maxShare: 70, color: '#00242E' },
  ghost: {
    unit: 0.16,
    minPx: 1.8,
    maxPx: 2.6,
    maxShare: 70,
    color: '#E6E6E6',
    shadow: 'rgba(0, 16, 22, 0.85)',
  },
  default: {
    unit: 0.16,
    minPx: 1.8,
    maxPx: 2.6,
    maxShare: 70,
    color: '#FFFFFF',
    shadow: 'rgba(0, 16, 22, 0.85)',
  },
};

/**
 * Set a button's label in the bitmap font: the real string stays in a hidden
 * span (so `textContent`, `aria` and tests are unchanged) and the visible label
 * is pixel artwork, wrapped to fit. Used by every `.beam-run__btn` — the
 * overlays, the assist dialog and the 404 page — so they can't drift apart.
 */
export function setPixelButtonLabel(
  el: Element,
  text: string,
  variant: PixelButtonVariant = 'default',
): void {
  const doc = el.ownerDocument;
  while (el.firstChild) el.removeChild(el.firstChild);
  const sr = doc.createElement('span');
  sr.className = 'beam-run__sr';
  sr.textContent = text;
  el.append(sr, createPixelSvg(doc, wrapPixelLabel(text), BUTTON_TYPE[variant]));
}

/**
 * A heading in the bitmap font: the accessible sentence (hidden) plus the pixel
 * artwork. `visual` lets a long sentence be broken into arcade-style lines
 * without touching the text an assistive tech reads.
 */
export function createPixelHeading(
  doc: Document,
  tag: string,
  className: string,
  text: string,
  visual: readonly string[],
  opts: PixelTextOptions = {},
): HTMLElement {
  const el = doc.createElement(tag);
  el.className = className;
  const sr = doc.createElement('span');
  sr.className = 'beam-run__sr';
  sr.textContent = text;
  el.append(sr, createPixelSvg(doc, visual, opts));
  return el;
}
