/**
 * Overlays — the real-DOM screens layered over the canvas: Start, title card,
 * Pause, the mid-run Summary and the Win receipt. Built as accessible dialogs
 * (roles, labels, logical focus).
 *
 * There is no Game Over overlay — the run can't end in failure. What replaces it
 * is `summary`: if someone leaves mid-run, they still get the receipt, so nobody
 * exits empty-handed and every overlay routes to the Navigator.
 *
 * The receipt is the conversion surface. Each of the four capability rows is a
 * *button* that deep-links the Navigator with its own topic, so expressing
 * interest costs zero extra clicks — no question step, no gate.
 */
import { COPY, CAPABILITIES } from '../data/copy';
import { JOURNEY } from '../data/tuning.config';
import { createBrandLockup } from './BrandMark';
import {
  createPixelHeading,
  createPixelSvg,
  paintPixelSvg,
  PIXEL_TITLE,
  setPixelButtonLabel,
  setPixelText,
  type PixelLineOptions,
} from './PixelType';

/**
 * Authored-pixel size as a % of the frame width, per role. These are the type
 * scale of the overlays: one number each, so every screen agrees.
 */
const PX_TYPE = {
  /** Headlines — shared with the assist dialog so every title matches. */
  title: PIXEL_TITLE,
  /**
   * The closing months figure — the loudest element on any screen.
   *
   * `maxShare` is not optional here. This sits in `.beam-run__months-value`,
   * which shrink-wraps its contents, so the default `min(96%, …)` cap had nothing
   * definite to measure: the percentage fell back to the SVG's own intrinsic
   * width (12 cells × the default 4px scale = 48px) and the hero figure rendered
   * at ~46px instead of ~110px — the same size as the word "months" beside it.
   */
  figure: { unit: 0.9, minPx: 7, maxPx: 15, maxShare: 30 },
  /** The lead-in and tail of the stake sentence (~21px glyphs at native width). */
  stakeText: { unit: 0.24, minPx: 2.4, maxPx: 4, maxShare: 80 },
  /** "24 months" — the figure carries the hook, so it is set at display size. */
  stakeFigure: { unit: 0.5, minPx: 4, maxPx: 9, maxShare: 60 },

  /*
   * End-screen roles. These all carry `maxShare` (a cap in frame units) rather
   * than relying on the default `min(96%, …)`: several of them sit in grid cells
   * or shrink-wrapping flex boxes whose width comes *from* their content, where a
   * percentage is circular. See PixelType's `maxShare`.
   */
  /** Small caps captions: "You went live in", "Time to market", "What got you here". */
  caption: { unit: 0.2, minPx: 2, maxPx: 3.4, maxShare: 88, maxChars: 34 },
  /**
   * Supporting sentences: the attributed refs, the receipt hint, quick wins.
   * `maxChars` is 34 rather than the 26 a button uses — "ANSR clients average 11
   * months." is 31 characters, and at 26 it broke across two lines for no reason
   * (its floor width, 316px, still clears a 390px frame).
   */
  body: { unit: 0.17, minPx: 1.7, maxPx: 2.8, maxShare: 88, maxChars: 34 },
  /** "months" beside the big closing figure. */
  unitText: { unit: 0.28, minPx: 2.6, maxPx: 4.4, maxShare: 34 },
  /** The mid-run summary's "14 months". */
  clockStrong: { unit: 0.34, minPx: 3, maxPx: 5, maxShare: 46 },
  /** Receipt row: the product name. */
  rowStrong: { unit: 0.19, minPx: 2, maxPx: 3, maxShare: 34 },
  /** Receipt row: the stage and the months saved. */
  rowText: { unit: 0.16, minPx: 1.6, maxPx: 2.6, maxShare: 34 },
  /** Comparison bar labels (right-aligned in a percentage-width column). */
  barLabel: { unit: 0.14, minPx: 1.5, maxPx: 2.2, maxShare: 30 },
  /** Comparison bar numbers (fixed-width column, so the tracks stay aligned). */
  barValue: { unit: 0.19, minPx: 2, maxPx: 2.9, maxShare: 10 },
} as const;

/** Muted ink for supporting bitmap lines (the stake lead-in / tail). */
const MUTED_INK = { color: '#CFE6EC', shadow: 'rgba(0,16,22,0.85)' } as const;

const TITLE_INK = { color: '#FFFFFF', shadow: 'rgba(0,16,22,0.85)' } as const;
const VALUE_INK = { color: '#FF5400', shadow: 'rgba(0,16,22,0.9)' } as const;
/** Captions and other secondary lines — cool grey, one step down from body. */
const DIM_INK = { color: '#9FC8D2', shadow: 'rgba(0,16,22,0.85)' } as const;

export type OverlayName = 'start' | 'titlecard' | 'pause' | 'summary' | 'win';
export type CtaContext = 'win' | 'summary' | 'skip';

export interface OverlayCallbacks {
  onStart: () => void;
  onSkip: () => void;
  onResume: () => void;
  onRestart: () => void;
  /** `topic` is set when the click came from a capability row. */
  onCta: (context: CtaContext, topic?: string) => void;
  onToggleMute: () => void;
  onOpenAssist: () => void;
}

/** What the run produced — mirrors `RunReceipt` from the Simulation. */
export interface ReceiptModel {
  months: number;
  benchmarkMonths: number;
  baselineMonths: number;
  matchedBenchmark: boolean;
  quickWins: number;
  totalQuickWins: number;
  engaged: readonly string[];
  reachedScreenName: string;
}

export interface OverlayData {
  levelLabel?: string;
  receipt?: ReceiptModel;
}

export interface OverlayOptions {
  /** When true the months count-up lands on its final value instantly. */
  reducedMotion?: boolean;
}

interface OverlayEntry {
  el: HTMLDivElement;
  focusTarget: HTMLElement;
}

interface ReceiptView {
  root: HTMLDivElement;
  rows: Map<
    string,
    { btn: HTMLButtonElement; detail: HTMLSpanElement; mark: HTMLElement }
  >;
  quickWins: HTMLElement;
}

/** The three closing comparison bars (your run, ANSR average, going alone). */
interface BarsView {
  root: HTMLDivElement;
  you: HTMLElement;
  youValue: HTMLElement;
  ansr: HTMLElement;
  ansrValue: HTMLElement;
  alone: HTMLElement;
  aloneValue: HTMLElement;
}

/** Duration of the closing months count-up (seconds). */
export const MONTHS_COUNT_UP_S = JOURNEY.MONTHS_COUNT_UP_S;

function easeOutCubic(t: number): number {
  const c = 1 - t;
  return 1 - c * c * c;
}

export class Overlays {
  private readonly doc: Document;
  private readonly cb: OverlayCallbacks;
  private readonly entries = new Map<OverlayName, OverlayEntry>();
  private _current: OverlayName | null = null;

  // Elements whose text changes with data.
  private titleCardLabel!: HTMLElement;
  private titleCardSr!: HTMLElement;
  private titleCardArt!: SVGSVGElement;
  private winMonths!: HTMLElement;
  private winMonthsSr!: HTMLElement;
  private winMonthsArt!: SVGSVGElement;
  private winUnit!: HTMLElement;
  private winUnitText = '';
  private winBenchmark!: HTMLElement;
  private winBaseline!: HTMLElement;
  private winMatched!: HTMLElement;
  private winCta!: HTMLButtonElement;
  private winReceipt!: ReceiptView;
  private winBars!: BarsView;
  private summaryReached!: HTMLElement;
  private summaryMonths!: HTMLElement;
  private summaryReceipt!: ReceiptView;

  private readonly reducedMotion: boolean;
  // Months count-up state (driven each frame by the Game).
  private monthsTarget = 0;
  private monthsElapsed = 0;
  private monthsAnimating = false;
  /** Baseline the closing bars are scaled against (the going-alone average). */
  private barScale: number = JOURNEY.BASELINE_MONTHS;

  constructor(parent: HTMLElement, cb: OverlayCallbacks, opts: OverlayOptions = {}) {
    this.doc = parent.ownerDocument;
    this.cb = cb;
    this.reducedMotion = opts.reducedMotion ?? false;
    this.entries.set('start', this.buildStart());
    this.entries.set('titlecard', this.buildTitleCard());
    this.entries.set('pause', this.buildPause());
    this.entries.set('summary', this.buildSummary());
    this.entries.set('win', this.buildWin());
    for (const { el } of this.entries.values()) parent.appendChild(el);
  }

  get current(): OverlayName | null {
    return this._current;
  }

  show(name: OverlayName | null, data: OverlayData = {}): void {
    // Title-card label may change every time it is (re)shown per screen.
    if (name === 'titlecard' && data.levelLabel) {
      this.titleCardSr.textContent = data.levelLabel;
      paintPixelSvg(this.titleCardArt, [data.levelLabel], {
        ...PX_TYPE.title,
        ...TITLE_INK,
      });
    }
    if (this._current === name) return;
    this.hideAll();
    this._current = name;
    if (!name) return;

    if (data.receipt) {
      if (name === 'win') {
        this.renderWin(data.receipt);
        this.startMonthsCountUp(data.receipt.months);
      } else if (name === 'summary') {
        this.renderSummary(data.receipt);
      }
    }

    const entry = this.entries.get(name);
    if (!entry) return;
    entry.el.classList.add('beam-run__overlay--visible');
    // Move focus to the primary control (title card is transient → skip focus).
    if (name !== 'titlecard') {
      entry.focusTarget.focus?.();
    }
  }

  /** Begin the months count-up from 0 → target (instant if reduced-motion). */
  startMonthsCountUp(target: number): void {
    this.monthsTarget = Math.max(0, Math.round(target));
    this.monthsElapsed = 0;
    if (this.reducedMotion || this.monthsTarget === 0) {
      this.monthsAnimating = false;
      this.renderMonths(this.monthsTarget);
    } else {
      this.monthsAnimating = true;
      this.renderMonths(0);
    }
  }

  /**
   * Advance the count-up by `dt` seconds. Driven by the Game's render loop so it
   * stays deterministic and needs no internal timer. No-op once complete.
   */
  advanceMonths(dt: number): void {
    if (!this.monthsAnimating) return;
    this.monthsElapsed += dt;
    const t = Math.min(1, this.monthsElapsed / MONTHS_COUNT_UP_S);
    this.renderMonths(Math.round(this.monthsTarget * easeOutCubic(t)));
    if (t >= 1) {
      this.monthsAnimating = false;
      this.renderMonths(this.monthsTarget); // guarantee the exact final figure
    }
  }

  /** Current displayed months (for tests). */
  get monthsDisplay(): number {
    return Number(this.winMonths.textContent ?? '0');
  }

  private renderMonths(value: number): void {
    this.winMonthsSr.textContent = `${value}`;
    paintPixelSvg(this.winMonthsArt, [`${value}`], {
      ...PX_TYPE.figure,
      ...VALUE_INK,
    });
    // Only repaint the unit when it actually changes (month ↔ months): this runs
    // every frame of the count-up.
    const unit = COPY.win.monthsUnit(value);
    if (unit !== this.winUnitText) {
      this.winUnitText = unit;
      setPixelText(this.winUnit, unit, { ...PX_TYPE.unitText, ...DIM_INK });
    }
    // The player's bar grows with the count-up, so the figure and the picture
    // always agree.
    this.winBars.you.style.width = `${this.barPercent(value)}%`;
    setPixelText(this.winBars.youValue, `${value}`, { ...PX_TYPE.barValue, ...VALUE_INK });
  }

  /** Bar width as a percentage of the going-alone baseline (clamped 4–100). */
  private barPercent(months: number): number {
    const pct = (Math.max(0, months) / Math.max(1, this.barScale)) * 100;
    return Math.round(Math.min(100, Math.max(4, pct)));
  }

  hideAll(): void {
    for (const { el } of this.entries.values()) {
      el.classList.remove('beam-run__overlay--visible');
    }
    this._current = null;
  }

  destroy(): void {
    for (const { el } of this.entries.values()) el.remove();
    this.entries.clear();
  }

  // --- data → DOM -----------------------------------------------------------

  private renderWin(r: ReceiptModel): void {
    const refInk = { ...PX_TYPE.body, ...MUTED_INK };
    setPixelText(this.winBenchmark, COPY.win.benchmark(r.benchmarkMonths), refInk);
    setPixelText(this.winBaseline, COPY.win.baseline(r.baselineMonths), refInk);
    // Scale the bars to the going-alone baseline: the run is always measured
    // against the number the buyer is actually facing.
    this.barScale = Math.max(r.baselineMonths, r.months);
    this.winBars.ansr.style.width = `${this.barPercent(r.benchmarkMonths)}%`;
    this.winBars.alone.style.width = `${this.barPercent(r.baselineMonths)}%`;
    const barNum = { ...PX_TYPE.barValue, ...TITLE_INK };
    setPixelText(this.winBars.ansrValue, `${r.benchmarkMonths}`, barNum);
    setPixelText(this.winBars.aloneValue, `${r.baselineMonths}`, barNum);
    setPixelText(this.winMatched, r.matchedBenchmark ? COPY.win.matched : '', {
      ...PX_TYPE.body,
      ...VALUE_INK,
    });
    this.winMatched.hidden = !r.matchedBenchmark;
    // A clean run gets the plain CTA; anything else gets the "close the gap" one.
    setPixelButtonLabel(this.winCta, r.matchedBenchmark ? COPY.win.cta : COPY.win.ctaGap, 'primary');
    this.fillReceipt(this.winReceipt, r);
  }

  private renderSummary(r: ReceiptModel): void {
    setPixelText(this.summaryReached, COPY.summary.reached(r.reachedScreenName), {
      ...PX_TYPE.body,
      ...MUTED_INK,
    });
    setPixelText(this.summaryMonths, `${r.months} ${COPY.win.monthsUnit(r.months)}`, {
      ...PX_TYPE.clockStrong,
      ...VALUE_INK,
    });
    this.fillReceipt(this.summaryReceipt, r);
  }

  private fillReceipt(view: ReceiptView, r: ReceiptModel): void {
    for (const cap of CAPABILITIES) {
      const row = view.rows.get(cap.badge);
      if (!row) continue;
      const engaged = r.engaged.includes(cap.badge);
      row.btn.classList.toggle('beam-run__receipt-row--engaged', engaged);
      row.btn.setAttribute('aria-pressed', engaged ? 'true' : 'false');
      row.mark.replaceChildren(this.pixelMark(engaged));
      setPixelText(
        row.detail,
        engaged ? COPY.win.savesMonths(cap.monthsSaved) : COPY.win.notReached,
        { ...PX_TYPE.rowText, ...(engaged ? VALUE_INK : DIM_INK), maxChars: 16 },
      );
    }
    setPixelText(view.quickWins, COPY.win.quickWins(r.quickWins, r.totalQuickWins), {
      ...PX_TYPE.body,
      ...DIM_INK,
    });
  }

  // --- builders -------------------------------------------------------------

  private overlayShell(modifiers: readonly string[] = [], label?: string): HTMLDivElement {
    const el = this.doc.createElement('div');
    el.className =
      'beam-run__overlay' + modifiers.map((m) => ` beam-run__overlay--${m}`).join('');
    el.setAttribute('role', modifiers.includes('titlecard') ? 'status' : 'dialog');
    if (label) el.setAttribute('aria-label', label);
    return el;
  }

  /**
   * A transparent content column. Deliberately *not* a card: the overlays sit
   * straight on the artwork behind a dithered wash (see styles.ts), the way an
   * arcade game overlays its own screen. It only constrains measure and rhythm.
   */
  private stack(modifier?: string): HTMLDivElement {
    const el = this.doc.createElement('div');
    el.className = 'beam-run__stack' + (modifier ? ` beam-run__stack--${modifier}` : '');
    return el;
  }

  /**
   * The end screens' two-column body: the run's result on the left, the receipt
   * on the right. Stacked, these screens are ~800px of content — taller than a
   * 16:9 frame even before they were set in bitmap type — which put the CTA, the
   * whole point of the screen, below the fold. Side by side they fit with room,
   * and the receipt reads beside the figure it explains. Narrow frames fall back
   * to one column (see styles.ts).
   *
   * The actions are deliberately NOT in a column: a CTA tucked under the right
   * half made the screen lopsided, and full width it also has room to sit beside
   * "Play again" instead of wrapping under it. Title above, buttons below, two
   * columns between — the whole screen reads on one centre line.
   */
  private columns(main: readonly HTMLElement[], aside: readonly HTMLElement[]): HTMLElement {
    const cols = this.h('div', 'beam-run__cols');
    const left = this.h('div', 'beam-run__col beam-run__col--main');
    const right = this.h('div', 'beam-run__col beam-run__col--aside');
    left.append(...main);
    right.append(...aside);
    cols.append(left, right);
    return cols;
  }

  /** A heading set in the game's own 5×7 bitmap font. */
  private pixelTitle(text: string, visual: readonly string[]): HTMLElement {
    return createPixelHeading(this.doc, 'h2', 'beam-run__title', text, visual, {
      ...PX_TYPE.title,
      ...TITLE_INK,
    });
  }

  private btn(
    text: string,
    variant: 'primary' | 'ghost' | 'default',
    onClick: () => void,
  ): HTMLButtonElement {
    const b = this.doc.createElement('button');
    b.type = 'button';
    b.className =
      'beam-run__btn' + (variant !== 'default' ? ` beam-run__btn--${variant}` : '');
    setPixelButtonLabel(b, text, variant);
    b.addEventListener('click', onClick);
    return b;
  }

  private h(tag: string, cls: string, text?: string): HTMLElement {
    const el = this.doc.createElement(tag);
    el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  /**
   * The receipt row's status glyph, drawn as pixels: a hollow box for a stage the
   * run never reached, a check for one ANSR handled. Shape carries the meaning —
   * the orange is a bonus, never the signal.
   */
  private pixelMark(engaged: boolean): SVGSVGElement {
    const rows = engaged
      ? ['.......', '......#', '.....#.', '#...#..', '.#.#...', '..#....', '.......']
      : ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'];
    const svg = this.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 7 7');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'beam-run__pixels');
    const d: string[] = [];
    rows.forEach((line, y) => {
      for (let x = 0; x < line.length; x += 1) {
        if (line[x] === '#') d.push(`M${x} ${y}h1v1h-1z`);
      }
    });
    const path = this.doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d.join(''));
    path.setAttribute('fill', engaged ? '#FF5400' : '#6E93A0');
    path.setAttribute('shape-rendering', 'crispEdges');
    svg.appendChild(path);
    svg.style.width = 'clamp(11px, calc(var(--beam-run-u) * 1.2), 17px)';
    return svg;
  }

  /** An element whose text is bitmap artwork (plus hidden prose). */
  private pixel(tag: string, cls: string, text: string, opts: PixelLineOptions): HTMLElement {
    const el = this.h(tag, cls);
    setPixelText(el, text, opts);
    return el;
  }

  /**
   * The receipt: four capability rows, each a button that carries its own topic
   * into the Navigator. Engaged rows read "saves N months"; unreached rows are
   * dimmed but still clickable — an unreached stage is a live interest signal.
   */
  private buildReceipt(context: CtaContext): ReceiptView {
    const root = this.h('div', 'beam-run__receipt') as HTMLDivElement;
    const title = this.pixel('div', 'beam-run__receipt-title', COPY.win.receiptTitle, {
      ...PX_TYPE.caption,
      ...DIM_INK,
    });
    const hint = this.pixel('div', 'beam-run__hint', COPY.win.receiptHint, {
      ...PX_TYPE.body,
      ...MUTED_INK,
    });
    const list = this.h('div', 'beam-run__receipt-list');
    const rows: ReceiptView['rows'] = new Map();

    for (const cap of CAPABILITIES) {
      const btn = this.doc.createElement('button');
      btn.type = 'button';
      btn.className = 'beam-run__receipt-row';
      const mark = this.h('span', 'beam-run__receipt-mark');
      mark.setAttribute('aria-hidden', 'true');
      const markArt = this.pixelMark(false);
      mark.appendChild(markArt);
      const product = this.pixel('span', 'beam-run__receipt-product', cap.product, {
        ...PX_TYPE.rowStrong,
        ...TITLE_INK,
      });
      const stage = this.pixel('span', 'beam-run__receipt-stage', cap.stage, {
        ...PX_TYPE.rowText,
        ...MUTED_INK,
      });
      const detail = this.h('span', 'beam-run__receipt-detail') as HTMLSpanElement;
      btn.append(mark, product, stage, detail);
      btn.setAttribute('aria-label', `${cap.product} — ${cap.stage}. ${cap.effect}.`);
      btn.addEventListener('click', () => this.cb.onCta(context, cap.topic));
      list.appendChild(btn);
      rows.set(cap.badge, { btn, detail, mark });
    }

    const quickWins = this.h('div', 'beam-run__hint beam-run__receipt-wins');
    root.append(title, hint, list, quickWins);
    return { root, rows, quickWins };
  }

  /**
   * The stake, set as an editorial statistic in the game's own bitmap font:
   * lead-in, the figure at display size, then the tail. Mixing a web typeface
   * into the sentence (which is what the inline-figure version did) made the
   * start screen read as two different products stacked on each other.
   *
   * One visually-hidden span carries the whole sentence, so assistive tech and
   * `textContent` still see ordinary prose with its real punctuation.
   */
  private buildStake(): HTMLElement {
    const stake = this.h('p', 'beam-run__stake');
    stake.append(this.h('span', 'beam-run__sr', COPY.start.stake(JOURNEY.BASELINE_MONTHS)));

    const lead = createPixelSvg(this.doc, [COPY.start.stakeLead], {
      ...PX_TYPE.stakeText,
      ...MUTED_INK,
    });
    const figure = this.h('span', 'beam-run__stake-figure');
    figure.appendChild(
      createPixelSvg(this.doc, [COPY.start.stakeFigure(JOURNEY.BASELINE_MONTHS)], {
        ...PX_TYPE.stakeFigure,
        ...VALUE_INK,
      }),
    );
    const tail = createPixelSvg(this.doc, [COPY.start.stakeTail], {
      ...PX_TYPE.stakeText,
      ...MUTED_INK,
    });

    stake.append(lead, figure, tail);
    return stake;
  }

  private buildStart(): OverlayEntry {
    const el = this.overlayShell(['scene', 'start'], COPY.start.title);
    // Marquee: [sunburst] ANSRcade · MARKET ENTRY.
    const brand = createBrandLockup(this.doc, { title: COPY.meta.edition });
    const stack = this.stack('start');

    // The hook leads with the stake, not the product name. No control legend and
    // no run-length estimate: the controls are the two arrow keys and Space (and
    // one tap on touch), and stating them made the title screen read as a manual.
    // They stay in the canvas's accessible description for screen-reader users.
    const challenge = this.pixelTitle(COPY.start.challenge, ['THINK YOU CAN', 'BEAT THAT?']);
    const actions = this.h('div', 'beam-run__actions');
    const start = this.btn(COPY.start.play, 'primary', () => this.cb.onStart());
    const skip = this.btn(COPY.start.skip, 'ghost', () => this.cb.onSkip());
    actions.append(start, skip);

    stack.append(this.buildStake(), challenge, actions);
    el.append(brand, stack);
    return { el, focusTarget: start };
  }

  private buildTitleCard(): OverlayEntry {
    const el = this.overlayShell(['titlecard']);
    // Rebuilt per screen (the label changes), so it keeps its own sr + art nodes.
    this.titleCardLabel = this.h('h2', 'beam-run__title');
    this.titleCardSr = this.h('span', 'beam-run__sr');
    this.titleCardArt = createPixelSvg(this.doc, [''], {
      ...PX_TYPE.title,
      ...TITLE_INK,
    });
    this.titleCardLabel.append(this.titleCardSr, this.titleCardArt);
    el.append(this.titleCardLabel);
    return { el, focusTarget: el };
  }

  private buildPause(): OverlayEntry {
    const el = this.overlayShell([], COPY.pause.title);
    const stack = this.stack();
    const title = this.pixelTitle(COPY.pause.title, [COPY.pause.title]);
    const actions = this.h('div', 'beam-run__actions');
    const resume = this.btn(COPY.pause.resume, 'primary', () => this.cb.onResume());
    const restart = this.btn(COPY.pause.restart, 'default', () => this.cb.onRestart());
    const assist = this.btn(COPY.pause.assist, 'default', () => this.cb.onOpenAssist());
    const mute = this.btn(COPY.pause.mute, 'default', () => this.cb.onToggleMute());
    const skip = this.btn(COPY.pause.skip, 'ghost', () => this.cb.onSkip());
    actions.append(resume, restart, assist, mute, skip);
    stack.append(title, actions);
    el.append(stack);
    return { el, focusTarget: resume };
  }

  /** Mid-run exit: a shorter receipt so a partial session still lands a message. */
  private buildSummary(): OverlayEntry {
    const el = this.overlayShell(['scene', 'receipt'], COPY.summary.title);
    const brand = createBrandLockup(this.doc, { compact: true });
    const card = this.stack('receipt');
    const title = this.pixelTitle(COPY.summary.title, ['YOUR JOURNEY', 'SO FAR']);
    this.summaryReached = this.h('p', 'beam-run__subtitle');
    const clock = this.h('div', 'beam-run__clock-line');
    const clockLabel = this.pixel('span', 'beam-run__clock-label', COPY.win.monthsLabel, {
      ...PX_TYPE.caption,
      ...DIM_INK,
    });
    this.summaryMonths = this.h('span', 'beam-run__clock-strong');
    clock.append(clockLabel, this.summaryMonths);
    this.summaryReceipt = this.buildReceipt('summary');
    const actions = this.h('div', 'beam-run__actions');
    const cta = this.btn(COPY.summary.cta, 'primary', () => this.cb.onCta('summary'));
    const resume = this.btn(COPY.summary.resume, 'ghost', () => this.cb.onResume());
    actions.append(cta, resume);
    card.append(title, this.columns([this.summaryReached, clock], [this.summaryReceipt.root]), actions);
    el.append(brand, card);
    return { el, focusTarget: cta };
  }

  /**
   * The three comparison bars. The figure alone ("14 months") means nothing to
   * someone who doesn't carry the benchmarks in their head; seeing the run sit
   * between ANSR's 11 and the going-alone 24 is the whole argument, at a glance.
   * Decorative — the same facts are in the attributed `.beam-run__ref` lines
   * below, which is what assistive tech reads.
   */
  private buildBars(): BarsView {
    const root = this.h('div', 'beam-run__bars') as HTMLDivElement;
    root.setAttribute('aria-hidden', 'true');

    const row = (
      label: string,
      variant: 'you' | 'ansr' | 'alone',
    ): { fill: HTMLElement; value: HTMLElement } => {
      const line = this.h('div', 'beam-run__bar');
      const name = this.pixel('span', 'beam-run__bar-label', label, {
        ...PX_TYPE.barLabel,
        ...DIM_INK,
      });
      const track = this.h('span', 'beam-run__bar-track');
      const fill = this.h('span', `beam-run__bar-fill beam-run__bar-fill--${variant}`);
      track.appendChild(fill);
      const value = this.pixel('span', 'beam-run__bar-value', '0', {
        ...PX_TYPE.barValue,
        ...TITLE_INK,
      });
      line.append(name, track, value);
      root.appendChild(line);
      return { fill, value };
    };

    const you = row(COPY.win.barYou, 'you');
    const ansr = row(COPY.win.barAnsr, 'ansr');
    const alone = row(COPY.win.barAlone, 'alone');
    return {
      root,
      you: you.fill,
      youValue: you.value,
      ansr: ansr.fill,
      ansrValue: ansr.value,
      alone: alone.fill,
      aloneValue: alone.value,
    };
  }

  private buildWin(): OverlayEntry {
    const el = this.overlayShell(['scene', 'receipt', 'win'], COPY.win.title);
    const brand = createBrandLockup(this.doc, { compact: true });
    const card = this.stack('receipt');
    const title = this.pixelTitle(COPY.win.title, ['MARKET ENTRY', 'COMPLETE']);

    const label = this.pixel('div', 'beam-run__months-label', COPY.win.monthsLabel, {
      ...PX_TYPE.caption,
      ...DIM_INK,
    });
    const figure = this.h('div', 'beam-run__months');
    // The closing figure is the loudest thing on the screen, so it is drawn in
    // the game's own font — an arcade score readout, not a web number.
    this.winMonths = this.h('span', 'beam-run__months-value');
    this.winMonthsSr = this.h('span', 'beam-run__sr', '0');
    this.winMonthsArt = createPixelSvg(this.doc, ['0'], {
      ...PX_TYPE.figure,
      ...VALUE_INK,
    });
    this.winMonths.append(this.winMonthsSr, this.winMonthsArt);
    this.winUnit = this.h('span', 'beam-run__months-unit');
    this.winUnitText = COPY.win.monthsUnit(0);
    setPixelText(this.winUnit, this.winUnitText, { ...PX_TYPE.unitText, ...DIM_INK });
    figure.append(this.winMonths, this.winUnit);

    this.winBars = this.buildBars();

    // Two attributed reference lines: ANSR's data, not the player's score.
    const refs = this.h('div', 'beam-run__refs');
    this.winBenchmark = this.h('span', 'beam-run__ref');
    this.winBaseline = this.h('span', 'beam-run__ref');
    refs.append(this.winBenchmark, this.winBaseline);
    this.winMatched = this.h('p', 'beam-run__matched');
    this.winMatched.hidden = true;

    this.winReceipt = this.buildReceipt('win');

    const actions = this.h('div', 'beam-run__actions');
    this.winCta = this.btn(COPY.win.cta, 'primary', () => this.cb.onCta('win'));
    const replay = this.btn(COPY.win.replay, 'ghost', () => this.cb.onRestart());
    actions.append(this.winCta, replay);

    /*
     * Two columns on a wide frame (see styles.ts): the run's result on the left,
     * the receipt and its routes on the right. Stacked, this screen is ~890px of
     * content — taller than a 720px frame even before it was set in bitmap type —
     * so the CTA, which is the whole point of the screen, sat below the fold.
     * Side by side it fits with room, and the receipt reads beside the figure it
     * explains instead of underneath it. Narrow frames keep the single column.
     */
    card.append(
      title,
      this.columns([label, figure, this.winBars.root, refs, this.winMatched], [
        this.winReceipt.root,
      ]),
      actions,
    );
    el.append(brand, card);
    return { el, focusTarget: this.winCta };
  }
}
