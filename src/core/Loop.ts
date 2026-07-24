/**
 * Loop — fixed-timestep game loop with a decoupled, interpolated render.
 *
 * The simulation advances in fixed `FIXED_DT` steps (60 Hz) driven by an
 * accumulator, so behaviour is identical at 60/120/144 Hz and after frame
 * hitches. Rendering happens once per animation frame with an `alpha`
 * interpolation factor. A `MAX_FRAME_DT` clamp prevents a spiral-of-death when
 * returning from a backgrounded tab.
 *
 * `now` / `raf` / `caf` are injectable so the loop is unit-testable headlessly.
 */
import { LOOP } from '../data/tuning.config';

export interface AccumulatorResult {
  /** Remaining sub-step time carried to the next frame. */
  acc: number;
  /** Number of fixed steps to run this frame. */
  steps: number;
  /** Interpolation factor in [0, 1) for the render. */
  alpha: number;
  /** The frame delta actually consumed after clamping. */
  clampedDt: number;
}

/**
 * Pure accumulator advance — no side effects, fully testable.
 * `timeScale` scales sim speed (assist "slow mode") without breaking the
 * determinism of ratios.
 */
export function advanceAccumulator(
  acc: number,
  frameDt: number,
  fixedDt: number,
  maxFrameDt: number,
  timeScale = 1,
): AccumulatorResult {
  const clampedDt = Math.min(frameDt, maxFrameDt) * timeScale;
  let next = acc + clampedDt;
  let steps = 0;
  while (next >= fixedDt) {
    next -= fixedDt;
    steps += 1;
  }
  const alpha = next / fixedDt;
  return { acc: next, steps, alpha, clampedDt };
}

export interface LoopOptions {
  step: (dt: number) => void;
  render: (alpha: number) => void;
  fixedDt?: number;
  maxFrameDt?: number;
  now?: () => number;
  raf?: (cb: (t: number) => void) => number;
  caf?: (handle: number) => void;
}

export class Loop {
  readonly fixedDt: number;
  readonly maxFrameDt: number;
  /** Assist slow-mode multiplier (1 = normal). */
  timeScale = 1;

  private readonly stepFn: (dt: number) => void;
  private readonly renderFn: (alpha: number) => void;
  private readonly now: () => number;
  private readonly raf: (cb: (t: number) => void) => number;
  private readonly caf: (handle: number) => void;

  private acc = 0;
  private last = 0;
  private handle: number | null = null;
  private running = false;

  // Diagnostics for the debug overlay.
  private _fps = 0;
  private _fpsSamples = 0;
  private _fpsElapsed = 0;
  lastSteps = 0;

  constructor(opts: LoopOptions) {
    this.stepFn = opts.step;
    this.renderFn = opts.render;
    this.fixedDt = opts.fixedDt ?? LOOP.FIXED_DT;
    this.maxFrameDt = opts.maxFrameDt ?? LOOP.MAX_FRAME_DT;
    this.now = opts.now ?? (() => performance.now());
    this.raf = opts.raf ?? ((cb) => requestAnimationFrame(cb));
    this.caf = opts.caf ?? ((h) => cancelAnimationFrame(h));
  }

  get isRunning(): boolean {
    return this.running;
  }

  get fps(): number {
    return this._fps;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = this.now();
    this.acc = 0;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.handle !== null) {
      this.caf(this.handle);
      this.handle = null;
    }
  }

  private schedule(): void {
    this.handle = this.raf((t) => this.frame(t));
  }

  /** One animation frame. Exposed for deterministic tests. */
  frame(nowMs: number): void {
    if (!this.running) return;

    const frameDt = (nowMs - this.last) / 1000;
    this.last = nowMs;

    const result = advanceAccumulator(
      this.acc,
      frameDt,
      this.fixedDt,
      this.maxFrameDt,
      this.timeScale,
    );
    this.acc = result.acc;
    this.lastSteps = result.steps;

    for (let i = 0; i < result.steps; i += 1) {
      this.stepFn(this.fixedDt);
    }
    this.renderFn(result.alpha);

    // FPS sampling (~4x/sec).
    this._fpsSamples += 1;
    this._fpsElapsed += frameDt;
    if (this._fpsElapsed >= 0.25) {
      this._fps = Math.round(this._fpsSamples / this._fpsElapsed);
      this._fpsSamples = 0;
      this._fpsElapsed = 0;
    }

    this.schedule();
  }
}
