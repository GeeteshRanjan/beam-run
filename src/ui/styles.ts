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

/** Shared panel treatment behind HUD readouts (the legibility fix). */
const PANEL = `
  background: rgba(0, 22, 29, 0.82);
  border: 1px solid rgba(150, 205, 218, 0.28);
  border-radius: 0;
  box-shadow: 0 3px 0 rgba(0, 14, 20, 0.55);
  padding: 6px 12px;
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
.beam-run__hud-row {
  position: absolute; top: calc(clamp(8px, 2.2%, 22px) + env(safe-area-inset-top, 0px));
  display: flex; align-items: center; gap: 8px;
  font-size: clamp(11px, ${U(1.5)}, 17px); font-weight: 600;
  ${PANEL}
}
.beam-run__hud-level {
  left: calc(clamp(8px, 2.2%, 22px) + env(safe-area-inset-left, 0px));
  letter-spacing: 0.5px;
}

/* The journey clock: the loudest readout on screen. */
.beam-run__hud-clock {
  right: calc(clamp(8px, 2.2%, 22px) + env(safe-area-inset-right, 0px));
  gap: 10px; align-items: baseline;
  border-color: rgba(255, 84, 0, 0.45);
}
.beam-run__hud-clock-label {
  font-size: 0.72em; text-transform: uppercase; letter-spacing: 1.2px;
  color: ${BRAND.LIGHT_GREY};
}
.beam-run__hud-clock-value {
  font-family: ${TYPOGRAPHY.monoFamily};
  font-size: 1.7em; font-weight: 700; color: ${BRAND.WHITE};
  font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1;
  line-height: 1;
}
.beam-run__hud-clock-unit { font-size: 0.78em; color: ${BRAND.LIGHT_GREY}; }
.beam-run__hud-clock--bump { animation: beam-run-bump 0.42s ease-out both; }
@keyframes beam-run-bump {
  0% { transform: scale(1); border-color: rgba(255, 84, 0, 0.45); }
  35% { transform: scale(1.08); border-color: rgba(255, 255, 255, 0.9); }
  100% { transform: scale(1); border-color: rgba(255, 84, 0, 0.45); }
}

.beam-run__hud-wins {
  left: calc(clamp(8px, 2.2%, 22px) + env(safe-area-inset-left, 0px));
  top: auto; bottom: calc(clamp(8px, 2.2%, 22px) + env(safe-area-inset-bottom, 0px));
  color: ${BRAND.LIGHT_GREY};
}
.beam-run__hud-wins-total { opacity: 0.62; font-size: 0.84em; }

/* Engaged ANSR capability — persistent chip, no countdown (help doesn't lapse). */
.beam-run__hud-power {
  right: calc(clamp(8px, 2.2%, 22px) + env(safe-area-inset-right, 0px));
  top: auto; bottom: calc(clamp(8px, 2.2%, 22px) + env(safe-area-inset-bottom, 0px));
  display: none; flex-direction: column; align-items: flex-end; gap: 2px;
  background: rgba(60, 20, 0, 0.82); border-color: rgba(255, 84, 0, 0.6);
}
.beam-run__hud-power--visible { display: flex; }
.beam-run__hud-power-product {
  color: ${BRAND.ORANGE}; font-size: 0.95em; font-weight: 700; letter-spacing: 0.4px;
}
.beam-run__hud-power-name { color: ${BRAND.WHITE}; font-size: 0.78em; font-weight: 500; }

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
/* Wordmark + edition on a shared baseline (see BrandMark): centring the two
   against each other left the smaller edition text sitting low. The mark stays
   optically centred on the row. */
.beam-run__brand-text {
  display: flex; align-items: baseline; justify-content: center;
  flex-wrap: wrap; gap: clamp(8px, 1.4%, 16px);
}
/* Height is left to the aspect ratio: the sunburst's own bounding box is
   175×181, so forcing a square would squash the real logo by 3%. */
.beam-run__brand-mark {
  width: clamp(34px, ${U(4.2)}, 56px); height: auto;
  flex: none; display: block;
}
.beam-run__brand-word {
  font-size: clamp(21px, ${U(3)}, 36px); font-weight: 700; color: ${BRAND.WHITE};
  letter-spacing: 0.2em; line-height: 1;
}
/* Hangs from the shared baseline, sized to the wordmark's cap height (its own
   font-size is the overlay's, not the wordmark's, so it is set explicitly). */
.beam-run__brand-rule {
  width: 2px; height: clamp(15px, ${U(2.1)}, 26px);
  background: rgba(230, 230, 230, 0.34);
}
/* Set at the SAME size as the wordmark: at a smaller size it never sat right
   beside it, whatever it was aligned to. Weight and colour carry the hierarchy
   instead — the edition is lighter and muted, the wordmark bold and white. */
.beam-run__brand-title {
  font-size: clamp(21px, ${U(3)}, 36px); color: ${BRAND.LIGHT_GREY};
  font-weight: 400; text-transform: uppercase; letter-spacing: 0.12em; line-height: 1;
}
.beam-run__brand--compact .beam-run__brand-mark {
  width: clamp(22px, ${U(2.6)}, 32px);
}
.beam-run__brand--compact .beam-run__brand-word,
.beam-run__brand--compact .beam-run__brand-title { font-size: clamp(13px, ${U(1.7)}, 19px); }
.beam-run__brand--compact .beam-run__brand-rule { height: clamp(10px, ${U(1.2)}, 14px); }

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
.beam-run__hint {
  font-size: clamp(11px, ${U(1.4)}, 16px); color: ${BRAND.LIGHT_GREY}; margin: 0;
  text-shadow: 0 2px 0 rgba(0, 16, 22, 0.85);
}

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
.beam-run__months-label {
  font-size: clamp(11px, ${U(1.4)}, 16px); color: ${BRAND.LIGHT_GREY};
  letter-spacing: 1.2px; text-transform: uppercase;
}
.beam-run__months { display: flex; align-items: flex-end; gap: clamp(8px, 1.2%, 14px); }
/* Bitmap digits with an orange glow: an arcade readout, not a web number. */
.beam-run__months-value {
  display: inline-flex; align-items: flex-end;
  /* Same restraint as the stake figure: enough bloom to read as a lit readout,
     not enough to blur the pixel edges. */
  filter: drop-shadow(0 0 10px rgba(255, 84, 0, 0.38));
}
.beam-run__months-unit {
  font-size: clamp(14px, ${U(2)}, 22px); color: ${BRAND.LIGHT_GREY};
  text-transform: uppercase; letter-spacing: 0.12em; padding-bottom: 0.25em;
  text-shadow: 0 2px 0 rgba(0, 16, 22, 0.85);
}

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
.beam-run__bar {
  display: grid; grid-template-columns: minmax(70px, 27%) minmax(0, 1fr) 3ch;
  align-items: center; gap: 10px;
}
.beam-run__bar-label {
  font-size: clamp(9px, ${U(1.2)}, 13px); color: ${BRAND.LIGHT_GREY};
  text-transform: uppercase; letter-spacing: 0.1em; text-align: right;
}
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
.beam-run__bar-value {
  font-family: ${TYPOGRAPHY.monoFamily}; font-weight: 700;
  font-size: clamp(11px, ${U(1.4)}, 16px); color: ${BRAND.WHITE};
  font-variant-numeric: tabular-nums; text-align: right;
}

.beam-run__refs { display: flex; flex-wrap: wrap; gap: 6px 18px; justify-content: center; }
.beam-run__ref { font-size: clamp(11px, ${U(1.4)}, 16px); color: ${BRAND.LIGHT_GREY}; }
.beam-run__matched {
  margin: 0; font-size: clamp(12px, ${U(1.6)}, 18px); font-weight: 600; color: ${BRAND.ORANGE};
}
.beam-run__clock-line { display: flex; align-items: baseline; gap: 10px; }
.beam-run__clock-label {
  font-size: clamp(11px, ${U(1.4)}, 16px); color: ${BRAND.LIGHT_GREY};
  text-transform: uppercase; letter-spacing: 1.2px;
}
.beam-run__clock-strong {
  font-family: ${TYPOGRAPHY.monoFamily}; font-weight: 700; color: ${BRAND.WHITE};
  font-size: clamp(18px, ${U(2.6)}, 30px); font-variant-numeric: tabular-nums;
}

/* Receipt — the four capabilities, each its own route to the Navigator. */
.beam-run__receipt { width: 100%; max-width: 640px; display: flex; flex-direction: column; gap: 6px; }
.beam-run__receipt-title {
  font-size: clamp(11px, ${U(1.4)}, 16px); color: ${BRAND.LIGHT_GREY};
  text-transform: uppercase; letter-spacing: 1.2px;
}
.beam-run__receipt-list { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.beam-run__receipt-row {
  font: inherit; cursor: pointer; text-align: left; width: 100%;
  display: grid; grid-template-columns: 22px minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: center; gap: 10px;
  min-height: 44px; padding: 8px 14px; border-radius: 0;
  background: rgba(0, 22, 29, 0.72);
  border: 2px solid rgba(150, 205, 218, 0.22);
  color: ${BRAND.LIGHT_GREY};
  transition: filter 0.15s ease, border-color 0.15s ease;
}
.beam-run__receipt-row:hover { filter: brightness(1.18); border-color: rgba(255, 84, 0, 0.5); }
.beam-run__receipt-row:focus-visible { outline: 3px solid ${BRAND.WHITE}; outline-offset: 2px; }
.beam-run__receipt-mark::before { content: '\\25CB'; opacity: 0.5; }
.beam-run__receipt-product { font-weight: 700; color: ${BRAND.WHITE}; font-size: clamp(12px, ${U(1.6)}, 17px); }
.beam-run__receipt-stage { font-size: clamp(11px, ${U(1.4)}, 15px); }
.beam-run__receipt-detail {
  font-size: clamp(10px, ${U(1.3)}, 14px); text-align: right; white-space: nowrap; opacity: 0.75;
}
/* Engaged rows carry the value accent; unreached rows stay dim but clickable. */
.beam-run__receipt-row--engaged {
  background: rgba(60, 20, 0, 0.6); border-color: rgba(255, 84, 0, 0.55);
  box-shadow: inset 4px 0 0 ${BRAND.ORANGE};
}
.beam-run__receipt-row--engaged .beam-run__receipt-mark::before {
  content: '\\2713'; color: ${BRAND.ORANGE}; opacity: 1; font-weight: 700;
}
.beam-run__receipt-row--engaged .beam-run__receipt-detail { color: ${BRAND.ORANGE}; opacity: 1; }
.beam-run__receipt-wins { margin-top: 2px; }

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
  font: inherit; font-weight: 700; cursor: pointer;
  padding: 13px 24px; min-height: 44px; border-radius: 0;
  border: 0; color: ${BRAND.WHITE};
  text-transform: uppercase; letter-spacing: 0.08em;
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
.beam-run__btn--primary { background: ${BRAND.ORANGE}; color: ${BRAND.DEEP_TEAL}; }
.beam-run__btn--ghost {
  background: rgba(0, 22, 29, 0.6); color: ${BRAND.LIGHT_GREY};
  box-shadow:
    inset -4px -4px 0 rgba(0, 0, 0, 0.3),
    inset 4px 4px 0 rgba(150, 205, 218, 0.18),
    0 0 0 4px rgba(0, 16, 22, 0.7);
}
/* The one button we most want pressed on the title screen. */
.beam-run__stack--start .beam-run__btn--primary {
  font-size: 1.12em; padding: 15px 36px;
}

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
@media (orientation: portrait) {
  /* All four readouts move into the band ABOVE the frame: the band below belongs
     to the thumb controls, and a bottom-anchored HUD would sit under them. */
  .beam-run__hud-wins,
  .beam-run__hud-power {
    top: calc(clamp(8px, 2.2%, 22px) + env(safe-area-inset-top, 0px) + 52px);
    bottom: auto;
  }
}
@media (orientation: portrait), (max-width: 560px) {
  .beam-run__hud-row { font-size: clamp(13px, 3.4vw, 19px); }
  .beam-run__subtitle { font-size: clamp(15px, 4.2vw, 22px); }

  /* Phones: the column takes the full width and the bar labels give up width to
     the meters. */
  .beam-run__stack { width: 100%; }
  .beam-run__brand-mark { width: clamp(32px, 9vw, 46px); }
  .beam-run__brand-word,
  .beam-run__brand-title { font-size: clamp(19px, 5.6vw, 28px); }
  .beam-run__bar { grid-template-columns: minmax(58px, 30%) minmax(0, 1fr) 3ch; gap: 8px; }
  .beam-run__bar-label { font-size: clamp(9px, 2.6vw, 12px); letter-spacing: 0.06em; }
  .beam-run__bar-value { font-size: clamp(11px, 3vw, 15px); }
  .beam-run__hint,
  .beam-run__ref,
  .beam-run__months-label,
  .beam-run__clock-label,
  .beam-run__receipt-title { font-size: clamp(12px, 3.2vw, 16px); }
  .beam-run__months-unit { font-size: clamp(15px, 4vw, 22px); }
  .beam-run__matched { font-size: clamp(14px, 3.8vw, 18px); }
  .beam-run__actions { flex-direction: column; width: 100%; }
  .beam-run__btn {
    width: 100%; max-width: 380px; min-height: 48px; padding: 14px 20px;
    font-size: clamp(15px, 4vw, 18px);
  }
  .beam-run__assist-row { font-size: clamp(15px, 4vw, 18px); min-height: 44px; }
  .beam-run__receipt-row { grid-template-columns: 20px minmax(0, 1fr) auto; row-gap: 2px; }
  .beam-run__receipt-mark { grid-row: 1 / -1; }
  .beam-run__receipt-product { grid-column: 2; grid-row: 1; font-size: clamp(13px, 3.6vw, 17px); }
  .beam-run__receipt-detail {
    grid-column: 3; grid-row: 1; font-size: clamp(11px, 3vw, 14px);
  }
  .beam-run__receipt-stage {
    grid-column: 2 / -1; grid-row: 2; font-size: clamp(12px, 3.2vw, 15px);
  }
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
  .beam-run__hud-clock--bump { animation: none; }
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
