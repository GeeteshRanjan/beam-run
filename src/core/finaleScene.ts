/**
 * Tech Park finale scene — the one hand-crafted "wow" moment (GDD art spec).
 *
 * This module is the PURE, headless layout for the finale: given the canvas
 * size and the (non-collidable) tower-facade rectangle from the level data, it
 * returns the geometry the renderer paints — layered sky gradient, plaza,
 * glowing glass tower with a window grid, and a bloom focus point. Keeping the
 * layout pure makes it snapshot-testable without a canvas and guarantees the
 * scene is identical at 1× and 2× (all coordinates are in internal px, so the
 * HiDPI transform only scales the final blit — never the composition).
 */
import { RESOLUTION } from '../data/tuning.config';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FinaleLayout {
  /** Vertical sky gradient stops (offset 0..1 → colour). */
  sky: { offset: number; color: string }[];
  plaza: Rect;
  tower: Rect;
  /** Window cells on the tower face (glass grid). */
  windows: Rect[];
  /** Bloom focus (glow) at the crown of the tower. */
  bloom: { x: number; y: number; r: number };
  /** Where the ANSR sunburst mark sits (plaza centre-left). */
  mark: { x: number; y: number; r: number };
  horizonY: number;
}

/** Default tower facade from levels.json screen 5 (gx22,gy8,w8,h7 in tiles). */
const DEFAULT_TOWER: Rect = { x: 22 * RESOLUTION.TILE, y: 8 * RESOLUTION.TILE, w: 8 * RESOLUTION.TILE, h: 7 * RESOLUTION.TILE };

export function finaleLayout(
  width: number = RESOLUTION.WIDTH,
  height: number = RESOLUTION.HEIGHT,
  tower: Rect = DEFAULT_TOWER,
): FinaleLayout {
  const horizonY = 15 * RESOLUTION.TILE; // ground band top (600)

  // Layered gradient sky: deep teal up top warming to an orange dawn at the
  // horizon behind the tower (orange = the "value" accent, earned at the end).
  const sky = [
    { offset: 0, color: '#00242E' },
    { offset: 0.55, color: '#00394A' },
    { offset: 0.82, color: '#0A5566' },
    { offset: 1, color: '#8A4A2A' },
  ];

  const plaza: Rect = { x: 0, y: horizonY, w: width, h: height - horizonY };

  // Tower base sits on the plaza; keep the given crown height.
  const towerBaseY = horizonY;
  const t: Rect = { x: tower.x, y: tower.y, w: tower.w, h: towerBaseY - tower.y };

  // Window grid (glass panes) inset into the tower face.
  const windows: Rect[] = [];
  const pad = 14;
  const cols = 4;
  const rows = 8;
  const cellW = (t.w - pad * 2) / cols;
  const cellH = (t.h - pad * 2) / rows;
  const gw = cellW * 0.62;
  const gh = cellH * 0.6;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      windows.push({
        x: t.x + pad + c * cellW + (cellW - gw) / 2,
        y: t.y + pad + r * cellH + (cellH - gh) / 2,
        w: gw,
        h: gh,
      });
    }
  }

  const bloom = { x: t.x + t.w / 2, y: t.y + 30, r: 190 };
  const mark = { x: width * 0.16, y: horizonY - 150, r: 46 };

  return { sky, plaza, tower: t, windows, bloom, mark, horizonY };
}
