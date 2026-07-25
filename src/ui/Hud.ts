/**
 * Hud — the in-play heads-up display, built from real DOM (not canvas) so it is
 * screen-reader accessible.
 *
 * Four readouts, each on its own 8-bit plaque:
 *
 *   top-left      current stage
 *   top-right     TIME TO MARKET — the one number that matters, dominant
 *   bottom-left   quick wins found (a count, never a score)
 *   bottom-right  the ANSR capability engaged on this screen (persistent chip)
 *
 * Every label and number is set in the *same* 5×7 bitmap font the canvas draws
 * with (via `PixelType`), not in Moderat/system-sans: a proportional web font on
 * a hairline-bordered card read as a web widget pasted over a pixel game, which
 * is exactly how the two top cards looked. The plaques themselves carry the NES
 * treatment used by the buttons — solid fill, 3px light/dark inner bevel, hard
 * dark outer rail, no radius, no blur.
 *
 * Accessibility is unchanged: each pixel string ships with a visually-hidden
 * span carrying the real prose, so `textContent` and assistive tech still read
 * ordinary sentences (with the casing and punctuation the bitmap font lacks).
 *
 * There is no lives counter: setbacks cost months, not lives.
 */
import { COPY } from '../data/copy';
import {
  createPixelSvg,
  normalizeForPixels,
  paintPixelSvg,
  type PixelTextOptions,
} from './PixelType';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Authored-pixel size per HUD role: `unit` is the size of one authored pixel as
 * a % of the play-frame width, clamped between `minPx` and `maxPx`. Because the
 * ideal width is `cols * unit`, one spec gives the same glyph size whatever the
 * string length — so captions of different widths still match each other.
 */
interface PixelSpec {
  unit: number;
  minPx: number;
  maxPx: number;
  /**
   * Hard ceiling on the whole string's width, as a % of the frame. The floors
   * above protect legibility on a phone, but two plaques anchored to opposite
   * top corners must still fit side by side: below ~380px the floors alone would
   * make them collide (the old web-type HUD collided too, from ~348px). This cap
   * is frame-relative, so instead of a cliff the glyphs shrink gracefully on
   * frames narrower than that — and it never binds at 390px or above.
   */
  maxShare: number;
}

export const HUD_PX: Record<
  'caption' | 'stage' | 'months' | 'unit' | 'chip' | 'chipSub',
  PixelSpec
> = {
  /**
   * Small caps captions (STAGE, TIME TO MARKET) — ~14px glyphs at 1280.
   *
   * The floors here are what keeps the two top plaques apart: on a 390px
   * portrait frame the ideal size is far below the floor, so the floor decides
   * the width, and the stage plaque plus the clock plaque have to fit side by
   * side inside the frame (guarded by a test).
   */
  caption: { unit: 0.16, minPx: 1.6, maxPx: 2.6, maxShare: 33 },
  /** The stage name. */
  stage: { unit: 0.2, minPx: 1.8, maxPx: 3.4, maxShare: 40 },
  /** The months figure: the loudest thing on the HUD (~34px glyphs at 1280). */
  months: { unit: 0.38, minPx: 3.2, maxPx: 6, maxShare: 16 },
  /** "MONTHS" after the figure. */
  unit: { unit: 0.15, minPx: 1.7, maxPx: 2.4, maxShare: 16 },
  /** Quick-win count and the engaged product name. */
  chip: { unit: 0.19, minPx: 2, maxPx: 3, maxShare: 30 },
  /** The capability's outcome line under the product ("Filings cleared"). */
  chipSub: { unit: 0.15, minPx: 1.7, maxPx: 2.4, maxShare: 45 },
};

const PX = HUD_PX;

/** Horizontal padding + rail on a plaque, in CSS px (see `PANEL` in styles). */
export const HUD_PLAQUE_CHROME = 11 * 2 + 3 * 2;

/** Width in authored cells of a string in the 5×7 font, incl. the 1px shadow. */
export function pixelCols(text: string): number {
  const n = normalizeForPixels(text).length;
  return (n === 0 ? 1 : n * 6 - 1) + 1;
}

const SHADOW = 'rgba(0, 10, 14, 0.9)';
const INK: PixelTextOptions = { color: '#FFFFFF', shadow: SHADOW };
const CAPTION_INK: PixelTextOptions = { color: '#9FC8D2', shadow: SHADOW };
const MUTED_INK: PixelTextOptions = { color: '#CFE0E4', shadow: SHADOW };
/** Orange is the value accent — used for the engaged ANSR product only. */
const VALUE_INK: PixelTextOptions = { color: '#FF5400', shadow: SHADOW };

export interface PowerHud {
  /** Short outcome label, e.g. "Roles filled". */
  name: string;
  /** ANSR product name, e.g. "Talent500". */
  product: string;
}

export interface HudModel {
  levelLabel: string;
  months: number;
  quickWins: number;
  totalQuickWins: number;
  power: PowerHud | null;
}

/**
 * Size the pixel chart icon, which is hand-built rather than painted from glyph
 * data, with the same formula `PixelType` applies to text: frame units, never a
 * percentage of the shrink-wrapping plaque (that would be circular — the panel
 * width comes from the art width).
 */
function sizePixels(svg: SVGSVGElement, spec: PixelSpec): void {
  const cols = Number(svg.getAttribute('viewBox')?.split(' ')[2] ?? 1) || 1;
  const ideal = `calc(var(--beam-run-u) * ${(cols * spec.unit).toFixed(2)})`;
  const clamped =
    `clamp(${(cols * spec.minPx).toFixed(1)}px, ${ideal}, ${(cols * spec.maxPx).toFixed(1)}px)`;
  svg.style.width = `min(${clamped}, calc(var(--beam-run-u) * ${spec.maxShare}))`;
}

/**
 * The numeric twin of `sizePixels` — same formula, used to prove at test time
 * that the top-left and top-right plaques cannot overlap at any frame width.
 */
export function pixelWidthPx(text: string, spec: PixelSpec, frameWidth: number): number {
  const cols = pixelCols(text);
  const u = frameWidth / 100;
  const clamped = Math.min(Math.max(cols * spec.minPx, cols * spec.unit * u), cols * spec.maxPx);
  return Math.min(clamped, spec.maxShare * u);
}

function paint(svg: SVGSVGElement, text: string, spec: PixelSpec, ink: PixelTextOptions): void {
  // `maxShare` in the spec makes PixelType size this in frame units, not as a
  // percentage of the shrink-wrapping plaque (see sizePixels for why).
  paintPixelSvg(svg, [text], { ...ink, ...spec });
}

/** A rising bar chart in pixels — same motif as the Growth Point sprite. */
function createChartIcon(doc: Document, spec: PixelSpec): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 8 7');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'beam-run__pixels beam-run__hud-wins-icon');
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute(
    'd',
    // baseline, then three bars stepping up
    'M0 6h8v1H0z' + 'M0 4h2v2H0z' + 'M3 2h2v4H3z' + 'M6 0h2v6H6z',
  );
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('shape-rendering', 'crispEdges');
  svg.appendChild(path);
  sizePixels(svg, spec);
  return svg;
}

export class Hud {
  readonly root: HTMLDivElement;
  private readonly doc: Document;
  private readonly level: HTMLDivElement;
  private readonly levelSr: HTMLSpanElement;
  private readonly levelArt: SVGSVGElement;
  private readonly clock: HTMLDivElement;
  private readonly clockValue: HTMLSpanElement;
  private readonly clockValueSr: HTMLSpanElement;
  private readonly clockValueArt: SVGSVGElement;
  private readonly quickWins: HTMLDivElement;
  private readonly quickWinsSr: HTMLSpanElement;
  private readonly quickWinsArt: SVGSVGElement;
  private readonly power: HTMLDivElement;
  private readonly powerName: HTMLSpanElement;
  private readonly powerNameSr: HTMLSpanElement;
  private readonly powerNameArt: SVGSVGElement;
  private readonly powerProduct: HTMLSpanElement;
  private readonly powerProductSr: HTMLSpanElement;
  private readonly powerProductArt: SVGSVGElement;
  private readonly live: HTMLDivElement;
  private lastMonths = -1;
  /** Painted strings, so the bitmap art is only rebuilt when it changes. */
  private drawn = { level: '', months: '', wins: '', product: '', name: '' };

  constructor(parent: HTMLElement) {
    const doc = parent.ownerDocument;
    this.doc = doc;
    this.root = doc.createElement('div');
    this.root.className = 'beam-run__hud';

    // Stage: caption + name, stacked like an arcade level readout.
    this.level = doc.createElement('div');
    this.level.className = 'beam-run__hud-row beam-run__hud-level';
    this.level.append(
      this.caption(`${COPY.hud.stageLabel}: `, COPY.hud.stageLabel, 'beam-run__hud-caption'),
    );
    this.levelSr = this.srSpan('');
    this.levelArt = this.art('beam-run__hud-level-name');
    this.level.append(this.levelSr, this.levelArt);

    // The journey clock — deliberately the loudest thing on the HUD.
    this.clock = doc.createElement('div');
    this.clock.className = 'beam-run__hud-row beam-run__hud-clock';
    this.clock.append(
      this.caption(
        `${COPY.hud.monthsLabel}: `,
        COPY.hud.monthsLabel,
        'beam-run__hud-clock-label',
      ),
    );
    const figure = doc.createElement('div');
    figure.className = 'beam-run__hud-clock-figure';
    this.clockValue = doc.createElement('span');
    this.clockValue.className = 'beam-run__hud-clock-value';
    this.clockValueSr = this.srSpan('');
    this.clockValueArt = this.art();
    this.clockValue.append(this.clockValueSr, this.clockValueArt);
    const clockUnit = doc.createElement('span');
    clockUnit.className = 'beam-run__hud-clock-unit';
    clockUnit.append(this.srSpan(` ${COPY.hud.monthsUnit}`), this.staticArt(COPY.hud.monthsUnit, PX.unit, MUTED_INK));
    figure.append(this.clockValue, clockUnit);
    this.clock.append(figure);

    this.quickWins = doc.createElement('div');
    this.quickWins.className = 'beam-run__hud-row beam-run__hud-wins';
    this.quickWinsSr = this.srSpan(`${COPY.hud.quickWinsLabel}: `);
    this.quickWinsArt = this.art();
    this.quickWins.append(this.quickWinsSr, createChartIcon(doc, PX.chip), this.quickWinsArt);

    this.power = doc.createElement('div');
    this.power.className = 'beam-run__hud-row beam-run__hud-power';
    this.power.append(this.srSpan(`${COPY.hud.powerLabel}: `));
    this.powerProduct = doc.createElement('span');
    this.powerProduct.className = 'beam-run__hud-power-product';
    this.powerProductSr = this.srSpan('');
    this.powerProductArt = this.art();
    this.powerProduct.append(this.powerProductSr, this.powerProductArt);
    this.powerName = doc.createElement('span');
    this.powerName.className = 'beam-run__hud-power-name';
    this.powerNameSr = this.srSpan('');
    this.powerNameArt = this.art();
    this.powerName.append(this.powerNameSr, this.powerNameArt);
    this.power.append(this.powerProduct, this.powerName);

    this.live = doc.createElement('div');
    this.live.className = 'beam-run__sr';
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');

    this.root.append(this.level, this.clock, this.quickWins, this.power, this.live);
    parent.appendChild(this.root);
  }

  private srSpan(text: string): HTMLSpanElement {
    const span = this.doc.createElement('span');
    span.className = 'beam-run__sr';
    span.textContent = text;
    return span;
  }

  private art(className?: string): SVGSVGElement {
    const svg = createPixelSvg(this.doc, [], {});
    if (className) svg.setAttribute('class', `beam-run__pixels ${className}`);
    return svg;
  }

  /** A string that never changes: painted once at construction. */
  private staticArt(text: string, spec: PixelSpec, ink: PixelTextOptions): SVGSVGElement {
    const svg = this.art();
    paint(svg, text, spec, ink);
    return svg;
  }

  /** Small caps caption plus its accessible prose. */
  private caption(srText: string, text: string, className: string): HTMLSpanElement {
    const span = this.doc.createElement('span');
    span.className = className;
    span.append(this.srSpan(srText), this.staticArt(text, PX.caption, CAPTION_INK));
    return span;
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('beam-run__hud--visible', visible);
  }

  update(model: HudModel): void {
    if (model.levelLabel !== this.drawn.level) {
      this.drawn.level = model.levelLabel;
      this.levelSr.textContent = model.levelLabel;
      paint(this.levelArt, model.levelLabel, PX.stage, INK);
    }

    // Zero-padded like an arcade counter, which also keeps the right-anchored
    // plaque from resizing when the count crosses ten.
    const monthsArt = `${model.months}`.padStart(2, '0');
    if (monthsArt !== this.drawn.months) {
      this.drawn.months = monthsArt;
      this.clockValueSr.textContent = `${model.months}`;
      paint(this.clockValueArt, monthsArt, PX.months, INK);
    }
    this.clock.setAttribute(
      'aria-label',
      `${COPY.hud.monthsLabel}: ${model.months} ${COPY.hud.monthsUnit}`,
    );
    // Nudge the clock when it moves so a booked delay is impossible to miss.
    if (this.lastMonths >= 0 && model.months !== this.lastMonths) {
      this.clock.classList.remove('beam-run__hud-clock--bump');
      void this.clock.offsetWidth; // force reflow so the animation can retrigger
      this.clock.classList.add('beam-run__hud-clock--bump');
    }
    this.lastMonths = model.months;

    const wins = `${model.quickWins}/${model.totalQuickWins}`;
    if (wins !== this.drawn.wins) {
      this.drawn.wins = wins;
      this.quickWinsSr.textContent = `${COPY.hud.quickWinsLabel}: ${wins}`;
      paint(this.quickWinsArt, wins, PX.chip, MUTED_INK);
    }
    this.quickWins.setAttribute(
      'aria-label',
      `${COPY.hud.quickWinsLabel}: ${model.quickWins} of ${model.totalQuickWins}`,
    );

    if (model.power) {
      this.power.classList.add('beam-run__hud-power--visible');
      if (model.power.product !== this.drawn.product) {
        this.drawn.product = model.power.product;
        this.powerProductSr.textContent = model.power.product;
        paint(this.powerProductArt, model.power.product, PX.chip, VALUE_INK);
      }
      if (model.power.name !== this.drawn.name) {
        this.drawn.name = model.power.name;
        this.powerNameSr.textContent = model.power.name;
        paint(this.powerNameArt, model.power.name, PX.chipSub, MUTED_INK);
      }
      this.power.setAttribute(
        'aria-label',
        `${COPY.hud.powerLabel}: ${model.power.product} — ${model.power.name}`,
      );
    } else {
      this.power.classList.remove('beam-run__hud-power--visible');
    }
  }

  /** Announce a message to assistive tech. Toggling text forces re-read. */
  announce(message: string): void {
    this.live.textContent = '';
    // Next tick so screen readers register the change.
    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16);
    schedule(() => {
      this.live.textContent = message;
    });
  }

  destroy(): void {
    this.root.remove();
  }
}
