/**
 * TouchControls — on-screen movement + jump for touch devices.
 *
 * A left-hand movement zone (◀ / ▶) and a right-hand jump button, each ≥44px
 * and inside the device safe-area. They feed the same `Input.setVirtual`
 * abstraction the keyboard uses, so gameplay is identical. Jump fires a short
 * haptic (where supported). The whole layer is `aria-hidden` (it duplicates the
 * keyboard for pointer users; screen-reader users drive the game with keys).
 *
 * Visibility is controlled by the Game (shown only while playing on touch); the
 * "larger controls" assist option scales everything up.
 */
import { COPY } from '../data/copy';

export interface TouchControlsCallbacks {
  setVirtual(dir: 'left' | 'right' | 'jump', down: boolean): void;
  /** First touch interaction — used to unlock audio. */
  onFirstInteraction?: () => void;
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
  );
}

export class TouchControls {
  readonly root: HTMLDivElement;
  private readonly cb: TouchControlsCallbacks;
  private interacted = false;
  private readonly bound: { el: HTMLElement; type: string; fn: EventListener }[] = [];

  constructor(parent: HTMLElement, cb: TouchControlsCallbacks) {
    this.cb = cb;
    const doc = parent.ownerDocument;
    this.root = doc.createElement('div');
    this.root.className = 'beam-run__touch';
    this.root.setAttribute('aria-hidden', 'true');

    const move = doc.createElement('div');
    move.className = 'beam-run__touch-zone beam-run__touch-zone--move';
    const left = this.makeButton(doc, 'left', '\u25C0', COPY.controls.moveLeft);
    const right = this.makeButton(doc, 'right', '\u25B6', COPY.controls.moveRight);
    move.append(left, right);

    const jumpZone = doc.createElement('div');
    jumpZone.className = 'beam-run__touch-zone beam-run__touch-zone--jump';
    const jump = this.makeButton(doc, 'jump', '\u2B24', COPY.controls.jump);
    jump.classList.add('beam-run__touch-btn--jump');
    jumpZone.append(jump);

    this.root.append(move, jumpZone);
    parent.appendChild(this.root);
  }

  private makeButton(
    doc: Document,
    dir: 'left' | 'right' | 'jump',
    glyph: string,
    label: string,
  ): HTMLButtonElement {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = `beam-run__touch-btn beam-run__touch-btn--${dir}`;
    b.textContent = glyph;
    b.setAttribute('aria-label', label);
    b.tabIndex = -1; // keyboard users use real keys, not these

    const down = (e: Event) => {
      e.preventDefault();
      if (!this.interacted) {
        this.interacted = true;
        this.cb.onFirstInteraction?.();
      }
      this.cb.setVirtual(dir, true);
      if (dir === 'jump' && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
      b.classList.add('beam-run__touch-btn--active');
    };
    const up = (e: Event) => {
      e.preventDefault();
      this.cb.setVirtual(dir, false);
      b.classList.remove('beam-run__touch-btn--active');
    };

    this.on(b, 'pointerdown', down);
    this.on(b, 'pointerup', up);
    this.on(b, 'pointercancel', up);
    this.on(b, 'pointerleave', up);
    return b;
  }

  private on(el: HTMLElement, type: string, fn: EventListener): void {
    el.addEventListener(type, fn);
    this.bound.push({ el, type, fn });
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('beam-run__touch--visible', visible);
  }

  setLarger(larger: boolean): void {
    this.root.classList.toggle('beam-run__touch--large', larger);
  }

  /**
   * One-tap layout: the move pad is hidden (forward motion is automatic) and the
   * act button grows, so the whole game is playable with a single thumb.
   */
  setAutoRun(on: boolean): void {
    this.root.classList.toggle('beam-run__touch--autorun', on);
  }

  destroy(): void {
    for (const { el, type, fn } of this.bound) el.removeEventListener(type, fn);
    this.bound.length = 0;
    this.root.remove();
  }
}
