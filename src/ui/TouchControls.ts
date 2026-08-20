/**
 * TouchControls — on-screen movement + jump for touch devices.
 *
 * A left-hand movement zone (◀ / ▶) and a right-hand jump button, each ≥44px
 * and inside the device safe-area. They feed the same `Input.setVirtual`
 * abstraction the keyboard uses, so gameplay is identical. Jump fires a short
 * haptic (where supported). The whole layer is `aria-hidden` (it duplicates the
 * keyboard for pointer users; screen-reader users drive the game with keys).
 *
 * The act button beside jump is the exception to "the controls never change": it
 * appears only once a badge has actually armed a tool — the Workplace cutter or the
 * hiring dragon's water cannon — because a fourth thumb target that does nothing on
 * four of the six screens is a control the player learns to ignore. It sits beside
 * jump rather than replacing it — one tap runs, one tap jumps, one tap fires — and
 * it relabels itself per tool (`setShootVisible`).
 *
 * Visibility is controlled by the Game (shown only while playing on touch); the
 * "larger controls" assist option scales everything up.
 */
import { COPY } from '../data/copy';
import type { VirtualControl } from '../core/Input';

export interface TouchControlsCallbacks {
  setVirtual(dir: VirtualControl, down: boolean): void;
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
  /** The act button, kept so its label can follow whichever tool is armed. */
  private readonly shootBtn: HTMLButtonElement;

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
    const shoot = this.makeButton(doc, 'shoot', '\u25B8', COPY.controls.shoot);
    shoot.classList.add('beam-run__touch-btn--shoot');
    this.shootBtn = shoot;
    const jump = this.makeButton(doc, 'jump', '\u2B24', COPY.controls.jump);
    jump.classList.add('beam-run__touch-btn--jump');
    jumpZone.append(shoot, jump);

    this.root.append(move, jumpZone);
    parent.appendChild(this.root);
  }

  private makeButton(
    doc: Document,
    dir: VirtualControl,
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

  /**
   * Show the act button, and say what it does.
   *
   * Two screens arm it now and they arm two different tools — the Workplace cutter
   * and the hiring dragon's water cannon — so the label is a parameter rather than a
   * constant. It is the button's only affordance: the glyph is an abstract arrow and
   * nothing on the canvas explains either weapon, so a screen-reader user and a
   * long-press tooltip both get their answer from here.
   */
  setShootVisible(visible: boolean, label: string = COPY.controls.shoot): void {
    this.root.classList.toggle('beam-run__touch--armed', visible);
    this.shootBtn.setAttribute('aria-label', label);
  }

  setLarger(larger: boolean): void {
    this.root.classList.toggle('beam-run__touch--large', larger);
  }

  /**
   * One-tap layout: forward motion is automatic, so the **right** arrow goes and the act
   * button grows — the whole game stays playable with a single thumb.
   *
   * The **left** arrow stays, and that is a deliberate correction. This layout used to
   * hide the move pad entirely, which quietly made anything *behind* the player
   * unreachable on the platform most of this audience is on: the Compliance badge is
   * reached by hopping onto a floating step and then jumping back the other way (owner
   * call, `docs/SCREENS.md` §4.9), and with no way to go left a phone player could never
   * take GCC-BOT at all. One-tap means "you never have to press forward", not "you cannot
   * turn round".
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
