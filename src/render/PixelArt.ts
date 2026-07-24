/**
 * PixelArt — a tiny, dependency-free 8-bit drawing core.
 *
 * Sprites are authored as arrays of equal-length strings ("pixel grids"): each
 * character maps to a colour in a {@link Palette}; space and '.' are treated as
 * transparent. Everything is painted with `fillRect` at an integer `scale`, so
 * the result stays crisp under the Renderer's HiDPI/letterbox transform (no
 * image smoothing to fight, no atlas to load). This gives the chunky, palette-
 * locked "Dangerous Dave" look the brief asks for while keeping the whole art
 * pipeline in code and version-controlled.
 *
 * Coordinates are in the game's internal pixel space (1280×720). `x`/`y` is the
 * TOP-LEFT of the sprite unless a helper says otherwise.
 */

export type Palette = Record<string, string>;

/** Characters that never paint (fully transparent cells). */
const TRANSPARENT = new Set([' ', '.', '\u00A0']);

export interface DrawOptions {
  /** Uniform size, in internal px, of one authored pixel. */
  scale: number;
  /** Mirror horizontally (for left-facing sprites). */
  flip?: boolean;
  /** Global alpha for the whole sprite (0..1). */
  alpha?: number;
}

/**
 * Paint a pixel grid at `x,y` (top-left). Rows may differ in length; each cell
 * is a `scale`×`scale` square. Unknown chars (not in the palette) are skipped,
 * so a single grid can carry "annotation" characters that some palettes ignore.
 */
export function drawPixels(
  ctx: CanvasRenderingContext2D,
  grid: readonly string[],
  palette: Palette,
  x: number,
  y: number,
  opts: DrawOptions,
): void {
  const { scale, flip = false, alpha = 1 } = opts;
  const ox = Math.round(x);
  const oy = Math.round(y);
  const rows = grid.length;
  const cols = maxWidth(grid);
  const prevAlpha = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = prevAlpha * alpha;

  for (let r = 0; r < rows; r += 1) {
    const row = grid[r]!;
    for (let c = 0; c < row.length; c += 1) {
      const ch = row[c]!;
      if (TRANSPARENT.has(ch)) continue;
      const color = palette[ch];
      if (!color) continue;
      const cx = flip ? cols - 1 - c : c;
      ctx.fillStyle = color;
      ctx.fillRect(ox + cx * scale, oy + r * scale, scale, scale);
    }
  }

  if (alpha !== 1) ctx.globalAlpha = prevAlpha;
}

/** Width (in cells) of the widest row — used for centring and flipping. */
export function maxWidth(grid: readonly string[]): number {
  let w = 0;
  for (const row of grid) if (row.length > w) w = row.length;
  return w;
}

/** Convenience: pixel dimensions of a grid at a given scale. */
export function spriteSize(grid: readonly string[], scale: number): { w: number; h: number } {
  return { w: maxWidth(grid) * scale, h: grid.length * scale };
}

/**
 * A single "big pixel" rectangle snapped to an integer grid of `px`-sized
 * cells. Handy for backgrounds/props drawn directly in pixel units rather than
 * from a string grid.
 */
export function pxRect(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
  px = 1,
): void {
  ctx.fillStyle = color;
  const x0 = Math.round(x / px) * px;
  const y0 = Math.round(y / px) * px;
  const x1 = Math.round((x + w) / px) * px;
  const y1 = Math.round((y + h) / px) * px;
  ctx.fillRect(x0, y0, Math.max(px, x1 - x0), Math.max(px, y1 - y0));
}

/**
 * Deterministic value noise in [0,1) from integer coords — lets backgrounds and
 * textures add stable pixel variation (dither, speckle, lit windows) without a
 * PRNG or per-frame jitter. Same input → same output every frame.
 */
export function hash2(ix: number, iy: number): number {
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h ^= h >> 16;
  return ((h >>> 0) % 100000) / 100000;
}

export interface BrickOptions {
  /** Big-pixel size for the texture (keeps mortar lines chunky). */
  px?: number;
  /** Brick block width/height in internal px. */
  brickW?: number;
  brickH?: number;
  /** Face, its darker shade (dither/shadow), highlight, and mortar colours. */
  face: string;
  shade: string;
  highlight: string;
  mortar: string;
  /** Speckle amount 0..1 (how many face pixels get the shade for texture). */
  speckle?: number;
}

/**
 * Fill a rectangle with an 8-bit brick/block texture: offset courses, mortar
 * lines, a top highlight course, and stable per-pixel speckle. Used for ground,
 * walls and platforms so surfaces read as built material, not flat slabs.
 */
export function drawBricks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  o: BrickOptions,
): void {
  const px = o.px ?? 4;
  const bw = o.brickW ?? 40;
  const bh = o.brickH ?? 20;
  const speckle = o.speckle ?? 0.12;

  // Base fill.
  ctx.fillStyle = o.face;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));

  // Per-pixel speckle for a hand-placed texture feel (stable via hash2).
  for (let py = 0; py < h; py += px) {
    for (let pxi = 0; pxi < w; pxi += px) {
      const n = hash2(Math.floor((x + pxi) / px), Math.floor((y + py) / px));
      if (n < speckle) {
        ctx.fillStyle = n < speckle * 0.4 ? o.shade : o.highlight;
        ctx.fillRect(Math.round(x + pxi), Math.round(y + py), px, px);
      }
    }
  }

  // Mortar grid: horizontal courses + offset vertical joints.
  ctx.fillStyle = o.mortar;
  for (let ry = 0; ry <= h; ry += bh) {
    ctx.fillRect(Math.round(x), Math.round(y + ry), Math.round(w), Math.max(1, px / 2));
    const course = Math.floor(ry / bh);
    const offset = course % 2 === 0 ? 0 : bw / 2;
    for (let rx = offset; rx <= w; rx += bw) {
      ctx.fillRect(
        Math.round(x + rx),
        Math.round(y + ry),
        Math.max(1, px / 2),
        Math.min(bh, h - ry),
      );
    }
  }

  // Top highlight course so platforms catch light on their walkable edge.
  ctx.fillStyle = o.highlight;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.max(1, px / 2));
}
