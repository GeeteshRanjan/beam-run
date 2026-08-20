import { describe, it, expect } from 'vitest';
import { makeInput } from './Input';
import { JOURNEY, HAZARDS, PLAYER } from '../data/tuning.config';
import { Workplace } from '../world/Hazards/Workplace';
import {
  DT,
  T,
  driveToScreen,
  engageBadge,
  expireGrace,
  forceSetbackAt,
  standAtColumn,
  stepN,
} from '../test/helpers';

/**
 * The Workplace is screen **3** (owner call): it replaced Local Expertise outright
 * and took the slot straight after Compliance, because a workplace is the first
 * thing you walk into once the filings clear.
 *
 * Column 9 is the firing step: it sits between the partition (gx 7) and the start
 * of the figure's corridor (gx 10), so it is both safe from his body for the whole
 * screen and has a clear line to him. The tests use it for exactly that reason.
 *
 * It was column 7 until the badge moved: the mark now falls out of the first ceiling
 * spotlight onto a floating cabinet at gx 4-5 (owner call), and the cabinet's right edge
 * has to stay clear of the face a player pins against at the partition — so the wall
 * went from gx 6 to gx 7 and the figure's corridor from gx 9 to gx 10 with it.
 */
const FIRING_COLUMN = 9;

/** Hold the shoot button for one step (it is an edge signal, never held). */
function shoot(sim: ReturnType<typeof driveToScreen>): void {
  sim.step(DT, makeInput({ shootPressed: true }));
}

/**
 * Fire `n` pulses that each LAND, respecting the cutter's cooldown between them.
 *
 * It used to fire and then step a fixed cooldown's worth of frames, which worked only
 * because the badge was on a rail and `engageBadge` took a single frame — the figure was
 * still at the near end of his corridor, so the orb reached him almost immediately. The
 * badge now falls out of a ceiling spotlight and has to be *waited* for (owner call), so
 * by the time the cutter is armed he can be 600px away and the orb needs the best part of
 * a second to get there. Waiting for the layer count to move is the honest version of
 * "fire a pulse", and it does not depend on where he happens to be standing.
 */
function fire(sim: ReturnType<typeof driveToScreen>, n: number): void {
  const hz = hazardOf(sim);
  const gap = Math.ceil(HAZARDS.WORKPLACE.SHOT_COOLDOWN / DT) + 1;
  for (let i = 0; i < n; i += 1) {
    const before = hz.layersLeft;
    standAtColumn(sim, FIRING_COLUMN);
    shoot(sim);
    for (let k = 0; k < 300 && (hz.layersLeft === before || k < gap); k += 1) {
      standAtColumn(sim, FIRING_COLUMN);
      sim.step(DT, makeInput());
    }
  }
}

/**
 * Screen 3 with delays switched off.
 *
 * Used by every test below that parks the player somewhere on the open floor, because the
 * figure now **throws bandages** (owner call) and a stationary player in the open is
 * caught by one inside a few seconds — which would leave the sim in `LIFE_LOST` with the
 * hazard frozen, i.e. measuring nothing. These tests are about the patrol and the cutter;
 * the cost of being hit is proved separately, on purpose.
 */
function onScreen3(): ReturnType<typeof driveToScreen> {
  const sim = driveToScreen(3);
  sim.assist.noSetbacks = true;
  return sim;
}

function hazardOf(sim: ReturnType<typeof driveToScreen>): Workplace {
  return sim.activeHazard as Workplace;
}

describe('Screen 3 — Workplace (taped off → 500Leaders → the room put right)', () => {
  it('is the 500Leaders capability screen, with the figure beyond the badge', () => {
    const sim = driveToScreen(3);
    expect(sim.screen.name).toBe('Workplace');
    expect(sim.screen.data.hazard).toBe('workplace');
    expect(sim.screen.data.badge!.type).toBe('UNWRAP');
    expect(sim.activeHazard).toBeInstanceOf(Workplace);
    const badgeGx = sim.screen.data.badge!.gx;
    const mummies = sim.screen.data.mummies!;
    expect(mummies).toHaveLength(1);
    expect(mummies.every((m) => m.from > badgeGx)).toBe(true);
    expect(hazardOf(sim).layersLeft).toBe(HAZARDS.WORKPLACE.TAPE_LAYERS);
  });

  it('spawns the player behind the partition, clear of the corridor on frame one', () => {
    const sim = driveToScreen(3);
    const wall = sim.screen.data.solids.find((s) => s.role?.includes('partition'));
    expect(wall).toBeTruthy();
    const spawnRight = sim.screen.data.spawn.gx * T + PLAYER.WIDTH;
    const corridorLeft = sim.screen.data.mummies![0]!.from * T;
    // Partition between the two, and the figure never reaches back past it.
    expect(spawnRight).toBeLessThan(wall!.gx * T);
    expect(wall!.gx * T).toBeLessThan(corridorLeft);
    const box = hazardOf(sim).mummyStates()[0]!.box;
    expect(box.x).toBeGreaterThan(wall!.gx * T + wall!.w * T);
  });

  it('paces to and fro, turning at each end — a metronome, not a chase', () => {
    // He used to LOOP: at the far end he snapped back to his start column. Owner call
    // to change it, and the test states the property the change is about — he reverses
    // at both ends and covers the corridor in both directions.
    const sim = onScreen3();
    const hz = hazardOf(sim);
    const corridor = sim.screen.data.mummies![0]!;
    const minX = corridor.from * T + HAZARDS.WORKPLACE.MUMMY_W / 2;
    const maxX = (corridor.to + 1) * T - HAZARDS.WORKPLACE.MUMMY_W / 2;
    let wentRight = false;
    let wentLeft = false;
    let turns = 0;
    let prev = hz.mummyStates()[0]!;
    for (let i = 0; i < 1400; i += 1) {
      standAtColumn(sim, FIRING_COLUMN); // stay out of his way for the whole sweep
      sim.step(DT, makeInput());
      const s = hz.mummyStates()[0]!;
      const cx = s.box.x + s.box.w / 2;
      if (s.phase === 'wrapped') {
        if (cx > prev.box.x + prev.box.w / 2 + 0.001) wentRight = true;
        if (cx < prev.box.x + prev.box.w / 2 - 0.001) wentLeft = true;
      }
      if (s.phase === 'turning' && prev.phase !== 'turning') turns += 1;
      // He never leaves the corridor his level data authored.
      expect(cx).toBeGreaterThanOrEqual(minX - 0.001);
      expect(cx).toBeLessThanOrEqual(maxX + 0.001);
      prev = s;
    }
    expect(wentRight).toBe(true);
    expect(wentLeft).toBe(true);
    expect(turns).toBeGreaterThanOrEqual(2);
  });

  it('never teleports, so the turn may be lethal: it is a pivot, not a respawn', () => {
    /*
     * The old `returning` beat HAD to be harmless, because it moved a lethal 60×78
     * body 700px across the floor in one frame. Nothing snaps any more, so the pivot
     * costs the player time like the walk does — and the property worth pinning is
     * the one that made the harmless beat necessary in the first place: his position
     * never jumps by more than one frame of walking.
     */
    const sim = onScreen3();
    const hz = hazardOf(sim);
    const step = HAZARDS.WORKPLACE.WALK_SPEED * DT + 0.001;
    let sawTurn = false;
    let prevX = hz.mummyStates()[0]!.box.x;
    for (let i = 0; i < 1400; i += 1) {
      standAtColumn(sim, FIRING_COLUMN);
      sim.step(DT, makeInput());
      const s = hz.mummyStates()[0]!;
      expect(Math.abs(s.box.x - prevX)).toBeLessThanOrEqual(step);
      prevX = s.box.x;
      if (s.phase === 'turning') {
        sawTurn = true;
        expect(s.lethal).toBe(true);
      }
    }
    expect(sawTurn).toBe(true);
  });

  it('is still crossable unassisted — but only by jumping him, never by holding right', () => {
    /*
     * The claim the pacing change had to re-earn.
     *
     * While he looped, the answer without the badge was "wait until he vanishes at the
     * far end". Now he comes back, so the only way past is over the top: a jump clears
     * his 78px crown for 0.455s, and against an oncoming figure the closing speed is
     * 410 px/s, so the 88px that have to pass beneath the player take 0.21s. This
     * plays it: one reactive policy over a spread of start delays, because everything
     * here is deterministic and a single run only measures one alignment of player
     * against patrol.
     *
     * A probe of 30 policies × 12 delays put the best at 10/12 clean; this holds the
     * shipped tuning to the shape of that result rather than to its exact figure.
     */
    const cross = (jumpAt: number | null, dodgeAt = 70): { won: number; delayed: number } => {
      let won = 0;
      let delayed = 0;
      for (const delay of [0, 80, 200, 320, 480, 640]) {
        const sim = driveToScreen(3);
        const hz = hazardOf(sim);
        let hold = 0;
        let lastX = sim.player.box.x;
        let stuck = 0;
        for (let i = 0; i < 2400 && sim.state === 'PLAYING'; i += 1) {
          const s = hz.mummyStates()[0]!;
          const pb = sim.player.box;
          const pcx = pb.x + pb.w / 2;
          const gap = s.box.x + s.box.w / 2 - pcx;
          stuck = Math.abs(pb.x - lastX) < 0.5 ? stuck + 1 : 0;
          lastX = pb.x;
          /*
           * Jump the thrown TAPE as well as the man.
           *
           * A policy that cannot do the move the screen requires does not measure the
           * screen, it measures the policy — and the figure throws now, so dodging a roll
           * is part of the boring part of the level. The trigger is deliberately *late*
           * (70px), which the probe found and which is a real property of the attack: the
           * roll travels at 210 px/s against the player's 260, so jumping early lands you
           * back down into it.
           */
          const roll = hz.bandageStates()[0];
          const rollGap = roll ? roll.box.x + roll.box.w / 2 - pcx : Infinity;
          const incoming =
            roll !== undefined &&
            Math.sign(rollGap) === -roll.dir &&
            Math.abs(rollGap) < dodgeAt;
          if (hold === 0 && jumpAt !== null && incoming && sim.player.onGround) hold = 8;
          if (hold === 0 && jumpAt !== null && Math.abs(gap) < jumpAt && Math.abs(gap) > 24) {
            hold = 8;
          }
          // The partition at gx 7 is 80px of solid, so even the do-nothing policy has
          // to jump at a wall or it never leaves the spawn — which is exactly how the
          // first run of this probe reported every policy as a failure.
          if (hold === 0 && stuck > 3) hold = 20;
          sim.step(DT, makeInput({ right: i >= delay, jumpPressed: hold >= 8, jumpHeld: hold > 0 }));
          if (hold > 0) hold -= 1;
        }
        if (sim.screenId > 3) won += 1;
        if (sim.setbacks > 0) delayed += 1;
      }
      return { won, delayed };
    };

    const jumper = cross(130);
    /*
     * Most alignments clear it, and the ones that do clear it clean. Not all of them: a
     * fixed trigger distance is the wrong move at some phases, which is what makes this a
     * timing test rather than a formality.
     *
     * The probe behind these numbers is 20 policies (five jump distances × four dodge
     * distances) over 12 start delays. Best: **9/12, all of them clean**, at jump 110-130
     * and dodge 70. Every single win in the whole sweep was delay-free, which is the
     * shape that matters — on this screen a mistake is not a scratch, it is the tape.
     */
    expect(jumper.won).toBeGreaterThanOrEqual(3);

    // …and the player who only ever holds right is stopped every time — by his body, or
    // now by a roll of his tape, which is the point of adding it.
    const sprinter = cross(null);
    expect(sprinter.won).toBe(0);
    expect(sprinter.delayed).toBe(6);
  });

  describe('he throws his bandages, and the throw is the screen’s only ranged attack', () => {
    /** Stand in the open at `gx` until a roll is in the air, or give up. */
    function provoke(sim: ReturnType<typeof driveToScreen>, gx: number, steps = 900) {
      const hz = hazardOf(sim);
      for (let i = 0; i < steps; i += 1) {
        standAtColumn(sim, gx);
        sim.step(DT, makeInput());
        if (hz.bandageStates().length > 0) return hz.bandageStates()[0]!;
      }
      return null;
    }

    it('winds up first, standing still, and only then lets go', () => {
      // Every hazard telegraphs. This one's tell is on his own body — a coil raised over
      // the shoulder for THROW_WINDUP — and he stops walking for the whole of it, which is
      // what pays for the attack being ranged: each throw costs him ground.
      const sim = onScreen3();
      const hz = hazardOf(sim);
      let sawWind = false;
      let stoodStill = true;
      let prevX: number | null = null;
      for (let i = 0; i < 900 && !sawWind; i += 1) {
        standAtColumn(sim, 14);
        sim.step(DT, makeInput());
        const s = hz.mummyStates()[0]!;
        if (s.phase === 'winding') {
          sawWind = true;
          expect(s.lethal).toBe(true);
          // …and hold him for the rest of the wind-up: he must not drift through it, and
          // the telegraph has to GROW (it is 0 on the frame the phase starts, which is
          // right — the coil has not been raised yet).
          prevX = s.box.x;
          let peak = s.wind;
          for (let k = 0; k < Math.floor(HAZARDS.WORKPLACE.THROW_WINDUP / DT) - 2; k += 1) {
            standAtColumn(sim, 14);
            sim.step(DT, makeInput());
            const w = hz.mummyStates()[0]!;
            if (w.phase !== 'winding') break;
            if (Math.abs(w.box.x - prevX) > 0.001) stoodStill = false;
            peak = Math.max(peak, w.wind);
          }
          expect(peak).toBeGreaterThan(0.5);
        }
      }
      expect(sawWind, 'he never wound up a throw').toBe(true);
      expect(stoodStill).toBe(true);
    });

    it('sends one roll at a time, towards the player, at their shins', () => {
      const sim = onScreen3();
      const roll = provoke(sim, 14);
      expect(roll, 'no bandage was ever thrown').toBeTruthy();
      // Its box is the sprite's box (`render/workplace.ts` draws exactly this).
      expect(roll!.box.w).toBe(HAZARDS.WORKPLACE.THROW_W);
      expect(roll!.box.h).toBe(HAZARDS.WORKPLACE.THROW_H);
      // Low: a standing player is caught by it, and 41px of a 140px jump clears it.
      const feet = 15 * T;
      expect(roll!.box.y).toBeGreaterThan(feet - PLAYER.HEIGHT);
      expect(roll!.box.y + roll!.box.h).toBeLessThan(feet);
      // Thrown towards the player, and never more than one in the air.
      expect(roll!.dir).toBe(-1);
      const hz = hazardOf(sim);
      for (let i = 0; i < 600; i += 1) {
        standAtColumn(sim, 14);
        sim.step(DT, makeInput());
        expect(hz.bandageStates().length).toBeLessThanOrEqual(1);
      }
    });

    it('captures the player: contact books the same delay his body does', () => {
      const sim = driveToScreen(3);
      expireGrace(sim);
      const before = sim.months;
      // Standing in the open, out of reach of his body but inside throwing range.
      for (let i = 0; i < 1200 && sim.state === 'PLAYING'; i += 1) {
        standAtColumn(sim, 12);
        sim.step(DT, makeInput());
      }
      expect(sim.months).toBeGreaterThan(before);
      expect(sim.state).toBe('LIFE_LOST');
      expect(sim.lifeLost!.cause).toBe('mummy');
    });

    it('does not throw across the partition: the badge’s side of it is cover', () => {
      /*
       * The owner's brief for the drop was that the player can take the mark **safely**,
       * and it lands before the partition wall — so a roll that crossed that wall would
       * make the one place on this floor that is meant to be safe the one place you cannot
       * stand still. He does not even wind up at a player behind it (`hasLineOfFire`), and
       * anything already in the air dies against it.
       */
      const sim = driveToScreen(3);
      expireGrace(sim);
      const hz = hazardOf(sim);
      const before = sim.months;
      for (let i = 0; i < 1800 && sim.state === 'PLAYING'; i += 1) {
        // On the ground behind the wall, where the ANSR mark drops.
        standAtColumn(sim, 3);
        sim.step(DT, makeInput());
        for (const b of hz.bandageStates()) {
          expect(b.box.x, 'a roll got past the partition').toBeGreaterThan(7 * T);
        }
      }
      expect(sim.months).toBe(before);
      expect(sim.setbacks).toBe(0);
    });

    it('stops throwing the moment he is freed — the tape was his', () => {
      const sim = onScreen3();
      const hz = hazardOf(sim);
      engageBadge(sim);
      fire(sim, HAZARDS.WORKPLACE.TAPE_LAYERS);
      // Every roll in the air went with the last layer, and no new one is ever thrown.
      expect(hz.bandageStates()).toHaveLength(0);
      for (let i = 0; i < 900; i += 1) {
        standAtColumn(sim, 12);
        sim.step(DT, makeInput());
        expect(hz.bandageStates()).toHaveLength(0);
        expect(hz.mummyStates()[0]!.phase).not.toBe('winding');
      }
    });
  });

  it('walking into him while he is wrapped costs months and a life', () => {
    const sim = driveToScreen(3);
    expireGrace(sim);
    const added = forceSetbackAt(sim, 12, 900);
    expect(added).toBe(JOURNEY.SETBACK_MONTHS);
    expect(sim.state).toBe('LIFE_LOST');
    expect(sim.lifeLost!.cause).toBe('mummy');
    expect(sim.lives).toBe(sim.livesTotal - 1);
  });

  it('without the badge there is no cutter, so the shoot button does nothing', () => {
    const sim = onScreen3();
    const hz = hazardOf(sim);
    expect(hz.hasCutter).toBe(false);
    fire(sim, 4);
    expect(hz.shotStates()).toHaveLength(0);
    expect(hz.layersLeft).toBe(HAZARDS.WORKPLACE.TAPE_LAYERS);
  });

  it('engaging 500Leaders arms the cutter, and one pulse strips one layer', () => {
    const sim = onScreen3();
    engageBadge(sim);
    const hz = hazardOf(sim);
    expect(hz.hasCutter).toBe(true);
    fire(sim, 1);
    expect(hz.layersLeft).toBe(HAZARDS.WORKPLACE.TAPE_LAYERS - 1);
    fire(sim, 1);
    expect(hz.layersLeft).toBe(HAZARDS.WORKPLACE.TAPE_LAYERS - 2);
  });

  it('three hits free him — and he fixes the room instead of dying', () => {
    const sim = onScreen3();
    engageBadge(sim);
    const hz = hazardOf(sim);
    fire(sim, HAZARDS.WORKPLACE.TAPE_LAYERS);
    expect(hz.layersLeft).toBe(0);
    expect(hz.mummyStates()[0]!.phase).not.toBe('wrapped');

    // Unravel → run to the terminal → work → the room comes good.
    for (let i = 0; i < 500 && hz.restore < 1; i += 1) {
      standAtColumn(sim, FIRING_COLUMN);
      sim.step(DT, makeInput());
    }
    const s = hz.mummyStates()[0]!;
    expect(s.phase).toBe('restored');
    expect(s.lethal).toBe(false);
    expect(hz.isFixed).toBe(true);
    expect(hz.restore).toBe(1);
    // He is at the terminal, not where he was blocking the floor.
    const terminalX = sim.screen.data.terminal!.gx * T;
    expect(Math.abs(s.box.x + s.box.w / 2 - terminalX)).toBeLessThan(2 * T);
  });

  it('a freed colleague is safe to touch, and the cutter refuses to fire at him', () => {
    const sim = onScreen3();
    expireGrace(sim);
    engageBadge(sim);
    const hz = hazardOf(sim);
    fire(sim, HAZARDS.WORKPLACE.TAPE_LAYERS);
    stepN(sim, 400);

    const before = sim.months;
    const box = hz.mummyStates()[0]!.box;
    for (let i = 0; i < 200; i += 1) {
      sim.player.box.x = box.x;
      sim.player.box.y = box.y + box.h - sim.player.box.h;
      sim.step(DT, makeInput({ shootPressed: i % 15 === 0 }));
    }
    expect(sim.months).toBe(before);
    expect(sim.setbacks).toBe(0);
    expect(hz.shotStates()).toHaveLength(0);
  });

  describe('the beats the screen is heard on (the host polls these for its cues)', () => {
    it('the groan comes with the wind-up and the hush a throw later', () => {
      const sim = onScreen3();
      const hz = hazardOf(sim);
      expect(hz.windUps).toBe(0);
      expect(hz.throws).toBe(0);
      let sawGap = false;
      for (let i = 0; i < 1200 && !sawGap; i += 1) {
        standAtColumn(sim, 14);
        sim.step(DT, makeInput());
        if (hz.windUps === 1 && hz.throws === 0) {
          // The tell is audible before the act, which is the entire point of sounding
          // the wind-up rather than the release.
          expect(hz.mummyStates()[0]!.phase).toBe('winding');
          sawGap = true;
        }
      }
      expect(sawGap, 'he never wound up a throw').toBe(true);
      for (let i = 0; i < 200 && hz.throws === 0; i += 1) {
        standAtColumn(sim, 14);
        sim.step(DT, makeInput());
      }
      // One hush per roll, and it lags its own groan.
      expect(hz.throws).toBe(1);
      expect(hz.windUps).toBe(1);
    });

    it('the terminal arcs until it says OK, and somebody types before it does', () => {
      const sim = onScreen3();
      // Sparks (and their crackle) from the first frame: the room is broken on arrival.
      const hz = hazardOf(sim);
      expect(hz.isSparking).toBe(true);
      expect(hz.isWorking).toBe(false);
      engageBadge(sim);
      fire(sim, HAZARDS.WORKPLACE.TAPE_LAYERS);
      let sawWorking = false;
      for (let i = 0; i < 500 && hz.restore < 1; i += 1) {
        standAtColumn(sim, FIRING_COLUMN);
        sim.step(DT, makeInput());
        if (hz.isWorking) {
          sawWorking = true;
          // While he is at the keyboard the terminal has not reported yet, so the
          // keystrokes and the chime can never be heard the wrong way round.
          expect(hz.restore).toBeLessThanOrEqual(0.5);
        }
      }
      expect(sawWorking, 'nobody ever sat at the terminal').toBe(true);
      // The chime's threshold is the one `drawTerminal` prints OK at, and the arc stops
      // on the same frame — one event, one sound, one picture.
      expect(hz.restore).toBe(1);
      expect(hz.isSparking).toBe(false);
    });
  });

  it('help does not lapse: the room stays fixed for the rest of the screen', () => {
    const sim = onScreen3();
    engageBadge(sim);
    const hz = hazardOf(sim);
    fire(sim, HAZARDS.WORKPLACE.TAPE_LAYERS);
    stepN(sim, 400);
    expect(hz.restore).toBe(1);
    stepN(sim, 900); // 15s — longer than any old timed shield
    expect(hz.restore).toBe(1);
    expect(hz.isFixed).toBe(true);
    expect(sim.activePower?.product).toBe('500Leaders');
  });
});
