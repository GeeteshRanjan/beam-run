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
 *       · EVERY screen carries a badge (the ANSR mark is on all six);
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
import { RESOLUTION, PLAYER, LOOP, JOURNEY, POWERUPS } from '../src/data/tuning.config';
import { SCREENS, TOTAL_MONTHS_BASE, type ScreenData, GRID } from '../src/data/levels';
import { CAPABILITIES } from '../src/data/copy';
import { Player } from '../src/world/Player';
import { aabbOverlap, type AABB } from '../src/world/Physics';
import { badgeLowestBox } from '../src/world/badgeFloat';
import { makeInput } from '../src/core/Input';

type Problem = { screen: number | 'model'; message: string };

const T = RESOLUTION.TILE;
const DT = LOOP.FIXED_DT;
const { WIDTH, HEIGHT } = RESOLUTION;

const HAZARD_FIELDS: Record<string, keyof ScreenData> = {
  stamps: 'stamps',
  fire: 'fireLanes',
  gates: 'gates',
  spikes: 'spikeColumns',
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
  // Every screen, not just the hazard ones: the ANSR mark is on all six.
  if (!s.badge) push(`screen "${s.name}" has no badge`);

  const inBounds = (gx: number, gy: number) =>
    gx >= 0 && gx <= GRID.cols && gy >= 0 && gy <= GRID.rows;
  if (s.badge && !inBounds(s.badge.gx, s.badge.gy)) {
    push(`badge out of bounds at (${s.badge.gx},${s.badge.gy})`);
  }
  // The badge floats, so its band must stay inside the frame too — an anchor that
  // is technically in bounds can still swing the pickup off the top of the screen.
  if (s.badge) {
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
  if (s.hazard === 'fire') return (s.fireLanes ?? []).map((l) => ({ gx: l.gx, zone: l.zone }));
  if (s.hazard === 'gates') return (s.gates ?? []).map((g) => ({ gx: g.gx, zone: g.zone }));
  if (s.hazard === 'spikes') return (s.spikeColumns ?? []).map((c) => ({ gx: c.gx, zone: c.zone }));
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

  const badgeGx = s.badge.gx;
  const instances = hazardInstances(s);
  const before = instances.filter((i) => i.gx <= badgeGx);
  const after = instances.filter((i) => i.gx > badgeGx);

  for (const i of before) {
    push(
      `hazard at gx=${i.gx} sits at or before the badge (gx=${badgeGx}) — the badge ` +
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

  // Each capability must be earned exactly once across the run. `SAFE_PASSAGE`
  // is the deliberate exception: it carries no capability, so it may repeat (it
  // is on Reception and the Tech Park, the two screens with nothing to defend
  // against) and it must never appear on a hazard screen, where the player would
  // take a badge that does nothing.
  const badges = SCREENS.filter((s) => s.badge).map((s) => s.badge!.type);
  for (const cap of CAPABILITIES) {
    const count = badges.filter((b) => b === cap.badge).length;
    if (count !== 1) {
      push(`capability ${cap.product} (${cap.badge}) appears on ${count} screens, expected 1`);
    }
  }
  const known = new Set<string>([...CAPABILITIES.map((c) => c.badge), 'SAFE_PASSAGE']);
  for (const b of badges) {
    if (!known.has(b)) {
      push(`badge type ${b} has no entry in CAPABILITIES (no product name to show)`);
    }
  }
  for (const s of SCREENS) {
    if (s.hazard !== 'none' && s.badge?.type === 'SAFE_PASSAGE') {
      push(`screen ${s.id} has obstacles but carries the no-effect SAFE_PASSAGE badge`);
    }
  }
  return problems;
}

// --- geometry helpers -------------------------------------------------------

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
  return badgeLowestBox(s.badge);
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
  const reachesTarget = (solids: AABB[]) =>
    flood(solids, spawn, (box) => box.x + box.w >= targetX);

  // Badge reachability (searched over the pre-bridge geometry, at the bottom of
  // the badge's float).
  const badge = badgeBox(s);
  if (badge) {
    const found = flood(base, spawn, (box) => aabbOverlap(box, badge));
    if (!found) {
      push(
        `badge anchored at (${s.badge!.gx},${s.badge!.gy}) is not reachable from spawn ` +
          'even at the bottom of its float',
      );
    }
  }

  if (!reachesTarget(base)) {
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
    problems.push(...validateNarrative(s));
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
