/**
 * Level validator (CI gate) — blocking, non-zero exit fails the build.
 *
 * Three layers of checks:
 *
 *  1. STRUCTURAL — every screen has ground, a far-left spawn, an exit/win
 *     trigger, at most one hazard family (with matching data + a badge), a
 *     months base, and in-bounds coordinates.
 *
 *  2. NARRATIVE — the things that make this a playable explainer rather than a
 *     platformer with logos on it, now machine-enforced:
 *       · every screen with an OBSTACLE carries a badge (a screen with nothing to
 *         defend against may omit it, and Reception does);
 *       · the badge is anchored AHEAD of the obstacles it answers, so it can be
 *         taken before the problem is met — that is the whole instruction the
 *         game gives;
 *       · every hazard screen still keeps obstacles beyond the badge, otherwise
 *         taking it proves nothing;
 *       · each of the four ANSR capabilities appears exactly once (SAFE_PASSAGE,
 *         the non-capability badge, is exempt and may repeat);
 *       · the month model adds up — screen bases sum to the ANSR benchmark, the
 *         capability savings sum to the full gap, and the cap keeps every run
 *         strictly better than going it alone.
 *
 *     Note what is NOT checked any more: `zone` labels used to have to agree
 *     with the geometry, back when the badge sat mid-screen and split it into a
 *     struggle half and a relief half. The badge now precedes both, so `zone` is
 *     authoring metadata about intent, not a position, and validating it against
 *     x-coordinates would fail every screen for being correct.
 *
 *  3. PHYSICS-AWARE — using the SAME headless Player + collision code the game
 *     runs (`src/world/Player`, `moveAndCollide`) and the real tuning numbers,
 *     we breadth-first search the reachable state space from the spawn:
 *       · the exit / win trigger must be reachable (screen is completable);
 *       · the badge must be reachable — proved against the BOTTOM of its float,
 *         which is the easiest phase to intercept and therefore the honest test
 *         of "can this be taken at all". The structural pass proves the opposite
 *         bound (that same bottom clears a standing player), so together they say
 *         the badge is jumpable and not walkable.
 *
 *     There used to be a fourth rule here: on a PLACE_TILE screen the exit had to
 *     be reachable ONLY with the bridge that badge laid. Setup Delays was the one
 *     screen it applied to, and its pit has been replaced by the DENIED stamps,
 *     so no badge places geometry any more and the rule had nothing to guard.
 *
 *     The search ignores hazards, which is exactly the "no setbacks" assist;
 *     slow mode only rescales time and cannot change geometry, so a reachable
 *     route here is also reachable with the assists on.
 */
import { RESOLUTION, PLAYER, LOOP, JOURNEY, POWERUPS, HAZARDS } from '../src/data/tuning.config';
import {
  SCREENS,
  TOTAL_MONTHS_BASE,
  type LiftSpec,
  type ScreenData,
  GRID,
} from '../src/data/levels';
import { CAPABILITIES } from '../src/data/copy';
import { Player } from '../src/world/Player';
import { aabbOverlap, type AABB } from '../src/world/Physics';
import { badgeLowestBox } from '../src/world/badgeFloat';
import { isPerched, perchBox } from '../src/world/badgePerch';
import {
  dropColumnsOf,
  dropLandsAt,
  dropRestBox,
  isAirdropped,
} from '../src/world/badgeDrop';
import {
  ceilingLandsAt,
  ceilingRestBox,
  isCeilingDrop,
} from '../src/world/badgeCeiling';
import { makeInput } from '../src/core/Input';

type Problem = { screen: number | 'model'; message: string };

const T = RESOLUTION.TILE;
const DT = LOOP.FIXED_DT;
const { WIDTH, HEIGHT } = RESOLUTION;

const HAZARD_FIELDS: Record<string, keyof ScreenData> = {
  stamps: 'stamps',
  // Exactly one dragon is authored, but it is registered as a list like every other
  // family so this rule stays "one non-empty hazard array per screen".
  dragon: 'dragons',
  // The maze family is authored as `monsters` + `tollGates` + `gather`. Only the
  // monsters are registered here: `tollGates` is part of the same family, so
  // listing it too would trip the "multiple hazard families" rule on the one
  // screen that legitimately has both.
  maze: 'monsters',
  // The Workplace family is authored as `mummies` + `terminal`. Only the figures
  // are registered: the terminal is not an obstacle, it is where the fix happens.
  workplace: 'mummies',
};

// --- structural checks ------------------------------------------------------

function validateStructure(s: ScreenData): Problem[] {
  const problems: Problem[] = [];
  const push = (message: string) => problems.push({ screen: s.id, message });

  if (!s.solids || s.solids.length === 0) push('has no solids (needs ground)');
  if (!s.spawn) push('missing spawn');
  if (s.type !== 'finale' && !s.exit) push('non-finale screen missing exit');
  if (s.type === 'finale' && !s.winTrigger) push('finale missing winTrigger');
  if (s.spawn && s.spawn.gx > 4) push(`spawn gx=${s.spawn.gx} is not far-left`);

  if (typeof s.monthsBase !== 'number' || s.monthsBase < 0) {
    push(`monthsBase must be a non-negative number (got ${String(s.monthsBase)})`);
  }

  const present = Object.entries(HAZARD_FIELDS).filter(([, field]) => {
    const v = s[field] as unknown[] | undefined;
    return Array.isArray(v) && v.length > 0;
  });
  if (present.length > 1) {
    push(`multiple hazard families present: ${present.map(([k]) => k).join(', ')}`);
  }
  if (s.hazard !== 'none' && present.length === 0) {
    push(`declares hazard "${s.hazard}" but has no hazard data`);
  }
  /*
   * Every screen that has an obstacle on it must carry a badge — that is the
   * argument the game makes, and a hazard screen without one is a stage the player
   * is asked to survive with no answer offered.
   *
   * A screen with NO obstacle may omit it, and Reception now does (owner call).
   * The rule used to be "all six carry the mark", which is what put a badge with a
   * deliberately unassigned effect on the tutorial screen: the first ANSR mark a
   * player ever saw taught them that taking one does nothing, one screen before
   * the one that saves them. The Tech Park keeps its `SAFE_PASSAGE` mark because
   * the arrival is the payoff, not a lesson.
   */
  if (!s.badge && s.hazard !== 'none') {
    push(`screen "${s.name}" has obstacles but no badge`);
  }

  const inBounds = (gx: number, gy: number) =>
    gx >= 0 && gx <= GRID.cols && gy >= 0 && gy <= GRID.rows;
  if (s.badge && !inBounds(s.badge.gx, s.badge.gy)) {
    push(`badge out of bounds at (${s.badge.gx},${s.badge.gy})`);
  }
  /*
   * An AIR-DROPPED badge (Hire Under Fire) answers a different set of questions from
   * a levitating one, so it gets its own rules and skips the float band's entirely.
   *
   * The float rules exist to prove the badge is *jumpable and not walkable*. A dropped
   * badge answers that differently — it comes to rest on a floating brick, so it is
   * jumpable by construction and the interesting questions are geometric: every drop
   * has to sit *on top of* something rather than inside it, and (below, in the physics
   * pass) has to be reachable, and reachable *in time*.
   */
  /*
   * A PERCHED badge (the Compliance maze) is the third delivery model and it answers
   * the float band's question by construction: it stands on the top course of a brick
   * wall, so "jumpable, not walkable" is a statement about the wall's height. Two
   * things to prove, and they are the drop's two rules with the clock taken out — it
   * rests on top of something rather than inside it, and it is out of a standing
   * player's reach. Reachability is proved in the physics pass below.
   */
  /*
   * A CEILING-DROPPED badge (the Workplace) is the fourth model, and geometrically it
   * asks the perch's questions with a clock added — so it is checked by the same block.
   * It rests on the top of the floating overhead cabinet, that cabinet has to float, and
   * the rest box has to be out of a standing player's reach. The clock's own question
   * ("is the first drop makeable from the spawn?") is `validateCeilingTiming` below.
   */
  if (s.badge && (isPerched(s.badge) || isCeilingDrop(s.badge))) {
    const perched = isPerched(s.badge);
    const kind = perched ? 'perched' : 'ceiling-dropped';
    const box = perched ? perchBox(s.badge) : ceilingRestBox(s.badge);
    const solids = screenSolids(s);
    for (const solid of solids) {
      if (aabbOverlap(box, solid)) {
        push(
          `${kind} badge at gx=${s.badge.gx} is inside a solid ` +
            `(${solid.x / T},${solid.y / T}) — it has to stand on top of one`,
        );
      }
    }
    const wall = solids.find(
      (solid) =>
        Math.abs(solid.y - (box.y + box.h)) < 1 &&
        solid.x < box.x + box.w &&
        solid.x + solid.w > box.x,
    );
    if (!wall) {
      push(
        `${kind} badge at gx=${s.badge.gx} has nothing under it ` +
          `(rest bottom y=${box.y + box.h}) — it needs the structure it stands on`,
      );
    }
    const standingHead = 15 * GRID.tile - PLAYER.HEIGHT;
    /*
     * And that structure has to FLOAT: there must be walkable air under it (owner call).
     *
     * This is the rule the first cut of the perch broke. Standing on the floor, the
     * structure was a hurdle across the only corridor, so every player cleared it and
     * every player collected the mark on the way past — a badge that is on the path is a
     * badge nobody decides to take, and the whole model rests on the player *choosing*
     * ANSR. Floating, the same jump is a detour: walk under it and you keep the months.
     */
    if (wall && wall.y + wall.h > standingHead) {
      push(
        `the ${kind} badge's structure at (${wall.x / T},${wall.y / T}) reaches the floor (bottom ` +
          `y=${wall.y + wall.h} vs a standing head at ${standingHead}) — it has to float, or ` +
          'the badge is on the path and taking it stops being the player\'s decision',
      );
    }
    if (box.y + box.h > standingHead) {
      push(
        `${kind} badge sits within a standing player (bottom y=${box.y + box.h} vs head ` +
          `y=${standingHead}) — what it stands on has to be taller than the hero`,
      );
    }
  }
  if (s.badge && isAirdropped(s.badge)) {
    const cols = dropColumnsOf(s.badge);
    if (cols.length === 0) push('airdropped badge has no drop columns');
    const solids = screenSolids(s);
    for (const gx of cols) {
      if (!inBounds(gx, s.badge.gy)) push(`badge drop column gx=${gx} is out of bounds`);
      const rest = dropRestBox(s.badge, cols.indexOf(gx));
      for (const solid of solids) {
        if (aabbOverlap(rest, solid)) {
          push(
            `badge drop at gx=${gx} lands inside a solid (${solid.x / T},${solid.y / T}) — ` +
              'a dropped badge has to come to rest on top of something, not inside it',
          );
        }
      }
      // …and it has to come to rest on something. A drop with nothing under it is a
      // badge hanging in mid-air, which is a different mechanic on a screen that
      // deliberately does not have one.
      const supported = solids.some(
        (solid) =>
          Math.abs(solid.y - (rest.y + rest.h)) < 1 &&
          solid.x < rest.x + rest.w &&
          solid.x + solid.w > rest.x,
      );
      if (!supported) {
        push(
          `badge drop at gx=${gx} has nothing under it (rest bottom y=${rest.y + rest.h}) — ` +
            'every drop column needs its floating brick, or the ground band under it',
        );
      }
    }
  } else if (s.badge && !isPerched(s.badge) && !isCeilingDrop(s.badge)) {
    // The badge floats, so its band must stay inside the frame too — an anchor that
    // is technically in bounds can still swing the pickup off the top of the screen.
    const box = badgeLowestBox(s.badge);
    const topY = box.y - 2 * POWERUPS.FLOAT_AMPLITUDE;
    if (topY < 0) push(`badge float rises above the frame (top y=${Math.round(topY)})`);
    if (box.y + box.h > HEIGHT) {
      push(`badge float sinks below the frame (bottom y=${Math.round(box.y + box.h)})`);
    }
    // …and the bottom of the swing must stay clear of a standing player. Taking
    // the badge is a timed jump (owner call); an anchor that dips into the
    // standing box turns it back into a walk-through, which is the thing the
    // raised band exists to prevent. The physics-aware pass below still proves it
    // is reachable, so the two rules together mean "jumpable, not walkable".
    const standingHead = 15 * GRID.tile - PLAYER.HEIGHT;
    if (box.y + box.h > standingHead) {
      push(
        `badge float dips into a standing player (bottom y=${Math.round(box.y + box.h)} vs head ` +
          `y=${standingHead}) — it would be collected by walking past`,
      );
    }
  }
  return problems;
}

// --- narrative checks -------------------------------------------------------

/** Every hazard instance's grid column, with its declared zone (if any). */
function hazardInstances(s: ScreenData): { gx: number; zone?: string }[] {
  if (s.hazard === 'stamps') return (s.stamps ?? []).map((p) => ({ gx: p.gx, zone: p.zone }));
  if (s.hazard === 'dragon') {
    // Same rule as a monster's corridor and the Workplace figure's walk: the roam
    // STARTS at `from`, so that is the column the badge has to precede. It is what
    // proves the opening of the screen belongs to the player — the badge is at gx 4
    // and the dragon cannot reach it, which is half of the guaranteed safe beat
    // (the roar timer is the other half).
    return (s.dragons ?? []).map((d) => ({ gx: d.from, zone: d.zone }));
  }
  if (s.hazard === 'maze') {
    // A monster's corridor STARTS at `from`, so that is the column the badge has
    // to precede — a monster whose corridor begins before the badge could meet
    // the player on the way to it.
    return (s.monsters ?? []).map((m) => ({ gx: m.from, zone: m.zone }));
  }
  if (s.hazard === 'workplace') {
    // Same rule as a monster's corridor: the figure's walk STARTS at `from`, so
    // that is the column the badge has to precede. It is also what proves the
    // partition wall is doing its job — the player must never share the corridor
    // with him on the way to the badge.
    return (s.mummies ?? []).map((m) => ({ gx: m.from, zone: m.zone }));
  }
  return [];
}

/**
 * The structure that makes each level an argument.
 *
 * The badge has to be *takeable before the problem*: that is the one instruction
 * the game gives ("take the ANSR badge and you clear the hurdles safely"), and it
 * is a lie if the first obstacle stands between the spawn and the badge. And
 * every obstacle must sit beyond the badge, otherwise taking it demonstrates
 * nothing and the screen is back to being decoration.
 *
 * This replaced a rule requiring obstacles on BOTH sides of a mid-screen badge.
 * That layout has gone: the badge is now the first thing on the path.
 */
function validateNarrative(s: ScreenData): Problem[] {
  const problems: Problem[] = [];
  const push = (message: string) => problems.push({ screen: s.id, message });
  if (s.hazard === 'none' || !s.badge) return problems;

  /*
   * The column(s) the badge can actually be taken from. For a rail badge that is its
   * anchor; for an air-dropped one it is **every** authored drop column, because a
   * drop behind the obstacle would be a badge you can only take after the thing it
   * answers — which is the rule this function exists to enforce, and the one thing a
   * multi-column delivery could quietly break.
   */
  const badgeGx = s.badge.gx;
  const columns = isAirdropped(s.badge) ? [...dropColumnsOf(s.badge), badgeGx] : [badgeGx];
  const lastColumn = Math.max(...columns);
  const instances = hazardInstances(s);
  const before = instances.filter((i) => i.gx <= lastColumn);
  const after = instances.filter((i) => i.gx > lastColumn);

  for (const i of before) {
    push(
      `hazard at gx=${i.gx} sits at or before the badge (gx=${lastColumn}) — the badge ` +
        'must be reachable before the first obstacle is met',
    );
  }
  if (after.length === 0) {
    push('no hazard after the badge — taking the badge demonstrates nothing');
  }
  return problems;
}

/** Run-wide checks on the month model and the capability set. */
function validateModel(): Problem[] {
  const problems: Problem[] = [];
  const push = (message: string) => problems.push({ screen: 'model', message });

  if (TOTAL_MONTHS_BASE !== JOURNEY.ANSR_BENCHMARK_MONTHS) {
    push(
      `screen monthsBase sums to ${TOTAL_MONTHS_BASE} but the ANSR benchmark is ` +
        `${JOURNEY.ANSR_BENCHMARK_MONTHS} — a flawless run must land exactly on the benchmark`,
    );
  }
  if (JOURNEY.MAX_MONTHS >= JOURNEY.BASELINE_MONTHS) {
    push(
      `MAX_MONTHS (${JOURNEY.MAX_MONTHS}) must stay below BASELINE_MONTHS ` +
        `(${JOURNEY.BASELINE_MONTHS}) so leaning on ANSR always beats going alone`,
    );
  }
  const saved = CAPABILITIES.reduce((sum, c) => sum + c.monthsSaved, 0);
  const gap = JOURNEY.BASELINE_MONTHS - JOURNEY.ANSR_BENCHMARK_MONTHS;
  if (saved !== gap) {
    push(`capability monthsSaved sums to ${saved} but the baseline gap is ${gap}`);
  }

  /*
   * Each capability must be earned exactly once across the run, and there is no longer
   * any exception to that. `SAFE_PASSAGE` used to be one: a badge with no capability
   * behind it, allowed to repeat, and banned from any screen with an obstacle on it.
   * The owner has deleted both of its holders — Reception's, then the Tech Park's — so
   * the type is gone and with it three rules that only existed to fence it off.
   *
   * What is left is stronger than what it replaced: **every badge in the game maps to a
   * capability**, so the "appears exactly once" loop below is now a complete account of
   * the badges on the six screens rather than a check with a hole in it.
   */
  const badges = SCREENS.filter((s) => s.badge).map((s) => s.badge!.type);
  for (const cap of CAPABILITIES) {
    const count = badges.filter((b) => b === cap.badge).length;
    if (count !== 1) {
      push(`capability ${cap.product} (${cap.badge}) appears on ${count} screens, expected 1`);
    }
  }
  const known = new Set<string>(CAPABILITIES.map((c) => c.badge));
  for (const b of badges) {
    if (!known.has(b)) {
      push(`badge type ${b} has no entry in CAPABILITIES (no product name to show)`);
    }
  }
  /*
   * The "a badge on a screen with obstacles must not be the no-effect one" check used to
   * live here. There is no no-effect badge left, so the check has nothing to fail on —
   * and the `known` set above now says the same thing more strongly: a badge type with
   * no capability behind it fails the build wherever it is authored, obstacles or not.
   */
  return problems;
}

// --- geometry helpers -------------------------------------------------------

/**
 * A moving plate's box at one end of its travel. `where` is 'park' or 'travel'.
 *
 * The plates are deliberately absent from `solids` (the hazard owns the live box), so
 * every check about them has to reconstruct the two ends from level data — which is
 * exactly what the hazard does with the same two numbers.
 */
function plateBox(spec: LiftSpec, where: 'park' | 'travel'): AABB {
  const y = (where === 'park' ? spec.gy : spec.toGy) * T;
  return { x: spec.gx * T, y, w: spec.w * T, h: HAZARDS.MAZE.LIFT_H };
}

/** The box a player standing on that plate would occupy, for the reachability flood. */
function onPlateBox(spec: LiftSpec, where: 'park' | 'travel'): AABB {
  const plate = plateBox(spec, where);
  return { x: plate.x, y: plate.y - PLAYER.HEIGHT, w: plate.w, h: PLAYER.HEIGHT };
}

/**
 * A RISING plate may not park where it takes the headroom off the ground underneath it.
 *
 * This is the trap this screen's re-cut nearly shipped, and nothing else would have
 * caught it: the plate is not a solid in `levels.json`, so the reachability flood below
 * never sees it, and a hoist parked one row too low turns the tread beneath it into a
 * dead end — the player can still walk under the plate but can no longer hop up off
 * that tread, and the only route up the maze is sealed. 84px is the same figure the
 * whole level obeys (a 44px player has to jump 40px to make the next tread).
 *
 * Only rising plates are checked. The lift descends *into* the ground band on purpose,
 * so the same rule applied to it would fail for being correct.
 */
function validatePlates(s: ScreenData): Problem[] {
  const problems: Problem[] = [];
  const plates: [string, LiftSpec][] = [];
  if (s.lift) plates.push(['lift', s.lift]);
  if (s.hoist) plates.push(['hoist', s.hoist]);
  for (const [name, spec] of plates) {
    if (spec.toGy >= spec.gy) continue; // descends — see above
    const parked = plateBox(spec, 'park');
    const under = parked.y + parked.h;
    for (const solid of screenSolids(s)) {
      if (solid.x >= parked.x + parked.w || solid.x + solid.w <= parked.x) continue;
      if (solid.y < under) continue; // above or level with the plate
      const headroom = solid.y - under;
      if (headroom < 84) {
        problems.push({
          screen: s.id,
          message:
            `${name} parks ${Math.round(headroom)}px over the surface at ` +
            `(${solid.x / T},${solid.y / T}) — a rising plate needs 84px of headroom ` +
            'under it or the surface beneath it stops being jumpable',
        });
      }
    }
    // And its travel must stay inside the frame.
    const top = plateBox(spec, 'travel');
    if (top.y < 0) {
      problems.push({ screen: s.id, message: `${name} travels above the frame (y=${top.y})` });
    }
  }
  return problems;
}

/** Static, collidable solids in pixels (decorative facades are skipped). */
function screenSolids(s: ScreenData): AABB[] {
  const out: AABB[] = [];
  for (const r of s.solids) {
    if (r.role && r.role.includes('noncollide')) continue;
    out.push({ x: r.gx * T, y: r.gy * T, w: r.w * T, h: r.h * T });
  }
  return out;
}

/**
 * The badge hitbox at the bottom of its float — the easiest phase to intercept.
 *
 * Reachability has to be proved against *some* phase, and the lowest one is the
 * honest choice: if the player cannot touch the badge there, they cannot touch it
 * at all. (The old static box was simply the anchor cell.)
 */
function badgeBox(s: ScreenData): AABB | null {
  if (!s.badge) return null;
  // A perch does not float, so the "easiest phase" is the only phase — and a ceiling
  // drop has exactly one place it can ever be taken from, which is where it lands.
  if (isPerched(s.badge)) return perchBox(s.badge);
  if (isCeilingDrop(s.badge)) return ceilingRestBox(s.badge);
  return badgeLowestBox(s.badge);
}

/**
 * Air-drop fairness: is the FIRST delivery makeable from the spawn?
 *
 * The badge expires, so "reachable" is not enough — it has to be reachable inside the
 * window. Walking from the spawn to the first drop column at `WALK_SPEED` must finish
 * with time to spare before the badge is gone, or the screen opens by taking the
 * capability away from a player who did nothing wrong. Measured, not felt: this is the
 * same class of gate as the badge's one-tap jump window.
 */
function validateAirdropTiming(s: ScreenData): Problem[] {
  const problems: Problem[] = [];
  if (!s.badge || !isAirdropped(s.badge)) return problems;
  const cols = dropColumnsOf(s.badge);
  if (cols.length === 0) return problems;

  const spawnX = s.spawn.gx * T;
  const firstX = cols[0]! * T + T / 2;
  const walk = Math.abs(firstX - spawnX) / PLAYER.WALK_SPEED;
  const gone = dropLandsAt(s.badge, 0) + POWERUPS.DROP.LIFETIME;
  const margin = gone - walk;
  if (margin < 1) {
    problems.push({
      screen: s.id,
      message:
        `first air-drop at gx=${cols[0]} expires ${gone.toFixed(2)}s in but takes ` +
        `${walk.toFixed(2)}s to walk to from spawn — only ${margin.toFixed(2)}s of slack`,
    });
  }
  return problems;
}

/**
 * Ceiling-drop fairness: is the FIRST drop makeable from the spawn?
 *
 * Same class of gate as the air-drop's, and the same reasoning — the mark expires, so
 * "reachable" is not enough, it has to be reachable inside the window. The difference is
 * which way the slack runs: this delivery *waits* before it falls, so the walk is
 * comfortably inside the hold and what has to be checked is that the hold has not been
 * tuned shorter than the walk. A player who runs straight at the column and arrives after
 * the mark has already been and gone would be a screen that opens by taking the
 * capability away from somebody who did nothing wrong.
 */
function validateCeilingTiming(s: ScreenData): Problem[] {
  const problems: Problem[] = [];
  if (!s.badge || !isCeilingDrop(s.badge)) return problems;
  const spawnX = s.spawn.gx * T;
  const restX = s.badge.gx * T + T / 2;
  const walk = Math.abs(restX - spawnX) / PLAYER.WALK_SPEED;
  const gone = ceilingLandsAt(0) + POWERUPS.CEILING.LIFETIME;
  const margin = gone - walk;
  if (margin < 1) {
    problems.push({
      screen: s.id,
      message:
        `the first ceiling drop at gx=${s.badge.gx} expires ${gone.toFixed(2)}s in but takes ` +
        `${walk.toFixed(2)}s to walk to from spawn — only ${margin.toFixed(2)}s of slack`,
    });
  }
  // …and the mark has to be *up there* before it is down here: a hold shorter than the
  // fall would mean the pickup never has a beat in the fitting, which is the whole point
  // of this delivery (owner call: it is visible before it is takeable).
  if (POWERUPS.CEILING.HOLD < POWERUPS.CEILING.FALL_TIME) {
    problems.push({
      screen: s.id,
      message: 'POWERUPS.CEILING.HOLD is shorter than FALL_TIME — the mark never waits in the light',
    });
  }
  return problems;
}

// --- physics-aware reachability search -------------------------------------

interface PState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
}

const SUBSTEPS = 5; // physics steps per macro-action (~0.083s)
const STATE_CAP = 300_000;

function stateKey(s: PState): string {
  const qx = Math.round(s.x / 8);
  const qy = Math.round(s.y / 8);
  const vyb = Math.max(-8, Math.min(8, Math.round(s.vy / 120)));
  return `${qx},${qy},${Math.sign(s.vx)},${vyb},${s.onGround ? 1 : 0}`;
}

/** Simulate one macro-action with the real Player physics. Null = fell out. */
function simulateMacro(st: PState, dir: -1 | 0 | 1, jump: boolean, solids: AABB[]): PState | null {
  const p = new Player(st.x, st.y);
  p.box.x = st.x;
  p.box.y = st.y;
  p.vx = st.vx;
  p.vy = st.vy;
  p.onGround = st.onGround;
  for (let i = 0; i < SUBSTEPS; i += 1) {
    const input = makeInput({
      left: dir < 0,
      right: dir > 0,
      jumpPressed: jump && i === 0,
      jumpHeld: jump,
    });
    p.update(DT, input, solids, 1);
    if (p.box.y > HEIGHT + 80) return null; // fell out of the world
  }
  return { x: p.box.x, y: p.box.y, vx: p.vx, vy: p.vy, onGround: p.onGround };
}

/**
 * Flood the reachable state space from the spawn. `onVisit` is called for every
 * dequeued state; return `true` from it to stop early (goal proven).
 * Returns true if `onVisit` stopped the search, false if it exhausted or capped.
 */
function flood(solids: AABB[], spawn: { x: number; y: number }, onVisit: (box: AABB) => boolean): boolean {
  const start: PState = { x: spawn.x, y: spawn.y, vx: 0, vy: 0, onGround: false };
  const queue: PState[] = [start];
  const seen = new Set<string>([stateKey(start)]);
  let head = 0;
  let count = 0;
  const box: AABB = { x: 0, y: 0, w: PLAYER.WIDTH, h: PLAYER.HEIGHT };

  while (head < queue.length) {
    const st = queue[head++]!;
    box.x = st.x;
    box.y = st.y;
    if (onVisit(box)) return true;
    if (++count > STATE_CAP) return false;
    for (const dir of [-1, 0, 1] as const) {
      for (const jump of [false, true]) {
        if (st.x < -T || st.x > WIDTH + T) continue;
        const ns = simulateMacro(st, dir, jump, solids);
        if (!ns) continue;
        const k = stateKey(ns);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push(ns);
      }
    }
  }
  return false;
}

function validatePhysics(s: ScreenData): Problem[] {
  const problems: Problem[] = [];
  const push = (message: string) => problems.push({ screen: s.id, message });

  const spawn = { x: s.spawn.gx * T, y: s.spawn.gy * T - PLAYER.HEIGHT };
  const targetX = s.exit ? s.exit.gx * T : s.winTrigger ? s.winTrigger.gx * T : undefined;
  if (targetX === undefined) return problems; // structural layer already flagged this

  const base = screenSolids(s);
  const reachesTarget = (solids: AABB[], from = spawn) =>
    flood(solids, from, (box) => box.x + box.w >= targetX);

  /*
   * A RISING plate is part of the route, and it is not in `solids`, so the flood has to
   * be told about it — in two halves, because the plate is only ever in one place at a
   * time and pretending it is in both would prove a jump nobody can make.
   *
   *   1. with the plate PARKED: can the player get onto it at all?
   *   2. starting from on top of the plate at the far end of its travel: does the route
   *      continue from there?
   *
   * That is the honest reading of "board it, ride it, walk off the top", and it is the
   * same shape as proving a floating badge against the bottom of its band: pick the one
   * position each question is actually asked at.
   */
  const hoist = s.hoist && s.hoist.toGy < s.hoist.gy ? s.hoist : null;
  if (hoist) {
    const parked = onPlateBox(hoist, 'park');
    if (!flood(base.concat(plateBox(hoist, 'park')), spawn, (box) => aabbOverlap(box, parked))) {
      push(`the hoist parked at gy=${hoist.gy} cannot be boarded from spawn`);
    }
    const top = plateBox(hoist, 'travel');
    const rider = { x: top.x + T, y: top.y - PLAYER.HEIGHT };
    if (!reachesTarget(base.concat(top), rider)) {
      push(
        `riding the hoist to gy=${hoist.toGy} does not lead anywhere — the exit is not ` +
          'reachable from the top of its travel',
      );
    }
  }

  // Badge reachability. On a rail screen that is the bottom of the float; on the
  // air-drop screen it is every authored resting place, because a drop the player
  // cannot walk to is a delivery that never happened.
  if (s.badge && isAirdropped(s.badge)) {
    const cols = dropColumnsOf(s.badge);
    cols.forEach((gx, i) => {
      const rest = dropRestBox(s.badge!, i);
      if (!flood(base, spawn, (box) => aabbOverlap(box, rest))) {
        push(`badge drop at gx=${gx} is not reachable from spawn`);
      }
    });
  } else {
    const badge = badgeBox(s);
    if (badge) {
      const found = flood(base, spawn, (box) => aabbOverlap(box, badge));
      if (!found) {
        push(
          s.badge && isPerched(s.badge)
            ? `perched badge at (${s.badge.gx},${s.badge.restGy ?? s.badge.gy}) is not ` +
                'reachable from spawn — the wall it stands on cannot be jumped onto'
            : `badge anchored at (${s.badge!.gx},${s.badge!.gy}) is not reachable from spawn ` +
                'even at the bottom of its float',
        );
      }
    }
  }

  /*
   * Completability. On a screen with a rising plate the two floods above ARE this
   * check — the plate is the route, and a flood over static solids alone would report
   * the Compliance maze as impossible for the same reason a flood that ignored the
   * clearance lift would once have reported the far bay as unreachable (it does not,
   * because a fall gets you there; the hoist has no such second way).
   */
  if (!hoist && !reachesTarget(base)) {
    push('exit / win trigger is not reachable from spawn (screen not completable)');
  }

  return problems;
}

// --- entrypoint -------------------------------------------------------------

function main(): void {
  const problems: Problem[] = [];

  if (SCREENS.length === 0) {
    console.error('✗ levels.json has no screens');
    process.exit(1);
  }

  problems.push(...validateModel());
  for (const s of SCREENS) {
    problems.push(...validateStructure(s));
    problems.push(...validatePlates(s));
    problems.push(...validateNarrative(s));
    problems.push(...validateAirdropTiming(s));
    problems.push(...validateCeilingTiming(s));
    problems.push(...validatePhysics(s));
  }

  if (problems.length > 0) {
    console.error(`✗ Level validation failed (${problems.length} problem(s)):`);
    for (const p of problems) console.error(`  · ${p.screen}: ${p.message}`);
    process.exit(1);
  }

  console.log(
    `✓ Level validation passed for ${SCREENS.length} screens ` +
      `(structural + badge-first narrative + month model + physics-aware completability).`,
  );
}

main();
