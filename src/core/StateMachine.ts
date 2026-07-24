/**
 * StateMachine — a tiny, explicit finite state machine.
 *
 * Transitions are declared as an allow-list; illegal transitions are rejected
 * (no state can silently reach into another). An optional `onChange` hook fires
 * on every accepted transition — used for aria-live announcements and analytics.
 */
export class StateMachine<S extends string> {
  private _state: S;
  private readonly transitions: Readonly<Record<S, readonly S[]>>;
  private readonly onChange?: (from: S, to: S) => void;

  constructor(
    initial: S,
    transitions: Readonly<Record<S, readonly S[]>>,
    onChange?: (from: S, to: S) => void,
  ) {
    this._state = initial;
    this.transitions = transitions;
    this.onChange = onChange;
  }

  get state(): S {
    return this._state;
  }

  is(state: S): boolean {
    return this._state === state;
  }

  /** Whether a transition to `to` is currently legal. */
  can(to: S): boolean {
    return this.transitions[this._state]?.includes(to) ?? false;
  }

  /** Attempt a transition. Returns false (no-op) if illegal. */
  transitionTo(to: S): boolean {
    if (!this.can(to)) return false;
    const from = this._state;
    this._state = to;
    this.onChange?.(from, to);
    return true;
  }

  /**
   * Force a state regardless of the allow-list. Reserved for hard resets and
   * the kill switch (never for normal gameplay). Still fires onChange.
   */
  force(to: S): void {
    if (to === this._state) return;
    const from = this._state;
    this._state = to;
    this.onChange?.(from, to);
  }
}
