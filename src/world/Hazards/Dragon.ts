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
 * **3. What it throws is one jet of fire, aimed at the player** (owner call, a later
 * pass: "follow the player … more natural", and "the fire need not be in the angle it
 * is in"). There are no fireballs and no rolling flame fronts. It draws breath for
 * `BURST_WINDUP` (the tell is on the animal), then throws a straight jet from its jaw
 * **at the player's centre**: it grows out of the jaw over `CONE_GROW`, diverges from
 * `CONE_NEAR_H` to `CONE_FAR_H`, lands and splashes along the floor if it is aimed down,
 * and ends in the air if it is not. For the rest of `BURST_TIME` the aim **eases after
 * the player** (`AIM_*`) — capped, so a dash in under the head outruns it — and the fire
 * already in the air keeps the direction it left with, so a swinging jet bends like a
 * hose (`flameStream`). One of the screen's taunts is written along the jet, and the
 * next burst brings the next one.
 *
 * **4. Its fire is the hazard, and so is its foot — never its body.** The body contributes
 * no hitbox and no wall: you cannot be killed by the thing that has no telegraph. What is
 * lethal is fire (0.65s of wind-up in front of it, growing outwards from the beast so the
 * end nearest the player lights last) and, up close, **a stomp** (owner call: "when the
 * player reaches the Godzilla it should stomp on the player like an animal would"): the
 * front foot lifts for `STOMP_WINDUP` over where the player was, comes down over
 * `STOMP_SLAM`, and only that falling foot can hurt. Keep running and it lands behind you;
 * stop at its feet and you are flattened. The aim holds rather than turning back once the
 * player is behind the jaw, and never points at the beast's own feet (`AIM_DOWN`).
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
 * The jet of fire — the screen's only hazard, and the only thing on it that can cost a
 * life.
 *
 * `mouth` is where it leaves the jaw, `points` the jet itself (aimed at the player and
 * bending like a hose when the aim swings — `flameStream`), `target` the far end of the
 * whole jet (during the wind-up, of the jet it is about to throw). `boxes` is the lethal
 * geometry *and* exactly what the renderer paints, so the two can never disagree — the
 * `badgeFloat` rule applied to a hazard.
 */
export interface FireState {
  phase: FirePhase;
  /** 0..1 through the current phase (wind-up, then burn). */
  progress: number;
  mouth: Point;
  target: Point;
  /** 0..1 of its length the flame has grown along. 0 for the whole wind-up. */
  extent: number;
  /** −1 throwing left, 1 right. */
  dir: -1 | 1;
  /** 0..1 how far the water has beaten the burst back (1 = out). */
  quenched: number;
  /** The taunt fixed to this burst. The next burst carries the next one. */
  label: string;
  /**
   * Where that taunt is painted: **on the flame** (owner call), at `CONE_LABEL_F` of the
   * whole jet's length — so the growth passes through the words rather than pushing them,
   * and when the aim swings they go with the jet they are written on.
   */
  labelAt: Point;
  /**
   * Radians the taunt is set at, so it lies **along** the flame (owner call: "in the same
   * angle the flame is in"): the jet's own direction there, normalised to reading
   * direction so it is never upside down.
   */
  labelAngle: number;
  /** The jet's samples (empty for the wind-up). */
  points: FlamePoint[];
  /** The lethal boxes: one square per point. */
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
  /**
   * 0..1 — how much of a stride it is in (owner call: "the feet of the Godzilla don't move
   * and that makes it look weird"). Rises over `GAIT_EASE` while it shifts its weight
   * between bursts and settles back to 0 once it stops, so the renderer can step the legs
   * without a lifted foot snapping flat the frame a burst commits. *Where* in the stride it
   * is comes from `box.x` itself, which is what keeps a planted foot from sliding.
   */
  gait: number;
  /** The front foot's stomp in progress, or null (see `StompState`). */
  stomp: StompState | null;
}

/**
 * A stomp (owner call: "the Godzilla should stomp on the player like an animal would").
 *
 * `lift` is the telegraph — the front foot rising over `x` — `slam` is the fall and the
 * only lethal part, `recover` is the foot standing where it landed and then stepping home.
 * `x` is committed when the foot leaves the floor, which is the counterplay: it comes down
 * where the player *was*.
 */
export interface StompState {
  phase: 'lift' | 'slam' | 'recover';
  /** 0..1 through the phase. */
  progress: number;
  /** World x the foot comes down on (its centre). */
  x: number;
  /** World x of the front foot's centre when it stands at rest. */
  home: number;
  /** The lethal footprint while it is falling, else null. */
  box: AABB | null;
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
 * Both are read off the **drawn grid** rather than chosen, and the grid has since been
 * re-authored twice at a finer cell without either number moving — which is the point of
 * them living here. On today's 80×63 beast at scale 3 the mouth line is row 10 and the
 * muzzle tip is column 77, i.e. 31px down a 190px box and 22px back from the snout: the
 * fractions land 0.15 × 190 = 28.5px down and mid-mouth along. **The 3px of daylight
 * between 28.5 and 31 is deliberately not chased** — the flame is `CONE_NEAR_H` (120px)
 * thick where it leaves the jaw, so a couple of pixels is inside its own core, and moving
 * `MOUTH_Y_FRACTION` to close it would put the whole lethal lane out for re-measurement
 * (below). What must stay true is that the fractions point *into the drawn mouth*; that is
 * the thing to re-check after any head pass. The jaw
 * is therefore high — 161px off the floor, because the skull is the top of an upright
 * Godzilla's silhouette — and the fire leaves it on a long shallow line down to the ground
 * rather than out of a snout held at knee height. Every `CONE_*` number in
 * `tuning.config.ts` is solved against that height, so re-drawing the head moves the size
 * of the lethal lane and has to be re-measured there.
 */
export const MOUTH_X_FRACTION = 0.46;
export const MOUTH_Y_FRACTION = 0.15;

/**
 * Half the flame's thickness at fraction `f` along its length.
 *
 * **Exported, because the renderer needs the same number.** Two copies of a hazard's own
 * profile is the `badgeFloat` defect waiting to happen.
 */
export function coneHalfAt(f: number): number {
  return (D.CONE_NEAR_H + (D.CONE_FAR_H - D.CONE_NEAR_H) * f) / 2;
}

/** One sample of the jet: its centre and half its thickness there. */
export interface FlamePoint {
  x: number;
  y: number;
  half: number;
  /** True where the jet has landed and is running along the floor. */
  onFloor: boolean;
}

/** Arc length of the first sample: the square there ends at the jaw, not behind it. */
const STREAM_START = D.CONE_NEAR_H / 2;

/**
 * The jet, as `CONE_SEGMENTS + 1` points along its own path (owner call: aimed at the
 * player, and following them "more naturally").
 *
 * **Every point is fire that left the jaw a moment ago.** The point at arc length `s`
 * left `s / speed` seconds ago, along the direction the jaw was pointing *then*
 * (`angleAt(s)`), and has travelled straight since. So a steady aim is a straight jet, and
 * a swinging aim is a stream that bends like water from a hose and then catches up — the
 * natural picture, and the reason the aim is stored as a history rather than as one angle.
 *
 * A point whose straight path has gone below the floor landed on it: it runs on along the
 * floor, away from the beast, for up to `FLAME_SPLASH` of its remaining length, and past
 * that it has burnt out. Nothing is ever further than `maxReach` from the jaw horizontally
 * — the spawn's guarantee. `grown` (px of arc) is how far the flame has come since it lit,
 * so the jet grows out of the jaw rather than appearing; `length` is this burst's length
 * (the seeded roll, never above `FLAME_LENGTH`).
 *
 * The points stop at the first one that is burnt out or out of reach, so the stream is
 * always one contiguous shape.
 */
export function flameStream(
  mouth: Point,
  dir: -1 | 1,
  angleAt: (s: number) => number,
  grown: number,
  maxReach: number,
  length: number = D.FLAME_LENGTH,
): FlamePoint[] {
  const L = length;
  const upto = Math.min(L, grown);
  const pts: FlamePoint[] = [];
  if (upto <= STREAM_START) return pts;
  const n = D.CONE_SEGMENTS;
  for (let i = 0; i <= n; i += 1) {
    const s = Math.min(upto, STREAM_START + ((L - STREAM_START) * i) / n);
    const f = s / L;
    const half = coneHalfAt(f);
    const phi = angleAt(s);
    // The flame's UNDERSIDE sits on the floor once it has landed, so it is fire on the
    // ground rather than fire half-buried in it.
    const floorY = GROUND_TOP - half;
    let dx = s * Math.cos(phi);
    let y = mouth.y + s * Math.sin(phi);
    let onFloor = false;
    if (y >= floorY) {
      // Only a downward jet can get here: the jaw is well above every floor line.
      const hit = (floorY - mouth.y) / Math.max(1e-6, Math.sin(phi));
      const run = s - hit;
      if (run > D.FLAME_SPLASH) break;
      dx = hit * Math.cos(phi) + run;
      y = floorY;
      onFloor = true;
    }
    if (dx > maxReach) break;
    pts.push({ x: mouth.x + dir * dx, y, half, onFloor });
    if (s >= upto) break;
  }
  return pts;
}

/**
 * The jet's lethal geometry: one square per point, as wide as the flame there, clipped by
 * the floor.
 *
 * Exported because the renderer paints inside exactly these squares, so "what burns" and
 * "what is drawn" stay one function whatever angle the jet is at. A jet is not an AABB, and
 * the two dishonest answers both cost the player: one box round the whole thing is lethal
 * where there is no flame, one box round its axis is flame that cannot hurt anybody.
 */
export function streamBoxes(points: readonly FlamePoint[]): AABB[] {
  const boxes: AABB[] = [];
  for (const p of points) {
    const top = p.y - p.half;
    const bottom = Math.min(GROUND_TOP, p.y + p.half);
    if (bottom <= top) continue;
    boxes.push({ x: p.x - p.half, y: top, w: p.half * 2, h: bottom - top });
  }
  return boxes;
}

/**
 * Fraction along the jet's length the taunt is written at: on the flame, far enough out
 * that it is thick enough to hold a line of scale-2 type.
 */
export const CONE_LABEL_F = 0.45;

/**
 * Where the taunt sits on the jet, and the angle it is set at — the jet's own direction
 * there, normalised to reading direction (text runs left to right whichever way the beast
 * faces; getting this backwards writes it upside down, which no test of the rules can see).
 *
 * Read off the full-length stream rather than the grown one, so the words are placed on
 * the flame from the frame it lights and the growth passes *through* them (owner call:
 * "it should not come forward with the flame"). When the aim swings, they go with the jet
 * they are written on.
 */
export function labelOnStream(full: readonly FlamePoint[], mouth: Point): { at: Point; angle: number } {
  if (full.length < 3) return { at: { ...mouth }, angle: 0 };
  const i = Math.max(1, Math.min(full.length - 2, Math.round(CONE_LABEL_F * (full.length - 1))));
  const a = full[i - 1]!;
  const b = full[i + 1]!;
  let angle = Math.atan2(b.y - a.y, b.x - a.x);
  if (angle > Math.PI / 2) angle -= Math.PI;
  else if (angle < -Math.PI / 2) angle += Math.PI;
  return { at: { x: full[i]!.x, y: full[i]!.y }, angle };
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
  /** 0..1 stride amount, eased over `GAIT_EASE` (see `DragonState.gait`). */
  private gait = 0;
  /** The stomp in progress (see `StompState`); `x` is committed at the lift. */
  private stomping: { phase: StompState['phase']; t: number; x: number } | null = null;
  /** Stomps that have landed this attempt — the host shakes the frame on each new one. */
  private stompCount = 0;
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

  /**
   * Where the jaw is pointing: radians **below** horizontal, in the direction it faces
   * (negative is up). Eased towards the player (`updateAim`), never snapped.
   */
  private aim = 0.3;
  /** Sim seconds since this attempt began — the time base of `aimLog`. */
  private clock = 0;
  /**
   * The aim at each step of the current burst, oldest first, kept for `CONE_GROW` — the
   * time the oldest fire in the stream has been in the air. This is what lets the jet bend
   * like a hose when the aim swings (`flameStream`).
   */
  private readonly aimLog: { t: number; a: number }[] = [];

  /** The committed burst, or null. */
  private burst: {
    mouth: Point;
    dir: -1 | 1;
    /** Nothing is ever further than this from the jaw: `CONE_REACH`, frame-clamped. */
    maxReach: number;
    /** px of jet this burst throws: the seeded roll, never above `FLAME_LENGTH`. */
    length: number;
    label: string;
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
    this.taunts = spec?.taunts?.length ? spec.taunts : ['OFFER DROPOUT'];
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

  /** 0..1 of its length the flame currently covers (0 for the whole wind-up). */
  private extent(): number {
    const b = this.burst;
    if (!b || b.phase !== 'burning') return 0;
    return Math.min(1, b.t / D.CONE_GROW);
  }

  /**
   * The aim the fire at arc length `s` left the jaw with: `s / speed` seconds ago, read
   * off `aimLog` (interpolated between steps, and held at the oldest entry for anything
   * older — which is the committed aim the burst lit with).
   */
  private angleAt(s: number): number {
    const log = this.aimLog;
    if (log.length === 0) return this.aim;
    const speed = (this.burst?.length ?? D.FLAME_LENGTH) / D.CONE_GROW;
    const when = this.clock - s / speed;
    if (when <= log[0]!.t) return log[0]!.a;
    for (let k = log.length - 1; k > 0; k -= 1) {
      const a = log[k - 1]!;
      const b = log[k]!;
      if (when >= a.t) {
        const span = b.t - a.t;
        const u = span > 0 ? Math.min(1, (when - a.t) / span) : 1;
        return a.a + (b.a - a.a) * u;
      }
    }
    return log[log.length - 1]!.a;
  }

  /** The jet as it stands, grown to `grown` px of its length. */
  private stream(grown: number): FlamePoint[] {
    const b = this.burst;
    if (!b) return [];
    return flameStream(b.mouth, b.dir, (s) => this.angleAt(s), grown, b.maxReach, b.length);
  }

  private firePoints(): FlamePoint[] {
    const b = this.burst;
    if (!b || b.phase !== 'burning') return [];
    return this.stream(this.extent() * b.length);
  }

  private fireBoxes(): AABB[] {
    return streamBoxes(this.firePoints());
  }

  /**
   * Ease the jaw's aim towards the player's centre (owner call: follow the player, "more
   * naturally").
   *
   * The turn is proportional to the angle still to go and capped at `AIM_TURN_RATE`, so it
   * swings hard at somebody it has lost and settles onto somebody it has found instead of
   * snapping — and the cap is the counterplay (see `tuning.config.ts` `AIM_*`). A player
   * behind the jaw is out of its sight line: the aim **holds** rather than turning back
   * under the beast, and `AIM_DOWN` keeps the jet off its own feet.
   */
  private updateAim(dt: number, player: Player, rate: number): void {
    if (rate <= 0) return;
    const m = this.burst ? this.burst.mouth : this.mouth();
    const dir = this.burst ? this.burst.dir : this.dir;
    const px = player.box.x + player.box.w / 2;
    const py = player.box.y + player.box.h / 2;
    const ahead = dir * (px - m.x);
    if (ahead <= 0) return;
    const want = Math.max(-D.AIM_UP, Math.min(D.AIM_DOWN, Math.atan2(py - m.y, ahead)));
    const turn = Math.max(-rate, Math.min(rate, D.AIM_EASE * (want - this.aim)));
    this.aim += turn * dt;
  }

  /** Record this step's aim for the stream, and forget what has left the far end. */
  private logAim(): void {
    this.aimLog.push({ t: this.clock, a: this.aim });
    const keep = this.clock - D.CONE_GROW - 0.05;
    while (this.aimLog.length > 2 && this.aimLog[1]!.t < keep) this.aimLog.shift();
  }

  // --- per-step -------------------------------------------------------------

  update(dt: number, player: Player, ctx: HazardContext): SetbackCause | null {
    this.clock += dt;
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
    this.holdBack(player);
    this.advanceStomp(dt, player);
    // It only walks while it shifts its weight between bursts, and never on one foot;
    // every other phase is planted.
    const walking = this.phase === 'waiting' && !this.stomping;
    this.gait = Math.max(0, Math.min(1, this.gait + ((walking ? 1 : -1) * dt) / D.GAIT_EASE));
    this.advanceJets(dt);
    this.advanceSteam(dt);
    this.advanceDissolve(dt);
    this.advanceCandidates(dt);

    // The halo makes fire harmless, so contact is only *checked* unassisted. It is
    // checked after everything has moved, so the flame and the player can never swap
    // places inside one step without the overlap being seen.
    if (ctx.assisted) return null;
    if (this.stompingOn(player)) return 'stomp';
    return this.touchingFire(player) ? 'fire' : null;
  }

  /**
   * **It cannot be walked past** (owner call: "without killing the Godzilla the player should
   * not be able to cross it"). Until it goes down, its body from `BARRIER_X` either side of
   * its centre is a wall the full height of the frame — so it cannot be jumped either — and
   * the player is put back on whichever side of the animal they are on, with their speed into
   * it taken away. The exit is behind it, so this is what makes the stage a fight.
   *
   * Enforced here rather than handed to the physics as a solid, and that is deliberate: this
   * wall *moves* (the drift), and `moveAndCollide` only resolves a solid against the axis the
   * player is moving along — a drifting solid pressed into a standing player is resolved on
   * the Y axis by gravity, which puts him on top of the Godzilla. `BARRIER_X` is the front of
   * its toes, so the player it stops is standing inside `STOMP_TRIGGER` of the front foot:
   * reaching it and being stood on are the same place.
   */
  private holdBack(player: Player): void {
    if (this.phase === 'stripping' || this.phase === 'beaten') return;
    const left = this.cx - D.BARRIER_X;
    const right = this.cx + D.BARRIER_X;
    const b = player.box;
    if (b.x + b.w <= left || b.x >= right) return;
    if (b.x + b.w / 2 < this.cx) {
      b.x = left - b.w;
      if (player.vx > 0) player.vx = 0;
    } else {
      b.x = right;
      if (player.vx < 0) player.vx = 0;
    }
  }

  /** Where the front foot stands at rest: `STOMP_FOOT_X` ahead of the body, on the floor. */
  private footHome(): number {
    return this.cx + this.dir * D.STOMP_FOOT_X;
  }

  /** The falling foot's footprint, or null when nothing is coming down. */
  private stompBox(): AABB | null {
    const s = this.stomping;
    if (!s || s.phase !== 'slam') return null;
    return {
      x: s.x - D.STOMP_W / 2,
      y: GROUND_TOP - D.STOMP_H,
      w: D.STOMP_W,
      h: D.STOMP_H,
    };
  }

  private stompingOn(player: Player): boolean {
    const box = this.stompBox();
    return box !== null && aabbOverlap(player.box, box);
  }

  /**
   * The stomp's own little state machine, run alongside the fire's.
   *
   * It is the leg, not the head, so it does not wait for the jaw: a player at its feet
   * during a burst is as stood-on as one there between bursts. It never starts during the
   * roar (the guaranteed-safe opening), and a stomp in flight is dropped the moment the
   * fight ends. It **does** stomp a haloed player (owner call) — harmlessly, because the
   * halo that stops the fire stops the foot too. The body holds its facing and its ground while a foot is up (see
   * `advancePhase`), so the foot lands where it was lifted over.
   */
  private advanceStomp(dt: number, player: Player): void {
    if (this.phase === 'stripping' || this.phase === 'beaten') {
      this.stomping = null;
      return;
    }
    const s = this.stomping;
    if (s) {
      s.t += dt;
      if (s.phase === 'lift' && s.t >= D.STOMP_WINDUP) {
        s.phase = 'slam';
        s.t = 0;
      } else if (s.phase === 'slam' && s.t >= D.STOMP_SLAM) {
        s.phase = 'recover';
        s.t = 0;
        this.stompCount += 1;
      } else if (s.phase === 'recover' && s.t >= D.STOMP_RECOVER) {
        this.stomping = null;
      }
      return;
    }
    // Haloed or not, it stomps (owner call): the powerup makes the foot harmless, not the
    // animal docile — `update` simply never books it while assisted.
    if (this.phase === 'roar') return;
    const px = player.box.x + player.box.w / 2;
    const home = this.footHome();
    const low = player.box.y + player.box.h >= GROUND_TOP - D.STOMP_H;
    if (!low || Math.abs(px - home) > D.STOMP_TRIGGER) return;
    const x = Math.max(home - D.STOMP_REACH, Math.min(home + D.STOMP_REACH, px));
    this.stomping = { phase: 'lift', t: 0, x };
  }

  /** Stomps landed so far this attempt (the host shakes the frame on each new one). */
  get stompsLanded(): number {
    return this.stompCount;
  }

  private stompState(): StompState | null {
    const s = this.stomping;
    if (!s) return null;
    const span =
      s.phase === 'lift' ? D.STOMP_WINDUP : s.phase === 'slam' ? D.STOMP_SLAM : D.STOMP_RECOVER;
    return {
      phase: s.phase,
      progress: Math.min(1, s.t / span),
      x: s.x,
      home: this.footHome(),
      box: this.stompBox(),
    };
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
        // this screen where nothing is happening except the introduction. It does
        // watch, though — the aim is invisible until it breathes, and a first burst
        // lit at an arbitrary angle would be the one burst that ignored the player.
        this.updateAim(dt, player, D.AIM_TURN_RATE);
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
        // …except with a foot in the air: an animal on one leg neither walks nor turns,
        // and the foot has to come down where it was lifted over.
        if (!this.stomping) {
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
        }
        // …and it keeps its eye on them, so the next burst lights where they are.
        this.updateAim(dt, player, D.AIM_TURN_RATE);
        this.t += dt;
        if (this.t >= D.BURST_GAP) this.beginBurst();
        break;
      }
      case 'charging': {
        // Committed: the body stops for the whole wind-up and the whole burn, so
        // "the dragon has stopped moving" is itself the largest telegraph on the
        // screen. The aim only creeps during the wind-up (`AIM_WINDUP_RATE`): the
        // breath is drawn in one direction, and the jet chases once it is lit.
        this.updateAim(dt, player, D.AIM_WINDUP_RATE);
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
          // The first fire leaves along the aim the breath ended on.
          this.aimLog.length = 0;
          this.logAim();
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
        // The fire follows the player: ease the aim, and record it, because the fire
        // already in the air keeps the direction it left the jaw with.
        this.updateAim(dt, player, D.AIM_TURN_RATE);
        this.logAim();
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
   * Commit a burst: freeze the body, fix the direction and the taunt, and draw breath
   * along the current aim.
   *
   * The direction and the jaw are committed for the whole burst (the body does not turn
   * mid-breath); the *aim* is not — it creeps during the wind-up and chases the player once
   * the jet is lit (`updateAim`). The log starts with the committed aim, so the first fire
   * out of the jaw goes where the beast was looking when it drew breath.
   *
   * The seeded generator is consulted for one thing: this burst's length, inside a narrow
   * band **below** `FLAME_LENGTH`, never above it — the badge brick's guarantee is
   * measured against that figure, so a roll that could overshoot it would break a promise.
   * It is what keeps successive bursts from being pixel-identical.
   */
  private beginBurst(): void {
    const roll = this.burstsMade === 0 ? 0.5 : this.rand();
    this.burstsMade += 1;
    const length = D.FLAME_LENGTH * (0.88 + 0.12 * roll);
    const mouth = this.mouth();
    const dir = this.dir;
    const edgeX = Math.max(-T, Math.min(RESOLUTION.WIDTH + T, mouth.x + dir * D.CONE_REACH));
    const maxReach = Math.max(1, Math.abs(edgeX - mouth.x));
    this.aimLog.length = 0;
    this.burst = {
      mouth,
      dir,
      maxReach,
      length,
      label: this.taunts[this.tauntIndex % this.taunts.length]!,
      phase: 'windup',
      t: 0,
      quench: 0,
    };
    this.logAim();
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
    this.aim = 0.3;
    this.clock = 0;
    this.aimLog.length = 0;
    this.dir = -1;
    this.driftDir = -1;
    this.gait = 0;
    this.stomping = null;
    this.stompCount = 0;
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
      gait: this.gait,
      stomp: this.stompState(),
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
    const points = this.firePoints();
    // The whole jet as it would stand now: where the taunt goes, and where the far end
    // is (for the wind-up, the jet it is about to throw along the current aim).
    const full =
      b.phase === 'windup'
        ? flameStream(b.mouth, b.dir, () => this.aim, b.length, b.maxReach, b.length)
        : this.stream(b.length);
    const end = full[full.length - 1];
    const label = labelOnStream(full, b.mouth);
    return {
      phase: b.phase,
      progress: Math.min(1, b.t / span),
      mouth: { ...b.mouth },
      target: end ? { x: end.x, y: end.y } : { ...b.mouth },
      extent,
      dir: b.dir,
      quenched: Math.min(1, b.quench / D.BURST_TIME),
      label: b.label,
      labelAt: label.at,
      labelAngle: label.angle,
      points,
      boxes: streamBoxes(points),
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
