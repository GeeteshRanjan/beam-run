import { describe, it, expect } from 'vitest';
import {
  BEAST_H,
  BEAST_W,
  drawBurningHero,
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
import { coneAxisY, coneBoxes, CONE_LABEL_F } from '../world/Hazards/Dragon';
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

/**
 * The smallest canvas that can answer "what did it paint, where, and in what".
 *
 * It carries a **transform** now, because the taunt is set at the flame's own angle
 * (owner call) and that is `save`/`translate`/`rotate`/`restore`. Only translation is
 * applied to the recorded rectangles: a rotated glyph is not an axis-aligned box, so
 * pretending otherwise would report positions that are wrong in a way tests would then
 * be written against. What the rotation is for is checked by counting the calls.
 */
function recorder() {
  const rects: Rect[] = [];
  let tx = 0;
  let ty = 0;
  const stack: [number, number][] = [];
  const rotations: number[] = [];
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({
        x: x + tx,
        y: y + ty,
        w,
        h,
        fill: String((this as { fillStyle: string }).fillStyle),
      });
    },
    save() {
      stack.push([tx, ty]);
    },
    restore() {
      const p = stack.pop();
      if (p) [tx, ty] = p;
    },
    translate(x: number, y: number) {
      tx += x;
      ty += y;
    },
    rotate(a: number) {
      rotations.push(a);
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects, rotations };
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
    costume: null,
    jawOpen: 0,
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
    /*
     * The taunt's anchor and angle come from the hazard's own functions, because they are
     * the hazard's decision (owner call: the words sit ON the flame at the flame's angle).
     * Written out by hand here, this fixture kept the old "44px above the whole shape"
     * formula and quietly tested a picture the game no longer draws.
     */
    labelAngle: Math.atan2(
      -(coneAxisY(mouth, target, D.CONE_TOUCHDOWN) - mouth.y),
      Math.abs(target.x - mouth.x) * D.CONE_TOUCHDOWN,
    ),
    labelAt: {
      x: mouth.x + (target.x - mouth.x) * CONE_LABEL_F,
      y: coneAxisY(mouth, target, CONE_LABEL_F),
    },
    boxes: coneBoxes(mouth, target, extent),
    ...over,
  };
}

function jet(over: Partial<WaterState> = {}): WaterState {
  return { box: { x: 400, y: 480, w: D.WATER_W, h: D.WATER_H }, dx: 0.86, dy: -0.5, ...over };
}

function candidate(over: Partial<CandidateState> = {}): CandidateState {
  return { x: 640, y: GROUND_TOP, progress: 1, landed: true, dir: -1, ...over };
}

const upper = (rs: Rect[]) => rs.map((r) => r.fill.toUpperCase());

describe('the Godzilla', () => {
  it('is a boss-sized silhouette, four heroes wide and three tall', () => {
    /*
     * The Workplace lesson, applied: size against the DRAWN hero (48×60), never his 28×44
     * hitbox. It has now been measured from both ends. At 200×190 *with 10px cells* it
     * rasterised as a hunched lizard with no legible legs, which bought 260×240; the owner
     * then asked for it smaller ("decrease the size, it's too big"), and the way to give
     * that up without going back to the lizard was to halve the CELL rather than keep the
     * pixels — 200×190 out of 5px cells is 1,748 cells where 260×240 out of 10px cells was
     * 720. So the floor here is about what a boss has to be next to a person, and the
     * refinement is somewhere else entirely.
     */
    expect(D.BODY_W / 48).toBeGreaterThanOrEqual(4);
    expect(D.BODY_H / 60).toBeGreaterThanOrEqual(3);
    // …and the cell is small enough to describe an animal. 10px cells are what "blocks of
    // red colour" was, and a grid this size cannot be made of them.
    expect(BEAST_W / 46).toBeLessThanOrEqual(6);
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

  it('wears NOTHING: no glasses, no jacket, no tie, no shirt', () => {
    /*
     * Owner call, fourth pass on this costume: "remove the spectacles from the Godzilla."
     * The suit and the tie went two passes earlier and the glasses were what survived, so
     * this is the assertion that the animal is now *only* an animal — stated in the palette
     * rather than in a comment, because that is the form that survives a rebuild.
     *
     * The frame and lens tones are listed with the garments they used to be listed against,
     * which is the point: they are dead colours now and anything painting them again is a
     * costume creeping back on.
     */
    const { ctx, rects } = recorder();
    drawDragon(ctx, dragon(), 1.2, true);
    const fills = upper(rects);
    for (const gone of ['#16232A', '#0B1418', '#243642', '#1E4C6B', '#EDF3F6', '#C2D4DC']) {
      expect(fills, `${gone} is a costume colour and should be gone`).not.toContain(gone);
    }
    expect(fills.some((f) => f.startsWith('RGBA(207,230,236,0.42'))).toBe(false);
  });
  it('shows a landed hit as WATER ON THE HIDE, not as damage to something it wears', () => {
    /*
     * The `dissolve` beat still exists — the rules book a hit the frame the jet lands and the
     * picture gets `DISSOLVE_TIME` to show it — but with nothing on the animal to break, what
     * it paints is the water: a lit soaked patch where the jet landed, running down the body.
     *
     * Which is the honest picture anyway. A beast being hosed is wet; the glasses fogging and
     * running was a description of the same event through an object that is no longer there.
     */
    const dry = recorder();
    drawDragon(dry.ctx, dragon(), 1.2, true);
    const hit = recorder();
    drawDragon(hit.ctx, dragon({ layers: 3, dissolve: { layer: 4, progress: 0.4, hitY: 440 } }), 1.2, true);
    const water = (rs: Rect[]) =>
      rs.filter((r) => r.fill.includes('168,236,250') || r.fill.includes('79,190,220'));
    expect(water(dry.rects)).toHaveLength(0);
    expect(water(hit.rects).length).toBeGreaterThan(0);
    // It lands where the jet did, not at a fixed place on the sprite.
    const high = recorder();
    drawDragon(high.ctx, dragon({ layers: 3, dissolve: { layer: 4, progress: 0.4, hitY: 470 } }), 1.2, true);
    const topOf = (rs: Rect[]) => Math.min(...water(rs).map((r) => r.y));
    expect(topOf(high.rects)).toBeGreaterThan(topOf(hit.rects));
  });
  it('OPENS ITS JAW, and opens it gradually so the wind-up is the warning', () => {
    /*
     * Owner call: "while throwing the flame the Godzilla doesn't open its mouth — make it
     * open it." And it matters more than a flourish, because the same pass deleted the floor
     * marks that used to carry the wind-up (see `drawCone`): the animal's own head is the
     * telegraph now, so the jaw has to be visibly *doing* something through the whole 0.65s.
     *
     * Measured as the depth of the maw, which is the thing that grows — a boolean "mouth
     * open" sprite would pass a test written about colours and fail the note.
     */
    const mawDepth = (jawOpen: number, phase: DragonState['phase'] = 'charging'): number => {
      const { ctx, rects } = recorder();
      drawDragon(ctx, dragon({ jawOpen, phase }), 1.2, true);
      const maw = rects.filter((r) => r.fill.toUpperCase() === '#2E070B');
      if (maw.length === 0) return 0;
      // Against the SHUT mouth's own span, not against zero: the grid already carries a
      // closed mouth line in the same tone, so "how much maw is there" only means
      // anything as a difference. A test written against zero passes for the wrong
      // reason and then fails the moment somebody draws teeth.
      return Math.max(...maw.map((r) => r.y + r.h)) - Math.min(...maw.map((r) => r.y));
    };
    const shut = mawDepth(0, 'waiting');
    expect(mawDepth(0.4)).toBeGreaterThan(shut);
    expect(mawDepth(1)).toBeGreaterThan(mawDepth(0.4));
    // Lit from inside while it is charging or burning: light in a mouth is what makes an
    // open mouth read as a mouth rather than as a bite taken out of the head.
    const { ctx, rects } = recorder();
    drawDragon(ctx, dragon({ jawOpen: 1, phase: 'burning' }), 1.2, true);
    expect(upper(rects)).toContain('#FFF2D0');
  });
  it('leaves an empty COSTUME on the floor once it is beaten, and nothing standing', () => {
    /*
     * The owner's ending: "it dies on the ground and on one side the Godzilla's costume
     * opens up". So what is left is a suit lying on the floor — the animal's own hide, which
     * is why the flesh colours are *expected* here rather than banned, and the assertion
     * that matters is about **height**: nothing is standing. An earlier build held the
     * undressed beast up at a third alpha, which read as a defeated lizard behind the five
     * people who are the actual payoff; the one before that left a heap of spectacle frames,
     * which nobody could have walked out of.
     */
    const { ctx, rects } = recorder();
    drawDragon(
      ctx,
      dragon({ layers: 0, phase: 'beaten', costume: { openness: 1, fade: 0 } }),
      1.2,
      true,
    );
    const fills = upper(rects);
    expect(fills).toContain('#9B2F38'); // its hide, on the floor
    // Nothing is more than a heap high: the suit is 65px deep and it lies on the ground.
    const highest = Math.min(...rects.map((r) => r.y));
    expect(highest).toBeGreaterThan(GROUND_TOP - 90);
    // The way out of it, and the water that put it there.
    expect(fills).toContain('#180509'); // the dark inside of the suit
    expect(rects.some((r) => r.fill.includes('28,127,166'))).toBe(true); // the puddle
    // …and NO glasses lying beside it (owner call): they were the trophy of a costume the
    // animal no longer wears, i.e. a prop for an object the player never saw.
    for (const gone of ['#16232A', '#0B1418']) expect(fills).not.toContain(gone);
  });

  it('unzips the suit as far as it has been opened, and no further', () => {
    // The opening is an event, not a state: before the zip has run, those columns are the
    // suit's own body. A costume that is open the frame it lands cannot be *opened*.
    const shut = recorder();
    drawDragon(
      shut.ctx,
      dragon({ layers: 0, phase: 'beaten', costume: { openness: 0, fade: 0 } }),
      1.2,
      true,
    );
    const open = recorder();
    drawDragon(
      open.ctx,
      dragon({ layers: 0, phase: 'beaten', costume: { openness: 1, fade: 0 } }),
      1.2,
      true,
    );
    const inside = (rs: Rect[]) => rs.filter((r) => r.fill.toUpperCase() === '#180509').length;
    expect(inside(shut.rects)).toBe(0);
    expect(inside(open.rects)).toBeGreaterThan(20);
  });

  it('goes when it is told to: a faded costume paints nothing at all', () => {
    // "The costume after some time vanishes" (owner call). The hazard reports null once it
    // has gone, and a fully faded one must not linger as a dark smear either.
    const { ctx, rects } = recorder();
    drawDragon(
      ctx,
      dragon({ layers: 0, phase: 'beaten', costume: { openness: 1, fade: 1 } }),
      1.2,
      true,
    );
    expect(rects).toHaveLength(0);
    const gone = recorder();
    drawDragon(gone.ctx, dragon({ layers: 0, phase: 'beaten', costume: null }), 1.2, true);
    expect(gone.rects).toHaveLength(0);
  });

  it('TOPPLES as it dies, and the suit builds up under it', () => {
    /*
     * `stripping` is the hand-over: the beast leans further and sinks as the empty suit
     * comes up under it, so one becomes the other. It used to dissolve on the spot, which
     * left nothing that could then be opened — and the opening is the ending.
     */
    const early = recorder();
    drawDragon(early.ctx, dragon({ layers: 0, phase: 'stripping', progress: 0.1 }), 1.2, true);
    const late = recorder();
    drawDragon(late.ctx, dragon({ layers: 0, phase: 'stripping', progress: 0.9 }), 1.2, true);
    // The lean: its highest cells have travelled sideways, and the whole animal is lower.
    const crown = (rs: Rect[]) => {
      const top = Math.min(...rs.map((r) => r.y));
      const band = rs.filter((r) => r.y < top + 30);
      return { top, x: Math.max(...band.map((r) => r.x)) };
    };
    const a = crown(early.rects);
    const b = crown(late.rects);
    expect(b.top).toBeGreaterThan(a.top);
    expect(Math.abs(b.x - a.x)).toBeGreaterThan(40);
    // …and the suit is already on the floor underneath it.
    expect(late.rects.filter((r) => r.y >= GROUND_TOP - 30).length).toBeGreaterThan(10);
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

  it('carries a real HEALTH BAR, and keeps it off the HUD corner it stands in', () => {
    /*
     * Owner call: "remove the life visibility of the Godzilla and add a better one, a more
     * visible one." What went was four 8x5 pips - 32px of lit cells beside a 200px animal -
     * *and* the glasses, whose cracks were the readout that actually told you how the fight
     * was going. So the bar has to carry the whole job.
     *
     * Three things are asserted and each one is a rule the game already paid for elsewhere:
     * it is far bigger than what it replaced; it does **not change width** as it empties
     * (the HUD lives plaque's rule - a readout that shrinks is a readout that moves); and
     * nothing is painted in the top-right corner, where this beast stands under the HUD's
     * own right-hand column and the rasteriser cannot see the chrome.
     */
    const barOf = (layers: number) => {
      const { ctx, rects } = recorder();
      const d = dragon({ layers });
      drawDragon(ctx, d, 1.2, true);
      const cx = d.box.x + d.box.w / 2;
      const low = rects.filter((r) => r.x < cx - 150 && r.y > d.box.y + D.BODY_H * 0.6);
      // The bar's frame is its widest single rectangle down here; the lit rails are the
      // 3px courses along the top of each held segment.
      const frame = low.reduce((a, r) => (r.w > a.w ? r : a), low[0]!);
      return {
        left: frame.x,
        right: frame.x + frame.w,
        held: low.filter((r) => r.fill.toUpperCase() === '#A8ECFA' && r.h === 3 && r.w > 20)
          .length,
      };
    };
    const full = barOf(4);
    expect(full.right - full.left).toBeGreaterThan(150);
    expect(full.held).toBe(4);
    // Emptying changes what is lit, never the bar's extent.
    for (const layers of [3, 2, 1, 0]) {
      const b = barOf(layers);
      expect(b.left).toBe(full.left);
      expect(b.right).toBe(full.right);
      expect(b.held).toBe(layers);
    }
    // Nothing at all is painted in the top-right corner of the frame.
    const d = dragon();
    const { ctx, rects } = recorder();
    drawDragon(ctx, d, 1.2, true);
    expect(rects.filter((r) => r.x > 1080 && r.y < d.box.y - 20)).toHaveLength(0);
  });

  it('drops the health bar once it has been beaten', () => {
    const { ctx, rects } = recorder();
    const d = dragon({ layers: 0, phase: 'beaten', costume: { openness: 1, fade: 0 } });
    drawDragon(ctx, d, 1.2, true);
    const cx = d.box.x + d.box.w / 2;
    const lit = rects.filter((r) => r.x < cx - 150 && r.fill.toUpperCase() === '#A8ECFA');
    expect(lit).toHaveLength(0);
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

  it('telegraphs on the ANIMAL, not with lines on the floor', () => {
    /*
     * Owner call: "there are dashed lines, one on the floor till where the flame will come
     * and one in the path of the flame - those don't look nice, remove them, only keep the
     * flame."
     *
     * What went: 32px cream dashes marching out along the floor with orange chevrons over
     * every other one, eight stepping cells down the axis, and a bracketed bar at the far
     * end. Every one of them existed to satisfy "the tell has to be where the player is
     * looking", and every one of them was a dashed line drawn across the picture.
     *
     * So this is the one place in the game where a telegraph was **deleted rather than
     * moved**, and the test states what carries it instead: nothing on the floor, and a
     * charging throat plus falling embers at the jaw. The jaw opening is the third part and
     * it belongs to `drawDragon` (tested there), which is why those two notes turned out to
     * be one change.
     */
    const { ctx, rects } = recorder();
    const f = fire({ phase: 'windup', progress: 0.9, extent: 0 });
    drawCone(ctx, f, 1.2, true);
    // Nothing at all on the floor: no lane, no chevrons, no bracket at the reach.
    expect(rects.filter((r) => r.y + r.h >= GROUND_TOP - 14)).toHaveLength(0);
    // Nothing down the axis either, away from the jaw.
    expect(rects.filter((r) => Math.abs(r.x - f.mouth.x) > 120)).toHaveLength(0);
    // What IS there is at the mouth: a tightening ring and a hot core.
    const atJaw = rects.filter((r) => Math.abs(r.x - f.mouth.x) < 40);
    expect(atJaw.length).toBeGreaterThan(6);
    expect(atJaw.some((r) => r.fill.includes('255,242,208'))).toBe(true);
    expect(atJaw.some((r) => r.fill.includes('255,84,0'))).toBe(true);
  });

  it('drops embers out of the open jaw once the mouth is properly open', () => {
    // The vertical half of the telegraph, and the reason it reads from the far end of the
    // frame: a glow inside a head is ~30px of change on a busy backdrop, and something
    // falling out of that head is movement.
    const early = recorder();
    drawCone(early.ctx, fire({ phase: 'windup', progress: 0.2, extent: 0 }), 1.2, true);
    const late = recorder();
    drawCone(late.ctx, fire({ phase: 'windup', progress: 0.95, extent: 0 }), 1.2, true);
    const embers = (rs: Rect[]) =>
      rs.filter(
        (r) => r.w === 6 && r.h === 6 && ['#FFB07A', '#FF5400'].includes(r.fill.toUpperCase()),
      );
    expect(embers(early.rects)).toHaveLength(0);
    expect(embers(late.rects).length).toBeGreaterThan(2);
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

  it("writes its taunt ON the flame, at the flame's own angle, and does not move it", () => {
    /*
     * Owner call: "the text that depicts what this flame represents should be an overlay on
     * top of the flame itself, in the same angle the flame is in, and it should be present on
     * the flame; it should not come forward with the flame - while the flame is there it is
     * there too."
     *
     * Four claims, four assertions. The plaque is gone (a framed dark plate over burning fire
     * is a sign in *front* of the fire); the type is set inside the flame's own band; it is
     * rotated to the axis; and its position comes from the burst, so it does not move as the
     * fire grows through it.
     */
    const { ctx, rects, rotations } = recorder();
    const f = fire();
    drawCone(ctx, f, 1.2, true);
    // No plaque: the old background tone is not painted at all.
    expect(rects.some((r) => r.fill.includes('28,10,4'))).toBe(false);
    // It is rotated, and by the angle the hazard committed.
    expect(rotations).toContain(f.labelAngle);
    // The glyphs are ON the flame: inside the band, not above it. Measured against the
    // segment the anchor falls in, because the cone's top edge is far higher at the jaw.
    const under = f.boxes.find((b) => f.labelAt.x >= b.x && f.labelAt.x <= b.x + b.w)!;
    expect(under).toBeTruthy();
    const glyphs = rects.filter((r) => r.fill.toUpperCase() === '#FFF6E2');
    expect(glyphs.length).toBeGreaterThan(20);
    for (const r of glyphs) {
      expect(r.y).toBeGreaterThan(under.y - 30);
      expect(r.y).toBeLessThan(under.y + under.h + 30);
    }
    // Growing the flame does not move the words.
    const half = recorder();
    drawCone(
      half.ctx,
      { ...f, extent: 0.5, boxes: coneBoxes(f.mouth, f.target, 0.5) },
      1.2,
      true,
    );
    const leftmost = (rs: Rect[]) =>
      Math.min(...rs.filter((r) => r.fill.toUpperCase() === '#FFF6E2').map((r) => r.x));
    expect(leftmost(half.rects)).toBe(leftmost(rects));
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
  it('leaves the BRICKS CLEAN while the beast still holds the far end', () => {
    /*
     * Owner call: "below the Godzilla, on the bricks, there are some dirty/black spots on the
     * brick - can you clean that."
     *
     * There was a 600x24 dither of near-black cells over the ground band under the roost:
     * the animal's own scorch on paper, a scatter of dirt on the frame. Fourth time this
     * build has been told that loose dark cells over a lit material read as dirt (the badge's
     * dithered halo, the drifting embers, the confetti, now this), so the rule is worth
     * having in a test as well as in a doc: **a texture that is a scatter of dark cells over
     * a lit material will read as dirt on that material.**
     *
     * So this function draws nothing at all until the screen has been won.
     */
    const { ctx, rects } = recorder();
    drawScorchedGround(ctx, 1060);
    expect(rects).toHaveLength(0);
  });
  it('grows grass through the floor once it has been beaten', () => {
    // The half that survived: the payoff. Something *did* happen here, and what says so is
    // the ground recovering rather than a stain that stayed.
    const { ctx, rects } = recorder();
    drawScorchedGround(ctx, 1060, 1);
    expect(rects.length).toBeGreaterThan(20);
    expect(rects.some((r) => r.fill.toUpperCase() === '#7BC46A')).toBe(true);
    for (const r of rects) {
      expect(r.x).toBeGreaterThan(700);
      // On the floor, not floating over it: blades grow up out of the walkable line.
      expect(r.y).toBeLessThan(GROUND_TOP);
      expect(r.y).toBeGreaterThan(GROUND_TOP - 40);
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
    // 8px cells, and only over the line-up: 24 six-pixel cells across the whole frame read
    // as specks of dirt against the bright sky the payoff now brings up, which is the same
    // defect that deleted this screen's drifting embers.
    const confetti = (rs: Rect[]) => rs.filter((r) => r.w === 8 && r.h === 8);
    expect(confetti(falling.rects)).toHaveLength(0);

    const landed = recorder();
    drawHiredCandidates(landed.ctx, [candidate()], 1.2, false);
    expect(confetti(landed.rects).length).toBeGreaterThan(8);
    for (const r of confetti(landed.rects)) {
      expect(Math.abs(r.x - 640)).toBeLessThan(140);
    }

    const reduced = recorder();
    drawHiredCandidates(reduced.ctx, [candidate()], 1.2, true);
    expect(confetti(reduced.rects)).toHaveLength(0);
  });
});

describe('the player, burning', () => {
  /*
   * The fourth death pose (owner call: "for the dying effect of our character, make the
   * character burn upon touching the fire from the Godzilla"), and the assertions are about
   * the two things the first cut got wrong. It drew a flame column per 4px of body, every
   * column reaching a similar height, which rasterised as an **orange box with a head
   * sticking out of it** — the cone's eight-rectangles defect in a second costume. What
   * reads as burning is a handful of tongues at very different heights with the person
   * visible between them, and soot on the body underneath.
   */
  const burn = (p: number, reduced = false) => {
    const { ctx, rects } = recorder();
    drawBurningHero(ctx, 400, GROUND_TOP, p, 1.2, reduced);
    return rects;
  };
  const fire = (rs: Rect[]) => rs.filter((r) => r.fill.toUpperCase().startsWith('#FF'));

  it('burns in TONGUES with air between them, not as a block', () => {
    const rs = burn(0.8);
    const flame = fire(rs);
    expect(flame.length).toBeGreaterThan(20);
    // Every flame cell is one 4px cell wide or a small multiple of it: no filled slabs.
    for (const r of flame) expect(r.w).toBeLessThanOrEqual(12);
    // Tongues reach very different heights — that spread is the whole read. Measured as
    // the top of the flame per column band.
    const tops = new Map<number, number>();
    for (const r of flame) {
      const band = Math.round(r.x / 12);
      tops.set(band, Math.min(tops.get(band) ?? 1e9, r.y));
    }
    const hs = [...tops.values()];
    expect(Math.max(...hs) - Math.min(...hs)).toBeGreaterThan(30);
    /*
     * …and there is unpainted air between them, which is the assertion that actually rules
     * out the box: the flame's own cells cover less than half of the rectangle they span.
     * The rejected version covered nearly all of it, which is the definition of a slab.
     */
    const x0 = Math.min(...flame.map((r) => r.x));
    const x1 = Math.max(...flame.map((r) => r.x + r.w));
    const y0 = Math.min(...flame.map((r) => r.y));
    const y1 = Math.max(...flame.map((r) => r.y + r.h));
    // Distinct cells, not painted area: a tongue paints its shell and then its core over
    // the same cell, so summing areas double-counts and would flatter any shape.
    const cells = new Set<string>();
    for (const r of flame) {
      for (let cx2 = r.x; cx2 < r.x + r.w; cx2 += 4) {
        for (let cy = r.y; cy < r.y + r.h; cy += 4) cells.add(`${cx2 >> 2},${cy >> 2}`);
      }
    }
    expect((cells.size * 16) / ((x1 - x0) * (y1 - y0))).toBeLessThan(0.45);
  });

  it('chars the body from the feet up, and takes hold over the beat', () => {
    const early = burn(0.1);
    const late = burn(1);
    const soot = (rs: Rect[]) =>
      rs.filter((r) => ['#180C0A', '#2A1410'].includes(r.fill.toUpperCase()));
    expect(soot(early).length).toBeGreaterThan(0);
    expect(soot(late).length).toBeGreaterThan(soot(early).length);
    // The char starts at the shoes: its lowest cell is on the floor line either way.
    expect(Math.max(...soot(late).map((r) => r.y + r.h))).toBeGreaterThan(GROUND_TOP - 8);
    // And the fire grows with it rather than arriving whole.
    const highest = (rs: Rect[]) => Math.min(...fire(rs).map((r) => r.y));
    expect(highest(late)).toBeLessThan(highest(early));
  });

  it('sends up PALE smoke, and only as the fire takes hold', () => {
    // Pale because it has to read against a near-black sky; the first version was a dark
    // grey at low alpha and rasterised as nothing at all.
    const smoke = (rs: Rect[]) => rs.filter((r) => r.fill.includes('206,210,208'));
    const late = burn(1);
    expect(smoke(late).length).toBeGreaterThan(3);
    for (const r of smoke(late)) expect(r.y).toBeLessThan(GROUND_TOP - 60);
    const alphas = smoke(late).map((r) => Number(r.fill.slice(r.fill.lastIndexOf(',') + 1, -1)));
    expect(Math.max(...alphas)).toBeGreaterThan(0.2);
    // At the start of the beat there is barely any of it.
    const maxEarly = Math.max(
      ...smoke(burn(0.05)).map((r) => Number(r.fill.slice(r.fill.lastIndexOf(',') + 1, -1))),
    );
    expect(maxEarly).toBeLessThan(0.06);
  });

  it('holds still under reduced motion, and drops the embers', () => {
    const a = burn(0.7, true);
    const b = burn(0.7, true);
    expect(b).toEqual(a);
    // The two embers are the only wall-clock part, so they go with the motion.
    expect(fire(a).length).toBeLessThan(fire(burn(0.7, false)).length);
  });
});
