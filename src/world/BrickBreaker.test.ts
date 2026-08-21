/**
 * THE ENGINE ROOM, headless.
 *
 * Two of these tests are the reason the stage is shippable rather than a nice idea:
 * **it can always be finished** (the exit is an empty wall, so an unbreakable rally is
 * a soft lock, and a perfectly centred paddle used to produce one) and **it costs
 * nothing** (no months, no lives — proved at the Simulation level in
 * `bonusStage.test.ts`). Everything else here pins a number the raster or a probe paid
 * for.
 */
import { describe, it, expect } from 'vitest';
import { BrickBreaker, TUNNEL_LEFT, TUNNEL_RIGHT } from './BrickBreaker';
import { Player } from './Player';
import { makeInput, type InputState } from '../core/Input';
import { BONUS, LOOP, PLAYER, RESOLUTION } from '../data/tuning.config';

const DT = LOOP.FIXED_DT;
const R = BONUS.ROOM;

function start(): { stage: BrickBreaker; player: Player } {
  const stage = new BrickBreaker();
  const at = BrickBreaker.spawnPoint();
  return { stage, player: new Player(at.x, at.y) };
}

function run(
  stage: BrickBreaker,
  player: Player,
  seconds: number,
  input: (stage: BrickBreaker, player: Player) => Partial<InputState> = () => ({}),
): boolean {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i += 1) {
    if (stage.update(DT, player, makeInput(input(stage, player)))) return true;
  }
  return false;
}

/** A player who keeps the tray under the mark, and walks to the shaft once it is over. */
function tracker(stage: BrickBreaker, player: Player): Partial<InputState> {
  const cx = player.box.x + player.box.w / 2;
  const want = stage.remaining === 0 ? R.TUNNEL_CX : stage.ballState?.x;
  if (want === undefined) return {};
  if (want > cx + 8) return { right: true };
  if (want < cx - 8) return { left: true };
  return {};
}

describe('BrickBreaker — the room', () => {
  it('drops the player in at the top centre, above the frame', () => {
    const at = BrickBreaker.spawnPoint();
    expect(at.x + PLAYER.WIDTH / 2).toBe(R.TUNNEL_CX);
    expect(at.y + PLAYER.HEIGHT).toBeLessThan(0);
  });

  it('has a floor and two walls, and NO ceiling solid over the shaft', () => {
    const { stage } = start();
    // Nothing may be solid in the mouth's span above the ceiling line: the player
    // falls in through it and is sucked back out through it.
    for (const s of stage.solids) {
      const overMouth = s.x < TUNNEL_RIGHT && s.x + s.w > TUNNEL_LEFT;
      if (overMouth) expect(s.y).toBeGreaterThanOrEqual(R.FLOOR_Y);
    }
    expect(stage.solids.some((s) => s.y === R.FLOOR_Y)).toBe(true);
  });

  it('lands him on the floor and cannot be jumped out of', () => {
    const { stage, player } = start();
    run(stage, player, 1.2, () => ({ jumpPressed: true, jumpHeld: true }));
    expect(player.box.y + player.box.h).toBe(R.FLOOR_Y);
    expect(stage.phase).toBe('arming');
    // Jump is masked for the whole stage: the tray is carried over his head, so a jump
    // would take the bounce line with it.
    run(stage, player, 1.0, () => ({ jumpPressed: true, jumpHeld: true }));
    expect(player.box.y + player.box.h).toBe(R.FLOOR_Y);
  });

  it('keeps him inside the walls', () => {
    const { stage, player } = start();
    run(stage, player, 6, () => ({ left: true }));
    expect(player.box.x).toBeGreaterThanOrEqual(R.WALL);
    run(stage, player, 8, () => ({ right: true }));
    expect(player.box.x + player.box.w).toBeLessThanOrEqual(RESOLUTION.WIDTH - R.WALL);
  });
});

describe('BrickBreaker — the opening sequence', () => {
  it('equips the tray at least a second before the wall exists', () => {
    const { stage, player } = start();
    run(stage, player, BONUS.BEAT.TRAY_AT - 0.1);
    expect(stage.trayState.phase).toBe('waiting');
    expect(stage.equipped).toBe(false);
    // Owner's order: the tray arrives, and only then the wall.
    let equippedAt = -1;
    for (let i = 0; i < 400 && equippedAt < 0; i += 1) {
      stage.update(DT, player, makeInput());
      if (stage.equipped) equippedAt = stage.clock;
    }
    expect(equippedAt).toBeGreaterThan(0);
    expect(BONUS.BEAT.BRICKS_AT - equippedAt).toBeGreaterThan(0.9);
  });

  it('gives him the skateboard, and the skateboard is faster than walking', () => {
    const { stage, player } = start();
    run(stage, player, 3.4, () => ({ right: true }));
    expect(stage.equipped).toBe(true);
    // Wall out of the way: measure his pace mid-floor rather than against it.
    player.box.x = 200;
    run(stage, player, 1.0, () => ({ right: true }));
    expect(Math.abs(player.vx)).toBeGreaterThan(PLAYER.WALK_SPEED + 10);
    expect(Math.abs(player.vx)).toBeCloseTo(PLAYER.WALK_SPEED * BONUS.PADDLE.SKATE_SPEED_MULT, 0);
  });

  it('builds the wall row by row and then throws once, off the far wall, onto the tray', () => {
    const { stage, player } = start();
    run(stage, player, BONUS.BEAT.BRICKS_AT + 0.05);
    const revealed = stage.brickStates.filter((b) => b.reveal >= 1).length;
    expect(revealed).toBeLessThan(stage.total);
    run(stage, player, BONUS.BRICKS.ROWS.length * BONUS.BEAT.ROW_REVEAL + 0.1);
    expect(stage.brickStates.every((b) => b.reveal >= 1)).toBe(true);
    expect(stage.ballState).toBeNull();
    // The wall is up a long time before the first mark: the player has to be able to
    // read a room they have never seen (owner call).
    expect(BONUS.BEAT.SERVE_AT - (BONUS.BEAT.BRICKS_AT + 4 * BONUS.BEAT.ROW_REVEAL)).toBeGreaterThan(
      3,
    );
    run(stage, player, BONUS.BEAT.SERVE_AT - stage.clock + 0.05);
    expect(stage.serves).toBe(1);
    const ball = stage.ballState!;
    /*
     * It leaves the mouth of a machine **hanging on a side wall** — in the band between
     * the bottom course (322) and the bounce line (540), the only path in the room that
     * reaches the tray without meeting a block — and it is travelling DOWN, towards the
     * tray, not up at the wall.
     */
    expect(ball.y).toBeGreaterThan(BONUS.CANNON.MOUNT_Y - 1);
    expect(ball.y).toBeLessThan(BONUS.PADDLE.TOP);
    expect(ball.vy).toBeGreaterThan(0);
    // Thrown by the machine on the **far** side of the room: the hero fell in at the
    // centre, drifted nowhere, so either is 'far' — but the throw crosses towards him.
    const firing = stage.cannonStates.find((c) => c.flash > 0)!;
    expect(firing).toBeDefined();
    expect(Math.sign(ball.vx)).toBe(-firing.side);
  });

  it('lays the throw ON the tray, from the far wall, and points the barrel down it', () => {
    const { stage, player } = start();
    // Park him well left of centre: the machine on the RIGHT wall is the one that throws.
    run(stage, player, BONUS.BEAT.SERVE_AT - BONUS.CANNON.AIM - 0.2, () => ({ left: true }));
    expect(stage.cannonStates.every((c) => c.aim === 0)).toBe(true);
    run(stage, player, 0.25, () => ({ left: true }));
    const charging = stage.cannonStates.filter((c) => c.aim > 0);
    expect(charging).toHaveLength(1);
    const gun = charging[0]!;
    expect(gun.side).toBe(1);
    // Hold still through the wind-up, and the mark arrives where the tray is.
    for (let i = 0; i < 400 && !stage.ballState; i += 1) stage.update(DT, player, makeInput());
    const ball = stage.ballState!;
    // The mark is on the barrel's own line — the wind-up told the truth.
    const mag = Math.hypot(ball.vx, ball.vy);
    expect(ball.vx / mag).toBeCloseTo(gun.ux, 4);
    expect(ball.vy / mag).toBeCloseTo(gun.uy, 4);
    // …and that line lands within a step of the middle of the tray.
    const landsAt = ball.x + (ball.vx / ball.vy) * (BONUS.PADDLE.TOP + 6 - ball.y);
    expect(Math.abs(landsAt - stage.trayState.x)).toBeLessThanOrEqual(BONUS.CANNON.WIDE + 1);
    // Most throws are a catch without moving: run a handful and count.
    let caught = 0;
    for (let n = 0; n < 24; n += 1) {
      const s = new BrickBreaker();
      const at = BrickBreaker.spawnPoint();
      const p = new Player(at.x, at.y);
      // A different idle column each time, so the geometry is not one sample.
      const drift = n % 2 === 0 ? { left: true } : { right: true };
      run(s, p, 1.5 + n * 0.11, () => drift);
      for (let i = 0; i < 60 * 30 && s.serves === 0; i += 1) s.update(DT, p, makeInput());
      const b = s.ballState!;
      const at540 = b.x + (b.vx / b.vy) * (BONUS.PADDLE.TOP + 6 - b.y);
      if (Math.abs(at540 - s.trayState.x) <= BONUS.PADDLE.W / 2 + BONUS.BALL.D / 2) caught += 1;
    }
    expect(caught).toBeGreaterThanOrEqual(18);
  });

  it('meets the wall from UNDERNEATH: the first block down is on the bottom course', () => {
    const { stage, player } = start();
    // Served out of the ceiling the mark started inside the wall's own footprint (the
    // shaft is at x 640, the wall spans 87..1193) and opened it from the inside, taking
    // two or three blocks with it before the player was involved at all. Fired off the
    // floor, the bottom row is what it reaches first — which is also the row the wall is
    // authored to be read from.
    for (let i = 0; i < 60 * 20 && stage.breaks === 0; i += 1) {
      stage.update(DT, player, makeInput());
    }
    expect(stage.breaks).toBe(1);
    const gone = stage.brickStates.filter((b) => !b.alive);
    expect(gone).toHaveLength(1);
    expect(gone[0]!.row).toBe(BONUS.BRICKS.ROWS.length - 1);
  });

  it('has 24 blocks, one theme per row, and 15 of the owner\u2019s labels', () => {
    const { stage } = start();
    expect(stage.total).toBe(24);
    const labels = stage.brickStates.filter((b) => b.label).map((b) => b.label!);
    expect(labels).toHaveLength(15);
    expect(new Set(labels).size).toBe(15);
    for (const row of BONUS.BRICKS.ROWS) {
      const inRow = stage.brickStates.filter((b) => b.tone === row.tone);
      expect(inRow).toHaveLength(row.labels.length);
      expect(new Set(inRow.map((b) => b.row)).size).toBe(1);
    }
  });
});

describe('BrickBreaker — the mark', () => {
  it('bounces off the tray and never straight up', () => {
    const { stage, player } = start();
    run(stage, player, 40, tracker);
    expect(stage.paddleHits).toBeGreaterThan(3);
    /*
     * The claim: after every tray bounce the mark has somewhere to go sideways. A
     * vertical return in a column that has already been emptied is a closed orbit
     * between the tray and the ceiling, and the only way out of this room is an empty
     * wall — six of 27 policies were still going at 300s before `MIN_BOUNCE_DEG`.
     */
    const min = Math.sin((BONUS.PADDLE.MIN_BOUNCE_DEG * Math.PI) / 180) - 0.02;
    const stage2 = start();
    let contacts = 0;
    let inThrow = false;
    for (let i = 0; i < 60 * 40; i += 1) {
      const before = stage2.stage.serves;
      stage2.stage.update(DT, stage2.player, makeInput(tracker(stage2.stage, stage2.player)));
      const s = stage2.stage;
      if (s.serves > before) inThrow = true;
      const hits = s.paddleHits + s.wallHits + s.breaks;
      if (hits > contacts) {
        contacts = hits;
        inThrow = false;
      }
      const ball = s.ballState;
      if (!ball) continue;
      const speed = Math.hypot(ball.vx, ball.vy);
      expect(Math.abs(ball.vx) / speed).toBeGreaterThan(min);
      /*
       * The `MIN_VY_FRACTION` floor is a rule about the mark once it is **in play**: a
       * shallow paddle return runs along the ceiling for ever and the rally stalls. The
       * throw out of a wall cannon is deliberately exempt and deliberately flat — it is
       * one straight line from a machine 190px above the tray to a point on the tray, so
       * the flattest it can be is the width of the room over that drop (~0.17). It still
       * has real vertical progress, which is what stops a missed throw living for ever:
       * at 0.17 of 470 it is on the floor within a second of passing the tray.
       */
      const floor = inThrow ? 0.15 : BONUS.BALL.MIN_VY_FRACTION - 0.02;
      expect(Math.abs(ball.vy) / speed).toBeGreaterThan(floor);
    }
  });

  it('stays inside the room', () => {
    const { stage, player } = start();
    for (let i = 0; i < 60 * 40; i += 1) {
      stage.update(DT, player, makeInput(tracker(stage, player)));
      const ball = stage.ballState;
      if (!ball) continue;
      expect(ball.x - BONUS.BALL.D / 2).toBeGreaterThanOrEqual(R.WALL - 0.01);
      expect(ball.x + BONUS.BALL.D / 2).toBeLessThanOrEqual(RESOLUTION.WIDTH - R.WALL + 0.01);
      expect(ball.y - BONUS.BALL.D / 2).toBeGreaterThanOrEqual(R.CEILING - 0.01);
    }
  });

  it('speeds up as the wall thins, capped', () => {
    const { stage, player } = start();
    run(stage, player, 8, tracker);
    const early = stage.ballState ? Math.hypot(stage.ballState.vx, stage.ballState.vy) : 0;
    expect(early).toBeCloseTo(BONUS.BALL.SPEED + stage.breaks * BONUS.BALL.SPEED_GAIN, 0);
    run(stage, player, 30, tracker);
    const later = stage.ballState ? Math.hypot(stage.ballState.vx, stage.ballState.vy) : 0;
    if (later > 0) {
      expect(later).toBeGreaterThanOrEqual(early - 1);
      expect(later).toBeLessThanOrEqual(BONUS.BALL.MAX_SPEED + 1);
    }
  });

  it('a miss costs nothing but time: the mark lies there, fades, and another comes', () => {
    const { stage, player } = start();
    // Stand at one end and do nothing with the tray: sooner or later a mark fired from
    // the other cannon comes down out of reach and reaches the floor.
    for (let i = 0; i < 60 * 40 && stage.losses === 0; i += 1) {
      stage.update(DT, player, makeInput({ left: true }));
    }
    expect(stage.losses).toBe(1);
    const brokenBefore = stage.total - stage.remaining;
    expect(stage.lostBall).not.toBeNull();
    run(stage, player, BONUS.BALL.LOST_FADE + BONUS.BALL.RESPAWN_GAP + 0.2, () => ({ left: true }));
    expect(stage.lostBall).toBeNull();
    expect(stage.serves).toBeGreaterThan(1);
    // The wall keeps whatever damage it had: a miss is momentum, never progress.
    expect(stage.total - stage.remaining).toBe(brokenBefore);
  });
});

describe('BrickBreaker — it can always be finished', () => {
  it('a player who follows the mark clears the wall and is lifted out', () => {
    const { stage, player } = start();
    const done = run(stage, player, 120, tracker);
    expect(stage.remaining).toBe(0);
    expect(done).toBe(true);
    expect(stage.finished).toBe(true);
    expect(stage.clock).toBeLessThan(75);
    // The watchdog should barely be needed at 20 degrees (it was 10 nudges at 12).
    expect(stage.nudges).toBeLessThan(4);
  });

  it('clears even for somebody who never touches the controls, because the machine starts throwing at the wall', () => {
    /*
     * The room's only exit is an empty wall, so it has to come down whatever the player
     * does — and a throw aimed at the tray is a gift that can be ignored. Parked, the tray
     * only ever returns the mark up its own end of the room, so the far columns stand for
     * ever: measured, 1 to 3 blocks left after ten minutes. `CANNON.RESCUE_AFTER` is the
     * valve, and this is the test that says the valve works.
     */
    const { stage, player } = start();
    for (let i = 0; i < 60 * 300 && stage.remaining > 0; i += 1) {
      stage.update(DT, player, makeInput());
    }
    expect(stage.remaining).toBe(0);
    // It is still much slower than playing (~35s), so skill is worth something.
    expect(stage.clock).toBeGreaterThan(90);
    // And it only ever fires after a run of misses with nothing broken.
    expect(stage.losses).toBeGreaterThan(BONUS.CANNON.RESCUE_AFTER);
  });

  it('the shaft waits, then draws, and only carries him while he is in it', () => {
    const { stage, player } = start();
    // Clear the wall, then stop at the far end of the room.
    for (let i = 0; i < 60 * 120 && stage.remaining > 0; i += 1) {
      stage.update(DT, player, makeInput(tracker(stage, player)));
    }
    expect(stage.suctionOn).toBe(false);
    player.box.x = 1000;
    run(stage, player, BONUS.EXIT.SUCK_DELAY + 0.1);
    expect(stage.suctionOn).toBe(true);
    // Standing away from the column, nothing happens to him.
    const restY = player.box.y;
    run(stage, player, 1.5);
    expect(stage.carrying).toBe(false);
    expect(player.box.y).toBe(restY);
    // Walk into it and it takes him up and out.
    const done = run(stage, player, 8, () => ({ left: true }));
    expect(stage.carrying).toBe(true);
    expect(done).toBe(true);
    expect(player.box.y + player.box.h).toBeLessThanOrEqual(0);
  });

  it('is deterministic: two identical runs agree frame for frame', () => {
    const a = start();
    const b = start();
    for (let i = 0; i < 60 * 30; i += 1) {
      a.stage.update(DT, a.player, makeInput(tracker(a.stage, a.player)));
      b.stage.update(DT, b.player, makeInput(tracker(b.stage, b.player)));
    }
    expect(a.stage.remaining).toBe(b.stage.remaining);
    expect(a.stage.ballState?.x).toBe(b.stage.ballState?.x);
    expect(a.player.box.x).toBe(b.player.box.x);
  });
});
