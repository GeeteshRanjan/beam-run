import { describe, it, expect } from 'vitest';
import { AudioEngine, type AudioContextLike } from './AudioEngine';

/**
 * Minimal mock of the Web Audio surface the engine uses.
 *
 * `noise` is optional in `AudioContextLike` on purpose (a host without a buffer source
 * still gets every cue's tonal layer), so the double implements both halves and the
 * "oscillator-only" case is covered by `makeToneOnlyContext` below.
 */
function makeMockContext() {
  let state = 'suspended';
  const oscillators: { started: boolean }[] = [];
  const sources: { started: boolean; looped: boolean }[] = [];
  const filters: { type: string }[] = [];
  const gains: { value: number; peak: number }[] = [];
  const ctx: AudioContextLike & {
    _oscillators: typeof oscillators;
    _sources: typeof sources;
    _filters: typeof filters;
    _gains: typeof gains;
    _setState: (s: string) => void;
  } = {
    get state() {
      return state;
    },
    currentTime: 0,
    destination: {},
    sampleRate: 48000,
    _oscillators: oscillators,
    _sources: sources,
    _filters: filters,
    _gains: gains,
    _setState: (s) => {
      state = s;
    },
    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    },
    createBufferSource() {
      const s = { started: false, looped: false };
      sources.push(s);
      return {
        buffer: null,
        set loop(v: boolean) {
          s.looped = v;
        },
        get loop() {
          return s.looped;
        },
        connect() {},
        start() {
          s.started = true;
        },
        stop() {},
      };
    },
    createBiquadFilter() {
      const f = { type: 'lowpass' };
      filters.push(f);
      return {
        set type(v: string) {
          f.type = v;
        },
        get type() {
          return f.type;
        },
        frequency: {
          value: 0,
          setValueAtTime() {},
          linearRampToValueAtTime() {},
        },
        Q: {
          value: 1,
          setValueAtTime() {},
          linearRampToValueAtTime() {},
        },
        connect() {},
      };
    },
    createGain() {
      // `peak` is the loudest value the envelope was ever scheduled at, which is what
      // the per-cue level test below reads.
      const g = { value: 1, peak: 0 };
      gains.push(g);
      return {
        gain: {
          value: 1,
          setValueAtTime(v: number) {
            this.value = v;
            g.peak = Math.max(g.peak, v);
          },
          linearRampToValueAtTime(v: number) {
            this.value = v;
            g.peak = Math.max(g.peak, v);
          },
          cancelScheduledValues() {},
        },
        connect() {},
        disconnect() {},
      };
    },
    createOscillator() {
      const o = { started: false };
      oscillators.push(o);
      return {
        type: 'sine',
        frequency: {
          value: 0,
          setValueAtTime() {},
          linearRampToValueAtTime() {},
        },
        connect() {},
        start() {
          o.started = true;
        },
        stop() {},
      };
    },
    resume() {
      state = 'running';
      return Promise.resolve();
    },
    close() {
      return Promise.resolve();
    },
  };
  return ctx;
}

/** The same double with the noise half taken away (jsdom, and older embed hosts). */
function makeToneOnlyContext() {
  const ctx = makeMockContext();
  const partial = ctx as Partial<AudioContextLike>;
  delete partial.createBuffer;
  delete partial.createBufferSource;
  delete partial.createBiquadFilter;
  return ctx;
}

/**
 * Every cue with a filtered-noise layer — the thuds, the hisses, the arc, the cloth and
 * the fall. All of them keep a tonal layer as well, which is what the tone-only test
 * below pins: noise is texture in this engine, never the whole cue.
 */
const NOISY_CUES = [
  'badge',
  'stampThud',
  'stampDud',
  'mummy',
  'hush',
  'typing',
  'spark',
  'water',
  'steam',
  'strip',
  'topple',
] as const;

describe('AudioEngine', () => {
  it('is suspended (silent) until the first gesture unlocks it', async () => {
    const engine = new AudioEngine({ createContext: makeMockContext });
    expect(engine.suspended).toBe(true);
    expect(engine.unlocked).toBe(false);
    // Cues do not sound before unlock.
    expect(engine.playSfx('jump')).toBe(false);

    await engine.unlock();
    expect(engine.unlocked).toBe(true);
    expect(engine.suspended).toBe(false);
    expect(engine.playSfx('jump')).toBe(true);
  });

  it('mutes each bus independently and via master mute', async () => {
    const engine = new AudioEngine({ createContext: makeMockContext });
    await engine.unlock();

    engine.setMuted('sfx', true);
    expect(engine.isMuted('sfx')).toBe(true);
    // A muted sfx bus does not sound.
    expect(engine.playSfx('pickup')).toBe(false);
    engine.setMuted('sfx', false);
    expect(engine.playSfx('pickup')).toBe(true);

    // Music mute is independent of sfx.
    engine.setMuted('music', true);
    expect(engine.isMuted('music')).toBe(true);
    expect(engine.isMuted('sfx')).toBe(false);

    // Master mute turns both on (either-on → all off first press).
    engine.setMuted('music', false);
    const first = engine.toggleMuteAll();
    expect(first).toBe(true);
    expect(engine.allMuted).toBe(true);
    const second = engine.toggleMuteAll();
    expect(second).toBe(false);
    expect(engine.allMuted).toBe(false);
  });

  it('carries every cue on tones alone when the host has no noise source', async () => {
    // A thud, a hiss and an arc are noise shaped by a filter, but no cue may *depend*
    // on one: jsdom has no buffer source, and neither does an embed host's polyfill.
    const ctx = makeToneOnlyContext();
    const engine = new AudioEngine({ createContext: () => ctx });
    await engine.unlock();
    for (const cue of NOISY_CUES) {
      const before = ctx._oscillators.length;
      expect(engine.playSfx(cue)).toBe(true);
      expect(ctx._oscillators.length).toBeGreaterThan(before);
    }
  });

  it('layers filtered noise into the cues that are noise in the world', async () => {
    const ctx = makeMockContext();
    const engine = new AudioEngine({ createContext: () => ctx });
    await engine.unlock();
    for (const cue of NOISY_CUES) {
      const before = ctx._sources.length;
      engine.playSfx(cue);
      expect(ctx._sources.length).toBeGreaterThan(before);
    }
    // Looped (the buffer is one second and the bursts are much shorter) and started.
    expect(ctx._sources.every((s) => s.started && s.looped)).toBe(true);
    // Bands as well as lowpasses: a hiss and a thud are not the same filter.
    expect(new Set(ctx._filters.map((f) => f.type)).size).toBeGreaterThan(1);
  });

  it('scales a whole cue by the level the caller asks for, and resets after it', async () => {
    // What keeps the four DENIED stamps from being a drum machine: the host sends the
    // far ones quiet. Every layer of the cue has to scale, tones and noise alike.
    const ctx = makeMockContext();
    const engine = new AudioEngine({ createContext: () => ctx });
    await engine.unlock();
    const peakOf = (cue: 'stampThud', level?: number) => {
      const from = ctx._gains.length;
      engine.playSfx(cue, level);
      return Math.max(...ctx._gains.slice(from).map((g) => g.peak));
    };
    const loud = peakOf('stampThud');
    const quiet = peakOf('stampThud', 0.25);
    expect(quiet).toBeCloseTo(loud * 0.25, 5);
    expect(peakOf('stampThud', 0)).toBe(0);
    // The level is per call, never sticky: the next cue is full weight again.
    expect(peakOf('stampThud')).toBeCloseTo(loud, 5);
  });

  it('makes the deflected stamp a quieter relative of the one that lands', async () => {
    // The muffled "it did not work" thud must stay in the same family as the floor
    // thud — same layers, fewer of them — so the player hears the stamp fail rather
    // than hearing a different stamp.
    const ctx = makeMockContext();
    const engine = new AudioEngine({ createContext: () => ctx });
    await engine.unlock();
    const before = { o: ctx._oscillators.length, s: ctx._sources.length };
    engine.playSfx('stampThud');
    const thud = {
      o: ctx._oscillators.length - before.o,
      s: ctx._sources.length - before.s,
    };
    const mid = { o: ctx._oscillators.length, s: ctx._sources.length };
    engine.playSfx('stampDud');
    const dud = { o: ctx._oscillators.length - mid.o, s: ctx._sources.length - mid.s };
    expect(dud.s).toBe(thud.s); // both have a noise body
    expect(dud.o).toBeLessThan(thud.o); // the dud has lost the impact transient
  });

  it('actually synthesises an oscillator for a cue when audible', async () => {
    const ctx = makeMockContext();
    const engine = new AudioEngine({ createContext: () => ctx });
    await engine.unlock();
    const before = ctx._oscillators.length;
    engine.playSfx('badge');
    expect(ctx._oscillators.length).toBeGreaterThan(before);
    expect(ctx._oscillators[ctx._oscillators.length - 1]!.started).toBe(true);
  });

  it('no-ops gracefully when Web Audio is unavailable', async () => {
    const engine = new AudioEngine({ createContext: () => null });
    await engine.unlock();
    expect(engine.suspended).toBe(true);
    expect(engine.playSfx('setback')).toBe(false);
    expect(() => engine.toggleMuteAll()).not.toThrow();
  });

  it('tracks the music bed on/off', () => {
    const engine = new AudioEngine({ createContext: makeMockContext });
    expect(engine.musicOn).toBe(false);
    engine.startMusic();
    expect(engine.musicOn).toBe(true);
    engine.stopMusic();
    expect(engine.musicOn).toBe(false);
  });
});
