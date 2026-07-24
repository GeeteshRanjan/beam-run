import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, createBeamRunComponent, type EmbedOptions } from './mount';
import { COPY } from '../data/copy';

function host(): HTMLDivElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

/** A fake game so tests never touch a real (unsupported) jsdom canvas. */
function fakeFactory() {
  const destroy = vi.fn();
  const factory = vi.fn((el: HTMLElement) => {
    const marker = el.ownerDocument.createElement('canvas');
    el.appendChild(marker);
    return { destroy: () => { destroy(); marker.remove(); } };
  });
  return { factory, destroy };
}

afterEach(() => {
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
});

describe('embed mount', () => {
  it('eager mount boots the game and destroy() cleans up', () => {
    const el = host();
    const { factory } = fakeFactory();
    const inst = mount(el, { lazy: false, _gameFactory: factory } as EmbedOptions);
    expect(factory).toHaveBeenCalledOnce();
    expect(el.querySelector('canvas')).toBeTruthy();
    inst.destroy();
    expect(el.querySelector('canvas')).toBeFalsy();
    expect(el.classList.contains('beam-run')).toBe(false);
  });

  it('kill switch renders the fallback card and never boots', () => {
    const el = host();
    const { factory } = fakeFactory();
    mount(el, { enabled: false, _gameFactory: factory } as EmbedOptions);
    expect(factory).not.toHaveBeenCalled();
    expect(el.querySelector('.beam-run__fallback')).toBeTruthy();
    // No Play button under the kill switch; Skip route remains (no dead end).
    const buttons = Array.from(el.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons).not.toContain(COPY.fallback.play);
    expect(buttons).toContain(COPY.fallback.skip);
  });

  it('degrades to the fallback card if the game fails to boot', () => {
    const el = host();
    const onError = vi.fn();
    const throwing = () => {
      throw new Error('forced asset failure');
    };
    mount(el, { lazy: false, onError, _gameFactory: throwing } as EmbedOptions);
    expect(onError).toHaveBeenCalledOnce();
    expect(el.querySelector('.beam-run__fallback')).toBeTruthy();
  });

  it('lazy mount waits for viewport intersection before booting', () => {
    let captured: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
    class FakeIO {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        captured = cb;
      }
      observe() {}
      disconnect() {}
    }
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = FakeIO as unknown;

    const el = host();
    const { factory } = fakeFactory();
    mount(el, { lazy: true, _gameFactory: factory } as EmbedOptions);
    // Not booted yet — a Play-capable fallback is shown instead.
    expect(factory).not.toHaveBeenCalled();
    expect(el.querySelector('.beam-run__fallback')).toBeTruthy();

    captured!([{ isIntersecting: true }]);
    expect(factory).toHaveBeenCalledOnce();
    expect(el.querySelector('.beam-run__fallback')).toBeFalsy();
  });
});

describe('React <BeamRun/> wrapper', () => {
  it('mounts on effect and tears down on cleanup', () => {
    const { factory } = fakeFactory();
    const ref: { current: HTMLDivElement | null } = { current: null };
    let effect: (() => void | (() => void)) | null = null;
    const React = {
      createElement: (type: string, props: Record<string, unknown>) => ({ type, props }),
      useRef: <T,>(_init: T | null) => ref as { current: T | null },
      useEffect: (fn: () => void | (() => void)) => {
        effect = fn;
      },
    };

    const BeamRun = createBeamRunComponent(React as never);
    BeamRun({ _gameFactory: factory } as EmbedOptions);

    // React attaches the ref, then runs the effect.
    ref.current = host();
    const cleanup = effect!() as (() => void) | undefined;
    expect(factory).toHaveBeenCalledOnce();
    expect(ref.current!.querySelector('canvas')).toBeTruthy();

    cleanup?.();
    expect(ref.current!.querySelector('canvas')).toBeFalsy();
  });
});
