/**
 * AudioEngine — Web Audio buses + procedurally-synthesised cues.
 *
 * Design (per doc 05 §6):
 *  - Two independently mutable buses: `music` and `sfx`, summed through a
 *    `master` gain into the destination. Master mute (M) toggles both.
 *  - Autoplay-safe: NOTHING sounds until the first user gesture. The graph is
 *    created lazily and the context stays suspended (master gain 0) until
 *    `unlock()` (the Start button counts as the gesture).
 *  - Ducking: key SFX (badge / setback / screen-clear / win) dip the music bus by
 *    ~6 dB for the cue's length, then ramp back.
 *  - Cues are synthesised (oscillator + envelope), so there are zero audio
 *    bytes to ship and the game is fully playable muted. A real OGG/MP3 pack can
 *    be layered in later behind the same API.
 *
 * The Web Audio context is injectable so the engine is unit-testable headlessly
 * (jsdom has no AudioContext). We depend only on the minimal surface below, which
 * the real `AudioContext` satisfies structurally.
 */

export type Bus = 'music' | 'sfx';
export type SfxCue =
  | 'jump'
  | 'land'
  | 'pickup'
  | 'badge'
  /** A delay was booked. A dull thud, deliberately not a "death" sting. */
  | 'setback'
  | 'screenClear'
  | 'win'
  /** The hiring dragon's opening roar — the whole of its safe beat is audible. */
  | 'roar'
  /** The water cannon firing. */
  | 'water'
  /** Water meeting fire: the hiss that says the exchange was won. */
  | 'steam'
  /** A layer of the dragon's costume coming off. */
  | 'strip'
  /** Five candidates on the floor, hired. */
  | 'hired';

interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, when: number): void;
  linearRampToValueAtTime(value: number, when: number): void;
  cancelScheduledValues?(when: number): void;
}
interface GainLike {
  readonly gain: AudioParamLike;
  connect(node: unknown): void;
  disconnect?(): void;
}
interface OscLike {
  type: string;
  readonly frequency: AudioParamLike;
  connect(node: unknown): void;
  start(when?: number): void;
  stop(when?: number): void;
}
export interface AudioContextLike {
  readonly state: string;
  readonly currentTime: number;
  readonly destination: unknown;
  createGain(): GainLike;
  createOscillator(): OscLike;
  resume(): Promise<void>;
  close?(): Promise<void>;
}

export interface AudioOptions {
  /** Injectable context factory (defaults to the browser AudioContext). */
  createContext?: () => AudioContextLike | null;
}

const MUSIC_LEVEL = 0.32;
const SFX_LEVEL = 0.85;
const DUCK_FACTOR = 0.5; // ~ -6 dB

function defaultFactory(): AudioContextLike | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    (window as unknown as { AudioContext?: new () => AudioContextLike }).AudioContext ??
    (window as unknown as { webkitAudioContext?: new () => AudioContextLike }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

const KEY_CUES: ReadonlySet<SfxCue> = new Set([
  'badge',
  'setback',
  'screenClear',
  'win',
  // The roar and the hire are the two beats on Hire Under Fire the player is meant
  // to stop and listen to. `water` deliberately is not: it fires several times a
  // second, and ducking the music on every jet would pump the whole mix.
  'roar',
  'hired',
]);

export class AudioEngine {
  private readonly createContext: () => AudioContextLike | null;
  private ctx: AudioContextLike | null = null;
  private master: GainLike | null = null;
  private musicBus: GainLike | null = null;
  private sfxBus: GainLike | null = null;

  private readonly muted: Record<Bus, boolean> = { music: false, sfx: false };
  private _unlocked = false;
  private _musicOn = false;

  constructor(opts: AudioOptions = {}) {
    this.createContext = opts.createContext ?? defaultFactory;
  }

  /** True until the first user gesture creates + resumes the context. */
  get suspended(): boolean {
    return !this.ctx || this.ctx.state !== 'running';
  }
  get unlocked(): boolean {
    return this._unlocked;
  }
  get musicOn(): boolean {
    return this._musicOn;
  }
  isMuted(bus: Bus): boolean {
    return this.muted[bus];
  }
  get allMuted(): boolean {
    return this.muted.music && this.muted.sfx;
  }

  /** Create the graph (lazy). Safe to call repeatedly / when Web Audio absent. */
  private ensureGraph(): void {
    if (this.ctx) return;
    const ctx = this.createContext();
    if (!ctx) return;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(ctx.destination);
    this.applyGains();
  }

  /** Unlock audio on a user gesture (Start button). Resumes the context. */
  async unlock(): Promise<void> {
    if (this._unlocked) {
      // Still (re)attempt a resume if the context was auto-suspended.
      if (this.ctx && this.ctx.state !== 'running') await this.safeResume();
      return;
    }
    this.ensureGraph();
    this._unlocked = true;
    await this.safeResume();
    this.applyGains();
  }

  private async safeResume(): Promise<void> {
    if (!this.ctx) return;
    try {
      await this.ctx.resume();
    } catch {
      /* resume can reject if called without a gesture; ignore */
    }
  }

  private applyGains(): void {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    // Master is silent until unlocked (autoplay-safe).
    this.master.gain.value = this._unlocked ? 1 : 0;
    this.musicBus.gain.value = this.muted.music ? 0 : MUSIC_LEVEL;
    this.sfxBus.gain.value = this.muted.sfx ? 0 : SFX_LEVEL;
  }

  // --- mute controls --------------------------------------------------------

  setMuted(bus: Bus, value: boolean): void {
    this.muted[bus] = value;
    this.applyGains();
  }
  toggleMuted(bus: Bus): boolean {
    this.setMuted(bus, !this.muted[bus]);
    return this.muted[bus];
  }
  /** Master mute (M): mutes both if either is on, else unmutes both. */
  toggleMuteAll(): boolean {
    const next = !this.allMuted;
    this.muted.music = next;
    this.muted.sfx = next;
    this.applyGains();
    return next;
  }

  // --- cues -----------------------------------------------------------------

  startMusic(): void {
    this._musicOn = true;
    // The ambient bed is a soft, low pad; kept minimal here (procedural).
    // A looped buffer/OGG can replace this behind the same call later.
  }
  stopMusic(): void {
    this._musicOn = false;
  }

  /** Play a one-shot SFX cue. Returns true if it actually sounded. */
  playSfx(cue: SfxCue): boolean {
    if (this.suspended || !this.ctx || !this.sfxBus) return false;
    if (this.muted.sfx) return false;
    switch (cue) {
      case 'jump':
        this.tone(220, 480, 'sine', 0.12, 0.5);
        break;
      case 'land':
        this.tone(180, 120, 'sine', 0.09, 0.4);
        break;
      case 'pickup':
        this.tone(520, 660, 'triangle', 0.06, 0.4);
        this.tone(780, 880, 'triangle', 0.09, 0.35, 0.05);
        break;
      case 'badge':
        this.tone(660, 990, 'triangle', 0.14, 0.5);
        this.tone(990, 1320, 'sine', 0.18, 0.4, 0.08);
        break;
      case 'setback':
        // Low, short, unglamorous: time lost, not a life lost.
        this.tone(240, 150, 'sine', 0.24, 0.42);
        break;
      case 'screenClear':
        this.tone(523, 523, 'triangle', 0.12, 0.4);
        this.tone(659, 659, 'triangle', 0.12, 0.4, 0.12);
        this.tone(784, 784, 'triangle', 0.2, 0.4, 0.24);
        break;
      case 'win':
        this.tone(523, 523, 'triangle', 0.25, 0.45);
        this.tone(659, 659, 'triangle', 0.25, 0.45, 0.18);
        this.tone(784, 988, 'sine', 0.6, 0.4, 0.36);
        break;
      case 'roar':
        // Two saws falling a long way, the second under the first: with no noise
        // source and no filter, a growl has to be built out of low detuned ramps.
        // Long on purpose — it plays over the dragon's whole safe beat.
        this.tone(150, 62, 'sawtooth', 0.85, 0.5);
        this.tone(97, 44, 'sawtooth', 1.05, 0.42, 0.05);
        this.tone(320, 120, 'square', 0.35, 0.16, 0.02);
        break;
      case 'water':
        // A short upward hiss. Rising, because it is leaving the barrel; quiet,
        // because it can fire six times a second and must never tire the ear.
        this.tone(880, 1560, 'sine', 0.1, 0.24);
        this.tone(1320, 2100, 'triangle', 0.07, 0.12, 0.01);
        break;
      case 'steam':
        // Water winning: high, falling, short. The mirror of the jet.
        this.tone(2100, 900, 'sine', 0.18, 0.2);
        this.tone(1500, 700, 'triangle', 0.14, 0.12, 0.02);
        break;
      case 'strip':
        // Something coming off: a low pluck with a bright tick on top.
        this.tone(420, 180, 'square', 0.14, 0.3);
        this.tone(1180, 1180, 'triangle', 0.06, 0.18, 0.03);
        break;
      case 'hired':
        // Celebratory, and pointedly the same major arpeggio as `win` a fifth up:
        // this is the same kind of moment, one screen early.
        this.tone(784, 784, 'triangle', 0.13, 0.42);
        this.tone(988, 988, 'triangle', 0.13, 0.42, 0.11);
        this.tone(1175, 1175, 'triangle', 0.13, 0.42, 0.22);
        this.tone(1568, 1568, 'sine', 0.4, 0.36, 0.33);
        break;
    }
    if (KEY_CUES.has(cue)) this.duck();
    return true;
  }

  /** Dip the music bus by ~6 dB briefly (ducking under key SFX). */
  private duck(duration = 0.4): void {
    if (!this.ctx || !this.musicBus || this.muted.music) return;
    const base = MUSIC_LEVEL;
    const t0 = this.ctx.currentTime;
    const g = this.musicBus.gain;
    g.cancelScheduledValues?.(t0);
    g.setValueAtTime(base, t0);
    g.linearRampToValueAtTime(base * DUCK_FACTOR, t0 + 0.03);
    g.linearRampToValueAtTime(base, t0 + duration);
  }

  private tone(
    freq: number,
    freqEnd: number,
    type: OscLike['type'],
    dur: number,
    gain: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== freq) osc.frequency.linearRampToValueAtTime(freqEnd, t0 + dur);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.3));
    env.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(env);
    env.connect(this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  destroy(): void {
    this.stopMusic();
    if (this.ctx && this.ctx.close) {
      void this.ctx.close();
    }
    this.ctx = null;
    this.master = this.musicBus = this.sfxBus = null;
    this._unlocked = false;
  }
}
