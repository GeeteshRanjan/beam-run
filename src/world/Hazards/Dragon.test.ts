import { describe, it, expect } from 'vitest';
import { Dragon, coneBoxes } from './Dragon';
import { Player } from '../Player';
import type { AABB } from '../Physics';
import { LOOP, HAZARDS, RESOLUTION, PLAYER } from '../../data/tuning.config';
import type { DragonSpec } from '../../data/levels';
import type { HazardContext } from '../types';

const DT = LOOP.FIXED_DT;
const T = RESOLUTION.TILE;
const D = HAZARDS.DRAGON;
const GROUND_TOP = 15 * T;

const CTX: HazardContext = { assisted: false, extraTelegraph: 0 };
const ASSISTED: HazardContext = { assisted: true, extraTelegraph: 0 };
const SHOOTING: HazardContext = { assisted: true, extraTelegraph: 0, shoot: true };

const SPEC: DragonSpec = {
  name: 'HIRING AT SCALE',
  from: 23,
  to: 29,
  seed: 1774,
  taunts: ['CANDIDATE DECLINED', 'POOL TOO NARROW'],
};

function dragon(over: Partial<DragonSpec> = {}): Dragon {
  return new Dragon([{ ...SPEC, ...over }]);
}

/** A player standing on the ground band at a grid column. */
function stander(gx: number): Player {
  const p = new Player(gx * T, GROUND_TOP - PLAYER.HEIGHT);
  p.box.x = gx * T;
  p.box.y = GROUND_TOP - PLAYER.HEIGHT;
  return p;
}

/** Advance `seconds`, returning the first setback cause seen (or null). */
function run(d: Dragon, p: Player, seconds: number, ctx: HazardContext = CTX): string | null {
  let cause: string | null = null;
  for (let i = 0; i < Math.ceil(seconds / DT); i += 1) {
    cause = d.update(DT, p, ctx) ?? cause;
  }
  return cause;
}

function overlaps(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Is there a flame on the player right now?
 *
 * Read from the hazard's own snapshot, which is what makes this a real check: the
 * claim being tested is "only fire is lethal", so the test has to be able to say
 * whether a flame was there — not just whether the dragon was.
 */
function fireOn(d: Dragon, p: Player): boolean {
  const f = d.fireState();
  if (!f || f.phase !== 'burning') return false;
  return f.boxes.some((b) => overlaps(p.box, b));
}

/** Advance until `predicate` holds, or give up after `seconds`. */
function until(
  d: Dragon,
  p: Player,
  predicate: () => boolean,
  seconds = 30,
  ctx: HazardContext = CTX,
): boolean {
  for (let i = 0; i < Math.ceil(seconds / DT); i += 1) {
    d.update(DT, p, ctx);
    if (predicate()) return true;
  }
  return false;
}

/** Beat the dragon by only ever firing in the gaps. Returns seconds taken. */
function beat(d: Dragon, p: Player, maxSeconds = 60): number {
  const gap = Math.ceil(D.WATER_COOLDOWN / DT) + 1;
  let frames = 0;
  const limit = Math.ceil(maxSeconds / DT);
  while (!d.isBeaten && frames < limit) {
    const shoot = d.isVulnerable && frames % gap === 0;
    d.update(DT, p, shoot ? SHOOTING : ASSISTED);
    frames += 1;
  }
  return frames * DT;
}

describe('the hiring dragon', () => {
  describe('the opening roar (the guaranteed safe beat)', () => {
    it('roars first, and does not move or attack while it does', () => {
      const d = dragon();
      const p = stander(24);
      const startX = d.dragonState().box.x;
      expect(d.isRoaring).toBe(true);

      // Standing right beside it for the whole roar costs nothing, and nothing has
      // come out of it.
      const cause = run(d, p, D.ROAR_TIME - 0.05);
      expect(cause).toBeNull();
      expect(d.isRoaring).toBe(true);
      expect(d.fireState()).toBeNull();
      // It has not shifted an inch either — the roar is a full stop.
      expect(d.dragonState().box.x).toBe(startX);
    });

    it('starts working once the roar is done, and never roars again', () => {
      const d = dragon();
      const p = stander(2);
      run(d, p, D.ROAR_TIME + 0.1);
      expect(d.isRoaring).toBe(false);
      expect(d.dragonState().phase).not.toBe('roar');
      // Ten more seconds of fighting: no second free pass.
      let sawRoar = false;
      for (let i = 0; i < Math.ceil(10 / DT); i += 1) {
        d.update(DT, p, CTX);
        if (d.isRoaring) sawRoar = true;
      }
      expect(sawRoar).toBe(false);
    });

    it('gives the beat back on a fresh attempt', () => {
      const d = dragon();
      const p = stander(2);
      run(d, p, D.ROAR_TIME + 2);
      expect(d.isRoaring).toBe(false);
      d.reset();
      expect(d.isRoaring).toBe(true);
      expect(run(d, p, D.ROAR_TIME - 0.05)).toBeNull();
    });
  });

  describe('it stands on the ground and holds the end of the screen', () => {
    it('stands on its two feet: the body sits on the ground band', () => {
      // The owner's call, measured. There is no hover row in level data any more, so
      // this is derived from BODY_H and the ground — and it must stay derived, or a
      // dragon can be authored back into the air.
      const d = dragon();
      const box = d.dragonState().box;
      expect(box.y + box.h).toBe(GROUND_TOP);
      expect(box.h).toBe(D.BODY_H);
      // …and it stays down there through a whole fight. Nothing bobs.
      const p = stander(2);
      for (let i = 0; i < Math.ceil(20 / DT); i += 1) {
        d.update(DT, p, CTX);
        const b = d.dragonState().box;
        expect(b.y + b.h).toBe(GROUND_TOP);
      }
    });

    it('starts on its patch of ground, not at the edge of it', () => {
      const d = dragon();
      const cx = d.dragonState().box.x + D.BODY_W / 2;
      const centre = (SPEC.from * T + D.BODY_W / 2 + ((SPEC.to + 1) * T - D.BODY_W / 2)) / 2;
      expect(cx).toBeCloseTo(centre, 5);
    });

    it('never leaves it, however long the player runs about', () => {
      const d = dragon();
      const p = stander(2);
      for (let i = 0; i < Math.ceil(90 / DT); i += 1) {
        // Drag the player from one end of the frame to the other: the dragon must not
        // follow. This is the owner's call made testable — it stands at the end of the
        // screen, so the approach belongs to the player.
        p.box.x = ((i * 7) % (RESOLUTION.WIDTH + 200)) - 100;
        d.update(DT, p, CTX);
        const box = d.dragonState().box;
        expect(box.x).toBeGreaterThanOrEqual(SPEC.from * T - 1);
        expect(box.x + box.w).toBeLessThanOrEqual((SPEC.to + 1) * T + 1);
      }
    });

    it('shifts its weight rather than standing still', () => {
      const d = dragon();
      const p = stander(2);
      run(d, p, D.ROAR_TIME + 0.2);
      const seen = new Set<number>();
      for (let i = 0; i < Math.ceil(6 / DT); i += 1) {
        d.update(DT, p, CTX);
        seen.add(Math.round(d.dragonState().box.x / 8));
      }
      expect(seen.size).toBeGreaterThan(1);
    });

    it('leaves the whole approach to the player: no fire reaches the spawn', () => {
      // The cone has a fixed reach and nothing travels past it, which is what makes
      // the left third of the frame a place to read the pattern from.
      const d = dragon();
      const p = stander(1);
      let nearestFire: number = RESOLUTION.WIDTH;
      for (let i = 0; i < Math.ceil(40 / DT); i += 1) {
        d.update(DT, p, CTX);
        for (const b of d.fireState()?.boxes ?? []) {
          nearestFire = Math.min(nearestFire, b.x);
        }
      }
      /*
       * Clear of the spawn, with a walk in hand.
       *
       * This used to also have to clear a drop column *behind* the player (gx 8), which was
       * the tightest of the three constraints on `CONE_REACH`. That column is gone — there
       * is one brick now, at gx 16, and it stands inside the lane on purpose. So what is
       * left is the rule that has always mattered: the player must be able to stand where
       * the screen puts them and read the pattern before anything can reach them. 200px is
       * four tiles of walking, and the lane's far end measures ~339 against a spawn at 40.
       */
      expect(nearestFire).toBeGreaterThan(1 * T + PLAYER.WIDTH + 200);
    });
  });

  describe('its fire is the hazard, and the dragon is not', () => {
    it('cannot cost anything by being touched: a minute inside its body is free', () => {
      // The screen's central rule, and the thing that licenses a boss with no
      // telegraph on its own movement: the body is not a hitbox. Sit *inside* it for a
      // minute, unassisted, and nothing is ever charged.
      const d = dragon();
      const p = stander(24);
      let cause: string | null = null;
      for (let i = 0; i < Math.ceil(60 / DT); i += 1) {
        const box = d.dragonState().box;
        p.box.x = box.x + box.w / 2;
        p.box.y = box.y + box.h / 2;
        cause = d.update(DT, p, CTX) ?? cause;
      }
      expect(cause).toBeNull();
      // …and it was busy the whole time, so this is not a test of a docile dragon.
      expect(d.dragonState().phase).not.toBe('roar');
    });

    it('only ever books a delay for a flame that was on the player', () => {
      // The same rule stated as an audit, from *inside the lane* this time: stand where
      // the fire is going and every delay booked has to be explainable by a flame.
      const d = dragon();
      let delays = 0;
      let unexplained = 0;
      const p = stander(16);
      for (let i = 0; i < Math.ceil(60 / DT); i += 1) {
        // Walk into whatever is burning: the far end of the cone, which is the part of
        // it a standing player can be caught by.
        const f = d.fireState();
        if (f) p.box.x = f.target.x - p.box.w / 2;
        p.box.y = GROUND_TOP - PLAYER.HEIGHT;
        const cause = d.update(DT, p, CTX);
        if (!cause) continue;
        delays += 1;
        // `touchingFire` runs last inside update(), so the post-update snapshot is
        // exactly the geometry the hazard tested against.
        if (!fireOn(d, p)) unexplained += 1;
      }
      expect(unexplained).toBe(0);
      // …and this is not vacuous: standing in the lane does get you burnt.
      expect(delays).toBeGreaterThan(0);
    });

    it('never costs anything during the wind-up, however long you stand in the mark', () => {
      const d = dragon();
      const p = stander(24);
      expect(until(d, p, () => d.fireState()?.phase === 'windup', 30)).toBe(true);

      // Stand at the far end of the lane for the rest of the wind-up. Free, every
      // frame — the mark is a warning, and a warning that costs something is not a
      // warning.
      p.box.x = d.fireState()!.target.x - p.box.w / 2;
      p.box.y = GROUND_TOP - PLAYER.HEIGHT;
      let frames = 0;
      let ignited = false;
      while (frames < 600) {
        if (d.fireState()?.phase !== 'windup') break;
        const cause = d.update(DT, p, CTX);
        // The frame the wind-up ends is the frame it starts burning, and burning him
        // on it is correct — so only assert on frames that were still a warning after
        // the step.
        if (d.fireState()?.phase === 'windup') {
          expect(cause).toBeNull();
          frames += 1;
        } else {
          ignited = true;
          break;
        }
      }
      expect(frames).toBeGreaterThan(2);
      expect(ignited).toBe(true);
      // …and once the flame has grown that far, it burns him where he stands.
      expect(d.isBreathing).toBe(true);
      expect(run(d, p, D.CONE_GROW + 0.1)).toBe('fire');
    });

    it('telegraphs on the floor, along the whole lane the fire will cover', () => {
      const d = dragon();
      const p = stander(2);
      expect(until(d, p, () => d.fireState()?.phase === 'windup')).toBe(true);
      const f = d.fireState()!;
      // The lane runs from the jaw towards the player and ends just above the floor,
      // which is where the flame will be running.
      expect(f.target.x).toBeLessThan(f.mouth.x);
      expect(f.target.y).toBeGreaterThan(GROUND_TOP - T);
      expect(f.target.y).toBeLessThan(GROUND_TOP);
      // Nothing is lethal yet: there is no cone during a wind-up at all.
      expect(f.extent).toBe(0);
      expect(f.boxes).toHaveLength(0);
      expect(d.isBreathing).toBe(false);
    });

    it('throws the lane clear of its own body, and does not move it', () => {
      const d = dragon();
      const p = stander(2);
      expect(until(d, p, () => d.fireState() !== null)).toBe(true);
      const f = d.fireState()!;
      const bodyBox = d.dragonState().box;
      // The far end is well clear of the animal, so the fire is a lane in front of it
      // rather than a puddle around its feet.
      expect(Math.abs(f.target.x - (bodyBox.x + bodyBox.w / 2))).toBeGreaterThan(bodyBox.w);
      // And it stays where it was committed even as the player runs about.
      const x0 = f.target.x;
      for (let i = 0; i < 20; i += 1) {
        p.box.x += 40;
        d.update(DT, p, CTX);
      }
      expect(d.fireState()?.target.x).toBe(x0);
    });

    it('grows out from the jaw rather than appearing all at once', () => {
      // The owner asked for a *growing* throw of fire, and the growth is a fairness
      // mechanism too: the end of the lane the player is standing at lights last.
      const d = dragon();
      const p = stander(2);
      expect(until(d, p, () => d.isBreathing)).toBe(true);
      const first = d.fireState()!;
      expect(first.extent).toBeLessThan(1);
      const reachOf = (f: { boxes: AABB[]; mouth: { x: number } }) =>
        f.boxes.length === 0 ? 0 : Math.abs(Math.min(...f.boxes.map((b) => b.x)) - f.mouth.x);
      const early = reachOf(first);
      run(d, p, D.CONE_GROW * 0.6, ASSISTED);
      const later = d.fireState()!;
      expect(later.extent).toBeGreaterThan(first.extent);
      expect(reachOf(later)).toBeGreaterThan(early);
      // Fully grown, it is the authored reach and it stops there — nothing travels.
      expect(until(d, p, () => (d.fireState()?.extent ?? 0) >= 1, 1, ASSISTED)).toBe(true);
      const full = d.fireState()!;
      expect(reachOf(full)).toBeGreaterThan(D.CONE_REACH * 0.8);
      expect(reachOf(full)).toBeLessThan(D.CONE_REACH * 1.15);
    });

    it('diverges: the flame is thicker at the far end than at the jaw', () => {
      const d = dragon();
      const p = stander(2);
      expect(until(d, p, () => (d.fireState()?.extent ?? 0) >= 1, 30, ASSISTED)).toBe(true);
      const boxes = d.fireState()!.boxes;
      expect(boxes.length).toBeGreaterThan(4);
      const near = boxes[0]!;
      const far = boxes[boxes.length - 1]!;
      // The flame gets thicker as it goes — measured on the widest segment rather than
      // on the last one, because the outer end of the cone is **clipped by the floor**
      // and so is physically shorter than the middle of it. (That clipping is the
      // point: it is what makes the fire look like it is running along the ground.)
      const thickest = Math.max(...boxes.map((b) => b.h));
      expect(thickest).toBeGreaterThan(near.h);
      // "Slightly" diverging: a jet, not a fan.
      expect(thickest / near.h).toBeLessThan(2);
      // The far end sits on the floor and reaches up past a standing player, so
      // anybody in the outer part of the lane is in it.
      expect(far.y + far.h).toBe(GROUND_TOP);
      expect(far.y).toBeLessThan(GROUND_TOP - PLAYER.HEIGHT);
      // …and the top edge falls as it travels: the flame starts high at the jaw and
      // comes down to the floor, which is why the strip under the jaw is safe.
      expect(far.y).toBeGreaterThan(near.y);
    });

    it('carries one taunt per burst, and it does not move', () => {
      const d = dragon();
      const p = stander(2);
      const labels: string[] = [];
      const spots = new Set<number>();
      for (let i = 0; i < Math.ceil(30 / DT) && labels.length < 2; i += 1) {
        d.update(DT, p, ASSISTED);
        const f = d.fireState();
        if (!f) continue;
        if (!labels.includes(f.label)) labels.push(f.label);
        spots.add(Math.round(f.labelAt.x));
      }
      // Two bursts, two different taunts, in the authored order.
      expect(labels).toEqual(SPEC.taunts.slice(0, 2));
      // The caption is pinned for the whole burst (owner call): each burst contributes
      // exactly one position, so two bursts can only ever have produced two.
      expect(spots.size).toBeLessThanOrEqual(labels.length);
    });

    it('can only be hit between bursts', () => {
      const d = dragon();
      const p = stander(24);
      expect(d.isVulnerable).toBe(false); // roaring
      const seen = new Set<boolean>();
      for (let i = 0; i < Math.ceil(30 / DT); i += 1) {
        d.update(DT, p, ASSISTED);
        const phase = d.dragonState().phase;
        expect(d.isVulnerable).toBe(phase === 'waiting');
        seen.add(d.isVulnerable);
      }
      // Both states really do occur, so the assertion above is not vacuous.
      expect(seen.has(true)).toBe(true);
      expect(seen.has(false)).toBe(true);
    });

    it('extra reaction time lengthens the wind-up and nothing else', () => {
      const measure = (extra: number): number => {
        const d = dragon();
        const p = stander(2);
        const ctx: HazardContext = { assisted: false, extraTelegraph: extra };
        expect(until(d, p, () => d.fireState()?.phase === 'windup', 30, ctx)).toBe(true);
        let frames = 0;
        while (d.fireState()?.phase === 'windup' && frames < 600) {
          d.update(DT, p, ctx);
          frames += 1;
        }
        return frames * DT;
      };
      const plain = measure(0);
      const generous = measure(0.4);
      expect(generous).toBeGreaterThan(plain + 0.3);
    });

    it('is deterministic: the same seed replays the same fight', () => {
      const trace = (): string => {
        const d = dragon();
        const p = stander(12);
        const out: string[] = [];
        for (let i = 0; i < Math.ceil(20 / DT); i += 1) {
          d.update(DT, p, CTX);
          if (i % 20 === 0) {
            out.push(`${d.dragonState().phase}:${Math.round(d.dragonState().box.x)}`);
          }
        }
        return out.join('|');
      };
      expect(trace()).toBe(trace());
    });

    it('a different seed reaches somewhere else with its fire', () => {
      const marks = (seed: number): string => {
        const d = dragon({ seed });
        const p = stander(12);
        const xs: number[] = [];
        for (let i = 0; i < Math.ceil(30 / DT); i += 1) {
          d.update(DT, p, CTX);
          const f = d.fireState();
          if (f && !xs.includes(Math.round(f.target.x))) xs.push(Math.round(f.target.x));
        }
        return xs.join(',');
      };
      expect(marks(1774)).not.toBe(marks(99));
    });
  });

  describe('the cone geometry (one source for what burns and what is painted)', () => {
    it('is empty until the flame has started to grow', () => {
      expect(coneBoxes({ x: 900, y: 480 }, { x: 500, y: 580 }, 0)).toHaveLength(0);
      expect(coneBoxes({ x: 900, y: 480 }, { x: 500, y: 580 }, -1)).toHaveLength(0);
    });

    it('steps along the axis, and never past the extent it was given', () => {
      const mouth = { x: 900, y: 480 };
      const target = { x: 500, y: 580 };
      const half = coneBoxes(mouth, target, 0.5);
      const all = coneBoxes(mouth, target, 1);
      expect(all.length).toBeGreaterThan(half.length);
      // Half grown, nothing exists past the half-way point of the axis.
      const tip = Math.min(...half.map((b) => b.x));
      expect(tip).toBeGreaterThanOrEqual((mouth.x + target.x) / 2 - 1);
      // …and the segments are contiguous: a gap in a cone is a safe square nobody
      // could see.
      const sorted = [...all].sort((a, b) => b.x - a.x);
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1]!;
        expect(Math.abs(sorted[i]!.x + sorted[i]!.w - prev.x)).toBeLessThan(1);
      }
    });

    it('is clipped by the floor rather than drawn through it', () => {
      const boxes = coneBoxes({ x: 900, y: 480 }, { x: 500, y: GROUND_TOP - 20 }, 1);
      for (const b of boxes) expect(b.y + b.h).toBeLessThanOrEqual(GROUND_TOP);
    });
  });

  describe('assisted (Talent500: a halo and a water cannon)', () => {
    it('makes every flame on the screen harmless', () => {
      expect(dragon().shieldsPlayer).toBe(true);
      const d = dragon();
      const p = stander(24);
      // Park him at the far end of the lane for a minute. Nothing can touch him.
      let cause: string | null = null;
      for (let i = 0; i < Math.ceil(60 / DT); i += 1) {
        const f = d.fireState();
        if (f) p.box.x = f.target.x - p.box.w / 2;
        cause = d.update(DT, p, ASSISTED) ?? cause;
      }
      expect(cause).toBeNull();
    });

    it('arms the cannon only once the badge is taken', () => {
      const d = dragon();
      const p = stander(20);
      d.update(DT, p, { assisted: false, extraTelegraph: 0, shoot: true });
      expect(d.hasCannon).toBe(false);
      expect(d.waterStates()).toHaveLength(0);
      expect(d.shotsFired).toBe(0);

      d.update(DT, p, SHOOTING);
      expect(d.hasCannon).toBe(true);
      expect(d.waterStates()).toHaveLength(1);
      expect(d.shotsFired).toBe(1);
    });

    it('aims the jet at the dragon, not straight ahead', () => {
      const d = dragon();
      // Well to the left of it, so "towards the dragon" is unambiguous.
      const p = stander(6);
      d.update(DT, p, SHOOTING);
      const jet = d.waterStates()[0]!;
      // Its chest is above a standing player's, so the jet must rise…
      expect(jet.dy).toBeLessThan(0);
      // …and lean towards it.
      expect(jet.dx).toBeGreaterThan(0);
      const bodyBox = d.dragonState().box;
      // The aim is a real bearing, not a fixed diagonal: the ratio matches the line
      // from the player to the body.
      expect(jet.dx / Math.abs(jet.dy)).toBeCloseTo(
        (bodyBox.x + bodyBox.w / 2 - (p.box.x + p.box.w)) /
          Math.abs(bodyBox.y + bodyBox.h / 2 - (p.box.y + p.box.h * 0.34)),
        1,
      );
    });

    it('respects the cooldown and the live-jet cap', () => {
      const d = dragon();
      const p = stander(20);
      d.update(DT, p, SHOOTING);
      d.update(DT, p, SHOOTING); // inside the cooldown
      expect(d.shotsFired).toBe(1);

      const gap = Math.ceil(D.WATER_COOLDOWN / DT) + 1;
      for (let n = 0; n < D.MAX_WATER + 3; n += 1) {
        for (let i = 0; i < gap; i += 1) d.update(DT, p, ASSISTED);
        d.update(DT, p, SHOOTING);
      }
      expect(d.waterStates().length).toBeLessThanOrEqual(D.MAX_WATER);
    });

    describe('water beats fire before it beats the wearer', () => {
      it('a jet into the burning cone quenches it rather than reaching the dragon', () => {
        const d = dragon();
        const p = stander(20);
        expect(until(d, p, () => d.isBreathing, 60, ASSISTED)).toBe(true);
        const layersBefore = d.layersLeft;
        // Stand in the lane and fire through the flame.
        const f = d.fireState()!;
        p.box.x = f.target.x - p.box.w / 2;
        const quenchesBefore = d.quenches;
        let guard = 0;
        while (d.quenches === quenchesBefore && guard < 200) {
          d.update(DT, p, guard % 12 === 0 ? SHOOTING : ASSISTED);
          guard += 1;
        }
        expect(d.quenches).toBeGreaterThan(quenchesBefore);
        // The costume is untouched: the fire took the jet.
        expect(d.layersLeft).toBe(layersBefore);
        expect(d.steamStates().length).toBeGreaterThan(0);
      });

      it('quenching cuts the burst short instead of cancelling it outright', () => {
        /*
         * Stated as **seconds of water on the flame** now that the cannon is a hose (owner
         * call), which is the only form of this claim that survives a change to the
         * stream's spacing. It used to be "three jets end a 1.2s burst", i.e. a per-jet
         * figure against a 0.24s trigger; chop the stream finer and that sentence quietly
         * becomes "a burst goes out in three frames".
         *
         * 0.72s of contact to end a 1.2s burst is the same contest as before, expressed
         * as a rate, and one segment is worth `QUENCH_RATE × WATER_COOLDOWN` whatever that
         * spacing happens to be.
         */
        const secondsToQuench = D.BURST_TIME / D.QUENCH_RATE;
        expect(secondsToQuench).toBeGreaterThan(0.5);
        expect(secondsToQuench).toBeLessThan(D.BURST_TIME);
        // One segment on its own must never be enough: that would be a switch.
        expect(D.QUENCH_RATE * D.WATER_COOLDOWN).toBeLessThan(D.BURST_TIME / 4);
      });

      it('a jet reaching the dragon between bursts takes a hit off the costume', () => {
        const d = dragon();
        const p = stander(20);
        const gap = Math.ceil(D.WATER_COOLDOWN / DT) + 1;
        let guard = 0;
        while (d.layersLeft === D.HITS_TO_STRIP && guard < 4000) {
          // Only ever fire while it is NOT busy, so every jet is a clean shot.
          const ctx = d.isVulnerable && guard % gap === 0 ? SHOOTING : ASSISTED;
          d.update(DT, p, ctx);
          guard += 1;
        }
        expect(d.layersLeft).toBe(D.HITS_TO_STRIP - 1);
        expect(d.hits).toBe(1);
        // The hit is still on screen, playing out: the rules book it at once, the
        // picture takes DISSOLVE_TIME to show water doing it.
        const dis = d.dragonState().dissolve;
        expect(dis?.layer).toBe(D.HITS_TO_STRIP);
        expect(dis!.progress).toBeLessThan(1);
      });

      it('the dissolve is presentation only: it never delays the fight', () => {
        const d = dragon();
        const p = stander(20);
        const gap = Math.ceil(D.WATER_COOLDOWN / DT) + 1;
        let guard = 0;
        while (d.hits === 0 && guard < 4000) {
          d.update(DT, p, d.isVulnerable && guard % gap === 0 ? SHOOTING : ASSISTED);
          guard += 1;
        }
        // It retaliates immediately, with the glass still running.
        expect(until(d, p, () => d.dragonState().phase === 'charging', 1, ASSISTED)).toBe(true);
        expect(d.dragonState().dissolve).not.toBeNull();
        // …and the dissolve clears itself.
        run(d, p, D.DISSOLVE_TIME + 0.1, ASSISTED);
        expect(d.dragonState().dissolve).toBeNull();
      });

      it('HITS_TO_STRIP clean jets take the costume off and free five hires', () => {
        const d = dragon();
        const p = stander(20);
        const seconds = beat(d, p);
        expect(d.isBeaten).toBe(true);
        expect(d.layersLeft).toBe(0);
        expect(d.hits).toBe(D.HITS_TO_STRIP);
        expect(d.candidateStates()).toHaveLength(D.CANDIDATES);
        // The fight is a fight, not a held button — and not a chore either. This is the
        // measured length of it, and the number the owner is deciding about.
        expect(seconds).toBeGreaterThan(4);
        expect(seconds).toBeLessThan(20);
      });

      it('the fall is a beat of its own, between the last hit and the costume opening', () => {
        /*
         * `isToppling` exists so the host can sound the fall (owner call: it "is very
         * dumb" — it had no cue at all, so the biggest event on the screen was left
         * sharing the small tear the three earlier hits play).
         *
         * Pinned here rather than in the host: it must be true for exactly the window
         * between the last jet landing and the hires walking out, never overlap `beaten`,
         * and never come back.
         */
        const d = dragon();
        const p = stander(20);
        expect(d.isToppling).toBe(false);
        const gap = Math.ceil(D.WATER_COOLDOWN / DT) + 1;
        let guard = 0;
        let toppleFrames = 0;
        let edges = 0;
        let prev = false;
        while (!d.isBeaten && guard < 6000) {
          p.box.x = 20 * T;
          d.update(DT, p, d.isVulnerable && guard % gap === 0 ? SHOOTING : ASSISTED);
          if (d.isToppling) {
            toppleFrames += 1;
            if (!prev) {
              edges += 1;
              // The topple starts on the frame the last hit is booked, which is why the
              // host plays it *instead of* that hit's tear rather than on top of it.
              expect(d.hits).toBe(D.HITS_TO_STRIP);
            }
            expect(d.isBeaten).toBe(false);
          }
          prev = d.isToppling;
          guard += 1;
        }
        expect(edges).toBe(1);
        expect(toppleFrames * DT).toBeCloseTo(D.STRIP_TIME, 1);
        expect(d.isToppling).toBe(false);
        expect(d.isBeaten).toBe(true);
      });

      it('the fight stops the instant the costume comes off, and stays stopped', () => {
        const d = dragon();
        const p = stander(20);
        beat(d, p);
        // Whatever it was mid-way through is gone from the same frame.
        expect(d.fireState()).toBeNull();

        // …and it is harmless from here on even to an UNASSISTED player standing where
        // it was: a beaten dragon cannot cost a life.
        let cause: string | null = null;
        for (let i = 0; i < Math.ceil(20 / DT); i += 1) {
          const box = d.dragonState().box;
          p.box.x = box.x + box.w / 2;
          cause = d.update(DT, p, CTX) ?? cause;
        }
        expect(cause).toBeNull();
        expect(d.fireState()).toBeNull();
      });

      it('the cannon refuses to fire at people who have just been hired', () => {
        const d = dragon();
        const p = stander(20);
        beat(d, p);
        const fired = d.shotsFired;
        for (let i = 0; i < 200; i += 1) d.update(DT, p, SHOOTING);
        expect(d.shotsFired).toBe(fired);
      });

      it('the five WALK OUT of the suit, one at a time, and line up on the floor', () => {
        const d = dragon();
        const p = stander(20);
        beat(d, p);
        /*
         * The owner's ending: the costume opens and they come out **one by one**. So the
         * claim is about the *order* as well as the destination — half way through the
         * sequence exactly some of them are out and the rest have not started, and nobody
         * is ever above the floor, because they walk rather than fall.
         */
        run(d, p, D.COSTUME_OPEN + D.CANDIDATE_STAGGER + D.CANDIDATE_WALK_TIME * 0.5, ASSISTED);
        const mid = d.candidateStates();
        expect(mid.filter((c) => c.progress > 0).length).toBeGreaterThan(0);
        expect(mid.filter((c) => c.progress > 0).length).toBeLessThan(D.CANDIDATES);
        for (const c of mid) expect(c.y).toBeCloseTo(GROUND_TOP, 5);

        run(d, p, D.CANDIDATE_STAGGER * D.CANDIDATES + D.CANDIDATE_WALK_TIME + 1, ASSISTED);
        const cands = d.candidateStates();
        expect(cands).toHaveLength(D.CANDIDATES);
        for (const c of cands) {
          expect(c.landed).toBe(true);
          expect(c.y).toBeCloseTo(GROUND_TOP, 5);
          // It stands near the right-hand edge, so the line-up has to be nudged back
          // onto the frame rather than centred on the body.
          expect(c.x).toBeGreaterThan(0);
          expect(c.x).toBeLessThan(RESOLUTION.WIDTH);
        }
        // Far enough apart to be five people rather than one crowd.
        const xs = cands.map((c) => c.x).sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i += 1) {
          expect(xs[i]! - xs[i - 1]!).toBeGreaterThan(40);
        }
      });

      it('the empty costume lies there, opens, and then VANISHES', () => {
        const d = dragon();
        const p = stander(20);
        beat(d, p);
        // It is on the floor from the frame the beast goes down, and shut.
        expect(d.costumeState()!.openness).toBeLessThan(0.2);
        run(d, p, D.COSTUME_OPEN + 0.05, ASSISTED);
        expect(d.costumeState()!.openness).toBe(1);
        expect(d.costumeState()!.fade).toBe(0);
        // …it is still there while the five are walking out and for the hold after,
        const allOut =
          D.COSTUME_OPEN + (D.CANDIDATES - 1) * D.CANDIDATE_STAGGER + D.CANDIDATE_WALK_TIME;
        run(d, p, allOut - D.COSTUME_OPEN + D.COSTUME_HOLD * 0.5, ASSISTED);
        expect(d.costumeState()).not.toBeNull();
        expect(d.costumeState()!.fade).toBe(0);
        // …then it goes, and once gone it reports nothing rather than a fully faded thing.
        run(d, p, D.COSTUME_HOLD + D.COSTUME_FADE + 0.2, ASSISTED);
        expect(d.costumeState()).toBeNull();
        expect(d.dragonState().costume).toBeNull();
        // The five stay: what the screen is won on is the hire, not the suit.
        expect(d.candidateStates().every((c) => c.landed)).toBe(true);
      });

      it('the environment comes good on its own dial, and only once it is beaten', () => {
        const d = dragon();
        const p = stander(20);
        expect(d.relief).toBe(0);
        beat(d, p);
        expect(d.relief).toBeLessThan(0.2);
        run(d, p, D.RELIEF_TIME * 0.5, ASSISTED);
        const half = d.relief;
        expect(half).toBeGreaterThan(0.2);
        expect(half).toBeLessThan(0.9);
        run(d, p, D.RELIEF_TIME, ASSISTED);
        expect(d.relief).toBe(1);
        // It is sim time, so a reset takes the whole payoff back with it.
        d.reset();
        expect(d.relief).toBe(0);
        expect(d.costumeState()).toBeNull();
      });
    });

    it('help does not lapse: hits already landed never come back', () => {
      const d = dragon();
      const p = stander(20);
      const gap = Math.ceil(D.WATER_COOLDOWN / DT) + 1;
      let guard = 0;
      while (d.layersLeft === D.HITS_TO_STRIP && guard < 4000) {
        const ctx = d.isVulnerable && guard % gap === 0 ? SHOOTING : ASSISTED;
        d.update(DT, p, ctx);
        guard += 1;
      }
      // Let the jets already in the air land first. One in flight when help is
      // withdrawn still lands — that is a shot the player took, not help lapsing.
      while (d.waterStates().length > 0 && guard < 8000) {
        d.update(DT, p, ASSISTED);
        guard += 1;
      }
      const stripped = d.layersLeft;
      run(d, p, 20, CTX); // help flag withdrawn entirely
      expect(d.layersLeft).toBe(stripped);
    });

    it('reset() gives back the costume, the roar and a clean lane', () => {
      const d = dragon();
      const p = stander(20);
      beat(d, p);
      d.reset();
      expect(d.layersLeft).toBe(D.HITS_TO_STRIP);
      expect(d.isRoaring).toBe(true);
      expect(d.isBeaten).toBe(false);
      expect(d.candidateStates()).toHaveLength(0);
      expect(d.fireState()).toBeNull();
      expect(d.waterStates()).toHaveLength(0);
      expect(d.dragonState().dissolve).toBeNull();
      expect(d.shotsFired).toBe(0);
      expect(d.hits).toBe(0);
      expect(d.quenches).toBe(0);
    });
  });

  it('contributes no geometry and never slows the player', () => {
    const d = dragon();
    expect(d.solids()).toEqual([]);
    expect(d.speedMultAt()).toBe(1);
  });
});
