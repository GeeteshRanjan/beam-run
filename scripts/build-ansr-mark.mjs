/**
 * Regenerate `src/ui/ansrMark.ts` from the brand asset.
 *
 * Reads `ANSR Logo.svg` in the workspace root, keeps ONLY the `.cls-2` shapes
 * (the orange sunburst — the `.cls-1` shapes are the "ANSR" wordmark, which the
 * lockup sets in type), flattens the five rotate-transformed `<rect>`s into
 * polygons, and writes them out as one absolute `<path>` re-origined to the
 * sunburst's own bounding box.
 *
 * Coordinates keep the source's own precision (2 dp). An earlier version
 * quantised them to a 0.5-unit integer grid to save bytes; at the size the mark
 * is drawn (34–56 px, where one source unit is ~0.5 px) that shifted individual
 * ray edges by up to a quarter of their width and the sunburst read as uneven —
 * "broken and different from the original". Fidelity to the brand asset wins;
 * the extra ~0.4 KB gzipped is affordable.
 *
 * Usage: node scripts/build-ansr-mark.mjs [path/to/ANSR Logo.svg]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SVG = process.argv[2] ?? resolve(here, '../../ANSR Logo.svg');
const OUT = resolve(here, '../src/ui/ansrMark.ts');

const src = readFileSync(SVG, 'utf8');

/** Every `.cls-2` polygon, as a list of points. */
function polygons() {
  const out = [];
  for (const m of src.matchAll(/<polygon class="cls-2" points="([^"]+)"/g)) {
    const nums = m[1].trim().split(/[\s,]+/).map(Number);
    const pts = [];
    for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    out.push(pts);
  }
  return out;
}

/** Every `.cls-2` rect, with its translate/rotate applied so it becomes a quad. */
function rects() {
  const out = [];
  for (const m of src.matchAll(/<rect class="cls-2"([^/]*?)\/>/g)) {
    const attrs = m[1];
    const num = (name) => {
      const hit = new RegExp(`${name}="([^"]+)"`).exec(attrs);
      return hit ? Number.parseFloat(hit[1]) : 0;
    };
    const [x, y, w, h] = [num('x'), num('y'), num('width'), num('height')];
    const t = /transform="translate\(([-\d.]+)\s+([-\d.]+)\)\s*rotate\(([-\d.]+)\)"/.exec(attrs);
    const tx = t ? Number.parseFloat(t[1]) : 0;
    const ty = t ? Number.parseFloat(t[2]) : 0;
    const rad = ((t ? Number.parseFloat(t[3]) : 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    out.push(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ].map(([px, py]) => [tx + px * cos - py * sin, ty + px * sin + py * cos]),
    );
  }
  return out;
}

const shapes = [...polygons(), ...rects()];
if (shapes.length === 0) throw new Error('no .cls-2 shapes found — is this the ANSR logo SVG?');

let minX = Infinity;
let minY = Infinity;
let maxX = -Infinity;
let maxY = -Infinity;
for (const pts of shapes) {
  for (const [px, py] of pts) {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }
}

const n = (v) => String(Number(v.toFixed(2)));
let d = '';
for (const pts of shapes) {
  pts.forEach(([px, py], i) => {
    d += (i === 0 ? 'M' : ' ') + n(px - minX) + ' ' + n(py - minY);
  });
  d += 'Z';
}
const viewBox = `0 0 ${n(maxX - minX)} ${n(maxY - minY)}`;

writeFileSync(
  OUT,
  `/**
 * ansrMark.ts — the real ANSR sunburst as a single SVG path.
 *
 * GENERATED — do not hand-edit. Run \`node scripts/build-ansr-mark.mjs\` to
 * rebuild it from the brand asset (\`ANSR Logo.svg\` in the workspace root).
 *
 * Contents: all ${shapes.length} \`.cls-2\` shapes of the logo (the sunburst), with the five
 * rotate-transformed rects flattened into polygons and every point re-origined
 * to the sunburst's own bounding box — the wordmark (\`.cls-1\`) is deliberately
 * excluded because the lockup sets "ANSRcade" in type beside it.
 *
 * Coordinates keep the asset's own 2 dp precision: this is the logo, not an
 * approximation of it, and quantising it to save bytes made the rays read
 * unevenly at the size it is drawn.
 */

/** ANSR logo orange, from the brand asset — distinct from the value accent. */
export const LOGO_ORANGE = '#f05722';

/** viewBox for {@link ANSR_MARK_PATH} (the sunburst's own bounding box). */
export const ANSR_MARK_VIEWBOX = '${viewBox}';

/** Number of subpaths (one per shape in the source). */
export const ANSR_MARK_SHAPES = ${shapes.length};

export const ANSR_MARK_PATH =
  '${d}';
`,
);

process.stdout.write(
  `ansrMark.ts written — ${shapes.length} shapes, viewBox "${viewBox}", ${d.length} bytes of path data\n`,
);
