/**
 * Overlays — the real-DOM screens layered over the canvas: Start, title card,
 * Pause, the out-of-lives screen, the mid-run Summary and the Win receipt. Built
 * as accessible dialogs (roles, labels, logical focus).
 *
 * **Losing a life shows no screen at all** (owner call). It used to: one surface
 * did two jobs, coaching mid-attempt and closing the attempt on the last life. The
 * coaching half is gone — the stage simply starts again, and the one thing that
 * screen said that mattered ("take the ANSR badge") is now a single line under the
 * stage name on the retry's title card. What is left here is `gameover`, which
 * fires once per attempt.
 *
 * `gameover` is deliberately three things and one route: the headline, the one
 * figure that matters, the argument that figure is evidence for, and a cap that puts
 * the player back on the stage that stopped them. The Navigator button it used to
 * carry is gone (owner call — no Navigator cap on the start screen, this screen or
 * the win receipt; it survives on the pause menu and as the four capability rows). No
 * itemised ledger (the closing receipt carries the same breakdown, and here it was
 * a table competing with the instruction), no lives readout (there are none left),
 * no two-column split — one centred column, so the whole screen reads down one
 * axis. It is still not a dead end and still nothing that tells the player they
 * failed: an attempt that runs out of lives ends on a conversion surface, the same
 * as one that reaches the Tech Park.
 *
 * The receipt is the conversion surface. Each of the four capability rows is a
 * *button* that deep-links the Navigator with its own topic, so expressing
 * interest costs zero extra clicks — no question step, no gate.
 */
import { COPY, CAPABILITIES } from '../data/copy';
import { JOURNEY } from '../data/tuning.config';
import type { LedgerRow } from '../core/setbackLog';
import { createBrandLockup } from './BrandMark';
import {
  createPixelHeading,
  createPixelSvg,
  paintPixelSvg,
  PIXEL_TITLE,
  setPixelButtonLabel,
  setPixelText,
  wrapPixelLabel,
  type PixelLineOptions,
} from './PixelType';

/**
 * The jump pad's face on a touch device, as a pixel disc — the round `\u2B24` the
 * on-screen button carries, which the 5×7 font has no glyph for. Drawn rather than
 * typed for the same reason the receipt's tick is: a font character comes from whatever
 * typeface the host has, and this row is meant to look like the buttons it describes.
 */
const DOT_GLYPH = [
  '..###..',
  '.#####.',
  '#######',
  '#######',
  '#######',
  '.#####.',
  '..###..',
] as const;

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
  /*
   * `advice` (unit 0.24) used to be here, for the out-of-lives instruction — the last
   * survivor of the title screen's deleted three-line hook, where it was `stakeText`.
   * That instruction is inside the cost panel now, under the figure it argues about,
   * so it is set at `body` like the win screen's verdict in the same slot: a sentence
   * a third of the way down a panel cannot also be the second-loudest thing on the
   * screen. Nothing else wanted the size, so the spec went with it.
   */
  /**
   * The control legend's key caps and their labels.
   *
   * A cap is sized by its glyph, not by its explanation, which is the whole reason the
   * legend is caps rather than a sentence: "SPACE" is the widest of them at 5
   * characters, and at unit 0.18 that is ~90px on a 1280 frame against a 645px
   * headline. `maxShare` is per cap, so it has to clear the widest one on a phone
   * (5 chars = 29 cells → 20% of a 390px frame is 78px, which is 2.7px per cell).
   */
  key: { unit: 0.18, minPx: 2, maxPx: 3, maxShare: 20 },
  keyLabel: { unit: 0.15, minPx: 1.5, maxPx: 2.4, maxShare: 16 },

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
  /** The out-of-lives figure and the mid-run summary's own. */
  clockStrong: { unit: 0.34, minPx: 3, maxPx: 5, maxShare: 46 },
  /** Receipt row: the product name. */
  rowStrong: { unit: 0.19, minPx: 2, maxPx: 3, maxShare: 34 },
  /** Receipt row: the stage and what ANSR did there. */
  rowText: { unit: 0.16, minPx: 1.6, maxPx: 2.6, maxShare: 34 },
  /*
   * The `barLabel` / `barValue` specs went with the three comparison bars, which
   * charted the run against the 11-month benchmark and the 24-month baseline — both
   * statistics are out of the game (see `COPY.win.lostLabel`), and a chart with one
   * bar on it is a number.
   */
} as const;

/** Muted ink for supporting bitmap lines (the stake lead-in / tail). */
const MUTED_INK = { color: '#CFE6EC', shadow: 'rgba(0,16,22,0.85)' } as const;

const TITLE_INK = { color: '#FFFFFF', shadow: 'rgba(0,16,22,0.85)' } as const;
const VALUE_INK = { color: '#FF5400', shadow: 'rgba(0,16,22,0.9)' } as const;
/** Captions and other secondary lines — cool grey, one step down from body. */
const DIM_INK = { color: '#9FC8D2', shadow: 'rgba(0,16,22,0.85)' } as const;

export type OverlayName = 'start' | 'titlecard' | 'pause' | 'gameover' | 'summary' | 'win';
export type CtaContext = 'win' | 'summary' | 'skip';

export interface OverlayCallbacks {
  onStart: () => void;
  onSkip: () => void;
  onResume: () => void;
  onRestart: () => void;
  /** Leave the out-of-lives screen: back to the title with a clean slate. */
  onContinue: () => void;
  /** Leave the briefing card and start the stage it describes. */
  onAdvance: () => void;
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
  /** How many delays the run booked. */
  setbacks: number;
  /** Months booked by delays alone — the avoidable part of the total. */
  delayMonths: number;
  /** Delays grouped by obstacle, in first-encountered order. */
  ledger: readonly LedgerRow[];
  engaged: readonly string[];
  reachedScreenName: string;
}

/**
 * What the out-of-lives screen shows — a narrowing of `LifeLostView` from the
 * Simulation, which still carries the obstacle and the lives for the host's own
 * use (the impact poses) and for analytics.
 */
export interface LifeLostModel {
  /** The delays booked this attempt, and what they cost. The whole payload. */
  delays: number;
  delayMonths: number;
}

export interface OverlayData {
  levelLabel?: string;
  /**
   * The briefing card's one line about the stage ahead — what the place is and
   * what is in it. Absent only if a screen has no brief authored for it, in which
   * case the card is the stage name alone.
   */
  brief?: string;
  /**
   * One line under the title card. Present only on a retry, where it carries the
   * instruction the deleted life-lost screen used to: take the ANSR badge.
   */
  hint?: string;
  receipt?: ReceiptModel;
  lifeLost?: LifeLostModel;
}

export interface OverlayOptions {
  /** When true the months count-up lands on its final value instantly. */
  reducedMotion?: boolean;
  /**
   * Touch device. Only the title screen's control line reads it: a phone player
   * has no arrow keys and one-tap play is the default there, so naming them would
   * be a guide to a keyboard they are not holding.
   */
  touch?: boolean;
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
  /**
   * Where the itemised delays are written. The mid-run summary keeps them inside the
   * receipt; the win screen passes its own host, in the column under the closing
   * figure, because there they are that figure's breakdown.
   */
  delays: HTMLElement;
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
  private titleCardBrief!: HTMLElement;
  private titleCardHint!: HTMLElement;
  /** Last painted (label|brief|hint), so the card is not repainted every frame. */
  private titleCardKey = '';
  private winMonths!: HTMLElement;
  private winMonthsSr!: HTMLElement;
  private winMonthsArt!: SVGSVGElement;
  private winUnit!: HTMLElement;
  private winUnitText = '';
  /** The one line under the closing figure: clean run, or the argument. */
  private winVerdict!: HTMLElement;
  private winReceipt!: ReceiptView;
  private summaryReached!: HTMLElement;
  private summaryMonths!: HTMLElement;
  private summaryReceipt!: ReceiptView;
  /*
   * Out of lives (the only end-of-attempt screen). Four elements repaint per attempt,
   * because the figure is drawn the way the win screen's is: a screen-reader span, the
   * bitmap numeral, its unit and the line saying how many delays produced it.
   */
  private lostMonths!: HTMLElement;
  private lostMonthsSr!: HTMLElement;
  private lostMonthsArt!: SVGSVGElement;
  private lostUnit!: HTMLElement;
  private lostFrom!: HTMLElement;
  /** Last painted unit word, so a repaint with the same value touches no DOM. */
  private lostUnitText = '';

  private readonly reducedMotion: boolean;
  /** Touch device — decides which control line the title screen prints. */
  private readonly isTouch: boolean;
  // Months count-up state (driven each frame by the Game).
  private monthsTarget = 0;
  private monthsElapsed = 0;
  private monthsAnimating = false;

  constructor(parent: HTMLElement, cb: OverlayCallbacks, opts: OverlayOptions = {}) {
    this.doc = parent.ownerDocument;
    this.cb = cb;
    this.reducedMotion = opts.reducedMotion ?? false;
    this.isTouch = opts.touch ?? false;
    this.entries.set('start', this.buildStart());
    this.entries.set('titlecard', this.buildTitleCard());
    this.entries.set('pause', this.buildPause());
    this.entries.set('gameover', this.buildGameOver());
    this.entries.set('summary', this.buildSummary());
    this.entries.set('win', this.buildWin());
    for (const { el } of this.entries.values()) parent.appendChild(el);
  }

  get current(): OverlayName | null {
    return this._current;
  }

  show(name: OverlayName | null, data: OverlayData = {}): void {
    // The briefing card's three variable lines: the stage name, the brief, and the
    // retry hint. Painted before the no-change bail-out, because the card is
    // re-shown per screen — but only when one of them has actually changed: the
    // host calls `show()` every rendered frame, and repainting three bitmap SVGs at
    // 60Hz is a lot of DOM for a screen that is standing still.
    if (name === 'titlecard' && data.levelLabel) {
      const key = `${data.levelLabel}|${data.brief ?? ''}|${data.hint ?? ''}`;
      if (key !== this.titleCardKey) {
        this.titleCardKey = key;
        this.titleCardSr.textContent = data.levelLabel;
        // The card's accessible name is the stage it introduces, so it changes with
        // the stage (there is nothing static to label it with).
        this.entries
          .get('titlecard')
          ?.el.setAttribute(
            'aria-label',
            data.brief ? `${data.levelLabel}. ${data.brief}` : data.levelLabel,
          );
        paintPixelSvg(this.titleCardArt, [data.levelLabel], {
          ...PX_TYPE.title,
          ...TITLE_INK,
        });
        // What the stage ahead is, in one line. Hidden rather than blank when a
        // screen has none, so the card composes as three elements or as two.
        this.titleCardBrief.hidden = !data.brief;
        // Emptied when there is none, not just hidden: a hidden element that keeps its
        // last text is one CSS mistake away from printing it again, and that is exactly
        // the mistake the retry hint shipped (see the [hidden] rule in styles.ts).
        if (!data.brief) this.titleCardBrief.textContent = '';
        if (data.brief) {
          // 26 characters rather than `body`'s own 34: the brief is the only prose on
          // the card, so it is set as a short measure on two balanced lines. At 34 the
          // greedy wrap fills the first line and leaves two words on the second, which
          // reads as an accident above a centred button.
          setPixelText(this.titleCardBrief, data.brief, {
            ...PX_TYPE.body,
            ...MUTED_INK,
            maxChars: 26,
          });
        }
        // The retry hint. Painted here rather than once at build time because the
        // same card is shown for a first attempt (no hint) and a retry (hint), and
        // the two must not be able to disagree.
        this.titleCardHint.hidden = !data.hint;
        if (!data.hint) this.titleCardHint.textContent = '';
        if (data.hint) {
          setPixelText(this.titleCardHint, data.hint, { ...PX_TYPE.caption, ...VALUE_INK });
        }
      }
    }
    // Painted before the no-change bail-out, like the title card: the figures
    // differ per attempt even when the screen itself is already up.
    if (name === 'gameover' && data.lifeLost) this.renderGameOver(data.lifeLost);
    if (this._current === name) return;
    this.hideAll();
    this._current = name;
    if (!name) return;

    if (data.receipt) {
      if (name === 'win') {
        this.renderWin(data.receipt);
        // The figure that counts up is the *cost of the delays*, not the run's own
        // total (owner call — see COPY.win.lostLabel). A clean run therefore counts
        // to 0, which `startMonthsCountUp` paints instantly: there is no animation to
        // watch on a number that never moves, and 0 is the reward.
        this.startMonthsCountUp(data.receipt.delayMonths);
      } else if (name === 'summary') {
        this.renderSummary(data.receipt);
      }
    }

    const entry = this.entries.get(name);
    if (!entry) return;
    entry.el.classList.add('beam-run__overlay--visible');
    // Move focus to the primary control. The briefing card is included now: it
    // waits for the player, so it is a thing to be acted on rather than a caption
    // that goes past, and the control that acts on it has to be reachable by
    // keyboard and announced.
    entry.focusTarget.focus?.();
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

  /**
   * The closing screen. Two things are painted per run — the verdict line, and the
   * receipt — because the figure itself is driven by the count-up.
   *
   * What is no longer painted: the two attributed reference lines, the three
   * comparison bars and the "you matched the ANSR benchmark" line. All three existed
   * to give the run's absolute month total a meaning, and the statistics they quoted
   * are out of the game (see `COPY.win.lostLabel`).
   */
  private renderWin(r: ReceiptModel): void {
    const clean = r.setbacks === 0;
    setPixelText(this.winVerdict, clean ? COPY.win.verdictClean : COPY.win.verdictDelayed, {
      ...PX_TYPE.body,
      ...(clean ? VALUE_INK : MUTED_INK),
    });
    this.fillReceipt(this.winReceipt, r);
    // A clean run says it once. `fillDelays` writes the credit line ("No delays.
    // Cleared first time.") for the mid-run summary, which has no verdict slot; here
    // the verdict directly under the figure has already said it, and the raster showed
    // the pair as one fact printed twice in the same column.
    if (r.ledger.length === 0) this.winReceipt.delays.replaceChildren();
  }

  private renderSummary(r: ReceiptModel): void {
    setPixelText(this.summaryReached, COPY.summary.reached(r.reachedScreenName), {
      ...PX_TYPE.body,
      ...MUTED_INK,
    });
    // The same measure the closing screen uses, so a mid-run exit and a finish are
    // never reporting two different numbers.
    setPixelText(
      this.summaryMonths,
      `${r.delayMonths} ${COPY.win.monthsUnit(r.delayMonths)}`,
      { ...PX_TYPE.clockStrong, ...VALUE_INK },
    );
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
      // An engaged row states the outcome ("Setup stood up"), not a months-saved
      // figure: those figures were shares of the benchmark gap, and the benchmark is
      // out of the game. The HUD chip already says this in the same words, so the
      // receipt is reminding the player of something they read while playing.
      setPixelText(
        row.detail,
        engaged ? (COPY.powers[cap.badge] ?? cap.stage) : COPY.win.notReached,
        { ...PX_TYPE.rowText, ...(engaged ? VALUE_INK : DIM_INK), maxChars: 16 },
      );
    }
    this.fillDelays(view.delays, r);
  }

  /**
   * The itemised delays. A clean run gets the credit; any other gets the breakdown of
   * the figure above it, obstacle by obstacle, because that is what the Navigator
   * conversation actually starts from.
   *
   * On the win screen this sits **under the closing figure**, not under the capability
   * rows: it is the itemisation of that figure, and the raster made the old placement
   * obvious as a mistake — the cost was reported in the value column while the run's
   * own column stood empty below the number. Rows are capped at three; a fourth
   * obstacle kind is information the delay log already carried in full during play.
   */
  private fillDelays(host: HTMLElement, r: ReceiptModel): void {
    host.replaceChildren();
    if (r.ledger.length === 0) {
      host.appendChild(
        this.pixel('div', 'beam-run__hint', COPY.win.delaysNone, {
          ...PX_TYPE.body,
          ...DIM_INK,
        }),
      );
      return;
    }
    host.appendChild(
      this.pixel('div', 'beam-run__receipt-title', COPY.win.delaysTitle, {
        ...PX_TYPE.caption,
        ...DIM_INK,
      }),
    );
    for (const row of r.ledger.slice(0, 3)) {
      host.appendChild(
        this.pixel(
          'div',
          'beam-run__hint',
          COPY.win.delayRow(row.label, row.count, row.months),
          { ...PX_TYPE.rowText, ...MUTED_INK, maxChars: 24 },
        ),
      );
    }
  }

  /**
   * The out-of-lives figure, per attempt: the months, their unit and the delay count.
   *
   * Everything else on the screen is constant, so it is painted once at build
   * time — a headline, a caption, an instruction and a button that never vary are not
   * per-attempt data, and treating them as such is how an earlier version ended up
   * repainting eight elements to change two numbers.
   */
  private renderGameOver(m: LifeLostModel): void {
    this.lostMonthsSr.textContent = `${m.delayMonths}`;
    paintPixelSvg(this.lostMonthsArt, [`${m.delayMonths}`], {
      ...PX_TYPE.figure,
      ...VALUE_INK,
    });
    // Singular exists: an assist run can end on one delay.
    const unit = COPY.win.monthsUnit(m.delayMonths);
    if (unit !== this.lostUnitText) {
      this.lostUnitText = unit;
      setPixelText(this.lostUnit, unit, { ...PX_TYPE.unitText, ...DIM_INK });
    }
    setPixelText(this.lostFrom, COPY.gameOver.fromDelays(m.delays), {
      ...PX_TYPE.rowText,
      ...DIM_INK,
      maxChars: 24,
    });
  }

  // --- builders -------------------------------------------------------------

  private overlayShell(modifiers: readonly string[] = [], label?: string): HTMLDivElement {
    const el = this.doc.createElement('div');
    el.className =
      'beam-run__overlay' + modifiers.map((m) => ` beam-run__overlay--${m}`).join('');
    // Every overlay is a dialog now, the briefing card included: it stops the run
    // and waits for a press, which is not what `role="status"` describes. Its own
    // accessible name is the stage it introduces, so it is set in `show()`.
    el.setAttribute('role', 'dialog');
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
    return this.pixelGrid(rows, engaged ? '#FF5400' : '#6E93A0');
  }

  /**
   * A hand-authored glyph as decorative pixel artwork: the receipt's two status marks
   * and the touch legend's jump disc. Anything the 5×7 font has no character for and
   * that must not come from the host's typeface goes through here.
   */
  private pixelGrid(rows: readonly string[], fill: string): SVGSVGElement {
    const svg = this.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const size = rows.length;
    svg.setAttribute('viewBox', `0 0 ${rows[0]!.length} ${size}`);
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
    path.setAttribute('fill', fill);
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
  private buildReceipt(context: CtaContext, delaysHost?: HTMLElement): ReceiptView {
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

    // The delays live inside the receipt unless the caller owns a place for them
    // (the win screen does — see `fillDelays`).
    const delays = delaysHost ?? this.h('div', 'beam-run__receipt-delays');
    // The hint sits UNDER the list, not between the heading and it. Both end screens
    // are two columns of "caption, then a block": with the hint in the middle the
    // right-hand block started a line and a half below the left-hand one, so the two
    // masses never lined up. As a footnote it also reads where it is acted on — the
    // rows are directly above it.
    root.append(title, list, hint);
    if (!delaysHost) root.appendChild(delays);
    return { root, rows, delays };
  }

  /**
   * The out-of-lives screen — three things and one route on one centre line, and the
   * only screen an attempt can end on other than the win receipt.
   *
   * What is *not* here is the design: no cause line ("the build stalled at
   * Compliance" — the player just watched it), no lives readout (there are none),
   * no itemised ledger (the same breakdown is on the closing receipt, and a table
   * here competed with the one sentence that matters), and no two-column split.
   * Everything is centred in one column and every element spans the same measure,
   * so the screen is symmetrical about its own axis.
   *
   * `role="alertdialog"`: something happened *to* the player and they have to
   * acknowledge it, which is exactly what that role is for.
   */
  private buildGameOver(): OverlayEntry {
    const el = this.overlayShell(['scene', 'gameover'], COPY.gameOver.title);
    el.setAttribute('role', 'alertdialog');
    const brand = createBrandLockup(this.doc, { compact: true });
    const stack = this.stack('gameover');

    const title = this.pixelTitle(COPY.gameOver.title, ['OUT OF', 'RUNWAY']);

    /*
     * THE ONE FIGURE, DRAWN AS A FIGURE (owner: this screen is not well designed and
     * the proportions need sorting out).
     *
     * It was four centred lines of ragged bitmap type stacked in the middle of an empty
     * frame — headline, a sentence ("3 DELAYS COST 6 MONTHS") at the same weight as
     * everything else, a two-line instruction, a cap — so nothing on it was loud and
     * nothing had mass. Same diagnosis the win screen was given two passes ago, and the
     * same fix, which is why this screen now borrows that screen's vocabulary outright:
     * a caption on its own line, then ONE PANEL (the receipt row's fill and rail) with
     * the months as a big orange numeral, the delay count as its small print and the
     * argument divided off under it.
     *
     * What that buys, in order of loudness: numeral, headline, argument, cap. The two
     * end screens now report the same fact in the same shape, which is worth more than
     * either of them being individually pretty.
     */
    const label = this.pixel('div', 'beam-run__months-label', COPY.gameOver.costLabel, {
      ...PX_TYPE.caption,
      ...DIM_INK,
    });
    const figure = this.h('div', 'beam-run__months');
    this.lostMonths = this.h('span', 'beam-run__months-value');
    this.lostMonthsSr = this.h('span', 'beam-run__sr', '0');
    this.lostMonthsArt = createPixelSvg(this.doc, ['0'], {
      ...PX_TYPE.figure,
      ...VALUE_INK,
    });
    this.lostMonths.append(this.lostMonthsSr, this.lostMonthsArt);
    this.lostUnit = this.h('span', 'beam-run__months-unit');
    figure.append(this.lostMonths, this.lostUnit);
    // Where the figure came from, at the size of small print, because it is.
    this.lostFrom = this.h('p', 'beam-run__matched');
    const advice = this.pixel('p', 'beam-run__advice', COPY.gameOver.advice, {
      ...PX_TYPE.body,
      ...MUTED_INK,
      maxChars: 26,
    });
    const cost = this.h('div', 'beam-run__cost');
    cost.append(figure, this.lostFrom, advice);

    // One route, and it is back into the game (owner call: no Navigator button on
    // the start screen, this one or the win receipt). The screen still is not a dead
    // end — it hands the player straight back to the stage that stopped them, with
    // the badge instruction on the card that follows — and the Navigator is still on
    // the pause menu and on every capability row of the closing receipt.
    const actions = this.h('div', 'beam-run__actions');
    const restart = this.btn(COPY.gameOver.restart, 'primary', () => this.cb.onContinue());
    actions.append(restart);

    stack.append(title, label, cost, actions);
    el.append(brand, stack);
    return { el, focusTarget: restart };
  }

  /**
   * The control legend: the actual **buttons**, drawn as 8-bit key caps, with a short
   * label beside each pair (owner call — "show the buttons instead of text", and the
   * fire button was missing).
   *
   * It replaced a written sentence, which is what this screen has now tried twice: a
   * legend was cut once for reading as a manual, and the sentence that came back read
   * as a footnote — and at 33 characters it rendered *wider than the headline above it*
   * on a phone. Caps solve both, because a cap is the size of its glyph rather than the
   * size of its explanation.
   *
   * Three groups, in the order the player needs them: move, jump, fire. The act button
   * is real and reachable from the first screen a badge arms it on, and leaving it out
   * meant the one control nobody can guess was the one nobody was told about.
   *
   * Accessibility: every cap is decorative artwork, and the whole row carries **one**
   * hidden sentence (`controlsKeys` / `controlsTap`). Per-cap labels would read out as
   * "left right move space jump f fire", which is not a sentence.
   */
  private buildLegend(): HTMLElement {
    const row = this.h('div', 'beam-run__keys');
    row.append(
      this.h(
        'span',
        'beam-run__sr',
        this.isTouch ? COPY.start.controlsTap : COPY.start.controlsKeys,
      ),
    );
    /*
     * Touch shows the pads it will actually draw over the game (see `TouchControls`):
     * two arrows, a big round jump and a **smaller** act button beside it. Keyboard
     * shows the keys. Same three groups either way.
     *
     * The act pad is a disc at a smaller size rather than a different glyph, and that
     * is the point: the first cut drew it as '>' — the *same* character the right-hand
     * move arrow uses — so the row read "> MOVE … > FIRE" and asked the player to tell
     * two identical glyphs apart. The real buttons separate on size and shape, so the
     * legend does too.
     */
    const groups: readonly [readonly (string | readonly string[])[], string, boolean][] =
      this.isTouch
        ? [
            [['<', '>'], COPY.start.legend.move, false],
            [[DOT_GLYPH], COPY.start.legend.jump, false],
            [[DOT_GLYPH], COPY.start.legend.fire, true],
          ]
        : [
            [['<', '>'], COPY.start.legend.move, false],
            [['SPACE'], COPY.start.legend.jump, false],
            [['F'], COPY.start.legend.fire, false],
          ];
    for (const [caps, label, small] of groups) {
      const group = this.h('div', 'beam-run__key-group');
      for (const cap of caps) {
        const key = this.h(
          'span',
          'beam-run__key' +
            (this.isTouch ? ' beam-run__key--pad' : '') +
            (small ? ' beam-run__key--small' : ''),
        );
        key.appendChild(
          typeof cap === 'string'
            ? createPixelSvg(this.doc, [cap], { ...PX_TYPE.key, ...TITLE_INK })
            : this.pixelGrid(cap, '#FFFFFF'),
        );
        group.appendChild(key);
      }
      // Decorative: the row's own hidden sentence is the accessible copy.
      group.appendChild(createPixelSvg(this.doc, [label], { ...PX_TYPE.keyLabel, ...DIM_INK }));
      row.appendChild(group);
    }
    return row;
  }

  private buildStart(): OverlayEntry {
    const el = this.overlayShell(['scene', 'start'], COPY.start.title);
    // Marquee: [sunburst] ANSRcade · MARKET ENTRY.
    const brand = createBrandLockup(this.doc, { title: COPY.meta.edition });
    const stack = this.stack('start');

    /*
     * The offer, and it is the headline now (owner call: the three-line hook — "Any
     * board can approve a GCC. / BUILDING IT / is the hard part." — is deleted, as the
     * dare and the 24-month statistic were before it). With nothing above it the
     * tagline is set as the `title`, which is also what gives it the orange value rule
     * underneath; at `caption` it was a subtitle to a headline that no longer exists.
     *
     * The two visual lines come from `wrapPixelLabel` at a 20-character measure rather
     * than being hand-split, so a copy change cannot silently produce a widow.
     */
    const tagline = createPixelHeading(
      this.doc,
      'h2',
      'beam-run__title',
      COPY.start.tagline,
      wrapPixelLabel(COPY.start.tagline, 20),
      { ...PX_TYPE.title, ...TITLE_INK },
    );
    // One route, and it is into the game (owner call). The "Skip to the Navigator"
    // ghost cap that sat here offered a busy executive a way out of a 90-second game
    // before they had seen a single screen of it; it is still on the pause menu, for
    // somebody who has started and wants out.
    const actions = this.h('div', 'beam-run__actions');
    const start = this.btn(COPY.start.play, 'primary', () => this.cb.onStart());
    actions.append(start);

    stack.append(tagline, this.buildLegend(), actions);
    el.append(brand, stack);
    return { el, focusTarget: start };
  }

  /**
   * The card between two screens — a **briefing**, and the one screen in the middle
   * of a run that waits for the player (owner call).
   *
   * Four things, top to bottom: the stage name, one line saying what the stage is,
   * the retry instruction when there is one, and the button that starts it. It used
   * to be the stage name alone, on a 1.2s timer — so the run walked into five
   * screens it had never explained, and the one line it did carry (the badge
   * instruction on a retry) had a second and a half to be read in. Nothing here
   * times out now: the brief is read at whatever pace it is read at, and the stage
   * begins on a press.
   *
   * `role="dialog"` rather than the old `status`: it is a stop, not a caption going
   * past, and focus goes to its button (see `show`), so Space and Enter activate it
   * without the card having to say so. **It does not say so**: a keyboard prompt line
   * under the cap was tried twice and cut both times — "Press SPACE to continue"
   * printed CONTINUE twice in a column, and "Or press SPACE" read as a second,
   * quieter button drawn on top of the first. See `COPY.titleCard.begin`.
   */
  private buildTitleCard(): OverlayEntry {
    const el = this.overlayShell(['titlecard']);
    const stack = this.stack('titlecard');
    // Rebuilt per screen (the label changes), so it keeps its own sr + art nodes.
    this.titleCardLabel = this.h('h2', 'beam-run__title');
    this.titleCardSr = this.h('span', 'beam-run__sr');
    this.titleCardArt = createPixelSvg(this.doc, [''], {
      ...PX_TYPE.title,
      ...TITLE_INK,
    });
    this.titleCardLabel.append(this.titleCardSr, this.titleCardArt);
    this.titleCardBrief = this.h('p', 'beam-run__brief');
    this.titleCardBrief.hidden = true;
    this.titleCardHint = this.h('p', 'beam-run__advice');
    this.titleCardHint.hidden = true;

    const actions = this.h('div', 'beam-run__actions');
    const begin = this.btn(COPY.titleCard.begin, 'primary', () => this.cb.onAdvance());
    actions.appendChild(begin);

    stack.append(this.titleCardLabel, this.titleCardBrief, this.titleCardHint, actions);
    el.appendChild(stack);
    return { el, focusTarget: begin };
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
    const clockLabel = this.pixel('span', 'beam-run__clock-label', COPY.win.lostLabel, {
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

  /*
   * `buildBars` used to be here: three comparison meters (your run · ANSR clients ·
   * going alone) that gave the run's absolute month total a meaning by charting it
   * between 11 and 24. Both of those references are out of the game (owner call —
   * `COPY.win.lostLabel`), and a chart of one bar against nothing is just the number
   * again, drawn wider. The closing figure is now the delay cost, which needs no
   * scale: zero is the reward and every step up from it was avoidable.
   */

  private buildWin(): OverlayEntry {
    const el = this.overlayShell(['scene', 'receipt', 'win'], COPY.win.title);
    const brand = createBrandLockup(this.doc, { compact: true });
    const card = this.stack('receipt');
    const title = this.pixelTitle(COPY.win.title, ['MARKET ENTRY', 'COMPLETE']);

    const label = this.pixel('div', 'beam-run__months-label', COPY.win.lostLabel, {
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

    // One line under the figure: a clean run, or the argument the figure is evidence
    // for. It stands where the "you matched the ANSR benchmark" line used to, and it
    // is the only prose left in this column now that the two attributed statistics
    // and the three comparison bars are gone.
    this.winVerdict = this.h('p', 'beam-run__matched');

    // The delay breakdown belongs to the figure, so it is built here and handed to
    // the receipt to fill. Left column: what the run cost. Right column: what ANSR
    // did. Before this the cost was printed under the capability rows, which put a
    // ledger in the value column and left the run's own column empty under its number.
    const delays = this.h('div', 'beam-run__receipt-delays');

    /*
     * The run's cost, as ONE block (owner: the closing screen is not symmetrical and
     * does not look designed).
     *
     * It was five centred lines of ragged bitmap type — caption, figure, unit, verdict,
     * then a heading and up to three delay rows — standing opposite four solid,
     * full-width receipt rows. Both columns were the same width and only one of them
     * had any mass in it, so the screen leaned right whatever the gaps did. The figure,
     * the verdict and the breakdown are the same fact at three levels of detail, so
     * they are one panel now, in the receipt row's own fill and rail: two blocks of
     * equal width, each under a caption on the same line, with the button centred under
     * both. The heading stays *outside* it, so the two captions align.
     */
    const cost = this.h('div', 'beam-run__cost');
    cost.append(figure, this.winVerdict, delays);
    this.winReceipt = this.buildReceipt('win', delays);

    // "Play again" is the only cap. The Navigator route is not a button on this
    // screen any more (owner call): it was one generic offer standing next to the
    // four capability rows, each of which is the same offer with a topic attached.
    // The rows carry the conversion, which is what `receiptHint` points at.
    const actions = this.h('div', 'beam-run__actions');
    const replay = this.btn(COPY.win.replay, 'primary', () => this.cb.onRestart());
    actions.append(replay);

    /*
     * Two columns on a wide frame (see styles.ts): the run's result on the left,
     * the receipt and its routes on the right. Stacked, this screen is ~890px of
     * content — taller than a 720px frame even before it was set in bitmap type —
     * so the CTA, which is the whole point of the screen, sat below the fold.
     * Side by side it fits with room, and the receipt reads beside the figure it
     * explains instead of underneath it. Narrow frames keep the single column.
     */
    card.append(title, this.columns([label, cost], [this.winReceipt.root]), actions);
    el.append(brand, card);
    // Focus lands on "Play again", the only cap on the screen. The receipt rows are
    // the conversion routes and they are reachable with one Tab from here.
    return { el, focusTarget: replay };
  }
}
