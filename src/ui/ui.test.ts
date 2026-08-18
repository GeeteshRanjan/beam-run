import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hud, HUD_PX, HUD_PLAQUE_CHROME, pixelWidthPx } from './Hud';
import { Overlays, type LifeLostModel, type ReceiptModel } from './Overlays';
import { injectStyles, STYLE_ELEMENT_ID, CSS } from './styles';
import { COPY, CAPABILITIES } from '../data/copy';
import { SCREENS } from '../data/levels';
import { wrapPixelLabel } from './PixelType';
import { JOURNEY, LIVES } from '../data/tuning.config';
import { logPanelView, type SetbackLogEntry } from '../core/setbackLog';

function makeParent(): HTMLDivElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

/**
 * Every overlay lives in the same parent, so queries must be scoped to the one
 * currently on screen (win and summary both render a receipt).
 */
function visible(parent: HTMLElement): HTMLElement {
  const el = parent.querySelector<HTMLElement>('.beam-run__overlay--visible');
  if (!el) throw new Error('no overlay is visible');
  return el;
}

function buttons(parent: HTMLElement): HTMLButtonElement[] {
  return Array.from(visible(parent).querySelectorAll('button'));
}

function receipt(over: Partial<ReceiptModel> = {}): ReceiptModel {
  return {
    months: 14,
    benchmarkMonths: JOURNEY.ANSR_BENCHMARK_MONTHS,
    baselineMonths: JOURNEY.BASELINE_MONTHS,
    matchedBenchmark: false,
    setbacks: 2,
    delayMonths: 4,
    ledger: [
      { cause: 'fire', label: 'OFFER DECLINED', count: 1, months: 2 },
      { cause: 'gate', label: 'FILING REJECTED', count: 1, months: 2 },
    ],
    engaged: ['PLACE_TILE', 'EXTINGUISH'],
    reachedScreenName: 'Compliance',
    ...over,
  };
}

/** A delay log of `n` identical entries, for the HUD panel and the ledger. */
function log(n: number): SetbackLogEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    index: i + 1,
    screenId: 2,
    screenName: 'Hire Under Fire',
    cause: 'fire' as const,
    months: JOURNEY.SETBACK_MONTHS,
  }));
}

function hudModel(over: Partial<Parameters<Hud['update']>[0]> = {}) {
  return {
    levelLabel: 'x',
    months: 0,
    lives: LIVES.TOTAL,
    livesTotal: LIVES.TOTAL,
    log: logPanelView([], LIVES.LOG_VISIBLE_ROWS),
    power: null,
    ...over,
  };
}

function lifeLost(over: Partial<LifeLostModel> = {}): { lifeLost: LifeLostModel } {
  return {
    lifeLost: {
      cause: 'fire',
      monthsAdded: JOURNEY.SETBACK_MONTHS,
      livesLeft: 2,
      livesTotal: LIVES.TOTAL,
      screenName: 'Hire Under Fire',
      outOfLives: false,
      ledger: [{ cause: 'fire', label: 'OFFER DECLINED', count: 1, months: 2 }],
      delayMonths: 2,
      delays: 1,
      ...over,
    },
  };
}

describe('injectStyles', () => {
  it('injects the scoped stylesheet once', () => {
    injectStyles(document);
    injectStyles(document);
    expect(document.querySelectorAll(`#${STYLE_ELEMENT_ID}`).length).toBe(1);
  });

  it('animates the headline rule in discrete steps, not a smooth glide', () => {
    // The sweep is a block hopping along a track (8-bit), so it must be stepped;
    // an eased transform slide read as a modern-web gesture next to bitmap type.
    expect(CSS).toContain('animation: beam-run-sweep 2.8s steps(14, end) infinite alternate');
    expect(CSS).toContain('background-position-x');
    // …and it is disabled under reduced motion.
    expect(CSS).toMatch(/prefers-reduced-motion[\s\S]*beam-run__title::after \{ animation: none/);
  });
});

describe('Hud', () => {
  let parent: HTMLDivElement;
  let hud: Hud;
  beforeEach(() => {
    parent = makeParent();
    hud = new Hud(parent);
  });

  it('leads with the journey clock and labels it accessibly', () => {
    hud.setVisible(true);
    hud.update(hudModel({ levelLabel: 'Hire Under Fire', months: 8 }));
    const clock = parent.querySelector('.beam-run__hud-clock')!;
    expect(clock.querySelector('.beam-run__hud-clock-value')!.textContent).toBe('8');
    expect(clock.getAttribute('aria-label')).toContain('8');
    expect(clock.getAttribute('aria-label')).toContain(COPY.hud.monthsUnit);
    expect(parent.querySelector('.beam-run__hud-level')!.textContent).toContain('Hire Under Fire');
  });

  it('shows the lives as pips, distinguished by shape and not by colour', () => {
    hud.update(hudModel({ lives: 2 }));
    const lives = parent.querySelector('.beam-run__hud-lives')!;
    // The plaque reads "Lives: 2 of 3", not "Lives: 2 of 3 lives left".
    expect(lives.textContent).toContain(COPY.hud.livesValue(2, LIVES.TOTAL));
    expect(lives.getAttribute('aria-label')).toBe(
      `${COPY.hud.livesLabel}: ${COPY.hud.livesValue(2, LIVES.TOTAL)}`,
    );
    const pips = lives.querySelector('svg.beam-run__hud-lives-pips')!;
    // Two paths: held pips are solid, spent ones are hollow outlines. Both are
    // present, so the state is legible without reading the fills.
    const paths = Array.from(pips.querySelectorAll('path'));
    expect(paths).toHaveLength(2);
    expect(pips.getAttribute('aria-hidden')).toBe('true');
    // A full complement collapses to a single (solid) path.
    hud.update(hudModel({ lives: LIVES.TOTAL, months: 1 }));
    expect(pips.querySelectorAll('path')).toHaveLength(1);
  });

  it('hides the delay log until the first delay, then itemises and totals it', () => {
    const panel = parent.querySelector('.beam-run__hud-log')!;
    hud.update(hudModel());
    expect(panel.classList.contains('beam-run__hud-log--visible')).toBe(false);

    hud.update(hudModel({ months: 4, log: logPanelView(log(2), LIVES.LOG_VISIBLE_ROWS) }));
    expect(panel.classList.contains('beam-run__hud-log--visible')).toBe(true);
    expect(panel.querySelectorAll('.beam-run__hud-log-row')).toHaveLength(2);
    expect(panel.querySelectorAll('.beam-run__hud-log-row--earlier')).toHaveLength(0);
    // The running total is the finding, so it is what assistive tech is told.
    const total = 2 * JOURNEY.SETBACK_MONTHS;
    expect(panel.getAttribute('aria-label')).toContain(COPY.hud.logSummary(2, total));
    expect(panel.textContent).toContain(COPY.hud.logLabel);
  });

  it('bounds the log panel: older delays roll up instead of growing the frame', () => {
    const panel = parent.querySelector('.beam-run__hud-log')!;
    const n = LIVES.LOG_VISIBLE_ROWS + 3;
    hud.update(hudModel({ months: 12, log: logPanelView(log(n), LIVES.LOG_VISIBLE_ROWS) }));
    // Visible rows are capped, plus exactly one roll-up line for the rest.
    expect(panel.querySelectorAll('.beam-run__hud-log-row')).toHaveLength(
      LIVES.LOG_VISIBLE_ROWS + 1,
    );
    // ...exactly one of which is the roll-up for everything older.
    expect(panel.querySelectorAll('.beam-run__hud-log-row--earlier')).toHaveLength(1);
    // The total still counts every entry, not just the visible ones.
    expect(panel.getAttribute('aria-label')).toContain(
      COPY.hud.logSummary(n, n * JOURNEY.SETBACK_MONTHS),
    );
  });

  it('stacks the plaques in two corner columns so the log can grow', () => {
    // The log has no fixed height; anything anchored under it by a pixel offset
    // would collide the moment another delay was logged.
    expect(parent.querySelector('.beam-run__hud-stack--left .beam-run__hud-level')).not.toBeNull();
    expect(parent.querySelector('.beam-run__hud-stack--left .beam-run__hud-lives')).not.toBeNull();
    expect(parent.querySelector('.beam-run__hud-stack--left .beam-run__hud-power')).not.toBeNull();
    expect(parent.querySelector('.beam-run__hud-stack--right .beam-run__hud-clock')).not.toBeNull();
    expect(parent.querySelector('.beam-run__hud-stack--right .beam-run__hud-log')).not.toBeNull();
  });

  it('sets the stage and clock plaques in the bitmap font, not web type', () => {
    hud.update(hudModel({ levelLabel: 'Compliance Maze', months: 7 }));
    for (const sel of ['.beam-run__hud-level', '.beam-run__hud-clock']) {
      const row = parent.querySelector(sel)!;
      // Bitmap art present, and every glyph SVG is decorative.
      const art = Array.from(row.querySelectorAll('svg.beam-run__pixels'));
      expect(art.length).toBeGreaterThan(1);
      for (const svg of art) {
        expect(svg.getAttribute('aria-hidden')).toBe('true');
        expect(svg.querySelector('path')!.getAttribute('shape-rendering')).toBe('crispEdges');
        // Sized in frame units, never as a % of a shrink-wrapped plaque.
        expect(svg.getAttribute('style')).toContain('var(--beam-run-u)');
        expect(svg.getAttribute('style')).not.toContain('%');
      }
    }
    // The prose is still there for assistive tech / textContent.
    expect(parent.querySelector('.beam-run__hud-level')!.textContent).toContain('Compliance Maze');
    expect(parent.querySelector('.beam-run__hud-clock')!.textContent).toContain(
      COPY.hud.monthsLabel,
    );
  });

  it('draws the months counter zero-padded so the plaque cannot resize', () => {
    hud.update(hudModel({ months: 7 }));
    const art = parent.querySelector('.beam-run__hud-clock-value svg')!;
    const single = art.getAttribute('width');
    // Accessible value stays "7"; only the artwork is padded.
    expect(parent.querySelector('.beam-run__hud-clock-value')!.textContent).toBe('7');
    hud.update(hudModel({ months: 18 }));
    expect(art.getAttribute('width')).toBe(single);
  });

  it('keeps the stage and clock plaques apart on the narrowest phone frame', () => {
    // Bitmap glyphs bottom out at their floor on a narrow frame, so the two top
    // plaques are at their *widest, relative to the frame*, on a phone. They are
    // anchored to opposite corners of the same row: if the floors are raised
    // without checking this, they overlap (the long finale label did exactly
    // that before the HUD switched to the screen's place name).
    const longest = SCREENS.reduce((a, s) => (s.name.length > a.length ? s.name : a), '');
    // 280 = Galaxy Fold cover screen; 320 = iPhone SE 1st gen.
    for (const frame of [280, 320, 360, 390, 430, 560, 768, 1280]) {
      const gutter = Math.min(22, frame * 0.022) * 2;
      const stage = Math.max(
        pixelWidthPx(longest, HUD_PX.stage, frame),
        pixelWidthPx(COPY.hud.stageLabel, HUD_PX.caption, frame),
      );
      const clock = Math.max(
        pixelWidthPx(COPY.hud.monthsLabel, HUD_PX.caption, frame),
        pixelWidthPx('00', HUD_PX.months, frame) +
          7 +
          pixelWidthPx(COPY.hud.monthsUnit, HUD_PX.unit, frame),
      );
      const total = stage + clock + 2 * HUD_PLAQUE_CHROME + gutter;
      expect(total, `frame ${frame}px`).toBeLessThan(frame);

      // The lives pips and the widest delay-log row share a row of the frame too
      // (left stack against right stack), and the log rows are the widest strings
      // either column ever carries.
      const longestTag = Object.values(COPY.setback.tag).reduce(
        (a, n) => (n.length > a.length ? n : a),
        '',
      );
      const longestPower = Object.values(COPY.powers).reduce(
        (a, n) => (n.length > a.length ? n : a),
        '',
      );
      const left = Math.max(
        pixelWidthPx(COPY.hud.livesLabel, HUD_PX.caption, frame) +
          9 +
          pixelWidthPx('OOO', HUD_PX.lives, frame),
        pixelWidthPx('Talent500', HUD_PX.chip, frame),
        pixelWidthPx(longestPower, HUD_PX.chipSub, frame),
      );
      const logRow = Math.max(
        pixelWidthPx(COPY.hud.logRow(longestTag, 2), HUD_PX.logRow, frame),
        pixelWidthPx(`${COPY.hud.logTotal} ${COPY.hud.logMonths(22)}`, HUD_PX.logTotal, frame),
      );
      expect(
        left + logRow + 2 * HUD_PLAQUE_CHROME + gutter,
        `second row @ ${frame}px`,
      ).toBeLessThan(frame);
    }
  });

  it('wears the 8-bit plaque: solid fill, pixel bevel, hard rail, no radius', () => {
    expect(CSS).toContain('inset 3px 3px 0 rgba(150, 205, 218, 0.22)');
    expect(CSS).toContain('inset -3px -3px 0 rgba(0, 0, 0, 0.45)');
    expect(CSS).not.toMatch(/beam-run__hud-row[\s\S]*?border: 1px solid/);
    // The delay nudge holds each frame instead of easing between them.
    expect(CSS).toContain('animation: beam-run-bump 0.36s steps(1, end) both');
  });

  it('shows a persistent capability chip with no countdown bar', () => {
    const power = parent.querySelector('.beam-run__hud-power')!;
    hud.update(hudModel());
    expect(power.classList.contains('beam-run__hud-power--visible')).toBe(false);

    hud.update(hudModel({ power: { name: 'Roles filled', product: 'Talent500' } }));
    expect(power.classList.contains('beam-run__hud-power--visible')).toBe(true);
    expect(power.textContent).toContain('Talent500');
    // No timer bar exists any more: ANSR's help does not lapse mid-screen.
    expect(parent.querySelector('.beam-run__hud-power-bar')).toBeNull();
  });
});

describe('Overlays', () => {
  const cb = {
    onStart: vi.fn(),
    onSkip: vi.fn(),
    onResume: vi.fn(),
    onRestart: vi.fn(),
    onContinue: vi.fn(),
    onCta: vi.fn(),
    onToggleMute: vi.fn(),
    onOpenAssist: vi.fn(),
  };
  let parent: HTMLDivElement;
  let overlays: Overlays;

  beforeEach(() => {
    Object.values(cb).forEach((f) => f.mockReset());
    parent = makeParent();
    overlays = new Overlays(parent, cb);
  });

  it('shows one overlay at a time', () => {
    overlays.show('start');
    expect(overlays.current).toBe('start');
    expect(parent.querySelectorAll('.beam-run__overlay--visible').length).toBe(1);
    overlays.show('win', { receipt: receipt() });
    expect(overlays.current).toBe('win');
    expect(parent.querySelectorAll('.beam-run__overlay--visible').length).toBe(1);
  });

  it('leads the start screen with the 24-month stake, all in the bitmap font', () => {
    overlays.show('start');
    const stake = visible(parent).querySelector('.beam-run__stake')!;
    // Still exactly one clean sentence for assistive tech...
    expect(stake.textContent).toBe(COPY.start.stake(JOURNEY.BASELINE_MONTHS));
    // ...and three pixel lines on screen, with the figure at display size, so no
    // web typeface is mixed into the game's own type.
    expect(stake.querySelectorAll('svg.beam-run__pixels')).toHaveLength(3);
    expect(stake.querySelector('.beam-run__stake-figure svg')).not.toBeNull();
    // The three display lines must still read as the accessible sentence.
    const spoken = `${COPY.start.stakeLead} ${COPY.start.stakeFigure(
      JOURNEY.BASELINE_MONTHS,
    )} ${COPY.start.stakeTail}`;
    expect(spoken).toBe(COPY.start.stake(JOURNEY.BASELINE_MONTHS));
  });

  it('brands the start and end screens with the ANSRcade lockup', () => {
    overlays.show('start');
    const brand = visible(parent).querySelector('.beam-run__brand')!;
    expect(brand.getAttribute('role')).toBe('img');
    expect(brand.getAttribute('aria-label')).toContain(COPY.meta.name);
    expect(brand.querySelector('.beam-run__brand-word')!.textContent).toBe('ANSRcade');
    expect(brand.querySelector('.beam-run__brand-title')!.textContent).toBe(COPY.meta.edition);
    // The mark is the real logo path (not the old procedural ray ring), and it is
    // decorative — the lockup itself carries the accessible name.
    const mark = brand.querySelector('svg')!;
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(mark.querySelector('path')!.getAttribute('fill')).toBe('#f05722');
    expect(mark.querySelectorAll('line')).toHaveLength(0);
    expect(brand.textContent).toContain('ANSR');

    overlays.show('win', { receipt: receipt() });
    expect(visible(parent).querySelector('.beam-run__brand')).not.toBeNull();
  });

  it('sets every headline in the game\u2019s own bitmap font, text intact', () => {
    // No card, no web type: each title is decorative pixel art plus the real
    // sentence in a visually-hidden span (so textContent still reads as prose).
    overlays.show('start');
    const title = visible(parent).querySelector('.beam-run__title')!;
    expect(title.textContent).toBe(COPY.start.challenge);
    const art = title.querySelector('svg')!;
    expect(art.getAttribute('aria-hidden')).toBe('true');
    expect(art.querySelector('path')!.getAttribute('shape-rendering')).toBe('crispEdges');
    expect(parent.querySelector('.beam-run__panel')).toBeNull();

    overlays.show('titlecard', { levelLabel: 'Compliance' });
    expect(visible(parent).querySelector('.beam-run__title')!.textContent).toBe('Compliance');
  });

  it('sizes the closing figure in frame units, not off its own parent', () => {
    // The figure sits in a shrink-wrapping box, so a percentage cap has nothing
    // definite to measure and silently falls back to the SVG's intrinsic width —
    // which rendered the hero figure at the same size as the word beside it.
    overlays.show('win', { receipt: receipt({ months: 14 }) });
    const art = visible(parent).querySelector('.beam-run__months-value svg')!;
    const width = art.getAttribute('style') ?? '';
    expect(width).toContain('var(--beam-run-u)');
    expect(width).not.toContain('%');
    // …and it is set larger than the unit label next to it.
    const unit = visible(parent).querySelector('.beam-run__months-unit svg')!;
    const scale = (el: Element): number => {
      const w = Number(el.getAttribute('width'));
      const cols = Number(el.getAttribute('viewBox')!.split(' ')[2]);
      return w / cols; // authored-pixel size at intrinsic scale
    };
    expect(scale(art)).toBe(scale(unit)); // both at the default intrinsic scale…
    const share = (el: Element): number =>
      Number(/--beam-run-u\) \* ([\d.]+)/.exec(el.getAttribute('style') ?? '')![1]);
    // …so the difference must come from the frame-relative sizing, per glyph.
    const per = (el: Element): number =>
      share(el) / Number(el.getAttribute('viewBox')!.split(' ')[2]);
    expect(per(art)).toBeGreaterThan(per(unit) * 2);
  });

  it('draws the closing months figure as bitmap digits that follow the count-up', () => {
    overlays.show('win', { receipt: receipt({ months: 14 }) });
    const value = visible(parent).querySelector('.beam-run__months-value')!;
    expect(value.textContent).toBe('0');
    const before = value.querySelector('path')!.getAttribute('d');
    overlays.advanceMonths(5);
    expect(value.textContent).toBe('14');
    // The pixel art was repainted, not left showing the old figure.
    expect(value.querySelector('path')!.getAttribute('d')).not.toBe(before);
  });

  it('charts the run against both references, scaled to the going-alone baseline', () => {
    overlays.show('win', { receipt: receipt({ months: 12 }) });
    const win = visible(parent);
    const bars = win.querySelector('.beam-run__bars')!;
    // Decorative: the same facts are in the attributed ref lines below it.
    expect(bars.getAttribute('aria-hidden')).toBe('true');
    const value = (sel: string): number =>
      Number.parseInt(win.querySelector<HTMLElement>(sel)!.style.width, 10);

    // Baseline (24) is the full-width reference; ANSR's 11 is under half of it.
    expect(value('.beam-run__bar-fill--alone')).toBe(100);
    expect(value('.beam-run__bar-fill--ansr')).toBe(
      Math.round((JOURNEY.ANSR_BENCHMARK_MONTHS / JOURNEY.BASELINE_MONTHS) * 100),
    );
    // The player's bar tracks the count-up, so figure and picture always agree.
    expect(value('.beam-run__bar-fill--you')).toBe(4); // clamped floor at 0 months
    overlays.advanceMonths(5);
    expect(overlays.monthsDisplay).toBe(12);
    expect(value('.beam-run__bar-fill--you')).toBe(50);
    expect(win.querySelector('.beam-run__bar-value')!.textContent).toBe('12');
  });

  it('sets the whole end screen in the bitmap font, prose intact', () => {
    overlays.show('win', { receipt: receipt({ matchedBenchmark: true, months: 11 }) });
    const win = visible(parent);
    // Every readout on the screen: caption, unit, bar labels/values, the two
    // attributed refs, the clean-run line, the receipt and its rows.
    const selectors = [
      '.beam-run__months-label',
      '.beam-run__months-unit',
      '.beam-run__bar-label',
      '.beam-run__bar-value',
      '.beam-run__ref',
      '.beam-run__matched',
      '.beam-run__receipt-title',
      // The delay summary holds one line per obstacle, so this checks the first.
      '.beam-run__receipt-delays .beam-run__hint',
      '.beam-run__receipt-product',
      '.beam-run__receipt-stage',
      '.beam-run__receipt-detail',
    ];
    for (const sel of selectors) {
      const el = win.querySelector(sel)!;
      expect(el, sel).not.toBeNull();
      const svg = el.querySelector('svg.beam-run__pixels');
      expect(svg, sel).not.toBeNull();
      expect(svg!.getAttribute('aria-hidden'), sel).toBe('true');
      expect(svg!.querySelector('path')!.getAttribute('shape-rendering')).toBe('crispEdges');
      // The real string is still readable as text.
      expect(el.querySelector('.beam-run__sr')!.textContent, sel).toBe(el.textContent);
    }
    // No web-font text left in the content column outside hidden spans. (The
    // brand lockup is excluded on purpose: "ANSRcade" is set in the brand
    // typeface — changing brand typography is an owner call, not a style fix.)
    const stray = Array.from(win.querySelector('.beam-run__stack')!.querySelectorAll('*')).filter(
      (n) =>
        !n.classList.contains('beam-run__sr') &&
        !n.closest('.beam-run__sr') &&
        Array.from(n.childNodes).some(
          (c) => c.nodeType === 3 && (c.textContent ?? '').trim() !== '',
        ),
    );
    expect(stray.map((n) => n.className)).toEqual([]);
  });

  it('marks a reached stage with a drawn glyph, not a font character', () => {
    overlays.show('win', { receipt: receipt({ engaged: ['PLACE_TILE'] }) });
    const marks = Array.from(visible(parent).querySelectorAll('.beam-run__receipt-mark'));
    expect(marks).toHaveLength(CAPABILITIES.length);
    const fills = marks.map((m) => m.querySelector('path')!.getAttribute('fill'));
    // One engaged (value orange), the rest the neutral hollow box.
    expect(fills.filter((f) => f === '#FF5400')).toHaveLength(1);
    expect(fills.filter((f) => f !== '#FF5400')).toHaveLength(CAPABILITIES.length - 1);
    // Shape carries the meaning: the two glyphs have different geometry.
    const engagedD = marks[0]!.querySelector('path')!.getAttribute('d');
    const dimD = marks[1]!.querySelector('path')!.getAttribute('d');
    expect(engagedD).not.toBe(dimD);
  });

  it('splits the end screens in two so the CTA is never below the fold', () => {
    for (const screen of ['win', 'summary'] as const) {
      overlays.show(screen, { receipt: receipt() });
      const cols = visible(parent).querySelector('.beam-run__cols')!;
      expect(cols, screen).not.toBeNull();
      expect(cols.children, screen).toHaveLength(2);
      // The receipt is the right-hand column…
      const aside = cols.querySelector('.beam-run__col--aside')!;
      expect(aside.querySelector('.beam-run__receipt'), screen).not.toBeNull();
      // …and the buttons span the whole screen under both columns, centred, so
      // the composition stays on one centre line (a CTA tucked under the right
      // half made the screen lopsided).
      const stack = visible(parent).querySelector('.beam-run__stack')!;
      const actions = stack.querySelector('.beam-run__actions')!;
      expect(actions.parentElement, screen).toBe(stack);
      expect(cols.querySelector('.beam-run__actions'), screen).toBeNull();
    }
    // Side by side only where the frame can carry it; stacked below that.
    expect(CSS).toContain('@container (min-width: 900px)');
    expect(CSS).toMatch(/\.beam-run__cols \{ flex-direction: row/);
  });

  it('keeps apostrophes out of copy that gets set in the bitmap font', () => {
    // The 5×7 font has no apostrophe, so it is dropped: "ANSR's" rendered as
    // "ANSRS" and read like a typo. Any string drawn as pixels must avoid one.
    const drawn = [
      COPY.win.title,
      COPY.win.monthsLabel,
      COPY.win.matched,
      COPY.win.receiptTitle,
      COPY.win.receiptHint,
      COPY.win.benchmark(11),
      COPY.win.baseline(24),
      COPY.win.delaysNone,
      COPY.win.delays(2, 4),
      COPY.win.delayRow('RED TAPE', 2, 4),
      COPY.win.savesMonths(4),
      COPY.win.notReached,
      COPY.win.barYou,
      COPY.win.barAnsr,
      COPY.win.barAlone,
      COPY.win.cta,
      COPY.win.ctaGap,
      COPY.win.replay,
      COPY.summary.title,
      COPY.summary.reached('Compliance'),
      COPY.summary.cta,
      COPY.summary.resume,
      COPY.start.play,
      COPY.start.skip,
      COPY.start.challenge,
      COPY.start.stakeLead,
      COPY.start.stakeTail,
      COPY.lifeLost.title,
      COPY.lifeLost.cause('RED TAPE'),
      COPY.lifeLost.cost(2),
      COPY.lifeLost.livesLeft(2),
      COPY.lifeLost.advice,
      COPY.lifeLost.cont,
      COPY.gameOver.title,
      COPY.gameOver.reached('Compliance'),
      COPY.gameOver.ledgerTitle,
      COPY.gameOver.totalLabel,
      COPY.gameOver.cost(3, 6),
      COPY.gameOver.advice,
      COPY.gameOver.restart,
      COPY.hud.logLabel,
      COPY.hud.logTotal,
      COPY.hud.livesLabel,
      ...Object.values(COPY.setback.tag),
      ...Object.values(COPY.pause),
      ...CAPABILITIES.flatMap((c) => [c.product, c.stage]),
    ];
    for (const s of drawn) {
      expect(s, s).not.toMatch(/['\u2018\u2019]/);
    }
  });

  it('reports the delay, the lives left and the one instruction on a lost life', () => {
    overlays.show('lifelost', lifeLost());
    const el = visible(parent);
    expect(overlays.current).toBe('lifelost');
    expect(el.getAttribute('role')).toBe('alertdialog');
    expect(el.textContent).toContain(COPY.lifeLost.cause('OFFER DECLINED'));
    expect(el.textContent).toContain(COPY.lifeLost.cost(JOURNEY.SETBACK_MONTHS));
    // The instruction is the point of the screen.
    expect(el.querySelector('.beam-run__advice')!.textContent).toBe(COPY.lifeLost.advice);
    expect(el.textContent).toContain(COPY.hud.lives(2, LIVES.TOTAL));
    // Mid-attempt there is no ledger: it would bury the instruction.
    expect((el.querySelector('.beam-run__ledger') as HTMLElement).hidden).toBe(true);
    // One route out, and it is not the Navigator yet.
    const btns = buttons(parent).filter((b) => !b.hidden);
    expect(btns).toHaveLength(1);
    btns[0]!.click();
    expect(cb.onContinue).toHaveBeenCalled();
  });

  it('turns into the itemised ledger, not a wall, on the last life', () => {
    overlays.show(
      'lifelost',
      lifeLost({
        livesLeft: 0,
        outOfLives: true,
        delays: 3,
        delayMonths: 6,
        ledger: [
          { cause: 'fire', label: 'OFFER DECLINED', count: 2, months: 4 },
          { cause: 'fall', label: 'GROUND GAVE WAY', count: 1, months: 2 },
        ],
      }),
    );
    const el = visible(parent);
    expect(el.textContent).toContain(COPY.gameOver.title);
    expect(el.textContent).toContain(COPY.gameOver.reached('Hire Under Fire'));
    // Every obstacle itemised, repeats grouped, and a total.
    const ledger = el.querySelector('.beam-run__ledger') as HTMLElement;
    expect(ledger.hidden).toBe(false);
    // Two obstacle rows plus the total, which is the same row with the accent.
    expect(
      ledger.querySelectorAll('.beam-run__ledger-row:not(.beam-run__ledger-row--total)'),
    ).toHaveLength(2);
    expect(ledger.textContent).toContain('OFFER DECLINED x2');
    expect(ledger.querySelector('.beam-run__ledger-row--total')!.textContent).toContain('+6');
    // ...followed by the argument the ledger is evidence for.
    expect(el.querySelector('.beam-run__advice')!.textContent).toBe(COPY.gameOver.advice);
    // Not a dead end: back to the start AND a route to the Navigator.
    const btns = buttons(parent).filter((b) => !b.hidden);
    expect(btns).toHaveLength(2);
    expect(btns[0]!.textContent).toBe(COPY.gameOver.restart);
    btns[1]!.click();
    expect(cb.onCta).toHaveBeenCalledWith('summary');
  });

  it('sizes every readout on the life-lost screen in frame units', () => {
    // The trap this guards: a PixelSpec without `maxShare` falls back to the
    // default `min(96%, …)` cap, which is circular inside a shrink-wrapping flex
    // box — the browser then silently uses the SVG's intrinsic width and the
    // element renders at a fraction of its intended size.
    overlays.show(
      'lifelost',
      lifeLost({ outOfLives: true, livesLeft: 0, delays: 2, delayMonths: 4 }),
    );
    // The lives pips are the one exception: they are hand-built art sized by the
    // stylesheet, so their frame-unit cap is asserted against the CSS instead.
    expect(CSS).toMatch(/\.beam-run__lives-pips \{ width: clamp\([^)]*var\(--beam-run-u\)/);
    const art = Array.from(
      visible(parent).querySelectorAll<SVGSVGElement>(
        '.beam-run__stack svg.beam-run__pixels:not(.beam-run__lives-pips)',
      ),
    );
    expect(art.length).toBeGreaterThan(5);
    for (const svg of art) {
      const style = svg.getAttribute('style') ?? '';
      expect(style, svg.parentElement?.className).toContain('var(--beam-run-u)');
      expect(style, svg.parentElement?.className).not.toContain('%');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('repaints the life-lost screen for each new delay', () => {
    overlays.show('lifelost', lifeLost());
    overlays.show('titlecard', { levelLabel: 'Compliance' });
    overlays.show('lifelost', lifeLost({ cause: 'gate', livesLeft: 1 }));
    const el = visible(parent);
    expect(el.textContent).toContain(COPY.lifeLost.cause('FILING REJECTED'));
    expect(el.textContent).toContain(COPY.hud.lives(1, LIVES.TOTAL));
  });

  it('itemises the run\u2019s delays on the closing receipt', () => {
    overlays.show('win', { receipt: receipt() });
    const delays = visible(parent).querySelector('.beam-run__receipt-delays')!;
    expect(delays.textContent).toContain(COPY.win.delays(2, 4));
    expect(delays.textContent).toContain('OFFER DECLINED');
    // A clean run gets the credit instead.
    overlays.show('start');
    overlays.show('win', { receipt: receipt({ setbacks: 0, delayMonths: 0, ledger: [] }) });
    expect(
      visible(parent).querySelector('.beam-run__receipt-delays')!.textContent,
    ).toContain(COPY.win.delaysNone);
  });

  it('counts the months up from 0 to the final figure', () => {
    overlays.show('win', { receipt: receipt({ months: 14 }) });
    expect(overlays.monthsDisplay).toBe(0);
    overlays.advanceMonths(0.3);
    const mid = overlays.monthsDisplay;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(14);
    overlays.advanceMonths(2); // past the count-up duration
    expect(visible(parent).querySelector('.beam-run__months-value')!.textContent).toBe('14');
    overlays.advanceMonths(1); // no-op once complete
    expect(overlays.monthsDisplay).toBe(14);
  });

  it('reduced-motion shows the final figure instantly (no count-up)', () => {
    const rm = new Overlays(makeParent(), cb, { reducedMotion: true });
    rm.show('win', { receipt: receipt({ months: 11 }) });
    expect(rm.monthsDisplay).toBe(11);
    rm.advanceMonths(0.1);
    expect(rm.monthsDisplay).toBe(11);
  });

  it('states ANSR\u2019s benchmark and the going-alone baseline as attributed facts', () => {
    overlays.show('win', { receipt: receipt() });
    const refs = Array.from(visible(parent).querySelectorAll('.beam-run__ref')).map(
      (n) => n.textContent,
    );
    expect(refs[0]).toContain(String(JOURNEY.ANSR_BENCHMARK_MONTHS));
    expect(refs[1]).toContain(String(JOURNEY.BASELINE_MONTHS));
  });

  it('calls out a clean run and swaps to the plain CTA', () => {
    overlays.show('win', { receipt: receipt({ matchedBenchmark: true, months: 11 }) });
    const matched = visible(parent).querySelector('.beam-run__matched') as HTMLElement;
    expect(matched.hidden).toBe(false);
    expect(matched.textContent).toBe(COPY.win.matched);
    const cta = buttons(parent).find((b) => b.classList.contains('beam-run__btn--primary'))!;
    expect(cta.textContent).toBe(COPY.win.cta);
  });

  it('offers the gap-closing CTA when the run was not clean', () => {
    overlays.show('win', { receipt: receipt({ matchedBenchmark: false }) });
    const cta = buttons(parent).find((b) => b.classList.contains('beam-run__btn--primary'))!;
    expect(cta.textContent).toBe(COPY.win.ctaGap);
  });

  it('marks engaged capabilities and leaves unreached ones dim but clickable', () => {
    overlays.show('win', { receipt: receipt({ engaged: ['PLACE_TILE'] }) });
    const rows = Array.from(
      visible(parent).querySelectorAll<HTMLButtonElement>('.beam-run__receipt-row'),
    );
    expect(rows).toHaveLength(CAPABILITIES.length);
    const engaged = rows.filter((r) => r.classList.contains('beam-run__receipt-row--engaged'));
    expect(engaged).toHaveLength(1);
    expect(engaged[0]!.textContent).toContain('1Wrk');
    expect(engaged[0]!.textContent).toContain(COPY.win.savesMonths(4));
    const dim = rows.find((r) => !r.classList.contains('beam-run__receipt-row--engaged'))!;
    expect(dim.textContent).toContain(COPY.win.notReached);
    expect(dim.disabled).toBe(false);
  });

  it('each capability row is its own Navigator route carrying a declared topic', () => {
    overlays.show('win', { receipt: receipt() });
    const rows = Array.from(
      visible(parent).querySelectorAll<HTMLButtonElement>('.beam-run__receipt-row'),
    );
    rows[2]!.click(); // GCC-BOT
    expect(cb.onCta).toHaveBeenCalledWith('win', CAPABILITIES[2]!.topic);
  });

  it('the mid-run summary reports where you got to and still routes onward', () => {
    overlays.show('summary', { receipt: receipt({ reachedScreenName: 'Compliance' }) });
    expect(visible(parent).querySelector('.beam-run__subtitle')!.textContent).toContain(
      'Compliance',
    );
    const cta = buttons(parent).find((b) => b.textContent === COPY.summary.cta)!;
    cta.click();
    expect(cb.onCta).toHaveBeenCalledWith('summary');
  });

  it('wires the Start button and the skip route', () => {
    overlays.show('start');
    buttons(parent).find((b) => b.textContent === COPY.start.play)!.click();
    expect(cb.onStart).toHaveBeenCalledOnce();
    buttons(parent).find((b) => b.textContent === COPY.start.skip)!.click();
    expect(cb.onSkip).toHaveBeenCalledOnce();
  });

  it('sets every button label in the bitmap font, wrapped, text intact', () => {
    for (const screen of ['start', 'win', 'summary', 'pause'] as const) {
      overlays.show(screen, { receipt: receipt() });
      // The action caps. (Receipt rows are a three-column data list, not caps,
      // and stay in web type so the numbers read as facts.)
      const caps = buttons(parent).filter((b) => b.classList.contains('beam-run__btn'));
      expect(caps.length).toBeGreaterThan(0);
      for (const b of caps) {
        const svg = b.querySelector('svg.beam-run__pixels');
        expect(svg, `${screen}: ${b.textContent}`).not.toBeNull();
        // Decorative artwork; the real string stays in a hidden span, so the
        // label still reads as prose for assistive tech and for these tests.
        expect(svg!.getAttribute('aria-hidden')).toBe('true');
        expect(b.querySelector('.beam-run__sr')!.textContent).toBe(b.textContent);
        // No stray text node next to the artwork.
        expect(b.childNodes).toHaveLength(2);
        // Sized in frame units so a shrink-wrapping cap can't size itself.
        expect(svg!.getAttribute('style')).toContain('var(--beam-run-u)');
        expect(svg!.getAttribute('style')).not.toContain('%');
      }
    }
    // Long CTA copy wraps instead of overflowing, and the arrow folds to '>'.
    const lines = wrapPixelLabel(COPY.win.cta);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => l.length <= 26)).toBe(true);
    expect(lines.join(' ')).toContain('NAVIGATOR');
    expect(wrapPixelLabel(COPY.start.play)).toEqual(['START']);
  });

  it('keeps the title screen to the stake, the challenge and the two routes', () => {
    overlays.show('start');
    const start = visible(parent);
    // No control legend and no run-length estimate (owner call): a title screen
    // that explains the arrow keys reads as a manual.
    expect(start.querySelectorAll('.beam-run__hint')).toHaveLength(0);
    expect(start.textContent).not.toContain(COPY.meta.estimatedTime);
    expect(start.textContent).not.toContain(COPY.start.controlsDesktop);
    // The controls still reach screen-reader users via the canvas description.
    expect(COPY.a11y.canvasLabel).toContain('Space');
    expect(buttons(parent)).toHaveLength(2);
  });
});
