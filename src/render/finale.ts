/**
 * finale.ts — painting the ANSR Tech Park arrival.
 *
 * This is the payoff of the whole run, so it should be the best-looking screen
 * in the game. It is painted in the game's own idiom (chunky pixels, no smooth
 * gradients where a band will do): a stepped dawn sky with dither and a big
 * banded sun, a distant city for depth, the ANSR campus stepping up towards the
 * hero tower, and a built tower — mullions, courses, lit panes, a stepped crown
 * with a blinking beacon, a signed facade carrying the real ANSR mark, and a
 * warm doorway that spills light onto the pavement. The plaza gets an entry
 * gate, a lit runner up to the doors, lamps, planters, a welcoming crowd and the
 * logo inlaid in the floor.
 *
 * Lighting is consistent and deliberate: the sun sits directly behind the tower,
 * so the tower is rim-lit on BOTH edges (contre-jour) while everything to its
 * left catches the dawn on its right-hand edge.
 *
 * Layout comes from `core/finaleScene` (pure); this module only draws. Every
 * animated element is gated on `reduced` — the scene is composed to look right
 * frozen.
 */
import type { CampusBlock, FinaleLayout } from '../core/finaleScene';
import { RESOLUTION } from '../data/tuning.config';
import { drawBricks, hash2, pxRect, type BrickOptions } from './PixelArt';
import { drawText } from './PixelText';
import { drawAnsrLogo } from './ansrLogo';

const { WIDTH: W } = RESOLUTION;

/** Chunky pixel size for the finale's own texture work. */
const PX = 4;
/** Warm dawn light (the sun, the windows, the doorway all share it). */
const WARM = '255, 190, 110';

/**
 * Plaza pavers: the level-5 cyan family, but as big quiet slabs. The shipped
 * tile material (40×20 bricks, 5% speckle, #46C4DA highlights) is tuned to make
 * a *platform* pop against a backdrop; across the full width of the finale's
 * ground band it shouted over the tower.
 */
const PAVERS: BrickOptions = {
  px: 4,
  brickW: 80,
  brickH: 26,
  speckle: 0.012,
  face: '#0F6C82',
  shade: '#0A5064',
  highlight: '#2790A6',
  mortar: '#073A47',
};

/** Banded "retro sun": rows of rects with slits through the lower half. */
function drawSun(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  for (let y = -r; y < r; y += PX) {
    if (y > 0 && Math.floor(y / (PX * 2)) % 2 === 1) continue;
    const half = Math.sqrt(Math.max(0, r * r - y * y));
    if (half < PX) continue;
    const up = (y + r) / (2 * r);
    const color = up < 0.34 ? '#B4551F' : up < 0.68 ? '#C7601F' : '#D96A22';
    pxRect(ctx, color, cx - half, cy + y, half * 2, PX, PX);
  }
  // Two banded halo arcs outside the disc: cheap radiance that reads at 8-bit
  // resolution, and it widens the sun past the tower silhouette on both sides.
  for (const [ring, alpha] of [
    [r + 16, 0.16],
    [r + 34, 0.09],
  ] as const) {
    for (let y = -ring; y < 0; y += PX * 2) {
      const half = Math.sqrt(Math.max(0, ring * ring - y * y));
      if (half < PX) continue;
      pxRect(ctx, `rgba(217, 106, 34, ${alpha})`, cx - half, cy + y, half * 2, PX, PX);
    }
  }
}

function drawSky(ctx: CanvasRenderingContext2D, l: FinaleLayout, t: number, reduced: boolean): void {
  for (const band of l.skyBands) {
    ctx.fillStyle = band.color;
    ctx.fillRect(0, band.y, W, band.h);
  }
  // Ordered dither along each seam so the steps read as deliberate, not banding.
  for (let i = 1; i < l.skyBands.length; i += 1) {
    const band = l.skyBands[i]!;
    ctx.fillStyle = l.skyBands[i - 1]!.color;
    for (let x = 0; x < W; x += PX * 2) {
      if (hash2(x >> 3, i) < 0.55) ctx.fillRect(x, band.y, PX, PX);
    }
  }
  // The last few stars, high up and only well away from the sunrise — enough to
  // date the moment as early morning without making the payoff read as night.
  for (let i = 0; i < 22; i += 1) {
    const n = hash2(i * 19 + 3, 61);
    const m = hash2(i * 29 + 5, 67);
    const sx = Math.floor(n * W);
    if (sx > l.sun.x - l.sun.r - 60) continue; // the dawn has washed these out
    let a = 0.08 + m * 0.22;
    if (!reduced) a *= 0.6 + 0.4 * Math.sin(t * 1.5 + n * 40);
    pxRect(ctx, `rgba(207,230,236,${a.toFixed(2)})`, sx, Math.floor(m * 150) + 10, 3, 3, 3);
  }
}

/** Distant city: flat silhouettes with a few lit windows, behind the campus. */
function drawSkyline(ctx: CanvasRenderingContext2D, l: FinaleLayout): void {
  for (const b of l.skyline) {
    ctx.fillStyle = '#062B36';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    pxRect(ctx, '#0A3B48', b.x, b.y, b.w, PX, PX); // roof catch-light
    pxRect(ctx, `rgba(${WARM}, 0.12)`, b.x + b.w - 3, b.y, 3, b.h, 3); // dawn edge
    for (let wy = b.y + 12; wy < l.horizonY - 14; wy += 18) {
      for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 16) {
        const n = hash2(wx, wy);
        if (n > 0.42) continue;
        pxRect(ctx, `rgba(${WARM},${(0.18 + n * 0.5).toFixed(2)})`, wx, wy, 6, 8, 2);
      }
    }
  }
}

/**
 * Mid-ground: the rest of the campus. Nearer than the skyline (darker, more
 * contrast, bigger windows) and each block a little taller and a little more
 * awake than the last, so the row walks the eye towards the tower.
 */
function drawCampus(
  ctx: CanvasRenderingContext2D,
  l: FinaleLayout,
  t: number,
  reduced: boolean,
): void {
  const roofProp = (b: CampusBlock): void => {
    const rw = Math.round(b.w * 0.3);
    pxRect(ctx, '#04303C', b.x + Math.round(b.w * 0.24), b.y - 14, rw, 14, PX);
    pxRect(ctx, '#0B3742', b.x + Math.round(b.w * 0.7), b.y - 26, 6, 26, PX);
  };
  for (const b of l.campus) {
    roofProp(b);
    ctx.fillStyle = '#04303C';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    pxRect(ctx, '#0A4553', b.x, b.y, b.w, PX, PX); // parapet
    pxRect(ctx, `rgba(${WARM}, 0.16)`, b.x + b.w - PX, b.y, PX, b.h, PX); // dawn edge
    pxRect(ctx, 'rgba(0, 20, 26, 0.4)', b.x, b.y, 3, b.h, 3); // shaded edge
    for (let wy = b.y + 18; wy < l.horizonY - 40; wy += 24) {
      for (let wx = b.x + 12; wx < b.x + b.w - 16; wx += 20) {
        const n = hash2(wx, wy);
        if (n > b.lit) continue;
        const flick = reduced ? 1 : 0.72 + 0.28 * Math.sin(t * 0.8 + n * 40);
        pxRect(ctx, `rgba(159,216,228,${(0.5 * flick).toFixed(2)})`, wx, wy, 8, 11, 2);
      }
    }
    // A warm lit ground floor ties the campus to the plaza light, and the ones
    // nearest the tower carry an orange sign band — that is what separates the
    // ANSR campus from the anonymous market skyline behind it.
    pxRect(ctx, `rgba(${WARM}, 0.26)`, b.x + 8, l.horizonY - 26, b.w - 16, 14, PX);
    if (b.lit > 0.55) {
      pxRect(ctx, 'rgba(240, 87, 34, 0.5)', b.x + 12, b.y + 14, b.w - 24, 5, PX);
    }
  }
}

/** A lamp post with a warm pixel glow. */
function drawLamp(ctx: CanvasRenderingContext2D, x: number, baseY: number, h: number): void {
  pxRect(ctx, '#0B3742', x - 3, baseY - h, 6, h, 3); // pole
  pxRect(ctx, '#12586B', x - 10, baseY - h - 8, 20, 8, 4); // head
  const glow = ctx.createRadialGradient(x, baseY - h - 4, 0, x, baseY - h - 4, 46);
  glow.addColorStop(0, `rgba(${WARM}, 0.34)`);
  glow.addColorStop(1, `rgba(${WARM}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, baseY - h - 4, 46, 0, Math.PI * 2);
  ctx.fill();
  pxRect(ctx, '#FFD9A8', x - 6, baseY - h - 6, 12, 4, 2); // lit bulb face
}

/** A planter with pixel greenery — the plaza is landscaped, not a car park. */
function drawPlanter(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  pxRect(ctx, '#0F5A6C', x - 22, baseY - 18, 44, 18, 3); // trough
  pxRect(ctx, '#1B7B90', x - 22, baseY - 18, 44, 4, 2); // rim
  pxRect(ctx, '#0F6B4E', x - 16, baseY - 40, 32, 24, 4); // foliage
  pxRect(ctx, '#14895F', x - 10, baseY - 46, 20, 12, 4);
  pxRect(ctx, '#083726', x - 12, baseY - 30, 22, 10, 4); // shade
}

/**
 * A person (the welcome party). At #0B3B45/#0E4854 against the tower base and
 * the campus — both dark teal — the crowd was effectively invisible. They are
 * now near-black silhouettes with a warm rim from the doorway and a cast
 * shadow, so they read against anything, and the two tones differ enough to
 * make a group rather than a smudge.
 */
function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  tone: number,
  waving: boolean,
): void {
  const body = tone === 0 ? '#021A21' : '#0A3945';
  const h = tone === 0 ? 50 : 46; // two heights, so the group isn't a picket fence
  const top = baseY - h;
  const rim = `rgba(${WARM}, 0.55)`;
  pxRect(ctx, 'rgba(0, 20, 26, 0.4)', x - 4, baseY - 3, 26, 4, 2); // cast shadow
  pxRect(ctx, body, x + 4, top, 10, 10, 2); // head (narrower than the shoulders)
  pxRect(ctx, body, x, top + 12, 18, h - 12 - 10, 2); // torso
  pxRect(ctx, body, x + 1, baseY - 10, 6, 10, 2); // legs, with a gap between
  pxRect(ctx, body, x + 11, baseY - 10, 6, 10, 2);
  if (waving) {
    pxRect(ctx, body, x + 18, top + 4, 5, 14, 2); // raised arm — a welcome, static
  } else {
    pxRect(ctx, body, x + 18, top + 14, 4, 14, 2);
  }
  pxRect(ctx, rim, x > 1040 ? x - 2 : x + 22, top, 3, h - 10, 3); // doorway rim
  pxRect(ctx, `rgba(${WARM}, 0.3)`, x + 4, top, 10, 3, 3); // catch-light on the head
}

/**
 * The campus entry gate. The player spawns just left of it and runs through, so
 * the place is named at the moment of arrival, not only at the tower 900px away.
 */
function drawGate(ctx: CanvasRenderingContext2D, l: FinaleLayout): void {
  const { header: hd, legs } = l.gate;
  for (const leg of legs) {
    pxRect(ctx, '#0C4453', leg.x, leg.y, leg.w, leg.h, PX);
    pxRect(ctx, `rgba(${WARM}, 0.18)`, leg.x + leg.w - PX, leg.y, PX, leg.h, PX);
    pxRect(ctx, '#12586B', leg.x - 4, leg.y + leg.h - 10, leg.w + 8, 10, PX); // footing
  }
  pxRect(ctx, '#0C4453', hd.x, hd.y, hd.w, hd.h, PX);
  pxRect(ctx, '#5CE2F4', hd.x, hd.y, hd.w, 3, 3);
  pxRect(ctx, 'rgba(240, 87, 34, 0.6)', hd.x, hd.y + hd.h - 3, hd.w, 3, 3);
  drawText(ctx, 'ANSR TECH PARK', hd.x + hd.w / 2, hd.y + 10, {
    scale: 2,
    color: '#CFE6EC',
    align: 'center',
  });
}

function drawPlaza(
  ctx: CanvasRenderingContext2D,
  l: FinaleLayout,
  t: number,
  reduced: boolean,
): void {
  // The plaza keeps the level-5 hue family (the finish is the same world,
  // finally finished) but not its literal tile material: at 40px bricks with
  // heavy speckle the ground band was the loudest thing in the picture and read
  // as a wall, pulling the eye off the tower. Big calm slabs instead, with the
  // bright walkable cap that doubles as the horizon line.
  drawBricks(ctx, l.plaza.x, l.plaza.y, l.plaza.w, l.plaza.h, PAVERS);
  ctx.fillStyle = '#5CE2F4';
  ctx.fillRect(l.plaza.x, l.plaza.y, l.plaza.w, 3);

  // The path from the gate to the doors: the value route. Two earlier attempts
  // were worse than nothing — a translucent orange bar just blended to grey on
  // cyan pavers, and an opaque jointed one read as a chocolate slab lying across
  // the plaza, dragging the eye sideways instead of towards the doors. It is now
  // a shallow inlay channel with warm chevrons stepping towards the entrance:
  // directional, low-contrast, and the same "this way" device the attract screen
  // uses. It stops short of the medallion so the two do not collide.
  const c = l.carpet;
  const midY = c.y + c.h / 2;
  pxRect(ctx, '#0A5064', c.x, midY - 12, c.w, 24, PX);
  pxRect(ctx, 'rgba(0, 26, 34, 0.35)', c.x, midY + 8, c.w, 4, PX);
  const chevron = `rgba(${WARM}, 0.5)`;
  for (let x = c.x + 18; x < c.x + c.w - 120; x += 60) {
    pxRect(ctx, chevron, x, midY - 10, 4, 4, 4);
    pxRect(ctx, chevron, x + 4, midY - 6, 4, 4, 4);
    pxRect(ctx, chevron, x + 8, midY - 2, 4, 4, 4);
    pxRect(ctx, chevron, x + 4, midY + 2, 4, 4, 4);
    pxRect(ctx, chevron, x, midY + 6, 4, 4, 4);
  }

  // Wet-pavement reflections: the tower's light streaking down the stone.
  const reflect = (x: number, w: number, alpha: number): void => {
    const g = ctx.createLinearGradient(0, l.plaza.y, 0, l.plaza.y + l.plaza.h);
    g.addColorStop(0, `rgba(${WARM}, ${alpha})`);
    g.addColorStop(1, `rgba(${WARM}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, l.plaza.y, w, l.plaza.h);
  };
  reflect(l.entrance.x, l.entrance.w, 0.3);
  reflect(l.tower.x + 18, 10, 0.12);
  reflect(l.tower.x + l.tower.w - 28, 10, 0.12);

  // Inlaid logo medallion: a dark disc in the pavement carrying the mark, right
  // in front of the doors where the run ends and the eye lands.
  const m = l.medallion;
  ctx.fillStyle = 'rgba(0, 26, 34, 0.72)';
  ctx.beginPath();
  ctx.ellipse(m.x, m.y, m.r * 1.5, m.r * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  // Squashed vertically so it reads as lying flat on the ground.
  ctx.translate(m.x, m.y);
  ctx.scale(1, 0.44);
  drawAnsrLogo(ctx, 0, 0, m.r * 2, reduced ? 0 : t * 0.04, 'rgba(240, 87, 34, 0.85)');
  ctx.restore();
}

function drawTower(
  ctx: CanvasRenderingContext2D,
  l: FinaleLayout,
  t: number,
  reduced: boolean,
): void {
  const tw = l.tower;
  const cx = tw.x + tw.w / 2;

  // Body: three flat vertical bands instead of a gradient, then mullions and
  // floor courses so it reads as built. The sun is directly behind, so the
  // shaded faces are the outer thirds and both edges carry a warm rim.
  const third = Math.round(tw.w / 3);
  ctx.fillStyle = '#0A5566';
  ctx.fillRect(tw.x, tw.y, tw.w, tw.h);
  ctx.fillStyle = '#013947';
  ctx.fillRect(tw.x, tw.y, third, tw.h);
  ctx.fillStyle = '#02485A';
  ctx.fillRect(tw.x + tw.w - third, tw.y, third, tw.h);
  for (let x = tw.x + 20; x < tw.x + tw.w - 8; x += 40) {
    pxRect(ctx, 'rgba(159, 216, 228, 0.18)', x, tw.y, 3, tw.h, 3);
  }
  for (let y = tw.y + 34; y < tw.y + tw.h - 8; y += 34) {
    pxRect(ctx, 'rgba(0, 20, 26, 0.35)', tw.x, y, tw.w, 3, 3);
  }
  pxRect(ctx, 'rgba(230, 230, 230, 0.32)', tw.x, tw.y, tw.w, 3, 3);
  pxRect(ctx, `rgba(${WARM}, 0.4)`, tw.x, tw.y, PX, tw.h, PX);
  pxRect(ctx, `rgba(${WARM}, 0.4)`, tw.x + tw.w - PX, tw.y, PX, tw.h, PX);

  // Panes. A warm colour at 0.3–0.64 alpha over the teal body blended to a
  // muddy olive and — with every single pane lit — the facade read as a
  // spreadsheet. Lit panes are now nearly opaque cream (so they actually glow)
  // and roughly a third are dark glass, which gives the tower a population.
  for (let i = 0; i < l.windows.length; i += 1) {
    const win = l.windows[i]!;
    const n = hash2(Math.round(win.x), Math.round(win.y));
    if (n < 0.3) {
      pxRect(ctx, 'rgba(0, 26, 34, 0.5)', win.x, win.y, win.w, win.h, 2); // dark glass
      pxRect(ctx, 'rgba(159, 216, 228, 0.14)', win.x, win.y, win.w, 2, 2); // sky catch
      continue;
    }
    const cycle = reduced ? 0.5 + n * 0.5 : 0.5 + 0.5 * Math.sin(t * 1.1 + n * 30);
    const lit = 0.72 + 0.26 * cycle;
    pxRect(ctx, `rgba(255, 216, 158, ${lit.toFixed(2)})`, win.x, win.y, win.w, win.h, 2);
    pxRect(ctx, 'rgba(255, 244, 220, 0.7)', win.x, win.y, win.w, 2, 2); // bright head
    pxRect(ctx, 'rgba(0, 20, 26, 0.45)', win.x, win.y + win.h - 2, win.w, 2, 2); // sill
  }

  // Stepped crown + mast + beacon.
  const cr = l.crown;
  pxRect(ctx, '#02485A', cr.x, cr.y, cr.w, cr.h, PX);
  pxRect(ctx, '#0A5566', cr.x + 14, cr.y - 10, cr.w - 28, 10, PX);
  pxRect(ctx, 'rgba(92, 226, 244, 0.6)', cr.x, cr.y, cr.w, 3, 3);
  pxRect(ctx, '#0B3742', l.mast.x, l.mast.y, l.mast.w, l.mast.h, PX);
  const blink = reduced ? 1 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3));
  const bg = ctx.createRadialGradient(l.beacon.x, l.beacon.y, 0, l.beacon.x, l.beacon.y, 26);
  bg.addColorStop(0, `rgba(255, 84, 0, ${(0.55 * blink).toFixed(2)})`);
  bg.addColorStop(1, 'rgba(255, 84, 0, 0)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(l.beacon.x, l.beacon.y, 26, 0, Math.PI * 2);
  ctx.fill();
  // White-hot core inside an orange ring: a pure #FF5400 lamp disappeared
  // against the orange sun that now sits directly behind the mast.
  pxRect(ctx, '#FF5400', l.beacon.x - 6, l.beacon.y - 6, 12, 12, 3);
  pxRect(ctx, '#FFF1DC', l.beacon.x - 3, l.beacon.y - 3, 6, 6, 3);

  // Signed facade: dark panel, the real ANSR mark, wordmark in the pixel font.
  const s = l.sign;
  pxRect(ctx, 'rgba(0, 22, 29, 0.9)', s.x, s.y, s.w, s.h, PX);
  pxRect(ctx, 'rgba(240, 87, 34, 0.55)', s.x, s.y, s.w, 3, 3);
  pxRect(ctx, 'rgba(240, 87, 34, 0.55)', s.x, s.y + s.h - 3, s.w, 3, 3);
  drawAnsrLogo(ctx, l.mark.x, l.mark.y, l.mark.r * 2, reduced ? 0 : t * 0.05);
  drawText(ctx, 'ANSR', l.mark.x + l.mark.r + 14, l.mark.y - 14, { scale: 4, color: '#FFFFFF' });

  // Entrance: dark opening, warm interior light, doors, canopy and a plaque.
  const e = l.entrance;
  pxRect(ctx, '#00181F', e.x, e.y, e.w, e.h, PX);
  const inner = ctx.createLinearGradient(0, e.y, 0, e.y + e.h);
  inner.addColorStop(0, `rgba(${WARM}, 0.92)`);
  inner.addColorStop(1, `rgba(${WARM}, 0.42)`);
  ctx.fillStyle = inner;
  ctx.fillRect(e.x + 6, e.y + 10, e.w - 12, e.h - 10);
  // A silhouetted reception desk inside, so the lobby is lit *and* occupied.
  pxRect(ctx, 'rgba(0, 26, 34, 0.55)', e.x + 14, e.y + e.h - 34, 26, 34, PX);
  pxRect(ctx, 'rgba(0, 26, 34, 0.4)', e.x + e.w - 34, e.y + e.h - 26, 22, 26, PX);
  pxRect(ctx, 'rgba(0, 24, 31, 0.75)', e.x + e.w / 2 - 2, e.y + 10, 4, e.h - 10, 4); // door split
  const c = l.canopy;
  pxRect(ctx, '#12586B', c.x, c.y, c.w, c.h, PX);
  pxRect(ctx, '#5CE2F4', c.x, c.y, c.w, 3, 3);
  // The doors are the finish line, so they carry the outcome, not the address
  // (the campus gate 900px back already says ANSR TECH PARK).
  drawText(ctx, 'GO LIVE', cx, c.y - 16, {
    scale: 2,
    color: '#CFE6EC',
    align: 'center',
    outline: 'rgba(0,20,26,0.9)',
  });

  // Light spilling out of the doorway onto the plaza.
  const spill = ctx.createLinearGradient(0, e.y + e.h - 40, 0, l.horizonY + 60);
  spill.addColorStop(0, `rgba(${WARM}, 0.28)`);
  spill.addColorStop(1, `rgba(${WARM}, 0)`);
  ctx.fillStyle = spill;
  ctx.beginPath();
  ctx.moveTo(e.x, e.y + e.h);
  ctx.lineTo(e.x + e.w, e.y + e.h);
  ctx.lineTo(e.x + e.w + 46, l.horizonY + 70);
  ctx.lineTo(e.x - 46, l.horizonY + 70);
  ctx.closePath();
  ctx.fill();
}

/** Paint the whole finale. `t` is a seconds clock; `reduced` freezes motion. */
export function drawFinaleScene(
  ctx: CanvasRenderingContext2D,
  l: FinaleLayout,
  t: number,
  reduced: boolean,
): void {
  drawSky(ctx, l, t, reduced);
  drawSun(ctx, l.sun.x, l.sun.y, l.sun.r);

  // Warm dawn wash sitting between the sun and the city.
  const dawn = ctx.createRadialGradient(l.sun.x, l.horizonY, 0, l.sun.x, l.horizonY, 620);
  dawn.addColorStop(0, 'rgba(255, 84, 0, 0.22)');
  dawn.addColorStop(1, 'rgba(255, 84, 0, 0)');
  ctx.fillStyle = dawn;
  ctx.fillRect(0, 0, W, l.horizonY);

  drawSkyline(ctx, l);
  drawCampus(ctx, l, t, reduced);

  // Bloom behind the crown, before the tower so it haloes rather than veils it.
  const pulse = reduced ? 1 : 0.86 + 0.14 * Math.sin(t * 1.6);
  const br = l.bloom.r * pulse;
  const bloom = ctx.createRadialGradient(l.bloom.x, l.bloom.y, 0, l.bloom.x, l.bloom.y, br);
  bloom.addColorStop(0, 'rgba(255, 84, 0, 0.42)');
  bloom.addColorStop(1, 'rgba(255, 84, 0, 0)');
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(l.bloom.x, l.bloom.y, br, 0, Math.PI * 2);
  ctx.fill();

  drawPlaza(ctx, l, t, reduced);
  drawTower(ctx, l, t, reduced);

  // Plaza furniture and the welcome party (behind the player, who draws later).
  drawGate(ctx, l);
  for (const lamp of l.lamps) drawLamp(ctx, lamp.x, l.horizonY, lamp.h);
  for (const p of l.planters) drawPlanter(ctx, p.x, l.horizonY);
  // The crowd stands 12px in front of the walking line, on the plaza apron: at
  // the ground line their near-black bodies sat entirely against the dark tower
  // base and the dark campus and read as smudges. Overlapping the bright pavers
  // silhouettes them, and being nearer than the player is the correct depth cue.
  l.people.forEach((p, i) => drawPerson(ctx, p.x, l.horizonY + 12, p.tone, i % 3 === 0));

  // Embers drifting up from the doorway light — the only free-floating motion.
  if (!reduced) {
    for (let i = 0; i < 14; i += 1) {
      const seed = hash2(i * 13 + 1, 9);
      const x = l.entrance.x - 30 + seed * (l.entrance.w + 60);
      const span = 220;
      const y = l.horizonY - ((t * (26 + seed * 34) + seed * span) % span);
      const a = 0.42 * (1 - (l.horizonY - y) / span);
      pxRect(ctx, `rgba(${WARM}, ${a.toFixed(2)})`, x, y, 3, 3, 3);
    }
  }
}
