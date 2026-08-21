import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hud, HUD_PX, HUD_PLAQUE_CHROME, pixelWidthPx } from './Hud';
import { pixelArtWidthPx } from './Hud';
import { pipCells, PIP_W, PIP_H } from './LivesPips';
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
      { cause: 'monster', label: 'QUERY RAISED', count: 1, months: 2 },
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
    lives: LIVES.TOTAL,
    livesTotal: LIVES.TOTAL,
    log: logPanelView([], LIVES.LOG_VISIBLE_ROWS),
    power: null,
    ...over,
  };
}

function lifeLost(over: Partial<LifeLostModel> = {}): { lifeLost: LifeLostModel } {
  return { lifeLost: { delays: 3, delayMonths: 6, ...over } };
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

  it('carries no TIME TO MARKET plaque at all', () => {
    // Owner call: the clock was the loudest thing on the frame and only moved when
    // a delay was booked — which the log below it reports, with the reason. The
    // months live on the closing receipt now, and lives took the plaque.
    hud.setVisible(true);
    hud.update(hudModel({ levelLabel: 'Hire Under Fire' }));
    expect(parent.querySelector('.beam-run__hud-clock')).toBeNull();
    expect(CSS).not.toContain('beam-run__hud-clock');
    expect(parent.querySelector('.beam-run__hud')!.textContent).not.toContain('Time to market');
    expect(parent.querySelector('.beam-run__hud-level')!.textContent).toContain('Hire Under Fire');
  });

  it('shows the lives as hearts, distinguished by shape and not by colour', () => {
    hud.update(hudModel({ lives: 2 }));
    const lives = parent.querySelector('.beam-run__hud-lives')!;
    // The plaque reads "Lives: 2 of 3", not "Lives: 2 of 3 lives left".
    expect(lives.textContent).toContain(COPY.hud.livesValue(2, LIVES.TOTAL));
    expect(lives.getAttribute('aria-label')).toBe(
      `${COPY.hud.livesLabel}: ${COPY.hud.livesValue(2, LIVES.TOTAL)}`,
    );
    const pips = lives.querySelector('svg.beam-run__hud-lives-pips')!;
    // Two paths: held lives are solid hearts, spent ones the same heart hollowed
    // out. Both are present, so the state is legible without reading the fills.
    const paths = Array.from(pips.querySelectorAll('path'));
    expect(paths).toHaveLength(2);
    expect(pips.getAttribute('aria-hidden')).toBe('true');
    // The glyph is a heart, not the old square pip: 7 cells wide, 6 tall.
    expect(pips.getAttribute('viewBox')).toBe(`0 0 ${pipCells(LIVES.TOTAL)} ${PIP_H}`);
    expect(PIP_W).toBe(7);
    // A full complement collapses to a single (solid) path.
    hud.update(hudModel({ lives: LIVES.TOTAL }));
    expect(pips.querySelectorAll('path')).toHaveLength(1);
  });

  it('nudges the lives plaque when a heart goes out, and only then', () => {
    // The beat the clock's bump used to carry. It must fire on a life *spent*, not
    // on the reset back to a full complement at the start of the next attempt.
    const lives = parent.querySelector('.beam-run__hud-lives')!;
    hud.update(hudModel({ lives: LIVES.TOTAL }));
    expect(lives.classList.contains('beam-run__hud-lives--spent')).toBe(false);
    hud.update(hudModel({ lives: LIVES.TOTAL - 1 }));
    expect(lives.classList.contains('beam-run__hud-lives--spent')).toBe(true);
    hud.update(hudModel({ lives: LIVES.TOTAL }));
    expect(lives.classList.contains('beam-run__hud-lives--spent')).toBe(false);
  });

  it('hides the delay log until the first delay, then itemises and totals it', () => {
    const panel = parent.querySelector('.beam-run__hud-log')!;
    hud.update(hudModel());
    expect(panel.classList.contains('beam-run__hud-log--visible')).toBe(false);

    hud.update(hudModel({ log: logPanelView(log(2), LIVES.LOG_VISIBLE_ROWS) }));
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
    hud.update(hudModel({ log: logPanelView(log(n), LIVES.LOG_VISIBLE_ROWS) }));
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
    // would collide the moment another delay was logged. Lives sit above it in the
    // right column now (the clock's old slot), so the two read as cause and cost.
    expect(parent.querySelector('.beam-run__hud-stack--left .beam-run__hud-level')).not.toBeNull();
    expect(parent.querySelector('.beam-run__hud-stack--left .beam-run__hud-power')).not.toBeNull();
    expect(parent.querySelector('.beam-run__hud-stack--right .beam-run__hud-lives')).not.toBeNull();
    expect(parent.querySelector('.beam-run__hud-stack--right .beam-run__hud-log')).not.toBeNull();
    expect(parent.querySelector('.beam-run__hud-stack--left .beam-run__hud-lives')).toBeNull();
  });

  it('sets the stage and lives plaques in the bitmap font, not web type', () => {
    hud.update(hudModel({ levelLabel: 'Compliance Maze', lives: 2 }));
    for (const sel of ['.beam-run__hud-level', '.beam-run__hud-lives']) {
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
    expect(parent.querySelector('.beam-run__hud-lives')!.textContent).toContain(
      COPY.hud.livesLabel,
    );
  });

  it('keeps the lives plaque the same width as lives are spent', () => {
    // The right-hand plaque is anchored to the frame edge, so a readout that
    // narrowed as it changed would slide the whole stack. Spent lives are drawn as
    // hollow hearts rather than dropped, which is what keeps the width fixed.
    hud.update(hudModel({ lives: LIVES.TOTAL }));
    const art = parent.querySelector('.beam-run__hud-lives-pips')!;
    const full = art.getAttribute('viewBox');
    hud.update(hudModel({ lives: 0 }));
    expect(art.getAttribute('viewBox')).toBe(full);
    expect(art.querySelectorAll('path')).toHaveLength(1); // all hollow
  });

  it('keeps the stage and lives plaques apart on the narrowest phone frame', () => {
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
      const lives = Math.max(
        pixelWidthPx(COPY.hud.livesLabel, HUD_PX.caption, frame),
        // The hearts are hand-built art, so they are measured in authored cells.
        pixelArtWidthPx(pipCells(LIVES.TOTAL), HUD_PX.lives, frame),
      );
      const total = stage + lives + 2 * HUD_PLAQUE_CHROME + gutter;
      expect(total, `frame ${frame}px`).toBeLessThan(frame);

      // The capability chip and the widest delay-log row share the second row of
      // the frame (left stack against right stack), and the log rows are the widest
      // strings either column ever carries.
      const longestTag = Object.values(COPY.setback.tag).reduce(
        (a, n) => (n.length > a.length ? n : a),
        '',
      );
      const longestPower = Object.values(COPY.powers).reduce(
        (a, n) => (n.length > a.length ? n : a),
        '',
      );
      const left = Math.max(
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
    // The lost-life nudge holds each frame instead of easing between them.
    expect(CSS).toContain('animation: beam-run-spent 0.36s steps(1, end) both');
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
    onAdvance: vi.fn(),
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
      COPY.lifeLost.retryHint,
      COPY.titleCard.begin,
      ...Object.values(COPY.titleCard.brief),
      COPY.gameOver.title,
      COPY.gameOver.cost(3, 6),
      COPY.gameOver.advice,
      COPY.gameOver.restart,
      COPY.gameOver.cta,
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

  it('has no life-lost screen at all — a lost life is not a dialog', () => {
    // Owner call: with lives left the stage just starts again. The overlay that
    // used to coach mid-attempt is gone, and so is its name.
    expect(parent.querySelector('.beam-run__overlay--lifelost')).toBeNull();
    // Six surfaces left: start, titlecard, pause, gameover, summary, win.
    expect(parent.querySelectorAll('.beam-run__overlay')).toHaveLength(6);
  });

  it('carries the badge instruction on a retry title card, and only there', () => {
    // The one thing the deleted life-lost screen said that mattered.
    overlays.show('titlecard', { levelLabel: 'Compliance' });
    const hint = visible(parent).querySelector('.beam-run__advice') as HTMLElement;
    expect(hint.hidden).toBe(true);
    overlays.show('start');
    overlays.show('titlecard', { levelLabel: 'Compliance', hint: COPY.lifeLost.retryHint });
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toBe(COPY.lifeLost.retryHint);
  });

  it('briefs the stage ahead and waits for a press', () => {
    // Owner call: stop before every screen, say in brief what it is, and go on only
    // when the player presses. So the card carries a line about the stage and a
    // control that starts it — it is not a caption on a timer any more.
    const brief = COPY.titleCard.brief[2]!;
    overlays.show('titlecard', { levelLabel: 'Compliance', brief });
    const card = visible(parent);
    // A stop, not a status message going past.
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-label')).toContain(brief);
    // The brief is bitmap art plus the real sentence, like every other line.
    const line = card.querySelector('.beam-run__brief') as HTMLElement;
    expect(line.hidden).toBe(false);
    expect(line.textContent).toBe(brief);
    expect(line.querySelector('svg.beam-run__pixels')!.getAttribute('aria-hidden')).toBe('true');
    // Exactly one control, and nothing under it. A keyboard prompt line was tried
    // twice ("Press SPACE to continue", then "Or press SPACE") and cut both times:
    // the first printed CONTINUE twice in a column, the second read as a second
    // quieter button drawn on the first. The card focuses the cap, so Space and
    // Enter already work without being told.
    const btns = buttons(parent);
    expect(btns).toHaveLength(1);
    expect(btns[0]!.textContent).toBe(COPY.titleCard.begin);
    expect(card.querySelector('.beam-run__hint')).toBeNull();
    expect(card.textContent).not.toMatch(/SPACE/i);
    btns[0]!.click();
    expect(cb.onAdvance).toHaveBeenCalled();
    // The button takes focus: the card is waiting on it, so a keyboard player must
    // land there without hunting for it.
    expect(parent.ownerDocument.activeElement).toBe(btns[0]);
  });

  it('hides the brief line on a screen that has none, rather than printing a blank', () => {
    overlays.show('titlecard', { levelLabel: 'Compliance' });
    const line = visible(parent).querySelector('.beam-run__brief') as HTMLElement;
    expect(line.hidden).toBe(true);
    expect(line.textContent).toBe('');
  });

  it('briefs every screen in the game, in type the 5x7 font can draw', () => {
    // A card with no line on it is the old title card back again, so this is a
    // completeness check rather than a copy check: every screen gets a brief, and
    // each one fits the card at body size.
    for (const screen of SCREENS) {
      const brief = COPY.titleCard.brief[screen.id];
      expect(brief, `screen ${screen.id}`).toBeTruthy();
      expect(brief!, `screen ${screen.id}`).not.toMatch(/['\u2018\u2019]/);
      // A brief names the problem, never the product: the receipt is where ANSR
      // gets to answer, and a pitch on the way into a stage is an advert.
      for (const cap of CAPABILITIES) {
        expect(brief!.toLowerCase(), `screen ${screen.id}`).not.toContain(
          cap.product.toLowerCase(),
        );
      }
      // …and it never echoes a word from the stage name printed directly above it.
      // The raster caught this twice: COMPLIANCE over "compliance does not run in a
      // straight line", WORKPLACE over "the workplace is not".
      const label = (screen.copy?.titleCard ?? screen.name).toUpperCase();
      for (const word of label.replace(/[^A-Z ]/g, ' ').split(/\s+/)) {
        if (word.length <= 3) continue; // THE, AND, a dash
        expect(brief!.toUpperCase(), `screen ${screen.id} echoes "${word}"`).not.toContain(word);
      }
      // Two bitmap lines at the card's 26-character measure, and balanced ones: a
      // third line is always a one-word widow over the button, and the point of a
      // brief is that it is brief.
      const lines = wrapPixelLabel(brief!, 26);
      expect(lines.length, `screen ${screen.id}`).toBeLessThanOrEqual(2);
      if (lines.length === 2) {
        // No line shorter than half the other, or the centred pair reads as a slip.
        const [a, b] = [lines[0]!.length, lines[1]!.length];
        expect(Math.min(a, b) * 2, `screen ${screen.id}`).toBeGreaterThanOrEqual(Math.max(a, b));
      }
    }
  });

  it('ends an attempt on four things and two routes, not a ledger', () => {
    overlays.show('gameover', lifeLost({ delays: 3, delayMonths: 6 }));
    const el = visible(parent);
    expect(overlays.current).toBe('gameover');
    expect(el.getAttribute('role')).toBe('alertdialog');
    // The headline, the one figure, the argument.
    expect(el.textContent).toContain(COPY.gameOver.title);
    expect(el.textContent).toContain(COPY.gameOver.cost(3, 6));
    expect(el.querySelector('.beam-run__advice')!.textContent).toBe(COPY.gameOver.advice);
    // …and nothing else. No itemised table, no lives readout (there are none left),
    // no two-column split: one centred column, symmetrical about its own axis.
    expect(el.querySelector('.beam-run__ledger')).toBeNull();
    expect(el.querySelector('.beam-run__lives')).toBeNull();
    expect(el.querySelector('.beam-run__cols')).toBeNull();
    expect(el.querySelector('.beam-run__stack--gameover')).not.toBeNull();
    // Not a dead end: start again AND a route to the Navigator.
    const btns = buttons(parent).filter((b) => !b.hidden);
    expect(btns).toHaveLength(2);
    expect(btns[0]!.textContent).toBe(COPY.gameOver.restart);
    // Both labels fit one bitmap line, so the pair is not lopsided: the sentence
    // form the other end screens use wraps onto two.
    expect(btns[1]!.textContent).toBe(COPY.gameOver.cta);
    for (const b of btns) expect(wrapPixelLabel(b.textContent!)).toHaveLength(1);
    btns[0]!.click();
    expect(cb.onContinue).toHaveBeenCalled();
    btns[1]!.click();
    expect(cb.onCta).toHaveBeenCalledWith('summary');
  });

  it('sizes every readout on the out-of-lives screen in frame units', () => {
    // The trap this guards: a PixelSpec without `maxShare` falls back to the
    // default `min(96%, …)` cap, which is circular inside a shrink-wrapping flex
    // box — the browser then silently uses the SVG's intrinsic width and the
    // element renders at a fraction of its intended size.
    overlays.show('gameover', lifeLost({ delays: 2, delayMonths: 4 }));
    const art = Array.from(
      visible(parent).querySelectorAll<SVGSVGElement>('.beam-run__stack svg.beam-run__pixels'),
    );
    expect(art.length).toBeGreaterThan(3);
    for (const svg of art) {
      const style = svg.getAttribute('style') ?? '';
      expect(style, svg.parentElement?.className).toContain('var(--beam-run-u)');
      expect(style, svg.parentElement?.className).not.toContain('%');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('repaints the out-of-lives figure for each attempt', () => {
    overlays.show('gameover', lifeLost({ delays: 1, delayMonths: 2 }));
    expect(visible(parent).textContent).toContain(COPY.gameOver.cost(1, 2));
    overlays.show('titlecard', { levelLabel: 'Compliance' });
    overlays.show('gameover', lifeLost({ delays: 4, delayMonths: 8 }));
    expect(visible(parent).textContent).toContain(COPY.gameOver.cost(4, 8));
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
    rows[2]!.click(); // the third capability in journey order
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
