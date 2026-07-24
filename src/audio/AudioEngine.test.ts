import { describe, it, expect } from 'vitest';
import { AudioEngine, type AudioContextLike } from './AudioEngine';

/** Minimal mock of the Web Audio surface the engine uses. */
function makeMockContext() {
  let state = 'suspended';
  const oscillators: { started: boolean }[] = [];
  const gains: { value: number }[] = [];
  const ctx: AudioContextLike & { _oscillators: typeof oscillators; _setState: (s: string) => void } = {
    get state() {
      return state;
    },
    currentTime: 0,
    destination: {},
    _oscillators: oscillators,
    _setState: (s) => {
      state = s;
    },
    createGain() {
      const g = {
        value: 1,
      };
      gains.push(g);
      return {
        gain: {
          value: 1,
          setValueAtTime(v: number) {
            this.value = v;
          },
          linearRampToValueAtTime(v: number) {
            this.value = v;
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
    expect(engine.playSfx('death')).toBe(false);
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
