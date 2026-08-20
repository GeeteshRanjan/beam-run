/**
 * Typed accessor for the shipped `levels.json` (single source of truth for all
 * geometry and hazard placement). The engine hardcodes no layouts — everything
 * is read from here. Coordinates are in TILE units unless a field ends in `_px`.
 *
 * Structural contract (enforced by `scripts/validate-levels.ts`): every screen
 * carries a badge, it is anchored ahead of the obstacles it answers, and every
 * hazard screen keeps obstacles beyond it — otherwise taking the badge proves
 * nothing.
 */
import raw from './levels.json';

export type HazardKind = 'none' | 'stamps' | 'dragon' | 'maze' | 'workplace';

/**
 * ANSR capability each badge grants. Four structurally different verbs, one per
 * real service line — never one reskinned shield.
 *
 *  - `PLACE_TILE`  SET UP  1Wrk slows the DENIED stamps to a walk-through pace
 *                          and shields you, so a stamp cannot press you at all
 *  - `EXTINGUISH`  STAFF   Talent500 hands you a water cannon and a teal halo:
 *                          the hiring dragon's fire cannot touch you, water beats
 *                          its fire, and four jets take its costume off
 *  - `CLEAR_PATH`  CLEAR   GCC-BOT opens every toll gate in the compliance maze
 *                          and sends the monsters home
 *  - `UNWRAP`      FREE    500Leaders hand you a cutter: three shots strip the
 *                          caution tape off the figure blocking the workplace,
 *                          and the colleague underneath fixes the room
 *
 * **Those four are now the whole list.** There used to be a fifth, `SAFE_PASSAGE`,
 * carried by the two screens with no obstacle to answer, so that the ANSR mark would
 * appear on every screen with its effect deliberately unassigned. Both holders have
 * been deleted by the owner, one pass apart and for the same reason each time:
 * Reception's taught a first-time player that taking an ANSR badge changes nothing —
 * one screen before the badge that saves their life — and the Tech Park's hung a rail
 * in the middle of the payoff, on a screen the player has already won. So every badge
 * in the game is a capability that changes the screen it is on, and the type went with
 * its last holder: a badge type nothing carries is a trap for whoever reads this next.
 */
export type BadgeType = 'PLACE_TILE' | 'EXTINGUISH' | 'CLEAR_PATH' | 'UNWRAP';

export type ScreenType = 'intro' | 'hazard' | 'finale';

/**
 * Authoring metadata: whether an obstacle was written as the felt problem or as
 * the same problem once ANSR is engaged. It no longer describes a *position* —
 * the badge sits ahead of both — so nothing validates it against geometry.
 */
export type Zone = 'struggle' | 'relief';

export interface GridPos {
  gx: number;
  gy: number;
}

export interface SolidRect {
  gx: number;
  gy: number;
  w: number;
  h: number;
  /**
   * Authoring label, with two exceptions the runtime reads: `noncollide` (skipped
   * by `Screen`, i.e. a facade) and `pedestal` (painted by the screen's own render
   * module as a prop rather than as level material — the floating bricks the badge
   * is dropped onto on Hire Under Fire). `scripts/strip-level-notes.ts` keeps
   * exactly those two and drops the rest.
   */
  role?: string;
  note?: string;
}

/**
 * A "DENIED" rubber stamp that slams down from the top of the frame (Setup
 * Delays). `phase` is a fraction of `HAZARDS.STAMPS.CYCLE` (0..1): author a pair
 * half a cycle apart and they alternate rapid-fire, with barely a beat between
 * one lifting and the next dropping.
 */
export interface StampSpec {
  gx: number;
  phase: number;
  zone?: Zone;
}

/**
 * The hiring dragon on Screen 4 — a big dragon in a tie and glasses (owner call).
 *
 * One entry, in an array, because a hazard *family* is a list everywhere else in
 * this file and the validator counts families by looking for a non-empty array.
 * Nothing stops a second dragon; nothing needs one.
 *
 * `from`/`to` are the columns of the **ground it stands on at the far end of the
 * screen** (owner call — it used to hover over a row, and before that it held a
 * standoff from the player anywhere on the frame, which made the screen a chase).
 * There is deliberately **no row field**: it stands on two feet, so the ground band
 * and `HAZARDS.DRAGON.BODY_H` decide its height and nothing can author it into the
 * air. Its body has no hitbox: only its fire is lethal, so nothing on this screen
 * can cost a life without a telegraph in front of it. `seed` drives its rhythm —
 * `step()` never calls `Math.random`.
 *
 * `taunts` are the labels painted on each burst's plaque, one per burst, and they
 * are the only strings in this file that are *drawn*: they must stay uppercase and
 * clear of the 5×7 font's gaps (no lower case, no apostrophe). They are also what
 * makes the screen an argument rather than a boss fight — the fire has a reason
 * written next to it.
 */
export interface DragonSpec {
  /** Uppercase, bitmap-font safe: it is drawn on the dragon's name plate. */
  name: string;
  /** The first and last column of its patch of ground: it shifts inside these. */
  from: number;
  to: number;
  /** Seeds the dragon's own generator, so its rhythm is replayable. */
  seed: number;
  /** Labels painted on the bursts, cycled in order. */
  taunts: string[];
  zone?: Zone;
}

/**
 * The figure wrapped in caution tape on the Workplace screen.
 *
 * It owns a corridor like a compliance monster does, but it behaves nothing like
 * one: it walks **one way only**, at a single constant speed, and loops back to
 * `from` when it reaches `to` instead of turning around (owner call). That makes
 * it a metronome rather than a chase — the player can read the whole pattern from
 * behind the partition wall before committing, and the loop is what leaves a
 * window to run through. Contact while it is still wrapped stalls the stage.
 */
export interface MummySpec {
  /** Uppercase, bitmap-font safe: it is drawn over the figure. */
  name: string;
  from: number;
  to: number;
  /** Surface row it walks along. */
  gy: number;
  zone?: Zone;
}

/**
 * One compliance monster in the Compliance maze (Entity, Payroll, Legal, Tax,
 * Audit — the headaches, wearing faces).
 *
 * It owns a *corridor*, not a route: `from`/`to` are the grid columns it may
 * wander between, `gy` is the surface row it stands on at `from`, and `slope`
 * steps that row by one per column so a monster can walk a staircase (−1 rises
 * to the right, 0 is flat, 1 falls). At every junction — a column boundary or
 * either end of its corridor — it re-rolls direction and speed from its own
 * `seed`, so it is unpredictable without ever hunting the player. Contact
 * without ANSR stalls the stage.
 */
export interface MonsterSpec {
  /** Uppercase, bitmap-font safe: it is drawn over the monster. */
  name: string;
  from: number;
  to: number;
  gy: number;
  slope?: -1 | 0 | 1;
  /**
   * Columns per step of `slope`, i.e. the staircase's run. Defaults to 1.
   *
   * The Compliance flights have **two-column treads** so they read as the long
   * shallow diagonals the owner's sketch draws, and a monster walking one has to
   * step up every *second* column or it floats. Expressing that as a run rather
   * than as a fractional `slope` keeps the surface on whole rows: half a row is
   * 20px, and a monster standing 20px into the stone (or 20px above it) is the
   * same defect the `badgeFloat` rule exists to prevent.
   */
  slopeRun?: number;
  /**
   * This monster's surface is the clearance **hoist**, not a row in this file.
   *
   * The Compliance maze's fifth level is a moving plate (the owner replaced the long
   * brown platform that used to stand at gy 8 with it), and a level with no monster
   * on it is a free walk — which is the one thing this screen is not. So `gy` becomes
   * documentation (the plate's parking row) and `ComplianceMaze` reads the plate's
   * live top instead, exactly the way the plate's own collision box is read: one
   * source for a moving surface, never two.
   */
  hoist?: boolean;
  /** Seeds the monster's own generator — `step()` never calls Math.random. */
  seed: number;
  zone?: Zone;
  note?: string;
  /**
   * The way home, once the badge is taken: surface cells it walks through, corner
   * by corner, ending at the gather cell.
   *
   * This is authored rather than searched for, and it is authored per monster
   * because the point of the moment is that they use **the player's own
   * staircases** (owner call — they drifted diagonally through the stone before,
   * which read as a bug). A route is a handful of corners; a pathfinder would be
   * a kilobyte of code and a determinism risk for the same picture.
   */
  route?: GridPos[];
}

/**
 * The clearance lift at the end of the Compliance maze — the one moving piece of
 * geometry in the game.
 *
 * `gx`/`gy`/`w` are where it **parks** (the top of the plate sits on row `gy`),
 * and `toGy` is the row whose top it descends to. It goes down while the player
 * is standing on it and returns when they step off, so it is a ride rather than a
 * timing puzzle.
 *
 * It is deliberately **not** listed in `solids`: it moves, so `ComplianceMaze`
 * owns the live box and hands the same one to the player's collision list and to
 * the renderer. Level data says where it parks, never where it is — the same rule
 * the floating badge taught us (`world/badgeFloat.ts`).
 */
export interface LiftSpec {
  gx: number;
  gy: number;
  w: number;
  toGy: number;
  note?: string;
}

/**
 * The clearance **hoist** — the same machine as the lift, pointing the other way.
 *
 * It replaced the long brown platform that used to stand across gx 9-14 at gy 8
 * (owner call: "make this a floating platform like the yellow one on the other side
 * but make it go up and down so the user can jump on this and get on the top brick
 * floor easily"). One spec shape for both plates, because the *direction* is data:
 * `gy` is where it parks and `toGy` is where it travels to, so `toGy < gy` rises and
 * `toGy > gy` descends. `ComplianceMaze` owns the live box for the same reason it
 * owns the lift's.
 *
 * Its parking row is load-bearing and not a taste decision — see the screen note in
 * `levels.json`: the plate's underside has to leave a jumpable 84px over the highest
 * tread beneath its span, or it seals the only route up.
 */
export type HoistSpec = LiftSpec;

/**
 * A badge is a pickup and nothing else — it contributes no geometry.
 *
 * It used to be able to lay a tile (`placesTileAt`): 1Wrk bridged Setup Delays'
 * red-tape pit. That screen's obstacles were replaced with the DENIED stamps, so
 * nothing in the game placed a tile any more and the whole mechanism — spec
 * field, `Powerups.placedTile`, `extraSolids()`, the renderer's bridge pass and
 * the validator's "uncompletable without the bridge" rule — was dead weight. See
 * `docs/JOURNAL.md` if a future badge needs to build again.
 */
export interface BadgeSpec {
  type: BadgeType;
  gx: number;
  /**
   * The badge's row. What it means depends on `delivery`: for the default rail it
   * is the anchor the badge floats around (`badgeCenter`), and for an airdrop it is
   * the row the carrier flies along (`world/badgeDrop.ts`).
   */
  gy: number;
  /**
   * How the badge gets to the player. Absent = the levitating rail every screen
   * used to use.
   *
   * `'airdrop'` (Hire Under Fire, owner call) is the other one: a flying ANSR
   * supply drone carries it in, drops it over one of `drops` in turn onto the
   * floating brick at `restGy`, and it **expires**. The test becomes "can you get
   * there in time" *as well as* "can you time a jump" — which is the right question
   * on the one screen where standing still is how you get burnt, and it is why that
   * screen's badge is the only one that can be *missed by doing nothing* rather than
   * only by mistiming.
   *
   * `'perch'` (Compliance, owner call) is the third: the mark simply **stands on the
   * top course of a brick wall** at `gx`, on the row given by `restGy`. No rail, no
   * drone, no clock — jump onto the wall and it is yours. It is the least demanding
   * of the three on purpose: the badge it carries is the one that turns a whole maze
   * from a timing test into a staircase, and the screen's difficulty belongs in the
   * maze rather than in the pickup. The rail's "jumpable, not walkable" rule still
   * holds, and it holds by construction — the wall is two courses tall, so the mark
   * is 36px over a standing head.
   *
   * `'ceiling'` (the Workplace, owner call) is the fourth and the only one tied to
   * its own screen's picture: the mark hangs in the beam of the first ceiling
   * spotlight at `gx`/`gy`, drops straight down onto the overhead cabinet at
   * `restGy` after `POWERUPS.CEILING.HOLD` seconds, rests there for `LIFETIME`, and
   * is gone until the next cycle (`world/badgeCeiling.ts`). It is the only delivery
   * that is *visible before it is takeable*, which is the whole point of it — the
   * offer is on screen from frame one and being ready for it is a decision.
   */
  delivery?: 'rail' | 'airdrop' | 'perch' | 'ceiling';
  /**
   * Airdrop, perch **or ceiling drop**: the row whose **top** the badge comes to
   * rest on.
   *
   * Authored because the thing it lands on is authored: each drop column carries a
   * floating brick (`role: "pedestal"`) and the badge sits on its top face, so the
   * player has to jump for it (owner call — it used to lie on the floor, where an
   * auto-running player collected it without ever leaving the ground). Omit it and
   * the badge rests on the ground band, which is what the mechanic used to do.
   *
   * A perch reads it the same way, against the top course of its brick wall
   * (`world/badgePerch.ts`), and so does a ceiling drop, against the top of the
   * floating overhead cabinet it falls onto (`world/badgeCeiling.ts`) — so "the
   * pickup sits on a surface authored in this file" has one meaning across all three.
   */
  restGy?: number;
  /**
   * Perch only: how many tiles wide the deck it stands on is, so the mark can be
   * **centred on that deck** rather than parked in one of its columns (owner call).
   *
   * Defaults to 1, which is every other case: an air-drop and a ceiling drop both land
   * on a one-tile-wide pedestal, so their `gx` already is the centre column. Only the
   * Compliance deck is wider than the pickup, and a two-tile deck has no centre
   * *column* — hence a width rather than a fractional `gx`, which would put a
   * gameplay-critical number half way between two grid cells for the first time in
   * this file.
   */
  restW?: number;
  /**
   * Airdrop only: the grid columns the drone drops on, used in order and then
   * repeated, so a missed drop is a lost opportunity rather than a lost screen.
   *
   * Every one of them has to satisfy the badge-before-obstacle rule, not just
   * `gx` — the validator checks each column against every obstacle, because a drop
   * behind the dragon's lane would be a badge you can only take after the thing it
   * answers.
   */
  drops?: number[];
  note?: string;
}

/**
 * A piece of the Workplace screen's floor dressing.
 *
 * Authored rather than procedural because it is *layout*, and because a room that
 * has been taped off is only convincing if the barricades stand somewhere
 * particular. None of it collides — the partition is the only jump on the screen —
 * and all of it is cleared by the fix.
 *
 * `post` entries are special: hazard tape is strung between each consecutive pair,
 * so they are authored left to right in the order the tape should run.
 */
export interface ClutterSpec {
  kind: 'barricade' | 'cone' | 'sign' | 'post' | 'ladder';
  gx: number;
}

export interface ScreenCopy {
  titleCard?: string;
  hint?: string;
  onClear?: string;
  win?: string;
}

export interface ScreenData {
  id: number;
  name: string;
  type: ScreenType;
  hazard: HazardKind;
  meaningTag?: string;
  /** Months booked on clearing this screen (the journey clock). */
  monthsBase: number;
  spawn: GridPos;
  exit?: { gx: number };
  winTrigger?: { gx: number };
  solids: SolidRect[];
  stamps?: StampSpec[];
  dragons?: DragonSpec[];
  mummies?: MummySpec[];
  monsters?: MonsterSpec[];
  lift?: LiftSpec;
  /** The rising plate on the Compliance maze (see {@link HoistSpec}). */
  hoist?: HoistSpec;
  /**
   * The sparking terminal on the Workplace screen — where the freed colleague
   * runs to, and the thing that puts the room right. Pure art plus one target
   * position; it contributes no geometry.
   */
  terminal?: GridPos;
  clutter?: ClutterSpec[];
  /** Where the monsters gather once the badge is taken (Compliance maze). */
  gather?: GridPos;
  badge?: BadgeSpec;
  copy?: ScreenCopy;
}

export interface LevelsFile {
  meta: {
    grid: { cols: number; rows: number; tile: number };
    notes?: string;
    structure?: string;
    clock?: string;
    conventions?: Record<string, string>;
  };
  screens: ScreenData[];
}

const data = raw as unknown as LevelsFile;

export const GRID = data.meta.grid;
export const SCREENS: readonly ScreenData[] = data.screens;

export function getScreen(id: number): ScreenData {
  const screen = SCREENS.find((s) => s.id === id);
  if (!screen) {
    throw new Error(`No screen with id ${id}`);
  }
  return screen;
}

export const SCREEN_COUNT = SCREENS.length;

/** Months a flawless run books (sum of every screen's base). */
export const TOTAL_MONTHS_BASE = SCREENS.reduce((sum, s) => sum + (s.monthsBase ?? 0), 0);
