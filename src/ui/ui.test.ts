import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hud } from './Hud';
import { Overlays } from './Overlays';
import { injectStyles, STYLE_ELEMENT_ID } from './styles';
import { COPY } from '../data/copy';

function makeParent(): HTMLDivElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('injectStyles', () => {
  it('injects the scoped stylesheet once', () => {
    injectStyles(document);
    injectStyles(document);
    expect(document.querySelectorAll(`#${STYLE_ELEMENT_ID}`).length).toBe(1);
  });
});

describe('Hud', () => {
  let parent: HTMLDivElement;
  let hud: Hud;
  beforeEach(() => {
    parent = makeParent();
    hud = new Hud(parent);
  });

  it('renders lives as hearts and points with an accessible label', () => {
    hud.setVisible(true);
    hud.update({ levelLabel: 'Level 2 — Hire Under Fire', lives: 3, points: 15, power: null });
    expect(parent.querySelector('.beam-run__hud-lives')!.textContent).toBe('\u2665\u2665\u2665');
    const pts = parent.querySelector('.beam-run__hud-points')!;
    expect(pts.getAttribute('aria-label')).toContain('15');
    expect(parent.querySelector('.beam-run__hud-level')!.textContent).toContain('Hire Under Fire');
  });

  it('shows the power bar only when a power is active', () => {
    hud.update({ levelLabel: 'x', lives: 3, points: 0, power: null });
    const power = parent.querySelector('.beam-run__hud-power')!;
    expect(power.classList.contains('beam-run__hud-power--visible')).toBe(false);
    hud.update({
      levelLabel: 'x',
      lives: 3,
      points: 0,
      power: { name: 'Fire Shield', remaining: 2.5, duration: 5 },
    });
    expect(power.classList.contains('beam-run__hud-power--visible')).toBe(true);
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
    const visible = parent.querySelectorAll('.beam-run__overlay--visible');
    expect(visible.length).toBe(1);
    overlays.show('win', { points: 47 });
    expect(overlays.current).toBe('win');
    expect(parent.querySelectorAll('.beam-run__overlay--visible').length).toBe(1);
  });

  it('counts the Company Valuation up from 0 to the final figure', () => {
    overlays.show('win', { points: 47 });
    // Animated: starts at 0, is partway through mid-flight, lands exactly on target.
    expect(overlays.valuationDisplay).toBe(0);
    overlays.advanceValuation(0.3);
    const mid = overlays.valuationDisplay;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(47);
    overlays.advanceValuation(2); // past the count-up duration
    expect(parent.querySelector('.beam-run__valuation')!.textContent).toBe('47');
    // Further ticks are a no-op once complete.
    overlays.advanceValuation(1);
    expect(overlays.valuationDisplay).toBe(47);
  });

  it('reduced-motion shows the final valuation instantly (no count-up)', () => {
    const rm = new Overlays(makeParent(), cb, { reducedMotion: true });
    rm.show('win', { points: 30 });
    expect(rm.valuationDisplay).toBe(30);
    rm.advanceValuation(0.1); // no-op
    expect(rm.valuationDisplay).toBe(30);
  });

  it('wires the Start button to the onStart callback', () => {
    overlays.show('start');
    const startBtn = Array.from(parent.querySelectorAll('button')).find(
      (b) => b.textContent === COPY.start.play,
    )!;
    startBtn.click();
    expect(cb.onStart).toHaveBeenCalledOnce();
  });

  it('offers a route to the Navigator from every overlay (no dead ends)', () => {
    // Game Over → CTA.
    overlays.show('gameover');
    const gameOverCta = Array.from(parent.querySelectorAll('button')).find(
      (b) => b.textContent === COPY.gameOver.cta,
    )!;
    gameOverCta.click();
    expect(cb.onCta).toHaveBeenCalledWith('game_over');

    // Win → CTA.
    overlays.show('win', { points: 10 });
    const winCta = Array.from(parent.querySelectorAll('button')).find(
      (b) => b.textContent === COPY.win.cta,
    )!;
    winCta.click();
    expect(cb.onCta).toHaveBeenCalledWith('win');

    // Start & Pause → Skip.
    overlays.show('start');
    Array.from(parent.querySelectorAll('button'))
      .find((b) => b.textContent === COPY.start.skip)!
      .click();
    expect(cb.onSkip).toHaveBeenCalled();
  });
});
