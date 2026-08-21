/**
 * The secret stage, from the Simulation's side.
 *
 * These are the tests that make the feature safe to ship, and every one of them is a
 * way the bonus could have leaked into the run:
 *
 *  - **it costs nothing** — no months, no lives, no delay log, no capability;
 *  - **it cannot be fallen into**, so the arrival still plays exactly as it did for
 *    anybody who does not go looking (including every one-tap auto-run player, who
 *    cannot choose not to walk over the mouth);
 *  - **it cannot win the game.** The Tech Park's `winTrigger` is at x 1040 and the bonus
 *    room is 1280 wide, so walking right in the plant room used to end the run;
 *  - **it hands the plaza back** at the column it took it from, with the run intact.
 */
import { describe, it, expect } from 'vitest';
import { makeInput } from './Input';
import { BONUS, RESOLUTION } from '../data/tuning.config';
import { DT, driveToScreen, T } from '../test/helpers';
import type { Simulation } from './Simulation';

const TUNNEL_GX = 18;

/** On the Tech Park, standing on the hatch. */
function atTheHatch(): Simulation {
  const sim = driveToScreen(5);
  const span = sim.tunnelSpan!;
  sim.player.box.x = span.x + (span.w - sim.player.box.w) / 2;
  sim.player.box.y = sim.screen.spawnY;
  sim.step(DT, makeInput());
  return sim;
}

function drop(sim: Simulation): void {
  sim.step(DT, makeInput({ shootPressed: true }));
}

/** Play the wall down with a tracking paddle, then walk into the shaft. */
function clearTheWall(sim: Simulation, maxSeconds = 150): void {
  const frames = Math.round(maxSeconds / DT);
  for (let i = 0; i < frames && sim.inBonus; i += 1) {
    const stage = sim.bonus!;
    const cx = sim.player.box.x + sim.player.box.w / 2;
    const want = stage.remaining === 0 ? BONUS.ROOM.TUNNEL_CX : stage.ballState?.x;
    let input = makeInput();
    if (want !== undefined) {
      if (want > cx + 8) input = makeInput({ right: true });
      else if (want < cx - 8) input = makeInput({ left: true });
    }
    sim.step(DT, input);
  }
}

describe('the secret tunnel — getting in', () => {
  it('is only on the Tech Park', () => {
    for (const id of [0, 1, 2, 3, 4]) {
      expect(driveToScreen(id).tunnelSpan).toBeNull();
    }
    const span = driveToScreen(5).tunnelSpan;
    expect(span).toEqual({ x: TUNNEL_GX * T, w: 2 * T });
    // The mouth is the width the room below is built around: one number, both ends.
    expect(span!.w).toBe(BONUS.ROOM.TUNNEL_W);
  });

  it('cannot be walked into, and does not interrupt a run that ignores it', () => {
    const sim = atTheHatch();
    expect(sim.canEnterTunnel).toBe(true);
    // Walking over it with no press does nothing at all.
    for (let i = 0; i < 30; i += 1) sim.step(DT, makeInput({ right: true }));
    expect(sim.inBonus).toBe(false);
    // …and holding right still finishes the game, which is what a one-tap player does.
    for (let i = 0; i < 600 && sim.state === 'PLAYING'; i += 1) {
      sim.step(DT, makeInput({ right: true }));
    }
    expect(sim.state).toBe('WIN');
    expect(sim.inBonus).toBe(false);
  });

  it('opens on the act button, and only while he is standing on the mouth', () => {
    const away = driveToScreen(5);
    away.player.box.x = 200;
    away.player.box.y = away.screen.spawnY;
    away.step(DT, makeInput());
    expect(away.canEnterTunnel).toBe(false);
    drop(away);
    expect(away.inBonus).toBe(false);

    const sim = atTheHatch();
    drop(sim);
    expect(sim.inBonus).toBe(true);
    expect(sim.bonus!.phase).toBe('dropping');
    // He enters from the top centre, above the frame, and falls.
    expect(sim.player.box.x + sim.player.box.w / 2).toBe(BONUS.ROOM.TUNNEL_CX);
    expect(sim.player.box.y).toBeLessThan(0);
  });

  it('tells the host once at each end, and is neither a screen nor a state change', () => {
    let entered = 0;
    let left = 0;
    const sim = driveToScreen(5, {
      onTunnelEnter: () => {
        entered += 1;
      },
      onTunnelExit: () => {
        left += 1;
      },
    });
    const span = sim.tunnelSpan!;
    sim.player.box.x = span.x + 20;
    sim.player.box.y = sim.screen.spawnY;
    sim.step(DT, makeInput());
    drop(sim);
    expect(entered).toBe(1);
    expect(left).toBe(0);
    /*
     * The run is still PLAYING the Tech Park while he is down there. That is the point of
     * the two events existing at all: a new GameState would have put the bonus in the
     * transition table, in the analytics funnel and in every `state === 'PLAYING'` guard
     * in the host — for a room that changes nothing about the run.
     */
    expect(sim.state).toBe('PLAYING');
    expect(sim.screenId).toBe(5);
    clearTheWall(sim);
    expect(left).toBe(1);
    expect(entered).toBe(1);
  });
});

describe('the secret tunnel — it costs nothing', () => {
  it('books no months, spends no life and logs no delay', () => {
    const sim = atTheHatch();
    const before = {
      months: sim.months,
      lives: sim.lives,
      log: sim.log.length,
      engaged: sim.engaged.length,
    };
    drop(sim);
    clearTheWall(sim);
    expect(sim.months).toBe(before.months);
    expect(sim.lives).toBe(before.lives);
    expect(sim.log.length).toBe(before.log);
    expect(sim.engaged.length).toBe(before.engaged);
    expect(sim.receipt.delayMonths).toBe(0);
  });

  it('cannot win the game from inside the room', () => {
    const sim = atTheHatch();
    drop(sim);
    // Land, then run right for as long as the room allows. The Tech Park's win trigger
    // is at x 1040 and this room is 1280 wide, so a fall-through to the tail of
    // `updatePlaying` would end the run in the plant room.
    for (let i = 0; i < 60 * 12; i += 1) sim.step(DT, makeInput({ right: true }));
    // He is pinned against the room's right wall, i.e. well past the plaza's trigger.
    // (The cannons hang 190px over his head, so nothing stops him short of the wall.)
    expect(sim.player.box.x + sim.player.box.w).toBe(RESOLUTION.WIDTH - BONUS.ROOM.WALL);
    expect(sim.screen.winTriggerX).toBeLessThan(sim.player.box.x);
    expect(sim.state).toBe('PLAYING');
    expect(sim.inBonus).toBe(true);
  });

  it('cannot be fallen out of, so nothing can charge a fall', () => {
    const sim = atTheHatch();
    drop(sim);
    for (let i = 0; i < 60 * 20; i += 1) sim.step(DT, makeInput({ left: true }));
    expect(sim.state).toBe('PLAYING');
    expect(sim.log.length).toBe(0);
  });
});

describe('the secret tunnel — getting out', () => {
  it('gives the plaza back at the column it took it from', () => {
    const sim = atTheHatch();
    const returnX = sim.player.box.x;
    drop(sim);
    clearTheWall(sim);
    expect(sim.inBonus).toBe(false);
    expect(sim.player.box.x).toBe(returnX);
    expect(sim.player.box.y + sim.player.box.h).toBe(15 * T);
    expect(sim.screenId).toBe(5);
    expect(sim.state).toBe('PLAYING');
    // And the run can still be finished from there.
    for (let i = 0; i < 900 && sim.state === 'PLAYING'; i += 1) {
      sim.step(DT, makeInput({ right: true }));
    }
    expect(sim.state).toBe('WIN');
  });

  it('is left behind by a reset', () => {
    const sim = atTheHatch();
    drop(sim);
    expect(sim.inBonus).toBe(true);
    sim.reset();
    expect(sim.inBonus).toBe(false);
    expect(sim.tunnelSpan).toBeNull();
  });
});
