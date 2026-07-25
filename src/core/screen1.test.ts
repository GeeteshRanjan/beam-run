import { describe, it, expect } from 'vitest';
import { makeInput } from './Input';
import { JOURNEY, RESOLUTION, HAZARDS } from '../data/tuning.config';
import { Quicksand } from '../world/Hazards/Quicksand';
import {
  DT,
  T,
  driveToScreen,
  engageBadge,
  expireGrace,
  stepN,
} from '../test/helpers';

/** Standing sunk in the deep pit (cols 17–23; its surface is row 16). */
function standInDeepPit(sim: ReturnType<typeof driveToScreen>): void {
  sim.player.box.x = 19 * T;
  sim.player.box.y = 16 * T - sim.player.box.h;
}

/** Screen 1's sludge rects, straight from the level data. */
function sim1Quicksand() {
  return driveToScreen(1).screen.data.quicksand!;
}

/** Wading the shallow struggle sludge (flush with the ground, before the badge). */
function standInShallowSludge(sim: ReturnType<typeof driveToScreen>): void {
  sim.player.box.x = 7 * T;
  sim.player.box.y = 15 * T - sim.player.box.h;
}

describe('Screen 1 — Setup Delays (struggle sludge → 1Wrk bridge → relief)', () => {
  it('is the 1Wrk capability screen', () => {
    const sim = driveToScreen(1);
    expect(sim.screen.data.badge!.type).toBe('PLACE_TILE');
    expect(sim.screen.data.hazard).toBe('quicksand');
    expect(sim.activeHazard).toBeInstanceOf(Quicksand);
  });

  it('the struggle sludge sits before the badge and the deep pit after it', () => {
    const sim = driveToScreen(1);
    const badgeGx = sim.screen.data.badge!.gx;
    const rects = sim.screen.data.quicksand!;
    const shallow = rects.find((r) => r.deep === false)!;
    const deep = rects.find((r) => r.deep !== false)!;
    expect(shallow.gx).toBeLessThan(badgeGx);
    expect(deep.gx).toBeGreaterThan(badgeGx);
  });

  it('wading the struggle sludge drags you but never costs months', () => {
    const sim = driveToScreen(1);
    expireGrace(sim);
    const before = sim.months;
    for (let i = 0; i < Math.ceil((HAZARDS.QUICKSAND.SINK_SETBACK_TIME * 6) / DT); i += 1) {
      standInShallowSludge(sim);
      sim.step(DT, makeInput());
    }
    expect(sim.months).toBe(before);
    expect(sim.state).toBe('PLAYING');
  });

  it('wading the struggle sludge is unmistakably slower than dry ground', () => {
    // The drag is the message on this screen, so it has to be legible as motion,
    // not just as a number in the config. Same input, same duration, both on the
    // ground band: the sludge run must cover well under half the dry distance.
    const walkRight = makeInput({ right: true });
    const FRAMES = 36; // 0.6s

    const runFrom = (x: number): number => {
      const sim = driveToScreen(1);
      sim.player.box.x = x;
      sim.player.box.y = 15 * T - sim.player.box.h;
      sim.player.vx = 0;
      const start = sim.player.box.x;
      for (let i = 0; i < FRAMES; i += 1) sim.step(DT, walkRight);
      return sim.player.box.x - start;
    };

    const dry = runFrom(1 * T); // cols 1–5 are dry ground
    const wading = runFrom(6 * T + 4); // inside the struggle sludge (cols 6–9)

    expect(dry).toBeGreaterThan(100);
    expect(wading).toBeLessThan(dry * 0.45);
  });

  it('the struggle wade cannot be skipped — not by leaping it, not by hopping it', () => {
    const rects = sim1Quicksand();
    const shallow = rects.find((r) => r.deep === false)!;
    const spanPx = shallow.w * T;

    // 1) Too wide to leap. A full-strength running jump carries ~140px, so the
    //    zone has to be comfortably more than that or the drag is optional.
    const runUp = driveToScreen(1);
    runUp.player.box.x = 2 * T;
    runUp.player.box.y = 15 * T - runUp.player.box.h;
    stepN(runUp, 20);
    for (let i = 0; i < 30; i += 1) runUp.step(DT, makeInput({ right: true }));
    const takeOff = runUp.player.box.x;
    runUp.step(DT, makeInput({ right: true, jumpPressed: true, jumpHeld: true }));
    let frames = 0;
    while (!runUp.player.onGround && frames < 300) {
      runUp.step(DT, makeInput({ right: true, jumpHeld: true }));
      frames += 1;
    }
    const leap = runUp.player.box.x - takeOff;
    expect(spanPx).toBeGreaterThan(leap * 1.5);
    // …and the landing is inside the sludge, not past it.
    expect(runUp.player.box.x).toBeLessThan((shallow.gx + shallow.w) * T);

    // 2) Hopping across is no faster than walking it. The drag reaches a little
    //    way into the air, so chained hops (which used to cross in a third of the
    //    time) buy nothing.
    const cross = (hop: boolean): number => {
      const sim = driveToScreen(1);
      sim.player.box.x = shallow.gx * T;
      sim.player.box.y = 15 * T - sim.player.box.h;
      let t = 0;
      let n = 0;
      const end = (shallow.gx + shallow.w) * T;
      while (sim.player.box.x < end && t < 30) {
        n += 1;
        sim.step(DT, makeInput({ right: true, jumpPressed: hop && n % 8 === 0, jumpHeld: hop }));
        t += DT;
      }
      return t;
    };
    const walked = cross(false);
    expect(walked).toBeGreaterThan(3.5); // the wade is a felt duration
    expect(cross(true)).toBeGreaterThan(walked * 0.9);
  });

  it('engaging 1Wrk lays a permanent flush bridge across the pit', () => {
    const sim = driveToScreen(1);
    const badge = sim.screen.data.badge!;
    engageBadge(sim);

    expect(sim.powerups.collected).toBe(true);
    expect(sim.powerups.isAssisted).toBe(true);
    const tile = sim.powerups.placedTile!;
    const spec = badge.placesTileAt!;
    expect(tile).not.toBeNull();
    expect(tile.x).toBe(spec.gx * T);
    expect(tile.y).toBe(spec.gy * T);
    expect(tile.w).toBe(spec.w * T);
    expect(tile.h).toBe(spec.h * T);
  });

  it('the help does not expire — the bridge and the HUD chip persist', () => {
    const sim = driveToScreen(1);
    engageBadge(sim);
    stepN(sim, 600); // 10 seconds, far longer than any old power duration
    expect(sim.powerups.placedTile).not.toBeNull();
    expect(sim.activePower?.product).toBe('1Wrk');
  });

  it('the placed bridge is solid — Beam lands on it', () => {
    const sim = driveToScreen(1);
    engageBadge(sim);
    const tile = sim.powerups.placedTile!;

    sim.player.box.x = tile.x + tile.w / 2;
    sim.player.box.y = tile.y - sim.player.box.h - 20;
    sim.player.vy = 0;
    stepN(sim, 30);

    expect(sim.player.onGround).toBe(true);
    expect(sim.player.box.y + sim.player.box.h).toBeCloseTo(tile.y, 0);
  });

  it('the bridge closes the pit to jumpable gaps (screen is completable)', () => {
    const sim = driveToScreen(1);
    engageBadge(sim);

    const groundY = 15 * T;
    const spans = sim.screen.solids
      .filter((s) => s.y === groundY)
      .concat([sim.powerups.placedTile!])
      .map((s) => ({ start: s.x, end: s.x + s.w }))
      .sort((a, b) => a.start - b.start);

    let maxGap = 0;
    for (let i = 1; i < spans.length; i += 1) {
      maxGap = Math.max(maxGap, spans[i]!.start - spans[i - 1]!.end);
    }
    // Max full-jump distance ≈ 177px; gaps here are a single tile (40px).
    expect(maxGap).toBeLessThanOrEqual(177);
  });

  it('you cannot leap out of red tape — the deep pit suppresses jumping', () => {
    const sim = driveToScreen(1);
    expireGrace(sim);
    standInDeepPit(sim);
    stepN(sim, 2); // settle onto the sludge surface
    const restY = sim.player.box.y;
    for (let i = 0; i < 20; i += 1) {
      sim.step(DT, makeInput({ jumpPressed: true, jumpHeld: true }));
    }
    // Never rose: the jump input was suppressed while in the deep sludge.
    expect(sim.player.box.y).toBeGreaterThanOrEqual(restY - 1);
  });

  it('sinking in the pit books a delay and drops you back on solid ground', () => {
    const sim = driveToScreen(1);
    expireGrace(sim);
    const before = sim.months;
    for (let i = 0; i < 400; i += 1) {
      if (!sim.inSetback) standInDeepPit(sim);
      sim.step(DT, makeInput());
      if (sim.months > before) break;
    }
    expect(sim.months).toBe(before + JOURNEY.SETBACK_MONTHS);
    expect(sim.setbacks).toBe(1);
    // No death, no lives, no state change — the run continues.
    expect(sim.state).toBe('PLAYING');
    // Relocated back to known-good ground, not left in the pit.
    stepN(sim, 30);
    expect(sim.player.box.x).toBeLessThan(17 * T);
    expect(sim.player.box.y).toBeLessThan(RESOLUTION.HEIGHT);
  });

  it('ANSR does not walk away after a bad quarter — the bridge survives a setback', () => {
    const sim = driveToScreen(1);
    engageBadge(sim);
    expireGrace(sim);
    // Slip into the uncovered gap at col 17 (the bridge spans cols 18–22).
    const intoTheGap = () => {
      sim.player.box.x = 17 * T + 4;
      sim.player.box.y = 16 * T - sim.player.box.h;
    };
    for (let i = 0; i < 400 && sim.setbacks === 0; i += 1) {
      if (!sim.inSetback) intoTheGap();
      sim.step(DT, makeInput());
    }
    expect(sim.setbacks).toBe(1);
    expect(sim.powerups.placedTile).not.toBeNull();
    expect(sim.activePower?.product).toBe('1Wrk');
  });
});
