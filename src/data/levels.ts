/**
 * Typed accessor for the shipped `levels.json` (single source of truth for all
 * geometry and hazard placement). The engine hardcodes no layouts — everything
 * is read from here. Coordinates are in TILE units unless a field ends in `_px`.
 */
import raw from './levels.json';

export type HazardKind = 'none' | 'quicksand' | 'fire' | 'plants' | 'spikes';
export type BadgeType = 'PLACE_TILE' | 'FIRE_SHIELD' | 'PASS_THROUGH' | 'FREEZE';
export type ScreenType = 'intro' | 'hazard' | 'finale';

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

export interface QuicksandRect {
  gx: number;
  gy: number;
  w: number;
  h: number;
}

export interface FireLane {
  gx: number;
  phaseIndex: number;
}

export interface SpikeColumn {
  gx: number;
  phaseIndex: number;
}

export interface Plant {
  gx: number;
  gy: number;
  axis: 'x' | 'y';
  phase: number;
}

export interface PlacedTileSpec {
  gx: number;
  gy: number;
  w: number;
  h: number;
}

export interface BadgeSpec {
  type: BadgeType;
  gx: number;
  gy: number;
  placesTileAt?: PlacedTileSpec;
  note?: string;
}

export interface ScreenCopy {
  titleCard?: string;
  hint?: string;
  onClear?: string;
  win?: string;
  valuationLabel?: string;
}

export interface ScreenData {
  id: number;
  name: string;
  type: ScreenType;
  hazard: HazardKind;
  meaningTag?: string;
  spawn: GridPos;
  exit?: { gx: number };
  winTrigger?: { gx: number };
  solids: SolidRect[];
  quicksand?: QuicksandRect[];
  fireLanes?: FireLane[];
  spikeColumns?: SpikeColumn[];
  plants?: Plant[];
  badge?: BadgeSpec;
  points?: GridPos[];
  copy?: ScreenCopy;
}

export interface LevelsFile {
  meta: {
    grid: { cols: number; rows: number; tile: number };
    notes?: string;
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
