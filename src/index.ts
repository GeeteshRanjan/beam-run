/**
 * Public library entry.
 *
 * Two supported embeds share this core:
 *   - `mountBeamRun(el, options)` — framework-agnostic (used by the IIFE build
 *     that exposes `window.BeamRun.mount`, and by the React wrapper).
 *   - `<BeamRun/>` — a thin React component (Task 15) that calls mountBeamRun.
 *
 * The game is designed to be lazy-loaded and never on the host page's critical
 * path.
 */
import type { GameOptions } from './core/Game';
import { mount, unmount, createBeamRunComponent, type BeamRunInstance } from './embed/mount';

export type { GameOptions } from './core/Game';
export type { EmbedOptions, BeamRunInstance } from './embed/mount';
export { Game } from './core/Game';

/** Primary embed API (used by the IIFE `window.BeamRun.mount`). */
export { mount, unmount, createBeamRunComponent };

/**
 * Raw, eager mount (no lazy/kill-switch/fallback wrapping). Kept for callers who
 * want to boot the engine immediately; most embeds should use `mount`.
 */
export function mountBeamRun(
  target: string | HTMLElement,
  options: GameOptions = {},
): BeamRunInstance {
  return mount(target, { ...options, lazy: false });
}

export const VERSION = '0.1.0';
