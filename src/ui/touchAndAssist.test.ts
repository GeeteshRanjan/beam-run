import { describe, it, expect, vi } from 'vitest';
import { TouchControls } from './TouchControls';
import { AssistMenu } from './AssistMenu';
import { CSS, stageClassName } from './styles';
import {
  LIVES_PLAQUE,
  PAD_PORTRAIT,
  PAD_PORTRAIT_LARGE,
  PAUSE_BTN,
  clusterHeightPx,
  padPx,
  pauseLeftEdgePx,
  rowWidthPx,
} from './touchGeometry';
import { HUD_PX, HUD_PLAQUE_CHROME, pixelWidthPx, pixelArtWidthPx } from './Hud';
import { pipCells } from './LivesPips';
import { COPY } from '../data/copy';
import { SCREENS } from '../data/levels';
import { ASSIST, LIVES } from '../data/tuning.config';
import { AssistController } from '../core/AssistController';
import { DEFAULT_ASSIST, type AssistState } from '../core/Simulation';

function parent(): HTMLDivElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('TouchControls', () => {
  it('feeds pointer press/release into Input.setVirtual and unlocks on first touch', () => {
    const setVirtual = vi.fn();
    const onFirstInteraction = vi.fn();
    const tc = new TouchControls(parent(), { setVirtual, onFirstInteraction });
    const left = tc.root.querySelector('.beam-run__touch-btn--left') as HTMLButtonElement;
    const jump = tc.root.querySelector('.beam-run__touch-btn--jump') as HTMLButtonElement;

    left.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(setVirtual).toHaveBeenLastCalledWith('left', true);
    expect(onFirstInteraction).toHaveBeenCalledOnce();
    left.dispatchEvent(new Event('pointerup', { bubbles: true }));
    expect(setVirtual).toHaveBeenLastCalledWith('left', false);

    jump.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(setVirtual).toHaveBeenLastCalledWith('jump', true);
  });

  it('hides the thumb pads from assistive tech but NOT the pause button', () => {
    /*
     * The two thumb clusters duplicate keys, so they stay aria-hidden. Pause does not
     * duplicate anything on a phone — there is no Escape key — so the moment it moved
     * into this layer, `aria-hidden` had to come off the root and go onto the zones,
     * or the one control with no other route to it would have been hidden as well.
     */
    const tc = new TouchControls(parent(), { setVirtual: vi.fn() });
    expect(tc.root.getAttribute('aria-hidden')).toBeNull();
    const zones = tc.root.querySelectorAll('.beam-run__touch-zone');
    expect(zones.length).toBe(2);
    for (const z of zones) expect(z.getAttribute('aria-hidden')).toBe('true');

    const pause = tc.root.querySelector('.beam-run__touch-btn--pause')!;
    expect(pause.closest('[aria-hidden="true"]')).toBeNull();
    expect(pause.getAttribute('aria-label')).toBe(COPY.controls.pause);
  });

  it('gives a touch player a route to pause, and it is the same edge Escape raises', () => {
    const setVirtual = vi.fn();
    const onPause = vi.fn();
    const tc = new TouchControls(parent(), { setVirtual, onPause });
    const pause = tc.root.querySelector('.beam-run__touch-btn--pause') as HTMLButtonElement;

    pause.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onPause).toHaveBeenCalledOnce();
    // Pause is an edge, never a held direction: it must not reach the virtual pads.
    expect(setVirtual).not.toHaveBeenCalled();
    pause.dispatchEvent(new Event('pointerup', { bubbles: true }));
    expect(pause.classList.contains('beam-run__touch-btn--active')).toBe(false);
  });

  it('toggles visibility / larger sizing', () => {
    const tc = new TouchControls(parent(), { setVirtual: vi.fn() });
    tc.setVisible(true);
    expect(tc.root.classList.contains('beam-run__touch--visible')).toBe(true);
    tc.setLarger(true);
    expect(tc.root.classList.contains('beam-run__touch--large')).toBe(true);
  });

  it('draws a forward arrow by default, because auto-run no longer is', () => {
    /*
     * The owner turned one-tap off: a phone player now walks up to an obstacle, looks
     * at it and decides. That only works if the pad they are given has a forward
     * button, so the default layout must not be the auto-run one.
     */
    expect(ASSIST.AUTO_RUN_DEFAULT_ON_TOUCH).toBe(false);
    const tc = new TouchControls(parent(), { setVirtual: vi.fn() });
    expect(tc.root.classList.contains('beam-run__touch--autorun')).toBe(false);
    expect(tc.root.querySelector('.beam-run__touch-btn--right')).not.toBeNull();
  });

  it('switches to the one-tap layout for auto-run', () => {
    const tc = new TouchControls(parent(), { setVirtual: vi.fn() });
    expect(tc.root.classList.contains('beam-run__touch--autorun')).toBe(false);
    tc.setAutoRun(true);
    expect(tc.root.classList.contains('beam-run__touch--autorun')).toBe(true);
  });

  it('lifts the armed tool button off jump baseline instead of sitting beside it', () => {
    // The diagonal is the whole reason the tool button is not read as a mis-tap of
    // jump; it is a margin on the button, so it survives both orientation blocks.
    const tc = new TouchControls(parent(), { setVirtual: vi.fn() });
    const zone = tc.root.querySelector('.beam-run__touch-zone--jump')!;
    // Source order in the DOM is the paint order: tool first, jump last and rightmost.
    expect(zone.children[0]!.classList.contains('beam-run__touch-btn--shoot')).toBe(true);
    expect(zone.children[1]!.classList.contains('beam-run__touch-btn--jump')).toBe(true);
    expect(CSS).toMatch(
      /\.beam-run__touch-btn--shoot\s*\{[^}]*margin-bottom:\s*var\(--beam-run-pad-lift\)/,
    );
  });
});

describe('touch control geometry', () => {
  /*
   * Upright, four targets share one row — back, forward, the armed tool, jump — and the
   * frame is only as wide as the phone. At the sizes this shipped with the row wanted
   * 396px against a 390px iPhone frame, so the move pad and the tool button overlapped
   * on the most likely device in the audience's pocket. A stylesheet cannot do
   * arithmetic and jsdom cannot do layout, which is why the numbers are a module and
   * this is a sum rather than a screenshot.
   *
   * 280 = Galaxy Fold cover screen, 320 = iPhone SE 1st gen, 390 = iPhone 12-16,
   * 430 = iPhone Pro Max, 768 = iPad portrait. The same widths the HUD plaques are
   * checked against, so the two rows of the frame are measured on one ruler.
   */
  const FRAMES = [280, 320, 360, 390, 430, 560, 768];

  it('fits all four thumb targets across every phone frame, normal and larger', () => {
    for (const spec of [PAD_PORTRAIT, PAD_PORTRAIT_LARGE]) {
      for (const frame of FRAMES) {
        expect(rowWidthPx(spec, frame), `frame ${frame}px`).toBeLessThanOrEqual(frame);
      }
    }
  });

  it('keeps the lifted tool button inside the control band', () => {
    /*
     * The band is 180px per side by default (`--beam-run-portrait-band` 360). The top of
     * the taller cluster is the LIFTED tool button, not jump — measuring jump alone is
     * how a diagonal offset quietly puts a control back over the gameplay, which is the
     * one thing the band exists to prevent. 16px zone inset + a 34px bottom safe area is
     * the worst case (an iPhone with a home indicator).
     */
    const BAND = 180;
    for (const spec of [PAD_PORTRAIT, PAD_PORTRAIT_LARGE]) {
      for (const frame of FRAMES) {
        expect(clusterHeightPx(spec, frame, 16 + 34), `frame ${frame}px`).toBeLessThanOrEqual(BAND);
      }
    }
  });

  it('reaches the hand-tuned sizes on a normal phone and shrinks below it', () => {
    // The ceilings are the sizes that were designed; they must actually be in use on a
    // real phone, or the clamp has quietly made every device the small-screen case.
    expect(padPx(PAD_PORTRAIT.pad, 430)).toBe(PAD_PORTRAIT.pad.max);
    expect(padPx(PAD_PORTRAIT.jump, 430)).toBe(PAD_PORTRAIT.jump.max);
    expect(padPx(PAD_PORTRAIT.pad, 320)).toBeLessThan(PAD_PORTRAIT.pad.max);
    // And nothing ever drops under the 44px minimum target size.
    for (const frame of FRAMES) {
      expect(padPx(PAD_PORTRAIT.pad, frame)).toBeGreaterThanOrEqual(44);
      expect(padPx(PAD_PORTRAIT.jump, frame)).toBeGreaterThanOrEqual(44);
    }
  });

  it('puts the pause button in the gap between the two HUD plaques, wherever that gap is', () => {
    /*
     * The top row belongs to the two HUD plaques, anchored to opposite corners — and they
     * are very different widths, so the free space between them is NOT in the middle of
     * the frame. The first cut centred the button, which looks obviously right and put it
     * on top of the stage plaque at every phone width; a sum that only measured the gap's
     * *width* said there was 96px of room and passed. So this measures the button's actual
     * left and right edges against the plaques' actual edges, which is the assertion that
     * would have caught it.
     */
    const longest = SCREENS.reduce((a, s) => (s.name.length > a.length ? s.name : a), '');
    for (const frame of [340, 360, 390, 430, 560, 768, 1024, 1280]) {
      const gutter = Math.min(22, Math.max(8, frame * 0.022));
      const stageRight =
        gutter +
        Math.max(
          pixelWidthPx(longest, HUD_PX.stage, frame),
          pixelWidthPx(COPY.hud.stageLabel, HUD_PX.caption, frame),
        ) +
        HUD_PLAQUE_CHROME;
      const livesLeft =
        frame -
        gutter -
        Math.max(
          pixelWidthPx(COPY.hud.livesLabel, HUD_PX.caption, frame),
          pixelArtWidthPx(pipCells(LIVES.TOTAL), HUD_PX.lives, frame),
        ) -
        HUD_PLAQUE_CHROME;

      const left = pauseLeftEdgePx(frame);
      expect(left, `stage plaque @ ${frame}px`).toBeGreaterThan(stageRight);
      expect(left + PAUSE_BTN.size, `lives plaque @ ${frame}px`).toBeLessThanOrEqual(livesLeft);
    }
  });

  it('drops the pause button below the plaques on a frame too narrow to fit beside them', () => {
    /*
     * Under 340px of frame the slot between the plaques is narrower than the 44px minimum
     * target, so no anchor works and the button has to move down a row. It is a CONTAINER
     * query because the number that matters is the width of the letterboxed frame, not of
     * the window — a media query would measure the wrong box.
     */
    const longest = SCREENS.reduce((a, s) => (s.name.length > a.length ? s.name : a), '');
    const gutter = Math.min(22, Math.max(8, 280 * 0.022));
    const slot =
      280 -
      gutter -
      Math.max(
        pixelWidthPx(COPY.hud.livesLabel, HUD_PX.caption, 280),
        pixelArtWidthPx(pipCells(LIVES.TOTAL), HUD_PX.lives, 280),
      ) -
      HUD_PLAQUE_CHROME -
      (gutter +
        Math.max(
          pixelWidthPx(longest, HUD_PX.stage, 280),
          pixelWidthPx(COPY.hud.stageLabel, HUD_PX.caption, 280),
        ) +
        HUD_PLAQUE_CHROME);
    expect(slot).toBeLessThan(PAUSE_BTN.size);

    expect(CSS).toContain(`@container (max-width: ${PAUSE_BTN.narrowFrame - 1}px)`);
    expect(CSS).toMatch(
      new RegExp(
        `@container \\(max-width: ${PAUSE_BTN.narrowFrame - 1}px\\)[^}]*\\.beam-run__touch-menu \\{ top: calc\\(${PAUSE_BTN.narrowTop}px`,
      ),
    );
    // And the drop still has to land inside the 180px band, not on the play frame.
    expect(PAUSE_BTN.narrowTop + PAUSE_BTN.size).toBeLessThanOrEqual(180);
  });

  it('derives the pause offset from the numbers the HUD actually uses', () => {
    /*
     * `touchGeometry` restates the lives plaque's width as plain numbers so it stays a
     * dependency-free geometry module. This is the guard that stops the two drifting: the
     * clamp there must be exactly 25 authored heart cells at HUD_PX.lives.
     */
    const cells = pipCells(LIVES.TOTAL);
    expect(LIVES_PLAQUE.min).toBeCloseTo(cells * HUD_PX.lives.minPx, 6);
    expect(LIVES_PLAQUE.u).toBeCloseTo(cells * HUD_PX.lives.unit, 6);
    expect(LIVES_PLAQUE.max).toBeCloseTo(cells * HUD_PX.lives.maxPx, 6);
    expect(PAUSE_BTN.plaqueChrome).toBe(HUD_PLAQUE_CHROME);
    expect(PAUSE_BTN.size).toBeGreaterThanOrEqual(44); // minimum target size
    // And the resolved clamp must agree with the HUD's own measurement of the hearts.
    for (const frame of [280, 390, 768, 1280]) {
      expect(padPx(LIVES_PLAQUE, frame)).toBeCloseTo(
        pixelArtWidthPx(cells, HUD_PX.lives, frame),
        6,
      );
    }
  });
});

describe('stage shape', () => {
  it('gates the control band on touch, not on orientation', () => {
    /*
     * The defect this replaces: the band rule lived in `@media (orientation: portrait)`,
     * so any desktop window dragged taller than it was wide stopped being 16:9 and drew
     * the game as a strip between two empty bands — the reason the same build "looked a
     * different shape" on different machines — while a tablet in landscape, which has no
     * 16:9 room to spare, got no band and had the thumb buttons drawn on the gameplay.
     */
    expect(stageClassName(false)).toBe('beam-run__stage');
    expect(stageClassName(true)).toContain('beam-run__stage--touch');

    // The band belongs to the touch class.
    expect(CSS).toMatch(/\.beam-run__stage--touch\s*\{[^}]*aspect-ratio:\s*auto/);

    /*
     * And no orientation query may reshape the box again. Checked by reading every
     * `@media (orientation: …)` block in the sheet: none of them may mention
     * `aspect-ratio`, which is the one property that changes the box's shape.
     */
    for (const block of CSS.split('@media').slice(1)) {
      if (!/^\s*\(orientation/.test(block)) continue;
      const body = block.slice(0, block.indexOf('\n}'));
      expect(body).not.toMatch(/aspect-ratio/);
    }
  });
});

describe('AssistMenu', () => {
  function controller() {
    const sim = { assist: { ...DEFAULT_ASSIST } as AssistState };
    return new AssistController({ sim, loop: { timeScale: 1 }, audio: { setMuted: vi.fn() } });
  }

  it('is a labelled modal dialog with a checkbox per assist option', () => {
    const menu = new AssistMenu(parent(), controller(), () => {});
    expect(menu.root.getAttribute('role')).toBe('dialog');
    expect(menu.root.getAttribute('aria-modal')).toBe('true');
    expect(menu.root.querySelectorAll('.beam-run__assist-check').length).toBe(7);
  });

  it('checking a box routes through the controller into the sim', () => {
    const c = controller();
    const menu = new AssistMenu(parent(), c, () => {});
    const boxes = menu.root.querySelectorAll<HTMLInputElement>('.beam-run__assist-check');
    const noSetbacks = boxes[3]!; // order matches TOGGLES
    noSetbacks.checked = true;
    noSetbacks.dispatchEvent(new Event('change'));
    expect(c.isOn('noSetbacks')).toBe(true);
  });

  it('opens (syncing checkboxes) and closes via Done', () => {
    const c = controller();
    c.set('slowMode', true);
    const onClose = vi.fn();
    const menu = new AssistMenu(parent(), c, onClose);
    menu.show();
    expect(menu.open).toBe(true);
    const slow = menu.root.querySelectorAll<HTMLInputElement>('.beam-run__assist-check')[1]!;
    expect(slow.checked).toBe(true); // synced from controller
    const done = menu.root.querySelector('.beam-run__btn--primary') as HTMLButtonElement;
    done.click();
    expect(menu.open).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
