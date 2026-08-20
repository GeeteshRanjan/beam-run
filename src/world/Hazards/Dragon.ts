/**
 * The hiring dragon (Screen 4 — Hire Under Fire; owner-specified, three times).
 *
 * The screen began as five fire lanes on a shared cycle: a metronome you waited
 * out, five times. It became one antagonist — a big dragon in office dress,
 * because the thing standing between a GCC and its team is not a monster, it is a
 * hiring process wearing office clothes. This file is the *third* build of that
 * antagonist, and the difference is what it is and what comes out of it.
 *
 * Five rules run it, and every one of them is an owner call.
 *
 * **1. The level opens on a guaranteed safe beat.** The dragon roars for
 * `ROAR_TIME` and does not move, aim or breathe while it does. It is the only
 * scripted opening in the game, and it exists so the screen can be *read* before it
 * is played: a boss you meet mid-swing is a boss you learn by dying to.
 *
 * **2. It stands on the ground, on two feet.** It does not fly and it does not
 * hover: the drawn body's bottom edge sits on the ground band, which is why level
 * data no longer carries a hover row for it. Its `from`/`to` are the patch of floor
 * it holds — it shifts its weight inside `ROOST_DRIFT` of the middle of them and
 * never leaves. The player owns the approach; the dragon owns the end of it.
 *
 * **3. What it throws is one straight, growing, slightly diverging cone of fire.**
 * There are no fireballs and no rolling flame fronts any more — nothing on this
 * screen travels. It telegraphs a lane along the floor for `BURST_WINDUP`, then
 * throws fire from its jaw down that lane: the flame **grows** from the jaw out to
 * `CONE_REACH` over `CONE_GROW`, diverging from `CONE_NEAR_H` to `CONE_FAR_H` as it
 * goes, and then stands there for the rest of `BURST_TIME`. One of the screen's
 * taunts is fixed to that burst on a plaque which does **not** travel with the fire
 * — it sits over the lane, and the next burst brings the next taunt. So the screen
 * is a fixed piece of dangerous floor with a rhythm, read once and then crossed.
 *
 * **4. Its fire is the hazard; the dragon is not.** Its body contributes no hitbox
 * at all — you cannot be killed by the thing that has no telegraph. Everything
 * lethal here is fire, the fire has 0.65s of scorched floor in front of it, and it
 * grows outwards from the beast, so the end of the lane furthest from the player's
 * approach ignites last. Nothing homes; the player is never an input to what the
 * dragon decides.
 *
 * **5. Water beats fire before it beats the wearer.** `EXTINGUISH` does two things
 * at once: a teal halo makes every flame on the screen harmless, and the same badge
 * puts a water cannon in the player's hands. A jet crossing the burning cone cuts
 * `QUENCH_TIME` off the remaining burst (three jets end one early, so it is a
 * contest rather than a switch). Only *between* bursts does a jet reach the dragon,
 * and then it damages the one thing it is wearing — its glasses, which crack and
 * finally wash off (owner call: no jacket and no tie). Four hits and the costume is
 * gone: the beast goes with it and five candidates walk out of what is left,
 * stamped HIRED. The screen is won on a hire, not a kill.
 *
 * Headless and deterministic: no `Math.random`, no wall clock, no DOM.
 */
import { RESOLUTION, HAZARDS } from '../../data/tuning.config';
import type { DragonSpec } from '../../data/levels';
import { type AABB, aabbOverlap } from '../Physics';
import type { Player } from '../Player';
import type { Hazard, SetbackCause, HazardContext } from '../types';

const T = RESOLUTION.TILE;
const D = HAZARDS.DRAGON;
const GROUND_TOP = 15 * T;

/**
 * `roar` is the opening beat and cannot recur — a second free pass mid-fight would
 * read as the dragon losing interest. `waiting` is the only phase it can be hit in
 * and the only phase the lane is clear in, which is what ties the fight and the
 * crossing to the same rhythm. `stripping` and `beaten` are the payoff, and neither
 * is lethal: from the moment the last jet lands the screen is safe for good.
 */
export type DragonPhase = 'roar' | 'waiting' | 'charging' | 'burning' | 'stripping' | 'beaten';

export type FirePhase = 'windup' | 'burning';

export interface Point {
  x: number;
  y: number;
}

/**
 * The cone of fire — the screen's only hazard, and the only thing on it that can
 * cost a life.
 *
 * `mouth` is the apex (the jaw), `target` the far end of its axis just above the
 * floor, and `extent` how much of that axis the flame currently covers. `boxes` is
 * the lethal geometry *and* exactly what the renderer paints, so the two can never
 * disagree — the `badgeFloat` rule applied to a hazard.
 */
export interface FireState {
  phase: FirePhase;
  /** 0..1 through the current phase (wind-up, then burn). */
  progress: number;
  mouth: Point;
  target: Point;
  /** 0..1 of the reach the flame has grown along. 0 for the whole wind-up. */
  extent: number;
  /** −1 throwing left, 1 right. */
  dir: -1 | 1;
  /** 0..1 how far the water has beaten the burst back (1 = out). */
  quenched: number;
  /** The taunt fixed to this burst. The next burst carries the next one. */
  label: string;
  /**
   * Where that taunt is painted: **on the flame**, at a fixed point along its axis
   * (owner call). Committed with the burst and stationary — the label is written on the
   * lane the fire is filling, not carried on the front of it.
   */
  labelAt: Point;
  /**
   * Radians the taunt is set at, so it lies **along** the flame instead of across it
   * (owner call: "the text should be an overlay on top of the flame itself, in the same
   * angle the flame is in").
   *
   * Derived from the axis's own descent rather than authored, and normalised to reading
   * direction: for a flame thrown left the line rises left-to-right, so the angle is
   * negative. It is committed with the burst like everything else here, which is what
   * keeps the caption still while the fire grows underneath it.
   */
  labelAngle: number;
  /** The lethal boxes: the cone, cut into `CONE_SEGMENTS` steps. */
  boxes: AABB[];
}

export interface WaterState {
  box: AABB;
  dx: number;
  dy: number;
}

/** A puff of steam where water met fire — the proof the exchange happened. */
export interface SteamState {
  x: number;
  y: number;
  /** 0..1 through its life. */
  progress: number;
}

/**
 * One of the five people inside the costume, **walking out of it** (owner call).
 *
 * They used to drop out of the beast's chest. They come out of the suit's unzipped side
 * now, one after another, which is why this carries a facing and a `walking` flag: a
 * person crossing the floor is a different picture from a person landing, and the render
 * needs to know which one it is drawing.
 */
export interface CandidateState {
  x: number;
  /** Feet. Always the ground band: they walk, they no longer fall. */
  y: number;
  /** 0..1 through the walk out; 1 = arrived and cheering. */
  progress: number;
  /** True once they have reached their place in the line-up. */
  landed: boolean;
  /** −1 walking left, 1 walking right. */
  dir: -1 | 1;
}

/**
 * The empty costume on the floor, once the beast is beaten.
 *
 * `openness` runs the zip back along one side, `fade` takes the whole thing away after the
 * last hire is out (owner call: "the costume after some time vanishes"). Two dials rather
 * than one enum because both are continuous and the renderer paints them, and null instead
 * of `fade: 1` so "there is nothing there any more" is not a state anybody has to check a
 * number for.
 */
export interface CostumeState {
  /** 0..1 as the zip runs back down its side. */
  openness: number;
  /** 0..1 as it disappears. */
  fade: number;
}

/**
 * A hit playing out on the costume.
 *
 * The hit is already booked as far as the *rules* are concerned the frame the jet
 * lands (`layers` drops, the dragon retaliates); this is purely how long the
 * painting has to show it happening. Keeping the two separate is what lets the
 * glass fog, crack and run for 0.55s without the fight's rhythm changing by a
 * frame.
 */
export interface DissolveState {
  /**
   * Which hit this is, counting down: `HITS_TO_STRIP`…1. At 1 the glasses leave the
   * snout for good; above it they take another crack.
   */
  layer: number;
  /** 0..1 through the dissolve. */
  progress: number;
  /** Where the jet landed, so the run-off starts in the right place. */
  hitY: number;
}

export interface DragonState {
  /** Uppercase name plate, drawn while it is still the obstacle. */
  name: string;
  /** The drawn body, standing on the ground. NOT a hitbox — see the file header. */
  box: AABB;
  /** −1 facing left, 1 facing right. */
  dir: -1 | 1;
  phase: DragonPhase;
  /** 0..1 through the current timed phase (roar / windup / burn / strip). */
  progress: number;
  /** Hits left on the costume (`HITS_TO_STRIP` → 0). */
  layers: number;
  /** A hit currently playing out, or null. */
  dissolve: DissolveState | null;
  /**
   * The empty suit on the floor once it is beaten, or null — before the fall, and again
   * once it has vanished.
   */
  costume: CostumeState | null;
  /**
   * 0..1 — how far the jaw is open (owner call: "while throwing the flame the Godzilla
   * doesn't open its mouth — make it open it").
   *
   * A dial rather than a flag, because it has to *open*: it ramps through the wind-up so
   * the jaw parting is itself part of the telegraph, holds wide for the whole burn, and
   * shuts afterwards. That matters more than it sounds, because the floor marks that used
   * to carry the wind-up are gone (owner call, same pass) — the animal's own head is now
   * the telegraph, so the head has to be doing something.
   */
  jawOpen: number;
}

interface Water {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface Steam {
  x: number;
  y: number;
  t: number;
}

const STEAM_LIFE = 0.4;

/**
 * Where the jaw is, as fractions of the drawn body box.
 *
 * The one place the simulation and the renderer have to agree about the dragon's
 * anatomy, so they get one source — the same rule the badge's float follows. The sim
 * throws fire from here; `render/dragon.ts` draws the roar arcs and the flame from
 * here. Derived twice, they drift, and an earlier pass proved it: a hard-coded 0.38
 * put the flame 30px in front of a snout drawn at 0.23, so the fire left thin air.
 *
 * Both are read off the **drawn grid** rather than chosen: on the 46×38 beast the mouth
 * line is row 5 and the muzzle tip is column 41, which against a 200×190 box centred on a
 * 230px grid is 0.15 of the height down and 0.46 of the width forward of centre. The jaw
 * is therefore high — 161px off the floor, because the skull is the top of an upright
 * Godzilla's silhouette — and the fire leaves it on a long shallow line down to the ground
 * rather than out of a snout held at knee height. Every `CONE_*` number in
 * `tuning.config.ts` is solved against that height, so re-drawing the head moves the size
 * of the lethal lane and has to be re-measured there.
 */
export const MOUTH_X_FRACTION = 0.46;
export const MOUTH_Y_FRACTION = 0.15;

/**
 * px above the floor the cone's axis ends.
 *
 * Not zero: the axis is the *centre* of the flame, so ending it on the ground would
 * throw half the fire under the level. Ending it just above means the lower edge of
 * the cone is clipped by the floor along the whole far half of the lane, which is
 * what makes the fire look like it is running along the ground.
 */
const AXIS_END_LIFT = 20;

/**
 * Half the flame's thickness at fraction `f` along the reach.
 *
 * **Exported, because the renderer needs the same number.** It used to inline the same
 * lerp; two copies of a hazard's own profile is the `badgeFloat` defect waiting to
 * happen, and it very nearly did on the pass that changed `CONE_NEAR_H`.
 */
export function coneHalfAt(f: number): number {
  return (D.CONE_NEAR_H + (D.CONE_FAR_H - D.CONE_NEAR_H) * f) / 2;
}

/**
 * The flame's axis height at fraction `f` — **a throw and then a floor run**, not one
 * straight line (owner call: "make the flame look more realistic").
 *
 * A single lerp from the jaw to a point just above the far end is a *ramp*: the flame is
 * lowest and thickest at the same instant, which rasterises as a girder leaned against the
 * floor. Fire thrown down at the ground hits it and then runs along it, so there are two
 * segments — descending until `CONE_TOUCHDOWN`, then level.
 *
 * The level part is `GROUND_TOP − coneHalfAt(f)`, i.e. the flame's *underside* sits on the
 * floor for the whole run rather than its centre line sitting a fixed 20px above it. That
 * is what makes the far half of the lane read as burning ground, and it means the shape
 * gets taller as it widens **upwards**, which is where a fire on a floor goes.
 *
 * Continuous by construction: the descent's end point is `GROUND_TOP − coneHalfAt(TD)`, so
 * the two segments meet.
 *
 * `_target` is unused and kept in the signature deliberately: every other function that
 * describes this cone takes `(mouth, target, f)`, and a sibling with a different shape is
 * the sort of asymmetry that makes a caller pass the arguments in the wrong order. The
 * floor run is *derived*, so the axis's far end is no longer authored anywhere.
 */
export function coneAxisY(mouth: Point, _target: Point, f: number): number {
  const td = D.CONE_TOUCHDOWN;
  const floorAxis = (g: number) => GROUND_TOP - coneHalfAt(g);
  if (f >= td) return floorAxis(f);
  const landed = floorAxis(td);
  return mouth.y + (landed - mouth.y) * (f / td);
}

/**
 * Fraction along the reach the taunt is written at.
 *
 * On the descending leg (`CONE_TOUCHDOWN` is 0.55), because that is the part of the flame
 * that has an angle for the words to follow — and far enough along it that the shape is
 * deep enough to hold a line of scale-2 type.
 */
export const CONE_LABEL_F = 0.45;

/**
 * The angle the taunt is set at: the axis's descent, normalised to reading direction.
 *
 * Text runs left to right whichever way the beast is facing, so a flame thrown *left*
 * gives a line that rises left to right and the angle is negative. Getting this backwards
 * writes the taunt upside down, which is a defect nothing in the code can show.
 */
function labelAngleFor(mouth: Point, target: Point, dir: -1 | 1): number {
  const landed = coneAxisY(mouth, target, D.CONE_TOUCHDOWN);
  const run = Math.abs(target.x - mouth.x) * D.CONE_TOUCHDOWN;
  return Math.atan2(dir * (landed - mouth.y), Math.max(1, run));
}

/**
 * The cone's lethal geometry: `CONE_SEGMENTS` stepped boxes along the axis.
 *
 * Exported because the renderer paints exactly these boxes. A cone is not an AABB
 * and both dishonest ways round that cost the player: one box over the whole thing
 * is lethal where there is no flame, and a box round the axis alone is flame that
 * cannot hurt anybody. Stepping it keeps the hitbox inside 8px of the drawn
 * silhouette everywhere, and keeps "what burns" and "what is drawn" one function.
 *
 * `extent` is 0..1 of the reach the flame has grown along; segments past it do not
 * exist yet, and the one straddling it is cut short.
 */
export function coneBoxes(mouth: Point, target: Point, extent: number): AABB[] {
  const boxes: AABB[] = [];
  const e = Math.max(0, Math.min(1, extent));
  if (e <= 0) return boxes;
  const half = coneHalfAt;
  const ax = (f: number) => mouth.x + (target.x - mouth.x) * f;
  const ay = (f: number) => coneAxisY(mouth, target, f);
  for (let i = 0; i < D.CONE_SEGMENTS; i += 1) {
    const f0 = i / D.CONE_SEGMENTS;
    if (f0 >= e) break;
    const f1 = Math.min(e, (i + 1) / D.CONE_SEGMENTS);
    const x0 = Math.min(ax(f0), ax(f1));
    const x1 = Math.max(ax(f0), ax(f1));
    const top = Math.min(ay(f0) - half(f0), ay(f1) - half(f1));
    const bottom = Math.min(GROUND_TOP, Math.max(ay(f0) + half(f0), ay(f1) + half(f1)));
    if (bottom <= top || x1 <= x0) continue;
    boxes.push({ x: x0, y: top, w: x1 - x0, h: bottom - top });
  }
  return boxes;
}

export class Dragon implements Hazard {
  private readonly name: string;
  /** Hard limits for the body's CENTRE (px), from the authored roost columns. */
  private readonly minX: number;
  private readonly maxX: number;
  /** The drift band inside those limits — where it actually shifts its weight. */
  private readonly driftMin: number;
  private readonly driftMax: number;
  private readonly taunts: readonly string[];
  private readonly rand: () => number;

  private cx: number;
  /** It stands, so this never changes: the body's bottom edge is the ground. */
  private readonly cy: number = GROUND_TOP - D.BODY_H / 2;
  private dir: -1 | 1 = -1;
  private driftDir: -1 | 1 = -1;
  private phase: DragonPhase = 'roar';
  /** Seconds inside the current timed phase. */
  private t = 0;
  // Annotated `number` on purpose. `tuning.config.ts` is `as const`, so
  // `D.HITS_TO_STRIP` has the literal type `4`; TypeScript only widens *fresh*
  // literals, so a field initialised from one of these keeps the literal type and
  // every later assignment to it fails to compile.
  private layers: number = D.HITS_TO_STRIP;
  private tauntIndex = 0;
  /** Bursts begun this attempt. Only the first is scripted (straight after the roar). */
  private burstsMade = 0;

  /** The committed burst, or null. */
  private burst: {
    mouth: Point;
    target: Point;
    dir: -1 | 1;
    label: string;
    labelAt: Point;
    labelAngle: number;
    phase: FirePhase;
    t: number;
    /** Seconds of burn removed by water. */
    quench: number;
  } | null = null;

  /** A hit playing out (presentation only — the rules already moved on). */
  private dissolving: { layer: number; t: number; hitY: number } | null = null;

  private readonly jets: Water[] = [];
  private readonly steam: Steam[] = [];
  /**
   * The five, walking out of the suit one at a time.
   *
   * `fromX` is the opening; `toX` is their place in the line-up; `t` starts negative so
   * each one waits their turn (`CANDIDATE_STAGGER`) — which is the owner's "come out one by
   * one" expressed as arithmetic rather than as a queue with state in it.
   */
  private readonly candidates: {
    fromX: number;
    toX: number;
    t: number;
  }[] = [];

  private armed = false;
  /** The valve is open this step — the hose's own state, so its edges can be found. */
  private spraying = false;
  private cooldown = 0;
  /** Seconds since the cannon last fired — the host draws the muzzle from it. */
  private sinceShotT = Number.POSITIVE_INFINITY;
  /** Monotonic counters the host reads to fire audio cues exactly once each. */
  private jetsFired = 0;
  private quenchCount = 0;
  private hitCount = 0;

  constructor(specs: DragonSpec[]) {
    const spec = specs[0];
    this.name = spec?.name ?? 'HIRING';
    const from = spec?.from ?? 23;
    const to = spec?.to ?? 29;
    this.minX = from * T + D.BODY_W / 2;
    this.maxX = Math.max(this.minX, (to + 1) * T - D.BODY_W / 2);
    const centre = (this.minX + this.maxX) / 2;
    this.driftMin = Math.max(this.minX, centre - D.ROOST_DRIFT);
    this.driftMax = Math.min(this.maxX, centre + D.ROOST_DRIFT);
    this.taunts = spec?.taunts?.length ? spec.taunts : ['CANDIDATE DECLINED'];
    this.rand = mulberry32(spec?.seed ?? 1);
    // Centred on its patch of ground from frame one: it is standing at the end of
    // the screen, not walking on from the wings.
    this.cx = centre;
  }

  /** It is an animal, not architecture: nothing here is standable or a wall. */
  solids(): AABB[] {
    return [];
  }

  speedMultAt(): number {
    return 1;
  }

  /**
   * Assisted, the halo makes every flame on the screen harmless.
   *
   * This is the one place a bubble is honest on this screen *and* the reason the
   * badge can carry a weapon at the same time: immunity is what buys the player the
   * time to stand still and aim. Unlike the Workplace cutter, the verb here does
   * not replace the protection, it comes with it (owner call).
   */
  get shieldsPlayer(): boolean {
    return true;
  }

  // --- geometry -------------------------------------------------------------

  private body(): AABB {
    return {
      x: this.cx - D.BODY_W / 2,
      y: this.cy - D.BODY_H / 2,
      w: D.BODY_W,
      h: D.BODY_H,
    };
  }

  /** Where fire leaves it: the jaw, carried low and forward over its feet. */
  private mouth(): Point {
    return {
      x: this.cx + this.dir * (D.BODY_W * MOUTH_X_FRACTION),
      y: this.cy - D.BODY_H / 2 + D.BODY_H * MOUTH_Y_FRACTION,
    };
  }

  private jetBox(j: Water): AABB {
    return { x: j.x - D.WATER_W / 2, y: j.y - D.WATER_H / 2, w: D.WATER_W, h: D.WATER_H };
  }

  /** 0..1 of the reach the flame currently covers (0 for the whole wind-up). */
  private extent(): number {
    const b = this.burst;
    if (!b || b.phase !== 'burning') return 0;
    return Math.min(1, b.t / D.CONE_GROW);
  }

  private fireBoxes(): AABB[] {
    const b = this.burst;
    if (!b || b.phase !== 'burning') return [];
    return coneBoxes(b.mouth, b.target, this.extent());
  }

  // --- per-step -------------------------------------------------------------

  update(dt: number, player: Player, ctx: HazardContext): SetbackCause | null {
    this.armed = ctx.assisted;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sinceShotT += dt;

    /*
     * **The cannon is a hose** (owner call): held, not tapped. `shootHeld` opens the valve
     * and `shoot` is kept as a fallback so a single tap still produces a segment — a
     * player who taps the button on a phone must not be handed nothing.
     *
     * The rate limit is the same `cooldown` the trigger used; what changed is that it is
     * now the stream's *spacing* rather than a weapon's recovery (`WATER_COOLDOWN` 0.24 →
     * 0.045). Everything that made this a fight is untouched, because none of it was ever
     * in the fire rate: the beast can only be hit between bursts and every hit provokes
     * one, so a held button still lands exactly one hit per gap.
     */
    // "Spraying" has to mean water actually leaving the cannon, not the button being
    // down: it refuses once the fight is over, and a counter that ticked anyway would
    // report a jet fired at five people who have just been hired.
    const canSpray = this.phase !== 'stripping' && this.phase !== 'beaten';
    const spraying =
      ctx.assisted && canSpray && (ctx.shootHeld === true || ctx.shoot === true);
    if (spraying) this.fire(player);
    // Rising edge only, for the audio cue and for the muzzle: 22 "a jet left the cannon"
    // events a second is a click, not a sound.
    if (spraying && !this.spraying) this.jetsFired += 1;
    this.spraying = spraying;

    this.advancePhase(dt, player, ctx.extraTelegraph);
    this.advanceJets(dt);
    this.advanceSteam(dt);
    this.advanceDissolve(dt);
    this.advanceCandidates(dt);

    // The halo makes fire harmless, so contact is only *checked* unassisted. It is
    // checked after everything has moved, so the flame and the player can never swap
    // places inside one step without the overlap being seen.
    if (ctx.assisted) return null;
    return this.touchingFire(player) ? 'fire' : null;
  }

  /** Any live flame on the player? */
  private touchingFire(player: Player): boolean {
    return this.fireBoxes().some((box) => aabbOverlap(player.box, box));
  }

  /**
   * The dragon's own state machine.
   *
   * `extraTelegraph` (the assist menu's "extra reaction time") is added to the
   * wind-up and to nothing else: more warning, same fight.
   */
  private advancePhase(dt: number, player: Player, extraTelegraph: number): void {
    switch (this.phase) {
      case 'roar': {
        // A full stop: it does not even shift its weight. The roar is the one beat on
        // this screen where nothing is happening except the introduction.
        this.t += dt;
        if (this.t >= D.ROAR_TIME) {
          this.phase = 'waiting';
          /*
           * **The roar IS the gap before the first burst**, so the first wind-up starts
           * on the very next frame rather than a further `BURST_GAP` later.
           *
           * This is a fairness measurement, not a flourish. `ROAR_TIME` (1.8s) plus
           * `BURST_WINDUP` (0.65s) is already 2.45s of guaranteed safety, in which the
           * player covers 637px — further than the whole lethal part of the lane. Add a
           * gap on top and a blind sprint from the spawn walks the entire screen before
           * anything is alight: a probe cleared it 1/1 with no delays, which is the
           * "boss is decoration" failure two earlier tunings of this screen shipped.
           * Starting the burst here puts the first flame down while a sprinter is still
           * inside the lane, and costs a reading player nothing — the roar is 1.8s of
           * warning that something is coming.
           */
          this.t = D.BURST_GAP;
        }
        break;
      }
      case 'waiting': {
        /*
         * Between bursts: it shifts its weight along its patch of ground and watches.
         *
         * The drift is integrated rather than sampled from a sine of a clock, so that
         * freezing it for a burst and resuming afterwards is continuous — a dragon
         * that teleported back onto its sine curve every time it stopped breathing
         * would read as a rendering fault.
         */
        this.cx += this.driftDir * D.ROOST_SPEED * dt;
        if (this.cx <= this.driftMin) {
          this.cx = this.driftMin;
          this.driftDir = 1;
        } else if (this.cx >= this.driftMax) {
          this.cx = this.driftMax;
          this.driftDir = -1;
        }
        // It faces the player, so the head is always pointing down the lane the fire
        // is about to run along — the first half of the telegraph, before any mark is
        // on the floor.
        const px = player.box.x + player.box.w / 2;
        this.dir = px >= this.cx ? 1 : -1;
        this.t += dt;
        if (this.t >= D.BURST_GAP) this.beginBurst();
        break;
      }
      case 'charging': {
        // Committed: the body stops for the whole wind-up and the whole burn, so
        // "the dragon has stopped moving" is itself the largest telegraph on the
        // screen. The lane was frozen when the burst began and does not follow the
        // player.
        this.t += dt;
        const b = this.burst;
        if (!b) {
          this.endBurst();
          break;
        }
        b.t += dt;
        if (b.t >= D.BURST_WINDUP + extraTelegraph) {
          b.phase = 'burning';
          b.t = 0;
          this.phase = 'burning';
          this.t = 0;
        }
        break;
      }
      case 'burning': {
        this.t += dt;
        const b = this.burst;
        if (!b) {
          this.endBurst();
          break;
        }
        b.t += dt;
        if (b.t + b.quench >= D.BURST_TIME) {
          this.burst = null;
          this.endBurst();
        }
        break;
      }
      case 'stripping': {
        this.t += dt;
        if (this.t >= D.STRIP_TIME) {
          this.phase = 'beaten';
          this.t = 0;
          this.spawnCandidates();
        }
        break;
      }
      case 'beaten':
      default:
        // Beaten for good: it cannot attack and the screen is safe.
        this.t += dt;
        break;
    }
  }

  /**
   * Commit a burst: freeze the body, fix the lane, fix the taunt.
   *
   * The lane is **not aimed at the player**. It runs `CONE_REACH` in front of the
   * jaw, which means it is a function of where the dragon is standing and which way
   * it is looking — both of which the player can see for the whole `BURST_GAP`
   * before it happens. An aimed attack was an earlier build's answer and it needed a
   * lead, a freeze and two probes to be fair; a *lane* is fair by construction.
   *
   * The seeded generator is consulted for the one thing left to vary: how far the
   * cone reaches, inside a narrow band. That keeps successive bursts from being
   * pixel-identical without ever putting fire somewhere the telegraph did not say,
   * because the telegraph is drawn from this decision rather than beside it.
   */
  private beginBurst(): void {
    const roll = this.burstsMade === 0 ? 0.5 : this.rand();
    this.burstsMade += 1;
    /*
     * The reach varies inside a narrow band **below** the nominal figure, never above
     * it: enough that the far end is not a landmark, small enough that the lane the
     * player learnt on their first attempt is the lane.
     *
     * One-sided on purpose. `CONE_REACH` is measured against what has to stay *out* of
     * the fire — the spawn, and the drop column behind the player — so a roll that
     * could overshoot it would put flame on a brick the player is standing under about
     * one burst in two, which is a rule the telegraph never promised.
     */
    const reach = D.CONE_REACH * (0.88 + 0.12 * roll);
    const mouth = this.mouth();
    const dir = this.dir;
    const target = {
      x: Math.max(-T, Math.min(RESOLUTION.WIDTH + T, mouth.x + dir * reach)),
      y: GROUND_TOP - AXIS_END_LIFT,
    };
    this.burst = {
      mouth,
      target,
      dir,
      label: this.taunts[this.tauntIndex % this.taunts.length]!,
      /*
       * **On the flame, at `CONE_LABEL_F` along its axis, set to the axis's own angle** (owner
       * call: "the text that depicts what this flame represents should be an overlay on
       * top of the flame itself, in the same angle the flame is in, and it should be
       * present on the flame; it should not come forward with the flame — while the flame
       * is there it is there too").
       *
       * It used to be a plaque held 44px *above* the whole shape, clear of the fire, on the
       * reasoning that a caption has to be legible. That clearance was derived carefully
       * and it is now the wrong picture: a plaque floating over the lane is a label about
       * the fire, where the owner wants the fire to be carrying the words.
       *
       * `CONE_LABEL_F` sits on the **descending** part of the axis on purpose: that is the only
       * part with an angle to match, and it is deep enough there (2 × `coneHalfAt` ≈ 58px)
       * to hold a scale-2 line inside the flame. Committed here with everything else, so it
       * is stationary while the fire grows through it — which is the whole of "it should not
       * come forward with the flame".
       */
      labelAt: {
        x: mouth.x + (target.x - mouth.x) * CONE_LABEL_F,
        y: coneAxisY(mouth, target, CONE_LABEL_F),
      },
      labelAngle: labelAngleFor(mouth, target, dir),
      phase: 'windup',
      t: 0,
      quench: 0,
    };
    this.tauntIndex += 1;
    this.phase = 'charging';
    this.t = 0;
  }

  private endBurst(): void {
    this.phase = 'waiting';
    this.t = 0;
    this.burst = null;
  }

  // --- the water cannon -----------------------------------------------------

  /**
   * Fire the cannon: a jet aimed at the dragon, not straight ahead.
   *
   * Aimed *once*, at launch, at the body's centre as it stands at that instant: a
   * jet that tracked would make the fight a button rather than a shot. It still has
   * to be aimed rather than level, because the target is the head and chest of a
   * 190px animal and a shot along the floor would wash its feet forever.
   *
   * Bounded by a cooldown and a live-jet cap, like the Workplace cutter. It refuses
   * once the costume is off, because by then the only things on screen are five
   * people who have just been hired.
   */
  private fire(player: Player): void {
    if (this.cooldown > 0 || this.jets.length >= D.MAX_WATER) return;
    if (this.phase === 'stripping' || this.phase === 'beaten') return;
    const from = {
      // Chest height, at the barrel: the jet leaves the tool, not the shoes.
      x: player.box.x + player.box.w / 2 + player.facing * (player.box.w / 2),
      y: player.box.y + player.box.h * 0.34,
    };
    const len = Math.max(1, Math.hypot(this.cx - from.x, this.cy - from.y));
    this.cooldown = D.WATER_COOLDOWN;
    this.sinceShotT = 0;
    this.jets.push({
      x: from.x,
      y: from.y,
      dx: (this.cx - from.x) / len,
      dy: (this.cy - from.y) / len,
    });
  }

  /**
   * Move the jets, and resolve water against fire.
   *
   * The order is the rule: **the fire, then the dragon.** A jet is spent on the
   * first thing it meets, so while the cone is burning every jet that crosses it
   * goes into the flame and none of them reach the wearer — which is exactly what
   * "water overpowers the fire, and when the fire stops it damages the dragon"
   * means once it is written down.
   */
  private advanceJets(dt: number): void {
    for (let i = this.jets.length - 1; i >= 0; i -= 1) {
      const j = this.jets[i]!;
      j.x += j.dx * D.WATER_SPEED * dt;
      j.y += j.dy * D.WATER_SPEED * dt;
      const box = this.jetBox(j);
      let spent = false;

      // 1. The burning cone. Water beats it back rather than cancelling it.
      const b = this.burst;
      if (b && b.phase === 'burning' && this.fireBoxes().some((f) => aabbOverlap(box, f))) {
        /*
         * A **rate**, not a per-jet figure. The stream is chopped into segments 0.045s
         * apart, so what each one is worth has to be derived from that spacing or the
         * contest changes every time the spacing does — which is precisely what happened
         * when the trigger became a hose: three 0.42s jets became twenty-two of them a
         * second and a burst went out in three frames.
         */
        b.quench += D.QUENCH_RATE * D.WATER_COOLDOWN;
        this.quenchCount += 1;
        this.steam.push({ x: j.x, y: j.y, t: 0 });
        spent = true;
        if (b.t + b.quench >= D.BURST_TIME) {
          this.burst = null;
          this.endBurst();
        }
      }

      // 2. The wearer — but only in the gaps between bursts.
      //
      // Anywhere else, water that reaches it boils off: a steam puff and no damage.
      // That single rule is what turns this into a fight, and it took two probes to
      // find. Guarding only the *burn* left the wind-up open and the costume came
      // apart inside four successive wind-ups (four hits, 2.0s, not one jet meeting a
      // flame); guarding attacks but not the opening roar let the player kill it
      // during its own introduction, for the same 2.0s. So: it is vulnerable while
      // waiting and at no other time. Land a hit, it commits, its fire eats
      // everything you send, you put the fire out, and the gap is your next shot.
      if (!spent && aabbOverlap(box, this.body())) {
        if (!this.isVulnerable) {
          this.steam.push({ x: j.x, y: j.y, t: 0 });
          this.quenchCount += 1;
        } else {
          this.strike(j.y);
        }
        spent = true;
      }

      if (
        !spent &&
        (j.x < -D.WATER_W ||
          j.x > RESOLUTION.WIDTH + D.WATER_W ||
          j.y < -D.WATER_H ||
          j.y > GROUND_TOP)
      ) {
        spent = true;
      }
      if (spent) this.jets.splice(i, 1);
    }
  }

  /**
   * One jet on the dragon: the glasses take a hit — and it answers immediately.
   *
   * The retaliation is what makes this a fight rather than a button. Without it the
   * whole boss came off in one held burst: a probe took the costume apart in 1.78s
   * with five jets, **none** of which met any fire, so the water-versus-fire exchange
   * the screen is built on never happened once. Provoking a burst on every hit forces
   * the real loop — land a hit, take the fire, put the fire out, land the next.
   *
   * The hit leaves the *rules* here and plays out in the *picture* over the next
   * `DISSOLVE_TIME` (see `DissolveState`), so the glass can fog, crack and run
   * without the rhythm of the fight depending on how long that takes to draw.
   */
  private strike(hitY: number): void {
    if (this.layers <= 0) return;
    this.layers -= 1;
    this.hitCount += 1;
    this.dissolving = { layer: this.layers + 1, t: 0, hitY };
    this.steam.push({ x: this.cx, y: hitY, t: 0 });
    if (this.layers === 0) {
      // Whatever it was in the middle of is over. The costume comes apart, and from
      // this frame on nothing on the screen can cost a life.
      this.burst = null;
      this.phase = 'stripping';
      this.t = 0;
    } else {
      // Answer on the next frame the state machine is free to: `waiting` transitions
      // as soon as its timer is up, so putting the timer there is the retaliation.
      this.t = D.BURST_GAP;
    }
  }

  private advanceDissolve(dt: number): void {
    if (!this.dissolving) return;
    this.dissolving.t += dt;
    if (this.dissolving.t >= D.DISSOLVE_TIME) this.dissolving = null;
  }

  private advanceSteam(dt: number): void {
    for (let i = this.steam.length - 1; i >= 0; i -= 1) {
      const s = this.steam[i]!;
      s.t += dt;
      if (s.t >= STEAM_LIFE) this.steam.splice(i, 1);
    }
  }

  /**
   * Five people, walking out of the suit's open side one after another (owner call).
   *
   * They used to drop out of the standing beast's chest. Now the beast is on the floor and
   * the costume opens, so this is a **queue through a door**: everyone starts at the
   * opening and walks to their own place in the line-up, `CANDIDATE_STAGGER` apart, and the
   * first one out waits `COSTUME_OPEN` for the zip.
   *
   * Authored positions rather than a scatter: a roll would have to come out of the seeded
   * generator to stay replayable, and five evenly-spread arrivals read as a line-up of new
   * hires, which is the picture. They line up **towards the player**, i.e. on the side the
   * suit is unzipped, because a hire who walks away from you is not a payoff.
   */
  private spawnCandidates(): void {
    const door = this.cx + this.dir * 40;
    // Towards the player and along the floor, 74px apart: five 32px people any closer
    // overlap and their HIRED plaques collide.
    const step = 74;
    for (let i = 0; i < D.CANDIDATES; i += 1) {
      const target = door + this.dir * (60 + i * step);
      this.candidates.push({
        fromX: door,
        // Kept on frame whichever way it happens to be facing.
        toX: Math.max(40, Math.min(RESOLUTION.WIDTH - 40, target)),
        t: -(D.COSTUME_OPEN + i * D.CANDIDATE_STAGGER),
      });
    }
  }

  private advanceCandidates(dt: number): void {
    for (const c of this.candidates) {
      c.t = Math.min(D.CANDIDATE_WALK_TIME, c.t + dt);
    }
  }

  /** Seconds after the fall at which the last of the five has arrived. */
  private get allOutAt(): number {
    return (
      D.COSTUME_OPEN + (D.CANDIDATES - 1) * D.CANDIDATE_STAGGER + D.CANDIDATE_WALK_TIME
    );
  }

  reset(): void {
    this.cx = (this.minX + this.maxX) / 2;
    this.dir = -1;
    this.driftDir = -1;
    this.phase = 'roar';
    this.t = 0;
    this.layers = D.HITS_TO_STRIP;
    this.tauntIndex = 0;
    this.burstsMade = 0;
    this.burst = null;
    this.dissolving = null;
    this.jets.length = 0;
    this.steam.length = 0;
    this.candidates.length = 0;
    this.armed = false;
    this.spraying = false;
    this.cooldown = 0;
    this.sinceShotT = Number.POSITIVE_INFINITY;
    this.jetsFired = 0;
    this.quenchCount = 0;
    this.hitCount = 0;
  }

  // --- snapshots for the host ------------------------------------------------

  dragonState(): DragonState {
    return {
      name: this.name,
      box: this.body(),
      dir: this.dir,
      phase: this.phase,
      progress: this.phaseProgress(),
      layers: this.layers,
      dissolve: this.dissolveState(),
      costume: this.costumeState(),
      jawOpen: this.jawOpen(),
    };
  }

  /**
   * How far the jaw is open, 0..1.
   *
   * The roar is wide (it is a roar). The wind-up **ramps** it, so the mouth parting is the
   * beat before the fire and not simultaneous with it — which is the whole reason this is a
   * number and not a boolean. The burn holds it wide. Everything else is shut, including
   * the topple: a beast that has just gone down is not mid-bellow.
   */
  private jawOpen(): number {
    if (this.phase === 'roar') return 0.85;
    if (this.phase === 'burning') return 1;
    if (this.phase === 'charging') {
      const b = this.burst;
      return b ? Math.min(1, b.t / Math.max(0.0001, D.BURST_WINDUP)) : 0;
    }
    return 0;
  }

  private dissolveState(): DissolveState | null {
    const d = this.dissolving;
    if (!d) return null;
    return {
      layer: d.layer,
      progress: Math.min(1, d.t / D.DISSOLVE_TIME),
      hitY: d.hitY,
    };
  }

  private phaseProgress(): number {
    if (this.phase === 'roar') return Math.min(1, this.t / D.ROAR_TIME);
    if (this.phase === 'stripping') return Math.min(1, this.t / D.STRIP_TIME);
    if (this.phase === 'waiting') return Math.min(1, this.t / D.BURST_GAP);
    if (this.burst) {
      const span = this.burst.phase === 'windup' ? D.BURST_WINDUP : D.BURST_TIME;
      return Math.min(1, this.burst.t / span);
    }
    return 0;
  }

  /** The committed burst — the wind-up's lane, then the cone itself. */
  fireState(): FireState | null {
    const b = this.burst;
    if (!b) return null;
    const span = b.phase === 'windup' ? D.BURST_WINDUP : D.BURST_TIME;
    const extent = this.extent();
    return {
      phase: b.phase,
      progress: Math.min(1, b.t / span),
      mouth: { ...b.mouth },
      target: { ...b.target },
      extent,
      dir: b.dir,
      quenched: Math.min(1, b.quench / D.BURST_TIME),
      label: b.label,
      labelAt: { ...b.labelAt },
      labelAngle: b.labelAngle,
      boxes: coneBoxes(b.mouth, b.target, extent),
    };
  }

  waterStates(): WaterState[] {
    return this.jets.map((j) => ({ box: this.jetBox(j), dx: j.dx, dy: j.dy }));
  }

  steamStates(): SteamState[] {
    return this.steam.map((s) => ({ x: s.x, y: s.y, progress: Math.min(1, s.t / STEAM_LIFE) }));
  }

  candidateStates(): CandidateState[] {
    return this.candidates.map((c) => {
      const p = Math.max(0, Math.min(1, c.t / D.CANDIDATE_WALK_TIME));
      return {
        x: c.fromX + (c.toX - c.fromX) * p,
        // They walk, so they are on the floor for every frame of it.
        y: GROUND_TOP,
        progress: p,
        landed: p >= 1,
        dir: c.toX >= c.fromX ? 1 : -1,
      };
    });
  }

  /**
   * The empty suit, or null: before the fall, and again once it has gone.
   *
   * The zip runs back over `COSTUME_OPEN`, the five walk out, it lies there for
   * `COSTUME_HOLD` and then fades over `COSTUME_FADE` (owner call: "the costume after some
   * time vanishes"). All of it is a function of one clock — the seconds since the beast
   * went down — so nothing has to be remembered and a replay lands on the same frame.
   */
  costumeState(): CostumeState | null {
    if (this.phase !== 'beaten') return null;
    const openness = Math.max(0, Math.min(1, this.t / D.COSTUME_OPEN));
    const fadeFrom = this.allOutAt + D.COSTUME_HOLD;
    const fade = Math.max(0, Math.min(1, (this.t - fadeFrom) / D.COSTUME_FADE));
    if (fade >= 1) return null;
    return { openness, fade };
  }

  /**
   * 0..1 — how far the screen has come good since the beast went down.
   *
   * The one dial the *environment* reads (owner call: "when the Godzilla dies make the
   * environment beautiful and well lit up, and from the dangerous environment it turns all
   * bright and happy"). It lives here, on sim time, for the same reason the Compliance
   * maze's weather does: the backdrop has no business knowing a badge exists, and a payoff
   * driven by the wall clock is a payoff that jumps on a reload.
   */
  get relief(): number {
    if (this.phase !== 'beaten') return 0;
    return Math.max(0, Math.min(1, this.t / D.RELIEF_TIME));
  }

  /** The badge is taken, so the cannon is in the player's hands. */
  get hasCannon(): boolean {
    return this.armed;
  }

  /** Seconds since the cannon fired (`Infinity` before the first jet). */
  get sinceShot(): number {
    return this.sinceShotT;
  }

  /** The valve is open: water is leaving the cannon right now. */
  get isSpraying(): boolean {
    return this.spraying;
  }

  /** The opening beat: nothing it does can cost anything yet. */
  get isRoaring(): boolean {
    return this.phase === 'roar';
  }

  /** Fire is coming out of it right now (so a jet crossing the cone quenches it). */
  get isBreathing(): boolean {
    return this.burst !== null && this.burst.phase === 'burning';
  }

  /**
   * The costume can be hit right now.
   *
   * True only between bursts: not during the opening roar, and not while it is
   * charging or burning. The whole fight is timed against this one window — hits
   * land in the gaps, and everything else you send boils off as steam.
   */
  get isVulnerable(): boolean {
    return this.phase === 'waiting';
  }

  /**
   * It is going down: the beat between the last jet landing and the costume opening.
   *
   * Public because it is the one event on this screen with no counter behind it — the
   * host needs the rising edge of this phase to sound the topple, and before it had it
   * the fourth hit was the only thing the fall got to say for itself.
   */
  get isToppling(): boolean {
    return this.phase === 'stripping';
  }

  /** Costume off: the screen is safe and the hires have walked out. */
  get isBeaten(): boolean {
    return this.phase === 'beaten';
  }

  /** Hits still left on the costume (the on-screen proof, drawn as pips). */
  get layersLeft(): number {
    return this.layers;
  }

  /**
   * Monotonic counters. The host polls these to play a cue exactly once per event
   * without the hazard ever knowing an AudioEngine exists — the same reason
   * `Stamps.struckAt` is a getter rather than a callback.
   */
  get shotsFired(): number {
    return this.jetsFired;
  }

  get quenches(): number {
    return this.quenchCount;
  }

  get hits(): number {
    return this.hitCount;
  }
}

/**
 * mulberry32 — the third copy in the codebase, and deliberately so: `world/*` may
 * not import `core/*` (that copy belongs to the render layer's particles) and the
 * maze owns its own. Eight lines beats a shared dependency that crosses the
 * headless boundary.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
