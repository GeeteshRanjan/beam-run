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
 * PORTRAIT / PHONE ------------------------------------------------------------
 * A 16:9 frame can only be as wide as its container, so in portrait it is
 * width-limited: on a 390px-wide phone the play frame is only ~219px tall.
 * Packing the HUD, the overlays and two thumb buttons into that strip is what
 * made the mobile view unusable — the controls covered the ground the player
 * was running on.
 *
 * So in portrait the stage deliberately stops being 16:9 and grows into the
 * free vertical space. The canvas still contain-fits (letterboxed in brand
 * teal, which the renderer already paints), and the bands above/below the frame
 * become the HUD + controls area: nothing overlaps gameplay and the buttons sit
 * where a thumb actually is.
 *
 *   --beam-run-portrait-band  extra height beyond the frame. Default 360px —
 *                             180px per band, which clears the safe area plus a
 *                             120px thumb button — so an embed stays bounded in
 *                             page flow; a standalone page passes 100dvh to go
 *                             full-screen.
 */
@media (orientation: portrait) {
  .beam-run__stage {
    aspect-ratio: auto;
    height: min(
      var(--beam-run-max-height, 100vh),
      calc(56.25vw + var(--beam-run-portrait-band, 360px))
    );
  }
}
@media (orientation: portrait) {
  @supports (height: 100dvh) {
    .beam-run__stage {
      height: min(
        var(--beam-run-max-height, 100dvh),
        calc(56.25vw + var(--beam-run-portrait-band, 360px))
      );
    }
  }
}
.beam-run__canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }

.beam-run__ui { position: absolute; inset: 0; pointer-events: none; }
.beam-run__ui * { box-sizing: border-box; }

/* HUD ------------------------------------------------------------------ */
/* Gutter = the inset every HUD readout keeps from the frame edge, plus the
   device safe area so a notch or home indicator never sits on a readout. */
.beam-run__hud {
  position: absolute; inset: 0; padding: clamp(8px, 2.2%, 22px);
  display: none; pointer-events: none;
}
.beam-run__hud--visible { display: block; }
/*
 * The two corner stacks. Plaques used to be positioned individually against the
 * four corners; the delay log has no fixed height, so anything sharing a corner
 * with it had to be offset by a hand-tuned pixel figure that was wrong again as
 * soon as another delay was logged. Columns solve it once, and they put every
 * readout in the top band, which is also what portrait wants (the bottom band
 * belongs to the thumb controls).
 */
.beam-run__hud-stack {
  position: absolute; top: calc(clamp(8px, 2.2%, 22px) + env(safe-area-inset-top, 0px));
  display: flex; flex-direction: column; gap: 8px;
  max-height: calc(100% - clamp(16px, 4.4%, 44px));
}
.beam-run__hud-stack--left {
  left: calc(clamp(8px, 2.2%, 22px) + env(safe-area-inset-left, 0px));
  align-items: flex-start;
}
.beam-run__hud-stack--right {
  right: calc(clamp(8px, 2.2%, 22px) + env(safe-area-inset-right, 0px));
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
  flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(6px, 1.6%, 14px); text-align: center;
  padding: 5% 7%; pointer-events: auto; overflow-y: auto;
  background: rgba(0, 30, 39, 0.92);
  backdrop-filter: blur(2px);
}
.beam-run__overlay--visible { display: flex; animation: beam-run-overlay-in 0.22s ease-out both; }
.beam-run__overlay--titlecard { background: rgba(0, 36, 46, 0.55); }
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
  gap: clamp(16px, 4%, 40px);
  padding: clamp(18px, 5.5%, 56px) clamp(16px, 7%, 72px);
}
/* End screens (win + the mid-run receipt): tighter frame, tighter lockup gap. */
.beam-run__overlay--receipt {
  padding: clamp(14px, 3.2%, 34px) clamp(14px, 4.5%, 48px);
  gap: clamp(10px, 2.2%, 22px);
}
/*
 * Title screen composition: the whole block (lockup + copy) is centred as one
 * unit — a top-pinned marquee read as a detached logo — but the lockup is the
 * title of the thing, so it sits at display size with a clear gap before the
 * copy underneath. The other big beat lives inside the copy (below the stake,
 * before the challenge line).
 */
.beam-run__overlay--start { gap: clamp(16px, 3.6%, 38px); }
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
  width: min(100%, 660px);
  display: flex; flex-direction: column; align-items: center;
  gap: clamp(12px, 2.6%, 26px);
  text-align: center;
}
/*
 * The end screens carry eight stacked elements (title, label, figure, meters,
 * two reference lines, the receipt, the buttons). On one uniform gap they read as
 * a pile, so the base rhythm here is tight and the space is spent *between
 * groups* instead: the figure block, the meters, the receipt and the actions each
 * open with a bigger step, while the pieces inside a group stay close.
 */
.beam-run__stack--receipt { width: min(100%, 720px); gap: clamp(5px, 1%, 10px); }
/* End-screen columns: stacked by default, side by side once the frame can carry
   it (see Overlays.columns — stacked, these screens are taller than a 16:9 frame
   and push the CTA below the fold). 900px is the smallest frame where the CTA cap
   still fits half the stack. */
.beam-run__cols,
.beam-run__col {
  display: flex; flex-direction: column; align-items: center;
  width: 100%; gap: clamp(5px, 1%, 10px);
}
@container (min-width: 900px) {
  .beam-run__stack--receipt { width: min(100%, 1060px); }
  /* Equal-width columns, tops aligned: with the buttons moved out from under the
     right column the two halves are within ~25px of each other, and aligning
     their opening captions on one line reads more even than centring each
     column's mass would. */
  .beam-run__cols { flex-direction: row; align-items: flex-start; gap: clamp(20px, 3%, 44px); }
  .beam-run__col { flex: 1 1 0; min-width: 0; }
  .beam-run__col--aside .beam-run__receipt { max-width: none; }
  /* The receipt starts its own column, so it no longer needs the group step that
     separated it from the meters when everything was one stack. */
  .beam-run__stack--receipt .beam-run__col--aside .beam-run__receipt { margin-top: 0; }
}
.beam-run__stack--receipt .beam-run__months-label,
.beam-run__stack--receipt .beam-run__clock-line { margin-top: clamp(8px, 2%, 20px); }
.beam-run__stack--receipt .beam-run__bars,
.beam-run__stack--receipt .beam-run__receipt,
.beam-run__stack--receipt .beam-run__actions { margin-top: clamp(10px, 2.6%, 26px); }
/* The unit sits with its figure, and the references sit with their meters. */
.beam-run__stack--receipt .beam-run__months { margin-top: 0; }
.beam-run__stack--receipt .beam-run__refs { margin-top: 2px; }
/* The title screen carries only three things, so it can breathe. */
.beam-run__stack--start { gap: clamp(14px, 3%, 30px); }
/* Extra air between "…to go live." and "THINK YOU CAN BEAT THAT?" — the beat
   between the problem and the challenge is the one pause that matters here.
   Stacked on the gap above, that's up to ~56px, which is the largest step on the
   screen without becoming a hole. */
.beam-run__stack--start .beam-run__title { margin-top: clamp(10px, 2.4%, 26px); }
/* The buttons belong to the challenge, so they sit a little closer to it. */
.beam-run__stack--start .beam-run__actions { margin-top: clamp(4px, 1%, 12px); }

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
  flex-wrap: wrap; gap: clamp(10px, 1.6%, 18px);
}
/* Wordmark, divider and edition on one centred row (see BrandMark). Every item
   is line-height 1, so centring the boxes centres the caps. */
.beam-run__brand-text {
  display: flex; align-items: center; justify-content: center;
  flex-wrap: wrap; gap: clamp(9px, 1.5%, 17px);
}
/* Height is left to the aspect ratio: the sunburst's own bounding box is
   175×181, so forcing a square would squash the real logo by 3%. */
.beam-run__brand-mark {
  width: clamp(34px, ${U(4.2)}, 56px); height: auto;
  flex: none; display: block;
}
/* The negative margins cancel the trailing letter-space that tracking leaves
   after the last glyph — without them the gap before the divider looks wider
   than the gap after it, and the whole lockup sits fractionally left of centre. */
.beam-run__brand-word {
  font-size: clamp(21px, ${U(3)}, 36px); font-weight: 700; color: ${BRAND.WHITE};
  letter-spacing: 0.2em; line-height: 1; margin-right: -0.2em;
}
/* The divider: a 2px bar the height of the wordmark's caps, centred on the same
   line as both texts. Its own font-size is the overlay's, not the wordmark's, so
   the height is set explicitly rather than in em. */
.beam-run__brand-rule {
  width: 2px; height: clamp(16px, ${U(2.2)}, 27px); flex: none;
  background: rgba(230, 230, 230, 0.4);
}
/*
 * The edition returns to a supporting size beside the wordmark. The line-height
 * of 1 is the part that matters: with the inherited line-height its line box was
 * taller than its glyphs, so centring the boxes did not centre the *text*, which
 * is what made it look off. With both lines at line-height 1 and the row centred,
 * the two cap heights share a centre line.
 */
.beam-run__brand-title {
  font-size: clamp(12px, ${U(1.7)}, 20px); color: ${BRAND.LIGHT_GREY};
  font-weight: 500; text-transform: uppercase; letter-spacing: 0.14em; line-height: 1;
  margin-right: -0.14em;
}
.beam-run__brand--compact .beam-run__brand-mark {
  width: clamp(22px, ${U(2.6)}, 32px);
}
.beam-run__brand--compact .beam-run__brand-word { font-size: clamp(13px, ${U(1.7)}, 19px); }
.beam-run__brand--compact .beam-run__brand-title { font-size: clamp(10px, ${U(1.2)}, 14px); }
.beam-run__brand--compact .beam-run__brand-rule { height: clamp(10px, ${U(1.3)}, 15px); }

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
  margin: clamp(10px, 1.8%, 18px) auto 0;
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
  font-size: clamp(13px, ${U(1.8)}, 20px); color: ${BRAND.LIGHT_GREY}; margin: 0;
  text-shadow: 0 2px 0 rgba(0, 16, 22, 0.85);
}
/* Hints are bitmap lines on the end screens (the only place they are used now). */
.beam-run__hint { margin: 0; display: flex; justify-content: center; }

/* Start screen stake — the 24-month hook, set entirely in the bitmap font:
   lead-in line, the figure at display size, then the tail. */
.beam-run__stake {
  margin: 0; width: 100%;
  display: flex; flex-direction: column; align-items: center;
  gap: clamp(8px, 1.6%, 18px);
}
.beam-run__stake-figure { display: flex; justify-content: center; width: 100%; }
/* A restrained bloom: at 12px/0.5 the glow bled into the lines above and below
   and softened glyphs whose whole point is that they are hard-edged. */
.beam-run__stake-figure .beam-run__pixels {
  filter: drop-shadow(0 0 7px rgba(255, 84, 0, 0.34));
}


/* Closing figure: months to market. */
.beam-run__months-label { display: flex; justify-content: center; }
.beam-run__months { display: flex; align-items: flex-end; gap: clamp(8px, 1.2%, 14px); }
/* Bitmap digits with an orange glow: an arcade readout, not a web number. */
.beam-run__months-value {
  display: inline-flex; align-items: flex-end;
  /* Same restraint as the stake figure: enough bloom to read as a lit readout,
     not enough to blur the pixel edges. */
  filter: drop-shadow(0 0 10px rgba(255, 84, 0, 0.38));
}
.beam-run__months-unit { display: flex; padding-bottom: 4px; }

/* Closing comparison bars ----------------------------------------------------
 * "14 months" means nothing to someone who isn't carrying the benchmarks in
 * their head. Seeing the run land between ANSR's 11 and the going-alone 24 is
 * the argument, at a glance. Segmented fills so the bars read as 8-bit meters,
 * and every bar carries its own number — never colour alone.
 */
.beam-run__bars {
  width: 100%; max-width: 560px; display: flex; flex-direction: column;
  gap: 7px; margin: 2px 0 4px;
}
/* Bitmap labels are wider than the web type they replaced, so the label column
   grew; the value column is a *fixed* width on purpose — each bar is its own
   grid, so a content-sized column would give the rows different track widths and
   the three meters would no longer be comparable. */
.beam-run__bar {
  display: grid;
  grid-template-columns: minmax(84px, 34%) minmax(0, 1fr) clamp(24px, ${U(2.6)}, 38px);
  align-items: center; gap: 10px;
}
.beam-run__bar-label { display: flex; justify-content: flex-end; }
.beam-run__bar-track {
  display: block; position: relative; height: clamp(12px, ${U(1.5)}, 18px);
  background: rgba(0, 20, 27, 0.85);
  box-shadow: inset 0 0 0 2px rgba(150, 205, 218, 0.18);
}
.beam-run__bar-fill {
  display: block; height: 100%; width: 0;
  background-image: repeating-linear-gradient(
    90deg,
    rgba(0, 18, 24, 0.28) 0 2px,
    rgba(0, 0, 0, 0) 2px 9px
  );
}
/* The player's own run gets the value accent; the references stay neutral. */
.beam-run__bar-fill--you { background-color: ${BRAND.ORANGE}; }
.beam-run__bar-fill--ansr { background-color: #5CE2F4; }
.beam-run__bar-fill--alone { background-color: #5D7A83; }
.beam-run__bar-value { display: flex; justify-content: flex-end; }

/* Every end-screen line below is bitmap artwork (see Overlays' PX_TYPE), so
   these rules only place it: no font, size or colour left to set. */
.beam-run__refs { display: flex; flex-wrap: wrap; gap: 6px 18px; justify-content: center; }
.beam-run__ref { display: flex; justify-content: center; }
.beam-run__matched { margin: 0; display: flex; justify-content: center; }
.beam-run__clock-line { display: flex; align-items: center; gap: 10px; }
.beam-run__clock-label,
.beam-run__clock-strong { display: flex; }

/* Receipt — the four capabilities, each its own route to the Navigator. */
.beam-run__receipt { width: 100%; max-width: 640px; display: flex; flex-direction: column; gap: 6px; }
/* The receipt's header, hint and footer centre on their column, mirroring the
   left column's caption: the rows fill the column, so the axis of the screen
   stays down the middle. */
.beam-run__receipt-title { display: flex; justify-content: center; }
.beam-run__receipt-list { display: flex; flex-direction: column; gap: 6px; width: 100%; }
/*
 * One row layout everywhere: mark | product + saving | stage underneath.
 * Bitmap type is wider than the web type this replaced, and the four-column
 * desktop variant needed ~550px — more than the receipt gets in the two-column
 * win layout. Two lines also let the product and its saving sit together, which
 * is the pairing that matters.
 */
.beam-run__receipt-row {
  font: inherit; cursor: pointer; text-align: left; width: 100%;
  display: grid; grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center; gap: 4px 10px;
  min-height: 44px; padding: 8px 14px; border-radius: 0;
  background: rgba(0, 22, 29, 0.72);
  border: 2px solid rgba(150, 205, 218, 0.22);
  color: ${BRAND.LIGHT_GREY};
  transition: filter 0.15s ease, border-color 0.15s ease;
}
.beam-run__receipt-row:hover { filter: brightness(1.18); border-color: rgba(255, 84, 0, 0.5); }
.beam-run__receipt-row:focus-visible { outline: 3px solid ${BRAND.WHITE}; outline-offset: 2px; }
/* The mark is a drawn pixel glyph (hollow box / check), not a font character:
   \\25CB and \\2713 come from whatever typeface the host has, which is exactly
   the mismatch the rest of this screen just got rid of. */
.beam-run__receipt-mark { display: flex; align-items: center; grid-row: 1 / -1; }
.beam-run__receipt-product { display: flex; grid-column: 2; grid-row: 1; }
.beam-run__receipt-detail {
  display: flex; justify-content: flex-end; grid-column: 3; grid-row: 1;
}
.beam-run__receipt-stage { display: flex; grid-column: 2 / -1; grid-row: 2; }
/* Engaged rows carry the value accent; unreached rows stay dim but clickable. */
.beam-run__receipt-row--engaged {
  background: rgba(60, 20, 0, 0.6); border-color: rgba(255, 84, 0, 0.55);
  box-shadow: inset 4px 0 0 ${BRAND.ORANGE};
}
.beam-run__receipt-delays {
  margin-top: 2px; display: flex; flex-direction: column; align-items: center; gap: 4px;
}

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
 * The out-of-lives screen: four elements, one axis. Every child is centred and
 * the steps between them grow with importance (headline → figure → instruction →
 * routes), which is what makes a four-element screen read as composed rather than
 * as a short list.
 */
.beam-run__stack--gameover { width: min(100%, 640px); gap: clamp(10px, 2.2%, 22px); }
.beam-run__stack--gameover .beam-run__clock-strong { justify-content: center; }
.beam-run__stack--gameover .beam-run__actions { margin-top: clamp(6px, 1.6%, 16px); }
/* The retry hint sits with the stage name, not under it as a second heading. */
.beam-run__overlay--titlecard .beam-run__advice { margin-top: clamp(8px, 1.8%, 18px); }

.beam-run__actions {
  display: flex; flex-wrap: wrap; justify-content: center; align-items: center;
  gap: clamp(12px, 1.8%, 20px);
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
.beam-run__btn:focus-visible { outline: 4px solid ${BRAND.WHITE}; outline-offset: 4px; }
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

/* Touch controls (safe-area aware, ≥44px targets) ---------------------- */
.beam-run__touch { position: absolute; inset: 0; pointer-events: none; display: none; z-index: 3; }
.beam-run__touch--visible { display: block; }
.beam-run__touch-zone {
  position: absolute; bottom: calc(18px + env(safe-area-inset-bottom, 0px));
  display: flex; gap: 16px; align-items: flex-end;
}
.beam-run__touch-zone--move { left: calc(14px + env(safe-area-inset-left, 0px)); }
.beam-run__touch-zone--jump { right: calc(14px + env(safe-area-inset-right, 0px)); }
.beam-run__touch-btn {
  pointer-events: auto; width: 64px; height: 64px; min-width: 44px; min-height: 44px;
  border-radius: 50%; border: 2px solid rgba(230, 230, 230, 0.5);
  background: rgba(0, 84, 101, 0.5); color: ${BRAND.WHITE};
  font-size: 24px; line-height: 1; display: flex; align-items: center; justify-content: center;
  touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
}
.beam-run__touch-btn--jump {
  width: 84px; height: 84px; font-size: 30px;
  background: rgba(255, 84, 0, 0.55); border-color: rgba(255, 84, 0, 0.85); color: ${BRAND.DEEP_TEAL};
}
.beam-run__touch-btn--active { filter: brightness(1.3); }
/* The Workplace cutter. Hidden until the badge arms it, and cool-toned so the
   orange act button stays the primary target. */
.beam-run__touch-btn--shoot { display: none; }
.beam-run__touch--armed .beam-run__touch-btn--shoot {
  display: flex; background: rgba(0, 84, 101, 0.75); border-color: rgba(207, 230, 236, 0.85);
}
@media (orientation: portrait) {
  /* Portrait puts a band under the play frame (see the stage rules), so the
     controls live below the action instead of on top of it — and can be bigger.
     Sizes are kept inside the 180px band: 18px offset + up to 120px button +
     the bottom safe area. */
  .beam-run__touch-btn { width: 76px; height: 76px; }
  .beam-run__touch-btn--jump { width: 104px; height: 104px; }
  /* One-tap: a single centred target reachable with either thumb. */
  .beam-run__touch--autorun .beam-run__touch-zone--jump {
    left: 0; right: 0; justify-content: center;
  }
  .beam-run__touch--autorun .beam-run__touch-btn--jump { width: 120px; height: 120px; }
  .beam-run__touch--autorun.beam-run__touch--large .beam-run__touch-btn--jump {
    width: 132px; height: 132px;
  }
}
.beam-run__touch--large .beam-run__touch-btn { width: 84px; height: 84px; }
.beam-run__touch--large .beam-run__touch-btn--jump { width: 108px; height: 108px; }
/* One-tap mode: the move pad is hidden and the whole lower area is the act button. */
.beam-run__touch--autorun .beam-run__touch-zone--move { display: none; }
.beam-run__touch--autorun .beam-run__touch-btn--jump { width: 116px; height: 116px; font-size: 34px; }
.beam-run__touch--autorun.beam-run__touch--large .beam-run__touch-btn--jump { width: 140px; height: 140px; }

/* Assist options dialog ------------------------------------------------- */
/* Web type here is deliberate: real form controls, real sentences. */
.beam-run__assist-intro {
  margin: 0; font-size: clamp(11px, ${U(1.4)}, 16px); color: ${BRAND.LIGHT_GREY};
  text-shadow: 0 2px 0 rgba(0, 16, 22, 0.85);
}
.beam-run__assist-list {
  display: flex; flex-direction: column; gap: 10px;
  text-align: left; width: 100%; max-width: 520px;
}
.beam-run__assist-row {
  display: flex; align-items: center; gap: 12px; cursor: pointer;
  font-size: clamp(13px, ${U(1.8)}, 17px); color: ${BRAND.WHITE};
  min-height: 34px;
}
.beam-run__assist-check {
  width: 22px; height: 22px; min-width: 22px; accent-color: ${BRAND.ORANGE}; cursor: pointer;
}

/* Static fallback card (pre-lazy-mount / kill switch / boot failure) ----- */
.beam-run__fallback {
  --beam-run-u: 1vw;
  position: relative; width: 100%; margin: 0 auto; box-sizing: border-box;
  max-width: min(
    var(--beam-run-max-width, 1280px),
    calc(var(--beam-run-max-height, 100vh) * 1280 / 720)
  );
  aspect-ratio: 1280 / 720; overflow: hidden; border-radius: ${RADII.md}px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(10px, 2.5%, 20px); text-align: center; padding: 6% 8%;
  font-family: ${TYPOGRAPHY.fontFamily}; color: ${BRAND.WHITE};
  background:
    radial-gradient(120% 90% at 80% 15%, rgba(0, 84, 101, 0.55), rgba(0, 36, 46, 0) 60%),
    ${BRAND.DEEP_TEAL};
}
.beam-run__fallback-title { font-size: clamp(22px, ${U(4)}, 44px); font-weight: 700; margin: 0; }
.beam-run__fallback-title::after {
  content: ''; display: block; width: 56px; height: 3px; margin: 10px auto 0;
  background: ${BRAND.ORANGE}; border-radius: 2px;
}
.beam-run__fallback-body { margin: 0; color: ${BRAND.LIGHT_GREY}; font-size: clamp(14px, ${U(2)}, 20px); }
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

  .beam-run__subtitle { font-size: clamp(15px, 4.2vw, 22px); }

  /* Phones: the column takes the full width and the bar labels give up width to
     the meters. */
  .beam-run__stack { width: 100%; }
  .beam-run__brand-mark { width: clamp(32px, 9vw, 46px); }
  .beam-run__brand-word { font-size: clamp(19px, 5.6vw, 28px); }
  .beam-run__brand-title { font-size: clamp(11px, 3.2vw, 16px); }
  .beam-run__brand-rule { height: clamp(14px, 4vw, 21px); }
  /* Bitmap labels need more of the row than web type did; the per-glyph floors
     in Overlays' PX_TYPE now handle the "too small on a phone" problem, so the
     font-size overrides that used to live here are gone. */
  .beam-run__bar {
    grid-template-columns: minmax(70px, 36%) minmax(0, 1fr) clamp(22px, 6vw, 34px);
    gap: 8px;
  }
  .beam-run__actions { flex-direction: column; width: 100%; }
  .beam-run__btn { width: 100%; max-width: 380px; min-height: 48px; padding: 14px 20px; }
  .beam-run__assist-row { font-size: clamp(15px, 4vw, 18px); min-height: 44px; }
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
  .beam-run__receipt-row { transition: none; }
  .beam-run__btn { transition: none; }
}
`;

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
