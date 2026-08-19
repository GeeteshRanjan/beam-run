/**
 * Keep level *authoring* prose out of the shipped bundle.
 *
 * `levels.json` is imported by the engine, so every byte of it ships — including
 * the fields that exist purely to explain the level to the next person reading the
 * file: `meta.notes`, `meta.structure`, `meta.clock`, `meta.conventions`, and the
 * `note` on a screen, a badge or the lift. Nothing renders them; nothing reads
 * them at runtime.
 *
 * They are worth keeping (they are the level designer's brief and the reason a
 * layout is the way it is), so instead of writing shorter notes we drop them at
 * build time. This is the same rule the 404 page's copy follows: prose that only
 * humans read must not be reachable from the bundle. Without it, documenting the
 * compliance maze properly cost ~3 KB gzipped — a third of the remaining budget —
 * which is a bad incentive to put in front of whoever authors the next screen.
 *
 * Dev and tests are untouched: they read the file as authored, notes and all.
 */
import type { Plugin } from 'vite';

interface LevelDoc {
  meta?: Record<string, unknown>;
  screens?: (Record<string, unknown> & {
    note?: unknown;
    meaningTag?: unknown;
    solids?: { role?: string; note?: unknown }[];
    badge?: { note?: unknown };
    lift?: { note?: unknown };
  })[];
}

/** Authoring-only keys on `meta`. Everything else there is real data. */
const META_DOC_KEYS = ['notes', 'structure', 'clock', 'conventions'] as const;

/**
 * Solid `role`s the runtime actually reads, so they must survive the strip:
 * `noncollide` (`world/Screen` skips those rects) and `pedestal` (the renderer draws
 * that solid as the screen's own prop rather than as level material). Every other
 * role is a note to the next author.
 */
const KEPT_SOLID_ROLES = ['noncollide', 'pedestal'] as const;

/**
 * Per-hazard authoring metadata the engine never reads: `zone` (was this written
 * as the felt problem or as the relief?) and `note`. The **validator** reads `zone`,
 * and it runs against the authored file, so stripping them from the bundle costs
 * nothing and keeps the level design vocabulary free to grow.
 *
 * `note` matters here as much as `zone` does. Screens, badges and the lift each had
 * theirs stripped from the day this plugin was written, but a note on a *hazard entry*
 * was not, and the hiring dragon's went straight into every host's bundle — 700
 * characters of design rationale, shipped. Anywhere a human can write prose in
 * `levels.json`, this file has to be able to take it back out.
 */
const HAZARD_ARRAYS = ['monsters', 'stamps', 'dragons', 'mummies'] as const;
/** Authoring-only keys on an entry inside one of those arrays. */
const HAZARD_DOC_KEYS = ['zone', 'note'] as const;

/**
 * Pure: takes the raw JSON text, returns it without the documentation fields.
 * Exported so a test can prove it strips the prose and keeps the geometry.
 */
export function stripLevelNotes(json: string): string {
  const data = JSON.parse(json) as LevelDoc;
  if (data.meta) for (const k of META_DOC_KEYS) delete data.meta[k];
  for (const screen of data.screens ?? []) {
    delete screen.note;
    delete screen.meaningTag;
    if (screen.badge) delete screen.badge.note;
    if (screen.lift) delete screen.lift.note;
    // `role` is documentation too, with two exceptions: `Screen` reads it to skip
    // decorative facades (`noncollide`) and the renderer reads it to paint a
    // `pedestal` as its screen's own prop instead of as level material. A solid may
    // also carry a `note`, which is prose and always goes.
    for (const solid of screen.solids ?? []) {
      delete solid.note;
      if (!KEPT_SOLID_ROLES.some((kept) => solid.role?.includes(kept))) delete solid.role;
    }
    // Of a screen's `copy` block only `titleCard` is read at runtime
    // (`Simulation.screenLabel`); `hint`, `onClear` and `win` are mirrors of the
    // real strings in `data/copy.ts`, kept beside the level for the author's
    // benefit. Two copies of a sentence is already a drift risk — shipping both
    // would be paying for it as well.
    const copy = screen.copy as Record<string, unknown> | undefined;
    if (copy) for (const k of ['hint', 'onClear', 'win']) delete copy[k];
    for (const key of HAZARD_ARRAYS) {
      const list = screen[key];
      if (!Array.isArray(list)) continue;
      for (const item of list as Record<string, unknown>[]) {
        for (const k of HAZARD_DOC_KEYS) delete item[k];
      }
    }
  }
  return JSON.stringify(data);
}

/**
 * Runs `pre`, so it sees the raw JSON text before Vite's own json plugin turns it
 * into a module.
 */
export function stripLevelNotesPlugin(): Plugin {
  return {
    name: 'beam-run:strip-level-notes',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('levels.json')) return null;
      return { code: stripLevelNotes(code), map: null };
    },
  };
}
