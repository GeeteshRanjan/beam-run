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
 *       · every hazard screen puts hazard instances on BOTH sides of its badge,
 *         so each level plays as a before/after of the same problem;
 *       · declared `zone` labels agree with the geometry;
 *       · each of the four ANSR capabilities appears exactly once;
 *       · the month model adds up — screen bases sum to the ANSR benchmark, the
 *         capability savings sum to the full gap, and the cap keeps every run
 *         strictly better than going it alone.
 *
 *  3. PHYSICS-AWARE — using the SAME headless Player + collision code the game
 *     runs (`src/world/Player`, `moveAndCollide`) and the real tuning numbers,
 *     we breadth-first search the reachable state space from the spawn:
 *       · the exit / win trigger must be reachable (screen is completable);
 *       · the badge must be reachable;
 *       · for a PLACE_TILE screen the exit must be reachable ONLY once the
 *         placed bridge is added (proving ANSR is the real solve);
 *       · no quick-win pickup may sit inside a hazard's lethal region.
 *
 *     The search ignores hazards, which is exactly the "no setbacks" assist;
 *     slow mode only rescales time and cannot change geometry, so a reachable
 *     route here is also reachable with the assists on.
 */
import { RESOLUTION, PLAYER, LOOP, HAZARDS, JOURNEY } from '../src/data/tuning.config';
import { SCREENS, TOTAL_MONTHS_BASE, type ScreenData, GRID } from '../src/data/levels';
import { CAPABILITIES } from '../src/data/copy';
import { Player } from '../src/world/Player';
import { aabbOverlap, type AABB } from '../src/world/Physics';
import { makeInput } from '../src/core/Input';

type Problem = { screen: number | 'model'; message: string };

const T = RESOLUTION.TILE;
const DT = LOOP.FIXED_DT;
const { WIDTH, HEIGHT } = RESOLUTION;

const HAZARD_FIELDS: Record<string, keyof ScreenData> = {
  quicksand: 'quicksand',
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
  if (s.hazard !== 'none' && !s.badge) push(`hazard screen "${s.name}" has no badge`);

  const inBounds = (gx: number, gy: number) =>
    gx >= 0 && gx <= GRID.cols && gy >= 0 && gy <= GRID.rows;
  for (const p of s.points ?? []) {
    if (!inBounds(p.gx, p.gy)) push(`quick win out of bounds at (${p.gx},${p.gy})`);
  }
  if (s.badge && !inBounds(s.badge.gx, s.badge.gy)) {
    push(`badge out of bounds at (${s.badge.gx},${s.badge.gy})`);
  }
  return problems;
}

// --- narrative checks -------------------------------------------------------

/** Every hazard instance's grid column, with its declared zone (if any). */
function hazardInstances(s: ScreenData): { gx: number; zone?: string }[] {
  if (s.hazard === 'quicksand') return (s.quicksand ?? []).map((q) => ({ gx: q.gx, zone: q.zone }));
  if (s.hazard === 'fire') return (s.fireLanes ?? []).map((l) => ({ gx: l.gx, zone: l.zone }));
  if (s.hazard === 'gates') return (s.gates ?? []).map((g) => ({ gx: g.gx, zone: g.zone }));
  if (s.hazard === 'spikes') return (s.spikeColumns ?? []).map((c) => ({ gx: c.gx, zone: c.zone }));
  return [];
}

/**
 * The structure that makes each level an argument: the same problem before and
 * after ANSR. Without hazards on both sides of the badge there is no contrast to
 * feel, and the screen goes back to being decoration.
 */
function validateNarrative(s: ScreenData): Problem[] {
  const problems: Problem[] = [];
  const push = (message: string) => problems.push({ screen: s.id, message });
  if (s.hazard === 'none' || !s.badge) return problems;

  const badgeGx = s.badge.gx;
  const instances = hazardInstances(s);
  const before = instances.filter((i) => i.gx < badgeGx);
  const after = instances.filter((i) => i.gx > badgeGx);

  if (before.length === 0) {
    push('no hazard before the badge — the player never feels the problem first');
  }
  if (after.length === 0) {
    push('no hazard after the badge — the ANSR relief is never demonstrated');
  }
  for (const i of instances) {
    if (i.zone === 'struggle' && i.gx > badgeGx) {
      push(`hazard at gx=${i.gx} is labelled "struggle" but sits after the badge`);
    }
    if (i.zone === 'relief' && i.gx < badgeGx) {
      push(`hazard at gx=${i.gx} is labelled "relief" but sits before the badge`);
    }
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

  // Each capability must be earned exactly once across the run.
  const badges = SCREENS.filter((s) => s.badge).map((s) => s.badge!.type);
  for (const cap of CAPABILITIES) {
    const count = badges.filter((b) => b === cap.badge).length;
    if (count !== 1) {
      push(`capability ${cap.product} (${cap.badge}) appears on ${count} screens, expected 1`);
    }
  }
  for (const b of badges) {
    if (!CAPABILITIES.some((c) => c.badge === b)) {
      push(`badge type ${b} has no entry in CAPABILITIES (no product name to show)`);
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

/** The bridge a PLACE_TILE badge lays down (or null). */
function bridgeTile(s: ScreenData): AABB | null {
  const b = s.badge;
  if (!b || b.type !== 'PLACE_TILE' || !b.placesTileAt) return null;
  const t = b.placesTileAt;
  return { x: t.gx * T, y: t.gy * T, w: t.w * T, h: t.h * T };
}

function badgeBox(s: ScreenData): AABB | null {
  if (!s.badge) return null;
  return { x: s.badge.gx * T, y: s.badge.gy * T, w: T, h: T };
}

function pointBox(gx: number, gy: number): AABB {
  const cx = gx * T + T / 2;
  const cy = gy * T + T / 2;
  return { x: cx - 12, y: cy - 12, w: 24, h: 24 };
}

/** Maximal (over-time) lethal regions per hazard family, for the pickup check. */
function lethalRegions(s: ScreenData): AABB[] {
  const out: AABB[] = [];
  if (s.hazard === 'quicksand') {
    // Shallow struggle sludge only drags — it never books a delay, so a pickup
    // sitting above it is fine. Deep pits are the lethal ones.
    for (const q of s.quicksand ?? []) {
      if (q.deep === false) continue;
      out.push({ x: q.gx * T, y: q.gy * T, w: q.w * T, h: q.h * T });
    }
  } else if (s.hazard === 'fire') {
    // Flame fills the whole lane column while active.
    for (const l of s.fireLanes ?? []) out.push({ x: l.gx * T, y: 0, w: T, h: HEIGHT });
  } else if (s.hazard === 'spikes') {
    // Spike sweeps the column from the top down to the ground while falling.
    for (const c of s.spikeColumns ?? []) out.push({ x: c.gx * T, y: 0, w: T, h: 15 * T });
  } else if (s.hazard === 'gates') {
    // Swept lateral range of the barrier arm (± amplitude, gate is 26×56).
    const sweep = HAZARDS.GATES.SWAY_AMPLITUDE;
    for (const g of s.gates ?? []) {
      const cx = g.gx * T + T / 2;
      out.push({ x: cx - sweep - 13, y: g.gy * T - 16, w: 2 * (sweep + 13), h: 56 });
    }
  }
  return out;
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

  // Badge reachability (searched over the pre-bridge geometry).
  const badge = badgeBox(s);
  if (badge) {
    const found = flood(base, spawn, (box) => aabbOverlap(box, badge));
    if (!found) push(`badge at (${s.badge!.gx},${s.badge!.gy}) is not reachable from spawn`);
  }

  const bridge = bridgeTile(s);
  if (bridge) {
    // Without the bridge the exit must be UNreachable (ANSR is the real solve);
    // with the bridge it must become reachable.
    if (reachesTarget(base)) {
      push('PLACE_TILE screen is completable without the bridge (ANSR not required)');
    }
    if (!reachesTarget([...base, bridge])) {
      push('PLACE_TILE screen is NOT completable even with the placed bridge');
    }
  } else if (!reachesTarget(base)) {
    push('exit / win trigger is not reachable from spawn (screen not completable)');
  }

  // No quick win may sit in a lethal region.
  const lethal = lethalRegions(s);
  for (const pt of s.points ?? []) {
    const pb = pointBox(pt.gx, pt.gy);
    if (lethal.some((r) => aabbOverlap(pb, r))) {
      push(`quick win at (${pt.gx},${pt.gy}) sits in a lethal ${s.hazard} region`);
    }
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
      `(structural + before/after narrative + month model + physics-aware completability).`,
  );
}

main();
