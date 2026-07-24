/**
 * scenery.ts — per-level 8-bit environments where every element MEANS something.
 *
 * Each screen is a literal picture of a GCC market-entry stage (see GDD §4
 * "meaning map"). This module owns two things:
 *
 *   1. TILE_MATERIALS — how the ground/platforms of each level are textured, so
 *      the surface you stand on reads as part of that level's story (polished
 *      lobby floor → cracked red-tape ground → scorched brick → stamped
 *      compliance tile → weathered stone → bright plaza).
 *
 *   2. drawSceneBackground — the backdrop props (skyline of the market you're
 *      entering, plus stage-specific silhouettes: reception desk, stalled
 *      paperwork, hiring crowd, regulation wall, a map of India missing local
 *      knowledge, and the Tech Park arrival) rendered in chunky pixels, kept
 *      low-contrast so hazards and the hero always read clearly.
 */
import { RESOLUTION } from '../data/tuning.config';
import { drawBricks, hash2, pxRect, type BrickOptions } from './PixelArt';
import { drawText, drawLabelPlaque } from './PixelText';

const { WIDTH: W, TILE } = RESOLUTION;
const GROUND_TOP = 15 * TILE; // 600

export interface TileMaterial extends BrickOptions {
  /** Optional flat cap colour painted as the very top walkable edge. */
  edge?: string;
}

/**
 * Ground/platform material per screen id. Colours stay in the teal family
 * (brand) with per-level shifts that carry meaning.
 */
export const TILE_MATERIALS: Record<number, TileMaterial> = {
  // L0 Reception — polished lobby floor: clean, inviting ("getting started is easy").
  0: {
    face: '#0A4553', shade: '#063845', highlight: '#137084', mortar: '#00242E',
    brickW: 40, brickH: 20, speckle: 0.06, edge: '#1C8296',
  },
  // L1 Setup Delays — cracked "red-tape" ground: rougher, unfinished.
  1: {
    face: '#0A3D49', shade: '#062E38', highlight: '#125F70', mortar: '#001A22',
    brickW: 24, brickH: 16, speckle: 0.2, edge: '#14708A',
  },
  // L2 Hire Under Fire — scorched brick, warm-edged highlights.
  2: {
    face: '#0C3B44', shade: '#07272E', highlight: '#8A4A2A', mortar: '#00161C',
    brickW: 40, brickH: 20, speckle: 0.16, edge: '#B4622E',
  },
  // L3 Compliance Maze — stamped document tile: tight regulatory grid.
  3: {
    face: '#093845', shade: '#052a34', highlight: '#0F5A6C', mortar: '#001820',
    brickW: 20, brickH: 20, speckle: 0.1, edge: '#136378',
  },
  // L4 Local Expertise — weathered dusk stone: uneven, unfamiliar terrain.
  4: {
    face: '#0A333F', shade: '#06232C', highlight: '#125464', mortar: '#04161C',
    brickW: 32, brickH: 14, speckle: 0.22, edge: '#125C70',
  },
  // L5 Tech Park — bright plaza pavers: the payoff.
  5: {
    face: '#0E5566', shade: '#0A4553', highlight: '#1E8CA3', mortar: '#00323F',
    brickW: 40, brickH: 20, speckle: 0.05, edge: '#2AA6C0',
  },
};

export function tileMaterial(id: number): TileMaterial {
  return TILE_MATERIALS[id] ?? TILE_MATERIALS[0]!;
}

/** Paint one solid rectangle as textured level material. */
export function drawTileRect(
  ctx: CanvasRenderingContext2D,
  id: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const m = tileMaterial(id);
  drawBricks(ctx, x, y, w, h, m);
  if (m.edge) {
    ctx.fillStyle = m.edge;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 3);
  }
}

// ---------------------------------------------------------------------------
// Background scene
// ---------------------------------------------------------------------------

/** Vertical dithered sky (deep teal), with a per-level tint at the horizon. */
function drawSky(ctx: CanvasRenderingContext2D, horizonTint: string): void {
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_TOP);
  grad.addColorStop(0, '#00212B');
  grad.addColorStop(0.6, '#002B37');
  grad.addColorStop(1, horizonTint);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, GROUND_TOP);

  // Chunky ordered-dither band near the horizon so the gradient reads 8-bit.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = GROUND_TOP - 96; y < GROUND_TOP; y += 8) {
    const density = (GROUND_TOP - y) / 96; // fewer dots higher up
    for (let x = 0; x < W; x += 8) {
      if (hash2(x >> 3, y >> 3) < 0.5 - density * 0.4) {
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }
}

/**
 * Distant city skyline — "the market you are entering." Present on every level
 * for continuity; a few windows twinkle (steady under reduced motion).
 */
function drawSkyline(
  ctx: CanvasRenderingContext2D,
  seed: number,
  color: string,
  winColor: string,
  t: number,
  reduced: boolean,
): void {
  const baseY = GROUND_TOP;
  let x = -20;
  let i = 0;
  while (x < W + 20) {
    const bw = 60 + Math.floor(hash2(seed + i, 3) * 70);
    const bh = 90 + Math.floor(hash2(seed + i, 9) * 190);
    const bx = x;
    const by = baseY - bh;
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bw, bh);
    // Window grid.
    for (let wy = by + 10; wy < baseY - 10; wy += 16) {
      for (let wx = bx + 8; wx < bx + bw - 8; wx += 14) {
        const n = hash2(wx, wy);
        const lit = reduced ? n > 0.5 : n > 0.5 && Math.sin(t * 0.8 + n * 30) > -0.2;
        ctx.fillStyle = lit ? winColor : 'rgba(0,0,0,0.18)';
        ctx.fillRect(wx, wy, 6, 8);
      }
    }
    x += bw + 10 + Math.floor(hash2(seed + i, 21) * 26);
    i += 1;
  }
}

/** A small potted plant silhouette (lobby greenery). */
function drawPottedPlant(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  pxRect(ctx, '#0C4B3A', x + 4, baseY - 34, 4, 22, 2); // stem
  pxRect(ctx, '#0F6B4E', x - 6, baseY - 44, 24, 16, 2); // foliage
  pxRect(ctx, '#083726', x - 2, baseY - 36, 16, 8, 2); // foliage shadow
  pxRect(ctx, '#123', x - 2, baseY - 12, 16, 12, 2); // pot base
  pxRect(ctx, '#1C6', x - 2, baseY - 12, 16, 3, 2);
}

/** A framed sign/board on the wall (used as job board, doc grid, etc.). */
function drawBoard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frame: string,
  paper: string,
  lines: string,
): void {
  pxRect(ctx, frame, x - 3, y - 3, w + 6, h + 6, 2);
  pxRect(ctx, paper, x, y, w, h, 2);
  for (let ly = y + 6; ly < y + h - 4; ly += 8) {
    pxRect(ctx, lines, x + 5, ly, w - 10, 2, 2);
  }
}

/**
 * A background "floor directory" sign that names the stage's problem, read as
 * an office building sign. Low-contrast so it sits behind gameplay.
 */
function drawFloorSign(ctx: CanvasRenderingContext2D, cx: number, midY: number, text: string): void {
  drawLabelPlaque(ctx, text, cx, midY, {
    scale: 3,
    fg: '#8FC7D4',
    bg: 'rgba(0,26,34,0.55)',
    frame: 'rgba(20,90,110,0.7)',
    padX: 10,
    padY: 7,
    alpha: 0.72,
  });
}

/** A small caption on a background prop (e.g. a board title). */
function drawPropLabel(ctx: CanvasRenderingContext2D, cx: number, topY: number, text: string): void {
  drawText(ctx, text, cx, topY, {
    scale: 2,
    color: '#7FB6C4',
    align: 'center',
    alpha: 0.8,
  });
}

/** A person silhouette (hiring crowd / candidates). */
function drawPerson(ctx: CanvasRenderingContext2D, x: number, baseY: number, tone: string): void {
  pxRect(ctx, tone, x + 2, baseY - 40, 10, 10, 2); // head
  pxRect(ctx, tone, x - 2, baseY - 28, 18, 20, 2); // torso
  pxRect(ctx, tone, x, baseY - 8, 6, 8, 2); // legs
  pxRect(ctx, tone, x + 8, baseY - 8, 6, 8, 2);
}

/** Reception desk block with a sign glow (Lobby). */
function drawReceptionDesk(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  pxRect(ctx, '#0A4553', x, baseY - 46, 120, 46, 2); // desk body
  pxRect(ctx, '#137084', x, baseY - 46, 120, 6, 2); // counter top
  pxRect(ctx, '#00323F', x + 10, baseY - 34, 100, 24, 2); // front panel
  // A soft hanging sign above the desk, carrying the ANSR wordmark.
  pxRect(ctx, '#0F5A6C', x + 20, baseY - 100, 80, 26, 2);
  drawText(ctx, 'ANSR', x + 60, baseY - 94, { scale: 2, color: '#CFE6EC', align: 'center' });
}

/** Stacked boxes / stalled paperwork (Setup Delays). */
function drawStalledStacks(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  const box = (bx: number, by: number, s: number): void => {
    pxRect(ctx, '#0A3642', bx, by, s, s, 2);
    pxRect(ctx, '#06272F', bx, by, s, 4, 2);
    pxRect(ctx, '#125', bx + 4, by + 6, s - 8, 3, 2); // tape line
  };
  box(x, baseY - 34, 34);
  box(x + 40, baseY - 60, 34);
  box(x + 6, baseY - 68, 30);
  box(x + 44, baseY - 26, 26);
}

/** A slow wall clock — time slipping away during setup. */
function drawClock(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, reduced: boolean): void {
  pxRect(ctx, '#0F5A6C', cx - 16, cy - 16, 32, 32, 2);
  pxRect(ctx, '#00323F', cx - 12, cy - 12, 24, 24, 2);
  const a = reduced ? 0.6 : t * 0.4;
  ctx.strokeStyle = '#9FD8E4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a * 0.4) * 5, cy + Math.sin(a * 0.4) * 5);
  ctx.stroke();
}

/** A stylised map of India with a location pin + question marks (Local Expertise). */
function drawIndiaMap(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // Rough pixel silhouette (evocative, not cartographic).
  const rows = [
    '  ####    ',
    ' ######## ',
    ' #########',
    ' ######## ',
    '  ####### ',
    '   #####  ',
    '   ####   ',
    '    ###   ',
    '    ##    ',
    '    #     ',
  ];
  const s = 8;
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < rows[r]!.length; c += 1) {
      if (rows[r]![c] === '#') pxRect(ctx, '#0C4A5A', x + c * s, y + r * s, s, s, 2);
    }
  }
  // Location pin (teal, not orange — orange stays "value").
  const pinX = x + 4 * s;
  const pinY = y + 3 * s;
  pxRect(ctx, '#1C8296', pinX, pinY, 10, 10, 2);
  pxRect(ctx, '#E6E6E6', pinX + 3, pinY + 3, 4, 4, 2);
  // Question marks = missing local knowledge.
  pxRect(ctx, 'rgba(230,230,230,0.5)', x + 92, y + 6, 4, 4, 2);
  pxRect(ctx, 'rgba(230,230,230,0.5)', x + 96, y + 10, 4, 4, 2);
  pxRect(ctx, 'rgba(230,230,230,0.5)', x + 96, y + 18, 4, 4, 2);
  pxRect(ctx, 'rgba(230,230,230,0.5)', x + 96, y + 30, 4, 4, 2);
}

/**
 * Paint the full backdrop for `id`. Coordinates are internal px; everything
 * sits above the ground band (drawn separately as textured tiles).
 */
export function drawSceneBackground(
  ctx: CanvasRenderingContext2D,
  id: number,
  t: number,
  reduced: boolean,
): void {
  switch (id) {
    case 0: {
      drawSky(ctx, '#0A4553');
      drawSkyline(ctx, 11, '#063a47', '#9FD8E4', t, reduced);
      // Lobby interior read: reception desk + greenery flanking the entrance.
      drawFloorSign(ctx, W * 0.5, 96, 'MARKET ENTRY');
      drawReceptionDesk(ctx, W * 0.5 - 60, GROUND_TOP);
      drawPottedPlant(ctx, 120, GROUND_TOP);
      drawPottedPlant(ctx, W - 150, GROUND_TOP);
      break;
    }
    case 1: {
      drawSky(ctx, '#0A3D49');
      drawSkyline(ctx, 23, '#06333d', '#7FC4D2', t, reduced);
      // Setup delays: stalled paperwork stacks + a slipping clock.
      drawFloorSign(ctx, W * 0.5, 70, 'SETUP DELAYS');
      drawStalledStacks(ctx, 90, GROUND_TOP);
      drawStalledStacks(ctx, W - 190, GROUND_TOP);
      drawClock(ctx, W * 0.5, 150, t, reduced);
      drawBoard(ctx, W * 0.5 - 40, 210, 80, 56, '#0A3642', '#0E4A57', '#0A2C36'); // permits form
      drawPropLabel(ctx, W * 0.5, 190, 'PERMITS');
      drawPropLabel(ctx, 124, GROUND_TOP - 92, 'RED TAPE');
      break;
    }
    case 2: {
      drawSky(ctx, '#123A40'); // warm-edged horizon
      drawSkyline(ctx, 37, '#07313a', '#FFB07A', t, reduced);
      // Hire under fire: a crowd of candidates + a job board.
      drawPerson(ctx, 120, GROUND_TOP, '#0B3B45');
      drawPerson(ctx, 150, GROUND_TOP, '#0E4854');
      drawPerson(ctx, 178, GROUND_TOP, '#0B3B45');
      drawPerson(ctx, W - 150, GROUND_TOP, '#0E4854');
      drawPerson(ctx, W - 122, GROUND_TOP, '#0B3B45');
      drawFloorSign(ctx, W * 0.5, 70, 'HIRE UNDER FIRE');
      drawBoard(ctx, W * 0.5 - 46, 150, 92, 70, '#0C3B44', '#0F5060', '#08313A'); // job board
      drawPropLabel(ctx, W * 0.5, 128, 'HIRING');
      break;
    }
    case 3: {
      drawSky(ctx, '#083845');
      drawSkyline(ctx, 51, '#06303b', '#8FCAD6', t, reduced);
      // Compliance maze: a wall grid of stamped documents/regulations.
      drawFloorSign(ctx, W * 0.5, 70, 'COMPLIANCE MAZE');
      {
        const labels = ['TAX', 'GST', 'AUDIT', 'LEGAL', 'ENTITY'];
        let i = 0;
        for (let bx = 120; bx < W - 200; bx += 130) {
          drawBoard(ctx, bx, 130, 70, 90, '#072a34', '#0C4553', '#06333d');
          drawPropLabel(ctx, bx + 35, 138, labels[i % labels.length]!);
          // Approval "stamp".
          pxRect(ctx, '#12657A', bx + 44, 190, 18, 18, 2);
          pxRect(ctx, '#0A3B47', bx + 48, 194, 10, 10, 2);
          i += 1;
        }
      }
      break;
    }
    case 4: {
      drawSky(ctx, '#0A333F'); // dusk
      drawSkyline(ctx, 67, '#062b34', '#7FB8C6', t, reduced);
      // Lack of local expertise: a map of India + question marks.
      drawFloorSign(ctx, W * 0.5, 70, 'LOCAL EXPERTISE');
      drawIndiaMap(ctx, W * 0.5 - 44, 120);
      drawPropLabel(ctx, W * 0.5, 210, 'LOCAL?');
      break;
    }
    case 5: {
      // Finale keeps its bespoke hero scene (drawn in Game.drawFinale); here we
      // only lay a brighter arrival sky + distant skyline behind it.
      drawSky(ctx, '#0E5566');
      drawSkyline(ctx, 83, '#0a4553', '#FFD9A8', t, reduced);
      break;
    }
    default: {
      drawSky(ctx, '#0A4553');
      drawSkyline(ctx, 11, '#063a47', '#9FD8E4', t, reduced);
    }
  }
}
