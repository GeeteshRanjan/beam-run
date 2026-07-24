/**
 * Dev bootstrap — only used by the local Vite dev server (index.html).
 * Production hosts use `mountBeamRun` (IIFE) or `<BeamRun/>` (React).
 */
import { mountBeamRun } from './index';

const instance = mountBeamRun('#beam-run', {
  navigatorUrl: '/gcc-opportunity-navigator',
  consent: false,
});

// Hot-module cleanup so the dev server doesn't stack canvases.
if (import.meta.hot) {
  import.meta.hot.dispose(() => instance.destroy());
}
