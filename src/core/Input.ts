/**
 * Input — keyboard → engine-agnostic InputState.
 *
 * Edge-triggered signals (`jumpPressed`, `pausePressed`, `mutePressed`,
 * `anyPressed`) fire once per key-down and are cleared by `endFrame()`.
 * Level-triggered signals (`left`, `right`, `jumpHeld`) reflect the current
 * held state. Touch input (Task 13) feeds the same abstraction via
 * `setVirtual*`.
 *
 * Keys are captured only while the container is focused so the host page stays
 * scrollable (Tech Architecture §7).
 */
export type InputAction = 'left' | 'right' | 'jump' | 'shoot' | 'pause' | 'mute';

/** The actions the on-screen touch buttons can drive. */
export type VirtualControl = 'left' | 'right' | 'jump' | 'shoot';

export interface InputState {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  /**
   * Edge only, and used by exactly one screen: the Workplace cutter fires once per
   * press. Held-down auto-fire is deliberately not offered — three deliberate
   * shots is the beat that screen is built on.
   */
  shootPressed: boolean;
  pausePressed: boolean;
  mutePressed: boolean;
  /** Any mapped key went down this frame (used to skip the title card). */
  anyPressed: boolean;
}

/** A fully-neutral input frame. */
export const NEUTRAL_INPUT: Readonly<InputState> = {
  left: false,
  right: false,
  jumpPressed: false,
  jumpHeld: false,
  shootPressed: false,
  pausePressed: false,
  mutePressed: false,
  anyPressed: false,
};

/** Build a complete InputState from a partial (used by headless simulation/tests). */
export function makeInput(partial: Partial<InputState> = {}): InputState {
  return { ...NEUTRAL_INPUT, ...partial };
}

const KEY_MAP: Record<string, InputAction> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'jump',
  ArrowUp: 'jump',
  KeyW: 'jump',
  // Two keys for the cutter, both reachable without leaving the arrow keys or
  // WASD. Not Ctrl/Shift (browser and screen-reader shortcuts) and not Enter,
  // which activates whatever overlay button has focus.
  KeyF: 'shoot',
  KeyJ: 'shoot',
  Escape: 'pause',
  KeyP: 'pause',
  KeyM: 'mute',
};

/** Keys we handle and therefore prevent from scrolling the page when focused. */
const PREVENT_DEFAULT = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

const FORM_CONTROLS = /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/;
function isFormControl(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && typeof el.tagName === 'string' && FORM_CONTROLS.test(el.tagName);
}

export class Input {
  private held = new Set<InputAction>();
  private edges = { jump: false, shoot: false, pause: false, mute: false, any: false };

  // Virtual (touch) held state, merged with keyboard.
  private virtual = { left: false, right: false, jump: false, shoot: false };
  private virtualShootEdge = false;
  private virtualJumpEdge = false;

  /** One-tap play: forward motion is automatic, the only decision is when to act. */
  private autoRun = false;

  private target: (Window & typeof globalThis) | HTMLElement | null = null;
  private focused = true;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    if (!this.focused) return;
    // Don't hijack keys while an overlay button/control is focused.
    if (isFormControl(e.target)) return;
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    this.pressAction(action, e.repeat);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    this.releaseAction(action);
  };

  /** Programmatic press (also used by tests and touch controls). */
  pressAction(action: InputAction, repeat = false): void {
    const wasDown = this.held.has(action);
    this.held.add(action);
    if (!wasDown && !repeat) {
      this.edges.any = true;
      if (action === 'jump') this.edges.jump = true;
      if (action === 'shoot') this.edges.shoot = true;
      if (action === 'pause') this.edges.pause = true;
      if (action === 'mute') this.edges.mute = true;
    }
  }

  releaseAction(action: InputAction): void {
    this.held.delete(action);
  }

  setVirtual(dir: VirtualControl, down: boolean): void {
    const was = this.virtual[dir];
    this.virtual[dir] = down;
    if (down && !was) {
      if (dir === 'jump') this.virtualJumpEdge = true;
      if (dir === 'shoot') this.virtualShootEdge = true;
      if (dir === 'jump' || dir === 'shoot') this.edges.any = true;
    }
  }

  setFocused(focused: boolean): void {
    this.focused = focused;
    if (!focused) {
      this.held.clear();
      this.virtual.left = this.virtual.right = false;
      this.virtual.jump = this.virtual.shoot = false;
    }
  }

  /**
   * Enable/disable one-tap auto-run. The default on touch, because asking a
   * non-gamer executive to drive a platformer with virtual d-pad buttons is the
   * single biggest threat to finishing the run. Forward motion *is* the journey;
   * the only real decision is when to act.
   *
   * Only the held directions are synthesised — never the edge signals — so
   * auto-run can't start a run or skip a title card on its own.
   */
  setAutoRun(on: boolean): void {
    this.autoRun = on;
  }

  get isAutoRun(): boolean {
    return this.autoRun;
  }

  getState(): InputState {
    const left = this.held.has('left') || this.virtual.left;
    // Holding left still overrides auto-run, so backing up remains possible.
    const right = this.held.has('right') || this.virtual.right || (this.autoRun && !left);
    const jumpHeld = this.held.has('jump') || this.virtual.jump;
    const jumpPressed = this.edges.jump || this.virtualJumpEdge;
    return {
      left,
      right,
      jumpHeld,
      jumpPressed,
      shootPressed: this.edges.shoot || this.virtualShootEdge,
      pausePressed: this.edges.pause,
      mutePressed: this.edges.mute,
      anyPressed: this.edges.any,
    };
  }

  /** Clear edge signals. Call once per rendered frame, after the sim steps. */
  endFrame(): void {
    this.edges.jump = false;
    this.edges.shoot = false;
    this.edges.pause = false;
    this.edges.mute = false;
    this.edges.any = false;
    this.virtualJumpEdge = false;
    this.virtualShootEdge = false;
  }

  attach(target: (Window & typeof globalThis) | HTMLElement): void {
    this.target = target;
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener);
    this.target = null;
    this.held.clear();
  }
}
