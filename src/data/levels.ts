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

export type HazardKind = 'none' | 'stamps' | 'fire' | 'gates' | 'spikes';

/**
 * ANSR capability each badge grants. Four structurally different verbs, one per
 * real service line — never one reskinned shield.
 *
 *  - `PLACE_TILE`  SET UP  1Wrk slows the DENIED stamps to a walk-through pace
 *                          and shields you, so a stamp cannot press you at all
 *  - `EXTINGUISH`  STAFF   Talent500 puts out the hiring lanes ahead of you
 *  - `CLEAR_PATH`  CLEAR   GCC-BOT lifts the approval barriers ahead
 *  - `FORESIGHT`   KNOW    500Leaders give long warning + a marked safe line
 *
 * `SAFE_PASSAGE` is the non-capability badge carried by the two screens with no
 * obstacle to answer (Reception and the Tech Park). It exists so the ANSR mark
 * appears on every screen; its effect is deliberately unassigned, and it is
 * excluded from the capability receipt.
 */
export type BadgeType =
  | 'PLACE_TILE'
  | 'EXTINGUISH'
  | 'CLEAR_PATH'
  | 'FORESIGHT'
  | 'SAFE_PASSAGE';

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
  role?: string;
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

export interface FireLane {
  gx: number;
  phaseIndex: number;
  zone?: Zone;
}

export interface SpikeColumn {
  gx: number;
  phaseIndex: number;
  zone?: Zone;
}

/** A swaying approval barrier (Compliance). */
export interface Gate {
  gx: number;
  gy: number;
  axis: 'x' | 'y';
  phase: number;
  zone?: Zone;
}

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
  /** Anchor row. The badge floats vertically around this — see `badgeCenter`. */
  gy: number;
  note?: string;
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
  fireLanes?: FireLane[];
  spikeColumns?: SpikeColumn[];
  gates?: Gate[];
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
