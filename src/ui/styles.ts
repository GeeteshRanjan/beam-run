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
/*
 * The briefing card. It used to be a 1.2s caption over the stage, so a light 55%
 * wash was right; it is a reading surface now (a stage name, a line about what is
 * in the stage, and a button that starts it), and it waits. Denser wash so the
 * type carries, but still short of the scene overlays' 92% — the screen behind it
 * is the thing being described, and a glimpse of it is part of the briefing.
 */
.beam-run__overlay--titlecard { background: rgba(0, 33, 42, 0.86); }
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
 * before the tagline).
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
  /* Equal-width columns, tops aligned and now STRETCHED to one height: the two
     captions sit on one line and the two blocks under them share both edges, which
     is what makes the screen symmetrical on a clean run — where the cost side is
     three lines against the receipt's four rows. Centring each column's mass
     instead leaves the captions on different lines, which reads as a mistake. */
  .beam-run__cols { flex-direction: row; align-items: stretch; gap: clamp(20px, 3%, 44px); }
  .beam-run__col { flex: 1 1 0; min-width: 0; }
  /* The panel takes the slack, with its contents centred in it, so a short run gets
     a full-height box rather than a box floating above the fold of its column. */
  .beam-run__col--main .beam-run__cost { flex: 1 1 auto; justify-content: center; }
  .beam-run__col--aside .beam-run__receipt { max-width: none; }
  /* The receipt starts its own column, so it no longer needs the group step that
     separated it from the meters when everything was one stack. */
  .beam-run__stack--receipt .beam-run__col--aside .beam-run__receipt { margin-top: 0; }
}
.beam-run__stack--receipt .beam-run__months-label,
.beam-run__stack--receipt .beam-run__clock-line { margin-top: clamp(8px, 2%, 20px); }
.beam-run__stack--receipt .beam-run__receipt,
.beam-run__stack--receipt .beam-run__actions { margin-top: clamp(10px, 2.6%, 26px); }
/* The unit sits with its figure; the verdict line sits just under it. */
.beam-run__stack--receipt .beam-run__months { margin-top: 0; }
.beam-run__stack--receipt .beam-run__matched { margin-top: clamp(6px, 1.6%, 16px); }
/*
 * The title screen carries three things now — the offer, the buttons, one cap — so it
 * can breathe. (It held five: a three-line hook, a dare and Start.)
 */
.beam-run__stack--start { gap: clamp(14px, 3%, 30px); }
/* The legend and the cap are one group: how you play, then play. The step above the
   legend is the screen's one real pause, under the headline and its value rule. */
.beam-run__stack--start .beam-run__keys { margin-top: clamp(8px, 2%, 22px); }
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
  gap: clamp(8px, 1.6%, 18px);
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
 * a cap on the title screen and a cap in the game are the same object. On touch they
 * are round, because the pads drawn over the game are.
 *
 * It replaced a written sentence, twice: a legend was cut from this screen for reading
 * as a manual, and the sentence that came back rendered wider than the headline on a
 * phone. A cap is the size of its glyph, not of its explanation.
 */
.beam-run__keys {
  display: flex; flex-wrap: wrap; justify-content: center; align-items: center;
  gap: clamp(10px, 1.8%, 22px);
}
.beam-run__key-group { display: flex; align-items: center; gap: clamp(4px, 0.7%, 8px); }
.beam-run__key {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: clamp(22px, ${U(2.8)}, 36px); min-height: clamp(22px, ${U(2.8)}, 36px);
  padding: clamp(3px, 0.5%, 6px) clamp(5px, 0.8%, 9px);
  background: #00161D;
  box-shadow:
    inset 2px 2px 0 rgba(150, 205, 218, 0.22),
    inset -2px -2px 0 rgba(0, 0, 0, 0.45),
    0 0 0 2px ${RAIL};
}
/* The on-screen pads are round, so their legend is too. */
.beam-run__key--pad { border-radius: 50%; }
/* The act pad is smaller than jump, on the game and here: the two are both discs, so
   size is what separates them (and drawing the act button as an arrow instead put the
   same glyph in the row twice, once meaning move and once meaning fire). */
.beam-run__key--small {
  min-width: clamp(17px, ${U(2.1)}, 27px); min-height: clamp(17px, ${U(2.1)}, 27px);
  padding: clamp(2px, 0.4%, 5px);
}
.beam-run__key--small .beam-run__pixels { width: clamp(8px, ${U(0.9)}, 13px); }
/* Caps shrink-wrap their glyph, so the shared percentage cap has nothing to measure;
   the width is already bounded in frame units by PX_TYPE.key. */
.beam-run__key .beam-run__pixels { max-width: none; }


/* Closing figure: months lost to delays. */
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
  gap: clamp(4px, 1%, 10px);
  padding: clamp(10px, 2%, 20px) clamp(12px, 2.4%, 24px);
  background: rgba(0, 22, 29, 0.72);
  border: 2px solid rgba(150, 205, 218, 0.22);
}
/* The breakdown is the figure's small print, so it is divided off inside the panel
   rather than floating under it. */
.beam-run__cost .beam-run__receipt-delays {
  width: 100%; margin-top: clamp(6px, 1.6%, 16px); padding-top: clamp(6px, 1.6%, 16px);
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
.beam-run__stack--gameover { width: min(100%, 440px); gap: clamp(8px, 1.8%, 18px); }
.beam-run__stack--gameover .beam-run__months-label { margin-top: clamp(6px, 1.4%, 14px); }
.beam-run__stack--gameover .beam-run__months { margin-top: 0; }
.beam-run__stack--gameover .beam-run__matched { margin-top: clamp(2px, 0.6%, 6px); }
/* The argument is the panel's own footnote: divided off under the figure and its
   small print, the way the closing receipt divides off its breakdown. */
.beam-run__stack--gameover .beam-run__cost .beam-run__advice {
  margin-top: clamp(8px, 1.8%, 18px); padding-top: clamp(8px, 1.8%, 18px);
  border-top: 2px solid rgba(150, 205, 218, 0.18);
}
.beam-run__stack--gameover .beam-run__actions { margin-top: clamp(8px, 2%, 20px); }
/* The retry hint sits with the stage name, not under it as a second heading. */
.beam-run__overlay--titlecard .beam-run__advice { margin-top: clamp(8px, 1.8%, 18px); }
/*
 * The briefing card: stage name, the line about the stage, the retry hint when
 * there is one, then the button and its keyboard prompt. A narrower measure than
 * the end screens because the brief is one sentence — at 660px it set as a single
 * wide line and read as a caption rather than as a paragraph to stop for.
 */
.beam-run__stack--titlecard { width: min(100%, 560px); gap: clamp(10px, 2.2%, 22px); }
/* One line of prose about the stage, in bitmap type like everything else here. */
.beam-run__brief {
  margin: 0; width: 100%;
  display: flex; flex-direction: column; align-items: center; gap: 5px;
}
/* The button opens its own step: it is the last thing on the card and the only
   control on it, so it gets the biggest gap and nothing sits under it. */
.beam-run__stack--titlecard .beam-run__actions { margin-top: clamp(6px, 1.6%, 16px); }

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
/* One-tap keeps a single BACK button where the pad was, and hides only forward.
   Auto-run makes forward automatic, so the right arrow is redundant - but the left one
   is the only way to walk back, and the Compliance badge is deliberately reached by
   jumping the opposite way (docs/SCREENS.md 4.9). Hiding the whole pad made that
   pickup, and any future detour, unreachable for the audience this game is built for. */
.beam-run__touch--autorun .beam-run__touch-btn--right { display: none; }
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
