import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Input } from './Input';

describe('Input edge vs level signals', () => {
  let input: Input;
  beforeEach(() => {
    input = new Input();
  });

  it('reports jumpPressed once (edge) but jumpHeld while down (level)', () => {
    input.pressAction('jump');
    let s = input.getState();
    expect(s.jumpPressed).toBe(true);
    expect(s.jumpHeld).toBe(true);
    expect(s.anyPressed).toBe(true);

    input.endFrame();
    s = input.getState();
    expect(s.jumpPressed).toBe(false); // edge consumed
    expect(s.jumpHeld).toBe(true); // still held

    input.releaseAction('jump');
    s = input.getState();
    expect(s.jumpHeld).toBe(false);
  });

  it('does not raise an edge for auto-repeat key events', () => {
    input.pressAction('jump', true);
    expect(input.getState().jumpPressed).toBe(false);
    expect(input.getState().jumpHeld).toBe(true);
  });

  it('merges virtual (touch) input with keyboard', () => {
    input.setVirtual('right', true);
    expect(input.getState().right).toBe(true);
    input.setVirtual('jump', true);
    expect(input.getState().jumpPressed).toBe(true);
    input.endFrame();
    expect(input.getState().jumpPressed).toBe(false);
    expect(input.getState().jumpHeld).toBe(true);
  });

  it('clears held state when focus is lost', () => {
    input.pressAction('left');
    expect(input.getState().left).toBe(true);
    input.setFocused(false);
    expect(input.getState().left).toBe(false);
  });
});

describe('Input DOM key mapping', () => {
  let input: Input;
  beforeEach(() => {
    input = new Input();
    input.attach(window);
  });
  afterEach(() => input.detach());

  it('maps physical keys to actions', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    expect(input.getState().right).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }));
    expect(input.getState().right).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(input.getState().jumpHeld).toBe(true);
  });

  it('acts on the down arrow as well as F (it is what opens the secret hatch)', () => {
    for (const code of ['ArrowDown', 'KeyF']) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code }));
      const s = input.getState();
      expect(s.shootPressed, code).toBe(true);
      expect(s.shoot, code).toBe(true);
      window.dispatchEvent(new KeyboardEvent('keyup', { code }));
      input.endFrame();
      expect(input.getState().shoot, code).toBe(false);
    }
  });
});

describe('Input auto-run (one-tap play)', () => {
  it('drives forward motion on its own, without faking any edge signal', () => {
    const input = new Input();
    expect(input.isAutoRun).toBe(false);
    expect(input.getState().right).toBe(false);

    input.setAutoRun(true);
    const s = input.getState();
    expect(input.isAutoRun).toBe(true);
    expect(s.right).toBe(true);
    // Critically: auto-run must not look like a key press, or it would start a
    // run and skip every title card by itself.
    expect(s.anyPressed).toBe(false);
    expect(s.jumpPressed).toBe(false);
  });

  it('still lets the player back up by holding left', () => {
    const input = new Input();
    input.setAutoRun(true);
    input.pressAction('left');
    const s = input.getState();
    expect(s.left).toBe(true);
    expect(s.right).toBe(false); // holding left overrides auto-run
  });

  it('can be turned back off (desktop players keep full control)', () => {
    const input = new Input();
    input.setAutoRun(true);
    input.setAutoRun(false);
    expect(input.getState().right).toBe(false);
  });
});
