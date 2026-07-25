/**
 * finale.ts — painting the ANSR Tech Park arrival.
 *
 * The finale used to be the odd one out: smooth CSS-style gradients (sky, glass
 * body, bloom) dropped into a game drawn entirely in chunky pixels, with a single
 * flat tower on an empty slab. It is also the *payoff* of the whole run, so it
 * should be the best-looking screen in the game, not the sparsest.
 *
 * This paints the same scene in the game's own idiom: a stepped dawn sky with
 * dither, a banded rising sun, a distant skyline for depth, then a built tower —
 * mullions, courses, lit panes, a stepped crown with a blinking beacon, a signed
 * facade carrying the real ANSR mark, and a warm doorway that spills light onto
 * the pavement. The plaza gets lamps, planters, a welcoming crowd and the logo
 * inlaid in the floor.
 *
 * Layout comes from `core/finaleScene` (pure); this module only draws. Every
 * animated element is gated on `reduced` — the scene is composed to look right
 * frozen.
 */
import type { FinaleLayout } from '../core/finaleScene';
import { RESOLUTION } from '../data/tuning.config';
import { hash2, pxRect } from './PixelArt';
import { drawText } from './PixelText';
import { drawAnsrLogo } from './ansrLogo';
import { drawTileRect } from './scenery';

const { WIDTH: W } = RESOLUTION;

/** Chunky pixel size for the finale's own texture work. */
const PX = 4;

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
}

function drawSky(ctx: CanvasRenderingContext2D, l: FinaleLayout): void {
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
}

/** Distant city: flat silhouettes with a few lit windows, never above the tower. */
function drawSkyline(ctx: CanvasRenderingContext2D, l: FinaleLayout): void {
  for (const b of l.skyline) {
    ctx.fillStyle = '#062B36';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    pxRect(ctx, '#0A3B48', b.x, b.y, b.w, PX, PX); // roof catch-light
    for (let wy = b.y + 12; wy < l.horizonY - 14; wy += 18) {
      for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 16) {
        const n = hash2(wx, wy);
        if (n > 0.42) continue;
        pxRect(ctx, `rgba(255,190,110,${(0.18 + n * 0.5).toFixed(2)})`, wx, wy, 6, 8, 2);
      }
    }
  }
}

/** A lamp post with a warm pixel glow. */
function drawLamp(ctx: CanvasRenderingContext2D, x: number, baseY: number, h: number): void {
  pxRect(ctx, '#0B3742', x - 3, baseY - h, 6, h, 3); // pole
  pxRect(ctx, '#12586B', x - 10, baseY - h - 8, 20, 8, 4); // head
  const glow = ctx.createRadialGradient(x, baseY - h - 4, 0, x, baseY - h - 4, 46);
  glow.addColorStop(0, 'rgba(255, 200, 130, 0.34)');
  glow.addColorStop(1, 'rgba(255, 200, 130, 0)');
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

/** A person silhouette (the welcome party). */
function drawPerson(ctx: CanvasRenderingContext2D, x: number, baseY: number, tone: number): void {
  const body = tone === 0 ? '#0B3B45' : '#0E4854';
  pxRect(ctx, body, x + 2, baseY - 44, 12, 12, 3); // head
  pxRect(ctx, body, x - 3, baseY - 31, 22, 22, 3); // torso
  pxRect(ctx, body, x, baseY - 9, 7, 9, 3); // legs
  pxRect(ctx, body, x + 10, baseY - 9, 7, 9, 3);
}

function drawPlaza(ctx: CanvasRenderingContext2D, l: FinaleLayout, t: number, reduced: boolean): void {
  // The plaza is the level's own ground material (brightest pavers of the six),
  // so the finish line looks like the same world, finally finished.
  drawTileRect(ctx, 5, l.plaza.x, l.plaza.y, l.plaza.w, l.plaza.h);

  // Wet-pavement reflections: the tower's light streaking down the stone.
  const reflect = (x: number, w: number, alpha: number): void => {
    const g = ctx.createLinearGradient(0, l.plaza.y, 0, l.plaza.y + l.plaza.h);
    g.addColorStop(0, `rgba(255, 200, 130, ${alpha})`);
    g.addColorStop(1, 'rgba(255, 200, 130, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, l.plaza.y, w, l.plaza.h);
  };
  reflect(l.entrance.x, l.entrance.w, 0.3);
  reflect(l.tower.x + 18, 10, 0.12);
  reflect(l.tower.x + l.tower.w - 28, 10, 0.12);

  // Inlaid logo medallion: a dark disc in the pavement carrying the mark.
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

function drawTower(ctx: CanvasRenderingContext2D, l: FinaleLayout, t: number, reduced: boolean): void {
  const tw = l.tower;
  const cx = tw.x + tw.w / 2;

  // Body: three flat vertical bands (lit face, core, shaded face) instead of a
  // gradient, then mullions and floor courses so it reads as built.
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
  // Outline + a bright edge on the sun side.
  pxRect(ctx, 'rgba(230, 230, 230, 0.32)', tw.x, tw.y, tw.w, 3, 3);
  pxRect(ctx, 'rgba(255, 190, 110, 0.35)', tw.x + tw.w - 4, tw.y, 4, tw.h, 4);

  // Lit panes, each on a slow independent cycle (steady under reduced motion).
  for (let i = 0; i < l.windows.length; i += 1) {
    const win = l.windows[i]!;
    const n = hash2(Math.round(win.x), Math.round(win.y));
    const lit = reduced ? 0.42 + n * 0.3 : 0.3 + 0.34 * (0.5 + 0.5 * Math.sin(t * 1.1 + n * 30));
    pxRect(ctx, `rgba(255, 190, 110, ${lit.toFixed(2)})`, win.x, win.y, win.w, win.h, 2);
    pxRect(ctx, 'rgba(0, 20, 26, 0.4)', win.x, win.y + win.h - 2, win.w, 2, 2); // sill
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
  pxRect(ctx, '#FF5400', l.beacon.x - 4, l.beacon.y - 4, 8, 8, 4);

  // Signed facade: dark panel, the real ANSR mark, wordmark in the pixel font.
  const s = l.sign;
  pxRect(ctx, 'rgba(0, 22, 29, 0.9)', s.x, s.y, s.w, s.h, PX);
  pxRect(ctx, 'rgba(240, 87, 34, 0.55)', s.x, s.y, s.w, 3, 3);
  pxRect(ctx, 'rgba(240, 87, 34, 0.55)', s.x, s.y + s.h - 3, s.w, 3, 3);
  drawAnsrLogo(ctx, l.mark.x, l.mark.y, l.mark.r * 2, reduced ? 0 : t * 0.05);
  drawText(ctx, 'ANSR', l.mark.x + 34, s.y + 18, { scale: 4, color: '#FFFFFF' });

  // Entrance: dark opening, warm interior light, doors, canopy and a plaque.
  const e = l.entrance;
  pxRect(ctx, '#00181F', e.x, e.y, e.w, e.h, PX);
  const inner = ctx.createLinearGradient(0, e.y, 0, e.y + e.h);
  inner.addColorStop(0, 'rgba(255, 200, 130, 0.5)');
  inner.addColorStop(1, 'rgba(255, 200, 130, 0.16)');
  ctx.fillStyle = inner;
  ctx.fillRect(e.x + 6, e.y + 10, e.w - 12, e.h - 10);
  pxRect(ctx, 'rgba(0, 24, 31, 0.75)', e.x + e.w / 2 - 2, e.y + 10, 4, e.h - 10, 4); // door split
  const c = l.canopy;
  pxRect(ctx, '#12586B', c.x, c.y, c.w, c.h, PX);
  pxRect(ctx, '#5CE2F4', c.x, c.y, c.w, 3, 3);
  drawText(ctx, 'TECH PARK', cx, c.y - 16, {
    scale: 2,
    color: '#CFE6EC',
    align: 'center',
    outline: 'rgba(0,20,26,0.9)',
  });

  // Light spilling out of the doorway onto the plaza.
  const spill = ctx.createLinearGradient(0, e.y + e.h - 40, 0, l.horizonY + 60);
  spill.addColorStop(0, 'rgba(255, 200, 130, 0.28)');
  spill.addColorStop(1, 'rgba(255, 200, 130, 0)');
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
  drawSky(ctx, l);
  drawSun(ctx, l.sun.x, l.sun.y, l.sun.r);

  // Warm dawn wash sitting between the sun and the city.
  const dawn = ctx.createRadialGradient(l.sun.x, l.horizonY, 0, l.sun.x, l.horizonY, 520);
  dawn.addColorStop(0, 'rgba(255, 84, 0, 0.22)');
  dawn.addColorStop(1, 'rgba(255, 84, 0, 0)');
  ctx.fillStyle = dawn;
  ctx.fillRect(0, 0, W, l.horizonY);

  drawSkyline(ctx, l);

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
  for (const lamp of l.lamps) drawLamp(ctx, lamp.x, l.horizonY, lamp.h);
  for (const p of l.planters) drawPlanter(ctx, p.x, l.horizonY);
  for (const p of l.people) drawPerson(ctx, p.x, l.horizonY, p.tone);

  // A hard bright line where the plaza meets the sky: the finished ground.
  pxRect(ctx, 'rgba(92, 226, 244, 0.85)', 0, l.horizonY, W, 3, 3);

  // Embers drifting up from the doorway light — the only free-floating motion.
  if (!reduced) {
    for (let i = 0; i < 14; i += 1) {
      const seed = hash2(i * 13 + 1, 9);
      const x = l.entrance.x - 30 + seed * (l.entrance.w + 60);
      const span = 220;
      const y = l.horizonY - ((t * (26 + seed * 34) + seed * span) % span);
      const a = 0.42 * (1 - (l.horizonY - y) / span);
      pxRect(ctx, `rgba(255, 200, 130, ${a.toFixed(2)})`, x, y, 3, 3, 3);
    }
  }
}
