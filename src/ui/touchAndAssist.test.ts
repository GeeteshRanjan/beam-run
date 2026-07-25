import { describe, it, expect, vi } from 'vitest';
import { TouchControls } from './TouchControls';
import { AssistMenu } from './AssistMenu';
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

  it('is aria-hidden and toggles visibility / larger sizing', () => {
    const tc = new TouchControls(parent(), { setVirtual: vi.fn() });
    expect(tc.root.getAttribute('aria-hidden')).toBe('true');
    tc.setVisible(true);
    expect(tc.root.classList.contains('beam-run__touch--visible')).toBe(true);
    tc.setLarger(true);
    expect(tc.root.classList.contains('beam-run__touch--large')).toBe(true);
  });

  it('switches to the one-tap layout for auto-run', () => {
    const tc = new TouchControls(parent(), { setVirtual: vi.fn() });
    expect(tc.root.classList.contains('beam-run__touch--autorun')).toBe(false);
    tc.setAutoRun(true);
    expect(tc.root.classList.contains('beam-run__touch--autorun')).toBe(true);
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
