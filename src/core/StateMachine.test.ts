import { describe, it, expect, vi } from 'vitest';
import { StateMachine } from './StateMachine';
import { GAME_TRANSITIONS, type GameState } from './gameStates';

describe('StateMachine (game transitions)', () => {
  it('starts in the initial state', () => {
    const sm = new StateMachine<GameState>('BOOT', GAME_TRANSITIONS);
    expect(sm.state).toBe('BOOT');
    expect(sm.is('BOOT')).toBe(true);
  });

  it('allows only declared transitions', () => {
    const sm = new StateMachine<GameState>('BOOT', GAME_TRANSITIONS);
    expect(sm.can('START')).toBe(true);
    expect(sm.can('PLAYING')).toBe(false);
    expect(sm.transitionTo('PLAYING')).toBe(false);
    expect(sm.state).toBe('BOOT');
    expect(sm.transitionTo('START')).toBe(true);
    expect(sm.state).toBe('START');
  });

  it('walks the full happy path to WIN and back to START', () => {
    const sm = new StateMachine<GameState>('BOOT', GAME_TRANSITIONS);
    const path: GameState[] = ['START', 'TITLE_CARD', 'PLAYING', 'WIN', 'START'];
    for (const s of path) {
      expect(sm.transitionTo(s)).toBe(true);
      expect(sm.state).toBe(s);
    }
  });

  it('has no failure branch — PLAYING only leads onward or to WIN', () => {
    const sm = new StateMachine<GameState>('PLAYING', GAME_TRANSITIONS);
    expect(sm.can('TITLE_CARD')).toBe(true); // next screen
    expect(sm.can('WIN')).toBe(true); // finale
    // Setbacks are handled inside PLAYING; there is no death or game-over state
    // to fall into, so a run can never be walled off from the closing CTA.
    expect(Object.keys(GAME_TRANSITIONS)).toEqual([
      'BOOT',
      'START',
      'TITLE_CARD',
      'PLAYING',
      'WIN',
    ]);
    expect(GAME_TRANSITIONS.PLAYING).toEqual(['TITLE_CARD', 'WIN']);
  });

  it('fires onChange for accepted transitions only', () => {
    const onChange = vi.fn();
    const sm = new StateMachine<GameState>('BOOT', GAME_TRANSITIONS, onChange);
    sm.transitionTo('PLAYING'); // rejected
    sm.transitionTo('START'); // accepted
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('BOOT', 'START');
  });
});
