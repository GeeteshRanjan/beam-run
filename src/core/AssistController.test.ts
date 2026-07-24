import { describe, it, expect, vi } from 'vitest';
import { AssistController } from './AssistController';
import { DEFAULT_ASSIST, type AssistState } from './Simulation';
import { ASSIST } from '../data/tuning.config';

function makeTargets() {
  const sim = { assist: { ...DEFAULT_ASSIST } as AssistState };
  const loop = { timeScale: 1 };
  const audio = { setMuted: vi.fn() };
  const setLargerControls = vi.fn();
  return { sim, loop, audio, setLargerControls };
}

describe('AssistController', () => {
  it('slow mode scales the loop timeScale and flips back off', () => {
    const t = makeTargets();
    const c = new AssistController(t);
    expect(t.loop.timeScale).toBe(1);
    c.toggle('slowMode');
    expect(c.isOn('slowMode')).toBe(true);
    expect(t.sim.assist.slowMode).toBe(true);
    expect(t.loop.timeScale).toBe(ASSIST.SLOW_MODE_TIME_SCALE);
    c.toggle('slowMode');
    expect(t.loop.timeScale).toBe(1);
  });

  it('invincible + extra time flow into the simulation assist state', () => {
    const t = makeTargets();
    const c = new AssistController(t);
    c.set('invincible', true);
    c.set('extraTime', true);
    expect(t.sim.assist.invincible).toBe(true);
    expect(t.sim.assist.extraTime).toBe(true);
  });

  it('larger controls calls the sizing hook; mutes route to the correct bus', () => {
    const t = makeTargets();
    const c = new AssistController(t);
    c.toggle('largerControls');
    expect(t.setLargerControls).toHaveBeenLastCalledWith(true);
    c.toggle('muteMusic');
    expect(t.audio.setMuted).toHaveBeenLastCalledWith('music', true);
    c.toggle('muteSfx');
    expect(t.audio.setMuted).toHaveBeenLastCalledWith('sfx', true);
  });

  it('announces every toggle with an On/Off state (screen-reader aria-live)', () => {
    const t = makeTargets();
    const announce = vi.fn();
    const c = new AssistController(t, announce);
    c.toggle('slowMode');
    expect(announce).toHaveBeenLastCalledWith(expect.stringContaining('On'));
    c.toggle('slowMode');
    expect(announce).toHaveBeenLastCalledWith(expect.stringContaining('Off'));
  });

  it('syncMutes reflects an external master-mute into the toggle state', () => {
    const t = makeTargets();
    const c = new AssistController(t);
    c.syncMutes(true, true);
    expect(c.isOn('muteMusic')).toBe(true);
    expect(c.isOn('muteSfx')).toBe(true);
  });
});
