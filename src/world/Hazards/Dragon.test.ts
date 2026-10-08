import { describe, it, expect } from 'vitest';
import { Dragon, flameStream, streamBoxes, type FlamePoint } from './Dragon';
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

  describe('its fire is the hazard, and so is its foot — never its body', () => {
    it('its body is a WALL, not a hitbox: it shoves you back and costs nothing', () => {
      // The body telegraphs nothing, so it may not hurt — but it may block (owner call:
      // "without killing the Godzilla the player should not be able to cross it"). Push
      // into its chest, above the height a foot can come down on, for a minute, unassisted:
      // nothing is ever charged, and every frame he is put back in front of it.
      // Pressed against its toes he is in front of the jaw, so its FIRE can still reach him
      // — that is the fire's business and is audited as such; what may never happen is a
      // charge the fire does not explain.
      const d = dragon();
      const p = stander(24);
      let unexplained = 0;
      for (let i = 0; i < Math.ceil(60 / DT); i += 1) {
        const box = d.dragonState().box;
        const cx = box.x + box.w / 2;
        p.box.x = cx - D.BARRIER_X - p.box.w + 10;
        p.box.y = box.y + 20;
        p.vx = PLAYER.WALK_SPEED;
        const cause = d.update(DT, p, CTX);
        if (cause && !(cause === 'fire' && fireOn(d, p))) unexplained += 1;
        expect(p.box.x + p.box.w).toBeLessThanOrEqual(d.dragonState().box.x + box.w / 2 - D.BARRIER_X);
        expect(p.vx).toBe(0);
      }
      expect(unexplained).toBe(0);
      expect(p.box.y + p.box.h).toBeLessThan(GROUND_TOP - D.STOMP_H);
      // …and it was busy the whole time, so this is not a test of a docile dragon.
      expect(d.dragonState().phase).not.toBe('roar');
    });

    it('stops being a wall the moment it goes down', () => {
      const d = dragon();
      beat(d, stander(14));
      const s = d.dragonState();
      const p = stander(4);
      p.box.x = s.box.x + s.box.w / 2;
      d.update(DT, p, CTX);
      expect(p.box.x).toBe(s.box.x + s.box.w / 2);
    });

    describe('the stomp (owner call: "stomp on the player like an animal would")', () => {
      /** Past the roar, with the player parked at its front foot. */
      const atItsFeet = () => {
        const d = dragon();
        const p = stander(4);
        expect(until(d, p, () => !d.isRoaring)).toBe(true);
        return { d, p };
      };
      const home = (d: Dragon) => {
        const s = d.dragonState();
        return s.box.x + s.box.w / 2 + s.dir * D.STOMP_FOOT_X;
      };

      it('flattens a player who stands at its feet — and lifts the foot first', () => {
        const { d, p } = atItsFeet();
        p.box.x = home(d) - p.box.w / 2;
        let cause: string | null = null;
        let lifted = 0;
        for (let i = 0; i < Math.ceil(3 / DT) && !cause; i += 1) {
          cause = d.update(DT, p, CTX);
          if (d.dragonState().stomp?.phase === 'lift') lifted += DT;
        }
        expect(cause).toBe('stomp');
        // The telegraph: the whole wind-up was spent with the foot in the air.
        expect(lifted).toBeGreaterThanOrEqual(D.STOMP_WINDUP - DT);
        // …and what hit him was the falling foot, on the floor where he stood.
        const box = d.dragonState().stomp?.box;
        expect(box).toBeTruthy();
        expect(box!.y + box!.h).toBe(GROUND_TOP);
      });

      it('reaching its wall puts you under the foot — and turning to run gets you out', () => {
        // The body is a wall until it is beaten, so the place a player ends up is pressed
        // against its toes; that has to be inside the trigger, or "reach it and be stood on"
        // is not what happens. And the foot is committed at the lift, so a player who turns
        // and runs as it rises is clear when it lands: the stomp is a warning, not a trap.
        const { d, p } = atItsFeet();
        const dir = d.dragonState().dir;
        p.box.x = home(d);
        p.vx = -dir * PLAYER.WALK_SPEED;
        d.update(DT, p, CTX);
        const cx = d.dragonState().box.x + d.dragonState().box.w / 2;
        expect(Math.abs(p.box.x + p.box.w / 2 - cx)).toBeGreaterThanOrEqual(D.BARRIER_X);
        expect(d.dragonState().stomp?.phase).toBe('lift');
        // Running back out means running back into the fire lane, which is the fire's
        // business; the claim here is only that the foot misses.
        let stomped = false;
        let landed = false;
        for (let i = 0; i < Math.ceil(1.2 / DT); i += 1) {
          p.box.x += dir * PLAYER.WALK_SPEED * DT;
          if (d.update(DT, p, CTX) === 'stomp') stomped = true;
          if (d.dragonState().stomp?.phase === 'slam') landed = true;
        }
        expect(landed).toBe(true);
        expect(stomped).toBe(false);
      });

      it('never stomps during the roar or once it is beaten; stomps a haloed player HARMLESSLY', () => {
        const r = dragon();
        const q = stander(4);
        // The roar: parked on its foot, nothing moves while it lasts.
        while (r.isRoaring) {
          q.box.x = home(r) - q.box.w / 2;
          expect(r.update(DT, q, CTX)).toBeNull();
          if (r.isRoaring) expect(r.dragonState().stomp).toBeNull();
        }
        // Haloed (owner call): it still stomps — the animal is not docile — but the halo
        // that stops the fire stops the foot, so nothing is ever booked.
        const d = dragon();
        const p = stander(4);
        let landed = false;
        for (let i = 0; i < Math.ceil(6 / DT); i += 1) {
          p.box.x = home(d) - p.box.w / 2;
          expect(d.update(DT, p, ASSISTED)).toBeNull();
          if (d.dragonState().stomp?.phase === 'slam') landed = true;
        }
        expect(landed).toBe(true);
        // Beaten: the screen is safe for good.
        const w = stander(14);
        beat(d, w);
        for (let i = 0; i < Math.ceil(5 / DT); i += 1) {
          p.box.x = home(d) - p.box.w / 2;
          expect(d.update(DT, p, CTX)).toBeNull();
        }
      });

      it('stands still on one foot: no drift and no turning while a foot is up', () => {
        const { d, p } = atItsFeet();
        p.box.x = home(d) - p.box.w / 2;
        expect(until(d, p, () => d.dragonState().stomp?.phase === 'lift')).toBe(true);
        const s0 = d.dragonState();
        // Run round behind it while the foot is up: it neither follows nor turns.
        p.box.x = s0.box.x + s0.box.w + 40;
        while (d.dragonState().stomp && d.dragonState().phase !== 'stripping') {
          d.update(DT, p, CTX);
          const s = d.dragonState();
          if (!s.stomp) break;
          expect(s.box.x).toBe(s0.box.x);
          expect(s.dir).toBe(s0.dir);
          expect(s.gait).toBeLessThanOrEqual(s0.gait);
        }
      });
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

    it('telegraphs on the animal: nothing lethal during the wind-up, and it points at him', () => {
      const d = dragon();
      const p = stander(2);
      expect(until(d, p, () => d.fireState()?.phase === 'windup')).toBe(true);
      const f = d.fireState()!;
      // The jet it is about to throw runs from the jaw towards the player.
      expect(f.target.x).toBeLessThan(f.mouth.x);
      // Nothing is lethal yet: there is no jet during a wind-up at all.
      expect(f.extent).toBe(0);
      expect(f.points).toHaveLength(0);
      expect(f.boxes).toHaveLength(0);
      expect(d.isBreathing).toBe(false);
    });

    it('throws the lane clear of its own body, and does not move it during the wind-up', () => {
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
      const p = stander(16);
      expect(until(d, p, () => (d.fireState()?.extent ?? 0) >= 1, 30, ASSISTED)).toBe(true);
      const pts = d.fireState()!.points;
      expect(pts.length).toBeGreaterThan(8);
      const thickest = Math.max(...pts.map((q) => q.half));
      expect(thickest).toBeGreaterThan(pts[0]!.half * 2);
      // Aimed at a standing player it comes down to the floor and reaches up past him,
      // so standing where it lands is standing in it.
      const landed = d.fireState()!.boxes.filter((b) => b.y + b.h >= GROUND_TOP - 1e-6);
      expect(landed.length).toBeGreaterThan(0);
      expect(Math.min(...landed.map((b) => b.y))).toBeLessThan(GROUND_TOP - PLAYER.HEIGHT);
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
      // The caption does not ride the growing flame (owner call): with the player out of
      // reach the aim never moves, so each burst contributes exactly one position and two
      // bursts can only ever have produced two. (When the aim sweeps, the words go with the
      // flame — see "the fire follows the player".)
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

    it('a different seed throws a different length of jet', () => {
      // The roll varies each burst's length inside a band below FLAME_LENGTH, so
      // successive bursts are not pixel-identical — and the roll comes from the seed.
      const marks = (seed: number): string => {
        const d = dragon({ seed });
        const p = stander(2);
        const xs: number[] = [];
        for (let i = 0; i < Math.ceil(30 / DT); i += 1) {
          d.update(DT, p, ASSISTED);
          const f = d.fireState();
          if (f && !xs.includes(Math.round(f.target.x))) xs.push(Math.round(f.target.x));
        }
        return xs.join(',');
      };
      expect(marks(1774)).not.toBe(marks(99));
    });
  });

  describe('the fire is a jet aimed at the player, and it follows them (owner call)', () => {
    const aimOf = (d: Dragon) => (d as unknown as { aim: number }).aim;
    /** Angle from the committed jaw to the player's centre, below horizontal. */
    const angleTo = (d: Dragon, p: Player) => {
      const f = d.fireState()!;
      const ahead = f.dir * (p.box.x + p.box.w / 2 - f.mouth.x);
      return Math.atan2(p.box.y + p.box.h / 2 - f.mouth.y, ahead);
    };
    /** Put the player's centre `ahead` px in front of the committed jaw, on the floor. */
    const place = (d: Dragon, p: Player, ahead: number, lift = 0) => {
      const f = d.fireState()!;
      p.box.x = f.mouth.x + f.dir * ahead - p.box.w / 2;
      p.box.y = GROUND_TOP - PLAYER.HEIGHT - lift;
    };

    it('points the jet at him: a straight line from the jaw, at his angle', () => {
      const d = dragon();
      const p = stander(14);
      // Stand still through a whole burst, haloed, so the aim has settled.
      expect(until(d, p, () => (d.fireState()?.extent ?? 0) >= 1, 30, ASSISTED)).toBe(true);
      run(d, p, 0.5, ASSISTED);
      const f = d.fireState()!;
      expect(Math.abs(aimOf(d) - angleTo(d, p))).toBeLessThan(0.02);
      // The airborne part of the jet is one straight line (no fixed throw-then-floor
      // shape): every point before it lands lies on the ray at that angle.
      const air = f.points.filter((q) => !q.onFloor);
      expect(air.length).toBeGreaterThan(5);
      for (const q of air) {
        const along = Math.atan2(q.y - f.mouth.y, f.dir * (q.x - f.mouth.x));
        expect(Math.abs(along - aimOf(d))).toBeLessThan(0.02);
      }
      // …and it goes through him.
      expect(fireOn(d, p)).toBe(true);
    });

    it('eases after him rather than snapping: capped turn, and it settles', () => {
      const d = dragon();
      const p = stander(10);
      expect(until(d, p, () => d.isBreathing, 30, ASSISTED)).toBe(true);
      place(d, p, 180);
      let last = aimOf(d);
      const turns: number[] = [];
      while (d.isBreathing) {
        d.update(DT, p, ASSISTED);
        const a = aimOf(d);
        turns.push(Math.abs(a - last));
        expect(Math.abs(a - last)).toBeLessThanOrEqual(D.AIM_TURN_RATE * DT + 1e-9);
        last = a;
      }
      // It moved towards him, and it was still moving at the end of a long swing…
      expect(turns.some((t) => t > 0)).toBe(true);
      // …but slows as it arrives: the last steps of a settled aim are smaller than the
      // hardest steps of the swing.
      const hardest = Math.max(...turns);
      const settled = new Dragon([SPEC]);
      const q = stander(10);
      expect(until(settled, q, () => settled.isBreathing, 30, ASSISTED)).toBe(true);
      run(settled, q, 0.9, ASSISTED);
      const before = aimOf(settled);
      settled.update(DT, q, ASSISTED);
      expect(Math.abs(aimOf(settled) - before)).toBeLessThan(hardest);
    });

    it('bends like a hose when it swings: the far end still points where he was', () => {
      const d = dragon();
      const p = stander(8);
      expect(until(d, p, () => (d.fireState()?.extent ?? 0) >= 1, 30, ASSISTED)).toBe(true);
      run(d, p, 0.3, ASSISTED);
      // Step in under the jet: the aim swings down, and the fire already in the air
      // keeps the direction it left with.
      place(d, p, 150);
      run(d, p, 0.12, ASSISTED);
      const f = d.fireState()!;
      const dirOf = (a: FlamePoint, b: FlamePoint) =>
        Math.atan2(b.y - a.y, f.dir * (b.x - a.x));
      const air = f.points.filter((q) => !q.onFloor);
      expect(air.length).toBeGreaterThan(4);
      const near = dirOf(air[0]!, air[1]!);
      const far = dirOf(air[air.length - 2]!, air[air.length - 1]!);
      // Near the jaw it already points steeper (towards him) than out at the end.
      expect(near).toBeGreaterThan(far + 0.03);
    });

    it('follows a jump up, but never points at the sky', () => {
      const d = dragon();
      const p = stander(14);
      expect(until(d, p, () => d.isBreathing, 30, ASSISTED)).toBe(true);
      const onFloor = aimOf(d);
      place(d, p, 260, 150);
      run(d, p, 0.8, ASSISTED);
      expect(aimOf(d)).toBeLessThan(onFloor - 0.1);
      // Way up (above the jaw): clamped at AIM_UP.
      const e = dragon();
      const q = stander(14);
      expect(until(e, q, () => e.isBreathing, 30, ASSISTED)).toBe(true);
      place(e, q, 200, 400);
      run(e, q, 1.1, ASSISTED);
      expect(aimOf(e)).toBeGreaterThanOrEqual(-D.AIM_UP - 1e-9);
    });

    it('lands on the floor and splashes along it, then burns out', () => {
      const d = dragon();
      const p = stander(19);
      expect(until(d, p, () => (d.fireState()?.extent ?? 0) >= 1, 30, ASSISTED)).toBe(true);
      run(d, p, 0.6, ASSISTED);
      const f = d.fireState()!;
      const floor = f.points.filter((q) => q.onFloor);
      expect(floor.length).toBeGreaterThan(1);
      // On the floor it lies on the floor: underside on the ground, never through it.
      for (const b of f.boxes) expect(b.y + b.h).toBeLessThanOrEqual(GROUND_TOP + 1e-9);
      for (const q of floor) expect(q.y + q.half).toBeCloseTo(GROUND_TOP, 6);
      // …and it runs on no further than FLAME_SPLASH past where it came down.
      const landX = floor[0]!.x;
      const endX = floor[floor.length - 1]!.x;
      expect(Math.abs(endX - landX)).toBeLessThanOrEqual(D.FLAME_SPLASH + 20);
    });

    it('holds its aim once the player is behind the jaw, rather than burning its own feet', () => {
      const d = dragon();
      const p = stander(12);
      expect(until(d, p, () => d.isBreathing, 30, ASSISTED)).toBe(true);
      run(d, p, 0.2, ASSISTED);
      const held = aimOf(d);
      place(d, p, -60);
      for (let i = 0; i < 20 && d.isBreathing; i += 1) {
        d.update(DT, p, ASSISTED);
        expect(aimOf(d)).toBe(held);
      }
      expect(d.fireState()!.dir).toBe(-1);
      // And even aimed at somebody right under the snout it lands in front of the body.
      const e = dragon();
      const q = stander(12);
      expect(until(e, q, () => e.isBreathing, 30, ASSISTED)).toBe(true);
      place(e, q, 8);
      run(e, q, 1.0, ASSISTED);
      expect(aimOf(e)).toBeLessThanOrEqual(D.AIM_DOWN + 1e-9);
      const body = e.dragonState().box;
      for (const b of e.fireState()?.boxes ?? []) {
        if (b.y + b.h >= GROUND_TOP - 1) expect(b.x + b.w).toBeLessThan(body.x + 30);
      }
    });

    it('does not aim during the wind-up, even with extra reaction time', () => {
      const d = dragon();
      const p = stander(2);
      const ctx: HazardContext = { assisted: false, extraTelegraph: 0.6 };
      expect(until(d, p, () => d.fireState()?.phase === 'windup', 30, ctx)).toBe(true);
      const a0 = aimOf(d);
      place(d, p, 120);
      while (d.fireState()?.phase === 'windup') {
        d.update(DT, p, ctx);
        if (d.fireState()?.phase === 'windup') expect(aimOf(d)).toBe(a0);
      }
    });

    it('never reaches past CONE_REACH, however he moves', () => {
      const d = dragon();
      const p = stander(2);
      let checked = 0;
      for (let i = 0; i < Math.ceil(40 / DT); i += 1) {
        p.box.x = 40 + ((i * 7) % 900);
        p.box.y = GROUND_TOP - PLAYER.HEIGHT - ((i * 3) % 160);
        d.update(DT, p, ASSISTED);
        const f = d.fireState();
        for (const q of f?.points ?? []) {
          expect(Math.abs(q.x - f!.mouth.x)).toBeLessThanOrEqual(D.CONE_REACH + 1e-6);
          checked += 1;
        }
      }
      expect(checked).toBeGreaterThan(200);
    });

    it('cannot reach somebody standing on the badge brick, even from the nearest roost', () => {
      // The brick at gx 10 is the one raised place in reach, and the jet aimed at
      // somebody on it flies nearly level — so FLAME_LENGTH is what keeps it clear.
      const d = dragon();
      const p = stander(10);
      let cause: string | null = null;
      for (const x of [10 * T - PLAYER.WIDTH / 2 + 2, 11 * T - PLAYER.WIDTH / 2 - 2]) {
        for (let i = 0; i < Math.ceil(20 / DT); i += 1) {
          p.box.x = x;
          p.box.y = 12 * T - PLAYER.HEIGHT;
          cause = d.update(DT, p, CTX) ?? cause;
        }
      }
      expect(cause).toBeNull();
    });

    it('carries its taunt with it: the words stay on the jet while it swings', () => {
      const d = dragon();
      const p = stander(14);
      expect(until(d, p, () => (d.fireState()?.extent ?? 0) >= 1, 30, ASSISTED)).toBe(true);
      place(d, p, 140);
      const spots = new Set<number>();
      while (d.isBreathing) {
        d.update(DT, p, ASSISTED);
        const f = d.fireState();
        if (!f || f.extent < 1) continue;
        expect(f.boxes.some((b) => overlaps(b, { x: f.labelAt.x, y: f.labelAt.y, w: 1, h: 1 }))).toBe(
          true,
        );
        // Never upside down.
        expect(Math.abs(f.labelAngle)).toBeLessThanOrEqual(Math.PI / 2);
        spots.add(Math.round(f.labelAt.y));
      }
      expect(spots.size).toBeGreaterThan(1);
    });

    it('is still deterministic with a moving player', () => {
      const trace = (): string => {
        const d = dragon();
        const p = stander(2);
        const out: string[] = [];
        for (let i = 0; i < Math.ceil(20 / DT); i += 1) {
          p.box.x = 300 + ((i * 5) % 600);
          d.update(DT, p, ASSISTED);
          const f = d.fireState();
          if (f && i % 10 === 0) out.push(`${f.target.x.toFixed(3)},${f.target.y.toFixed(3)}`);
        }
        return out.join('|');
      };
      expect(trace()).toBe(trace());
    });
  });

  describe('the jet geometry (one source for what burns and what is painted)', () => {
    const mouth = { x: 900, y: 440 };
    it('is empty until the flame has started to grow', () => {
      expect(flameStream(mouth, -1, () => 0.3, 0, 500)).toHaveLength(0);
      expect(streamBoxes([])).toHaveLength(0);
    });

    it('grows out of the jaw, and never past the length it was given', () => {
      const half = flameStream(mouth, -1, () => 0.1, D.FLAME_LENGTH / 2, 500);
      const all = flameStream(mouth, -1, () => 0.1, D.FLAME_LENGTH, 500);
      expect(all.length).toBeGreaterThan(half.length);
      const tip = Math.min(...half.map((q) => q.x));
      expect(mouth.x - tip).toBeLessThanOrEqual(D.FLAME_LENGTH / 2 + 1);
    });

    it('has no gaps along it at any angle: neighbouring squares overlap', () => {
      for (const a of [-0.2, 0, 0.3, 0.7, 1.05]) {
        const boxes = streamBoxes(flameStream(mouth, -1, () => a, D.FLAME_LENGTH, 500));
        for (let i = 1; i < boxes.length; i += 1) expect(overlaps(boxes[i - 1]!, boxes[i]!)).toBe(true);
      }
    });

    it('is clipped by the floor rather than drawn through it, and diverges', () => {
      const pts = flameStream(mouth, -1, () => 0.35, D.FLAME_LENGTH, 500);
      for (const b of streamBoxes(pts)) expect(b.y + b.h).toBeLessThanOrEqual(GROUND_TOP);
      expect(pts[pts.length - 1]!.half).toBeGreaterThan(pts[0]!.half * 2);
    });

    it('never reaches past the reach it was given', () => {
      const pts = flameStream(mouth, -1, () => 0, D.FLAME_LENGTH, 200);
      for (const q of pts) expect(mouth.x - q.x).toBeLessThanOrEqual(200);
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

  it('strides while it shifts its weight, and settles onto both feet to breathe fire', () => {
    // Owner call: "the feet of the Godzilla don't move". The renderer steps the legs off
    // `gait`; this is the guard that the dial follows the body — up while it walks between
    // bursts, back to planted inside `GAIT_EASE` once it stops, and never on during a burst.
    const d = dragon();
    const p = stander(4);
    expect(d.dragonState().gait).toBe(0);
    expect(until(d, p, () => d.dragonState().phase === 'burning')).toBe(true);
    expect(d.dragonState().gait).toBe(0);
    expect(until(d, p, () => d.dragonState().phase === 'waiting')).toBe(true);
    expect(until(d, p, () => d.dragonState().gait === 1, D.BURST_GAP)).toBe(true);
    expect(until(d, p, () => d.dragonState().phase === 'charging')).toBe(true);
    run(d, p, D.GAIT_EASE + DT);
    expect(d.dragonState().phase).toBe('charging');
    expect(d.dragonState().gait).toBe(0);
  });
});
