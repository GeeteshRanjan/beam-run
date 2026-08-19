# Architecture map — what exists (reuse, don't duplicate)

This was §5 of `HANDOFF.md`. Read the block for the layer you are about to touch; you rarely
need all of it. The rules that constrain these modules are in `docs/INVARIANTS.md`.

**Where to look, by task**

| Task touches | Read |
|---|---|
| gameplay numbers, physics, lives, months | Engine + World below, `src/data/tuning.config.ts` |
| a hazard or a capability effect | World → `Hazards/`, and `docs/SCREENS.md` for the screen |
| anything drawn on canvas | Render below |
| HUD, overlays, buttons, 404 | UI below |
| level geometry | `src/data/levels.json` + `scripts/validate-levels.ts` |
| bundle size, build wiring | Scripts below + `docs/INVARIANTS.md` (bundle traps) |

---

**Engine (`src/core/`)**
- `Loop.ts` — `advanceAccumulator()` (pure) + fixed 1/60 loop, dt clamp, timeScale, injectable now/raf.
- `StateMachine.ts` + `gameStates.ts` — `GameState` and transitions (BOOT→START→TITLE_CARD→
  PLAYING→WIN, plus PLAYING→**LIFE_LOST**→TITLE_CARD (same stage) | START (out of lives)).
  `LIFE_LOST` cannot reach PLAYING directly — every retry goes via the stage's title card. With lives
  left **nothing is drawn over the frame** during it (§4.2); `Simulation.retrying` tells the host to
  print the badge line on the title card that follows.
- `Renderer.ts` — `computeViewport()` + `clampPixelRatio()` (both pure; DPR capped at 2), HiDPI,
  teal letterbox, internal 1280×720 transform + clip, shake offsets.
- `Input.ts` — edge-detected `InputState`, arrows/WASD/Space/Esc/P/M, `setVirtual()`, `setAutoRun()`,
  `NEUTRAL_INPUT`/`makeInput()` for headless use.
- `Simulation.ts` — **authoritative headless sim.** Owns state machine, Player, Screen, `months`,
  `setbacks`, `lives`, `log`/`logPanel`/`delayMonths`, `clock`, `badgeBox`, `engaged`, `receipt`,
  `lifeLost`, `powerups`, `hazard`, `shielded`. `buildHazard()` switches on `screen.data.hazard`.
  `setback(cause)` books months, spends a life, pushes a log entry and transitions to LIFE_LOST
  (it does **not** reset the hazard — see `docs/INVARIANTS.md`); `continueAfterLifeLost()` reloads the same screen or
  resets the attempt. `forceSetback('fall')` relocates via the bounded safe-ground history (ground a
  hazard drags on never counts as safe) when a fall is *not* chargeable — its only remaining use.
  Events: onStateChange / onScreenEnter / onScreenClear / onSetback / onOutOfLives / onBadgeCollected.
- `setbackLog.ts` — pure: `SetbackLogEntry`, `ledgerRows()` (groups repeats), `logPanelView()`
  (bounded — newest `LIVES.LOG_VISIBLE_ROWS`, the rest rolled up, total counts everything).
  The HUD panel and the end screens both read through it, so they cannot disagree.
- `Game.ts` — DOM/render host. Owns Loop/Renderer/Input/Hud/Overlays/Effects/Audio/Assist/Touch/
  Analytics. HUD + overlays are created **before** the sim (the sim ctor fires START→syncUI).
  `ResizeObserver` on the stage drives `renderer.resize()`. `handleCta` → navigator payload.
- `Effects.ts` — deterministic mulberry32 RNG, pooled particles (140) + trail ring buffer (14),
  shake / hit-stop / flash; one `reducedMotion` switch disables all of it.
- `delayFlight.ts` — **pure**: (place of death, log anchor, progress) → position + alpha for the
  `+2 MONTHS` label that flies from the body into the delay log. Holds 30% of the flight before it
  travels, arcs rather than sliding, and holds-and-fades without moving under `prefers-reduced-motion`.
- `AssistController.ts`, `DebugOverlay.ts`, `finaleScene.ts` (pure finale geometry, snapshot-tested).

**World (`src/world/`, headless)**
- `Physics.ts` — `AABB`, `aabbOverlap`, `isOnGround`, `moveAndCollide` (≤8px substeps, axis-separated).
- `Player.ts` — walk/air accel + friction, gravity clamp, coyote + buffer, jump-cut, i-frames.
  `update(dt, input, solids, speedMult, jumpMult)` — accel is scaled by `speedMult` too, so a
  dragging hazard costs traction, not just top speed. No hazard uses either multiplier today.
- `Screen.ts` (grid→px, skips `noncollide`; no collectibles any more), `Powerups.ts` (timer-free;
  permanent help; badges carry no geometry), `badgeDrop.ts` (**pure** — the whole air-drop as a function of (spec, sim time): drone, parcel, the
  rest position on the brick at `restGy`, and the pickup box, so nothing about the delivery is derived
  twice), `badgeFloat.ts` (**pure**
  `badgeCenter`/`badgeBoxAt`/`badgeLowestBox` — the one source of the badge's position, read by the
  sim *and* the renderer with the same clock; **cosine, so the mark rises first**), `types.ts`
  (`Hazard {solids, speedMultAt, shieldsPlayer?, update, reset}`,
  `HazardContext {assisted, extraTelegraph}`).
- `Hazards/` — `Stamps.ts` (screen 1's slamming DENIED stamps; replaced `Quicksand.ts`),
  **`ComplianceMaze.ts`** (screen 2's wandering monsters + the clearance lift; replaced
  `Gates.ts`, which replaced `Plants.ts`), **`Workplace.ts`** (screen 3's one-way taped figure, the
  cutter's pulses, and the `restore` dial; replaced `Spikes.ts`, deleted with Local Expertise),
  **`Dragon.ts`** (screen 4's grounded Godzilla: roar beat, the patch of floor it holds, **one
  growing diverging cone of fire** with a pinned taunt, the water cannon, the glasses and the HIRED
  payoff; replaced `Fire.ts`). It also exports `MOUTH_X_FRACTION`/`MOUTH_Y_FRACTION` — the jaw is the
  one piece of anatomy the sim and the renderer both need, so it has one source — and **`coneBoxes()`,
  the single function that says what burns *and* what is painted**.
  Each answers `assisted` in its own way; `Stamps`,
  `ComplianceMaze` and `Dragon` set `shieldsPlayer`, which is what licenses the bubble on the player.
  `ComplianceMaze` is also the only hazard that returns a **solid** — the lift — because it is the
  only moving geometry in the game and one object must own its position.

**Render (`src/render/`, canvas)** — `PixelArt.ts` (crisp fillRect core; `drawBricks` takes optional
`faces` — per-brick tones — and `bevel`, both opt-in, used by screen 1 only), `PixelText.ts` (5×7 font,
`FONT` exported), `sprites.ts` (hero incl. the `squash` pose, `drawAnsrBubble`),
`sprites.ts` also owns `BubbleTint` (`BUBBLE_ORANGE` / `BUBBLE_TEAL` — colour **plus** an alpha
`boost` and a radius `spread`, because a colour swap is not a brightness swap),
`badge.ts` (the floating pickup: the **real ANSR mark** via `ansrLogo.ts`, sized to the hitbox, on a
dark cell core, plus levitation shaft + flare + ground chevron — pure, so it rasterises alone;
`Game.drawBadge` supplies only the band and a phase),
`stamps.ts` (screen 1's hazard — pure, no wall clock, so it rasterises alone),
`maze.ts` (screen 2: the **7×13 grid at scale 5 = 35×65**, i.e. the *whole* creature that is on
`origin/main` — slate cabinet, a gap, and the approval head floating above it — read through two mood
palettes; the striped boom arm painted **behind** the head, 7 cells so it fits the box at rest;
the gather pad and the clearance lift with its chevron travel cue; pure, rasterises alone),
**`dragon.ts`** (screen 4: the Godzilla as **one 30×24 grid at scale 10** — see `docs/INVARIANTS.md` for why that
breaks the composed-creature rule on purpose — plus the glasses drawn on top in *cell* coordinates so
they mirror with it, the cone of fire with its cream floor telegraph and pinned taunt plaque, the
floating bricks the badge lands on, the costume wreck the beast leaves behind, the cannon, its jets,
steam and the five HIRED candidates; pure, rasterises alone),
`workplace.ts` (screen 3: **one 20×26 figure grid read through two palettes** — the wrap and the
colleague — with the wound-cloth seams derived from that grid, the tape bands, the cutter, its pulses,
the barricade/cone/sign/post/ladder props, `drawTangled`, the enlarged terminal, **and the whole
damage-and-light layer**: the missing ceiling tiles, the room somebody walked out of, the gloom, the
fittings with their floor pools and lit edges, and the restored payoff. It draws all of that **over**
the room `scenery.ts` paints, and reads that room's geometry from the constants that module exports —
`CEILING`, `WORK_PODS`, `POD_SCREEN`, `CABINETS`, `WINDOW`. Pure, rasterises alone; guarded by
`workplace.test.ts`),
`scenery.ts` (per-level materials, skies, signage — **and the two interiors**: `drawLobbyInterior`
for Reception, `docs/SCREENS.md` §4.13, and `drawOfficeInterior` for the Workplace, which paints that
room **as the fix leaves it** and exports the geometry the damage layer draws against),
`titleScene.ts` (attract screen),
`finale.ts` (screen 5 painting), `ansrLogo.ts` (cached `Path2D` of the real brand mark;
resolves to null without `Path2D`, draw is a no-op).

**UI (`src/ui/`, DOM)** — `styles.ts` (scoped CSS in a TS template literal, minified by a Vite plugin),
`Hud.ts` (two absolutely-positioned flex **columns**: left = stage · engaged capability,
right = **lives · delay log**. There is **no TIME TO MARKET plaque** — owner call, §4; the months live
on the receipt. `pixelArtWidthPx` is the numeric twin of the CSS sizing formula, taking cells so it
answers for hand-built art too), `Overlays.ts` (start / titlecard (+ the retry line) / pause /
**gameover** / win / summary — `columns()` splits the two *receipt* screens at ≥900px; `gameover` is
deliberately one centred column), `LivesPips.ts` (the lives readout, **hearts**: solid = held, the same
silhouette hollowed out = spent, so shape carries it and the plaque cannot change width),
`PixelType.ts` (bitmap type in the DOM as inline SVG:
`setPixelText`, `setPixelButtonLabel`, `wrapPixelLabel`, `PX_TYPE` specs), `BrandMark.ts` +
`ansrMark.ts` (generated brand path), `TouchControls.ts`, `AssistMenu.ts`, `NotFoundPage.ts`
(build-time only — its copy lives in `data/notFoundCopy.ts`, apart from `COPY`, so the 404 page's
strings do not ship inside the game bundle).

**Other** — `audio/AudioEngine.ts` (Web Audio buses, synthesised cues, 0 audio bytes shipped),
`analytics/{Analytics,navigator,Save}.ts` (consent-gated), `embed/{mount,FallbackCard}.ts`
(kill switch, lazy IntersectionObserver boot, error boundary, React factory),
`data/{tuning.config.ts,levels.json,tokens.ts,copy.ts,levels.ts}`.

**Scripts** — `validate-levels.ts` (three layers: structural · physics-aware BFS over the reachable
state space using the real Player, with badge reachability proved against `badgeLowestBox` ·
meaning-layer, i.e. every screen *with an obstacle* has a badge, it precedes every obstacle,
obstacles exist beyond it, capabilities unique, months sum to the benchmark) · `check-budget.mjs` + `budget.mjs` ·
`css-minify.mjs` ·
`build-ansr-mark.mjs` (regenerates the logo path from the SVG) · `build-404.ts` ·
`not-found-plugin.ts` (serves the real 404 page in dev/preview) ·
**`strip-level-notes.ts`** (Vite `pre` plugin: drops `levels.json`'s human-only fields from the
bundle — see `docs/INVARIANTS.md`. It is wired into **both** `vite.config.ts` and `vite.config.site.ts`; it was missing
from the site one for many passes, which is the build that gets deployed).
