/**
 * AssistController — the single source of truth for the accessibility "assist"
 * options, and the one place that pushes them into the running game.
 *
 * Toggles:
 *  - slowMode        → scales the loop timeScale (−30%, geometry unchanged)
 *  - extraTime       → adds telegraph time (Simulation reads assist.extraTime)
 *  - noSetbacks      → explore freely; hazards stop booking months
 *  - autoRun         → one-tap play; the hero runs forward on its own
 *                      (defaults ON for touch, see Game — a non-gamer on a phone
 *                      should not have to drive a virtual d-pad)
 *  - largerControls  → enlarges the on-screen touch controls
 *  - muteMusic       → mutes the music bus (independent of the master M mute)
 *  - muteSfx         → mutes the sfx bus
 *
 * It is headless (no DOM) so the wiring is unit-testable: it mutates the sim's
 * assist state, the loop's timeScale, the input mode and the audio buses, and
 * announces each change through an injected callback (screen-reader `aria-live`).
 */
import { ASSIST } from '../data/tuning.config';
import { COPY } from '../data/copy';
import { DEFAULT_ASSIST, type AssistState } from './Simulation';

export type AssistToggle =
  | 'slowMode'
  | 'extraTime'
  | 'noSetbacks'
  | 'autoRun'
  | 'largerControls'
  | 'muteMusic'
  | 'muteSfx';

export interface AssistTargets {
  sim: { assist: AssistState };
  loop: { timeScale: number };
  audio: { setMuted(bus: 'music' | 'sfx', value: boolean): void };
  setLargerControls?: (larger: boolean) => void;
  setAutoRun?: (on: boolean) => void;
}

const LABELS: Record<AssistToggle, string> = {
  slowMode: COPY.assist.slowMode,
  extraTime: COPY.assist.extraTime,
  noSetbacks: COPY.assist.noSetbacks,
  autoRun: COPY.assist.autoRun,
  largerControls: COPY.assist.largerControls,
  muteMusic: COPY.assist.muteMusic,
  muteSfx: COPY.assist.muteSfx,
};

export interface AssistDefaults {
  /** Start with one-tap auto-run on (touch devices). */
  autoRun?: boolean;
  largerControls?: boolean;
}

export class AssistController {
  readonly values: Record<AssistToggle, boolean> = {
    slowMode: DEFAULT_ASSIST.slowMode,
    extraTime: DEFAULT_ASSIST.extraTime,
    noSetbacks: DEFAULT_ASSIST.noSetbacks,
    autoRun: DEFAULT_ASSIST.autoRun,
    largerControls: DEFAULT_ASSIST.largerControls,
    muteMusic: false,
    muteSfx: false,
  };

  constructor(
    private readonly targets: AssistTargets,
    private readonly announce?: (message: string) => void,
    private readonly onChange?: (option: AssistToggle, enabled: boolean) => void,
    defaults: AssistDefaults = {},
  ) {
    if (defaults.autoRun !== undefined) this.values.autoRun = defaults.autoRun;
    if (defaults.largerControls !== undefined) {
      this.values.largerControls = defaults.largerControls;
    }
    this.applyGameplay();
  }

  isOn(key: AssistToggle): boolean {
    return this.values[key];
  }

  toggle(key: AssistToggle): boolean {
    return this.set(key, !this.values[key]);
  }

  set(key: AssistToggle, value: boolean): boolean {
    this.values[key] = value;
    if (key === 'muteMusic') this.targets.audio.setMuted('music', value);
    else if (key === 'muteSfx') this.targets.audio.setMuted('sfx', value);
    else this.applyGameplay();
    this.announce?.(`${LABELS[key]}: ${value ? COPY.assist.on : COPY.assist.off}`);
    this.onChange?.(key, value);
    return value;
  }

  /** Reflect external mute changes (e.g. the master M key) into the toggles. */
  syncMutes(musicMuted: boolean, sfxMuted: boolean): void {
    this.values.muteMusic = musicMuted;
    this.values.muteSfx = sfxMuted;
  }

  private applyGameplay(): void {
    const s = this.targets.sim.assist;
    s.slowMode = this.values.slowMode;
    s.extraTime = this.values.extraTime;
    s.noSetbacks = this.values.noSetbacks;
    s.autoRun = this.values.autoRun;
    s.largerControls = this.values.largerControls;
    this.targets.loop.timeScale = this.values.slowMode ? ASSIST.SLOW_MODE_TIME_SCALE : 1;
    this.targets.setLargerControls?.(this.values.largerControls);
    this.targets.setAutoRun?.(this.values.autoRun);
  }
}
