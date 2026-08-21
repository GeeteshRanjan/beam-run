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
  STAGE_LINE,
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
     * literal is what the frame paints (title, then floor stencil) and `COPY.bonus.name`
     * is what the HUD's stage plaque shows while the player is down there. The owner
     * renamed the stage this pass — "The Growth Floor" said nothing and borrowed office
     * vocabulary for a plant room — and a rename that lands on one of the two is a room
     * that disagrees with its own label.
     */
    expect(STAGE_NAME).toBe(COPY.bonus.name.toUpperCase());
    for (const ch of STAGE_NAME + STAGE_LINE) expect(FONT[ch], ch).toBeDefined();
    // Both are drawn as ONE unwrapped line — the name at scale 4, the line under it at
    // scale 2 — so their widths are a hard constraint: the frame is 1280 and the room's
    // own walls take 40 off each end.
    expect(measureText(STAGE_NAME, 4, 1)).toBeLessThan(RESOLUTION.WIDTH - 80);
    expect(measureText(STAGE_LINE, 2, 1)).toBeLessThan(RESOLUTION.WIDTH - 80);
    /*
     * And the line may not echo a word from the name over it — the same rule the six
     * briefing cards follow, for the same reason: a heading and the sentence under it
     * saying the same word reads as a mistake, and it is invisible in the source because
     * the two strings sit 10 lines apart.
     */
    for (const word of STAGE_NAME.split(' ')) {
      if (word.length <= 3) continue;
      expect(STAGE_LINE, word).not.toContain(word);
    }
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
