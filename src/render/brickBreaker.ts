/**
 * brickBreaker.ts — THE ENGINE ROOM, painted.
 *
 * The secret stage under the ANSR Tech Park (owner call), and the one screen in the
 * game with a palette of its own: **indigo**, because it is a plant room under a
 * plaza rather than daylight, and because the four block colours have to be
 * distinguishable from each other *and* from the ANSR mark that breaks them. Orange
 * appears nowhere in here except the mark itself, which is the whole reason the room
 * is cool: the only warm thing on the frame is the thing the player is hitting the
 * wall with.
 *
 * Pure, like every other render module: it takes a snapshot and a clock, so it
 * rasterises on its own with no browser and no simulation. Two entry points, because
 * the hero is drawn by the host in between them — the room goes *behind* him and the
 * kit he is carrying goes *in front*:
 *
 *   drawEngineRoom()  → shell, services, racks, the shaft, the wall, the titles
 *   [host draws the hero]
 *   drawEngineRoomProps() → the skateboard, the arms, the tray, the mark, the miss
 *
 * Plus `drawTunnelHatch()`, which is the *other* screen's half of this feature: the
 * mouth cut into the Tech Park's pavement, quiet until somebody stands on it.
 *
 * ART RULES THIS SCREEN OBEYS (all of them paid for elsewhere — `docs/INVARIANTS.md`)
 *  - **A block is a section, not an outline.** Keyline, face, two lit edges, two
 *    shaded ones. A filled rectangle with words on it is a button.
 *  - **The label is ink on the block, at scale 2**, which is what fixes the block's
 *    size rather than the other way round: below scale 2 bitmap type is texture.
 *  - **Light is a surface.** The racks glow on their own faces, the shaft has a lit
 *    rim and a draught line; there are no beams and no low-alpha fields.
 *  - **Every animated thing is a function of a phase the host passes in**, so reduced
 *    motion is a constant rather than a special case.
 */
import { drawPixels, pxRect, drawBricks, hash2 } from './PixelArt';
import { drawText, drawLabelPlaque, measureText } from './PixelText';
import { drawAnsrBadgeMark, markSpin } from './badge';
import { BONUS, RESOLUTION } from '../data/tuning.config';
import type {
  BallState,
  BonusPhase,
  BrickState,
  CannonState,
  LostBallState,
  TrayState,
} from '../world/BrickBreaker';
import type { AABB } from '../world/Physics';

const R = BONUS.ROOM;
const C = BONUS.CANNON;
const BEAT = BONUS.BEAT;
const WALL_RIGHT = RESOLUTION.WIDTH - R.WALL;
const MOUTH_L = R.TUNNEL_CX - R.TUNNEL_W / 2;
const MOUTH_R = R.TUNNEL_CX + R.TUNNEL_W / 2;

/** One field cell. Everything here is a multiple of it. */
const P = 4;

/** The room's own palette. Indigo shell, mint plant, cyan for anything that moves air. */
const INK = '#080E1C';
const BACK = '#16213E';
const BACK_SHADE = '#0E1730';
const BACK_LIT = '#22315A';
const MORTAR = '#0B1122';
const STRUCT = '#243357';
const STRUCT_SHADE = '#141E3A';
const STRUCT_LIT = '#42598C';
const EDGE_LIT = '#6E8FCE';
const METAL = '#2E4166';
const METAL_LIT = '#4A6394';
const MINT = '#5FD39B';
const CYAN = '#5CE2F4';
const PALE = '#DCE8FF';

/**
 * The four block families, keyed by the `tone` on the block itself, so the colour
 * coding and the words are one decision in `tuning.config.ts` rather than two.
 *
 * Four hues, not four values: they are read across a 1200px wall in a glance, and
 * they have to separate from each other at the same time as staying off the value
 * accent. Cyan / mint / violet / magenta does that; the fifth candidate was amber and
 * amber is the reserved orange by another name (the Workplace barricade paid for that
 * lesson already).
 */
interface Tone {
  face: string;
  lit: string;
  shade: string;
}
const TONES: Record<string, Tone> = {
  FOOTPRINT: { face: '#3FC9E0', lit: '#A6ECF7', shade: '#22758B' },
  PEOPLE: { face: '#5FD39B', lit: '#B7F0D3', shade: '#2F7C58' },
  CAPABILITY: { face: '#9C8BEE', lit: '#D7CFFC', shade: '#584AA0' },
  RUN: { face: '#DE7FB6', lit: '#F7C8E2', shade: '#8B4670' },
};
const TONE_FALLBACK: Tone = { face: STRUCT, lit: STRUCT_LIT, shade: STRUCT_SHADE };

/** Ink for a label. Dark on a mid face, so the block reads as printed. */
const LABEL_INK = '#0C1428';

/** s a broken block's fragments are on screen for. Presentation only. */
const SHATTER_TIME = 0.26;

/**
 * The stage's name and the one line under it, drawn on the frame rather than on a
 * briefing card: this stage is a *secret*, and a card that stops the run to introduce
 * it would announce the thing the player has just discovered for themselves.
 *
 * The line names the argument and shares no word over three characters with the name
 * above it, which is the rule the six briefs follow.
 *
 * Both were rewritten when the owner rejected the old name (the reasoning is on
 * `COPY.bonus.name`, which this has to match — `brickBreaker.test.ts` says so, because
 * the HUD plaque reads the copy object and this literal is what the frame paints, and
 * two sources for one name is a name that eventually disagrees with itself).
 *
 * The line is the whole of what the stage argues, in seven words: go-live is a start
 * date, not a finish line. It replaced "LIVE IS WHERE THE WORK STARTS", which said the
 * same thing with a subordinate clause in the middle of it and no second half to land
 * on — and the comma is doing real work here, because the sentence is a contrast.
 */
export const STAGE_NAME = 'THE ENGINE ROOM';
export const STAGE_LINE = 'LIVE IS DAY ONE, NOT THE FINISH';

/** The prompt on the Tech Park's hatch. A verb, and the key beside it. */
const HATCH_PROMPT = 'DROP IN';

/**
 * Turns per second the mark spins **in this room** (owner call: rotate it here too, and
 * keep the speed on the higher side — but not so fast that the logo stops being visible).
 *
 * The host's phase advances at 0.3 turns/s, so 4 of them is 1.2 revolutions a second:
 * ~7 degrees a frame at 60Hz, against a ray pitch of 11.25. That is the ceiling this
 * number has, and it is a real one rather than a matter of taste — one ray-pitch per
 * frame (0.6 turns/s per 11.25 degrees, i.e. about 1.9 rev/s here) is where a
 * 32-ray sunburst starts sampling onto its own neighbours and reads as a strobing
 * blur instead of a turning object. So: four times the pickups' rate, comfortably
 * under the rate at which the shape stops resolving.
 *
 * It is a ball in here rather than a pickup, which is the whole reason it may be
 * quicker: a thing that has just been thrown across a room *should* be spinning.
 */
const BALL_SPIN_TURNS = 4;

export interface EngineRoomView {
  phase: BonusPhase;
  /** Sim seconds since the drop — drives the reveal and the titles. */
  clock: number;
  bricks: readonly BrickState[];
  /** The two floor cannons. One of them serves; both are always drawn. */
  cannons: readonly CannonState[];
  ball: BallState | null;
  lost: LostBallState | null;
  tray: TrayState;
  paddle: AABB;
  equipped: boolean;
  suctionOn: boolean;
  carrying: boolean;
  /** Hero centre and feet, interpolated by the host. */
  heroX: number;
  heroFeetY: number;
  /** Animation phase in turns (0..1). Constant under reduced motion. */
  phaseT: number;
  reduced: boolean;
}

// ---------------------------------------------------------------------------
// The room, behind the hero
// ---------------------------------------------------------------------------

export function drawEngineRoom(ctx: CanvasRenderingContext2D, v: EngineRoomView): void {
  backWall(ctx);
  services(ctx, v.phaseT, v.reduced);
  racks(ctx, v.phaseT, v.reduced);
  shell(ctx);
  floorStencil(ctx, v.clock);
  shaft(ctx, v);
  cannons(ctx, v);
  wall(ctx, v);
  titles(ctx, v);
}

function backWall(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = BACK_SHADE;
  ctx.fillRect(0, 0, RESOLUTION.WIDTH, RESOLUTION.HEIGHT);
  drawBricks(ctx, R.WALL, R.CEILING, WALL_RIGHT - R.WALL, R.FLOOR_Y - R.CEILING, {
    px: P,
    brickW: 80,
    brickH: 40,
    face: BACK,
    shade: BACK_SHADE,
    highlight: BACK_LIT,
    mortar: MORTAR,
    speckle: 0.05,
    faces: ['#16213E', '#141F3A', '#192544'],
    bevel: true,
  });
  /*
   * A darker register at the height the hero stands against, so his silhouette has
   * something to hold against rather than dissolving into the wall — the same fix the
   * Workplace's lowest wall band is.
   *
   * It is **laid brickwork one value down, not a flat fill**: rasterised as a plain
   * rectangle, 170px of untextured indigo across a textured wall read as a large empty
   * box hanging in the room rather than as the bottom of the wall.
   */
  drawBricks(ctx, R.WALL, 470, WALL_RIGHT - R.WALL, R.FLOOR_Y - 470, {
    px: P,
    brickW: 80,
    brickH: 40,
    face: '#101A32',
    shade: '#0A1226',
    highlight: '#1A2647',
    mortar: MORTAR,
    speckle: 0.04,
    faces: ['#101A32', '#0E1730', '#131E3A'],
    bevel: true,
  });
  pxRect(ctx, BACK_LIT, R.WALL, 470, WALL_RIGHT - R.WALL, 3, 1);
}

/** The services: one duct under the ceiling, cut around the shaft, and three cable runs. */
function services(ctx: CanvasRenderingContext2D, phaseT: number, reduced: boolean): void {
  const y = 52;
  const h = 26;
  for (const [x0, x1] of [
    [R.WALL, MOUTH_L - 28],
    [MOUTH_R + 28, WALL_RIGHT],
  ] as const) {
    pxRect(ctx, METAL, x0, y, x1 - x0, h, P);
    // Up-facing edge only: a duct is lit on top and dark underneath.
    pxRect(ctx, METAL_LIT, x0, y, x1 - x0, 3, 1);
    pxRect(ctx, INK, x0, y + h - 3, x1 - x0, 3, 1);
    // Flange every 120px, so it reads as sections bolted together.
    for (let x = x0 + 40; x < x1 - 8; x += 120) {
      pxRect(ctx, METAL_LIT, x, y - 3, 6, h + 6, 1);
    }
  }
  // Cable runs, sagging between clips. Three, at different depths and values.
  const runs = [
    { y: 116, sag: 22, tone: '#1E2C4E' },
    { y: 138, sag: 30, tone: '#25355C' },
  ];
  for (const run of runs) {
    for (let x = R.WALL; x < WALL_RIGHT; x += P * 2) {
      const k = ((x - R.WALL) % 240) / 240;
      const dip = Math.sin(k * Math.PI) * run.sag;
      pxRect(ctx, run.tone, x, run.y + dip, P * 2, P, P);
    }
  }
  // Two indicator lamps on the duct: the plant is running. Held under reduced motion.
  const blink = reduced ? 1 : Math.floor(phaseT * 4) % 2;
  pxRect(ctx, blink ? MINT : '#255E45', 300, y + 6, 8, 8, P);
  pxRect(ctx, blink ? '#255E45' : MINT, 980, y + 6, 8, 8, P);
}

/**
 * Two equipment racks, one at each end, standing on the floor behind the play.
 *
 * They are the only thing in the room that says *why* it is here: the centre the
 * player spent six screens building is downstairs and it is running. Their LEDs are
 * the room's plant, so they are a lit **face** and never a glow.
 */
function racks(ctx: CanvasRenderingContext2D, phaseT: number, reduced: boolean): void {
  for (const x of [64, 1096]) {
    const w = 120;
    const top = 386;
    pxRect(ctx, INK, x - 3, top - 3, w + 6, R.FLOOR_Y - top + 3, 1);
    pxRect(ctx, '#101A32', x, top, w, R.FLOOR_Y - top, P);
    pxRect(ctx, STRUCT_LIT, x, top, w, 4, 1);
    // Four shelves of gear, each a dark unit with a lit strip and status cells.
    for (let i = 0; i < 6; i += 1) {
      const uy = top + 12 + i * 38;
      pxRect(ctx, '#182444', x + 8, uy, w - 16, 26, P);
      pxRect(ctx, STRUCT_LIT, x + 8, uy, w - 16, 2, 1);
      for (let c = 0; c < 5; c += 1) {
        const n = hash2(x + c * 7, i * 13);
        const on = reduced ? n > 0.35 : (n + phaseT * (0.4 + n)) % 1 > 0.4;
        pxRect(ctx, on ? (n > 0.7 ? CYAN : MINT) : '#1E2C4E', x + 18 + c * 18, uy + 14, 8, 6, 2);
      }
    }
  }
}

/** Floor, side walls, ceiling slab — the built shell, drawn over the back wall. */
function shell(ctx: CanvasRenderingContext2D): void {
  const material = {
    px: P,
    brickW: 40,
    brickH: 20,
    face: STRUCT,
    shade: STRUCT_SHADE,
    highlight: STRUCT_LIT,
    mortar: MORTAR,
    speckle: 0.06,
    faces: [STRUCT, '#202E4E', '#283861'],
    bevel: true,
  };
  drawBricks(ctx, 0, R.FLOOR_Y, RESOLUTION.WIDTH, RESOLUTION.HEIGHT - R.FLOOR_Y, material);
  drawBricks(ctx, 0, 0, R.WALL, RESOLUTION.HEIGHT, material);
  drawBricks(ctx, WALL_RIGHT, 0, R.WALL, RESOLUTION.HEIGHT, material);
  // The ceiling slab, in two pieces so the shaft is a hole in it and not a painted-on
  // rectangle. Its underside is the line the mark bounces off.
  for (const [x0, x1] of [
    [0, MOUTH_L],
    [MOUTH_R, RESOLUTION.WIDTH],
  ] as const) {
    drawBricks(ctx, x0, 0, x1 - x0, R.CEILING, material);
    pxRect(ctx, INK, x0, R.CEILING - 3, x1 - x0, 3, 1);
  }
  // Walkable/lit edges: the top of the floor and the underside of the ceiling.
  pxRect(ctx, EDGE_LIT, 0, R.FLOOR_Y, RESOLUTION.WIDTH, 3, 1);
}

/**
 * The stage's name, stencilled on the floor plates.
 *
 * It is here because **the HUD is hidden in this room** (nothing down here can cost a
 * life or a month, so a lives plaque and a delay log would be furniture that lies),
 * and with the big title gone at 3.6s the player would otherwise have nothing that
 * says where they are. Stencilled paint on a plant-room floor is what that looks like
 * in a place like this — and it sits *below* the walking line, so it never competes
 * with the wall or the mark.
 */
function floorStencil(ctx: CanvasRenderingContext2D, clock: number): void {
  /*
   * It **takes over from the title, it does not sit under it**: rasterised together,
   * the frame printed the stage name twice, once at scale 4 in the middle and once at
   * scale 2 on the floor beneath it. Same defect as CONTINUE on the briefing card's cap
   * and the word under it — invisible in the source, obvious in the picture — so the
   * stencil fades up exactly as the title fades out.
   */
  const in0 = BEAT.BRICKS_AT - 0.6;
  if (clock < in0) return;
  const alpha = Math.min(1, (clock - in0) / 0.6);
  drawText(ctx, STAGE_NAME, RESOLUTION.WIDTH / 2, R.FLOOR_Y + 26, {
    scale: 2,
    color: '#3B5187',
    align: 'center',
    alpha,
  });
}

/**
 * The shaft: the way in and the way out, and the same 80px both times.
 *
 * Three things have to be legible here. It is a **hole** (dark, with a lit rim and two
 * guide rails climbing out of frame). It is **pressurised** — a draught line across
 * the mouth, which is what the mark bounces off, so the one bounce that would
 * otherwise look like a mistake has a reason drawn on it. And once the wall is down it
 * is **drawing**, which is chevrons climbing the column and a brighter rim.
 */
function shaft(ctx: CanvasRenderingContext2D, v: EngineRoomView): void {
  const w = R.TUNNEL_W;
  // The opening itself, and the shaft above the ceiling line.
  pxRect(ctx, '#060B18', MOUTH_L, 0, w, R.CEILING, P);
  for (const x of [MOUTH_L + 6, MOUTH_R - 12]) {
    pxRect(ctx, METAL_LIT, x, 0, 6, R.CEILING, 2);
  }
  // Lit rim on both jambs, brighter while it is drawing.
  const rim = v.suctionOn ? CYAN : METAL_LIT;
  pxRect(ctx, rim, MOUTH_L - 4, 0, 4, R.CEILING, 2);
  pxRect(ctx, rim, MOUTH_R, 0, 4, R.CEILING, 2);

  if (v.suctionOn) {
    /*
     * **The draught is a COLUMN, not a handful of arrows.** The first cut drew seven
     * 20px chevrons at 0.2-0.7 alpha up a 600px shaft and rasterised as specks of dirt
     * on the back wall — the same defect that deleted Hire Under Fire's drifting
     * embers, and worse here because this column is the only way out of the room.
     *
     * What reads: the whole 80px lane tinted, a bright rail down each edge (which is
     * literally the owner's "straight line, the width of the tunnel"), 30px chevrons at
     * full alpha climbing it, and a lit patch of floor at the bottom. Each chevron
     * wraps on its own phase over the full height, so the column is continuous rather
     * than a sheet rewinding (the rain rule).
     */
    const span = R.FLOOR_Y - R.CEILING;
    pxRect(ctx, 'rgba(92,226,244,0.10)', MOUTH_L, R.CEILING, w, span, P);
    for (const x of [MOUTH_L, MOUTH_R - 4]) {
      pxRect(ctx, 'rgba(92,226,244,0.55)', x, R.CEILING, 4, span, 2);
    }
    for (let i = 0; i < 6; i += 1) {
      const phase = (i / 6 + v.phaseT * 1.6) % 1;
      const y = R.FLOOR_Y - phase * span;
      const a = 0.45 + 0.5 * (1 - phase);
      upChevron(ctx, R.TUNNEL_CX, y, 6, `rgba(92,226,244,${Math.min(1, a).toFixed(2)})`);
    }
    // A brighter draught line across the mouth, and a lit patch of floor so "stand
    // here" is said on the ground, where the decision is taken.
    pxRect(ctx, CYAN, MOUTH_L, R.CEILING - 4, w, 4, 2);
    const lift = Math.floor(v.phaseT * 4) % 2 === 0 ? 0 : P;
    upChevron(ctx, R.TUNNEL_CX, R.FLOOR_Y - 34 - lift, 6, 'rgba(92,226,244,0.95)');
    pxRect(ctx, 'rgba(92,226,244,0.45)', MOUTH_L, R.FLOOR_Y - 4, w, 4, 1);
    return;
  }
  // Idle: the pressure line only, dim. It is what the mark bounces off, so it is
  // always drawn — a mark rebounding off an open hole would read as a bug.
  for (let x = MOUTH_L; x < MOUTH_R; x += P * 2) {
    pxRect(ctx, 'rgba(92, 226, 244, 0.3)', x, R.CEILING - 3, P, 3, 1);
  }
}

// ---------------------------------------------------------------------------
// The two cannons — where the mark comes from
// ---------------------------------------------------------------------------

/**
 * The pair of them, **bracketed to the side walls** and hanging over the room.
 *
 * They are in the room layer, behind the hero and behind the mark, because they are
 * plant: the same metal as the ducts and the racks, lit on their up-faces only. The mark
 * passing in front is what says the machine threw it rather than the machine being in the
 * way of it.
 */
function cannons(ctx: CanvasRenderingContext2D, v: EngineRoomView): void {
  for (const c of v.cannons) cannon(ctx, c);
}

/**
 * One cannon, in five parts, and each one is doing a job: a **wall plate** with four
 * bolts (it is *hanging*, so the fixing has to be on the frame), a **strut and a diagonal
 * brace** carrying it out over the room, a **yoke** the barrel pivots in, the **barrel**
 * itself, and a **hopper** on the back holding the next mark.
 *
 * The barrel is a run of stepped cells along its own vector, never `ctx.rotate` — which
 * anti-aliases a 14px bar into a grey smear at this scale — and it is drawn in two
 * passes, a dark cell one size up and then the face, because **an angled sprite needs its
 * keyline more than a square one does**: half of every cell's edge on a diagonal is a
 * corner, so there is half as much silhouette holding it off the wall behind it. One pass
 * of mid-value cells rasterised as a thin dark stick.
 *
 * It tapers (16 → 11 cells) with a **collar** at the yoke and a **pale ring** at the
 * mouth, which is the whole difference between a barrel and a stick: two ends that are
 * not the same.
 *
 * Three things have to be legible. Which machine is loaded (the gauge fills, the hopper
 * lights, the mark shows in the mouth). **Where the throw is going** — the barrel is
 * already on that line, which is the one piece of information this room gives the player
 * before it asks them to move. And that it has just thrown (the barrel sits back down its
 * own axis, the mouth flashes).
 */
function cannon(ctx: CanvasRenderingContext2D, c: CannonState): void {
  const { pivotX: px, pivotY: py, ux, uy } = c;
  // Inboard: +1 for the machine on the left wall, i.e. away from its own bracket.
  const inb = -c.side;
  const wall = c.side === -1 ? R.WALL : WALL_RIGHT;
  /*
   * **`EDGE_LIT` is this machine's highlight, and it is the brightest metal in the room.**
   * The first cut lit it in `METAL_LIT` like the ducts and the racks, and in the corner
   * where it hangs — directly over a rack's own lit top rail — the whole thing read as one
   * more pipe fitting. It is the object the player watches for two seconds before every
   * throw, so it gets to be the lightest thing on the wall.
   */
  const LIT = EDGE_LIT;

  /** x of a `w`-wide part that starts `from` px off the wall face, going inboard. */
  const off = (from: number, w: number): number => (c.side === -1 ? wall + from : wall - from - w);

  // --- the fixing: a plate bolted to the wall face ---------------------------
  pxRect(ctx, INK, off(-2, 20), py - 30, 20, 60, 2);
  pxRect(ctx, METAL, off(0, 16), py - 28, 16, 56, 2);
  pxRect(ctx, LIT, off(0, 16), py - 28, 16, 3, 1);
  pxRect(ctx, STRUCT_SHADE, off(0, 16), py + 25, 16, 3, 1);
  // Four bolt heads: a lit face with a dark notch, never a dark hole — a dark square on a
  // mid plate reads as a window into the wall, which is the opposite of a fixing.
  for (const by of [py - 21, py + 15]) {
    for (const bx of [off(3, 6), off(11, 6)]) {
      pxRect(ctx, LIT, bx, by, 6, 6, 2);
      pxRect(ctx, INK, bx + 2, by + 2, 2, 2, 1);
    }
  }

  // --- the strut carrying it out over the room, and a gusset under it --------
  const strutW = C.REACH - 16 - 1;
  const strutX = off(16, strutW);
  pxRect(ctx, INK, strutX, py - 11, strutW + 2, 22, 1);
  pxRect(ctx, METAL, strutX, py - 9, strutW + 2, 18, 2);
  pxRect(ctx, LIT, strutX, py - 9, strutW + 2, 3, 1);
  // The gusset is what makes it read as *hung* rather than as floating beside the wall:
  // three stepped cells closing the angle between the plate and the strut.
  for (let i = 0; i < 3; i += 1) {
    pxRect(ctx, METAL, off(16 + i * 5, 5), py + 9 + i * 4, 5, 12 - i * 4, 1);
  }

  // --- the magazine over the yoke: why there is always another mark ----------
  pxRect(ctx, INK, px - 11, py - 34, 22, 24, 2);
  pxRect(ctx, '#1B2C4E', px - 9, py - 32, 18, 20, 2);
  pxRect(ctx, LIT, px - 9, py - 32, 18, 2, 1);
  for (let i = 0; i < 2; i += 1) {
    const loaded = c.aim > 0 && i === 0;
    pxRect(ctx, loaded ? PALE : i === 0 ? CYAN : '#2B4C7E', px - 5, py - 28 + i * 8, 10, 6, 2);
  }

  // --- the yoke the barrel pivots in ----------------------------------------
  const half = c.w / 2;
  pxRect(ctx, INK, px - half - 2, py - half - 2, c.w + 4, c.h + 4, 2);
  pxRect(ctx, METAL, px - half, py - half, c.w, c.h, 2);
  pxRect(ctx, LIT, px - half, py - half, c.w, 3, 1);
  pxRect(ctx, LIT, px - half, py - half, 3, c.h, 1);
  pxRect(ctx, STRUCT_SHADE, px - half, py + half - 3, c.w, 3, 1);
  // The hub: a dark socket with a lit core, so the barrel visibly turns in something.
  pxRect(ctx, INK, px - 6, py - 6, 12, 12, 2);
  pxRect(ctx, LIT, px - 3, py - 3, 6, 6, 1);

  /*
   * The barrel. Stepped cells along its own vector, never `ctx.rotate` (which anti-aliases
   * a 16px bar into a grey smear at this scale), drawn in two passes — a dark cell one
   * size up, then the face — because **an angled sprite needs its keyline more than a
   * square one does**: half of every cell's edge on a diagonal is a corner, so there is
   * half as much silhouette holding it off the wall behind it.
   *
   * It is a **collar, a tube of ONE width, and a mouth** — and the constant width is the
   * fix rather than the detail. A run of cells that shrank 18 → 14 along the way
   * rasterised as a ragged wedge: on a diagonal, a step that changes size at the same time
   * as it moves has no edge that lines up with the step before it, so the silhouette
   * frays. Same width all the way, then a ring — a lit frame around a dark bore — 26
   * across at the end of it, and the two ends do all the tapering the eye needs.
   */
  const back = c.flash * 9;
  const bore = C.BARREL - 12 - back;
  for (const pass of [0, 1] as const) {
    // Nine cells over 32px rather than four over 27: on a shallow line the *spacing* is
    // what sets how coarse the stair is, and a barrel that can be laid nearly flat has to
    // survive its flattest angle. Two-pixel treads read as a machined tube; eight read as
    // a staircase with a hole in it.
    for (let i = 0; i < TUBE_CELLS; i += 1) {
      const d = 4 + i * 4 - back;
      const s = (i === 0 ? 20 : 15) + (pass === 0 ? 4 : 0);
      pxRect(
        ctx,
        pass === 0 ? INK : METAL,
        px + ux * d - s / 2,
        py + uy * d - s / 2,
        s,
        s,
        2,
      );
    }
    // The lit rail along the barrel's up-facing side, laid on the same line: without it
    // the tube is one flat value and the room's own "light is a surface" rule is broken by
    // the one object the player is reading.
    if (pass === 1) {
      /*
       * **The rail goes on whichever side of the axis is UP.** The perpendicular of a
       * vector has two directions and the barrel swings through most of a quadrant, so
       * picking one of them by hand lights the left machine on top and the right one
       * underneath — light arriving from two places in one room, which is the defect the
       * whole "light is a surface" rule exists to stop.
       */
      const sign = ux >= 0 ? 1 : -1;
      const nx = uy * sign;
      const ny = -ux * sign;
      for (let i = 1; i < TUBE_CELLS; i += 1) {
        const d = 4 + i * 4 - back;
        pxRect(ctx, LIT, px + ux * d + nx * 4 - 5, py + uy * d + ny * 4 - 5, 10, 10, 2);
      }
    }
  }
  const mx = px + ux * bore;
  const my = py + uy * bore;
  pxRect(ctx, INK, mx - 11, my - 11, 22, 22, 2);
  pxRect(ctx, LIT, mx - 9, my - 9, 18, 18, 2);
  pxRect(ctx, '#0C1730', mx - 5, my - 5, 10, 10, 1);
  // The mark in the bore while it charges: the thing that is about to be thrown, and it
  // brightens as the wind-up runs out.
  if (c.aim > 0) {
    // Kept inside the bore, never filling it: a mark the size of the mouth turns the ring
    // into a solid white square and the aperture stops reading as one.
    const s = c.aim > 0.66 ? 8 : 6;
    pxRect(ctx, c.aim > 0.66 ? PALE : CYAN, mx - s / 2, my - s / 2, s, s, 2);
  }
  /*
   * The charge gauge: three cells across the strut, filling as the barrel comes round. A
   * gauge and not a blinking lamp, because the player has to know *when*, not just that
   * something is happening over there.
   */
  for (let i = 0; i < 3; i += 1) {
    const lit = c.aim > (i + 1) / 3 - 0.01;
    pxRect(ctx, lit ? CYAN : '#16233F', off(2, 5) + inb * i * 6, py - 3, 5, 7, 1);
  }
  /*
   * The flash. Cool, not warm: **the only warm thing in this room is the ANSR mark**, and
   * a muzzle flash in orange would put a second one on the frame on the exact frame the
   * first one appears.
   */
  if (c.flash > 0) {
    ctx.globalAlpha = c.flash;
    for (const [k, tone] of [
      [1, PALE],
      [1.8, CYAN],
    ] as const) {
      const s = Math.round(20 / k);
      pxRect(ctx, tone, mx + ux * 13 * k - s / 2, my + uy * 13 * k - s / 2, s, s, 2);
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * Cells in the barrel's tube, derived from its length so the mouth always lands on the end
 * of it: 4px treads from the collar up to the bore's own centre (`BARREL - 12`).
 */
const TUBE_CELLS = Math.round((C.BARREL - 16) / 4);

/** A chevron pointing up: the draught, and the "stand here" mark under it. */
const UP_CHEVRON: readonly string[] = ['..C..', '.CCC.', 'CC.CC'];

/**
 * One chevron, **centred on cx** — which is worth a helper because the first cut
 * hand-wrote the offset (`cx - 18` for a 5-cell grid at scale 4, i.e. 20px wide) and
 * painted the whole draught 8px left of the shaft it belongs to.
 */
function upChevron(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  scale: number,
  color: string,
): void {
  drawPixels(ctx, UP_CHEVRON, { C: color }, cx - (UP_CHEVRON[0]!.length * scale) / 2, y, { scale });
}

// ---------------------------------------------------------------------------
// The wall of blocks
// ---------------------------------------------------------------------------

function wall(ctx: CanvasRenderingContext2D, v: EngineRoomView): void {
  for (const brick of v.bricks) {
    if (brick.alive) {
      if (brick.reveal > 0) block(ctx, brick);
      continue;
    }
    if (brick.sinceBroken !== null && brick.sinceBroken < SHATTER_TIME) {
      shatter(ctx, brick, brick.sinceBroken / SHATTER_TIME);
    }
  }
}

function toneOf(brick: BrickState): Tone {
  return TONES[brick.tone] ?? TONE_FALLBACK;
}

/**
 * One block: keyline, face, two lit edges, two shaded ones, and its words in ink.
 *
 * The reveal opens it from its own centre line, which is why a row appearing reads as
 * the wall being *put up* rather than as a row of rectangles switching on. The label
 * waits until the block is nearly full height — type on a 6px-tall block is a smear.
 */
function block(ctx: CanvasRenderingContext2D, brick: BrickState): void {
  const tone = toneOf(brick);
  const h = Math.max(P, Math.round(brick.h * brick.reveal));
  const y = Math.round(brick.y + (brick.h - h) / 2);
  const { x, w } = brick;

  pxRect(ctx, INK, x - 2, y - 2, w + 4, h + 4, 2);
  pxRect(ctx, tone.face, x, y, w, h, 2);
  pxRect(ctx, tone.lit, x, y, w, 3, 1);
  pxRect(ctx, tone.lit, x, y, 3, h, 1);
  pxRect(ctx, tone.shade, x, y + h - 4, w, 4, 1);
  pxRect(ctx, tone.shade, x + w - 3, y + 3, 3, h - 3, 1);

  if (!brick.label || brick.reveal < 0.9) return;
  const lines = wrapLabel(brick.label, BONUS.BRICKS.LABEL_CHARS);
  const cx = x + w / 2;
  /*
   * 16, not 14. A glyph at scale 2 *is* 14 tall, so a 14px line pitch is zero leading
   * and the two-line labels rasterised as one crushed block of type — ADDING /
   * CAPABILITIES with its ascenders touching the line above. 2px of leading is the
   * whole fix, and 2 × 16 = 32 still sits inside a 34px block with a cell to spare.
   */
  const lineH = 16;
  const top = Math.round(brick.y + (brick.h - lines.length * lineH) / 2) + 1;
  lines.forEach((line, i) => {
    drawText(ctx, line, cx, top + i * lineH, { scale: 2, color: LABEL_INK, align: 'center' });
  });
}

/**
 * The fragments a broken block leaves. Five cells per block, thrown from its own
 * corners and falling — deterministic off the block's grid position, so a replay
 * breaks it the same way and a raster can catch it mid-flight.
 */
function shatter(ctx: CanvasRenderingContext2D, brick: BrickState, k: number): void {
  const tone = toneOf(brick);
  const cx = brick.x + brick.w / 2;
  const cy = brick.y + brick.h / 2;
  const alpha = 1 - k;
  ctx.globalAlpha = alpha;
  /*
   * **The flash is an OUTLINE, never the block's footprint.** The first cut painted a
   * pale 176×34 rectangle at 0.5 alpha over the block that had just gone, and
   * rasterised it is a grey slab sitting in the wall — a player reads it as a block,
   * not as one breaking, and it is the light-as-an-object defect at brick size. A frame
   * reads as a shell coming apart, and it costs four fills.
   */
  if (k < 0.4) {
    const f = 1 - k / 0.4;
    ctx.globalAlpha = alpha * (0.4 + 0.6 * f);
    const grow = Math.round(6 * (1 - f));
    for (const [x, y, w, h] of [
      [brick.x - grow, brick.y - grow, brick.w + grow * 2, 3],
      [brick.x - grow, brick.y + brick.h + grow - 3, brick.w + grow * 2, 3],
      [brick.x - grow, brick.y - grow, 3, brick.h + grow * 2],
      [brick.x + brick.w + grow - 3, brick.y - grow, 3, brick.h + grow * 2],
    ] as const) {
      pxRect(ctx, PALE, x, y, w, h, 1);
    }
    ctx.globalAlpha = alpha;
  }
  for (let i = 0; i < 8; i += 1) {
    const n = hash2(brick.col * 31 + i, brick.row * 17 + i);
    const dir = i % 2 === 0 ? -1 : 1;
    const dx = dir * (24 + n * 96) * k;
    const dy = -70 * k + 240 * k * k + (n - 0.5) * 24;
    const size = i < 2 ? P * 3 : P * 2;
    pxRect(ctx, i % 3 === 0 ? tone.lit : tone.face, cx + dx - size / 2, cy + dy, size, size, P);
  }
  ctx.globalAlpha = 1;
}

/** Greedy wrap to a character measure — the same shape as `wrapPixelLabel`. */
export function wrapLabel(label: string, chars: number): string[] {
  const words = label.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= chars || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

/**
 * The stage names itself for the first few seconds and then gets out of the way — it
 * is gone by the time the wall is up, because from then on the words that matter are
 * the ones on the blocks.
 */
function titles(ctx: CanvasRenderingContext2D, v: EngineRoomView): void {
  const out = BEAT.BRICKS_AT;
  if (v.clock > out) return;
  const alpha = v.clock > out - 0.6 ? Math.max(0, (out - v.clock) / 0.6) : 1;
  const cx = RESOLUTION.WIDTH / 2;
  drawText(ctx, STAGE_NAME, cx, 352, {
    scale: 4,
    color: PALE,
    align: 'center',
    outline: 'rgba(6,11,24,0.9)',
    alpha,
  });
  // The rule under the name, in the value orange: the one warm mark on the frame
  // besides the ANSR mark itself, and it is the same rule every title in the game has.
  pxRect(ctx, `rgba(255,84,0,${(alpha * 0.9).toFixed(2)})`, cx - 60, 396, 120, 4, 2);
  drawText(ctx, STAGE_LINE, cx, 416, {
    scale: 2,
    color: '#9FC8D2',
    align: 'center',
    outline: 'rgba(6,11,24,0.9)',
    alpha,
  });
}

// ---------------------------------------------------------------------------
// The kit, in front of the hero
// ---------------------------------------------------------------------------

export function drawEngineRoomProps(ctx: CanvasRenderingContext2D, v: EngineRoomView): void {
  if (v.lost) lostMark(ctx, v.lost);
  if (v.equipped && !v.carrying) skateboard(ctx, v);
  tray(ctx, v);
  if (v.ball) mark(ctx, v.ball, v.phaseT);
}

/**
 * The skateboard. Its wheels turn **off the hero's position, never off a clock** — a
 * board that spins while he stands still is the same defect as a projectile that
 * flickers on the wall clock.
 */
function skateboard(ctx: CanvasRenderingContext2D, v: EngineRoomView): void {
  const y = v.heroFeetY - 10;
  const w = 58;
  const x = v.heroX - w / 2;
  pxRect(ctx, INK, x - 2, y - 2, w + 4, 10, 2);
  pxRect(ctx, '#B9C7E8', x, y, w, 6, 2);
  pxRect(ctx, PALE, x, y, w, 2, 1);
  // Two trucks and two wheels, the wheels' spokes stepping with distance covered.
  const roll = v.reduced ? 0 : Math.floor(Math.abs(v.heroX) / 10) % 2;
  for (const wx of [x + 10, x + w - 16]) {
    pxRect(ctx, '#7F90B8', wx + 1, y + 6, 4, 3, 1);
    pxRect(ctx, INK, wx - 1, y + 8, 8, 8, 2);
    pxRect(ctx, roll ? '#8FA3CE' : '#5F719C', wx + 1, y + 10, 4, 4, 2);
  }
}

/**
 * The tray, and the two arms holding it up.
 *
 * A mid value with one lit rail and a dark keyline, because it is a thing the hero
 * **carries**: the "furniture goes darker than the wall" rule is about the room, and
 * anything held has to read against whatever happens to be behind it. Its top face is
 * exactly the bounce line the simulation collides against.
 */
function tray(ctx: CanvasRenderingContext2D, v: EngineRoomView): void {
  const t = v.tray;
  if (t.phase === 'waiting') return;
  const x = t.x - t.w / 2;
  const held = t.phase === 'held';

  if (held && !v.carrying) {
    // Arms: two posts from the shoulders to the tray's underside, so the thing above
    // his head is visibly his rather than floating there.
    for (const dx of [-14, 10]) {
      pxRect(ctx, '#0F5A6C', v.heroX + dx, t.y + t.h, 5, v.heroFeetY - 44 - (t.y + t.h), 1);
    }
  }
  pxRect(ctx, INK, x - 3, t.y - 3, t.w + 6, t.h + 6, 1);
  pxRect(ctx, '#8FA3CE', x, t.y, t.w, t.h, 2);
  // The lip at each end: a tray, not a plank.
  pxRect(ctx, '#B9C7E8', x, t.y - 6, 10, t.h + 6, 2);
  pxRect(ctx, '#B9C7E8', x + t.w - 10, t.y - 6, 10, t.h + 6, 2);
  // The bounce line, lit — the one edge in the room the player is judging.
  pxRect(ctx, PALE, x, t.y, t.w, 3, 1);
  pxRect(ctx, '#5F719C', x, t.y + t.h - 3, t.w, 3, 1);
  // Wheels under it while it is still on its own, so it arrives as a board with a
  // tray on it rather than as a plank falling out of the ceiling.
  if (!held) {
    for (const wx of [x + 12, x + t.w - 20]) {
      pxRect(ctx, INK, wx, t.y + t.h, 8, 8, 2);
      pxRect(ctx, '#5F719C', wx + 2, t.y + t.h + 2, 4, 4, 2);
    }
  }
}

/**
 * The ANSR mark in play — the real brand asset (`render/badge.ts`), never an
 * interpretation of it, at exactly the diameter the simulation collides with.
 *
 * The trail is three cells behind its own direction of travel: it is the only thing on
 * the frame moving at 400px/s, and without it a fast mark reads as a jump cut.
 */
function mark(ctx: CanvasRenderingContext2D, ball: BallState, phaseT: number): void {
  const mag = Math.hypot(ball.vx, ball.vy) || 1;
  const ux = ball.vx / mag;
  const uy = ball.vy / mag;
  for (let i = 3; i >= 1; i -= 1) {
    const a = 0.32 - i * 0.08;
    pxRect(
      ctx,
      // The mark's own lit tone (`MARK_TONES[1]`), so the trail brightened with it.
      `rgba(255,149,112,${a.toFixed(2)})`,
      ball.x - ux * i * 14 - P,
      ball.y - uy * i * 14 - P,
      P * 2,
      P * 2,
      P,
    );
  }
  drawAnsrBadgeMark(
    ctx,
    ball.x,
    ball.y,
    ball.d,
    Math.floor(phaseT * 8) % 2 === 0 ? 0 : 1,
    markSpin(phaseT * BALL_SPIN_TURNS),
  );
}

/** The mark that got past the tray: lying on the floor, fading, with a contact shadow. */
function lostMark(ctx: CanvasRenderingContext2D, lost: LostBallState): void {
  const a = 1 - lost.fade;
  ctx.globalAlpha = a;
  pxRect(ctx, 'rgba(6,11,24,0.45)', lost.x - 18, R.FLOOR_Y - 4, 36, 4, 1);
  // At rest, and it has stopped turning with the rest of it: a ball lying on the floor
  // that is still spinning is a ball nobody has told the game is dead.
  drawAnsrBadgeMark(ctx, lost.x, lost.y, BONUS.BALL.D, 0);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// The mouth, in the Tech Park's pavement
// ---------------------------------------------------------------------------

export interface TunnelHatchView {
  /** The mouth's own span, from level data. */
  x: number;
  w: number;
  /** Top of the ground band. */
  groundY: number;
  /** True while the player is standing on it: the prompt and the light come up. */
  active: boolean;
  /** The act key's cap, or null on touch (where the act pad appears instead). */
  keyCap: string | null;
  /** Animation phase in turns (0..1). Constant under reduced motion. */
  phaseT: number;
}

/**
 * The secret tunnel's mouth, cut into the plaza.
 *
 * **Subtle until it is stood on** (owner call: "a marker which subtly indicates there
 * is a way this side"). At rest it is what a service hatch in good paving looks like —
 * a cut kerb, a grille of five slats, four rivets and a pair of chevrons scratched in
 * the slab beside it — all in the plaza's own values, so a player walking past reads
 * furniture. Standing on it lights the slot, pulses the chevrons and puts up the
 * prompt, which is the only moment this feature ever explains itself.
 */
export function drawTunnelHatch(ctx: CanvasRenderingContext2D, v: TunnelHatchView): void {
  const { x, w, groundY } = v;
  const cx = x + w / 2;
  /*
   * **It has to read as a HOLE, and two earlier cuts read as a bench.** A frame all the
   * way round the slot, standing 4px proud of the paving with a lit top rail, is a
   * silhouette with a back and a seat — which is what a raised object looks like, and
   * this is the opposite of one.
   *
   * What reads as an opening, seen slightly from above: nothing above the ground line ·
   * the far (upper) inside wall in near-black, because it is in its own shade · the
   * **near lip lit**, catching the plaza's light · side cheeks only, no top rail · and
   * two ladder rungs disappearing into it, which is also the whole of "you can get down
   * there" said without a word or an arrow. All of it in the plaza's own stone values,
   * so it belongs to that pavement rather than arriving in a grey of its own.
   */
  pxRect(ctx, '#04121A', x, groundY, w, 26, 2);
  pxRect(ctx, '#02090E', x, groundY, w, 8, 1);
  for (const cheek of [x - 5, x + w]) {
    pxRect(ctx, '#0C4655', cheek, groundY, 5, 26, 1);
    pxRect(ctx, v.active ? '#7FD8E8' : '#3E8B9C', cheek, groundY + 22, 5, 4, 1);
  }
  // The near lip, lit — the one bright edge, and it is at the BOTTOM.
  pxRect(ctx, v.active ? '#8FE0EE' : '#4E9DAD', x - 5, groundY + 23, w + 10, 3, 1);
  // A service ladder going down out of sight: two rungs and its two stiles.
  for (const sx of [x + 22, x + w - 28]) {
    pxRect(ctx, '#2C6272', sx, groundY + 6, 6, 20, 2);
  }
  for (const ry of [groundY + 10, groundY + 19]) {
    pxRect(ctx, '#3E8B9C', x + 22, ry, w - 44, 3, 1);
  }
  /*
   * The marker, and it is the whole of the owner's "subtly indicates there is a way
   * this side": three chevrons cut into the paving, pointing down into the slot. At
   * scale 2 either side of the hatch they rasterised as two specks nobody would find,
   * which is not subtle, it is invisible; at scale 3, stacked and centred on the mouth,
   * they read as a floor marking — and the plaza already paints a row of chevrons along
   * this band, so they arrive in a family that is on the screen already.
   */
  const lift = v.active && Math.floor(v.phaseT * 4) % 2 === 0 ? 2 : 0;
  for (let i = 0; i < 3; i += 1) {
    const a = (v.active ? 0.9 : 0.42) - i * 0.1;
    drawPixels(
      ctx,
      DOWN_CHEVRON,
      { C: `rgba(${v.active ? '127,216,232' : '176,214,206'}, ${a.toFixed(2)})` },
      cx - 7.5,
      groundY + 30 + i * 10 + lift,
      { scale: 3 },
    );
  }
  if (!v.active) {
    // At rest there is still one cool cell of light down there: a shaft with something
    // running in it, which is the difference between a marker and a drain.
    pxRect(ctx, 'rgba(127,216,232,0.20)', x + 30, groundY + 14, w - 60, 4, 2);
    return;
  }
  // Standing on it: the light comes up the shaft, and the prompt with it.
  pxRect(ctx, 'rgba(127,216,232,0.5)', x + 14, groundY + 8, w - 28, 12, 2);
  /*
   * The prompt sits **118px up, clear of the hero's own head**. At 74 its bottom edge
   * landed across his chest — he is standing *on* the thing being labelled, so this is
   * the one plaque in the game whose clearance is measured against the player rather
   * than against the scenery.
   *
   * The key is drawn as a **cap**, not as a letter in the sentence: "F  DROP IN" reads
   * as a word beginning with F, and the game already has a vocabulary for this — the
   * title screen's control legend is caps with labels beside them. On touch there is no
   * cap at all, because there is no key; the act pad appears instead and carries the
   * same words in its own label.
   */
  const cap = v.keyCap;
  const promptY = groundY - 118;
  const capW = cap ? 26 : 0;
  const plaqueW = measureText(HATCH_PROMPT, 2, 1) + 16;
  const shift = cap ? (capW + 8) / 2 : 0;
  if (cap) keyCap(ctx, cx - shift - plaqueW / 2, promptY, cap, capW);
  drawLabelPlaque(ctx, HATCH_PROMPT, cx + shift, promptY, {
    scale: 2,
    fg: '#DCE8FF',
    bg: 'rgba(4,20,26,0.82)',
    frame: 'rgba(127,216,232,0.65)',
    padX: 8,
    padY: 6,
    alpha: 0.96,
  });
  // A down chevron under the plaque, so the direction is said without words too.
  drawPixels(ctx, DOWN_CHEVRON, { C: 'rgba(127,216,232,0.9)' }, cx - 7.5, groundY - 84 + lift, {
    scale: 3,
  });
}

const DOWN_CHEVRON: readonly string[] = ['CC.CC', '.CCC.', '..C..'];

/**
 * One 8-bit key cap, in the same treatment as the title screen's control legend and the
 * overlay buttons: solid fill, a light bevel on two sides, a dark rail on the other two,
 * no radius. 26px tall, which is exactly the plaque beside it.
 */
function keyCap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  w: number,
): void {
  const h = 26;
  pxRect(ctx, 'rgba(4,20,26,0.9)', x - 2, y - 2, w + 4, h + 4, 1);
  pxRect(ctx, '#12414F', x, y, w, h, 1);
  pxRect(ctx, '#8FE0EE', x, y, w, 3, 1);
  pxRect(ctx, '#8FE0EE', x, y, 3, h, 1);
  pxRect(ctx, '#062A34', x, y + h - 3, w, 3, 1);
  pxRect(ctx, '#062A34', x + w - 3, y, 3, h, 1);
  drawText(ctx, label, x + w / 2, y + 6, { scale: 2, color: '#DCE8FF', align: 'center' });
}

/** Exported for the render test: the label a block would set, wrapped. */
export function labelLines(label: string): string[] {
  return wrapLabel(label, BONUS.BRICKS.LABEL_CHARS);
}

/** Exported for the render test: the widest line a label sets, in px at scale 2. */
export function labelWidth(label: string): number {
  return Math.max(...labelLines(label).map((line) => measureText(line, 2, 1)));
}
