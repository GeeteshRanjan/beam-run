/**
 * The lives readout, drawn as pixel art rather than typed as characters.
 *
 * **These were square pips and are now hearts** (owner call: "give a different
 * look to life"). The reason the change is safe is that the rule the pips existed
 * for is untouched: a life still held is a **solid** heart, a life spent is the
 * same heart as a **hollow outline**, so the state is carried by *shape* and
 * survives greyscale, high contrast and colour blindness — the same rule the
 * hazards follow. What the heart adds is that it is legible as "a life" at a
 * glance and at any size, where a row of squares had to be captioned to mean
 * anything; it also now owns the top-right plaque the TIME TO MARKET clock used to
 * hold, so it is read from further away than it was.
 *
 * A heart needs an odd width to have a point, and it needs its shoulders one row
 * below the top so the notch reads: 7×6 is the smallest grid where both are true
 * (5×5 rasterised as a blob with a dent). Deliberately *not* the value orange —
 * orange means ANSR value, and a readout of what you have left is not that.
 *
 * The painter only sets geometry; sizing is the caller's business, because the
 * HUD sizes in frame units against a shrink-wrapping plaque.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Authored cells: one heart is 7 wide and 6 tall, with a 2-cell gutter after it. */
export const PIP_W = 7;
export const PIP_H = 6;
export const PIP_GAP = 2;

/** Ink for a life still held, and for one already spent. */
const HELD = '#FFFFFF';
const SPENT = '#5C7E88';

/**
 * The two faces of one life, authored as cells. `#` paints.
 *
 * The outline is the *same silhouette* hollowed out, not a smaller heart: a spent
 * life has to read as the empty socket of the one that was there, which is what
 * makes three of them countable at a glance.
 */
const HEART_SOLID = [
  '.##.##.',
  '#######',
  '#######',
  '.#####.',
  '..###..',
  '...#...',
] as const;

const HEART_HOLLOW = [
  '.##.##.',
  '#..#..#',
  '#.....#',
  '.#...#.',
  '..#.#..',
  '...#...',
] as const;

/** Authored width in cells for `total` pips (what the viewBox spans). */
export function pipCells(total: number): number {
  return total * PIP_W + Math.max(0, total - 1) * PIP_GAP;
}

/** Append one heart's cells to a path string, offset to column `x`. */
function heartPath(grid: readonly string[], x: number): string {
  let d = '';
  for (let r = 0; r < grid.length; r += 1) {
    const row = grid[r]!;
    // Runs rather than single cells: one `M…h…v1h-…z` per contiguous span keeps
    // the path short enough that repainting it every life is free.
    let c = 0;
    while (c < row.length) {
      if (row[c] !== '#') {
        c += 1;
        continue;
      }
      const start = c;
      while (c < row.length && row[c] === '#') c += 1;
      const w = c - start;
      d += `M${x + start} ${r}h${w}v1h-${w}z`;
    }
  }
  return d;
}

/** (Re)paint an existing pip SVG. Sets the viewBox; does not set a width. */
export function paintLivesPips(svg: SVGSVGElement, left: number, total: number): void {
  const doc = svg.ownerDocument;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('viewBox', `0 0 ${pipCells(total)} ${PIP_H}`);

  let held = '';
  let spent = '';
  for (let i = 0; i < total; i += 1) {
    const x = i * (PIP_W + PIP_GAP);
    if (i < left) held += heartPath(HEART_SOLID, x);
    else spent += heartPath(HEART_HOLLOW, x);
  }
  for (const [d, fill] of [
    [spent, SPENT],
    [held, HELD],
  ] as const) {
    if (!d) continue;
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', fill);
    path.setAttribute('shape-rendering', 'crispEdges');
    svg.appendChild(path);
  }
}

/*
 * `createLivesPips` used to live here, for the life-lost screen's display-size
 * copy of this readout. That screen is gone (a lost life restarts the stage
 * instead), and the out-of-lives screen does not show lives — there are none
 * left, so a row of three empty hearts was three glyphs saying nothing. The HUD
 * builds its own node and calls `paintLivesPips`, so nothing needs a factory.
 */
