import { describe, it, expect } from 'vitest';
import { Quicksand } from './Quicksand';
import { Player } from '../Player';
import { PLAYER, LOOP, HAZARDS, RESOLUTION } from '../../data/tuning.config';
import type { HazardContext } from '../types';

const DT = LOOP.FIXED_DT;
const T = RESOLUTION.TILE;
const CTX: HazardContext = { freeze: false, extraTelegraph: 0 };

// Screen 1 pit: cols 13–19, rows 16–17.
function quicksand(): Quicksand {
  return new Quicksand([{ gx: 13, gy: 16, w: 7, h: 2 }]);
}

// Beam resting on top of the quicksand surface (row 16 top = y 640).
function onQuicksand(): Player {
  return new Player(560, 16 * T - PLAYER.HEIGHT);
}

describe('Quicksand', () => {
  it('drags movement while in contact', () => {
    const q = quicksand();
    expect(q.speedMultAt(onQuicksand())).toBeCloseTo(HAZARDS.QUICKSAND.WALK_SPEED_MULT, 5);
    // Away from the pit → no drag.
    const dry = new Player(40, 15 * T - PLAYER.HEIGHT);
    expect(q.speedMultAt(dry)).toBe(1);
  });

  it('kills after SINK_KILL_TIME of continuous contact', () => {
    const q = quicksand();
    const p = onQuicksand();
    const expected = Math.round(HAZARDS.QUICKSAND.SINK_KILL_TIME / DT);
    let killedAt = -1;
    for (let i = 1; i <= 300; i += 1) {
      if (q.update(DT, p, CTX) === 'quicksand') {
        killedAt = i;
        break;
      }
    }
    expect(killedAt).toBeGreaterThan(expected - 3);
    expect(killedAt).toBeLessThan(expected + 3);
  });

  it('does not kill when the player is clear of the pit', () => {
    const q = quicksand();
    const dry = new Player(40, 15 * T - PLAYER.HEIGHT);
    let cause = null;
    for (let i = 0; i < 300; i += 1) cause = q.update(DT, dry, CTX);
    expect(cause).toBeNull();
  });

  it('resets the contact timer when the player leaves', () => {
    const q = quicksand();
    const p = onQuicksand();
    for (let i = 0; i < 40; i += 1) q.update(DT, p, CTX); // ~0.67s of contact
    // Leave the pit.
    p.box.x = 40;
    p.box.y = 15 * T - PLAYER.HEIGHT;
    q.update(DT, p, CTX);
    expect(q.sinkProgress).toBe(0);
  });
});
