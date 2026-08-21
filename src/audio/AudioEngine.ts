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
  /** Setup Delays: a DENIED stamp slamming into the floor. */
  | 'stampThud'
  /**
   * Setup Delays: the same stamp meeting an ANSR-backed player — the thud that
   * did not work. Muffled, short, and with none of the floor thud's brightness.
   */
  | 'stampDud'
  /** The Workplace: the wrapped figure himself, groaning as he winds up a throw. */
  | 'mummy'
  /** The Workplace: the bandage leaving his hand. A hush, not an impact. */
  | 'hush'
  /** The Workplace: the freed colleague starting on the keyboard. */
  | 'typing'
  /** The Workplace: the unfixed terminal arcing. */
  | 'spark'
  /** The Workplace: the terminal reporting OK. */
  | 'chime'
  /** The hiring dragon's opening roar — the whole of its safe beat is audible. */
  | 'roar'
  /** The water cannon firing. */
  | 'water'
  /** Water meeting fire: the hiss that says the exchange was won. */
  | 'steam'
  /** A layer of the dragon's costume coming off. */
  | 'strip'
  /** The dragon going down: the one cue on this screen with real weight. */
  | 'topple'
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
interface AudioBufferLike {
  getChannelData(channel: number): Float32Array;
}
interface BufferSourceLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
  connect(node: unknown): void;
  start(when?: number, offset?: number): void;
  stop(when?: number): void;
}
interface BiquadLike {
  type: string;
  readonly frequency: AudioParamLike;
  readonly Q: AudioParamLike;
  connect(node: unknown): void;
}
export interface AudioContextLike {
  readonly state: string;
  readonly currentTime: number;
  readonly destination: unknown;
  createGain(): GainLike;
  createOscillator(): OscLike;
  resume(): Promise<void>;
  close?(): Promise<void>;
  /**
   * The noise half of the engine, and **optional on purpose**: a host (or a test
   * double) that only implements oscillators still works, it just gets the tonal
   * layer of each cue. Every cue below therefore carries its meaning in its tones
   * and uses noise for the texture, never the other way round.
   */
  readonly sampleRate?: number;
  createBuffer?(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource?(): BufferSourceLike;
  createBiquadFilter?(): BiquadLike;
}

export interface AudioOptions {
  /** Injectable context factory (defaults to the browser AudioContext). */
  createContext?: () => AudioContextLike | null;
}

const MUSIC_LEVEL = 0.32;
const SFX_LEVEL = 0.85;
const DUCK_FACTOR = 0.5; // ~ -6 dB
/** Seconds of white noise, generated once and looped by every noise layer. */
const NOISE_SECONDS = 1;

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
  // The roar, the topple and the hire are the beats on Hire Under Fire the player is
  // meant to stop and listen to. `water` deliberately is not: it fires several times a
  // second, and ducking the music on every jet would pump the whole mix. The Workplace's
  // `chime` is in for the same reason as `screenClear` — it is that screen's win.
  'roar',
  'topple',
  'hired',
  'chime',
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
  /** One second of white noise, built on first use and looped by every burst. */
  private noiseBuffer: AudioBufferLike | null = null;
  /**
   * Where in that second the next burst starts reading, advanced by an irrational-ish
   * step each time. Without it every jet from the water cannon reads the same grain and
   * six a second phase-lock into a tone, which is the exact defect the noise was added
   * to fix.
   */
  private noiseCursor = 0;
  /** Level for the cue being built right now (see `playSfx`); always 1 between cues. */
  private cueLevel = 1;

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

  /**
   * Play a one-shot SFX cue. Returns true if it actually sounded.
   *
   * `level` (0..1) scales every layer of the cue, and exists for one reason: the DENIED
   * stamps. Four of them land every 1.4s from anywhere on the screen, and at one volume
   * that is a drum machine — so the host sends the near ones loud and the far ones as a
   * pulse under everything, which turns a nuisance into information about which column
   * is about to matter. Anything that is *about* the player stays at 1.
   */
  playSfx(cue: SfxCue, level = 1): boolean {
    if (this.suspended || !this.ctx || !this.sfxBus) return false;
    if (this.muted.sfx) return false;
    this.cueLevel = Math.max(0, Math.min(1, level));
    switch (cue) {
      case 'jump':
        this.tone(220, 480, 'sine', 0.12, 0.5);
        break;
      case 'land':
        this.tone(180, 120, 'sine', 0.09, 0.4);
        break;
      case 'pickup':
        // The small change off `badge`: the same two-note open fifth, no tail.
        this.tone(587, 587, 'triangle', 0.1, 0.3);
        this.tone(880, 880, 'triangle', 0.14, 0.26, 0.06);
        break;
      case 'badge':
        /*
         * Taking the ANSR mark (owner call: the old cue was two rising blips and
         * sounded like a menu beep). This is the most valuable thing on any screen, so
         * it is built like a reward instead of a notification:
         *
         *  - a **low fifth underneath** for weight, so the cue has a body and not just
         *    a top end. Nothing else in the game plays below 200 Hz on a *good* event;
         *  - an **open arpeggio** — D, A, D, A over two octaves. Bare fifths and octaves
         *    only, so it cannot sound minor, and no two notes of it beat against each
         *    other the way the old 660/990 pair did;
         *  - a **bell tail** two octaves up that outlives the arpeggio, which is what
         *    makes it read as a chime rather than a bleep;
         *  - a **sparkle**: a thin band of noise sweeping up through the top of the
         *    spectrum. This is the layer no oscillator could give it.
         */
        this.tone(147, 147, 'sine', 0.22, 0.2);
        this.tone(587, 587, 'triangle', 0.16, 0.34);
        this.tone(880, 880, 'triangle', 0.16, 0.32, 0.07);
        this.tone(1175, 1175, 'triangle', 0.16, 0.3, 0.14);
        this.tone(1760, 1760, 'sine', 0.5, 0.26, 0.21);
        this.tone(3520, 3520, 'sine', 0.7, 0.07, 0.22);
        this.noise(2600, 7200, 0.32, 0.13, 0.02, 3.2, 'bandpass');
        break;
      case 'stampThud': {
        /*
         * A DENIED stamp reaching the floor. Three layers, and the order they decay in
         * is what makes it a mass landing rather than a click: the impact transient goes
         * first, the noise body next, the pitch-dropping sub last.
         */
        this.tone(140, 34, 'sine', 0.3, 0.5);
        this.tone(220, 70, 'square', 0.06, 0.16);
        this.noise(1100, 130, 0.24, 0.42, 0, 0.7, 'lowpass');
        break;
      }
      case 'stampDud': {
        /*
         * The same stamp arriving on an ANSR-backed player (owner call: "a muffled low
         * power thud, as if the thud didn't work"). It is the floor thud with everything
         * that made it land taken away — no transient, no top end, a shorter and much
         * lower sub, and a lowpass that never opens above 260 Hz. It is deliberately the
         * *same* sound family: the player should hear the stamp fail, not hear a
         * different stamp.
         */
        this.tone(76, 48, 'sine', 0.2, 0.34);
        this.noise(240, 90, 0.16, 0.3, 0, 0.5, 'lowpass');
        break;
      }
      case 'mummy':
        // The wrapped figure himself, winding up. A groan under two detuned saws with a
        // breath of muffled noise over it — low enough not to compete with the hush that
        // follows it 0.55s later, which is the throw it is warning about.
        this.tone(132, 96, 'sawtooth', 0.46, 0.24);
        this.tone(99, 68, 'sawtooth', 0.52, 0.2, 0.04);
        this.noise(520, 200, 0.4, 0.17, 0.02, 0.8, 'lowpass');
        break;
      case 'hush':
        // The bandage leaving his hand: a falling band of noise, which is what cloth
        // through air is. The tone under it is almost inaudible and only there so the
        // cue still exists on a host with no noise source.
        this.noise(2000, 520, 0.28, 0.5, 0, 1.6, 'bandpass');
        this.tone(760, 300, 'sine', 0.2, 0.08);
        break;
      case 'typing': {
        // Somebody starting on the keyboard: seven keystrokes, unevenly spaced, because
        // a fixed interval reads as a machine and this is a person. Each one is a click
        // of high noise with a wooden tick under it.
        const gaps = [0, 0.1, 0.17, 0.27, 0.33, 0.44, 0.52];
        for (let i = 0; i < gaps.length; i += 1) {
          this.noise(2300, 1500, 0.03, 0.3, gaps[i]!, 2.4, 'bandpass');
          this.tone(880 + i * 40, 640, 'square', 0.025, 0.07, gaps[i]!);
        }
        break;
      }
      case 'spark': {
        /*
         * The unfixed terminal arcing (owner call: "add spark sound in the workplace
         * screen when things are not fixed" — the cue existed and could not be heard).
         *
         * What was wrong with it was not the level knob, it was **where the energy
         * sat**: a 120 Hz square at 0.08 plus three 35ms bandpass cracks at Q 4 up
         * around 3-4.8 kHz. Both ends of that are the two places a laptop or phone
         * speaker gives you nothing — well under its low roll-off, and a needle-thin
         * band up where it is already rolling off again. So it measured as a cue and
         * played as silence.
         *
         * Rebuilt into the band a small speaker actually reproduces, and built the way
         * an arc is: a **snap** with a **tail**, three times.
         *  - the buzz keeps its 120 Hz body but carries an octave over it at 240, which
         *    is the lowest thing on a phone that is genuinely audible;
         *  - each crack is a **wide** burst (Q 1.1, not 4) falling 5200 -> 900 over 70ms,
         *    so it has a body instead of a whistle;
         *  - a square tick under each one drops 2 kHz -> 700, which is the transient. It
         *    is also what keeps the cue alive on a host with no noise source.
         *
         * Still the quietest thing on the screen relative to the chime, because it
         * repeats every `SPARK_INTERVAL` for as long as the room is broken: it has to
         * read as a room the player is standing in, not as an alarm. Audible and
         * ignorable are not the same axis.
         */
        this.tone(120, 110, 'square', 0.22, 0.14);
        this.tone(240, 226, 'square', 0.18, 0.1);
        const cracks = [0, 0.08, 0.17];
        for (let i = 0; i < cracks.length; i += 1) {
          this.noise(5200 - i * 700, 900, 0.07, 0.5, cracks[i]!, 1.1, 'bandpass');
          this.tone(2000 - i * 240, 700, 'square', 0.05, 0.12, cracks[i]!);
        }
        break;
      }
      case 'chime':
        // The terminal reporting OK: a clean two-note bell with a long tail. The room is
        // fixed, so this is the only cue on the screen that is allowed to ring.
        this.tone(1046, 1046, 'sine', 0.5, 0.3);
        this.tone(1568, 1568, 'sine', 0.75, 0.24, 0.09);
        this.tone(2093, 2093, 'sine', 0.9, 0.1, 0.1);
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
        /*
         * The cannon (owner call: the two sine blips it used to be sounded like a toy).
         * Water is broadband — it has no pitch at all — so the jet is now a band of
         * noise opening upward as it leaves the barrel, with a short low chuff under it
         * for the valve. Still the quietest cue in the game: it fires up to six times a
         * second and each shot has to disappear into the stream rather than announce
         * itself. `noiseCursor` is what stops six of them phase-locking into a whistle.
         */
        this.noise(420, 2800, 0.16, 0.5, 0, 0.9, 'bandpass');
        this.tone(190, 96, 'sine', 0.07, 0.1);
        break;
      case 'steam':
        // Water winning: the mirror of the jet, so it is the same noise band running the
        // other way — wide open and closing down, longer and softer, which is what a
        // cloud sounds like next to a stream.
        this.noise(5200, 700, 0.34, 0.42, 0, 0.6, 'bandpass');
        this.tone(1900, 800, 'sine', 0.12, 0.07);
        break;
      case 'strip':
        // Something coming off: a tear of noise with a low pluck under it and a bright
        // tick on top. The tear is the layer; the pluck is the weight of it landing.
        this.noise(1600, 380, 0.14, 0.4, 0, 1.4, 'bandpass');
        this.tone(420, 180, 'square', 0.14, 0.24);
        this.tone(1180, 1180, 'triangle', 0.06, 0.14, 0.03);
        break;
      case 'topple': {
        /*
         * The dragon going down (owner call: it had no cue of its own at all — the fourth
         * hit played `strip`, so the biggest event on the screen sounded exactly like the
         * three small ones before it).
         *
         * Built as a *fall*, in two parts, because that is what is on screen: a long
         * descending groan with a rumble under it while it goes over, and then a floor
         * impact half a second later when it arrives. Nothing else in the game reaches
         * 26 Hz or lasts a second.
         */
        this.tone(124, 30, 'sawtooth', 1.05, 0.44);
        this.tone(88, 26, 'sawtooth', 1.15, 0.34, 0.04);
        this.tone(300, 90, 'square', 0.4, 0.1, 0.02);
        this.noise(320, 70, 0.9, 0.34, 0.02, 0.5, 'lowpass');
        // Landing.
        this.tone(90, 28, 'sine', 0.44, 0.5, 0.58);
        this.noise(900, 90, 0.36, 0.44, 0.58, 0.6, 'lowpass');
        break;
      }
      case 'hired':
        // Celebratory, and pointedly the same major arpeggio as `win` a fifth up:
        // this is the same kind of moment, one screen early.
        this.tone(784, 784, 'triangle', 0.13, 0.42);
        this.tone(988, 988, 'triangle', 0.13, 0.42, 0.11);
        this.tone(1175, 1175, 'triangle', 0.13, 0.42, 0.22);
        this.tone(1568, 1568, 'sine', 0.4, 0.36, 0.33);
        break;
    }
    this.cueLevel = 1;
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

  /**
   * One second of white noise, generated once and looped by every burst.
   *
   * Filled from a small LCG rather than `Math.random()`: the grain is then identical
   * on every machine and in every run, and the project's no-`Math.random()` habit does
   * not get a quiet exception in the audio layer. Returns null on a host with no
   * `createBuffer`, which is the signal for `noise()` to do nothing at all.
   */
  private getNoiseBuffer(): AudioBufferLike | null {
    if (this.noiseBuffer) return this.noiseBuffer;
    const ctx = this.ctx;
    if (!ctx?.createBuffer) return null;
    const rate = ctx.sampleRate ?? 44100;
    const len = Math.max(1, Math.floor(rate * NOISE_SECONDS));
    const buf = ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    if (!data) return null;
    let s = 0x9e3779b9;
    for (let i = 0; i < len; i += 1) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      data[i] = (s / 0x100000000) * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  /**
   * One filtered burst of noise: the texture layer of a cue.
   *
   * A thud, a hiss, a jet of water, cloth through air and an electrical arc are all
   * noise shaped by a filter — none of them has a pitch, and every attempt to fake one
   * out of oscillators in this file ended up sounding like a beep, which is exactly the
   * note the owner sent back. The frequency ramp on the filter is the whole character:
   * opening upward is something leaving, closing downward is something settling.
   *
   * Silently does nothing where the host has no buffer source or biquad (jsdom, and
   * the test double until it was taught both), so every cue still sounds — thinner —
   * on an oscillator-only context.
   */
  private noise(
    from: number,
    to: number,
    dur: number,
    gain: number,
    delay = 0,
    q = 0.9,
    type: 'lowpass' | 'bandpass' | 'highpass' = 'lowpass',
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    if (!ctx.createBufferSource || !ctx.createBiquadFilter) return;
    const buf = this.getNoiseBuffer();
    if (!buf) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, t0);
    if (to !== from) filter.frequency.linearRampToValueAtTime(to, t0 + dur);
    filter.Q.value = q;
    const env = ctx.createGain();
    const peak = gain * this.cueLevel;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.012, dur * 0.25));
    env.gain.linearRampToValueAtTime(0, t0 + dur);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.sfxBus);
    this.noiseCursor = (this.noiseCursor + 0.137) % 1;
    src.start(t0, this.noiseCursor * NOISE_SECONDS);
    src.stop(t0 + dur + 0.02);
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
    env.gain.linearRampToValueAtTime(gain * this.cueLevel, t0 + Math.min(0.02, dur * 0.3));
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
    // The buffer belongs to the closed context; a new one has to be regenerated.
    this.noiseBuffer = null;
    this._unlocked = false;
  }
}
