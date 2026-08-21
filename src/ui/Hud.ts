/**
 * Hud — the in-play heads-up display, built from real DOM (not canvas) so it is
 * screen-reader accessible.
 *
 * Two stacks of 8-bit plaques, hanging from the top corners of the frame:
 *
 *   top-left    current stage · the ANSR capability engaged
 *   top-right   LIVES, as hearts · the DELAY LOG, which grows downwards as the
 *               run goes wrong
 *
 * **The TIME TO MARKET plaque is gone** (owner call) and lives moved into the slot
 * it held. The clock was the loudest thing on the frame and it was static for most
 * of a run: the only thing that moves it is a booked delay, which the log below it
 * already reports *with the reason attached*. Months are the argument the closing
 * receipt makes; on the HUD they were a number with nothing to do. Lives are the
 * opposite — they change, they are the stake of the next ten seconds, and they earn
 * the loud corner.
 *
 * Both stacks are ordinary flex columns inside one absolutely-positioned wrapper
 * per corner, rather than four independently anchored plaques. That is a
 * deliberate change: the log has no fixed height, so anything below it anchored
 * by a hand-tuned pixel offset would collide with it the moment a fourth delay
 * was logged. Stacking also means portrait needs no special-casing — everything
 * lives in the top band, and the bottom of the frame stays clear for thumbs.
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
 * The lives readout uses shape, not colour: a life still held is a solid heart,
 * a spent one the same heart hollowed out, so it reads without relying on colour.
 */
import { COPY } from '../data/copy';
import type { LogPanelView } from '../core/setbackLog';
import { paintLivesPips } from './LivesPips';
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
  'caption' | 'stage' | 'chip' | 'chipSub' | 'lives' | 'logRow' | 'logTotal',
  PixelSpec
> = {
  /**
   * Small caps captions (STAGE, LIVES) — ~14px glyphs at 1280.
   *
   * The floors here are what keeps the two top plaques apart: on a 390px
   * portrait frame the ideal size is far below the floor, so the floor decides
   * the width, and the stage plaque plus the lives plaque have to fit side by
   * side inside the frame (guarded by a test).
   */
  caption: { unit: 0.16, minPx: 1.6, maxPx: 2.6, maxShare: 33 },
  /** The stage name. */
  stage: { unit: 0.2, minPx: 1.8, maxPx: 3.4, maxShare: 40 },
  /** The engaged product name. */
  chip: { unit: 0.19, minPx: 2, maxPx: 3, maxShare: 30 },
  /** The capability's outcome line under the product ("Filings cleared"). */
  chipSub: { unit: 0.15, minPx: 1.7, maxPx: 2.4, maxShare: 45 },
  /**
   * The lives hearts (hand-built art, sized by the same formula as text).
   *
   * One step up from the old pips: this readout inherited the top-right plaque
   * from the clock, so it is now the loudest thing on the frame and is read from
   * across a room. Three hearts is 25 cells, so `maxShare` still caps it well
   * inside a quarter of the frame.
   */
  lives: { unit: 0.34, minPx: 2.6, maxPx: 5, maxShare: 26 },
  /**
   * One delay-log row ("OFFER DECLINED +2"). The longest tag in
   * `COPY.setback.tag` is 17 characters including the figure, so the cap is set
   * where that still clears a phone frame beside the stage plaque opposite.
   */
  logRow: { unit: 0.14, minPx: 1.5, maxPx: 2.2, maxShare: 30 },
  /** The log total, one step up so the running cost is the readable part. */
  logTotal: { unit: 0.17, minPx: 1.8, maxPx: 2.6, maxShare: 30 },
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
  /** Lives still held this attempt. */
  lives: number;
  livesTotal: number;
  /** The delay log panel view. Empty log → the panel stays hidden. */
  log: LogPanelView;
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
 *
 * Takes authored *cells* rather than a string, so it also answers for the hand-built
 * artwork (the lives hearts), which has a cell count but no text.
 */
export function pixelArtWidthPx(cols: number, spec: PixelSpec, frameWidth: number): number {
  const u = frameWidth / 100;
  const clamped = Math.min(Math.max(cols * spec.minPx, cols * spec.unit * u), cols * spec.maxPx);
  return Math.min(clamped, spec.maxShare * u);
}

/** `pixelArtWidthPx` for a string set in the 5×7 font. */
export function pixelWidthPx(text: string, spec: PixelSpec, frameWidth: number): number {
  return pixelArtWidthPx(pixelCols(text), spec, frameWidth);
}

function paint(svg: SVGSVGElement, text: string, spec: PixelSpec, ink: PixelTextOptions): void {
  // `maxShare` in the spec makes PixelType size this in frame units, not as a
  // percentage of the shrink-wrapping plaque (see sizePixels for why).
  paintPixelSvg(svg, [text], { ...ink, ...spec });
}

/** The pips, sized by the same frame-unit formula the bitmap type uses. */
function paintLives(svg: SVGSVGElement, left: number, total: number): void {
  paintLivesPips(svg, left, total);
  sizePixels(svg, PX.lives);
}

export class Hud {
  readonly root: HTMLDivElement;
  private readonly doc: Document;
  private readonly level: HTMLDivElement;
  private readonly levelSr: HTMLSpanElement;
  private readonly levelArt: SVGSVGElement;
  private readonly lives: HTMLDivElement;
  private readonly livesSr: HTMLSpanElement;
  private readonly livesArt: SVGSVGElement;
  private readonly log: HTMLDivElement;
  private readonly logSr: HTMLSpanElement;
  private readonly logRows: HTMLDivElement;
  private readonly logTotalArt: SVGSVGElement;
  private readonly power: HTMLDivElement;
  private readonly powerName: HTMLSpanElement;
  private readonly powerNameSr: HTMLSpanElement;
  private readonly powerNameArt: SVGSVGElement;
  private readonly powerProduct: HTMLSpanElement;
  private readonly powerProductSr: HTMLSpanElement;
  private readonly powerProductArt: SVGSVGElement;
  private readonly live: HTMLDivElement;
  /** Last painted life count, so a *spent* life can be told from a reset one. */
  private lastLives = -1;
  /** Painted strings, so the bitmap art is only rebuilt when it changes. */
  private drawn = { level: '', lives: '', log: '', product: '', name: '' };

  constructor(parent: HTMLElement) {
    const doc = parent.ownerDocument;
    this.doc = doc;
    this.root = doc.createElement('div');
    this.root.className = 'beam-run__hud';

    // Two corner stacks. Plaques are ordinary flow children inside them, so the
    // delay log can grow without pushing anything out of the frame.
    const leftStack = doc.createElement('div');
    leftStack.className = 'beam-run__hud-stack beam-run__hud-stack--left';
    const rightStack = doc.createElement('div');
    rightStack.className = 'beam-run__hud-stack beam-run__hud-stack--right';

    // Stage: caption + name, stacked like an arcade level readout.
    this.level = doc.createElement('div');
    this.level.className = 'beam-run__hud-row beam-run__hud-level';
    this.level.append(
      this.caption(`${COPY.hud.stageLabel}: `, COPY.hud.stageLabel, 'beam-run__hud-caption'),
    );
    this.levelSr = this.srSpan('');
    this.levelArt = this.art('beam-run__hud-level-name');
    this.level.append(this.levelSr, this.levelArt);

    // Lives: caption over the hearts, in the top-right plaque the clock used to
    // hold. It sits above the delay log on purpose — the log is what a lost life
    // *cost*, so the two read as cause and consequence down one column.
    this.lives = doc.createElement('div');
    this.lives.className = 'beam-run__hud-row beam-run__hud-lives';
    this.lives.append(
      this.caption(`${COPY.hud.livesLabel}: `, COPY.hud.livesLabel, 'beam-run__hud-caption'),
    );
    this.livesSr = this.srSpan('');
    this.livesArt = doc.createElementNS(SVG_NS, 'svg');
    this.livesArt.setAttribute('aria-hidden', 'true');
    this.livesArt.setAttribute('focusable', 'false');
    this.livesArt.setAttribute('class', 'beam-run__pixels beam-run__hud-lives-pips');
    this.lives.append(this.livesSr, this.livesArt);

    // The delay log: hangs under the lives and grows downwards, one row per
    // obstacle. Hidden entirely until the first delay, so a clean run never sees
    // it and the frame stays quiet.
    this.log = doc.createElement('div');
    this.log.className = 'beam-run__hud-row beam-run__hud-log';
    this.log.append(
      this.caption(`${COPY.hud.logLabel}: `, COPY.hud.logLabel, 'beam-run__hud-log-label'),
    );
    this.logSr = this.srSpan('');
    this.logRows = doc.createElement('div');
    this.logRows.className = 'beam-run__hud-log-rows';
    this.logTotalArt = this.art('beam-run__hud-log-total');
    this.log.append(this.logSr, this.logRows, this.logTotalArt);

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

    leftStack.append(this.level, this.power);
    rightStack.append(this.lives, this.log);
    this.root.append(leftStack, rightStack, this.live);
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

  /**
   * Show the wrapper but hide both plaque stacks — the secret stage's arrangement.
   *
   * It exists because `setVisible(false)` sets `display: none` on the wrapper, and the
   * `aria-live` region lives inside it: hiding the HUD outright takes that region out of
   * the accessibility tree, so every announcement the bonus stage makes (what the room
   * is, the wall coming down, the way out) would be dropped for exactly the players who
   * need them most. The stage wants no plaques — nothing down there can cost a life or a
   * month — but it still has things to say.
   */
  setBare(bare: boolean): void {
    this.root.classList.toggle('beam-run__hud--bare', bare);
  }

  update(model: HudModel): void {
    if (model.levelLabel !== this.drawn.level) {
      this.drawn.level = model.levelLabel;
      this.levelSr.textContent = model.levelLabel;
      paint(this.levelArt, model.levelLabel, PX.stage, INK);
    }

    const livesKey = `${model.lives}/${model.livesTotal}`;
    if (livesKey !== this.drawn.lives) {
      const spent = this.lastLives >= 0 && model.lives < this.lastLives;
      this.lastLives = model.lives;
      this.drawn.lives = livesKey;
      const value = COPY.hud.livesValue(model.lives, model.livesTotal);
      this.livesSr.textContent = value;
      paintLives(this.livesArt, model.lives, model.livesTotal);
      this.lives.setAttribute('aria-label', `${COPY.hud.livesLabel}: ${value}`);
      // Nudge the plaque when a heart goes out. This is the beat the clock's bump
      // used to carry — and it belongs here, because losing a life is the event
      // and the months were only its price.
      // Cleared unconditionally first: it retriggers the animation on a second
      // loss, and it means the reset to a full complement at the start of the next
      // attempt does not inherit the flash from the end of the last one.
      this.lives.classList.remove('beam-run__hud-lives--spent');
      if (spent) {
        void this.lives.offsetWidth; // force reflow so the animation can retrigger
        this.lives.classList.add('beam-run__hud-lives--spent');
      }
    }

    this.updateLog(model.log);

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

  /**
   * Repaint the delay log. Rows are rebuilt wholesale rather than diffed: the
   * list is capped by `LIVES.LOG_VISIBLE_ROWS` in tuning and only changes when a delay
   * is booked, so a key comparison is enough to keep this off the hot path.
   */
  private updateLog(view: LogPanelView): void {
    const key = `${view.count}|${view.earlier}|${view.total}|${view.rows
      .map((r) => `${r.label}+${r.months}`)
      .join(',')}`;
    if (key === this.drawn.log) return;
    this.drawn.log = key;

    this.log.classList.toggle('beam-run__hud-log--visible', view.count > 0);
    if (view.count === 0) {
      this.logRows.replaceChildren();
      paint(this.logTotalArt, '', PX.logTotal, MUTED_INK);
      this.logSr.textContent = '';
      this.log.removeAttribute('aria-label');
      return;
    }

    const rows: HTMLElement[] = [];
    if (view.earlier > 0) {
      rows.push(this.logRow(COPY.hud.logEarlier(view.earlier), CAPTION_INK, 'earlier'));
    }
    for (const row of view.rows) {
      rows.push(this.logRow(COPY.hud.logRow(row.label, row.months), INK));
    }
    this.logRows.replaceChildren(...rows);

    paint(
      this.logTotalArt,
      `${COPY.hud.logTotal} ${COPY.hud.logMonths(view.total)}`,
      PX.logTotal,
      VALUE_INK,
    );
    // One sentence, not a list of fragments (see COPY.hud.logSummary). The rows
    // themselves stay decorative artwork.
    const summary = COPY.hud.logSummary(view.count, view.total);
    this.logSr.textContent = summary;
    this.log.setAttribute('aria-label', `${COPY.hud.logLabel}: ${summary}`);
  }

  private logRow(text: string, ink: PixelTextOptions, modifier?: string): HTMLElement {
    const el = this.doc.createElement('div');
    el.className =
      'beam-run__hud-log-row' + (modifier ? ` beam-run__hud-log-row--${modifier}` : '');
    const art = this.art();
    paint(art, text, PX.logRow, ink);
    el.appendChild(art);
    return el;
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
