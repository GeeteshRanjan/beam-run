/**
 * Scoped UI stylesheet, injected once per Game instance. All selectors are
 * prefixed `beam-run__` to avoid bleeding into the host page.
 *
 * Colours come from the brand palette; orange is reserved for the "value"
 * accent (primary CTA, engaged capability, the closing figure).
 *
 * Contrast rules applied throughout:
 *  - every HUD readout sits on a solid dark panel, never bare text over art
 *    (text-shadow alone is not readable over a busy pixel backdrop);
 *  - body text is #E6E6E6 on ~#00242E (≈13:1) and the orange accents are used
 *    at large sizes or on dark fills only;
 *  - focus rings are 3px white and always visible on keyboard focus;
 *  - every animation is disabled under prefers-reduced-motion.
 */
import { BRAND } from '../data/tuning.config';
import { TYPOGRAPHY, RADII } from '../data/tokens';
import {
  LIVES_PLAQUE,
  PAD_PORTRAIT,
  PAD_PORTRAIT_LARGE,
  PAUSE_BTN,
  padCss,
} from './touchGeometry';

export const STYLE_ELEMENT_ID = 'beam-run-styles';

/**
 * One "scale unit" for DOM UI text = 1% of the *play frame* width, not 1% of the
 * browser window. The frame is letterbox-fitted to the available space, so window
 * units make the HUD and overlays the wrong size (and overflow the frame) whenever
 * the two diverge — e.g. a 1280-wide window that is only 600 tall shrinks the frame
 * to ~1066 but `vw` text keeps growing. Falls back to `vw` where container query
 * units are unsupported; see the @supports block below `.beam-run__stage`.
 */
const U = (n: number): string => `calc(${n} * var(--beam-run-u))`;
/**
 * A design pixel: 1px on any frame up to the native 1280, and growing with the frame
 * past it (`--beam-run-px`, set on the stage). Every px *ceiling* in this sheet is
 * written with it, because the standalone site lifts the 1280px display cap: with
 * plain px ceilings every overlay line and panel stopped growing at ~1300-1650px
 * while the canvas kept scaling, so on a 1920 or 2560 screen the cards and the title
 * screen read as a small island in the middle of a big picture. Floors stay plain
 * px (they are legibility minimums on small frames, where this is exactly 1px).
 */
const P = (n: number): string => `calc(${n} * var(--beam-run-px, 1px))`;

/**
 * Shared plaque behind every HUD readout: the legibility fix (never bare text
 * over pixel art) rendered as an 8-bit panel rather than a web card.
 *
 * A 1px hairline border with a soft drop shadow and 82% alpha is a modern-UI
 * device and read as a widget pasted over the game. 8-bit hardware had no alpha
 * and no sub-pixel edges, so: solid fill, square corners, a 3px light/dark inner
 * bevel and a hard 3px dark rail — the same treatment as the NES buttons below.
 */
const RAIL = 'rgba(0, 14, 20, 0.92)';
const PANEL = `
  background: #00161D;
  border: 0;
  border-radius: 0;
  box-shadow:
    inset 3px 3px 0 rgba(150, 205, 218, 0.22),
    inset -3px -3px 0 rgba(0, 0, 0, 0.45),
    0 0 0 3px ${RAIL};
  padding: 7px 11px;
`;



export const CSS = `
/* Moderat (brand typeface). Uses an installed copy if present; a subset WOFF2
   can be dropped in later by adding a url() source below. System-sans until
   then, so the game never blocks on a font. */
@font-face {
  font-family: 'Moderat';
  src: local('Moderat'), local('Moderat-Regular');
  /* , url('./fonts/moderat-subset.woff2') format('woff2'); */
  font-weight: 400 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Moderat Mono';
  src: local('Moderat Mono'), local('ModeratMono-Regular');
  /* , url('./fonts/moderat-mono-subset.woff2') format('woff2'); */
  font-weight: 400 700;
  font-style: normal;
  font-display: swap;
}

.beam-run { display: block; }

/*
 * Stage sizing: the play frame is 16:9 and must fit the *available height* as
 * well as the width, otherwise on a short/wide viewport the width-driven
 * aspect-ratio box runs off the bottom of the screen (and the letterboxed
 * canvas inside it looks tiny). Two host-overridable knobs:
 *   --beam-run-max-width   cap on displayed width  (default 1280px = native)
 *   --beam-run-max-height  available height        (default the full viewport)
 * vh is used in the base rule so every engine gets a valid value; dvh (which
 * excludes mobile browser chrome) is layered on behind @supports.
 */
.beam-run__stage {
  --beam-run-u: 1vw;
  --beam-run-px: max(1px, calc(var(--beam-run-u) * 100 / 1280));
  position: relative;
  width: 100%;
  max-width: min(
    var(--beam-run-max-width, 1280px),
    calc(var(--beam-run-max-height, 100vh) * 1280 / 720)
  );
  margin: 0 auto;
  aspect-ratio: 1280 / 720;
  background: ${BRAND.DEEP_TEAL};
  font-family: ${TYPOGRAPHY.fontFamily};
  color: ${BRAND.WHITE};
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  /* Kill double-tap zoom on the play surface but keep the host page scrollable,
     and stop a mistimed swipe turning into pull-to-refresh mid-run. */
  touch-action: manipulation;
  overscroll-behavior: contain;
  -webkit-touch-callout: none;
}
@supports (height: 100dvh) {
  /* dvh tracks the *visible* viewport, so the frame doesn't get cropped by the
     mobile URL bar and doesn't jump when that bar collapses. */
  .beam-run__stage {
    max-width: min(
      var(--beam-run-max-width, 1280px),
      calc(var(--beam-run-max-height, 100dvh) * 1280 / 720)
    );
  }
}
@supports (container-type: inline-size) {
  /* Make the frame a size container so 1 --beam-run-u = 1% of the frame width.
     Text then scales with the game, exactly like the canvas contents. */
  .beam-run__stage,
  .beam-run__fallback { container-type: inline-size; --beam-run-u: 1cqw; }
}

/*
 * THE CONTROL BAND — A TOUCH LAYOUT, NOT A PORTRAIT ONE -----------------------
 * A 16:9 frame can only be as wide as its container, so on a phone held upright
 * it is width-limited: on a 390px-wide phone the play frame is only ~219px tall.
 * Packing the HUD, the overlays and the thumb buttons into that strip is what
 * made the mobile view unusable — the controls covered the ground the player
 * was running on.
 *
 * So on a touch device the stage deliberately stops being 16:9 and grows into
 * the free vertical space. The canvas still contain-fits (letterboxed in brand
 * teal, which the renderer already paints), and the bands above/below the frame
 * become the HUD + controls area: nothing overlaps gameplay and the buttons sit
 * where a thumb actually is.
 *
 *   --beam-run-portrait-band  extra height beyond the frame. Default 360px —
 *                             180px per band, which clears the safe area plus a
 *                             120px thumb button — so an embed stays bounded in
 *                             page flow; a standalone page passes 100dvh to go
 *                             full-screen.
 *
 * THE GATE IS THE CLASS, AND IT USED TO BE the orientation media query.
 * Orientation is not a proxy for "has thumbs". Any *desktop* window taller than
 * it is wide — a browser docked to half a 16:9 screen, a rotated monitor, a Mac
 * window dragged narrow — matched that query and got the phone layout: the box
 * stopped being 16:9, the frame shrank to a strip centred in two large empty
 * bands, and nothing was ever drawn in them because a mouse device has no thumb
 * controls. That is the whole of why the game looked a different shape from one
 * machine to the next. And the same query excluded the case that needed the band
 * most: a *tablet in landscape* is 4:3-ish, so it had no band at all and the
 * thumb buttons sat on the gameplay. The Game sets --touch from the same
 * isTouchDevice() signal that decides whether the buttons exist, so the box and
 * its contents cannot disagree. Both orientations, one rule: the stage takes the
 * height it is given and the canvas letterboxes inside it.
 */
.beam-run__stage--touch {
  aspect-ratio: auto;
  height: min(
    var(--beam-run-max-height, 100vh),
    calc(56.25vw + var(--beam-run-portrait-band, 360px))
  );
}
@supports (height: 100dvh) {
  .beam-run__stage--touch {
    height: min(
      var(--beam-run-max-height, 100dvh),
      calc(56.25vw + var(--beam-run-portrait-band, 360px))
    );
  }
}
.beam-run__canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }

.beam-run__ui { position: absolute; inset: 0; pointer-events: none; }
.beam-run__ui * { box-sizing: border-box; }

/* HUD ------------------------------------------------------------------ */
/* Gutter = the inset every HUD readout keeps from the frame edge, plus the
   device safe area so a notch or home indicator never sits on a readout. */
.beam-run__hud {
  position: absolute; inset: 0; padding: clamp(8px, 2.2%, ${P(22)});
  display: none; pointer-events: none;
}
.beam-run__hud--visible { display: block; }
/* The secret stage: no plaques, but the live region stays in the tree (see Hud.setBare). */
.beam-run__hud--bare .beam-run__hud-stack { display: none; }
/*
 * The two corner stacks. Plaques used to be positioned individually against the
 * four corners; the delay log has no fixed height, so anything sharing a corner
 * with it had to be offset by a hand-tuned pixel figure that was wrong again as
 * soon as another delay was logged. Columns solve it once, and they put every
 * readout in the top band, which is also what portrait wants (the bottom band
 * belongs to the thumb controls).
 */
.beam-run__hud-stack {
  position: absolute; top: calc(clamp(8px, 2.2%, ${P(22)}) + env(safe-area-inset-top, 0px));
  display: flex; flex-direction: column; gap: 8px;
  max-height: calc(100% - clamp(16px, 4.4%, ${P(44)}));
}
.beam-run__hud-stack--left {
  left: calc(clamp(8px, 2.2%, ${P(22)}) + env(safe-area-inset-left, 0px));
  align-items: flex-start;
}
.beam-run__hud-stack--right {
  right: calc(clamp(8px, 2.2%, ${P(22)}) + env(safe-area-inset-right, 0px));
  align-items: flex-end;
}
.beam-run__hud-row {
  display: flex; align-items: center; gap: 8px;
  ${PANEL}
}
/* Plaques shrink-wrap their art, so the shared 100% cap has nothing to measure
   against here; the width is already bounded in frame units by Hud.ts. */
.beam-run__hud .beam-run__pixels { max-width: none; }
/* Captions wrap a hidden prose span plus the bitmap art; flex keeps the art on
   its own line with no inline-baseline gap under it. */
.beam-run__hud-caption { display: flex; }
/* Stage: caption stacked over the stage name, arcade level-readout style. */
.beam-run__hud-level {
  flex-direction: column; align-items: flex-start; gap: 5px;
}

/*
 * Lives — caption over the hearts, in the top-right plaque the TIME TO MARKET
 * clock used to hold. Same column composition as the stage plaque opposite, so
 * the two top corners mirror each other.
 *
 * The rail stays cool. The clock's rail was orange because that readout was the
 * stake; orange is the ANSR *value* accent, and what is left of your attempt is
 * not value — it is what the obstacles have taken. The hearts are white.
 */
.beam-run__hud-lives {
  flex-direction: column; align-items: flex-end; gap: 6px;
}
.beam-run__hud-lives .beam-run__hud-caption { display: flex; }
/*
 * A heart going out. Stepped, not eased: whole-pixel hops and a hard rail change,
 * held per frame, which is how an 8-bit machine would draw it. This is the beat
 * the clock's bump used to carry.
 */
.beam-run__hud-lives--spent { animation: beam-run-spent 0.36s steps(1, end) both; }
@keyframes beam-run-spent {
  0% { transform: translateY(-4px); box-shadow: 0 0 0 3px ${BRAND.WHITE}; }
  25% { transform: none; box-shadow: 0 0 0 3px ${BRAND.WHITE}; }
  50% { transform: translateY(-2px); box-shadow: 0 0 0 3px rgba(150, 205, 218, 0.5); }
  75% { transform: none; box-shadow: 0 0 0 3px ${BRAND.WHITE}; }
  100% {
    transform: none;
    box-shadow:
      inset 3px 3px 0 rgba(150, 205, 218, 0.22),
      inset -3px -3px 0 rgba(0, 0, 0, 0.45),
      0 0 0 3px ${RAIL};
  }
}

/*
 * The delay log, hanging under the lives. Hidden until the first delay, so a
 * clean run never sees it. It is deliberately NOT orange: orange is the value
 * accent, and a ledger of avoidable months is the opposite of value. Only the
 * running total is warmed, because that figure is what the closing argument is
 * made of. Rows scroll internally rather than growing past the frame, and the
 * scrollbar is left to the platform.
 */
.beam-run__hud-log {
  display: none; flex-direction: column; align-items: flex-end; gap: 4px;
  background: #14181A;
  box-shadow:
    inset 3px 3px 0 rgba(150, 205, 218, 0.16),
    inset -3px -3px 0 rgba(0, 0, 0, 0.45),
    0 0 0 3px rgba(120, 152, 163, 0.55);
}
.beam-run__hud-log--visible { display: flex; }
.beam-run__hud-log-label { display: flex; }
.beam-run__hud-log-rows {
  display: flex; flex-direction: column; align-items: flex-end; gap: 3px;
  max-height: 28vh; overflow: hidden;
}
.beam-run__hud-log-row { display: flex; }
.beam-run__hud-log-total { margin-top: 2px; }

/* Engaged ANSR capability — persistent chip, no countdown (help doesn't lapse). */
.beam-run__hud-power {
  display: none; flex-direction: column; align-items: flex-start; gap: 5px;
  background: #2A1000;
  box-shadow:
    inset 3px 3px 0 rgba(255, 158, 116, 0.22),
    inset -3px -3px 0 rgba(0, 0, 0, 0.45),
    0 0 0 3px rgba(255, 84, 0, 0.75);
}
.beam-run__hud-power--visible { display: flex; }
.beam-run__hud-power-product,
.beam-run__hud-power-name { display: flex; }

/* Overlays ------------------------------------------------------------- */
.beam-run__overlay {
  position: absolute; inset: 0; display: none;
  flex-direction: column; align-items: center; justify-content: flex-start;
  gap: clamp(6px, 1.6%, ${P(14)}); text-align: center;
  padding: 5% 7%; pointer-events: auto; overflow-y: auto;
  background: rgba(0, 30, 39, 0.92);
  backdrop-filter: blur(2px);
}
.beam-run__overlay--visible { display: flex; animation: beam-run-overlay-in 0.22s ease-out both; }
/*
 * Centred with auto margins, not with justify-content (which is flex-start above for
 * exactly this reason). A flex column centred by justify-content overflows BOTH ends once it is taller than the frame, and the
 * part above the top edge is outside the scroll range: on a 16:9 frame 450px tall
 * (an 800x600 window) or a phone in landscape, the win receipt lost its brand line
 * and headline and the assist dialog lost its title, with no way to scroll to them.
 * Auto margins centre exactly the same when there is room and collapse to zero when
 * there is not, so the content starts at the top and the rest scrolls. The keyword
 * safe center would do this too, but it is not supported by every Safari still on
 * phones. The title screen is excluded: it is top-anchored by its own composition.
 */
.beam-run__overlay:not(.beam-run__overlay--start) > :first-child { margin-top: auto; }
.beam-run__overlay:not(.beam-run__overlay--start) > :last-child { margin-bottom: auto; }
/*
 * The briefing card. It used to be a 1.2s caption over the stage, so a light 55%
 * wash was right; it is a reading surface now (a stage name, a line about what is
 * in the stage, and a button that starts it), and it waits. The type sits on its own
 * panel now (see the stack rule below), so the wash's only job is to turn the stage's
 * own lettering into texture: 90% and a softer blur, still short of the base 92% —
 * the screen behind is the thing being described, and a glimpse of it belongs here.
 */
.beam-run__overlay--titlecard {
  background: rgba(0, 30, 39, 0.9);
  backdrop-filter: blur(3px);
}
@keyframes beam-run-overlay-in {
  from { opacity: 0; transform: translateY(8px) scale(0.99); }
  to { opacity: 1; transform: none; }
}

/*
 * "Scene" overlays (start, win, mid-run receipt) sit over artwork worth seeing:
 * the attract screen and the Tech Park finale. No card, no modal — the copy sits
 * straight on the game behind two 8-bit devices instead:
 *
 *   1. a CHECKERBOARD DITHER wash. 8-bit hardware had no alpha channel, so
 *      transparency was faked with a 50% chequer of solid pixels. That is the
 *      look here (4px chequer + a light flat wash), and it keeps the art
 *      readable through the overlay where a flat 92% fill just muddied it.
 *   2. static CRT scanlines over the top.
 *
 * Contrast is carried by the type itself (bitmap glyphs with a hard 1px shadow)
 * rather than by a panel behind it.
 */
/*
 * Frame padding. The title screen holds three things and can afford air; the end
 * screens hold eight and need the frame edge back, otherwise tall content pushes
 * into the (scrollable) overflow before the padding has earned anything.
 */
.beam-run__overlay--scene {
  background:
    repeating-conic-gradient(
      rgba(0, 17, 23, 0.86) 0% 25%,
      rgba(0, 17, 23, 0.30) 0% 50%
    )
    0 0 / 4px 4px,
    radial-gradient(
      140% 100% at 50% 50%,
      rgba(0, 18, 25, 0.34) 0%,
      rgba(0, 18, 25, 0.62) 100%
    );
  gap: clamp(16px, 4%, ${P(40)});
  padding: clamp(18px, 5.5%, ${P(56)}) clamp(16px, 7%, ${P(72)});
}
/* End screens (win + the mid-run receipt): tighter frame, tighter lockup gap. */
.beam-run__overlay--receipt {
  padding: clamp(14px, 3.2%, ${P(34)}) clamp(14px, 4.5%, ${P(48)});
  gap: clamp(10px, 2.2%, ${P(22)});
}
/* Title screen composition: see the TITLE SCREEN COMPOSITION note further down. */
.beam-run__overlay--scene::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.22) 0 2px,
    rgba(0, 0, 0, 0) 2px 4px
  );
}

/*
 * Content column. Deliberately NOT a card: no fill, no border, no shadow — it
 * only sets measure and vertical rhythm so the type composes.
 */
.beam-run__stack {
  position: relative;
  width: min(100%, ${P(660)});
  display: flex; flex-direction: column; align-items: center;
  gap: clamp(12px, 2.6%, ${P(26)});
  text-align: center;
}
/*
 * The end screens carry eight stacked elements (title, label, figure, meters,
 * two reference lines, the receipt, the buttons). On one uniform gap they read as
 * a pile, so the base rhythm here is tight and the space is spent *between
 * groups* instead: the figure block, the meters, the receipt and the actions each
 * open with a bigger step, while the pieces inside a group stay close.
 */
.beam-run__stack--receipt { width: min(100%, ${P(720)}); gap: clamp(5px, 1%, ${P(10)}); }
/* End-screen columns: stacked by default, side by side once the frame can carry
   it (see Overlays.columns — stacked, these screens are taller than a 16:9 frame
   and push the CTA below the fold). 900px is the smallest frame where the CTA cap
   still fits half the stack. */
.beam-run__cols,
.beam-run__col {
  display: flex; flex-direction: column; align-items: center;
  width: 100%; gap: clamp(5px, 1%, ${P(10)});
}
@container (min-width: 900px) {
  .beam-run__stack--receipt { width: min(100%, ${P(1060)}); }
  /* Equal-width columns, tops aligned and now STRETCHED to one height: the two
     captions sit on one line and the two blocks under them share both edges, which
     is what makes the screen symmetrical on a clean run — where the cost side is
     three lines against the receipt's four rows. Centring each column's mass
     instead leaves the captions on different lines, which reads as a mistake. */
  .beam-run__cols { flex-direction: row; align-items: stretch; gap: clamp(20px, 3%, ${P(44)}); }
  .beam-run__col { flex: 1 1 0; min-width: 0; }
  /* The panel takes the slack, with its contents centred in it, so a short run gets
     a full-height box rather than a box floating above the fold of its column. */
  .beam-run__col--main .beam-run__cost { flex: 1 1 auto; justify-content: center; }
  /* The receipt does the same from the other side: with the hint gone from under the
     rows, a delayed run's cost panel can be the taller block, so the list grows to
     the column's height and its four rows share the slack equally. Either way the two
     blocks end on one line. */
  .beam-run__col--aside .beam-run__receipt { max-width: none; flex: 1 1 auto; }
  .beam-run__col--aside .beam-run__receipt-list { flex: 1 1 auto; }
  .beam-run__col--aside .beam-run__receipt-row { flex: 1 1 auto; }
  /* The receipt starts its own column, so it no longer needs the group step that
     separated it from the meters when everything was one stack. */
  .beam-run__stack--receipt .beam-run__col--aside .beam-run__receipt { margin-top: 0; }
  /* Same for the left caption: its stacked-layout step put "Months lost to delays"
     ~10px below "What got you here" on the raster, so the two captions missed the
     one line they are meant to share. */
  .beam-run__stack--receipt .beam-run__col--main .beam-run__months-label { margin-top: 0; }
}
.beam-run__stack--receipt .beam-run__months-label,
.beam-run__stack--receipt .beam-run__clock-line { margin-top: clamp(8px, 2%, ${P(20)}); }
.beam-run__stack--receipt .beam-run__receipt,
.beam-run__stack--receipt .beam-run__actions { margin-top: clamp(10px, 2.6%, ${P(26)}); }
/* The unit sits with its figure; the verdict line sits just under it. */
.beam-run__stack--receipt .beam-run__months { margin-top: 0; }
.beam-run__stack--receipt .beam-run__matched { margin-top: clamp(6px, 1.6%, ${P(16)}); }
/*
 * The title screen carries three things now — the offer, the buttons, one cap — so it
 * can breathe. (It held five: a three-line hook, a dare and Start.)
 */
.beam-run__stack--start { gap: clamp(14px, 3%, ${P(30)}); }
/* The offer sits with the hook it follows, not adrift between it and the cap. */
.beam-run__stack--start .beam-run__brief { margin-top: clamp(-4px, -0.4%, ${P(0)}); }
/* The row of key caps that used to be here is on the briefing cards now (owner call:
   the controls belong on the game screen, introduced as they become relevant), so the
   title screen is back to three things: the hook, the offer, one cap. */
.beam-run__stack--start .beam-run__actions { margin-top: clamp(8px, 2%, ${P(22)}); }
/*
 * TITLE SCREEN COMPOSITION - TYPE IN THE SKY, ART LEFT ALONE.
 *
 * The copy used to be centred on the frame under the same full-frame chequer wash
 * the end screens use. That put START on the skyline and dimmed the whole attract
 * scene to mud, so the one picture that tells the pitch (the hero, the rising
 * market, the lit ANSR tower) was the thing nobody could see. A title screen reads
 * top to bottom like a poster: the marquee and the hook in the open sky, the world
 * underneath at full strength.
 *
 * So the block is pinned to the top of the frame (the attract scene keeps its
 * skyline below it, see titleScene.ts) and the wash becomes a stepped scrim that
 * is only dark where the type is: hard bands rather than a smooth fade, which is
 * how an 8-bit machine would have faded a sky, and nothing at all over the ground
 * or the hero. The scanlines stay, lighter.
 */
.beam-run__overlay--start {
  justify-content: flex-start;
  padding-top: clamp(18px, 4.4%, ${P(56)});
  gap: clamp(12px, 2.6%, ${P(30)});
  background: linear-gradient(
    to bottom,
    rgba(0, 17, 23, 0.74) 0% 34%,
    rgba(0, 17, 23, 0.58) 34% 42%,
    rgba(0, 17, 23, 0.42) 42% 48%,
    rgba(0, 17, 23, 0.26) 48% 53%,
    rgba(0, 17, 23, 0.12) 53% 57%,
    rgba(0, 17, 23, 0) 57% 100%
  );
  backdrop-filter: none;
}
.beam-run__overlay--start::before { opacity: 0.6; }
/*
 * Phone held upright. The frame is a 16:9 strip across the middle of a tall stage
 * (the touch band, see the control band note above), so the sky trick has no room:
 * the copy would cover the only art on screen and leave the bands empty. Here the
 * stack stops being a box (display contents) and its three children join the
 * overlay grid: the marquee, hook and offer sit in the band ABOVE the frame, hugging
 * its top edge, and START sits in the band BELOW it, where a thumb already is. The
 * middle track is exactly the frame height (1 unit is 1% of the frame width, and in
 * portrait the frame is the full stage width), so the art shows through untouched.
 * The outer tracks never shrink below their content: if a band is too short for
 * the copy (an embed with a small band) the tracks grow and the overlay scrolls,
 * as every overlay does, rather than clipping the marquee off the top.
 */
.beam-run__start-head {
  display: flex; flex-direction: column; align-items: center;
  gap: clamp(12px, 2.6%, ${P(30)}); width: 100%;
}
/* The marquee is the name of the thing, the hook is what it says: a step more air
   between them than inside the copy, so the lockup reads as a masthead. */
.beam-run__start-head > .beam-run__brand { margin-bottom: clamp(2px, 0.9%, ${P(12)}); }
.beam-run__overlay--start > .beam-run__actions { margin-top: clamp(4px, 1%, ${P(12)}); }
@media (orientation: portrait) {
  .beam-run__stage--touch .beam-run__overlay--start.beam-run__overlay--visible {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows:
      minmax(min-content, 1fr) calc(56.25 * var(--beam-run-u)) minmax(min-content, 1fr);
    justify-items: center;
    gap: 0;
    padding: 0 clamp(16px, 5vw, ${P(28)});
    background: none;
  }
  .beam-run__stage--touch .beam-run__overlay--start::before { display: none; }
  .beam-run__stage--touch .beam-run__start-head {
    grid-row: 1; align-self: end;
    padding: clamp(16px, 5vw, ${P(28)}) 0 clamp(18px, 5.4vw, ${P(30)});
    gap: clamp(16px, 5vw, ${P(28)});
  }
  .beam-run__stage--touch .beam-run__overlay--start > .beam-run__actions {
    grid-row: 3; align-self: start;
    margin: 0; padding: clamp(20px, 6vw, ${P(34)}) 0 clamp(16px, 5vw, ${P(28)});
  }
  /* Thumb-sized, not a banner: full width it outweighed the whole masthead. */
  .beam-run__stage--touch .beam-run__overlay--start > .beam-run__actions .beam-run__btn {
    max-width: ${P(300)};
  }
}

/* Bitmap type ---------------------------------------------------------------
 * The overlays are set in the game's own 5×7 font, drawn as SVG rects (see
 * ui/PixelType.ts). Sizing comes from an inline frame-relative width, so the
 * glyphs scale with the play frame exactly like the canvas art does.
 */
.beam-run__pixels {
  display: block; max-width: 100%; height: auto;
  shape-rendering: crispEdges; image-rendering: pixelated;
}

/* ANSR lockup (generated sunburst + wordmark) ------------------------------- */
.beam-run__brand {
  display: flex; align-items: center; justify-content: center;
  flex-wrap: wrap; gap: clamp(10px, 1.6%, ${P(18)});
}
/* Wordmark and edition on one centred row, no divider (see BrandMark). Every item
   is line-height 1, so centring the boxes centres the caps. */
.beam-run__brand-text {
  display: flex; align-items: center; justify-content: center;
  flex-wrap: wrap; gap: clamp(9px, 1.5%, ${P(17)});
}
/* Height is left to the aspect ratio: the sunburst's own bounding box is
   175×181, so forcing a square would squash the real logo by 3%. */
.beam-run__brand-mark {
  width: clamp(34px, ${U(4.2)}, ${P(56)}); height: auto;
  flex: none; display: block;
}
/* The wordmark and the edition are bitmap art (see BrandMark LOCKUP_PX): each span
   is a flex box around its SVG so no inline line box adds space under the glyphs,
   and centring the boxes centres the caps. */
.beam-run__brand-word,
.beam-run__brand-title { display: flex; align-items: center; }
.beam-run__brand--compact .beam-run__brand-mark {
  width: clamp(22px, ${U(2.6)}, ${P(32)});
}

/* Titles are bitmap art (the visible glyphs live in the SVG); the element itself
   just centres it and carries the orange value hairline underneath. */
.beam-run__title {
  margin: 0; display: flex; flex-direction: column; align-items: center;
  filter: drop-shadow(0 0 10px rgba(0, 16, 22, 0.55));
}
/*
 * The orange value rule under a headline, as a loading-bar readout rather than a
 * moving hairline: a dim orange TRACK spanning the headline's own width (the
 * element shrink-wraps its bitmap art, so 84% is 84% of the text block) with one
 * chunky block travelling along it.
 *
 * The motion is stepped, not eased. A thin line gliding smoothly is a modern-web
 * gesture and looked out of place next to bitmap type; 14 discrete jumps of a
 * square 18px block is how an 8-bit machine would have animated it — the block
 * lands on a grid, never between positions. Both edges of the travel are the
 * track's own edges, so it stays inside the text above it by construction.
 */
.beam-run__title::after {
  content: ''; display: block; width: 84%; height: 6px;
  margin: clamp(10px, 1.8%, ${P(18)}) auto 0;
  background:
    linear-gradient(${BRAND.ORANGE}, ${BRAND.ORANGE}) 0 0 / 18px 100% no-repeat,
    rgba(255, 84, 0, 0.24);
  animation: beam-run-sweep 2.8s steps(14, end) infinite alternate;
}
@keyframes beam-run-sweep {
  from { background-position-x: 0%; }
  to { background-position-x: 100%; }
}
.beam-run__subtitle {
  font-size: clamp(13px, ${U(1.8)}, ${P(20)}); color: ${BRAND.LIGHT_GREY}; margin: 0;
  text-shadow: 0 2px 0 rgba(0, 16, 22, 0.85);
}
/* Hints are bitmap lines on the end screens (the only place they are used now). */
.beam-run__hint { margin: 0; display: flex; justify-content: center; }

/*
 * The stacked figure block. It was the title screen's three-line hook; that hook is
 * deleted (owner call), and the **404 page** is the only thing left using these two
 * rules — its "404" is set the same way, as a hidden sentence plus bitmap art.
 *
 * So they stay, and they belong to that page now. Deleting them with the hook broke a
 * surface nothing in the game imports: NotFoundPage builds its own DOM out of the shared
 * class names, and the 404 is a build-time page, so no test in the game's own suite
 * would have gone red. (No backticks in here — they end the template literal.)
 */
.beam-run__stake {
  margin: 0; width: 100%;
  display: flex; flex-direction: column; align-items: center;
  gap: clamp(8px, 1.6%, ${P(18)});
}
.beam-run__stake-figure { display: flex; justify-content: center; width: 100%; }
/* A restrained bloom: at 12px/0.5 the glow bled into the lines around it and softened
   glyphs whose whole point is that they are hard-edged. */
.beam-run__stake-figure .beam-run__pixels {
  filter: drop-shadow(0 0 7px rgba(255, 84, 0, 0.34));
}

/*
 * The title screen's control legend: the actual buttons, as 8-bit key caps.
 *
 * The caps get the same treatment as the NES action buttons below and the HUD plaques
 * above — solid fill, square, a 2px light/dark inner bevel and a hard dark rail — so
 * a cap on the title screen and a cap in the game are the same object. Keyboard
 * devices only: on touch the briefing cards carry no legend at all (owner call).
 *
 * It replaced a written sentence, twice: a legend was cut from this screen for reading
 * as a manual, and the sentence that came back rendered wider than the headline on a
 * phone. A cap is the size of its glyph, not of its explanation.
 */
/*
 * The legend is a grey 8-bit tile (owner call): the same square bevel-and-rail object
 * as the caps and the NES buttons, in a neutral grey so it reads as a separate plate on
 * the teal card rather than a second card. A faded CONTROLS caption over the caps.
 *
 * Symmetry: the tile shrink-wraps its contents and is centred on the card's axis; the
 * caption and the caps row are each centred on the tile's own axis. Top and bottom
 * padding are equal and so is the caption-to-caps step (one measure); left and right
 * are equal at 1.5x that, because a row of caps is wide and flat and the same inset on
 * every side left it looking pinched at the ends. min-width keeps the one-cap fire
 * tile from collapsing narrower than the level 0 tile reads as the same object at.
 */
.beam-run__keys {
  --beam-run-keys-pad: clamp(10px, ${U(1.3)}, ${P(18)});
  display: flex; flex-direction: column; align-items: center;
  gap: var(--beam-run-keys-pad);
  width: fit-content; max-width: 100%; min-width: min(100%, ${U(16)});
  box-sizing: border-box;
  padding: var(--beam-run-keys-pad) calc(var(--beam-run-keys-pad) * 1.5);
  background: #3A4044;
  box-shadow:
    inset 3px 3px 0 rgba(255, 255, 255, 0.14),
    inset -3px -3px 0 rgba(0, 0, 0, 0.38),
    0 0 0 3px ${RAIL};
}
.beam-run__keys-head { display: flex; justify-content: center; width: 100%; }
.beam-run__keys-head .beam-run__pixels { max-width: none; }
.beam-run__keys-row {
  display: flex; flex-wrap: wrap; justify-content: center; align-items: center;
  gap: clamp(10px, 1.8%, ${P(22)}) clamp(14px, ${U(2.2)}, ${P(30)});
}
/* In frame units, not %: a percentage gap here resolved against the shrink-wrapped group
   (~4px), and each cap's 2px outer rail ate all of it, so the two arrows fused into one
   block and the label touched its cap. */
.beam-run__key-group { display: flex; align-items: center; gap: clamp(8px, ${U(0.9)}, ${P(14)}); }
.beam-run__key {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: clamp(22px, ${U(2.8)}, ${P(36)}); min-height: clamp(22px, ${U(2.8)}, ${P(36)});
  /* Side padding in frame units: a percentage resolved against the shrink-wrapped
     group and sat on its 5px floor, so SPACE had half the air at its ends that it
     had above and below. */
  padding: clamp(3px, 0.5%, ${P(6)}) clamp(6px, ${U(0.6)}, ${P(9)});
  background: #00161D;
  box-shadow:
    inset 2px 2px 0 rgba(150, 205, 218, 0.22),
    inset -2px -2px 0 rgba(0, 0, 0, 0.45),
    0 0 0 2px ${RAIL};
}
/* Caps shrink-wrap their glyph, so the shared percentage cap has nothing to measure;
   the width is already bounded in frame units by PX_TYPE.key. */
.beam-run__key .beam-run__pixels { max-width: none; }


/* Closing figure: months lost to delays. */
.beam-run__months-label { display: flex; justify-content: center; }
.beam-run__months { display: flex; align-items: flex-end; gap: clamp(8px, 1.2%, ${P(14)}); }
/* Bitmap digits with an orange glow: an arcade readout, not a web number. */
.beam-run__months-value {
  display: inline-flex; align-items: flex-end;
  /* Same restraint as the stake figure: enough bloom to read as a lit readout,
     not enough to blur the pixel edges. */
  filter: drop-shadow(0 0 10px rgba(255, 84, 0, 0.38));
}
.beam-run__months-unit { display: flex; padding-bottom: 4px; }

/* The three closing comparison meters (__bars, __bar-*) and the two attributed
 * reference lines (__refs, __ref) were deleted with the statistics they drew: the
 * 11-month ANSR benchmark and the 24-month going-alone average (owner call). The
 * closing figure is the delay cost now, which is measured against zero.
 *
 * Every end-screen line below is bitmap artwork (see Overlays' PX_TYPE), so these
 * rules only place it: no font, size or colour left to set. __matched keeps its
 * name and now holds the verdict line under the figure. */
.beam-run__matched { margin: 0; display: flex; justify-content: center; }
.beam-run__clock-line { display: flex; align-items: center; gap: 10px; }
.beam-run__clock-label,
.beam-run__clock-strong { display: flex; }

/* Receipt — the four capabilities, as a read-only list (owner call: the rows are
   not buttons any more, and the "pick one" hint under them went with the clicks). */
.beam-run__receipt { width: 100%; max-width: ${P(640)}; display: flex; flex-direction: column; gap: 6px; }
/* The receipt's header centres on its column, mirroring the left column's caption:
   the rows fill the column, so the axis of the screen stays down the middle. */
.beam-run__receipt-title { display: flex; justify-content: center; }
.beam-run__receipt-list {
  display: flex; flex-direction: column; gap: 6px; width: 100%; margin: 0; padding: 0;
  list-style: none;
}
/*
 * One row layout everywhere: mark | product + saving | stage underneath.
 * Bitmap type is wider than the web type this replaced, and the four-column
 * desktop variant needed ~550px — more than the receipt gets in the two-column
 * win layout. Two lines also let the product and its saving sit together, which
 * is the pairing that matters.
 */
.beam-run__receipt-row {
  text-align: left; width: 100%; box-sizing: border-box;
  display: grid; grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center; align-content: center; gap: 4px 10px;
  min-height: 44px; padding: 8px 14px; border-radius: 0;
  background: rgba(0, 22, 29, 0.72);
  border: 2px solid rgba(150, 205, 218, 0.22);
  color: ${BRAND.LIGHT_GREY};
}
/* The mark is a drawn pixel glyph (hollow box / check), not a font character:
   \\25CB and \\2713 come from whatever typeface the host has, which is exactly
   the mismatch the rest of this screen just got rid of. */
.beam-run__receipt-mark { display: flex; align-items: center; grid-row: 1 / -1; }
.beam-run__receipt-product { display: flex; grid-column: 2; grid-row: 1; }
.beam-run__receipt-detail {
  display: flex; justify-content: flex-end; grid-column: 3; grid-row: 1;
}
.beam-run__receipt-stage { display: flex; grid-column: 2 / -1; grid-row: 2; }
/* Engaged rows carry the value accent; unreached rows stay dim. */
.beam-run__receipt-row--engaged {
  background: rgba(60, 20, 0, 0.6); border-color: rgba(255, 84, 0, 0.55);
  box-shadow: inset 4px 0 0 ${BRAND.ORANGE};
}
.beam-run__receipt-delays {
  margin-top: 2px; display: flex; flex-direction: column; align-items: center; gap: 4px;
}
/*
 * The closing screen's cost block: the figure, the verdict and the itemised delays as
 * ONE panel, in the receipt row's own fill and rail.
 *
 * Five centred lines of ragged type opposite four solid full-width rows is a screen
 * that leans right however the gaps are tuned — the two columns were the same width
 * and only one of them had mass in it. As a panel the left column has an edge to
 * match the right, and the two blocks sit under captions on the same line.
 */
.beam-run__cost {
  width: 100%; display: flex; flex-direction: column; align-items: center;
  gap: clamp(4px, 1%, ${P(10)});
  padding: clamp(10px, 2%, ${P(20)}) clamp(12px, 2.4%, ${P(24)});
  background: rgba(0, 22, 29, 0.72);
  border: 2px solid rgba(150, 205, 218, 0.22);
}
/* The breakdown is the figure's small print, so it is divided off inside the panel
   rather than floating under it. */
.beam-run__cost .beam-run__receipt-delays {
  width: 100%; margin-top: clamp(6px, 1.6%, ${P(16)}); padding-top: clamp(6px, 1.6%, ${P(16)});
  border-top: 2px solid rgba(150, 205, 218, 0.18);
}
/* A clean run writes nothing here (the verdict has already said it), and an empty
   box would still draw its divider. */
.beam-run__cost .beam-run__receipt-delays:empty { display: none; }

/*
 * A single centred line of instruction: the out-of-lives argument, and the retry
 * hint on a title card. Both are one sentence carrying one idea, so they get the
 * full measure and nothing else.
 *
 * The itemised delay ledger that used to live here is gone with the life-lost
 * screen — the same breakdown is on the closing receipt, where it is read rather
 * than skipped.
 */
.beam-run__advice {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  width: 100%; margin: 0;
}
/*
 * The out-of-lives screen: headline, caption, ONE PANEL, one route.
 *
 * It used to be four centred lines on one axis with the gaps doing all the work, and
 * gaps cannot fix a screen where nothing has mass (the same finding the win screen's
 * left column produced). The figure, the delay count and the argument are the same fact
 * at three levels of detail, so they are one block in the receipt row's own fill and
 * rail - which is also what puts an edge on this screen, so the composition is a shape
 * rather than a stack of ragged centred lines floating in an empty frame.
 *
 * The column is 440 rather than the 640 it was, and that is measured off the raster: the
 * widest thing inside the panel is the instruction at its 26-character measure, ~335px
 * on a 1280 frame, so a 560 rail left 110px of empty box either side of everything it
 * contains - a border drawn round nothing, which reads as a panel that has lost its
 * contents rather than as one holding them. A rail should hug what it encloses.
 */
.beam-run__stack--gameover { width: min(100%, ${P(440)}); gap: clamp(8px, 1.8%, ${P(18)}); }
.beam-run__stack--gameover .beam-run__months-label { margin-top: clamp(6px, 1.4%, ${P(14)}); }
.beam-run__stack--gameover .beam-run__months { margin-top: 0; }
.beam-run__stack--gameover .beam-run__matched { margin-top: clamp(2px, 0.6%, ${P(6)}); }
/* The argument is the panel's own footnote: divided off under the figure and its
   small print, the way the closing receipt divides off its breakdown. */
.beam-run__stack--gameover .beam-run__cost .beam-run__advice {
  margin-top: clamp(8px, 1.8%, ${P(18)}); padding-top: clamp(8px, 1.8%, ${P(18)});
  border-top: 2px solid rgba(150, 205, 218, 0.18);
}
.beam-run__stack--gameover .beam-run__actions { margin-top: clamp(8px, 2%, ${P(20)}); }
/* The retry hint sits with the stage name, not under it as a second heading. */
.beam-run__overlay--titlecard .beam-run__advice { margin-top: clamp(8px, 1.8%, ${P(18)}); }
/* The death card's powerup: the bare sunburst between the headline and the line that
   names it, turning at the stage pickup's own rate (one revolution per 3.3s). It takes
   the advice line's step above it, and the line sits close under it, so the mark and
   the sentence read as one unit. */
.beam-run__death-mark {
  display: block; flex: none; width: clamp(36px, ${U(5)}, ${P(64)}); height: auto;
  margin: clamp(8px, 1.8%, ${P(18)}) auto 0;
  animation: beam-run-mark-spin 3.33s linear infinite;
}
.beam-run__overlay--titlecard .beam-run__death-mark + .beam-run__advice { margin-top: 0; }
@keyframes beam-run-mark-spin { to { transform: rotate(360deg); } }
/*
 * THE TRANSITION CARDS (briefing, congratulations, death) ARE ONE PANEL NOW, AND THE
 * PANEL HUGS WHAT IT HOLDS.
 *
 * They were a column of type laid straight on the stage behind them, and the raster
 * showed why that read as clutter: every stage paints its own words (the lobby's HEAD
 * OFFICE sign, BUSINESS CASE, NOTARY, the WORKPLACE plaque), so at any wash light
 * enough to glimpse the room the card's type sat on top of the room's type, and the eye
 * had to sort which words were the card's. A solid 8-bit panel - the HUD plaque's own
 * fill, bevel and rail, one step heavier - gives the card a ground of its own, and the
 * stage becomes what it should be here: a dimmed picture around the edges.
 *
 * Width is fit-content so the rail hugs the widest line (a two-word credit over a
 * two-line hand-off is ~330px; a stage name ~520px) - the finding that took the
 * out-of-lives panel from 560 to 440 applies to every rail. The floor keeps a short
 * card from collapsing round one word. Every glyph inside is sized in frame units
 * (PixelType maxShare), so nothing in here measures the shrink-wrapped box.
 *
 * The rhythm is three steps, all in frame units so a phone gets the same proportions:
 * tight inside a group (eyebrow onto the name, the brief's own two lines), a normal step
 * between groups, and the largest one before the cap, which is the only control.
 */
.beam-run__stack--titlecard {
  width: fit-content; min-width: min(100%, ${U(30)}); max-width: min(100%, ${P(680)});
  gap: clamp(10px, ${U(1.6)}, ${P(22)});
  padding: clamp(16px, ${U(2.8)}, ${P(38)}) clamp(20px, ${U(4.2)}, ${P(56)});
  background: #00161D;
  box-shadow:
    inset 4px 4px 0 rgba(150, 205, 218, 0.16),
    inset -4px -4px 0 rgba(0, 0, 0, 0.45),
    0 0 0 4px ${RAIL};
}
/*
 * "LEVEL 3", over the stage name. An eyebrow, so it is tied to the heading under it
 * rather than floating as a line of its own - but by a visible gap: pulled in so far
 * that its baseline touched the name's cap height, it read as a smudge on the title.
 */
.beam-run__eyebrow {
  margin: 0 0 calc(-1 * clamp(4px, ${U(0.8)}, ${P(11)})); width: 100%;
  display: flex; flex-direction: column; align-items: center;
}
/*
 * The control legend on a briefing card (owner call: the controls copy moved off the
 * opening screen) sits OUTSIDE the teal card, as its own grey plate centred under it
 * (owner call: "move the controls out of the main blue box"). The card and the plate
 * are one centred group, which is the overlay's only child, so the pair is centred in
 * the frame together and the card stays centred when the plate is hidden.
 *
 * The gap is measured edge to edge: the card's 4px rail and the plate's 3px rail are
 * box-shadows and take no layout space, so the visible step is the gap minus 7px.
 *
 * **A card-wide divider was drawn round the legend once and cut in its own raster**: it
 * spanned the card while the row was ~300px on level 0 and ~100px on level 3. The plate
 * shrink-wraps the row instead, so its edge is always the legend's own edge.
 */
.beam-run__card-group {
  width: 100%;
  display: flex; flex-direction: column; align-items: center;
  gap: clamp(16px, ${U(2)}, ${P(28)});
}
/* One line of prose about the stage, in bitmap type like everything else here. */
.beam-run__brief {
  margin: 0; width: 100%;
  display: flex; flex-direction: column; align-items: center; gap: 5px;
}
/* The brief's two lines get real leading on a card: at 5px, 20px glyphs stacked into
   one block of type and the line had to be decoded rather than read. */
.beam-run__stack--titlecard .beam-run__brief { gap: clamp(5px, ${U(0.65)}, ${P(9)}); }
/* The button opens its own step: it is the last thing on the card and the only
   control on it, so it gets the biggest gap and nothing sits under it. */
.beam-run__stack--titlecard .beam-run__actions { margin-top: clamp(4px, ${U(0.9)}, ${P(12)}); }
/* The focus ring on a card's cap: white and unmissable, one step lighter than the
   global 6px/4px so on a panel it does not read as a second frame round the button.
   5px (was 3px, owner call: wider and bolder). */
.beam-run__stack--titlecard .beam-run__btn:focus-visible { outline-width: 5px; outline-offset: 3px; }

.beam-run__actions {
  display: flex; flex-wrap: wrap; justify-content: center; align-items: center;
  gap: clamp(12px, 1.8%, ${P(20)});
}
/*
 * NES-style buttons: square, chunky, with a 4px light/dark inner bevel and a
 * dark pixel rail around the outside. Pressing them moves the whole cap down
 * 3px and flips the bevel, which is the tactile bit that sells the era.
 */
.beam-run__btn {
  font: inherit; cursor: pointer;
  /* The cap centres its artwork: labels are bitmap SVG, not text (a proportional
     web font on an NES cap was the last web-native thing on these screens). */
  display: inline-flex; align-items: center; justify-content: center;
  padding: 13px 24px; min-height: 44px; border-radius: 0;
  border: 0; color: ${BRAND.WHITE};
  background: ${BRAND.LIGHT_TEAL};
  box-shadow:
    inset -4px -4px 0 rgba(0, 0, 0, 0.34),
    inset 4px 4px 0 rgba(255, 255, 255, 0.22),
    0 0 0 4px rgba(0, 16, 22, 0.88);
  transition: filter 0.15s ease, transform 0.08s ease;
}
.beam-run__btn:hover { filter: brightness(1.14); }
.beam-run__btn:active {
  transform: translateY(3px);
  box-shadow:
    inset 4px 4px 0 rgba(0, 0, 0, 0.34),
    inset -4px -4px 0 rgba(255, 255, 255, 0.14),
    0 0 0 4px rgba(0, 16, 22, 0.88);
}
/* The white ring round a focused cap (START, CONTINUE, TRY AGAIN: the cards focus their
   button, so it shows from the first frame). 6px rather than 4px (owner call: "a bit
   wider, a bit more bold"). */
.beam-run__btn:focus-visible { outline: 6px solid ${BRAND.WHITE}; outline-offset: 4px; }
/* The label is sized in frame units (see PixelType); a cap that shrink-wraps it
   has nothing for a percentage to measure against, and clicks belong to the cap. */
.beam-run__btn .beam-run__pixels { max-width: none; pointer-events: none; }
.beam-run__btn--primary { background: ${BRAND.ORANGE}; color: ${BRAND.DEEP_TEAL}; }
.beam-run__btn--ghost {
  background: rgba(0, 22, 29, 0.6); color: ${BRAND.LIGHT_GREY};
  box-shadow:
    inset -4px -4px 0 rgba(0, 0, 0, 0.3),
    inset 4px 4px 0 rgba(150, 205, 218, 0.18),
    0 0 0 4px rgba(0, 16, 22, 0.7);
}
/* The one button we most want pressed on the title screen. Its label already
   sets one step larger (see BUTTON_TYPE); this gives the cap room to match. */
.beam-run__stack--start .beam-run__btn--primary { padding: 15px 36px; }

/* Touch controls (safe-area aware, >=44px targets) ---------------------- */
/*
 * Three clusters: the move pad bottom-left, the act cluster bottom-right, pause
 * top-centre. Sizes are driven by two custom properties so the portrait, landscape,
 * larger-controls and one-tap variants each set a number rather than restating the
 * whole geometry:
 *
 *   --beam-run-pad       diameter of a secondary target (the two arrows, the tool)
 *   --beam-run-pad-jump  diameter of the primary target (jump)
 *   --beam-run-pad-lift  how far the tool button sits ABOVE jump's baseline
 *
 * The lift is the part worth keeping. Jump and the tool button used to be baseline
 * aligned in a row, which is a 76px circle touching a 104px circle at the same height:
 * two targets one thumb-width apart on the same arc, so the smaller one reads as a
 * mis-tap of the bigger one. Offsetting it up and to the left puts them on a diagonal —
 * the arrangement every console pad and every mobile platformer uses — and the thumb
 * rolls between two distinct positions instead of sliding along one.
 */
.beam-run__touch {
  position: absolute; inset: 0; pointer-events: none; display: none; z-index: 3;
  --beam-run-pad: 64px;
  --beam-run-pad-jump: 88px;
  --beam-run-pad-lift: 46px;
  --beam-run-pad-gap: 14px;
  --beam-run-pad-edge: 13px;
  --beam-run-pad-slop: 12px;
}
.beam-run__touch--visible { display: block; }
.beam-run__touch-zone {
  position: absolute; bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  display: flex; gap: var(--beam-run-pad-gap); align-items: flex-end;
}
.beam-run__touch-zone--move { left: calc(var(--beam-run-pad-edge) + env(safe-area-inset-left, 0px)); }
.beam-run__touch-zone--jump { right: calc(var(--beam-run-pad-edge) + env(safe-area-inset-right, 0px)); }
.beam-run__touch-btn {
  position: relative;
  pointer-events: auto; width: var(--beam-run-pad); height: var(--beam-run-pad);
  min-width: 44px; min-height: 44px; flex: none;
  border-radius: 50%; border: 2px solid rgba(230, 230, 230, 0.5);
  background: rgba(0, 84, 101, 0.5); color: ${BRAND.WHITE};
  font-size: 24px; line-height: 1; display: flex; align-items: center; justify-content: center;
  touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
}
/*
 * HIT SLOP. A thumb is not a mouse pointer and it does not land where its owner is
 * looking, so every target carries an invisible ring wider than the circle it draws. It
 * is a pseudo-element of the button, so the press still resolves to the button, and the
 * visible geometry is untouched: the alternative — growing the circles to the size of
 * the area they should catch — is what pushed the four-target row past the width of a
 * phone frame (see ui/touchGeometry.ts). It is also what "larger controls" mostly buys
 * on a narrow phone, because there the diameters have nowhere to go.
 */
.beam-run__touch-btn::before {
  content: ''; position: absolute; inset: calc(-1 * var(--beam-run-pad-slop)); border-radius: 50%;
}
.beam-run__touch-btn--jump {
  width: var(--beam-run-pad-jump); height: var(--beam-run-pad-jump); font-size: 30px;
  background: rgba(255, 84, 0, 0.55); border-color: rgba(255, 84, 0, 0.85); color: ${BRAND.DEEP_TEAL};
}
.beam-run__touch-btn--active { filter: brightness(1.3); }
/* The armed tool (cutter / water cannon / service hatch). Hidden until a badge arms
   it, cool-toned so the orange jump stays the primary target, and lifted onto the
   diagonal described above. */
.beam-run__touch-btn--shoot { display: none; margin-bottom: var(--beam-run-pad-lift); }
.beam-run__touch--armed .beam-run__touch-btn--shoot {
  display: flex; background: rgba(0, 84, 101, 0.75); border-color: rgba(207, 230, 236, 0.85);
}
/* A tool has just been armed and not used yet: the pad pulses a white ring (stepped,
   8-bit) until the first shot. Under reduced motion the ring holds still. */
.beam-run__touch--hint .beam-run__touch-btn--shoot {
  animation: beam-run-pad-hint 0.9s steps(1, end) infinite;
}
@keyframes beam-run-pad-hint {
  0% { box-shadow: 0 0 0 3px ${BRAND.WHITE}; }
  50% { box-shadow: 0 0 0 0 transparent; }
}
/*
 * PAUSE — in the top band, and the position is the whole point.
 *
 * It is the one control that must NOT be under a thumb: a pause triggered by a stray
 * thumb mid-jump costs a life, and pause is pressed a handful of times a run while jump is
 * pressed a hundred. The top band is the answer because on a touch device it is letterbox,
 * so this sits beside the readouts rather than on the game.
 *
 * NOT centred, though it reads as if it should be — the offset below is derived in
 * ui/touchGeometry.ts and the reason is there: the two HUD plaques are very different
 * widths, so the gap between them is nowhere near the middle of the frame, and a centred
 * button lands on the stage plaque. It is anchored past the lives readout's own ceiling
 * instead. Quiet by design: small, cool-toned, square-ish, so it cannot be mistaken for
 * the orange action target.
 */
.beam-run__touch-menu {
  position: absolute;
  top: calc(${PAUSE_BTN.top}px + env(safe-area-inset-top, 0px));
  right: calc(
    clamp(8px, 2.2%, ${P(22)}) + ${padCss(LIVES_PLAQUE)} + ${PAUSE_BTN.plaqueChrome}px +
      ${PAUSE_BTN.clear}px + env(safe-area-inset-right, 0px)
  );
  display: flex;
}
.beam-run__touch-btn--pause {
  width: ${PAUSE_BTN.size}px; height: ${PAUSE_BTN.size}px; border-radius: ${PAUSE_BTN.radius}px;
  font-size: 15px; letter-spacing: 2px;
  background: rgba(0, 22, 29, 0.66); border-color: rgba(230, 230, 230, 0.4);
}
/*
 * The narrowest frames have no horizontal gap between the two plaques to put a 44px
 * button in — 31px of slot on a 280px Galaxy Fold cover screen — so below the threshold it
 * drops under the plaque row instead. A container query, not a media query: the number
 * that matters is the width of the FRAME, which on a letterboxed stage is not the width of
 * the window. See PAUSE_BTN in ui/touchGeometry.ts for both figures.
 */
@container (max-width: ${PAUSE_BTN.narrowFrame - 1}px) {
  .beam-run__touch-menu { top: calc(${PAUSE_BTN.narrowTop}px + env(safe-area-inset-top, 0px)); }
}
/* One-tap keeps a single BACK button where the pad was, and hides only forward.
   Auto-run makes forward automatic, so the right arrow is redundant - but the left one
   is the only way to walk back, and the Compliance badge is deliberately reached by
   jumping the opposite way (docs/SCREENS.md 4.9). Hiding the whole pad made that
   pickup, and any future detour, unreachable for the audience this game is built for.
   No longer the default on touch (ASSIST.AUTO_RUN_DEFAULT_ON_TOUCH), still an option. */
.beam-run__touch--autorun .beam-run__touch-btn--right { display: none; }
.beam-run__touch--autorun .beam-run__touch-btn--jump { font-size: 34px; }
@media (orientation: landscape) {
  /* Sideways the band is whatever the height has left over after a full-width 16:9
     frame - on a tablet about 78px a side - so width is never the constraint here and
     these stay fixed pixels. Only the one-tap button, which IS the whole control scheme
     in that mode, grows. The base sizes at the top of this block are the landscape ones. */
  .beam-run__touch--large { --beam-run-pad: 76px; --beam-run-pad-jump: 100px; --beam-run-pad-slop: 16px; }
  .beam-run__touch--autorun { --beam-run-pad-jump: 104px; }
  .beam-run__touch--autorun.beam-run__touch--large { --beam-run-pad-jump: 124px; }
  /*
   * And sit as low as the safe area allows. A tablet is about 4:3, so a full-width 16:9
   * frame leaves ~78px of band a side and the cluster wants ~126 - the bottom corners of
   * the frame are overlaid by roughly a tenth of its height, which is the mobile-landscape
   * convention and is why the buttons are semi-transparent. The alternative is to shrink
   * the frame ~14% to buy a full band, which is an owner call (docs/OPEN.md), not one to
   * make in a stylesheet. Every 6px here is 6px less of the game covered.
   */
  .beam-run__touch-zone { bottom: calc(10px + env(safe-area-inset-bottom, 0px)); }
}
@media (orientation: portrait) {
  /*
   * Upright, the band under the play frame is the full 180px (see the stage rules), so
   * the controls live well below the action — but the frame is NARROW, and four targets
   * have to fit across it. Every number here is generated from ui/touchGeometry.ts,
   * which is where the arithmetic and the reason live, and touchAndAssist.test.ts
   * checks the row against every phone width from a 280px Galaxy Fold cover screen up.
   */
  .beam-run__touch {
    --beam-run-pad: ${padCss(PAD_PORTRAIT.pad)};
    --beam-run-pad-jump: ${padCss(PAD_PORTRAIT.jump)};
    --beam-run-pad-lift: ${padCss(PAD_PORTRAIT.lift)};
    --beam-run-pad-gap: ${padCss(PAD_PORTRAIT.gap)};
    --beam-run-pad-edge: ${padCss(PAD_PORTRAIT.edge)};
    --beam-run-pad-slop: ${PAD_PORTRAIT.slop}px;
  }
  .beam-run__touch--large {
    --beam-run-pad: ${padCss(PAD_PORTRAIT_LARGE.pad)};
    --beam-run-pad-jump: ${padCss(PAD_PORTRAIT_LARGE.jump)};
    --beam-run-pad-lift: ${padCss(PAD_PORTRAIT_LARGE.lift)};
    --beam-run-pad-slop: ${PAD_PORTRAIT_LARGE.slop}px;
  }
  /* One-tap: a single centred target reachable with either thumb. It is the only
     target, so the row arithmetic does not apply and it can take the tuned size. */
  .beam-run__touch--autorun .beam-run__touch-zone--jump {
    left: 0; right: 0; justify-content: center;
  }
  .beam-run__touch--autorun { --beam-run-pad-jump: 120px; }
  /* 128 and not the old 132: the band is 180px, a home indicator takes 34 and the zone
     inset 16, so 130 is all the height there is. */
  .beam-run__touch--autorun.beam-run__touch--large { --beam-run-pad-jump: 128px; }
}

/* Assist options dialog ------------------------------------------------- */
/* Web type here is deliberate: real form controls, real sentences. */
.beam-run__assist-intro {
  margin: 0; font-size: clamp(11px, ${U(1.4)}, ${P(16)}); color: ${BRAND.LIGHT_GREY};
  text-shadow: 0 2px 0 rgba(0, 16, 22, 0.85);
}
.beam-run__assist-list {
  display: flex; flex-direction: column; gap: 10px;
  text-align: left; width: 100%; max-width: ${P(520)};
}
.beam-run__assist-row {
  display: flex; align-items: center; gap: 12px; cursor: pointer;
  font-size: clamp(13px, ${U(1.8)}, ${P(17)}); color: ${BRAND.WHITE};
  min-height: 34px;
}
.beam-run__assist-check {
  width: 22px; height: 22px; min-width: 22px; accent-color: ${BRAND.ORANGE}; cursor: pointer;
}

/* Static fallback card (pre-lazy-mount / kill switch / boot failure) ----- */
.beam-run__fallback {
  --beam-run-u: 1vw;
  --beam-run-px: max(1px, calc(var(--beam-run-u) * 100 / 1280));
  position: relative; width: 100%; margin: 0 auto; box-sizing: border-box;
  max-width: min(
    var(--beam-run-max-width, 1280px),
    calc(var(--beam-run-max-height, 100vh) * 1280 / 720)
  );
  aspect-ratio: 1280 / 720; overflow: hidden; border-radius: ${RADII.md}px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(10px, 2.5%, ${P(20)}); text-align: center; padding: 6% 8%;
  font-family: ${TYPOGRAPHY.fontFamily}; color: ${BRAND.WHITE};
  background:
    radial-gradient(120% 90% at 80% 15%, rgba(0, 84, 101, 0.55), rgba(0, 36, 46, 0) 60%),
    ${BRAND.DEEP_TEAL};
}
.beam-run__fallback-title { font-size: clamp(22px, ${U(4)}, ${P(44)}); font-weight: 700; margin: 0; }
.beam-run__fallback-title::after {
  content: ''; display: block; width: 56px; height: 3px; margin: 10px auto 0;
  background: ${BRAND.ORANGE}; border-radius: 2px;
}
.beam-run__fallback-body { margin: 0; color: ${BRAND.LIGHT_GREY}; font-size: clamp(14px, ${U(2)}, ${P(20)}); }
@supports (height: 100dvh) {
  .beam-run__fallback {
    max-width: min(
      var(--beam-run-max-width, 1280px),
      calc(var(--beam-run-max-height, 100dvh) * 1280 / 720)
    );
  }
}

/* Phone-sized DOM UI ---------------------------------------------------------
 * On a narrow frame the container-relative type bottoms out at its floor, which
 * is small for arm's length on a phone, and the four-column receipt row cannot
 * fit 390px. Raise the floors against the *screen* (vw) here — in portrait the
 * frame is the full container width, so vw and frame-relative agree — stack the
 * buttons full-width for thumbs, and give the receipt two lines per row.
 */
@media (orientation: portrait), (max-width: 560px) {
  /* Both stacks already live in the band above the frame, so portrait needs no
     re-anchoring any more - only a tighter log so it cannot eat the play area. */
  .beam-run__hud-log-rows { max-height: 18vh; }

  .beam-run__subtitle { font-size: clamp(15px, 4.2vw, ${P(22)}); }

  /* Phones: the column takes the full width and the bar labels give up width to
     the meters. */
  .beam-run__stack { width: 100%; }
  .beam-run__brand-mark { width: clamp(32px, 9vw, ${P(46)}); }
  /* Bitmap labels need more of the row than web type did; the per-glyph floors
     in Overlays' PX_TYPE now handle the "too small on a phone" problem, so the
     font-size overrides that used to live here are gone. */
  .beam-run__bar {
    grid-template-columns: minmax(70px, 36%) minmax(0, 1fr) clamp(22px, 6vw, ${P(34)});
    gap: 8px;
  }
  .beam-run__actions { flex-direction: column; width: 100%; }
  .beam-run__btn { width: 100%; max-width: ${P(380)}; min-height: 48px; padding: 14px 20px; }
  .beam-run__assist-row { font-size: clamp(15px, 4vw, ${P(18)}); min-height: 44px; }
  .beam-run__receipt-row { grid-template-columns: 20px minmax(0, 1fr) auto; row-gap: 2px; }
}

.beam-run__sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
@media (prefers-reduced-motion: reduce) {
  .beam-run__overlay,
  .beam-run__overlay--scene { backdrop-filter: none; }
  .beam-run__overlay--visible { animation: none; }
  /* No sweep: the block parks in the middle of its track. */
  .beam-run__title::after { animation: none; background-position-x: 50%; }
  .beam-run__btn:active { transform: none; }
  .beam-run__hud-lives--spent { animation: none; }
  .beam-run__touch--hint .beam-run__touch-btn--shoot {
    animation: none; box-shadow: 0 0 0 3px ${BRAND.WHITE};
  }
  .beam-run__death-mark { animation: none; }
  .beam-run__btn { transition: none; }
}

/*
 * THE HIDDEN ATTRIBUTE HAS TO WIN, AND IN THIS STYLESHEET IT DID NOT. LAST RULE IN THE
 * FILE, DELIBERATELY.
 *
 * The hidden attribute is only a UA rule (display: none), so any author rule that sets
 * display on the same element beats it. Two of ours do - beam-run__brief and
 * beam-run__advice are both display: flex - and both are shown and hidden by assigning
 * to el.hidden. The symptom was the briefing card's retry line: painted on the card of
 * the stage that took the life, then hidden again on every later card, which did
 * nothing, so "take the ANSR powerup" sat on the introduction to every remaining screen
 * (owner note). Before the first death it was absent for the wrong reason - the element
 * had no content yet, not because it was hidden.
 *
 * Two things make it win, and it needs both. The important flag and the extra class in
 * the selector are what a browser reads. The POSITION is for everything else that
 * renders this sheet: jsdom's getComputedStyle cascades by source order alone, so with
 * the rule up at the top of the file the fix was correct per spec and invisible in
 * every test we could write. Anything added below this line that hides by attribute is
 * on its own.
 */
.beam-run [hidden] { display: none !important; }
`;

/**
 * The stage element's class list.
 *
 * Pure and exported for one reason: the shape of the play box is decided here, and
 * getting that decision wrong is what made the game look like a different game from one
 * machine to the next. It used to be made by `@media (orientation: portrait)`, which is
 * not a test for "this device has thumbs" — every desktop window taller than it was wide
 * matched it and got the phone box (a strip of game centred in two empty bands), while a
 * tablet in landscape, the one device that most needed a band, did not match and had its
 * controls drawn over the gameplay. `Game` passes the same `isTouchDevice()` result it
 * uses to decide whether the controls exist at all, so the box and its contents cannot
 * disagree — and because this is a function rather than a media query, there is a test.
 */
export function stageClassName(isTouch: boolean): string {
  return isTouch ? 'beam-run__stage beam-run__stage--touch' : 'beam-run__stage';
}

/** Inject the stylesheet into a root (idempotent). Returns the <style> node. */
export function injectStyles(target: Document | ShadowRoot = document): HTMLStyleElement {
  const doc = target instanceof Document ? target : target.ownerDocument!;
  const existing = (target as Document).getElementById?.(STYLE_ELEMENT_ID);
  if (existing) return existing as HTMLStyleElement;
  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = CSS;
  const head = target instanceof Document ? target.head : target;
  head.appendChild(style);
  return style;
}
