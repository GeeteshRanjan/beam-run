/**
 * Brand design tokens.
 *
 * The canonical palette lives in `tuning.config.ts` (BRAND) so there is a single
 * source of truth. This module re-exports it plus a few derived UI tokens
 * (spacing, radii, typography) used by the DOM overlays/HUD. Orange is reserved
 * as the "value" accent — badges, active power, CTA, fire — never as chrome.
 */
import { BRAND } from './tuning.config';

export const PALETTE = BRAND;

export type BrandColor = keyof typeof BRAND;

/** Semantic aliases so UI code reads by intent, not by hue. */
export const SEMANTIC = {
  surface: BRAND.DEEP_TEAL,
  surfaceRaised: BRAND.LIGHT_TEAL,
  letterbox: BRAND.DEEP_TEAL,
  textPrimary: BRAND.WHITE,
  textMuted: BRAND.LIGHT_GREY,
  /** The "value unlocked" accent — used sparingly. */
  accent: BRAND.ORANGE,
} as const;

export const TYPOGRAPHY = {
  /** Real Moderat drops in later (Task 11); system-sans fallback until then. */
  fontFamily:
    "'Moderat', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  monoFamily: "'Moderat Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
} as const;

export const RADII = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
} as const;
