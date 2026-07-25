/**
 * NotFoundPage — the custom 404 screen for the standalone deployment.
 *
 * Why this exists: the two Navigator routes (the title screen's "Skip to the
 * Navigator", and every capability row on the closing receipt) deep-link
 * `/gcc-opportunity-navigator`, which the static host does not serve. The last
 * thing a prospect saw after the single most valuable click in the game was the
 * host's raw error page. This replaces it with the game's own screen.
 *
 * It is **build-time only**: `scripts/build-404.ts` renders it once into
 * `dist-site/404.html`. Nothing in the game imports it, so it is not part of the
 * shipped bundle (rollup only walks what `src/index.ts` reaches).
 *
 * Two constraints shaped it:
 *
 *  1. **Zero external references.** No script, no linked stylesheet, no image
 *     file. A 404 is served for *any* unmatched path, including deep ones like
 *     `/a/b/c`, where relative asset URLs resolve somewhere else entirely. The
 *     stylesheet is inlined and the artwork is inline SVG, so the page renders
 *     identically at any depth and needs no JavaScript at all.
 *  2. **The real thing, not a lookalike.** It inlines the game's own stylesheet
 *     (`CSS`) and uses the same generators for the lockup and the bitmap type,
 *     so the dither wash, the scanlines, the NES buttons and the pixel font are
 *     the game's, and they cannot drift from it.
 */
import { COPY } from '../data/copy';
import { BRAND } from '../data/tuning.config';
import { TYPOGRAPHY } from '../data/tokens';
import { CSS } from './styles';
import { createBrandLockup } from './BrandMark';
import { createPixelHeading, createPixelSvg } from './PixelType';
import { HERO_IDLE, HERO_GRID_W, HERO_GRID_H, HERO_PALETTE } from '../render/sprites';
import { hash2 } from '../render/PixelArt';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Authored-pixel size as a % of the viewport width, matching the overlay scale. */
const PX_TYPE = {
  /** "404" — the figure is the loudest thing on the page. */
  code: { unit: 0.9, minPx: 7, maxPx: 15 },
  /** "OFF THE MAP" — same size as an in-game headline. */
  title: { unit: 0.42, minPx: 3, maxPx: 7 },
} as const;

const TITLE_INK = { color: BRAND.WHITE, shadow: 'rgba(0,16,22,0.85)' } as const;

// --- artwork ----------------------------------------------------------------

/**
 * The artwork is deliberately split in two, because a 404 is served at every
 * shape of viewport and one full-frame SVG cannot survive all of them: fitting
 * it leaves gaps beside the ground on a wide window, filling it zooms into the
 * middle of the picture on a phone.
 *
 *  - the SKY is a CSS gradient with hard stops (8-bit bands that stretch to any
 *    size without distorting anything that has a silhouette);
 *  - the WORLD is a bottom-anchored strip of SVG scaled by width alone, so the
 *    ground line always sits on the floor of the screen and the hero is never
 *    cropped or stretched.
 */
const VIEW_W = 1280;
/** Height of the world strip: enough for the tallest building plus the ground. */
const VIEW_H = 360;
/** Ground line inside the strip (world y 600 of a 720-tall game screen). */
const GROUND_Y = 240;
/** One authored hero pixel. A notch above the in-game 3, so he reads as a figure
 *  rather than a speck in a picture nobody is playing. */
const HERO_SCALE = 5;

/**
 * Where the hero stands, and the span the skyline leaves clear around him.
 *
 * Kept in the left third on purpose: on a narrow screen the strip is scaled by
 * height and cropped from the right (see PAGE_CSS), so anything composed in the
 * middle would be cut in half on a phone.
 */
const STAGE_LEFT = 150;
const BARRIER_X = 250;
const BARRIER_W = 170;
const CLEAR_SPAN: readonly [number, number] = [100, 470];

/**
 * Sky, in solid bands top → horizon (no smooth gradients — this world is 8-bit).
 *
 * These are much brighter than the levels' skies on purpose: the overlay's
 * dither wash sits on top at roughly 58% black, so a sky authored at the game's
 * values renders as a dead black rectangle here (which is exactly how the first
 * version of this page looked). The horizon has to be bright enough for the
 * buildings to silhouette against it *after* the wash.
 */
const SKY_BANDS = ['#012A35', '#013948', '#014C5E', '#026379', '#0A7F96', '#149BB3'] as const;

/** The bands as a hard-stop gradient, so they stretch with the viewport. */
const SKY_GRADIENT = `linear-gradient(to bottom, ${SKY_BANDS.map((c, i) => {
  const from = ((i / SKY_BANDS.length) * 100).toFixed(2);
  const to = (((i + 1) / SKY_BANDS.length) * 100).toFixed(2);
  return `${c} ${from}%, ${c} ${to}%`;
}).join(', ')})`;

/**
 * Page-level CSS, appended after the game's stylesheet.
 *
 * The stage normally sizes itself to a 16:9 play frame (and, in portrait, to a
 * frame plus a control band). There is no canvas here and no thumb controls, so
 * it takes the whole viewport instead: the `.beam-run--404` ancestor gives these
 * rules a higher specificity than the library's, so they win regardless of
 * source order or media query.
 */
const PAGE_CSS = `
html, body { margin: 0; height: 100%; }
body {
  background: ${BRAND.DEEP_TEAL};
  color: ${BRAND.WHITE};
  font-family: ${TYPOGRAPHY.fontFamily};
  overflow: hidden;
  overscroll-behavior: none;
}
.beam-run--404 .beam-run__stage {
  width: 100%; max-width: none; margin: 0;
  aspect-ratio: auto; height: 100vh;
}
@supports (height: 100dvh) {
  /* dvh, so mobile browser chrome can't crop the page. */
  .beam-run--404 .beam-run__stage { height: 100dvh; }
}
.beam-run__sky { position: absolute; inset: 0; background: ${SKY_GRADIENT}; }
/* The world: skyline, ground, hero, blocked path. Width-scaled and pinned to the
   bottom edge, so the ground line is the floor of the screen at any size. On a
   very short window the tops of the buildings crop, which is what a camera would
   do anyway. */
.beam-run__scene {
  position: absolute; left: 0; right: 0; bottom: 0;
  width: 100%; height: auto; display: block;
  image-rendering: pixelated;
}
/* Portrait: scaling by width leaves a strip barely 110px tall on a phone, where
   the hero is a speck under a screen full of empty sky. So scale by height there
   and let the far end of the city crop off the right; the hero and the barrier
   are composed in the left third precisely so they survive that crop. */
@media (max-aspect-ratio: 1 / 1) {
  .beam-run__scene { width: auto; height: min(38vh, 320px); right: auto; }
}
/* Lift the copy clear of the ground band so the hero and the barrier are not
   sitting behind the button. The content still centres in what's left, and the
   overlay still scrolls if a very short window can't fit it. */
.beam-run--404 .beam-run__overlay { padding-bottom: clamp(90px, 16vh, 200px); }
/* The buttons are links here (no JS on this page), so they need the bits a
   <button> gets for free. */
a.beam-run__btn {
  display: inline-flex; align-items: center; justify-content: center;
  text-decoration: none; text-align: center;
}
`;

const GROUND = {
  face: '#01535F',
  cap: '#0A7185',
  joint: '#012A33',
  course: '#013F4A',
} as const;

const CITY = {
  farBody: '#012E3A',
  farWindow: '#0C5F71',
  nearBody: '#001B24',
  nearWindow: '#8FD4E2',
} as const;

/** Collects axis-aligned rectangles into one SVG path (one node per colour). */
class Rects {
  private d = '';

  add(x: number, y: number, w: number, h: number): void {
    if (w <= 0 || h <= 0) return;
    const rx = Math.round(x);
    const ry = Math.round(y);
    this.d += `M${rx} ${ry}h${Math.round(w)}v${Math.round(h)}h${-Math.round(w)}z`;
  }

  get path(): string {
    return this.d;
  }
}

function appendPath(doc: Document, parent: Element, d: string, fill: string): void {
  if (d === '') return;
  const el = doc.createElementNS(SVG_NS, 'path');
  el.setAttribute('d', d);
  el.setAttribute('fill', fill);
  el.setAttribute('shape-rendering', 'crispEdges');
  parent.appendChild(el);
}

/** One row of buildings, deterministic from `seed` (no RNG — same page forever). */
function cityLayer(
  doc: Document,
  parent: Element,
  seed: number,
  opts: {
    body: string;
    window: string;
    minH: number;
    maxH: number;
    step: number;
    /** Leave this x-range empty, so the hero and the barrier read against sky. */
    clear?: readonly [number, number];
  },
): void {
  const bodies = new Rects();
  const windows = new Rects();
  for (let i = 0; i * opts.step < VIEW_W + opts.step; i += 1) {
    const x = i * opts.step - 24;
    const w = opts.step - 12 - Math.round(hash2(i, seed) * 10);
    const h = opts.minH + Math.round(hash2(i * 3 + 1, seed) * (opts.maxH - opts.minH));
    const top = GROUND_Y - h;
    if (opts.clear && x + w > opts.clear[0] && x < opts.clear[1]) continue;
    bodies.add(x, top, w, h);
    // Window grid: 8px panes on a 16px pitch, inset from the facade edges.
    for (let wy = top + 12; wy < GROUND_Y - 14; wy += 16) {
      for (let wx = x + 8; wx < x + w - 12; wx += 16) {
        if (hash2(wx, wy + seed) > 0.52) continue;
        windows.add(wx, wy, 8, 8);
      }
    }
  }
  appendPath(doc, parent, bodies.path, opts.body);
  appendPath(doc, parent, windows.path, opts.window);
}

/** The hero, painted from the same grid the canvas uses, one path per colour. */
function hero(doc: Document, parent: Element, centerX: number, feetY: number): void {
  const byColor = new Map<string, Rects>();
  const w = HERO_GRID_W * HERO_SCALE;
  const h = HERO_GRID_H * HERO_SCALE;
  const x0 = centerX - w / 2;
  const y0 = feetY - h;
  for (let row = 0; row < HERO_IDLE.length; row += 1) {
    const line = HERO_IDLE[row]!;
    for (let col = 0; col < line.length; col += 1) {
      const fill = HERO_PALETTE[line[col]!];
      if (!fill) continue;
      let rects = byColor.get(fill);
      if (!rects) byColor.set(fill, (rects = new Rects()));
      rects.add(x0 + col * HERO_SCALE, y0 + row * HERO_SCALE, HERO_SCALE, HERO_SCALE);
    }
  }
  for (const [fill, rects] of byColor) appendPath(doc, parent, rects.path, fill);
}

/**
 * The blocked path: a hazard barrier across the route, in light grey and dark
 * teal. It says "this way goes nowhere" by shape, not by colour — and it is not
 * orange, because orange in this game only ever means value.
 */
function barrier(doc: Document, parent: Element, x: number, width: number): void {
  const boardTop = GROUND_Y - 96;
  const boardH = 44;
  // Dark posts, then a LIGHT board with dark stripes across it. The first
  // version had it the other way round — light stripes on a dark board — and
  // under the overlay's 4px dither it read as four loose grey squares instead of
  // one object. A solid bright bar survives the wash; fine detail does not.
  const posts = new Rects();
  posts.add(x + 10, boardTop, 12, 96);
  posts.add(x + width - 22, boardTop, 12, 96);
  appendPath(doc, parent, posts.path, '#07222A');

  const board = new Rects();
  board.add(x, boardTop, width, boardH);
  appendPath(doc, parent, board.path, BRAND.LIGHT_GREY);

  const stripes = new Rects();
  for (let sx = x + 20; sx < x + width - 12; sx += 48) {
    stripes.add(sx, boardTop, Math.min(20, x + width - 12 - sx), boardH);
  }
  appendPath(doc, parent, stripes.path, '#07222A');
}

/**
 * The scene behind the copy: sky bands, two ranks of city, the ground band, the
 * hero stopped at a barrier. Decorative, so it is `aria-hidden` — the page's
 * meaning is entirely in the text.
 */
function createScene(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'beam-run__scene');
  svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
  // Belt and braces: if an engine ever resolves the box to something other than
  // the strip's own aspect, keep the ground on the floor and the hero on screen
  // instead of letterboxing the scene into the middle.
  svg.setAttribute('preserveAspectRatio', 'xMinYMax meet');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  cityLayer(doc, svg, 7, {
    body: CITY.farBody,
    window: CITY.farWindow,
    minH: 90,
    maxH: 220,
    step: 96,
    clear: CLEAR_SPAN,
  });
  cityLayer(doc, svg, 31, {
    body: CITY.nearBody,
    window: CITY.nearWindow,
    minH: 50,
    maxH: 130,
    step: 132,
    clear: CLEAR_SPAN,
  });

  const ground = new Rects();
  ground.add(0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y);
  appendPath(doc, svg, ground.path, GROUND.face);

  const cap = new Rects();
  cap.add(0, GROUND_Y, VIEW_W, 6);
  appendPath(doc, svg, cap.path, GROUND.cap);

  const courses = new Rects();
  for (let y = GROUND_Y + 40; y < VIEW_H; y += 40) courses.add(0, y, VIEW_W, 2);
  appendPath(doc, svg, courses.path, GROUND.course);

  const joints = new Rects();
  for (let y = GROUND_Y + 6; y < VIEW_H; y += 40) {
    const offset = ((y - GROUND_Y) / 40) % 2 === 0 ? 0 : 20;
    for (let x = offset; x < VIEW_W; x += 40) joints.add(x, y, 2, 34);
  }
  appendPath(doc, svg, joints.path, GROUND.joint);

  // The hero has walked to the end of the road: barrier ahead, nothing past it.
  barrier(doc, svg, BARRIER_X, BARRIER_W);
  hero(doc, svg, STAGE_LEFT, GROUND_Y);

  return svg;
}

// --- page -------------------------------------------------------------------

export interface NotFoundOptions {
  /**
   * Where the primary button goes. Absolute (`/`) by default: a 404 is served
   * for any path, so a relative link would point at a sibling of whatever the
   * visitor mistyped.
   */
  homeHref?: string;
  /** Optional CSS transform — the build script passes the project's minifier. */
  minifyCss?: (css: string) => string;
}

/** Build the page body: the stage, the scene, and the overlay carrying the copy. */
export function createNotFoundBody(doc: Document, homeHref = '/'): HTMLElement {
  const root = doc.createElement('main');
  root.className = 'beam-run beam-run--404';

  const stage = doc.createElement('div');
  stage.className = 'beam-run__stage';

  const sky = doc.createElement('div');
  sky.className = 'beam-run__sky';
  sky.setAttribute('aria-hidden', 'true');
  stage.append(sky, createScene(doc));

  // No landmark role here: the <main> above is the landmark, and the overlay is
  // a layout layer, not a dialog (nothing to dismiss on a static page).
  const overlay = doc.createElement('div');
  overlay.className =
    'beam-run__overlay beam-run__overlay--scene beam-run__overlay--start beam-run__overlay--visible';

  overlay.appendChild(createBrandLockup(doc, { title: COPY.meta.edition }));

  const stack = doc.createElement('div');
  stack.className = 'beam-run__stack beam-run__stack--start';

  // The figure, set like the start screen's stake: one hidden sentence for
  // assistive tech, the bitmap art beside it.
  const code = doc.createElement('p');
  code.className = 'beam-run__stake';
  const codeSr = doc.createElement('span');
  codeSr.className = 'beam-run__sr';
  codeSr.textContent = COPY.notFound.codeLabel;
  const codeFigure = doc.createElement('span');
  codeFigure.className = 'beam-run__stake-figure';
  codeFigure.appendChild(createPixelSvg(doc, [COPY.notFound.code], { ...PX_TYPE.code, ...TITLE_INK }));
  code.append(codeSr, codeFigure);

  const title = createPixelHeading(doc, 'h1', 'beam-run__title', COPY.notFound.title, ['OFF THE MAP'], {
    ...PX_TYPE.title,
    ...TITLE_INK,
  });

  const body = doc.createElement('p');
  body.className = 'beam-run__subtitle';
  body.textContent = COPY.notFound.body;

  const actions = doc.createElement('div');
  actions.className = 'beam-run__actions';
  const home = doc.createElement('a');
  home.className = 'beam-run__btn beam-run__btn--primary';
  home.setAttribute('href', homeHref);
  home.textContent = COPY.notFound.play;
  actions.appendChild(home);

  stack.append(code, title, body, actions);
  overlay.appendChild(stack);
  stage.appendChild(overlay);
  root.appendChild(stage);
  return root;
}

/**
 * Render the complete, self-contained `404.html`.
 *
 * `host` is only used for its DOM implementation; the page is built in a fresh
 * document, so this never touches the calling document.
 */
export function buildNotFoundHtml(host: Document, opts: NotFoundOptions = {}): string {
  const doc = host.implementation.createHTMLDocument(COPY.notFound.pageTitle);
  doc.documentElement.setAttribute('lang', 'en');

  const meta = (attrs: Record<string, string>): void => {
    const el = doc.createElement('meta');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    doc.head.insertBefore(el, doc.head.firstChild);
  };
  // Inserted at the front in reverse order, so charset ends up first.
  meta({ name: 'robots', content: 'noindex' });
  meta({ name: 'color-scheme', content: 'dark' });
  meta({ name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' });
  meta({ charset: 'utf-8' });

  const style = doc.createElement('style');
  const css = `${CSS}\n${PAGE_CSS}`;
  style.textContent = opts.minifyCss ? opts.minifyCss(css) : css;
  doc.head.appendChild(style);

  doc.body.appendChild(createNotFoundBody(doc, opts.homeHref ?? '/'));

  return `<!doctype html>\n${doc.documentElement.outerHTML}\n`;
}
