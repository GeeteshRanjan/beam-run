/**
 * Scoped UI stylesheet, injected once per Game instance. All selectors are
 * prefixed `beam-run__` to avoid bleeding into the host page. Task 15 may move
 * this into a Shadow DOM for hard isolation.
 *
 * Colours come from the brand palette; orange is reserved for the "value"
 * accent (primary CTA, active power).
 */
import { BRAND } from '../data/tuning.config';
import { TYPOGRAPHY, RADII } from '../data/tokens';

export const STYLE_ELEMENT_ID = 'beam-run-styles';

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
.beam-run__stage {
  position: relative;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  aspect-ratio: 1280 / 720;
  background: ${BRAND.DEEP_TEAL};
  font-family: ${TYPOGRAPHY.fontFamily};
  color: ${BRAND.WHITE};
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}
.beam-run__canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

.beam-run__ui { position: absolute; inset: 0; pointer-events: none; }
.beam-run__ui * { box-sizing: border-box; }

/* HUD ------------------------------------------------------------------ */
.beam-run__hud {
  position: absolute; inset: 0; padding: clamp(8px, 2.2%, 22px);
  display: none; pointer-events: none;
}
.beam-run__hud--visible { display: block; }
.beam-run__hud-row {
  position: absolute; top: clamp(8px, 2.2%, 22px);
  display: flex; align-items: center; gap: 10px;
  font-size: clamp(12px, 1.7vw, 20px); font-weight: 600;
  text-shadow: 0 1px 3px rgba(0,0,0,0.45);
}
.beam-run__hud-level { left: clamp(8px, 2.2%, 22px); }
.beam-run__hud-lives { right: clamp(8px, 2.2%, 22px); letter-spacing: 2px; }
.beam-run__hud-points {
  left: clamp(8px, 2.2%, 22px); top: auto; bottom: clamp(8px, 2.2%, 22px);
  color: ${BRAND.LIGHT_GREY};
}
.beam-run__hud-power {
  right: clamp(8px, 2.2%, 22px); top: auto; bottom: clamp(8px, 2.2%, 22px);
  flex-direction: column; align-items: flex-end; gap: 4px; display: none;
}
.beam-run__hud-power--visible { display: flex; }
.beam-run__hud-power-name { color: ${BRAND.ORANGE}; font-size: 0.8em; }
.beam-run__hud-power-bar {
  width: 120px; height: 8px; border-radius: 4px;
  background: rgba(230,230,230,0.25); overflow: hidden;
}
.beam-run__hud-power-fill { height: 100%; width: 100%; background: ${BRAND.ORANGE}; transform-origin: left; }

/* Overlays ------------------------------------------------------------- */
.beam-run__overlay {
  position: absolute; inset: 0; display: none;
  flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(10px, 2.5%, 22px); text-align: center;
  padding: 6% 8%; pointer-events: auto;
  background: rgba(0, 36, 46, 0.86);
  backdrop-filter: blur(2px);
}
.beam-run__overlay--visible { display: flex; animation: beam-run-overlay-in 0.22s ease-out both; }
.beam-run__overlay--titlecard { background: rgba(0, 36, 46, 0.72); }
@keyframes beam-run-overlay-in {
  from { opacity: 0; transform: translateY(8px) scale(0.99); }
  to { opacity: 1; transform: none; }
}
.beam-run__title { font-size: clamp(22px, 4vw, 48px); font-weight: 700; margin: 0; }
/* Orange accent rule under a title (the "value" hairline). */
.beam-run__title::after {
  content: ''; display: block; width: 56px; height: 3px; margin: 10px auto 0;
  background: ${BRAND.ORANGE}; border-radius: 2px;
}
.beam-run__subtitle { font-size: clamp(14px, 2vw, 22px); color: ${BRAND.LIGHT_GREY}; margin: 0; }
.beam-run__hint { font-size: clamp(12px, 1.6vw, 18px); color: ${BRAND.LIGHT_GREY}; margin: 0; }
/* Arcade valuation readout — glowing tabular monospace on a subtle panel. */
.beam-run__valuation {
  font-family: ${TYPOGRAPHY.monoFamily};
  font-size: clamp(30px, 6vw, 68px); font-weight: 700; color: ${BRAND.ORANGE};
  margin: 2px 0; letter-spacing: 2px; line-height: 1.1;
  font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1;
  padding: 6px 20px; border-radius: ${RADII.md}px;
  background: rgba(0, 0, 0, 0.18); border: 1px solid rgba(255, 84, 0, 0.35);
  text-shadow: 0 0 14px rgba(255, 84, 0, 0.55), 0 0 3px rgba(255, 84, 0, 0.9);
}
.beam-run__valuation-label { font-size: clamp(12px, 1.6vw, 18px); color: ${BRAND.LIGHT_GREY}; letter-spacing: 1px; text-transform: uppercase; }

.beam-run__actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; align-items: center; }
.beam-run__btn {
  font: inherit; font-weight: 600; cursor: pointer;
  padding: 12px 22px; min-height: 44px; border-radius: 10px;
  border: 2px solid transparent; color: ${BRAND.WHITE};
  background: ${BRAND.LIGHT_TEAL}; transition: filter 0.15s ease;
}
.beam-run__btn:hover { filter: brightness(1.12); }
.beam-run__btn:focus-visible { outline: 3px solid ${BRAND.WHITE}; outline-offset: 2px; }
.beam-run__btn--primary { background: ${BRAND.ORANGE}; color: ${BRAND.DEEP_TEAL}; }
.beam-run__btn--ghost { background: transparent; border-color: ${BRAND.LIGHT_TEAL}; color: ${BRAND.LIGHT_GREY}; }

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
.beam-run__touch--large .beam-run__touch-btn { width: 84px; height: 84px; }
.beam-run__touch--large .beam-run__touch-btn--jump { width: 108px; height: 108px; }

/* Assist options dialog ------------------------------------------------- */
.beam-run__assist-list {
  display: flex; flex-direction: column; gap: 10px;
  text-align: left; width: 100%; max-width: 520px;
}
.beam-run__assist-row {
  display: flex; align-items: center; gap: 12px; cursor: pointer;
  font-size: clamp(14px, 1.9vw, 18px); color: ${BRAND.WHITE};
}
.beam-run__assist-check {
  width: 22px; height: 22px; min-width: 22px; accent-color: ${BRAND.ORANGE}; cursor: pointer;
}

/* Static fallback card (pre-lazy-mount / kill switch / boot failure) ----- */
.beam-run__fallback {
  position: relative; width: 100%; max-width: 1280px; margin: 0 auto; box-sizing: border-box;
  aspect-ratio: 1280 / 720; overflow: hidden; border-radius: ${RADII.md}px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(10px, 2.5%, 20px); text-align: center; padding: 6% 8%;
  font-family: ${TYPOGRAPHY.fontFamily}; color: ${BRAND.WHITE};
  background:
    radial-gradient(120% 90% at 80% 15%, rgba(0, 84, 101, 0.55), rgba(0, 36, 46, 0) 60%),
    ${BRAND.DEEP_TEAL};
}
.beam-run__fallback-title { font-size: clamp(22px, 4vw, 44px); font-weight: 700; margin: 0; }
.beam-run__fallback-title::after {
  content: ''; display: block; width: 56px; height: 3px; margin: 10px auto 0;
  background: ${BRAND.ORANGE}; border-radius: 2px;
}
.beam-run__fallback-body { margin: 0; color: ${BRAND.LIGHT_GREY}; font-size: clamp(14px, 2vw, 20px); }

.beam-run__sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
@media (prefers-reduced-motion: reduce) {
  .beam-run__overlay { backdrop-filter: none; }
  .beam-run__overlay--visible { animation: none; }
  .beam-run__hud-power-fill { transition: none; }
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
