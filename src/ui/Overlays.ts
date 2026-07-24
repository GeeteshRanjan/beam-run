/**
 * Overlays — the real-DOM screens layered over the canvas: Start, title card,
 * Pause, Game Over and Win. Built as accessible dialogs (roles, labels, logical
 * focus) so the game is fully keyboard/screen-reader operable and never a dead
 * end — every overlay offers a route to the Navigator.
 */
import { COPY } from '../data/copy';

export type OverlayName = 'start' | 'titlecard' | 'pause' | 'gameover' | 'win';
export type CtaContext = 'win' | 'game_over' | 'skip';

export interface OverlayCallbacks {
  onStart: () => void;
  onSkip: () => void;
  onResume: () => void;
  onRestart: () => void;
  onCta: (context: CtaContext) => void;
  onToggleMute: () => void;
  onOpenAssist: () => void;
}

export interface OverlayData {
  levelLabel?: string;
  points?: number;
  isTouch?: boolean;
}

export interface OverlayOptions {
  /** When true the valuation count-up lands on its final value instantly. */
  reducedMotion?: boolean;
}

interface OverlayEntry {
  el: HTMLDivElement;
  focusTarget: HTMLElement;
}

/** Duration of the Company Valuation count-up on the win screen (seconds). */
export const VALUATION_COUNT_UP_S = 1.2;

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
  private valuationValue!: HTMLElement;

  private readonly reducedMotion: boolean;
  // Company Valuation count-up state (driven each frame by the Game).
  private valTarget = 0;
  private valElapsed = 0;
  private valAnimating = false;

  constructor(parent: HTMLElement, cb: OverlayCallbacks, opts: OverlayOptions = {}) {
    this.doc = parent.ownerDocument;
    this.cb = cb;
    this.reducedMotion = opts.reducedMotion ?? false;
    this.entries.set('start', this.buildStart());
    this.entries.set('titlecard', this.buildTitleCard());
    this.entries.set('pause', this.buildPause());
    this.entries.set('gameover', this.buildGameOver());
    this.entries.set('win', this.buildWin());
    for (const { el } of this.entries.values()) parent.appendChild(el);
  }

  get current(): OverlayName | null {
    return this._current;
  }

  show(name: OverlayName | null, data: OverlayData = {}): void {
    // Title-card label may change every time it is (re)shown per screen.
    if (name === 'titlecard' && data.levelLabel) {
      this.titleCardLabel.textContent = data.levelLabel;
    }
    if (this._current === name) return;
    this.hideAll();
    this._current = name;
    if (!name) return;
    // Kick off the valuation count-up only on the transition INTO the win screen.
    if (name === 'win' && typeof data.points === 'number') {
      this.startValuationCountUp(data.points);
    }
    const entry = this.entries.get(name);
    if (!entry) return;
    entry.el.classList.add('beam-run__overlay--visible');
    // Move focus to the primary control (title card is transient → skip focus).
    if (name !== 'titlecard') {
      entry.focusTarget.focus?.();
    }
  }

  /** Begin the Company Valuation count-up from 0 → target (instant if reduced-motion). */
  startValuationCountUp(target: number): void {
    this.valTarget = Math.max(0, Math.round(target));
    this.valElapsed = 0;
    if (this.reducedMotion || this.valTarget === 0) {
      this.valAnimating = false;
      this.renderValuation(this.valTarget);
    } else {
      this.valAnimating = true;
      this.renderValuation(0);
    }
  }

  /**
   * Advance the count-up by `dt` seconds. Driven by the Game's render loop so it
   * stays deterministic and needs no internal timer. No-op once complete.
   */
  advanceValuation(dt: number): void {
    if (!this.valAnimating) return;
    this.valElapsed += dt;
    const t = Math.min(1, this.valElapsed / VALUATION_COUNT_UP_S);
    const value = Math.round(this.valTarget * easeOutCubic(t));
    this.renderValuation(value);
    if (t >= 1) {
      this.valAnimating = false;
      this.renderValuation(this.valTarget); // guarantee the exact final figure
    }
  }

  /** Current displayed valuation (for tests). */
  get valuationDisplay(): number {
    return Number(this.valuationValue.textContent ?? '0');
  }

  private renderValuation(value: number): void {
    this.valuationValue.textContent = `${value}`;
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

  // --- builders -------------------------------------------------------------

  private overlayShell(modifier?: string, label?: string): HTMLDivElement {
    const el = this.doc.createElement('div');
    el.className = 'beam-run__overlay' + (modifier ? ` beam-run__overlay--${modifier}` : '');
    el.setAttribute('role', modifier === 'titlecard' ? 'status' : 'dialog');
    if (label) el.setAttribute('aria-label', label);
    return el;
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
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  private h(tag: string, cls: string, text?: string): HTMLElement {
    const el = this.doc.createElement(tag);
    el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  private buildStart(): OverlayEntry {
    const el = this.overlayShell(undefined, COPY.start.title);
    const title = this.h('h2', 'beam-run__title', COPY.start.title);
    const tagline = this.h('p', 'beam-run__subtitle', COPY.start.tagline);
    const controls = this.h('p', 'beam-run__hint', COPY.start.controlsDesktop);
    const time = this.h('p', 'beam-run__hint', COPY.meta.estimatedTime);
    const actions = this.h('div', 'beam-run__actions');
    const start = this.btn(COPY.start.play, 'primary', () => this.cb.onStart());
    const skip = this.btn(COPY.start.skip, 'ghost', () => this.cb.onSkip());
    actions.append(start, skip);
    el.append(title, tagline, controls, time, actions);
    return { el, focusTarget: start };
  }

  private buildTitleCard(): OverlayEntry {
    const el = this.overlayShell('titlecard');
    this.titleCardLabel = this.h('h2', 'beam-run__title', '');
    el.append(this.titleCardLabel);
    return { el, focusTarget: el };
  }

  private buildPause(): OverlayEntry {
    const el = this.overlayShell(undefined, COPY.pause.title);
    const title = this.h('h2', 'beam-run__title', COPY.pause.title);
    const actions = this.h('div', 'beam-run__actions');
    const resume = this.btn(COPY.pause.resume, 'primary', () => this.cb.onResume());
    const restart = this.btn(COPY.pause.restart, 'default', () => this.cb.onRestart());
    const assist = this.btn(COPY.pause.assist, 'default', () => this.cb.onOpenAssist());
    const mute = this.btn(COPY.pause.mute, 'default', () => this.cb.onToggleMute());
    const skip = this.btn(COPY.pause.skip, 'ghost', () => this.cb.onSkip());
    actions.append(resume, restart, assist, mute, skip);
    el.append(title, actions);
    return { el, focusTarget: resume };
  }

  private buildGameOver(): OverlayEntry {
    const el = this.overlayShell(undefined, COPY.gameOver.title);
    const title = this.h('h2', 'beam-run__title', COPY.gameOver.title);
    const subtitle = this.h('p', 'beam-run__subtitle', COPY.gameOver.subtitle);
    const actions = this.h('div', 'beam-run__actions');
    const retry = this.btn(COPY.gameOver.retry, 'default', () => this.cb.onRestart());
    const cta = this.btn(COPY.gameOver.cta, 'primary', () => this.cb.onCta('game_over'));
    actions.append(retry, cta);
    el.append(title, subtitle, actions);
    return { el, focusTarget: cta };
  }

  private buildWin(): OverlayEntry {
    const el = this.overlayShell(undefined, COPY.win.title);
    const title = this.h('h2', 'beam-run__title', COPY.win.title);
    const label = this.h('div', 'beam-run__valuation-label', COPY.win.valuationLabel);
    this.valuationValue = this.h('div', 'beam-run__valuation', '0');
    const unit = this.h('div', 'beam-run__hint', COPY.win.valuationUnit);
    const actions = this.h('div', 'beam-run__actions');
    const cta = this.btn(COPY.win.cta, 'primary', () => this.cb.onCta('win'));
    const replay = this.btn(COPY.win.replay, 'ghost', () => this.cb.onRestart());
    actions.append(cta, replay);
    el.append(title, label, this.valuationValue, unit, actions);
    return { el, focusTarget: cta };
  }
}
