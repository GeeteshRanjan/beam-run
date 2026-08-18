# ANSRcade: The GCC Game — Handoff (current state)

> **Read this first, then start work.** This file is deliberately short: it holds
> *current state* only. The full narrative history of every build pass lives in
> **`docs/JOURNAL.md`** (append-only, never pruned).
>
> **How to update it after a pass** (see §9 for the rule):
> 1. Append the full entry to `docs/JOURNAL.md`.
> 2. Add a one-line summary to §10 here and drop the oldest so the list stays at 3.
> 3. Refresh the baseline numbers in §3, and §5/§7/§8 if they changed.
> 4. If the pass produced a *permanent* rule or trap, promote it to §6 — that is
>    the only content here that grows, and it is the content worth keeping.

---

## 1. Status

All 16 planned build tasks are complete and the game is playable end to end
(6 screens, win receipt, embed API, analytics, a11y, audio, touch). Everything
since then has been post-launch passes: a meaning-model rebuild (§4), layout and
mobile adaptivity, an 8-bit visual conversion of every remaining web-native
surface, the finale rebuild, and a custom 404 page.

- **Tests:** 264 passing (34 files)
- **Bundle:** ESM 43.49 KB / IIFE 43.73 KB gzip · budget gate **85.2 KB of 90 KB**
- **Validator:** green on all 6 screens (structural + physics-aware + meaning layers)
- **Next:** no queued task — see §7 for what is open. The owner has said the four
  powerup *effects* will be specified one screen at a time, so expect that next.

Task list, for the record: 1 scaffold · 2 loop/state/renderer/input · 3 physics+player ·
4 HUD/overlays/persistence · 5 quicksand+bridge · 6 fire+extinguish · 7 gates+clear-path ·
8 spikes+foresight · 9 finale+physics-aware validator · 10 art pass · 11 finale hero scene ·
12 audio · 13 touch+assist+a11y · 14 analytics+CTA · 15 React/IIFE embed+budget gate ·
16 hardening. All ticked. Details per task in `docs/JOURNAL.md`.

---

## 2. Environment (required)

- **Node is not on the system PATH.** Local Node v20.18.1 lives in `~/.local/node`.
  Prefix every shell command with `export PATH="$HOME/.local/node/bin:$PATH"`.
- Run all npm scripts inside `beam-run/`. Dependencies are installed.
- The bash tool prints a **spurious `Exit Code: 1`** — rely on stdout, not exit codes.
- Test output does not always stream: `npx vitest run > /tmp/vitest.out 2>&1`, then read the file.
- Specs live in the parent `ANSR Game/` folder (`01_…` – `10_…`, plus `tuning.config.ts`,
  `levels.json`, `analytics-events.json`, the ANSR SVG logos). They are authoritative
  **except** where §4 supersedes them. `src/data/{tuning.config.ts,levels.json}` are
  mirrors of the root files — update both.

### Verify after every task (all must be green)
```
export PATH="$HOME/.local/node/bin:$PATH"
npm run typecheck && npm run lint && npm run test && npm run build && npm run build:site && npm run validate:levels
```
`npm run analyze` prints the gzip budget report. Budgets: JS ≤ 90 KB, total ≤ 250 KB.

### You can look at the pixels — do it for any visual change
There is no browser here, but `@napi-rs/canvas` installs in seconds and the render
modules run directly, so a screen can be rasterised to PNG and *inspected*:

```
mkdir -p /tmp/brrender && cd /tmp/brrender && npm init -y && npm i @napi-rs/canvas
# set globalThis.Path2D from the package (drawAnsrLogo needs it), await import the
# render module, draw into createCanvas(1280,720), writeFileSync a PNG
"<abs>/beam-run/node_modules/.bin/tsx" shot.mts   # project's own tsx resolves TS + JSON
```
Keep it out of the project (native binary; nothing in `src/` may depend on it).
Every visual pass that skipped this shipped a defect that was invisible in the code
and obvious in the image — an occluded sun, an invisible crowd, a figure rendering
at a third of its size. DOM screens can be rasterised the same way via jsdom + the
real generators.

---

## 3. Locked decisions & defaults

- Vite + TypeScript; modular engine (`core/ world/ world/Hazards/ render/ ui/ audio/ analytics/ embed/ data/`);
  thin React `<BeamRun/>` **and** IIFE `window.BeamRun.mount()`; Vitest; `validate:levels`; `analyze` budget gate.
- Palette from `tuning.config.ts` (Deep Teal `#00242E`, Light Teal `#005465`, Orange `#FF5400`,
  Light Grey `#E6E6E6`, White `#FFFFFF`). **Orange is reserved for the "value" accent**
  (badges, active capability, CTA, fire). Logo orange `#f05722` is a separate, brand-only colour.
- Determinism: fixed 1/60s + accumulator, interpolated render, seeded RNG — **no `Math.random()`
  in `step()`**. `Game.simulate()` runs headless.
- `world/*` and `core/Simulation.ts` **never import Renderer or DOM**.
- Hazards distinguishable by **shape + motion, not colour alone**. All juice respects
  `prefers-reduced-motion`.
- Privacy-first: no PII, no gate to play, analytics no-op without consent. WCAG 2.2 AA.
  Never on the host's critical path; kill switch; config-only tunability.
- 8-bit art direction throughout: chrome (headings, figures, HUD, buttons) is set in the
  in-house 5×7 bitmap font; sentences and tabular facts stay in clean web type, because
  the font has no lower case, no apostrophe and no proportional spacing.
- Every screen and every fallback routes to the Navigator — **no dead ends anywhere**.

---

## 4. MODEL — read before touching gameplay (supersedes doc 01 §2/§6/§7)

The owner has redesigned the *meaning layer* twice since launch. Six-screen structure, art
direction, physics and budgets unchanged both times; the progression model is not. Where doc 01
or `07_Analytics_and_Lead_Handoff.md` disagree, **this section wins** (the prose docs predate
both revisions and still describe a no-lives model; `analytics-events.json` matches this).

1. **Two stakes measuring the same thing: months, and three lives.** Clearing a screen books
   its `monthsBase`; the six sum to `JOURNEY.ANSR_BENCHMARK_MONTHS` (11), so a clean run lands
   exactly on ANSR's published benchmark. Being stopped by an obstacle books `SETBACK_MONTHS`
   (2), writes a line in the **delay log**, and costs one of `LIVES.TOTAL` (3). The total is
   capped at `MAX_MONTHS` (23) so a run always beats the going-alone baseline (24).
2. **A lost life restarts the SAME stage, never the next one and never screen 0.** The run
   resumes at that stage's title card, so a delay costs a life and two months but never
   progress. Spend the last life and the attempt ends on the itemised ledger and hands back to
   the title screen. This is the `LIFE_LOST` state (§5).
3. **Nothing is ever a dead end and nothing blames the player.** Running out of lives lands on
   a conversion surface — the ledger, the argument, and both routes — exactly like reaching
   the Tech Park. Every setback line names the *system* as the cause, by obstacle name.
4. **Every screen carries an ANSR badge, anchored ahead of the obstacles it answers, and it
   floats.** It drifts along a straight vertical line through ±`POWERUPS.FLOAT_AMPLITUDE` px
   around its authored `gy`, one cycle per `FLOAT_PERIOD`. The band dips into a standing
   player's box, so a good pass walks into it and a mistimed one needs a hop — missable on
   purpose, which is what gives the life-lost screen's instruction something to say. The
   validator fails the build if any obstacle sits at or before the badge, or if none sit beyond
   it. Never label or offer a "do it yourself" route — self-build is the actual competitor.
5. **Four distinct verbs, not one reskinned shield.** `PLACE_TILE` builds a permanent bridge
   (1Wrk) · `EXTINGUISH` puts hiring lanes out for good (Talent500) · `CLEAR_PATH` lifts
   approval barriers for good (GCC-BOT) · `FORESIGHT` shows landing spots and stops setbacks
   (500Leaders). `SAFE_PASSAGE` is the non-capability badge on Reception and the Tech Park (the
   two screens with nothing to defend against); its effect is deliberately unassigned. **Help
   never expires** — a 5-second shield would say ANSR helps briefly then leaves.
6. **No score collectibles.** The Growth Points are gone (owner call): a second score competed
   with the only figure the game argues about, and picking one up said nothing about ANSR.
7. **The receipt is the conversion surface.** The win screen shows the run's months, two
   *attributed* reference lines, the delay summary, and four capability rows that are Navigator
   links carrying a declared `br_topic`. Leaving mid-run shows the same receipt. Intent is
   declared, never inferred.
8. **One-tap auto-run is the default on touch.** The audience is executives on phones.

---

## 5. Architecture map (what exists — reuse, don't duplicate)

**Engine (`src/core/`)**
- `Loop.ts` — `advanceAccumulator()` (pure) + fixed 1/60 loop, dt clamp, timeScale, injectable now/raf.
- `StateMachine.ts` + `gameStates.ts` — `GameState` and transitions (BOOT→START→TITLE_CARD→
  PLAYING→WIN, plus PLAYING→**LIFE_LOST**→TITLE_CARD (same stage) | START (out of lives)).
  `LIFE_LOST` cannot reach PLAYING directly — every retry goes via the stage's title card.
- `Renderer.ts` — `computeViewport()` + `clampPixelRatio()` (both pure; DPR capped at 2), HiDPI,
  teal letterbox, internal 1280×720 transform + clip, shake offsets.
- `Input.ts` — edge-detected `InputState`, arrows/WASD/Space/Esc/P/M, `setVirtual()`, `setAutoRun()`,
  `NEUTRAL_INPUT`/`makeInput()` for headless use.
- `Simulation.ts` — **authoritative headless sim.** Owns state machine, Player, Screen, `months`,
  `setbacks`, `lives`, `log`/`logPanel`/`delayMonths`, `clock`, `badgeBox`, `engaged`, `receipt`,
  `lifeLost`, `powerups`, `hazard`. `buildHazard()` switches on `screen.data.hazard`.
  `setback(cause)` books months, spends a life, pushes a log entry and transitions to LIFE_LOST;
  `continueAfterLifeLost()` reloads the same screen or resets the attempt. `forceSetback('fall')`
  still relocates via the bounded safe-ground history (sludge never counts as safe) when the fall
  is *not* chargeable — that is the only remaining use of it. Events: onStateChange /
  onScreenEnter / onScreenClear / onSetback / onOutOfLives / onBadgeCollected.
- `setbackLog.ts` — pure: `SetbackLogEntry`, `ledgerRows()` (groups repeats), `logPanelView()`
  (bounded — newest `LIVES.LOG_VISIBLE_ROWS`, the rest rolled up, total counts everything).
  The HUD panel and the end screens both read through it, so they cannot disagree.
- `Game.ts` — DOM/render host. Owns Loop/Renderer/Input/Hud/Overlays/Effects/Audio/Assist/Touch/
  Analytics. HUD + overlays are created **before** the sim (the sim ctor fires START→syncUI).
  `ResizeObserver` on the stage drives `renderer.resize()`. `handleCta` → navigator payload.
- `Effects.ts` — deterministic mulberry32 RNG, pooled particles (140) + trail ring buffer (14),
  shake / hit-stop / flash; one `reducedMotion` switch disables all of it.
- `AssistController.ts`, `DebugOverlay.ts`, `finaleScene.ts` (pure finale geometry, snapshot-tested).

**World (`src/world/`, headless)**
- `Physics.ts` — `AABB`, `aabbOverlap`, `isOnGround`, `moveAndCollide` (≤8px substeps, axis-separated).
- `Player.ts` — walk/air accel + friction, gravity clamp, coyote + buffer, jump-cut, i-frames.
  `update(dt, input, solids, speedMult, jumpMult)` — accel is scaled by `speedMult` too, so sludge
  has traction, not just a top-speed cap.
- `Screen.ts` (grid→px, skips `noncollide`; no collectibles any more), `Powerups.ts` (timer-free;
  permanent help), `badgeFloat.ts` (**pure** `badgeCenter`/`badgeBoxAt`/`badgeLowestBox` — the one
  source of the badge's position, read by the sim *and* the renderer with the same clock),
  `types.ts` (`Hazard {solids, speedMultAt, jumpMultAt?, blocksJump?, update, reset}`,
  `HazardContext {assisted, extraTelegraph}`).
- `Hazards/` — `Quicksand.ts` (shallow wade + deep pit that blocks jumping), `Fire.ts`,
  `Gates.ts` (replaced the old `Plants.ts`), `Spikes.ts`. Each answers `assisted` in its own way.

**Render (`src/render/`, canvas)** — `PixelArt.ts` (crisp fillRect core), `PixelText.ts` (5×7 font,
`FONT` exported), `sprites.ts` (hero, badge), `scenery.ts` (per-level materials, skies,
signage), `titleScene.ts` (attract screen), `finale.ts` (screen 5 painting), `ansrLogo.ts`
(cached `Path2D` of the real brand mark; resolves to null without `Path2D`, draw is a no-op).

**UI (`src/ui/`, DOM)** — `styles.ts` (scoped CSS in a TS template literal, minified by a Vite plugin),
`Hud.ts` (two absolutely-positioned flex **columns**: left = stage · lives · engaged capability,
right = clock · delay log), `Overlays.ts` (start / titlecard / pause / **lifelost** / win /
summary — `columns()` splits the end screens at ≥900px), `LivesPips.ts` (the lives readout, shared
by the plaque and the life-lost screen), `PixelType.ts` (bitmap type in the DOM as inline SVG:
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
meaning-layer, i.e. every screen has a badge, it precedes every obstacle, obstacles exist beyond
it, capabilities unique, months sum to the benchmark) · `check-budget.mjs` + `budget.mjs` ·
`css-minify.mjs` ·
`build-ansr-mark.mjs` (regenerates the logo path from the SVG) · `build-404.ts` ·
`not-found-plugin.ts` (serves the real 404 page in dev/preview).

---

## 6. Invariants & traps (the expensive lessons — read before editing)

**Bundle**
- Vite's terser plugin **skips `es`-format library output**; `minifyEsOutput()` in `vite.config.ts`
  re-adds it. Without it the ESM bundle ships unminified (~5 KB of the gate).
- **That plugin must run in `generateBundle`, not `renderChunk`.** As a `renderChunk` hook it ran,
  terser returned 135 KB, and a 176 KB file still landed on disk: Vite's `vite:esbuild-transpile`
  runs in the **post** phase after every normal plugin's renderChunk and re-prints the chunk.
  Mangled identifiers survive that, so the output *looks* minified — the regression hid for many
  passes. `budget.test.mjs` now asserts the two bundles are within 10% of each other and that
  neither is beautified; "es much bigger than umd" is the signature.
- Dev-only code must be **constructed** behind `__DEV__`, not merely used behind it. `DebugOverlay`
  was an eager field initialiser, so the class stayed reachable and shipped to every host.
- Copy for build-time-only pages does not belong in `COPY` — that object is imported by the game,
  so anything in it ships (this is why the 404 strings live in `data/notFoundCopy.ts`).
- The scoped stylesheet is a TS template literal, so nothing minifies it by default —
  `scripts/css-minify.mjs` runs as a Vite plugin and guards structure by counting braces.
- **Backticks inside `styles.ts` terminate the template literal.** Write CSS comments in prose.
- The budget gate sums the ESM *and* UMD builds even though a host loads exactly one. Real
  download is the IIFE figure. Effective per-bundle budget is therefore ~45 KB.

**DOM bitmap type**
- **Any `PixelSpec` without `maxShare` is a bug waiting to happen.** The default `min(96%, …)` cap
  is circular inside a shrink-wrapping flex box, and the browser silently falls back to the SVG's
  intrinsic width — that is how the closing months figure rendered at a third of its size.
  Size in frame units (`--beam-run-u`, i.e. `cqw` against the stage) with an explicit `maxShare`.
- The 5×7 font has **no lower case and no apostrophe**. Any string drawn as pixels must avoid
  apostrophes (there is a test guarding this). Unsupported chars fold (em dash → hyphen, → → >).
- Every pixel heading must ship a `.beam-run__sr` span with the real prose, and the artwork must
  be decorative, so `textContent` and screen readers are unchanged.

**Layout**
- The stage clamps on **both** axes (`max-width` derived from `--beam-run-max-height`), with a
  `dvh` layer. Portrait deliberately stops being 16:9: `aspect-ratio: auto` plus a control band
  (`--beam-run-portrait-band`), HUD in the top band, thumb controls in the bottom.
- Host-overridable knobs: `--beam-run-max-width`, `--beam-run-max-height`, `--beam-run-portrait-band`.
- Type inside the frame is sized in `cqw` (`--beam-run-u`), never `vw` — the frame is letterboxed,
  so window-relative type overflows it.

**Gameplay**
- Level data drives everything; the engine hardcodes no gameplay number. Mirror any change to
  `src/data/{tuning.config.ts,levels.json}` into the root copies.
- The physics-aware validator searches **hazard-ignoring** (as if assisted), so hazard tuning
  changes cannot break it — but geometry changes can.
- **The badge moves, so its position has exactly one source: `world/badgeFloat.ts`.** Derive it a
  second time anywhere (a render-only bob, a `now()`-based offset, the anchor cell) and you ship a
  pickup that is visible where the collision is not. Same reason it is **not** frozen under
  `prefers-reduced-motion`: that would move the hitbox, which is a rules change, not a comfort
  setting. Its clock is `Simulation.screenClock`, a sim-time accumulator — never the wall clock,
  or `step()` stops being replayable.
- A lost life reloads the screen, which resets `Powerups` — so the badge is always available again
  on the retry. Do not "optimise" that into an in-place respawn.
- `zone` in `levels.json` is **authoring intent, not a position** (it predates the badge moving to
  the front of the screen). Nothing validates it against geometry, and doing so would fail every
  screen for being correct.
- The delay log panel grows downwards from the top of the frame, so it must stay bounded
  (`LIVES.LOG_VISIBLE_ROWS` + a roll-up). This is also why the HUD stacks plaques in flex columns
  instead of anchoring them to corners — a hand-tuned pixel offset under the log is wrong again on
  the next delay.
- Orange stays off the delay log (a ledger of avoidable months is the opposite of value); only the
  running total is warmed.
- A struggle zone must not be skippable. Screen 1's wade is 8 tiles precisely because a running
  jump carries ~172px, and `SLUDGE_JUMP_MULT` exists because hop-chaining otherwise crossed it
  in a third of the walking time.

**Testing**
- For time-windowed hazards, read the hazard's own state getter right after `update()` rather than
  recomputing `t = i * DT` (float consistency).
- Test helpers live in `src/test/helpers.ts`: `driveToScreen`, `expireGrace`, `engageBadge` (reads
  `sim.badgeBox`, never the anchor cell), `standAtColumn`, `forceSetbackAt` and
  **`recoverFromLifeLost`** — almost every hazard test needs the last one now, because a delay
  leaves the sim in `LIFE_LOST` and the stage restarts from its title card.

---

## 7. Open for the owner (unresolved, in priority order)

1. **`navigatorUrl` is still the placeholder `/gcc-opportunity-navigator`** (in `main.ts` and
   `DEFAULT_OPTIONS`). Every CTA in the game lands on our own 404 page until it points at the real
   GCC Opportunity Navigator, or a Vercel rewrite is added. Highest-value fix outstanding.
2. Does the Navigator accept a parameter that **pre-selects a stage**? If so, wire `br_topic` to it.
3. **The per-screen powerup effects.** The owner has said the effect each badge gives will be
   specified one screen at a time. Screens 1–4 keep their existing capability behaviour; the two
   `SAFE_PASSAGE` badges (Reception, Tech Park) collect and do nothing yet, by design.
4. **Screen 1 is the one stage that is impossible without its badge** (the 7-tile pit exceeds max
   jump; only the 1Wrk bridge crosses it). A player who walks past a missable badge three times
   will game-over there. The float band was authored to dip into the walking line to make that
   unlikely and the life-lost screen names the fix — but if telemetry shows attempts ending on
   screen 1, make *that one* badge unmissable rather than softening the pit.
5. Are these four pains the ones the pipeline actually voices, or the four service lines? Swapping
   a pain is cheap now (level data + re-skin), expensive after launch.
6. Mobile traffic share, to confirm the auto-run default.
7. Portrait play area: the camera is one fixed 1280×720 screen per level, so there is nothing to
   crop. A bigger portrait frame means either a rotate-to-landscape hint or a portrait-specific
   camera — both product decisions.
8. Brand typography: the lockup's "ANSRcade" and the 404 body copy are still web type by choice.
9. The prose specs (`01_Game_Design_Document.md` §2/§6/§7, `07_Analytics_and_Lead_Handoff.md`)
   still describe the pre-lives model and now disagree with the build. §4 above and
   `analytics-events.json` are current; the prose docs have not been rewritten.

---

## 8. Deliberately left in web type

The two attributed reference lines' *supporting* prose, the assist dialog's intro and checkbox
labels (real form controls, real sentences), the 404 page's body paragraph, and the brand wordmark.
Everything else on the start, HUD, pause, win and summary screens is bitmap.

---

## 9. Journal rotation rule

`docs/JOURNAL.md` is append-only and complete. **Nothing is ever deleted from it** — the findings
(what was measured, what was ruled out, why) are what stop a future session repeating a dead end.
This file keeps only the last 3 passes as one-liners; when a fourth is added, the oldest drops off
the list here and stays in the journal. Before an entry rotates out, any permanent rule it contains
must already be in §6.

---

## 10. Recent passes (newest first — full entries in `docs/JOURNAL.md`)

- **Lives, the delay log, and the badge on every screen (owner model change — see §4).** 3 lives,
  a `LIFE_LOST` state that restarts the *same* stage and becomes the closing ledger on the last
  life, a bounded delay log hanging top-right, Growth Points deleted, and the ANSR badge on all six
  screens floating vertically ahead of the obstacles it answers. Also found `minifyEsOutput()` was
  a no-op (Vite's post-phase transpile re-printed the chunk), which is why the gate *fell* to
  **85.2 KB of 90** with the feature in. 264 tests (34 files).
- **Navigator buttons went nowhere / 404 never appeared** — `handleCta` navigated only when
  `!__DEV__`, so every CTA silently no-oped in dev; and Vite's SPA fallback re-served the game for
  `/gcc-opportunity-navigator`. Added `scripts/not-found-plugin.ts` (real 404 in dev + preview,
  byte-identical to the built file) and removed the dev gate. 245 tests; gate 85.5 KB.
- **Win screen symmetry** — the closing months figure was rendering ~46px instead of ~110px
  (`PX_TYPE.figure` had no `maxShare`; the percentage cap is circular in a shrink-wrapped box).
  Fixed on four specs; buttons moved out of the right column to span both, columns top-aligned.
  245 tests (33 files); gate 85.5 KB.
