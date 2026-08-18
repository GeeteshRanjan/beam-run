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

  it('routes a lost life onward, never into a dead end', () => {
    const sm = new StateMachine<GameState>('PLAYING', GAME_TRANSITIONS);
    expect(sm.can('TITLE_CARD')).toBe(true); // next screen
    expect(sm.can('LIFE_LOST')).toBe(true); // an obstacle stopped the player
    expect(sm.can('WIN')).toBe(true); // finale
    expect(Object.keys(GAME_TRANSITIONS)).toEqual([
      'BOOT',
      'START',
      'TITLE_CARD',
      'PLAYING',
      'LIFE_LOST',
      'WIN',
    ]);
    expect(GAME_TRANSITIONS.PLAYING).toEqual(['TITLE_CARD', 'LIFE_LOST', 'WIN']);
    // LIFE_LOST always leads somewhere playable: back into the same stage while
    // lives remain, or to the title screen once they are gone. There is no state
    // from which a run is walled off from the closing CTA.
    const lost = new StateMachine<GameState>('LIFE_LOST', GAME_TRANSITIONS);
    expect(lost.can('TITLE_CARD')).toBe(true);
    expect(lost.can('START')).toBe(true);
    expect(lost.can('PLAYING')).toBe(false); // always via the stage title card
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
