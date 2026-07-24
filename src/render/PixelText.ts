/**
 * PixelText — a legible 5×7 bitmap font + text renderer for in-world labels.
 *
 * The game's whole point is to make ANSR's story *clear*, so hazards, rewards
 * and stages carry short pixel-text labels ("PERMITS", "TALENT", "SOLVED").
 * A real bitmap font (not ctx.fillText) keeps that text crisp and on-theme with
 * the chunky 8-bit art, and stays palette-locked.
 *
 * Glyphs are 5 wide × 7 tall, drawn as `fillRect` "big pixels" so they stay
 * sharp under the Renderer's transform. Uppercase only (plus digits + a few
 * symbols) — that reads as confident signage and halves the glyph count.
 */

const GLYPH_W = 5;
const GLYPH_H = 7;

/** '#' = on, anything else = off. Each glyph is exactly 7 rows of 5 chars. */
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '####.', '#...#', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '#....', '####.', '....#', '....#', '####.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '..#..', '..#..'],
  ',': ['.....', '.....', '.....', '.....', '..#..', '..#..', '.#...'],
  ':': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '...#.', '..#..', '..#..', '.....', '..#..'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  // '>' renders as a right-arrow (used for CTAs / "solution" flow).
  '>': ['.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....'],
};

export interface TextOptions {
  scale?: number; // big-pixel size (default 3)
  color?: string; // glyph colour (default light grey)
  letter?: number; // spacing between glyphs in cells (default 1)
  align?: 'left' | 'center' | 'right';
  /** Draw a 1-big-pixel dark outline for contrast on busy backgrounds. */
  outline?: string;
  alpha?: number;
}

/** Width in internal px that a string will occupy at the given options. */
export function measureText(text: string, scale = 3, letter = 1): number {
  const n = text.length;
  if (n === 0) return 0;
  return n * GLYPH_W * scale + (n - 1) * letter * scale;
}

export const TEXT_LINE_H = GLYPH_H;

/**
 * Draw `text` with the bitmap font. `x,y` is the top-left unless `align` moves
 * it. Unknown characters render as blanks (never throws).
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: TextOptions = {},
): void {
  const scale = opts.scale ?? 3;
  const color = opts.color ?? '#E6E6E6';
  const letter = opts.letter ?? 1;
  const upper = text.toUpperCase();
  const total = measureText(upper, scale, letter);
  let ox = Math.round(x);
  if (opts.align === 'center') ox = Math.round(x - total / 2);
  else if (opts.align === 'right') ox = Math.round(x - total);
  const oy = Math.round(y);
  const cell = GLYPH_W * scale + letter * scale;

  const prevAlpha = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prevAlpha * opts.alpha;

  for (let i = 0; i < upper.length; i += 1) {
    const glyph = FONT[upper[i]!] ?? FONT[' ']!;
    const gx = ox + i * cell;
    if (opts.outline) {
      paintGlyph(ctx, glyph, gx - scale, oy, scale, opts.outline);
      paintGlyph(ctx, glyph, gx + scale, oy, scale, opts.outline);
      paintGlyph(ctx, glyph, gx, oy - scale, scale, opts.outline);
      paintGlyph(ctx, glyph, gx, oy + scale, scale, opts.outline);
    }
    paintGlyph(ctx, glyph, gx, oy, scale, color);
  }

  if (opts.alpha !== undefined) ctx.globalAlpha = prevAlpha;
}

function paintGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: string[],
  x: number,
  y: number,
  scale: number,
  color: string,
): void {
  ctx.fillStyle = color;
  for (let r = 0; r < GLYPH_H; r += 1) {
    const row = glyph[r]!;
    for (let c = 0; c < GLYPH_W; c += 1) {
      if (row[c] === '#') ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
    }
  }
}

/**
 * Draw a small framed plaque with centred text — used for signage that names a
 * problem or a solution. Returns nothing; sizes itself to the text.
 */
export function drawLabelPlaque(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  topY: number,
  o: {
    scale?: number;
    fg?: string;
    bg?: string;
    frame?: string;
    padX?: number;
    padY?: number;
    alpha?: number;
  } = {},
): void {
  const scale = o.scale ?? 2;
  const padX = o.padX ?? 6;
  const padY = o.padY ?? 5;
  const tw = measureText(text.toUpperCase(), scale, 1);
  const th = TEXT_LINE_H * scale;
  const w = tw + padX * 2;
  const h = th + padY * 2;
  const x = Math.round(cx - w / 2);
  const prev = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = prev * o.alpha;
  if (o.frame) {
    ctx.fillStyle = o.frame;
    ctx.fillRect(x - 2, topY - 2, w + 4, h + 4);
  }
  ctx.fillStyle = o.bg ?? 'rgba(0,26,34,0.72)';
  ctx.fillRect(x, topY, w, h);
  drawText(ctx, text, cx, topY + padY, {
    scale,
    color: o.fg ?? '#CFE6EC',
    align: 'center',
  });
  if (o.alpha !== undefined) ctx.globalAlpha = prev;
}
