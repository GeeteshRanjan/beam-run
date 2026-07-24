/**
 * AssistController — the single source of truth for the accessibility "assist"
 * options, and the one place that pushes them into the running game.
 *
 * Toggles (all default OFF):
 *  - slowMode        → scales the loop timeScale (−30%, geometry unchanged)
 *  - extraTime       → adds telegraph time (Simulation reads assist.extraTime)
 *  - invincible      → practice mode; Simulation.kill() no-ops
 *  - largerControls  → enlarges the on-screen touch controls
 *  - muteMusic       → mutes the music bus (independent of the master M mute)
 *  - muteSfx         → mutes the sfx bus
 *
 * It is headless (no DOM) so the wiring is unit-testable: it mutates the sim's
 * assist state, the loop's timeScale and the audio buses, and announces each
 * change through an injected callback (screen-reader `aria-live`).
 */
import { ASSIST } from '../data/tuning.config';
import { COPY } from '../data/copy';
import { DEFAULT_ASSIST, type AssistState } from './Simulation';

export type AssistToggle =
  | 'slowMode'
  | 'extraTime'
  | 'invincible'
  | 'largerControls'
  | 'muteMusic'
  | 'muteSfx';

export interface AssistTargets {
  sim: { assist: AssistState };
  loop: { timeScale: number };
  audio: { setMuted(bus: 'music' | 'sfx', value: boolean): void };
  setLargerControls?: (larger: boolean) => void;
}

const LABELS: Record<AssistToggle, string> = {
  slowMode: COPY.assist.slowMode,
  extraTime: COPY.assist.extraTime,
  invincible: COPY.assist.invincible,
  largerControls: COPY.assist.largerControls,
  muteMusic: COPY.assist.muteMusic,
  muteSfx: COPY.assist.muteSfx,
};

export class AssistController {
  readonly values: Record<AssistToggle, boolean> = {
    slowMode: DEFAULT_ASSIST.slowMode,
    extraTime: DEFAULT_ASSIST.extraTime,
    invincible: DEFAULT_ASSIST.invincible,
    largerControls: DEFAULT_ASSIST.largerControls,
    muteMusic: false,
    muteSfx: false,
  };

  constructor(
    private readonly targets: AssistTargets,
    private readonly announce?: (message: string) => void,
    private readonly onChange?: (option: AssistToggle, enabled: boolean) => void,
  ) {
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
    s.invincible = this.values.invincible;
    s.largerControls = this.values.largerControls;
    this.targets.loop.timeScale = this.values.slowMode ? ASSIST.SLOW_MODE_TIME_SCALE : 1;
    this.targets.setLargerControls?.(this.values.largerControls);
  }
}
