/**
 * Embed layer — the production mount used by both the IIFE (`window.BeamRun`)
 * and the React wrapper.
 *
 * Responsibilities beyond the raw `new Game(...)`:
 *  - Kill switch: `options.enabled === false` (or `window.__BEAM_RUN_DISABLED__`)
 *    renders only the static fallback card and never boots the engine.
 *  - Lazy mount: by default the engine boots only when the container scrolls
 *    into view (IntersectionObserver), so it is never on the critical path.
 *    Until then (and where IO is unavailable but lazy) a branded card with a
 *    Play button is shown.
 *  - Error boundary: any failure constructing the Game degrades to the fallback
 *    card (with a Skip-to-Navigator route) instead of breaking the host page.
 */
import { Game, type GameOptions } from '../core/Game';
import { injectStyles } from '../ui/styles';
import { FallbackCard } from './FallbackCard';
import { buildNavigatorPayload, buildNavigatorUrl } from '../analytics/navigator';

export interface BeamRunInstance {
  destroy(): void;
}

export interface EmbedOptions extends GameOptions {
  /** Boot only when scrolled into view (default true). */
  lazy?: boolean;
  /** Kill switch — false renders the fallback card only (default true). */
  enabled?: boolean;
  /** Notified if the game fails to boot. */
  onError?: (err: unknown) => void;
  /** @internal test seam for injecting a game factory. */
  _gameFactory?: (el: HTMLElement, options: GameOptions) => { destroy(): void };
}

function killed(options: EmbedOptions): boolean {
  if (options.enabled === false) return true;
  if (typeof window !== 'undefined') {
    return (window as unknown as { __BEAM_RUN_DISABLED__?: boolean }).__BEAM_RUN_DISABLED__ === true;
  }
  return false;
}

function resolveElement(target: string | HTMLElement): HTMLElement {
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (!el) throw new Error(`Beam Run mount target not found: ${String(target)}`);
  return el;
}

export function mount(target: string | HTMLElement, options: EmbedOptions = {}): BeamRunInstance {
  const el = resolveElement(target);
  el.classList.add('beam-run');
  injectStyles(el.ownerDocument);

  let game: { destroy(): void } | null = null;
  let fallback: FallbackCard | null = null;
  let observer: IntersectionObserver | null = null;
  let destroyed = false;

  const clearFallback = (): void => {
    fallback?.destroy();
    fallback = null;
  };

  const skipToNavigator = (): void => {
    const base = options.navigatorUrl ?? '/gcc-opportunity-navigator';
    const payload = buildNavigatorPayload('skip', 0);
    if (options.onCta) {
      options.onCta(payload as unknown as Record<string, string | number>);
    } else if (typeof window !== 'undefined') {
      window.location.href = buildNavigatorUrl(base, payload);
    }
  };

  const showFallback = (canPlay: boolean): void => {
    if (destroyed || fallback) return;
    fallback = new FallbackCard(el, {
      canPlay,
      onPlay: () => boot(),
      onSkip: skipToNavigator,
    });
  };

  const boot = (): void => {
    if (destroyed || game) return;
    observer?.disconnect();
    observer = null;
    clearFallback();
    try {
      const factory = options._gameFactory ?? ((e, o) => new Game(e, o));
      game = factory(el, options);
    } catch (err) {
      options.onError?.(err);
      showFallback(false); // boot failed → static card, Skip still available
    }
  };

  if (killed(options)) {
    // Kill switch: never boot; offer the Navigator route only.
    showFallback(false);
    return { destroy: teardown };
  }

  const canLazy =
    options.lazy !== false &&
    typeof IntersectionObserver !== 'undefined' &&
    typeof window !== 'undefined';

  if (canLazy) {
    showFallback(true);
    observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) boot();
    });
    observer.observe(el);
  } else {
    boot();
  }

  function teardown(): void {
    if (destroyed) return;
    destroyed = true;
    observer?.disconnect();
    observer = null;
    game?.destroy();
    game = null;
    fallback?.destroy();
    fallback = null;
    el.classList.remove('beam-run');
  }

  return { destroy: teardown };
}

export function unmount(instance: BeamRunInstance | null | undefined): void {
  instance?.destroy();
}

// --- React wrapper (dependency-free factory) --------------------------------

interface RefLike<T> {
  current: T | null;
}
interface ReactLike {
  createElement(type: string, props: Record<string, unknown>): unknown;
  useRef<T>(initial: T | null): RefLike<T>;
  useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
}

/**
 * Build a thin `<BeamRun/>` React component from the host's own React (passed
 * in, so the library ships zero React and adds no dependency). Mounts on
 * insert, tears down on unmount.
 *
 *   const BeamRun = createBeamRunComponent(React);
 *   <BeamRun navigatorUrl="/gcc-opportunity-navigator" consent={hasConsent} />
 */
export function createBeamRunComponent<P extends EmbedOptions = EmbedOptions>(React: ReactLike) {
  return function BeamRun(props: P): unknown {
    const ref = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
      if (!ref.current) return undefined;
      const instance = mount(ref.current, props);
      return () => instance.destroy();
    }, []);
    return React.createElement('div', { ref, className: 'beam-run' });
  };
}
