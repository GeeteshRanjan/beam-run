import { describe, it, expect } from 'vitest';
import {
  BEAST_H,
  BEAST_W,
  drawCone,
  drawDragon,
  drawFloatingBrick,
  drawHiredCandidates,
  drawScorchedGround,
  drawSteam,
  drawWaterCannon,
  drawWaterShots,
} from './dragon';
import { BRAND, HAZARDS, RESOLUTION } from '../data/tuning.config';
import { coneBoxes } from '../world/Hazards/Dragon';
import type {
  CandidateState,
  DragonState,
  FireState,
  WaterState,
} from '../world/Hazards/Dragon';

const D = HAZARDS.DRAGON;
const T = RESOLUTION.TILE;
const GROUND_TOP = 15 * T;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

/** The smallest canvas that can answer "what did it paint, where, and in what". */
function recorder() {
  const rects: Rect[] = [];
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, fill: String((this as { fillStyle: string }).fillStyle) });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects };
}

/** It stands on the ground, so the body box's bottom edge is the ground band. */
function body(cx = 1060) {
  return { x: cx - D.BODY_W / 2, y: GROUND_TOP - D.BODY_H, w: D.BODY_W, h: D.BODY_H };
}

function dragon(over: Partial<DragonState> = {}): DragonState {
  return {
    name: 'HIRING AT SCALE',
    box: body(),
    dir: -1,
    phase: 'waiting',
    progress: 0,
    layers: D.HITS_TO_STRIP,
    dissolve: null,
    ...over,
  };
}

function fire(over: Partial<FireState> = {}): FireState {
  const mouth = { x: 940, y: GROUND_TOP - D.BODY_H + D.BODY_H * 0.21 };
  const target = { x: mouth.x - D.CONE_REACH, y: GROUND_TOP - 20 };
  const extent = over.extent ?? 1;
  return {
    phase: 'burning',
    progress: 0.4,
    mouth,
    target,
    extent,
    dir: -1,
    quenched: 0,
    label: 'CANDIDATE DECLINED',
    labelAt: { x: (mouth.x + target.x) / 2, y: mouth.y - D.CONE_NEAR_H / 2 - 44 },
    boxes: coneBoxes(mouth, target, extent),
    ...over,
  };
}

function jet(over: Partial<WaterState> = {}): WaterState {
  return { box: { x: 400, y: 480, w: D.WATER_W, h: D.WATER_H }, dx: 0.86, dy: -0.5, ...over };
}

function candidate(over: Partial<CandidateState> = {}): CandidateState {
  return { x: 640, y: GROUND_TOP, progress: 1, landed: true, ...over };
}

const upper = (rs: Rect[]) => rs.map((r) => r.fill.toUpperCase());

describe('the Godzilla', () => {
  it('is a boss-sized silhouette, several heroes wide and tall', () => {
    // The Workplace lesson, applied: size against the DRAWN hero (48×60), never his
    // 28×44 hitbox. At 200×190 (the previous build) it rasterised as a hunched lizard
    // with no legible legs; a boss the owner's reference would recognise needs to
    // dwarf the player.
    expect(D.BODY_W / 48).toBeGreaterThanOrEqual(5);
    expect(D.BODY_H / 60).toBeGreaterThanOrEqual(4);
    // The grid is a little wider and no taller than the box: the extra is all tail,
    // which is allowed to hang out of the back of a box that is only a water target.
    expect(BEAST_W).toBeGreaterThan(D.BODY_W);
    expect(BEAST_H).toBe(D.BODY_H);
  });

  it('stands on the ground: the lowest thing it paints is the ground band', () => {
    // The owner's call, measured on the pixels rather than on the state. Nothing may
    // hang below the floor, and something must reach it — those two together are
    // "two feet on the ground".
    const { ctx, rects } = recorder();
    const d = dragon();
    drawDragon(ctx, d, 1.2, true);
    const lowest = Math.max(...rects.map((r) => r.y + r.h));
    expect(lowest).toBe(GROUND_TOP);
  });

  it('has no wings and no horns: nothing is painted above its own skull', () => {
    // The two things that made the previous build a wyvern rather than a Godzilla.
    // The horns were drawn as tapers off the crown and the wings as a mirrored pair
    // off the shoulders, so both showed up *above* and *outside* the grid — which is
    // exactly what this measures.
    const { ctx, rects } = recorder();
    const d = dragon();
    drawDragon(ctx, d, 1.2, true);
    const highest = Math.min(...rects.map((r) => r.y));
    expect(highest).toBeGreaterThanOrEqual(d.box.y);
  });

  it('is crimson, and wears nothing in the reserved value orange', () => {
    // Orange belongs to fire on this screen. A beast in any of it could be mistaken
    // for its own flame, which is the one confusion the screen cannot afford.
    const { ctx, rects } = recorder();
    drawDragon(ctx, dragon(), 1.2, true);
    const fills = upper(rects);
    expect(fills).toContain('#9B2F38'); // scale
    expect(fills).toContain('#E7D3A6'); // belly
    expect(fills).toContain('#EFE4C8'); // dorsal fins, teeth, claws
    for (const r of rects) {
      expect(r.fill.toUpperCase()).not.toContain(BRAND.ORANGE);
    }
  });

  it('wears glasses and nothing else: no jacket, no tie, no shirt', () => {
    // Owner call, third pass. The costume used to be four garments; it is one pair of
    // glasses, and this is the assertion that says so in the palette rather than in a
    // comment — the suit, shirt and tie colours must be nowhere on it.
    const { ctx, rects } = recorder();
    drawDragon(ctx, dragon(), 1.2, true);
    const fills = upper(rects);
    expect(fills).toContain('#16232A'); // frame
    expect(fills.some((f) => f.startsWith('RGBA(207,230,236,0.42'))).toBe(true); // lens
    for (const gone of ['#243642', '#1E4C6B', '#EDF3F6', '#C2D4DC']) {
      expect(fills).not.toContain(gone);
    }
  });

  it('keeps the glasses on the eye rather than strapped across the muzzle', () => {
    // The correction the rasteriser caught: sized to the head instead of the eye, the
    // frame was an 80px band over the whole snout — a welding mask, and it hid the
    // teeth as well as the eye it was supposed to sit on.
    const { ctx, rects } = recorder();
    const d = dragon();
    drawDragon(ctx, d, 1.2, true);
    const glass = rects.filter((r) =>
      ['#16232A'].includes(r.fill.toUpperCase()) || r.fill.startsWith('rgba(207,230,236,0.42'),
    );
    expect(glass.length).toBeGreaterThan(2);
    const span = Math.max(...glass.map((r) => r.x + r.w)) - Math.min(...glass.map((r) => r.x));
    expect(span).toBeLessThan(D.BODY_W * 0.32);
    // …and it is up on the head, in the top quarter of the animal.
    for (const r of glass) expect(r.y).toBeLessThan(d.box.y + D.BODY_H * 0.25);
  });

  it('cracks the glass as the hits land, and washes it off on the last one', () => {
    const cracksAt = (layers: number): number => {
      const { ctx, rects } = recorder();
      drawDragon(ctx, dragon({ layers }), 1.2, true);
      return rects.filter((r) => r.fill.toUpperCase() === '#0B1418').length;
    };
    // Untouched glass is clean; every hit adds a splinter.
    expect(cracksAt(4)).toBe(0);
    expect(cracksAt(3)).toBeGreaterThan(0);
    expect(cracksAt(2)).toBeGreaterThan(cracksAt(3));
    expect(cracksAt(1)).toBeGreaterThan(cracksAt(2));

    // The final hit slides the frame off the snout and fogs it on the way.
    const dry = recorder();
    drawDragon(dry.ctx, dragon({ layers: 1 }), 1.2, true);
    const washing = recorder();
    drawDragon(
      washing.ctx,
      dragon({ layers: 0, dissolve: { layer: 1, progress: 0.6, hitY: 440 } }),
      1.2,
      true,
    );
    const frameY = (rs: Rect[]) =>
      Math.min(...rs.filter((r) => r.fill.toUpperCase() === '#16232A').map((r) => r.y));
    expect(frameY(washing.rects)).toBeGreaterThan(frameY(dry.rects));
    // Water on the glass: fog over the lens and runs coming off it.
    expect(washing.rects.some((r) => r.fill.includes('233,246,250'))).toBe(true);
    expect(washing.rects.some((r) => r.fill.includes('168,236,250'))).toBe(true);
  });

  it('leaves nothing but the wreck of the costume once it is beaten', () => {
    // The owner's call, and the assertion is deliberately blunt: after the last hit
    // there must be **no animal** on the frame. An earlier build held the undressed
    // beast at a third alpha, which read as a defeated lizard standing behind the five
    // people who are the actual payoff.
    const { ctx, rects } = recorder();
    drawDragon(ctx, dragon({ layers: 0, phase: 'beaten' }), 1.2, true);
    const fills = upper(rects);
    for (const flesh of ['#9B2F38', '#5C1620', '#C24A50', '#E7D3A6', '#EFE4C8']) {
      expect(fills).not.toContain(flesh);
    }
    // What is left is on the floor: the frame, a cracked lens and the water it came
    // off in.
    expect(fills).toContain('#16232A');
    expect(fills).toContain('#0B1418');
    expect(rects.some((r) => r.fill.includes('28,127,166'))).toBe(true);
    for (const r of rects) expect(r.y).toBeGreaterThan(GROUND_TOP - 40);
  });

  it('grows the wreck under itself while it comes apart', () => {
    // `stripping` is the hand-over: the beast fades as the heap builds, so one becomes
    // the other rather than one being swapped for it.
    const early = recorder();
    drawDragon(early.ctx, dragon({ layers: 0, phase: 'stripping', progress: 0.1 }), 1.2, true);
    const late = recorder();
    drawDragon(late.ctx, dragon({ layers: 0, phase: 'stripping', progress: 0.9 }), 1.2, true);
    const wreck = (rs: Rect[]) => rs.filter((r) => r.y >= GROUND_TOP - 30).length;
    expect(wreck(early.rects)).toBeGreaterThan(0);
    expect(wreck(late.rects)).toBeGreaterThanOrEqual(wreck(early.rects));
    // …and the label stops the moment it stops being the obstacle.
    expect(late.rects.some((r) => r.fill.includes('155,47,56'))).toBe(false);
  });

  it('says ROAR while it is harmless, and stops the moment it is not', () => {
    const roaring = recorder();
    drawDragon(roaring.ctx, dragon({ phase: 'roar', progress: 0.5 }), 1.2, true);
    const quiet = recorder();
    drawDragon(quiet.ctx, dragon({ phase: 'waiting' }), 1.2, true);
    // The roar adds cream arcs off the jaw and the word itself.
    const cream = (rs: Rect[]) => rs.filter((r) => r.fill.includes('255,242,208')).length;
    expect(cream(roaring.rects)).toBeGreaterThan(6);
    expect(cream(quiet.rects)).toBe(0);
    expect(roaring.rects.length).toBeGreaterThan(quiet.rects.length);
  });

  it('keeps its name plate and pips off the HUD corner it stands in', () => {
    // It lives at the far right, where the HUD's clock and delay log hang. The plate
    // is therefore drawn to the INSIDE of the body at chest height, and this is the
    // guard that nobody "tidies" it back over the head into the chrome.
    const { ctx, rects } = recorder();
    const d = dragon();
    drawDragon(ctx, d, 1.2, true);
    const cx = d.box.x + d.box.w / 2;
    const pips = rects.filter((r) => r.w === 8 && r.h <= 6 && r.x < cx - 150);
    expect(pips.filter((r) => r.fill.toUpperCase() === '#A8ECFA')).toHaveLength(4);
    // Nothing at all is painted in the top-right corner of the frame.
    expect(rects.filter((r) => r.x > 1080 && r.y < d.box.y - 20)).toHaveLength(0);
  });

  it('drops the pips once it has been beaten', () => {
    const { ctx, rects } = recorder();
    const d = dragon({ layers: 0, phase: 'beaten' });
    drawDragon(ctx, d, 1.2, true);
    const cx = d.box.x + d.box.w / 2;
    expect(rects.filter((r) => r.w === 8 && r.h <= 6 && r.x < cx - 150)).toHaveLength(0);
  });

  it('draws the same animal facing either way', () => {
    // One grid mirrors for free, which is the main reason the composed version was
    // thrown away — the stepped runs it was built from could not be flipped and needed
    // a hand-written mirror for every placement. This is the guard that the glasses
    // (drawn on top, in cell coordinates) mirror with it.
    const right = recorder();
    drawDragon(right.ctx, dragon({ dir: 1 }), 1.2, true);
    const left = recorder();
    drawDragon(left.ctx, dragon({ dir: -1 }), 1.2, true);
    expect(left.rects).toHaveLength(right.rects.length);
    // Measured over the ANIMAL's own cells only. The name plate and the pips are
    // deliberately not mirrored — they always sit on the inside of the frame, away
    // from the HUD — so including them would compare a label position rather than an
    // anatomy, which is what made the first version of this test fail by 40px.
    const flesh = ['#9B2F38', '#5C1620', '#C24A50', '#E7D3A6', '#EFE4C8', '#BCAE8C', '#1A0A0E'];
    const beast = (rs: Rect[]) => rs.filter((r) => flesh.includes(r.fill.toUpperCase()));
    const span = (rs: Rect[]) => ({
      w: Math.max(...rs.map((r) => r.x + r.w)) - Math.min(...rs.map((r) => r.x)),
      h: Math.max(...rs.map((r) => r.y + r.h)) - Math.min(...rs.map((r) => r.y)),
    });
    const a = span(beast(right.rects));
    const b = span(beast(left.rects));
    expect(a.w).toBe(b.w);
    expect(a.h).toBe(b.h);
  });

  it('holds still under reduced motion', () => {
    const fills = new Set<string>();
    for (const t of [0, 0.4, 1.1, 2.7]) {
      const { ctx, rects } = recorder();
      drawDragon(ctx, dragon(), t, true);
      fills.add(JSON.stringify(rects));
    }
    expect(fills.size).toBe(1);
  });
});

describe('the cone of fire', () => {
  it('draws nothing when there is no burst', () => {
    const { ctx, rects } = recorder();
    drawCone(ctx, null, 1.2, true);
    expect(rects).toHaveLength(0);
  });

  it('telegraphs the whole LANE on the floor, in cream, before anything burns', () => {
    const { ctx, rects } = recorder();
    const f = fire({ phase: 'windup', progress: 0.9, extent: 0 });
    drawCone(ctx, f, 1.2, true);
    // The tell has to be where the player is looking *and* has to cover the ground the
    // fire will run down — marking only one end would be a lie about the reach. It is
    // cream because two warm colours at low alpha over this screen's terracotta floor
    // rasterised as mud.
    const onFloor = rects.filter((r) => r.y + r.h >= GROUND_TOP - 14);
    expect(onFloor.length).toBeGreaterThan(10);
    const cream = onFloor.filter((r) => r.fill.includes('255,242,208'));
    expect(cream.length).toBeGreaterThan(8);
    const reach = Math.max(...cream.map((r) => r.x)) - Math.min(...cream.map((r) => r.x));
    expect(reach).toBeGreaterThan(D.CONE_REACH * 0.6);
    // …and it is legible: the marks are at high alpha, not the 0.2 wash that vanished.
    expect(cream.some((r) => /0\.[5-9]/.test(r.fill))).toBe(true);
  });

  it('draws a sight line from the jaw down the axis', () => {
    const { ctx, rects } = recorder();
    const f = fire({ phase: 'windup', progress: 0.95, extent: 0 });
    drawCone(ctx, f, 1.2, true);
    const line = rects.filter((r) => r.y > f.mouth.y - 20 && r.y < GROUND_TOP - 40);
    expect(line.length).toBeGreaterThan(4);
  });

  it('paints exactly the boxes it burns with, and nothing outside them', () => {
    // The rule the rolling flame fronts broke in the worst possible direction: they
    // leaned a bright lip 8px *outside* the hitbox on the side the player met first.
    // Here the hazard's own segments are the canvas.
    const { ctx, rects } = recorder();
    const f = fire();
    drawCone(ctx, f, 1.2, true);
    // Cells only. The taunt plaque's glyphs are painted in the same cream as the
    // flame's core and are 2px wide, so a colour-only filter picks up the label and
    // reports it as fire outside the hitbox — which is how this assertion first failed.
    const flame = rects.filter(
      (r) => r.fill.toUpperCase().startsWith('#FF') && (r.w > 6 || r.h > 6),
    );
    expect(flame.length).toBeGreaterThan(10);
    // 6px of tolerance, not 0: `pxRect` snaps every cell onto a whole-pixel grid (4px
    // here), so a rect authored exactly on a segment edge can land up to one snap step
    // outside it. The point of the assertion is that no flame is painted in a *place*
    // the hazard does not burn, not that the two agree to the pixel.
    const inside = (r: Rect) =>
      f.boxes.some(
        (b) =>
          r.x >= b.x - 6 &&
          r.x + r.w <= b.x + b.w + 6 &&
          r.y >= b.y - 6 &&
          r.y + r.h <= Math.max(b.y + b.h, GROUND_TOP) + 6,
      );
    for (const r of flame) expect(inside(r)).toBe(true);
  });

  it('grows: a half-grown cone covers less ground than a full one', () => {
    const half = recorder();
    drawCone(half.ctx, fire({ extent: 0.4 }), 1.2, true);
    const full = recorder();
    drawCone(full.ctx, fire({ extent: 1 }), 1.2, true);
    const span = (rs: Rect[]) =>
      Math.max(...rs.map((r) => r.x + r.w)) - Math.min(...rs.map((r) => r.x));
    expect(span(half.rects)).toBeLessThan(span(full.rects));
  });

  it('carries its taunt on a plaque that sits over the lane, not on the flame', () => {
    // Owner call: the labels do not travel. One per burst, pinned where the burst put
    // it, and the next burst brings the next one.
    const { ctx, rects } = recorder();
    const f = fire();
    drawCone(ctx, f, 1.2, true);
    // A plaque, not bare pixel type: bare glyphs over a flame are unreadable, which
    // is the whole reason drawLabelPlaque exists.
    const plaque = rects.filter((r) => r.fill.includes('28,10,4'));
    expect(plaque.length).toBeGreaterThan(0);
    // Over the lane, and clear of the flame's own top edge at the point it sits over
    // — measured against the segment it is actually above, because the cone's top edge
    // is 130px higher at the jaw than it is at the far end.
    const under = f.boxes.find((b) => f.labelAt.x >= b.x && f.labelAt.x <= b.x + b.w)!;
    expect(under).toBeTruthy();
    for (const r of plaque) expect(r.y + r.h).toBeLessThan(under.y);
  });

  it('boils off steam once the water is beating it back', () => {
    const dry = recorder();
    drawCone(dry.ctx, fire({ quenched: 0 }), 1.2, true);
    const wet = recorder();
    drawCone(wet.ctx, fire({ quenched: 0.6 }), 1.2, true);
    const steam = (rs: Rect[]) => rs.filter((r) => r.fill.includes('233,246,250')).length;
    expect(steam(dry.rects)).toBe(0);
    expect(steam(wet.rects)).toBeGreaterThan(4);
  });

  it('holds still under reduced motion', () => {
    const shots = new Set<string>();
    for (const t of [0, 0.7, 2.3]) {
      const { ctx, rects } = recorder();
      drawCone(ctx, fire(), t, true);
      shots.add(JSON.stringify(rects));
    }
    expect(shots.size).toBe(1);
  });
});

describe('the ground, and the bricks the badge lands on', () => {
  it('scorches the floor around the roost and nowhere else', () => {
    const { ctx, rects } = recorder();
    drawScorchedGround(ctx, 1060);
    expect(rects.length).toBeGreaterThan(20);
    for (const r of rects) {
      expect(r.x).toBeGreaterThan(700);
      expect(r.y).toBeGreaterThanOrEqual(GROUND_TOP);
    }
  });

  it('draws a floating brick inside the solid it collides as', () => {
    const { ctx, rects } = recorder();
    const rect = { x: 520, y: 480, w: 40, h: 40 };
    drawFloatingBrick(ctx, [rect], 1.2, true);
    expect(rects.length).toBeGreaterThan(6);
    // Stone and cyan studs, not level material.
    const fills = upper(rects);
    expect(fills).toContain('#6E8894');
    expect(fills).toContain('#4FBEDC');
    // The block stays inside its rect — a brick drawn wider than its solid promises a
    // ledge that is not there. The shadow on the floor under it is signposting.
    const block = rects.filter((r) => r.y >= rect.y && r.y < rect.y + rect.h);
    for (const r of block) {
      expect(r.x).toBeGreaterThanOrEqual(rect.x - 1);
      expect(r.x + r.w).toBeLessThanOrEqual(rect.x + rect.w + 1);
      expect(r.y + r.h).toBeLessThanOrEqual(rect.y + rect.h + 1);
    }
  });

  it('says it floats: a shadow on the ground under every brick', () => {
    const { ctx, rects } = recorder();
    drawFloatingBrick(ctx, [{ x: 520, y: 480, w: 40, h: 40 }], 1.2, true);
    expect(rects.some((r) => r.fill.includes('0,14,20') && r.y >= GROUND_TOP - 6)).toBe(true);
  });

  it('holds the brick still under reduced motion', () => {
    const shots = new Set<string>();
    for (const t of [0, 0.7, 2.3]) {
      const { ctx, rects } = recorder();
      drawFloatingBrick(ctx, [{ x: 520, y: 480, w: 40, h: 40 }], t, true);
      shots.add(JSON.stringify(rects));
    }
    expect(shots.size).toBe(1);
  });
});

describe('the water cannon', () => {
  it('is a bigger tool than the cutter, and it is cyan rather than orange', () => {
    const { ctx, rects } = recorder();
    drawWaterCannon(ctx, 300, GROUND_TOP, 1, 1, true);
    const span = Math.max(...rects.map((r) => r.x + r.w)) - Math.min(...rects.map((r) => r.x));
    expect(span).toBeGreaterThan(36); // the Workplace cutter's width
    const fills = upper(rects);
    expect(fills).toContain('#4FBEDC');
    expect(fills).toContain('#1C7FA6');
    // On this screen the orange is spoken for by the fire: a tool the same colour as
    // the thing it fights is a tool nobody can see working.
    for (const f of fills) expect(f).not.toContain(BRAND.ORANGE);
  });

  it('flashes and kicks on the frame it fires, and settles after', () => {
    const firing = recorder();
    drawWaterCannon(firing.ctx, 300, GROUND_TOP, 1, 0.02, true);
    const idle = recorder();
    drawWaterCannon(idle.ctx, 300, GROUND_TOP, 1, 1, true);
    expect(firing.rects.length).toBeGreaterThan(idle.rects.length);
    // The barrel recoils, so the whole tool sits further back on the firing frame.
    expect(Math.min(...firing.rects.map((r) => r.x))).toBeLessThan(
      Math.min(...idle.rects.map((r) => r.x)),
    );
  });

  it('draws a stream, not a bullet, and the head is exactly the hitbox', () => {
    const { ctx, rects } = recorder();
    const j = jet();
    drawWaterShots(ctx, [j]);
    const head = rects.find((r) => r.w === j.box.w && r.h === j.box.h);
    expect(head).toBeTruthy();
    expect(head!.x).toBe(j.box.x);
    expect(head!.y).toBe(j.box.y);
    // …with a trail behind it along its own line of travel (up and to the right
    // here, so the trail is down and to the left).
    const behind = rects.filter((r) => r.x < j.box.x - 20 && r.y > j.box.y);
    expect(behind.length).toBeGreaterThan(2);
  });

  it('paints steam that rises and fades', () => {
    const early = recorder();
    drawSteam(early.ctx, [{ x: 600, y: 400, progress: 0.1 }]);
    const late = recorder();
    drawSteam(late.ctx, [{ x: 600, y: 400, progress: 0.9 }]);
    const highest = (rs: Rect[]) => Math.min(...rs.map((r) => r.y));
    expect(highest(late.rects)).toBeLessThan(highest(early.rects));
  });
});

describe('the five hires', () => {
  it('are people, at the hero scale — not children', () => {
    const { ctx, rects } = recorder();
    drawHiredCandidates(ctx, [candidate()], 1.2, true);
    const bodyCells = rects.filter((r) => r.w <= 6 && r.h <= 6);
    const h =
      Math.max(...bodyCells.map((r) => r.y + r.h)) - Math.min(...bodyCells.map((r) => r.y));
    expect(h).toBeGreaterThanOrEqual(52); // the drawn hero is 60 tall
  });

  it('are stamped HIRED in mint — the only green-lit words on the screen', () => {
    const { ctx, rects } = recorder();
    drawHiredCandidates(ctx, [candidate()], 1.2, true);
    expect(upper(rects)).toContain('#9FE6C4');
  });

  it('are five different people, not one clone five times', () => {
    const { ctx, rects } = recorder();
    const five = Array.from({ length: 5 }, (_, i) => candidate({ x: 400 + i * 120 }));
    drawHiredCandidates(ctx, five, 1.2, true);
    const shirts = new Set(
      upper(rects).filter((f) => ['#E9F1F5', '#9FE6C4', '#A8ECFA', '#CFE6EC'].includes(f)),
    );
    expect(shirts.size).toBeGreaterThanOrEqual(3);
  });

  it('draws nobody before they have started coming out', () => {
    const { ctx, rects } = recorder();
    drawHiredCandidates(ctx, [candidate({ progress: 0, landed: false })], 1.2, true);
    expect(rects).toHaveLength(0);
  });

  it('throws no confetti under reduced motion, and none before the first landing', () => {
    const falling = recorder();
    drawHiredCandidates(falling.ctx, [candidate({ progress: 0.5, landed: false })], 1.2, false);
    const airborne = falling.rects.filter((r) => r.w === 6 && r.h === 6);
    expect(airborne).toHaveLength(0);

    const landed = recorder();
    drawHiredCandidates(landed.ctx, [candidate()], 1.2, false);
    expect(landed.rects.filter((r) => r.w === 6 && r.h === 6).length).toBeGreaterThan(10);

    const reduced = recorder();
    drawHiredCandidates(reduced.ctx, [candidate()], 1.2, true);
    expect(reduced.rects.filter((r) => r.w === 6 && r.h === 6)).toHaveLength(0);
  });
});
