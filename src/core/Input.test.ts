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
});
