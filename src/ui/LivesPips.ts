/**
 * The lives readout, drawn as pixel art rather than typed as characters.
 *
 * Hearts would need a glyph the 5×7 font does not have, and a digit ("2/3")
 * reads as a statistic rather than as something you are running out of. Pips do
 * both jobs: a life still held is a solid block, a spent one a hollow outline.
 * The distinction is carried by **shape**, so it survives greyscale, high
 * contrast and colour blindness — the same rule the hazards follow.
 *
 * Shared by the HUD plaque and the life-lost screen so the two can never drift.
 * The painter only sets geometry; sizing is the caller's business, because the
 * HUD sizes in frame units against a shrink-wrapping plaque and the overlay
 * sizes against its own column.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Authored cells: one pip is 5 wide with a 1-cell gutter after it. */
export const PIP_W = 5;
export const PIP_GAP = 1;

/** Ink for a life still held, and for one already spent. */
const HELD = '#FFFFFF';
const SPENT = '#5C7E88';

/** Authored width in cells for `total` pips (what the viewBox spans). */
export function pipCells(total: number): number {
  return total * PIP_W + Math.max(0, total - 1) * PIP_GAP;
}

/** (Re)paint an existing pip SVG. Sets the viewBox; does not set a width. */
export function paintLivesPips(svg: SVGSVGElement, left: number, total: number): void {
  const doc = svg.ownerDocument;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute('viewBox', `0 0 ${pipCells(total)} ${PIP_W}`);

  const held: string[] = [];
  const spent: string[] = [];
  for (let i = 0; i < total; i += 1) {
    const x = i * (PIP_W + PIP_GAP);
    if (i < left) {
      held.push(`M${x} 0h${PIP_W}v${PIP_W}h-${PIP_W}z`);
    } else {
      // Hollow: top and bottom edges plus the two sides, one cell thick.
      spent.push(
        `M${x} 0h${PIP_W}v1h-${PIP_W}z` +
          `M${x} ${PIP_W - 1}h${PIP_W}v1h-${PIP_W}z` +
          `M${x} 1h1v${PIP_W - 2}h-1z` +
          `M${x + PIP_W - 1} 1h1v${PIP_W - 2}h-1z`,
      );
    }
  }
  for (const [d, fill] of [
    [spent.join(''), SPENT],
    [held.join(''), HELD],
  ] as const) {
    if (!d) continue;
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', fill);
    path.setAttribute('shape-rendering', 'crispEdges');
    svg.appendChild(path);
  }
}

/** A decorative pip SVG. The real count ships in a sibling `.beam-run__sr`. */
export function createLivesPips(
  doc: Document,
  left: number,
  total: number,
  className?: string,
): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'beam-run__pixels' + (className ? ` ${className}` : ''));
  paintLivesPips(svg, left, total);
  return svg;
}
