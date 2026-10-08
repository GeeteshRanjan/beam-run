/**
 * THE ENGINE ROOM, painted. Pure module, so this runs it against a recording context
 * and measures the cells — the same arrangement `stamps.test.ts` and `workplace.test.ts`
 * use, and the reason those two catch defects a code review cannot.
 *
 * The two claims worth having: **the words fit the blocks** (the block's size was
 * derived from them, so if a label ever outgrows its brick the wall is wrong, not the
 * type) and **nothing paints a block-sized light rectangle** — the first cut of the
 * break animation flashed the block's own footprint in pale grey and rasterised as a
 * slab sitting in the wall.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  drawEngineRoom,
  drawEngineRoomProps,
  drawTunnelHatch,
  labelLines,
  labelWidth,
  STAGE_NAME,
  type EngineRoomView,
} from './brickBreaker';
import { FONT, measureText } from './PixelText';
import { COPY } from '../data/copy';
import { BONUS, RESOLUTION } from '../data/tuning.config';
import { BrickBreaker, type BrickState } from '../world/BrickBreaker';

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

function recorder(): { ctx: CanvasRenderingContext2D; cells: Cell[] } {
  const cells: Cell[] = [];
  const ctx = {
    fillStyle: '#000',
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      cells.push({ x, y, w, h, fill: String((this as { fillStyle: string }).fillStyle) });
    },
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    beginPath() {},
    fill() {},
    arc() {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, cells };
}

/** `drawAnsrLogo` caches its path on the first call — stub before anything draws. */
beforeAll(() => {
  const g = globalThis as { Path2D?: unknown };
  if (!g.Path2D) g.Path2D = class {} as unknown;
});

function viewOf(stage: BrickBreaker, over: Partial<EngineRoomView> = {}): EngineRoomView {
  return {
    phase: stage.phase,
    clock: stage.clock,
    bricks: stage.brickStates,
    cannons: stage.cannonStates,
    ball: stage.ballState,
    lost: stage.lostBall,
    tray: stage.trayState,
    paddle: stage.paddleBox(),
    equipped: stage.equipped,
    suctionOn: stage.suctionOn,
    carrying: stage.carrying,
    heroX: 640,
    heroFeetY: BONUS.ROOM.FLOOR_Y,
    phaseT: 0.2,
    reduced: false,
    ...over,
  };
}

describe('The Engine Room — its name', () => {
  it('paints the same name the HUD plaque reads, in type the font has', () => {
    /*
     * Two sources for one name, and no way for a reader to see both at once: this
     * literal is what the frame paints (the floor stencil) and `COPY.bonus.name` is what
     * the briefing card and the HUD's stage plaque show. The owner renamed the stage
     * once — "The Growth Floor" said nothing and borrowed office vocabulary for a plant
     * room — and a rename that lands on one of the two is a room that disagrees with its
     * own label. (The card's own rules — the brief's wrap and its no-echo — are in
     * `ui.test.ts`, with the six stages'.)
     */
    expect(STAGE_NAME).toBe(COPY.bonus.name.toUpperCase());
    for (const ch of STAGE_NAME) expect(FONT[ch], ch).toBeDefined();
    // The stencil is ONE unwrapped line at scale 2 inside the room's 40px walls.
    expect(measureText(STAGE_NAME, 2, 1)).toBeLessThan(RESOLUTION.WIDTH - 80);
  });

  it('leaves the name to the briefing card while it is up, then stencils it', () => {
    // The room's clock is held at 0 under the card, and nothing on the frame may print
    // the name the card is printing: the old three-second title did, twice over.
    const stage = new BrickBreaker();
    const held = recorder();
    drawEngineRoom(held.ctx, viewOf(stage, { clock: 0 }));
    const running = recorder();
    drawEngineRoom(running.ctx, viewOf(stage, { clock: 2 }));
    const stencil = (cells: Cell[]): number =>
      cells.filter((c) => c.fill === '#3B5187' && c.y > BONUS.ROOM.FLOOR_Y).length;
    expect(stencil(held.cells)).toBe(0);
    expect(stencil(running.cells)).toBeGreaterThan(0);
  });
});

describe('The Engine Room — the words on the blocks', () => {
  const labels: string[] = BONUS.BRICKS.ROWS.flatMap((r) =>
    (r.labels as readonly (string | null)[]).filter((l): l is string => l !== null),
  );

  it('has the owner\u2019s fifteen', () => {
    expect(labels).toHaveLength(15);
  });

  it('sets every label in at most two lines that fit inside the block', () => {
    for (const label of labels) {
      const lines = labelLines(label);
      expect(lines.length, label).toBeLessThanOrEqual(2);
      for (const line of lines) {
        expect(line.length, `${label} / ${line}`).toBeLessThanOrEqual(BONUS.BRICKS.LABEL_CHARS);
      }
      // 8px of padding is the least a block can carry and still look like a label.
      expect(labelWidth(label), label).toBeLessThanOrEqual(BONUS.BRICKS.W - 8);
    }
    // Two lines at 16px plus leading has to fit the block's height.
    expect(2 * 16).toBeLessThanOrEqual(BONUS.BRICKS.H);
  });

  it('uses only characters the 5x7 font has', () => {
    for (const label of labels) {
      for (const ch of label) expect(FONT[ch], `${label}: ${ch}`).toBeDefined();
    }
  });

  it('the widest label is the one the block was sized for', () => {
    const widest = labels
      .map((l) => ({ l, w: labelWidth(l) }))
      .sort((a, b) => b.w - a.w)[0]!;
    expect(widest.w).toBeCloseTo(measureText('TRANSFORMATION', 2, 1), 0);
  });
});

describe('The Engine Room — the room', () => {
  it('paints the wall, and the labels only once a block is nearly full height', () => {
    const stage = new BrickBreaker();
    const half = stage.brickStates.map((b) => ({ ...b, reveal: 0.5 }) as BrickState);
    const a = recorder();
    drawEngineRoom(a.ctx, viewOf(stage, { bricks: half, clock: 4 }));
    const b = recorder();
    drawEngineRoom(b.ctx, viewOf(stage, { bricks: stage.brickStates.map((k) => ({ ...k, reveal: 1 })), clock: 4 }));
    // The full-height wall draws strictly more cells: the type is the difference.
    expect(b.cells.length).toBeGreaterThan(a.cells.length);
  });

  it('never paints a block-sized pale rectangle while a block breaks', () => {
    const stage = new BrickBreaker();
    const breaking = stage.brickStates.map((k, i) =>
      i === 5 ? ({ ...k, alive: false, sinceBroken: 0.05 } as BrickState) : k,
    );
    const { ctx, cells } = recorder();
    drawEngineRoom(ctx, viewOf(stage, { bricks: breaking, clock: 6 }));
    const slabs = cells.filter(
      (c) => c.w >= BONUS.BRICKS.W - 4 && c.h >= BONUS.BRICKS.H - 8 && /DCE8FF|FFFFFF/i.test(c.fill),
    );
    expect(slabs).toHaveLength(0);
  });

  it('draws the shaft as a full-height column once it is drawing', () => {
    const stage = new BrickBreaker();
    const off = recorder();
    drawEngineRoom(off.ctx, viewOf(stage, { suctionOn: false, clock: 6 }));
    const on = recorder();
    drawEngineRoom(on.ctx, viewOf(stage, { suctionOn: true, clock: 6 }));
    // Inside the mouth's own span only: the room's side walls are full-height fills too.
    const l = BONUS.ROOM.TUNNEL_CX - BONUS.ROOM.TUNNEL_W / 2;
    const r = BONUS.ROOM.TUNNEL_CX + BONUS.ROOM.TUNNEL_W / 2;
    const tall = (cells: Cell[]) =>
      cells.filter(
        (c) =>
          c.h >= BONUS.ROOM.FLOOR_Y - BONUS.ROOM.CEILING - 8 && c.x >= l - 8 && c.x + c.w <= r + 8,
      ).length;
    expect(tall(off.cells)).toBe(0);
    expect(tall(on.cells)).toBeGreaterThanOrEqual(3);
  });

  it('keeps everything inside the frame', () => {
    const stage = new BrickBreaker();
    const { ctx, cells } = recorder();
    drawEngineRoom(ctx, viewOf(stage, { suctionOn: true, clock: 6 }));
    drawEngineRoomProps(ctx, viewOf(stage, { clock: 6 }));
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(-8);
      expect(c.x + c.w).toBeLessThanOrEqual(RESOLUTION.WIDTH + 8);
      expect(c.y + c.h).toBeLessThanOrEqual(RESOLUTION.HEIGHT + 8);
    }
  });
});

describe('The Engine Room — the hatch in the plaza', () => {
  // The down arrow, which is the key that opens it (owner call). The font carries the
  // glyph for exactly this cap — see `PixelText.FONT`.
  const base = { x: 720, w: 80, groundY: 600, keyCap: '\u2193', phaseT: 0.2 };

  it('sets its key cap in a glyph the font actually has', () => {
    expect(FONT[base.keyCap]).toBeDefined();
  });

  it('stands no higher than the paving: it is a hole, not a bench', () => {
    const { ctx, cells } = recorder();
    drawTunnelHatch(ctx, { ...base, active: false });
    for (const c of cells) expect(c.y).toBeGreaterThanOrEqual(base.groundY);
  });

  it('says nothing until it is stood on, and then says it above the player\u2019s head', () => {
    const quiet = recorder();
    drawTunnelHatch(quiet.ctx, { ...base, active: false });
    const loud = recorder();
    drawTunnelHatch(loud.ctx, { ...base, active: true });
    expect(loud.cells.length).toBeGreaterThan(quiet.cells.length);
    // The prompt clears a standing hero (his drawn crown is 60px over the ground).
    const above = loud.cells.filter((c) => c.y < base.groundY - 60);
    expect(above.length).toBeGreaterThan(20);
    for (const c of above) expect(c.y + c.h).toBeLessThanOrEqual(base.groundY - 60);
  });

  it('drops the key cap on touch, where there is no key', () => {
    const withKey = recorder();
    drawTunnelHatch(withKey.ctx, { ...base, active: true });
    const touch = recorder();
    drawTunnelHatch(touch.ctx, { ...base, active: true, keyCap: null });
    expect(touch.cells.length).toBeLessThan(withKey.cells.length);
  });
});

describe('The Engine Room — the kit he leaves behind', () => {
  it('stands the tray on its posts and the skateboard when the draught takes him', () => {
    /*
     * Owner note: on the lift out only the tray stayed, hanging at bounce height with
     * nothing under it, because the board and the arms were drawn off the hero and went
     * up the shaft with him. Carried, the whole rig is scenery: board on the floor under
     * the tray, two posts between them, all of it behind the hero (the room pass), and
     * none of it in the props pass that draws over him.
     */
    const stage = new BrickBreaker();
    const P = BONUS.PADDLE;
    const tray = { phase: 'held' as const, x: 300, y: P.TOP, w: P.W, h: P.H };
    const view = viewOf(stage, {
      tray,
      equipped: true,
      carrying: true,
      heroX: BONUS.ROOM.TUNNEL_CX,
      heroFeetY: 200,
    });
    const room = recorder();
    drawEngineRoom(room.ctx, view);
    const near = (c: Cell): boolean => c.x > tray.x - 80 && c.x < tray.x + 80;
    // The deck, on the floor under the tray (not at the hero's feet high in the shaft).
    const deck = room.cells.filter((c) => c.fill === '#B9C7E8' && near(c) && c.y > 560);
    expect(deck.length).toBeGreaterThan(0);
    for (const c of deck) expect(c.y + c.h).toBeLessThanOrEqual(BONUS.ROOM.FLOOR_Y);
    // Two posts running from the tray's underside down to the deck.
    const posts = room.cells.filter((c) => c.fill === '#0F5A6C' && near(c));
    expect(posts).toHaveLength(2);
    for (const c of posts) {
      expect(c.y).toBeLessThanOrEqual(tray.y + tray.h + 1);
      expect(c.y + c.h).toBeGreaterThanOrEqual(BONUS.ROOM.FLOOR_Y - 14);
    }
    // The tray face itself is in the room pass too.
    expect(room.cells.some((c) => c.fill === '#8FA3CE' && near(c))).toBe(true);

    const props = recorder();
    drawEngineRoomProps(props.ctx, view);
    expect(props.cells.some((c) => ['#8FA3CE', '#B9C7E8', '#0F5A6C'].includes(c.fill))).toBe(false);
  });
});
