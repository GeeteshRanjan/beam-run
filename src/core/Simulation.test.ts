import { describe, it, expect } from 'vitest';
import { Simulation } from './Simulation';
import { Game } from './Game';
import { makeInput } from './Input';
import { JOURNEY, RESOLUTION, LIVES } from '../data/tuning.config';
import { DT, stepN, recoverFromLifeLost, driveToScreen, stepToPlaying } from '../test/helpers';
import { TRANSITION } from '../data/tuning.config';

/** Drive a fresh sim to PLAYING on Reception, through the briefing card. */
function toPlaying(): Simulation {
  const sim = new Simulation();
  sim.step(DT, makeInput({ anyPressed: true })); // START → begin run → TITLE_CARD
  stepToPlaying(sim);
  return sim;
}

describe('Simulation lifecycle', () => {
  it('boots to START and begins a run on any input, with a clean clock', () => {
    const sim = new Simulation();
    expect(sim.state).toBe('START');
    sim.step(DT, makeInput({ anyPressed: true }));
    expect(sim.state).toBe('TITLE_CARD');
    expect(sim.screenId).toBe(0);
    expect(sim.months).toBe(0);
    expect(sim.setbacks).toBe(0);
    expect(sim.lives).toBe(LIVES.TOTAL);
    expect(sim.log).toHaveLength(0);
  });

  it('starts the stage on a press, and never on its own', () => {
    // Owner call: every screen is introduced by a briefing card, and the run waits
    // there. This is the *only* mid-run state that does not time out, so the test
    // that used to assert the opposite ("auto-advances from the title card") is now
    // the regression guard for it.
    const sim = new Simulation();
    sim.step(DT, makeInput({ anyPressed: true }));
    expect(sim.state).toBe('TITLE_CARD');
    stepN(sim, 600); // ten seconds of nothing at all
    expect(sim.state).toBe('TITLE_CARD');

    sim.step(DT, makeInput({ anyPressed: true }));
    expect(sim.state).toBe('PLAYING');
  });

  it('ignores a press inside the opening grace, so one click cannot skip the brief', () => {
    // The Start button both begins the run and opens the card, and on touch a
    // double-tap arrives as two presses a frame apart.
    const sim = new Simulation();
    sim.step(DT, makeInput({ anyPressed: true }));
    expect(sim.titleCardReady).toBe(false);
    sim.step(DT, makeInput({ anyPressed: true }));
    expect(sim.state).toBe('TITLE_CARD');

    stepN(sim, Math.ceil(TRANSITION.TITLE_CARD_SKIP_AFTER / DT) + 1);
    expect(sim.titleCardReady).toBe(true);
    sim.step(DT, makeInput({ anyPressed: true }));
    expect(sim.state).toBe('PLAYING');
  });

  it('requestAdvance is the button, and it is a no-op anywhere else', () => {
    const sim = new Simulation();
    sim.requestAdvance(); // START: nothing to advance
    expect(sim.state).toBe('START');
    sim.step(DT, makeInput({ anyPressed: true }));
    stepN(sim, Math.ceil(TRANSITION.TITLE_CARD_SKIP_AFTER / DT) + 1);
    sim.requestAdvance();
    expect(sim.state).toBe('PLAYING');
    sim.requestAdvance(); // and again mid-stage: still nothing
    expect(sim.state).toBe('PLAYING');
  });
});

describe('Simulation movement & collision', () => {
  it('walls are solid — holding right stalls Beam at the first Reception step', () => {
    const sim = toPlaying();
    for (let i = 0; i < 150; i += 1) sim.step(DT, makeInput({ right: true }));
    const p = sim.player;
    expect(p.onGround).toBe(true);
    // First step is at gx9 (x=360); Beam (w=28) stops just left of it.
    expect(p.box.x + p.box.w).toBeLessThanOrEqual(361);
    expect(p.box.x).toBeGreaterThan(300);
  });

  it('a full jump clears the 1-tile step', () => {
    const sim = toPlaying();
    for (let i = 0; i < 150; i += 1) sim.step(DT, makeInput({ right: true }));
    sim.step(DT, makeInput({ right: true, jumpPressed: true, jumpHeld: true }));
    for (let i = 0; i < 45; i += 1) sim.step(DT, makeInput({ right: true, jumpHeld: true }));
    expect(sim.player.box.x).toBeGreaterThan(400);
  });
});

describe('Simulation progression & the journey clock', () => {
  it('clearing a screen books its months and advances', () => {
    const sim = toPlaying();
    const base = sim.screen.data.monthsBase;
    sim.player.box.x = sim.screen.exitX!;
    sim.step(DT, makeInput());
    expect(sim.screenId).toBe(1);
    expect(sim.state).toBe('TITLE_CARD');
    expect(sim.months).toBe(base);
  });

  it('collects the floating badge where it actually is, not at its anchor', () => {
    // Setup Delays, because Reception carries no badge any more (owner call): the
    // first ANSR mark in the run is now the one that actually does something.
    const sim = driveToScreen(1);
    const badge = sim.screen.data.badge!;
    const monthsBefore = sim.months;
    const anchorY = badge.gy * RESOLUTION.TILE + RESOLUTION.TILE / 2;

    // Wait for a phase where the badge is far enough from its anchor that a
    // player parked ON the anchor cannot touch it — then park there. The old
    // static hitbox would have collected it; the floating one must not.
    const clear = (sim.player.box.h + RESOLUTION.TILE) / 2;
    for (let i = 0; i < 400; i += 1) {
      const box = sim.badgeBox!;
      if (Math.abs(box.y + box.h / 2 - anchorY) > clear + 1) break;
      sim.player.box.x = sim.screen.spawnX; // stay clear of the badge column
      sim.step(DT, makeInput());
    }
    const box = sim.badgeBox!;
    expect(Math.abs(box.y + box.h / 2 - anchorY)).toBeGreaterThan(clear);
    sim.player.box.x = box.x;
    sim.player.box.y = anchorY - sim.player.box.h / 2;
    sim.step(DT, makeInput());
    expect(sim.powerups.collected).toBe(false);

    // Now meet it where it is.
    const live = sim.badgeBox!;
    sim.player.box.x = live.x;
    sim.player.box.y = live.y;
    sim.step(DT, makeInput());
    expect(sim.powerups.collected).toBe(true);
    expect(sim.badgeBox).toBeNull();
    // The badge costs nothing on the clock.
    expect(sim.months).toBe(monthsBefore);
  });

  it('the badge float is a pure function of the sim clock (replayable)', () => {
    const a = driveToScreen(1);
    const b = driveToScreen(1);
    stepN(a, 37);
    stepN(b, 37);
    expect(a.clock).toBeCloseTo(b.clock, 10);
    expect(a.badgeBox!.y).toBeCloseTo(b.badgeBox!.y, 10);
  });
});

describe('Simulation setbacks: months, a life and a log line', () => {
  it('falling out of the world books months, spends a life and reports it', () => {
    const sim = toPlaying();
    stepN(sim, 55); // let spawn grace expire
    expect(sim.player.isInvulnerable).toBe(false);

    sim.player.box.y = RESOLUTION.HEIGHT + 200;
    sim.step(DT, makeInput());

    expect(sim.state).toBe('LIFE_LOST');
    expect(sim.setbacks).toBe(1);
    expect(sim.lives).toBe(LIVES.TOTAL - 1);
    expect(sim.months).toBe(JOURNEY.SETBACK_MONTHS);
    expect(sim.log).toHaveLength(1);
    expect(sim.log[0]).toMatchObject({ index: 1, screenId: 0, cause: 'fall' });
    expect(sim.delayMonths).toBe(JOURNEY.SETBACK_MONTHS);

    const view = sim.lifeLost!;
    expect(view.cause).toBe('fall');
    expect(view.livesLeft).toBe(LIVES.TOTAL - 1);
    expect(view.outOfLives).toBe(false);
    expect(view.ledger).toEqual([
      { cause: 'fall', label: 'GROUND GAVE WAY', count: 1, months: JOURNEY.SETBACK_MONTHS },
    ]);
  });

  it('a lost life restarts the SAME stage, at its spawn', () => {
    const sim = toPlaying();
    stepN(sim, 55);
    for (let i = 0; i < 90; i += 1) sim.step(DT, makeInput({ right: true }));
    const advanced = sim.player.box.x;
    expect(advanced).toBeGreaterThan(sim.screen.spawnX + 40);

    sim.player.box.y = RESOLUTION.HEIGHT + 200;
    sim.step(DT, makeInput());
    recoverFromLifeLost(sim);

    expect(sim.state).toBe('PLAYING');
    expect(sim.screenId).toBe(0); // same stage, never the next one
    expect(sim.player.box.x).toBeLessThan(advanced);
    // ...but the months and the log line are not refunded.
    expect(sim.months).toBe(JOURNEY.SETBACK_MONTHS);
    expect(sim.log).toHaveLength(1);
  });

  it('flags the retry so its title card can carry the badge instruction', () => {
    // There is no life-lost screen any more (owner call): the stage simply starts
    // again, so the one thing that screen said which mattered — take the ANSR badge
    // — is printed on the retry's title card instead. This flag is how the host
    // knows to print it, and it must not survive into a stage reached by playing.
    const sim = driveToScreen(1);
    expect(sim.retrying).toBe(false);
    stepN(sim, 55);
    sim.player.box.y = RESOLUTION.HEIGHT + 200;
    sim.step(DT, makeInput());
    recoverFromLifeLost(sim);

    expect(sim.screenId).toBe(1);
    expect(sim.retrying).toBe(true);
    // The badge is available again on the retry, which is the point of the hint.
    expect(sim.powerups.collected).toBe(false);
    expect(sim.badgeBox).not.toBeNull();

    // Clearing the stage moves on with a clean slate.
    sim.player.box.x = sim.screen.exitX!;
    sim.step(DT, makeInput());
    expect(sim.screenId).toBe(2);
    expect(sim.retrying).toBe(false);
  });

  it('it auto-advances after the hold, without any input', () => {
    const sim = toPlaying();
    stepN(sim, 55);
    sim.player.box.y = RESOLUTION.HEIGHT + 200;
    sim.step(DT, makeInput());
    expect(sim.state).toBe('LIFE_LOST');
    stepN(sim, Math.ceil(LIVES.LOST_HOLD / DT) + 2);
    expect(sim.state).not.toBe('LIFE_LOST');
  });

  it('spending the last life ends the attempt back at the title screen', () => {
    const sim = toPlaying();
    for (let life = LIVES.TOTAL; life > 0; life -= 1) {
      stepN(sim, 80); // outlast the grace window
      sim.player.box.y = RESOLUTION.HEIGHT + 200;
      sim.step(DT, makeInput());
      expect(sim.state).toBe('LIFE_LOST');
      expect(sim.lives).toBe(life - 1);
      if (life > 1) recoverFromLifeLost(sim);
    }

    // Out of lives: the screen becomes the ledger and waits for a decision.
    expect(sim.lives).toBe(0);
    expect(sim.lifeLost!.outOfLives).toBe(true);
    expect(sim.lifeLost!.delays).toBe(LIVES.TOTAL);
    expect(sim.lifeLost!.delayMonths).toBe(LIVES.TOTAL * JOURNEY.SETBACK_MONTHS);
    stepN(sim, Math.ceil(LIVES.LOST_HOLD / DT) + 60);
    expect(sim.state).toBe('LIFE_LOST'); // never times out from under the player

    sim.continueAfterLifeLost();
    expect(sim.state).toBe('START');
    // A fresh attempt: full lives, clean clock, empty log.
    expect(sim.lives).toBe(LIVES.TOTAL);
    expect(sim.months).toBe(0);
    expect(sim.log).toHaveLength(0);
    expect(sim.screenId).toBe(0);
  });

  it('groups repeated obstacles in the ledger rather than listing them', () => {
    const sim = toPlaying();
    for (let i = 0; i < 2; i += 1) {
      stepN(sim, 80);
      sim.player.box.y = RESOLUTION.HEIGHT + 200;
      sim.step(DT, makeInput());
      recoverFromLifeLost(sim);
    }
    expect(sim.receipt.ledger).toEqual([
      { cause: 'fall', label: 'GROUND GAVE WAY', count: 2, months: 2 * JOURNEY.SETBACK_MONTHS },
    ]);
    expect(sim.receipt.delayMonths).toBe(2 * JOURNEY.SETBACK_MONTHS);
  });

  it('the "no setbacks" assist explores freely without booking months', () => {
    const sim = new Simulation({ assist: { noSetbacks: true } });
    sim.step(DT, makeInput({ anyPressed: true }));
    stepToPlaying(sim);
    stepN(sim, 60);
    sim.player.box.y = RESOLUTION.HEIGHT + 200;
    sim.step(DT, makeInput());
    expect(sim.setbacks).toBe(0);
    expect(sim.months).toBe(0);
    expect(sim.lives).toBe(LIVES.TOTAL); // and no life is spent either
    expect(sim.state).toBe('PLAYING');
    // Still rescued from the void so play can continue.
    stepN(sim, 40);
    expect(sim.player.box.y).toBeLessThan(RESOLUTION.HEIGHT);
  });
});

describe('Game.simulate (headless)', () => {
  it('runs a scripted sequence and returns the resulting sim', () => {
    // Two presses: one to begin the run, one to dismiss the stage briefing (which
    // waits, so a script of empty frames now goes nowhere on its own).
    const script = [
      { anyPressed: true },
      ...Array.from({ length: 30 }, () => ({})),
      { anyPressed: true },
      ...Array.from({ length: 90 }, () => ({})),
    ];
    const sim = Game.simulate(script);
    expect(sim.state).toBe('PLAYING');
    expect(sim.screenId).toBe(0);
  });
});
