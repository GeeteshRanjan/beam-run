/**
 * TouchControls — the on-screen controls for phones and tablets.
 *
 * Three clusters, placed where the hands already are, which is the convention every
 * mobile platformer settled on for the same reason:
 *
 *   bottom-left   the MOVE pad: back and forward, side by side, under the left thumb.
 *   bottom-right  the ACT cluster: JUMP is the largest target and sits lowest-right,
 *                 where a right thumb rests; the tool button sits up and to its left,
 *                 on a diagonal, so the thumb rolls between them and cannot land on
 *                 both. Baseline-aligning the two (which is how this started) put a
 *                 76px and a 104px circle edge to edge at the same height and made the
 *                 smaller one feel like a mis-tap of the bigger one.
 *   top-centre    PAUSE. Deliberately the one control that is NOT near a thumb —
 *                 pausing by accident mid-jump is worse than a long reach — and
 *                 deliberately away from the two HUD stacks, which own the top corners.
 *
 * They feed the same `Input` abstraction the keyboard uses, so gameplay is identical:
 * the pads go through `setVirtual`, and pause raises the same `pause` edge Escape does
 * rather than reaching into the Game's paused flag, so there is one code path and one
 * set of guards. Jump fires a short haptic (where supported).
 *
 * Accessibility: the two thumb clusters are `aria-hidden` — they duplicate keys a
 * screen-reader user drives the game with. **Pause is not**, because on a phone there
 * is no Escape key to duplicate: it was the one control with no non-visual route to it,
 * so it keeps a real label. Nothing here is in the tab order (`tabIndex = -1`);
 * keyboard users have real keys.
 *
 * The tool button is the exception to "the controls never change": it appears only once
 * a badge has actually armed a tool — the Workplace cutter, the hiring dragon's water
 * cannon, or the Tech Park's service hatch — because a fourth thumb target that does
 * nothing on four of the six screens is a control the player learns to ignore. It
 * relabels itself per tool (`setShootVisible`).
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
  /** The pause button. Raises the same edge Escape does; the Game owns the guards. */
  onPause?: () => void;
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
  /** The tool button, kept so its label can follow whichever tool is armed. */
  private readonly shootBtn: HTMLButtonElement;

  constructor(parent: HTMLElement, cb: TouchControlsCallbacks) {
    this.cb = cb;
    const doc = parent.ownerDocument;
    this.root = doc.createElement('div');
    this.root.className = 'beam-run__touch';

    const move = doc.createElement('div');
    move.className = 'beam-run__touch-zone beam-run__touch-zone--move';
    move.setAttribute('aria-hidden', 'true');
    const left = this.makeButton(doc, 'left', '\u25C0', COPY.controls.moveLeft);
    const right = this.makeButton(doc, 'right', '\u25B6', COPY.controls.moveRight);
    move.append(left, right);

    const jumpZone = doc.createElement('div');
    jumpZone.className = 'beam-run__touch-zone beam-run__touch-zone--jump';
    jumpZone.setAttribute('aria-hidden', 'true');
    const shoot = this.makeButton(doc, 'shoot', '\u25B8', COPY.controls.shoot);
    shoot.classList.add('beam-run__touch-btn--shoot');
    this.shootBtn = shoot;
    const jump = this.makeButton(doc, 'jump', '\u2B24', COPY.controls.jump);
    jump.classList.add('beam-run__touch-btn--jump');
    jumpZone.append(shoot, jump);

    this.root.append(move, jumpZone, this.makePause(doc));
    parent.appendChild(this.root);
  }

  /**
   * The pause button, top-centre, and the only control in this layer with an
   * accessible name that is meant to be read.
   *
   * It is a plain press rather than a held direction, so it does not go through
   * `setVirtual` — it hands the Game the same `pause` edge the Escape key produces and
   * lets the Game's existing guard decide. Because the whole layer is hidden while the
   * pause overlay is up, this button can only ever pause; resuming is the overlay's own
   * button, which is already focusable and labelled.
   */
  private makePause(doc: Document): HTMLElement {
    const zone = doc.createElement('div');
    zone.className = 'beam-run__touch-menu';
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'beam-run__touch-btn beam-run__touch-btn--pause';
    b.textContent = '\u275A\u275A';
    b.setAttribute('aria-label', COPY.controls.pause);
    b.tabIndex = -1;
    this.on(b, 'pointerdown', (e: Event) => {
      e.preventDefault();
      this.firstInteraction();
      b.classList.add('beam-run__touch-btn--active');
      this.cb.onPause?.();
    });
    const up = (e: Event): void => {
      e.preventDefault();
      b.classList.remove('beam-run__touch-btn--active');
    };
    this.on(b, 'pointerup', up);
    this.on(b, 'pointercancel', up);
    this.on(b, 'pointerleave', up);
    zone.appendChild(b);
    return zone;
  }

  private firstInteraction(): void {
    if (this.interacted) return;
    this.interacted = true;
    this.cb.onFirstInteraction?.();
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
      this.firstInteraction();
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
   * Show the tool button, and say what it does.
   *
   * Three things arm it now and they are three different actions — the Workplace
   * cutter, the hiring dragon's water cannon and the Tech Park's service hatch — so the
   * label is a parameter rather than a constant. It is the button's only affordance: the
   * glyph is an abstract arrow and nothing on the canvas explains any of them, so a
   * screen-reader user and a long-press tooltip both get their answer from here.
   */
  setShootVisible(visible: boolean, label: string = COPY.controls.shoot): void {
    this.root.classList.toggle('beam-run__touch--armed', visible);
    this.shootBtn.setAttribute('aria-label', label);
  }

  setLarger(larger: boolean): void {
    this.root.classList.toggle('beam-run__touch--large', larger);
  }

  /**
   * One-tap layout: forward motion is automatic, so the **forward** arrow goes and jump
   * grows — the whole game stays playable with a single thumb.
   *
   * No longer the default on touch (`ASSIST.AUTO_RUN_DEFAULT_ON_TOUCH`), but still an
   * assist option, so the layout stays.
   *
   * The **back** arrow stays, and that is a deliberate correction. This layout used to
   * hide the move pad entirely, which quietly made anything *behind* the player
   * unreachable: the Compliance badge is reached by hopping onto a floating step and
   * then jumping back the other way (owner call, `docs/SCREENS.md` §4.9), and with no
   * way to go left a phone player could never take GCC-BOT at all. One-tap means "you
   * never have to press forward", not "you cannot turn round".
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
