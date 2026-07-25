import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hud, HUD_PX, HUD_PLAQUE_CHROME, pixelWidthPx } from './Hud';
import { Overlays, type ReceiptModel } from './Overlays';
import { injectStyles, STYLE_ELEMENT_ID, CSS } from './styles';
import { COPY, CAPABILITIES } from '../data/copy';
import { SCREENS } from '../data/levels';
import { wrapPixelLabel } from './PixelType';
import { JOURNEY } from '../data/tuning.config';

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
    quickWins: 12,
    totalQuickWins: 23,
    engaged: ['PLACE_TILE', 'EXTINGUISH'],
    reachedScreenName: 'Compliance',
    ...over,
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
    hud.update({
      levelLabel: 'Hire Under Fire',
      months: 8,
      quickWins: 5,
      totalQuickWins: 23,
      power: null,
    });
    const clock = parent.querySelector('.beam-run__hud-clock')!;
    expect(clock.querySelector('.beam-run__hud-clock-value')!.textContent).toBe('8');
    expect(clock.getAttribute('aria-label')).toContain('8');
    expect(clock.getAttribute('aria-label')).toContain(COPY.hud.monthsUnit);
    expect(parent.querySelector('.beam-run__hud-level')!.textContent).toContain('Hire Under Fire');
  });

  it('has no lives readout — setbacks cost time, not lives', () => {
    hud.update({ levelLabel: 'x', months: 0, quickWins: 0, totalQuickWins: 23, power: null });
    expect(parent.querySelector('.beam-run__hud-lives')).toBeNull();
  });

  it('counts quick wins out of the run total', () => {
    hud.update({ levelLabel: 'x', months: 3, quickWins: 7, totalQuickWins: 23, power: null });
    const wins = parent.querySelector('.beam-run__hud-wins')!;
    expect(wins.textContent).toContain('7');
    expect(wins.textContent).toContain('/23');
    expect(wins.getAttribute('aria-label')).toContain('7 of 23');
  });

  it('sets the stage and clock plaques in the bitmap font, not web type', () => {
    hud.update({
      levelLabel: 'Compliance Maze',
      months: 7,
      quickWins: 0,
      totalQuickWins: 23,
      power: null,
    });
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
    hud.update({ levelLabel: 'x', months: 7, quickWins: 0, totalQuickWins: 23, power: null });
    const art = parent.querySelector('.beam-run__hud-clock-value svg')!;
    const single = art.getAttribute('width');
    // Accessible value stays "7"; only the artwork is padded.
    expect(parent.querySelector('.beam-run__hud-clock-value')!.textContent).toBe('7');
    hud.update({ levelLabel: 'x', months: 18, quickWins: 0, totalQuickWins: 23, power: null });
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

      // In portrait the wins count and the capability chip share a row too.
      const wins = pixelWidthPx('23/23', HUD_PX.chip, frame);
      const longestPower = Object.values(COPY.powers).reduce(
        (a, n) => (n.length > a.length ? n : a),
        '',
      );
      const chip = Math.max(
        pixelWidthPx('Talent500', HUD_PX.chip, frame),
        pixelWidthPx(longestPower, HUD_PX.chipSub, frame),
      );
      expect(wins + chip + 2 * HUD_PLAQUE_CHROME + gutter, `bottom row @ ${frame}px`).toBeLessThan(
        frame,
      );
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
    hud.update({ levelLabel: 'x', months: 0, quickWins: 0, totalQuickWins: 23, power: null });
    expect(power.classList.contains('beam-run__hud-power--visible')).toBe(false);

    hud.update({
      levelLabel: 'x',
      months: 0,
      quickWins: 0,
      totalQuickWins: 23,
      power: { name: 'Roles filled', product: 'Talent500' },
    });
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

  it('has no game-over overlay — the run cannot fail', () => {
    // @ts-expect-error 'gameover' is intentionally not an OverlayName any more.
    expect(() => overlays.show('gameover')).not.toThrow();
    expect(parent.querySelectorAll('.beam-run__overlay--visible').length).toBe(0);
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
