# ANSRcade — build journal (append-only archive)

Full history of every build pass, moved out of `HANDOFF.md` so that file can stay
short enough to actually be read at the start of a session.

**Policy**
- `HANDOFF.md` is *current state*: environment, status, architecture, invariants,
  open questions, next task, and a one-line summary of the last 3 passes.
- This file is *history*: the full narrative entry for every pass, oldest first.
- **Append here, never delete.** The expensive part of these entries is the
  findings (why something was done, what was measured, what was ruled out) —
  that is what stops a future session repeating a dead end.
- When `HANDOFF.md`'s "Recent passes" list grows past 3 entries, the oldest one
  drops off the list. Its full entry is already here, so nothing is lost.
- Anything from an entry that is a *permanent* rule (a gotcha, an invariant, a
  constraint) must be promoted into `HANDOFF.md` §Invariants when it is written,
  not left buried here.

---

## Change log (oldest first)


- Tasks 1–7 completed in the initial session. Screens 0–3 fully playable + test-backed. 87 tests; ESM 18.7 KB gzip.
- Task 8: `world/Hazards/Spikes.ts` (headless mini state machine per column: telegraph 0.5s → falling@900px/s → resting 3.0s → despawning 0.3s; lethal in falling+resting only; `ctx.freeze` pauses ALL motion + never kills; `spikeStates()` for render). Wired `Simulation.buildHazard` case `'spikes'` and `Game.drawSpikes` (steel triangles, telegraph chevron+drop guide, fall streak, fade — colour-blind safe, reduced-motion aware). Tests: `Spikes.test.ts` (5) + `screen4.test.ts` (4). 96 tests passing; ESM 19.63 KB gzip.
- Task 9: Finale win already wired (Simulation PLAYING→WIN on winTriggerX). Added **Company Valuation count-up** in `Overlays` (`startValuationCountUp`/`advanceValuation`, easeOutCubic, `VALUATION_COUNT_UP_S`; reduced-motion instant; `show()` now inits valuation only on transition INTO win). `Game` passes `{reducedMotion}` to Overlays and drives `advanceValuation(dt)` each frame while WIN. **Upgraded `scripts/validate-levels.ts` to physics-aware**: reuses real `Player`+`moveAndCollide`+tuning in a BFS flood over the reachable state space (5-substep macro-actions, quantized states, 300k cap) — proves exit/win reachable, badge reachable, PLACE_TILE screen completable ONLY with the bridge, and no Growth Point in a lethal region (hazard-ignoring search == invincible assist; slow mode can't change geometry). Tests: `golden.test.ts` (2 — end-to-end WIN across all 6 screens + 115-pt banking) + ui count-up tests. 99 tests passing; ESM 20.14 KB gzip / IIFE 14.11 KB gzip; validator green all 6 screens.
- Task 10: New headless `src/core/Effects.ts` (deterministic mulberry32 RNG; camera shake w/ decay, hit-stop, death flash, Beam light-trail, landing dust + pickup/badge particle bursts; pools capped). Single `reducedMotion` switch disables shake/trail/particles/flash/hit-stop. Wired into `Game`: constructs `new Effects(reducedMotion)`, hooks sim events (onDeath→shake+flash+hit-stop; onPointCollected→grey burst; onBadgeCollected→orange burst; onScreenEnter→clear), loop skips `sim.step` while `hitStopActive`, `render()` drives `effects.update(dt)`, pushes trail + landing dust, passes shake to `renderer.begin`, draws trail/particles/flash. Beam gained squash/stretch from vy; `drawBackground` now renders per-level multi-layer parallax (far halo, mid skyline, drifting orbs; static under reduced motion). Tests: `Effects.test.ts` (6, incl. reduced-motion disables everything + determinism). 105 tests passing; ESM 22.46 KB gzip / IIFE 15.67 KB gzip.
- Task 11: New pure `src/core/finaleScene.ts` — `finaleLayout(w,h,tower)` returns headless scene geometry (sky gradient stops, plaza, glass tower from the noncollide facade, 4×8 window grid, bloom crown, ANSR mark). `Game.drawFinale` (routed from `drawWorld` when `screen.id===5`) paints layered sky + dawn glow + plaza + glass tower + twinkling windows + bloom + procedural ANSR sunburst (`drawAnsrMark`, logo orange `#f05722`); all motion reduced-motion-gated. Overlay polish in `styles.ts`: `@font-face` for Moderat + Moderat Mono (local-first, commented WOFF2 url slot to drop in later, `font-display: swap`), reduced-motion-safe overlay entrance keyframe, orange title accent rule, and an arcade valuation readout (glowing tabular monospace panel). Tests: `finaleScene.test.ts` (3 — window bounds, inline layout snapshot, 1×/2× viewport invariance). 108 tests passing; ESM 24.23 KB gzip / IIFE 17.04 KB gzip.
- Task 12: New `src/audio/AudioEngine.ts` — Web Audio `music`+`sfx` buses → master → destination; autoplay-safe (master gain 0 + context suspended until `unlock()` on Start/M gesture); procedurally-synthesised cues (jump/land/pickup/badge/powerExpire/death/screenClear/win) so 0 audio bytes shipped and fully playable muted; −6 dB music ducking under KEY_CUES (badge/death/screenClear/win); per-bus `setMuted`/`toggleMuted` + master `toggleMuteAll`; injectable `createContext` factory (real AudioContext satisfies the minimal `AudioContextLike` structurally) for headless tests. Wired into `Game`: field `audio`, `unlock()` on Start/M, cues on sim events (onScreenClear/onDeath/onPointCollected/onBadgeCollected) + render-loop jump/land/powerExpire detection + WIN fanfare + ambient start on run begin; M-key master mute; `destroy()` closes context. OGG/MP3 pack is a future drop-in behind the same API. Tests: `AudioEngine.test.ts` (5). 113 tests passing; ESM 26.06 KB gzip / IIFE 18.21 KB gzip.
- Task 13: New `src/core/AssistController.ts` (headless; toggles slowMode→loop.timeScale, extraTime/invincible/largerControls→sim.assist, muteMusic/muteSfx→audio bus; announces each via injected aria-live cb; `syncMutes`). New `src/ui/TouchControls.ts` (safe-area ◀/▶ move zone + ≥44px jump button, pointer→Input.setVirtual, haptic navigator.vibrate, aria-hidden, `setVisible`/`setLarger`, `isTouchDevice()`). New `src/ui/AssistMenu.ts` (role=dialog aria-modal, 6 labelled checkboxes → controller, Done closes, syncs on open). Game wiring: constructs touch→assist→assistMenu after loop; `openAssist()` + `assistOpen` flag hides base overlay behind the dialog in `syncUI`; touch shown only while PLAYING on touch devices; M-key + onToggleMute call `assist.syncMutes`; teardown added. styles.ts: touch + assist CSS with env(safe-area-inset-*). Tests: `AssistController.test.ts` (5), `keyboard.test.ts` (1 keyboard-only start/walk/jump), `touchAndAssist.test.ts` (5 DOM). 124 tests passing; ESM 28.65 KB gzip / IIFE 20.29 KB gzip.
- Task 14: New `src/analytics/` — `Analytics.ts` (consent-gated GA4-style adapter; hard no-op without consent; injectable `AnalyticsSink`; `createDefaultSink` → gtag/dataLayer; typed taxonomy for all 12 events from analytics-events.json with common params session_id/device/input/reduced_motion/ts; `setConsent`; `detectDevice`), `navigator.ts` (`buildNavigatorPayload`/`buildNavigatorUrl` — non-PII utm/br_outcome/br_points, points clamped ≥0), `Save.ts` (pseudonymous sessionStorage `session_id` + localStorage mute pref, storage-failure safe). Game wiring: `analytics` field (consent from GameOptions.consent); emits game_loaded (ctor end), game_started+ambient (START→TITLE_CARD), screen_entered/cleared, badge/point, player_died, game_over/completed + cta_shown on transitions, cta_clicked+game_skipped in handleCta (now uses navigator helper), assist_toggled via AssistController onChange; restores+persists mute pref (M key, onToggleMute, assist mute toggles). AssistController gained 3rd ctor arg `onChange(option,enabled)`. Tests: `analytics.test.ts` (7). 131 tests passing; ESM 30.43 KB gzip / IIFE 21.65 KB gzip.
- Task 15: New `src/embed/mount.ts` — `mount(target, options)` with kill switch (`enabled:false` / `window.__BEAM_RUN_DISABLED__` → fallback only), IntersectionObserver lazy boot (branded card w/ Play until in view; boots immediately if IO absent), error boundary (boot failure → fallback + onError), `_gameFactory` test seam; plus `unmount` and `createBeamRunComponent(React)` (dependency-free React factory, no bundled React, uses createElement + useRef/useEffect). New `src/embed/FallbackCard.ts` (branded static card, Play optional + always a Skip→Navigator route). `src/index.ts` now exports mount/unmount/createBeamRunComponent (window.BeamRun.mount via UMD global 'BeamRun'); mountBeamRun = eager mount(lazy:false). styles.ts fallback CSS. Budget gate refactored: `scripts/budget.mjs` (shared BUDGETS + pure `evaluateBudget`) used by `check-budget.mjs` + tested by `scripts/budget.test.mjs`; vitest include adds `scripts/**/*.test.mjs`. Tests: `embed.test.ts` (5: eager mount/destroy, kill switch, boot-failure fallback, lazy intersection, React wrapper), `budget.test.mjs` (3). 139 tests passing; ESM 31.60 KB / IIFE 22.47 KB gzip; budget gate: 52.8 KB total JS ✓.
- Task 16 (FINAL): Object pooling in `src/core/Effects.ts` — preallocated particle pool (MAX 140) with swap-remove compaction + a trail ring buffer (MAX 14); zero per-frame/per-particle allocation (public API unchanged; getters return views). Replaced the stray root `ANSR Game/index.html` (was a saved Microsoft login page) with a real branded demo page that lazy-mounts the built IIFE via `window.BeamRun.mount`. Added `beam-run/README.md` (run/build/embed/options/a11y/privacy docs). Verified no dead ends (every overlay + fallback routes to the Navigator). Tests: +2 Effects pooling/memory-stability tests. ALL 16 TASKS COMPLETE — 141 tests passing (28 files); ESM 31.96 KB / IIFE 22.70 KB gzip; budget gate 53.4 KB total (≤90/≤250); validator green all 6 screens.

- Visual pass 1 (post-launch, user-requested): true 8-bit "Dangerous Dave" look. New `src/render/PixelArt.ts` (crisp fillRect pixel core: `drawPixels`/`pxRect`/`drawBricks`/`hash2`), `src/render/sprites.ts` (HUMAN hero replacing the orange orb, + Growth Point + ANSR badge), `src/render/scenery.ts` (per-level `TILE_MATERIALS` + meaning-driven `drawSceneBackground`). Rewired `Game.ts`: pixel scene backgrounds, textured tiles, human hero, pixel collectibles/badge, plaza "bridge", and pixelated all hazards; removed dead orange comet trail. Added standalone site build (`vite.config.site.ts` + `build:site` + `vercel.json`, out `dist-site/`) so Vercel serves a real index.html. NOTE: deliberate departure from the GDD "Beam" mascot + "no noisy 8-bit" direction, at owner's request; hero uses skin/hair tones beyond the 5 brand colours (orange still reserved for value). 141 tests; IIFE 25.23 KB gzip.
- Visual pass 2 (user-requested clarity/scale): new `src/render/PixelText.ts` — legible 5×7 bitmap font (A–Z, 0–9, symbols) with `drawText`/`measureText`/`drawLabelPlaque` (all ASCII-verified). Hero rebuilt bigger + more detailed (16×20 executive: hair highlight, face, lapels, tie, arms/hands; idle/run/jump/fall) at scale 3 → 48×60. Rewards clearer: Growth Point = rising bar-chart + up-arrow; floating "+5" value popups on pickup and "VALUE UNLOCKED" + ANSR capability tag on badges (new `Popup` system in `Game.ts`, cleared on screen enter). In-world signage via PixelText in `scenery.ts`: ANSR reception sign + per-stage floor-directory signs (MARKET ENTRY / SETUP DELAYS / HIRE UNDER FIRE / COMPLIANCE MAZE / LOCAL EXPERTISE) + prop labels (PERMITS, RED TAPE, HIRING, TAX/GST/AUDIT/LEGAL/ENTITY, LOCAL?). Each badge shows its solution tag (ANSR 1WRK / TALENT500 / GCC-BOT / 500LEADERS). Hazards: tapered white-hot flame + rising embers (fire), sinking paperwork flecks in the red-tape sludge (quicksand). All motion reduced-motion-gated. Green: typecheck + lint + 141 tests + both builds + validate:levels; budget 64.3 KB gzip / 90 KB (IIFE 27.20 KB gzip, site bundle 28.19 KB gzip).
- Visual pass 3 (user-requested colour contrast): the walkable ground and the building/backdrop had collapsed into the same teal (tile `face` colours matched the sky horizon tints/skyline almost exactly), so foreground vs background read flat. Rebalanced `src/render/scenery.ts` on two axes: (1) each level's ground `TILE_MATERIALS` now uses a brighter, distinct hue that lifts off the backdrop and still carries stage meaning — L0 bright cool teal (lobby), L1 muddy clay-brown (red-tape ground), L2 burnt terracotta (scorched), L3 slate grey-blue (compliance tile), L4 sandy tan (weathered stone), L5 brightest cyan plaza (payoff); (2) deepened every `drawSky` horizon tint + `drawSkyline` base colour so the sky/skyline recede behind the ground band (clear value break at the floor line). Orange still reserved for value; earthy browns/tans are well clear of the reserved `#FF5400`. Hazards remain shape+motion distinguishable and all motion stays reduced-motion-gated. Green: typecheck + lint + 141 tests + build + build:site + validate:levels; IIFE 27.26 KB gzip, site bundle 28.26 KB gzip (≤90 KB).

- **Meaning-model rebuild (post-launch, owner-approved — see §2b).** The audit found the game's mechanics were decorative in places and, more seriously, that the badge sat *before* each hazard, so the player was made immune before ever feeling the problem, and the closing "Company Valuation: 115 pts" was an arcade score that said nothing to a CxO. Rebuilt the meaning layer end to end.
  **Data/model:** `tuning.config.ts` gained `JOURNEY` (BASELINE 24 / BENCHMARK 11 / SETBACK 2 / MAX 23 / knockback / grace / count-up); `RUN` lost lives + points; `POWERUPS` lost all durations; `HAZARDS.PLANTS`→`GATES` (+OPEN_RADIUS/OPEN_TIME), `FIRE` +EXTINGUISH_RADIUS/DOUSE_FADE, `SPIKES` +FORESIGHT_TELEGRAPH, `QUICKSAND.SINK_SETBACK_TIME`; `ASSIST` +AUTO_RUN_DEFAULT_ON_TOUCH, `NO_SETBACKS` replaces INVINCIBLE. `levels.json` re-authored: every hazard screen now has instances before AND after a mid-screen badge, per-screen `monthsBase` (1/3/3/2/2/0 = 11), shallow-vs-`deep` quicksand, `gates` replacing `plants`, badge types `PLACE_TILE|EXTINGUISH|CLEAR_PATH|FORESIGHT`. `copy.ts` gained `CAPABILITIES` (product/stage/effect/monthsSaved/topic/tag — savings sum to the 13-month gap), the 24-month start hook, and environment-blaming setback lines.
  **Engine:** `gameStates` lost DEATH+GAMEOVER; `Simulation` swapped lives/points for `months`/`setbacks`/`quickWins`/`engaged`/`receipt`, `setback(cause)` books months and relocates via a bounded safe-ground history (sludge never counts as safe), `forceSetback('fall')` always rescues; `Hazard` gained optional `blocksJump` and `Quicksand` uses it for deep sludge (closes a real hole: you could otherwise wade the pit and hop out, falsifying Screen 1's whole claim); `HazardContext` is `{assisted, extraTelegraph}` and each family answers it differently (bridge / douse lanes / lift gates / foresee drops) rather than sharing one immunity flag; new `world/Hazards/Gates.ts` replaces `Plants.ts`; `Powerups` is timer-free.
  **UI/host:** HUD is months-led with every readout on a solid panel (bare text over pixel art was not legible); new capability **receipt** on the win screen (months + two attributed reference lines + four clickable capability rows carrying `br_topic`) and a `summary` receipt when someone leaves mid-run; `gameover` overlay deleted; `Game` draws the struggle/relief zone read (dimmed struggle side, gateway at the badge, bright relief ground cap once engaged), doused lanes with steam, lifting stamped barriers, foresight landing markers, and non-orange delay popups; one-tap auto-run wired through `Input.setAutoRun`/`TouchControls`/`AssistController` (default on touch); audio cue `death`→`setback`.
  **Analytics:** `player_died`/`game_over` → `setback_incurred`/`run_summary_shown`; `game_completed` now reports months/setbacks/quick wins/capabilities; payload carries `br_months` + declared `br_topic` (root `analytics-events.json` updated, incl. an open question about pre-selecting a Navigator stage).
  **Validator:** third layer added — fails the build unless every hazard screen has instances on both sides of its badge, `zone` labels match the geometry, each capability appears exactly once, screen months sum to the benchmark, the cap stays under the baseline, and capability savings cover the gap.
  Green: typecheck + lint + **194 tests (28 files)** + build + build:site + validate:levels; ESM 46.91 KB gzip / IIFE 31.76 KB gzip / site 32.91 KB gzip; budget gate 76.8 KB of 90 KB. Root `tuning.config.ts` + `levels.json` mirrored; root demo `index.html` hero now leads with the 24-month stake.
  **Open for the owner:** (1) does the GCC Opportunity Navigator accept a parameter that pre-selects a stage? If so wire `br_topic` to it — highest-ROI integration left. (2) Are these four pains the ones the pipeline actually voices, or the four service lines? Swapping a pain is cheap now (level data + re-skin), expensive after launch. (3) Mobile traffic share, to confirm auto-run defaults.

- **Layout/scale fix (user-reported: "view is very small and not fitting the screen").** Three independent causes, all fixed. (1) `.beam-run__stage` was sized from width only (`width:100%; max-width:1280px; aspect-ratio:16/9`) with **no height constraint**, so on any short/wide viewport the frame ran off the bottom and the contain-fitted canvas inside looked tiny. It now clamps to the available height as well: `max-width: min(var(--beam-run-max-width,1280px), calc(var(--beam-run-max-height,100vh) * 1280/720))`, with a `@supports (height:100dvh)` layer that swaps in `dvh` (tracks the visible viewport, so the mobile URL bar can't crop the frame). Two host-overridable knobs — `--beam-run-max-width`, `--beam-run-max-height`. Same clamp applied to `.beam-run__fallback` so the pre-lazy-mount card matches the stage and there's no layout jump. (2) `beam-run/index.html` (the dev page **and** the source of the deployed `dist-site/`) capped the mount at `width:min(960px,100vw); margin:24px auto` — that 960 cap was the literal "small view". It is now a centred full-viewport flex layout with `--beam-run-max-width: 100vw` (the 16:9 frame is a contain-fit, so scaling past the 1280 internal resolution is safe); root demo `index.html` keeps the 1280 cap but sets `--beam-run-max-height: 76dvh/76vh` (100vh in portrait, where width binds) so the frame fits under the hero. (3) Only `window.resize` was wired, so container-driven size changes never reached `renderer.resize()` — the backing store could stay stale/small after a host reflow, a late webfont, a dvh change, or the ctor's first `resize()` running before the stage was laid out. Added a `ResizeObserver` on the stage in `Game.bindWindowEvents` (feature-guarded for jsdom, disconnected in `destroy()`); it fires on observe, so it also serves as the authoritative initial measurement. Also: DOM UI text was sized in `vw` (browser window) while the frame is letterbox-fitted — once the frame shrinks to fit the height, window-sized text overflows it. The stage/fallback are now size containers (`container-type: inline-size` behind `@supports`) and all 19 clamped font sizes use a new `--beam-run-u` unit (`1cqw`, falling back to `1vw`) via a small `U(n)` helper in `styles.ts`, so overlay/HUD type scales with the game frame. Touch targets stay in px (≥44px physical). Verified: typecheck + lint + **194 tests (28 files)** + build + build:site + validate:levels all green; ESM 47.56 KB / IIFE 32.42 KB / site 33.57 KB gzip; budget gate 78.1 KB of 90 KB. Files changed: `src/ui/styles.ts`, `src/core/Game.ts`, `beam-run/index.html`, root `index.html`. Not verified: pixel-rendered output — no browser engine in this environment (jsdom has no layout engine), so the fit was checked analytically and in the emitted CSS, not by screenshot.

- **Mobile/portrait adaptivity (user-reported, follows the layout fix above).** The height clamp made the frame *fit*, but portrait was still bad for a structural reason: a 16:9 frame in portrait is width-limited, so on a 390px phone the play frame is only ~219px tall — and the HUD, the overlays and two thumb buttons were all absolutely positioned *inside* that strip, so the controls covered the ground the player was running on. Portrait now stops being 16:9: `@media (orientation: portrait)` sets `aspect-ratio: auto` and `height: min(var(--beam-run-max-height,100dvh), calc(56.25vw + var(--beam-run-portrait-band, 360px)))`, i.e. the play frame plus a control band. The canvas still contain-fits (the renderer already paints the letterbox in Deep Teal) and the bands above/below become the UI area — the standard mobile-game split. New knob `--beam-run-portrait-band` (default 360px = 180px per band, which clears the bottom safe area + an 18px offset + a 120px thumb button; the standalone page passes `100dvh` to go full-screen). Consequences wired through: all four HUD readouts move into the **top** band in portrait (`hud-wins`/`hud-power` re-anchored to `top: gutter + safe-area + 52px`, `bottom: auto`) because the bottom band belongs to the controls and a bottom-anchored HUD sat underneath them; every HUD offset now adds `env(safe-area-inset-*)` so a notch or home indicator can't land on a readout (0 on desktop, so no regression); portrait touch buttons grow (76/104, one-tap 120 centred across the full width so either thumb reaches it). Phone typography block (`@media (orientation: portrait), (max-width: 560px)`) raises the type floors against the *screen* — container-relative type bottoms out at its floor on a narrow frame — stacks overlay buttons full-width at 48px min-height, and collapses the 4-column receipt row to two lines (product + saving, then stage) since four columns cannot fit 390px. Stage also gained `touch-action: manipulation` (kills double-tap zoom, keeps the host page scrollable), `overscroll-behavior: contain` (no pull-to-refresh mid-run) and `-webkit-touch-callout: none`. Perf: new pure `clampPixelRatio()` in `Renderer.ts` caps the backing store at `MAX_PIXEL_RATIO = 2` — a 3× phone in portrait would otherwise ask for a ~1170×2532 canvas and repaint all of it every frame, and past 2× the extra pixels are invisible on flat pixel art. Standalone `beam-run/index.html` centres on `100dvh` and goes full-screen in portrait; root demo `index.html` gained a portrait `--beam-run-max-height: 100dvh`. Tests: +3 in `Renderer.test.ts` (portrait contain-fit with bands; DPR cap; DPR fallbacks for 0/negative/NaN/undefined). Verified: typecheck + lint + **197 tests (28 files)** + build + build:site + validate:levels green; ESM 49.21 KB / IIFE 34.07 KB / site 35.26 KB gzip; budget gate 81.3 KB of 90 KB; both stylesheets (library CSS + both host pages) parsed with postcss to confirm the nested `@media`/`@supports` groups are well-formed. Files changed: `src/ui/styles.ts`, `src/core/Renderer.ts`, `src/core/Renderer.test.ts`, `beam-run/index.html`, root `index.html`. Not verified: rendered pixels — no browser/layout engine in this environment, so geometry was checked arithmetically (390×844 embed → 390×579 stage, 219px frame, 180px bands; 844×390 landscape → 693×390 full-height frame). Still open: in portrait the frame can only ever be as wide as the screen (the camera is one fixed 1280×720 screen per level, so there is nothing to crop) — if the owner wants a bigger portrait play area the options are a rotate-to-landscape hint or a portrait-specific camera, both product decisions.

- **Sludge drag made legible (user-reported: "the character on the sand is still fast enough to not even notice the speed is reduced").** Three causes, all fixed. (1) `HAZARDS.QUICKSAND.WALK_SPEED_MULT` was `0.55` → 143 px/s, still a brisk jog, so the struggle zone read the same as dry ground and Screen 1's whole claim ("setup drags") went unfelt. Now `0.26` (~68 px/s), plus a new `DEEP_WALK_SPEED_MULT: 0.14` (~36 px/s) so the pit is decisively worse than the wade instead of sharing one multiplier — `Quicksand.speedMultAt` now answers deep and shallow separately. (2) `GROUND_ACCEL` (3000 px/s²) was applied at full strength inside the sludge, so the hero snapped to the reduced speed within ~2 frames: there was no *transition* to feel. `Player.update` now scales the acceleration branch by the same `speedMult` (traction, not just top speed), so entering sludge bogs down over ~0.2s and leaving it snaps back to full accel — the release is felt. Friction (`dir === 0`) is deliberately left unscaled: mud should stop you, not let you slide. (3) The walk cycle was driven by wall clock (`time: this.now()` → `Math.floor(t*8)%2`), so a dragged hero animated at full run cadence while barely moving — visually "not slow" whatever the number said. `Game` now keeps a `strideClock` advanced by `dt * min(1, |vx| / PLAYER.WALK_SPEED)`, so the stride rate tracks real ground speed. Measured over 0.6s of held right-input on Screen 1: dry ground 145 px (260 px/s), shallow sludge 37.7 px (67.6 px/s, 26%), deep pit 20.3 px (36.4 px/s). No level data changed, so the physics-aware validator (which searches hazard-ignoring, i.e. as if assisted) is unaffected and stays green; jumps out of shallow sludge are unaffected because the multiplier lifts the moment the player leaves contact, and the deep pit already suppresses jumping. Tests: +1 in `Quicksand.test.ts` (tuning guard: wade ≤ 1/3 walk speed, pit strictly slower) and +1 in `screen1.test.ts` (behavioural: same input/duration, sludge run covers < 45% of the dry-ground distance); the existing "either grade drags" assertion now expects the two distinct multipliers. Green: typecheck + lint + **199 tests (28 files)** + build + build:site + validate:levels; ESM 49.74 KB / IIFE 34.12 KB / site 35.32 KB gzip; budget gate 81.9 KB of 90 KB. Files changed: `src/data/tuning.config.ts` (+ root mirror), `src/world/Hazards/Quicksand.ts`, `src/world/Player.ts`, `src/core/Game.ts`, `src/world/Hazards/Quicksand.test.ts`, `src/core/screen1.test.ts`. Not verified: on-screen feel — no browser engine here, so pace was measured in the headless sim, not watched.

- **Start + end screen redesign (user-requested: "these two pages look very bad and don't align with the game").** The start screen was DOM text in system-sans floating over *level 0* behind a flat 92% teal wash — the tutorial backdrop and its in-world "MARKET ENTRY: ON PAPER" sign showed through the copy, so it read like a bug, and no ANSR mark appeared anywhere. Rebuilt both screens as 8-bit arcade screens. **First attempt put the copy on a chamfered "cabinet card"; the owner rejected the card outright — keep it translucent like the original and push the 8-bit look harder — so the card was removed and replaced with the treatment below.** (1) New `src/render/titleScene.ts`: a purpose-built attract composition (pure `titleLayout()` + `drawTitleScene()`), lone executive on the left, skyline whose height and lit-window count *ramp* left→right, banded retro sun and the lit ANSR tower with a pixel sunburst on the right, chevron trail between them; `Game.drawBackground` routes START/BOOT to it instead of level 0. (2) **DOM headlines are now set in the game's own 5×7 bitmap font**: `PixelText.FONT` is exported and `src/ui/PixelType.ts` renders it as inline SVG (one path of 1×1 rects, `shape-rendering: crispEdges`, hard 1px shadow, unsupported chars folded — em dash→hyphen, arrow→`>`). Used for the start challenge, the level title card, Paused, the summary/win titles, the closing months figure and the 24 in the stake sentence. Sizing is frame-relative (`--beam-run-u`) and clamped (title 3–7px per authored pixel, figure 7–15px), so glyph size tracks the play frame like the canvas art but never drops to 11px on a phone. Every pixel heading is decorative + a `.beam-run__sr` span with the real sentence, so `textContent` and screen readers are unchanged. (3) The overlay wash is now a **4px checkerboard dither** (how 8-bit hardware faked transparency) plus static CRT scanlines, over a soft vignette — translucent, so the attract scene and the Tech Park finale stay visible. No card, no fill, no border: `.beam-run__stack` only sets measure/rhythm. (4) Buttons are NES-style: square, 4px light/dark inner bevel, dark pixel rail, real 3px press that flips the bevel. (5) New `src/ui/BrandMark.ts` — generated 24-ray ANSR sunburst (logo orange `#f05722`) + wordmark as one `role="img"`, so both screens are branded without shipping the 700-polygon logo SVG. (6) The win screen gained **three comparison meters** (your run / ANSR clients / going alone) scaled to the going-alone baseline, segmented like 8-bit bars, each carrying its own number; the player's bar grows with the months count-up. Decorative — the attributed `.beam-run__ref` lines still carry the facts for assistive tech. New copy keys `win.barYou/barAnsr/barAlone`. (7) **Bundle: new `scripts/css-minify.mjs` + Vite plugin.** The scoped stylesheet lives in a TS template literal (so brand colours interpolate), which means nothing ever minified it — 26 KB raw / 7.3 KB gzip *per bundle*, duplicated across ESM+UMD, and the redesign pushed the gate to 93.6 KB of 90 KB. The plugin strips CSS comments and collapses whitespace on the way into the bundle, never touching `${...}` interpolations, and refuses to ship if brace/declaration/interpolation counts move. Source stays fully documented; payload dropped 6.6 KB gzip. Tests: `titleScene.test.ts` (4 — determinism, towers on the ground line, left→right ramp, hero placement), `css-minify.test.mjs` (5 — incl. esbuild-parsing the *real* minified sheet, `@vitest-environment node`), +3 overlay tests (brand lockup a11y, bitmap headlines with text intact and no card, months digits repainting with the count-up). Green: typecheck + lint + **212 tests (30 files)** + build + build:site + validate:levels; ESM 53.2 KB / IIFE 35.6 KB / site 37.0 KB gzip; budget gate **87.0 KB of 90 KB**. Files added: `src/render/titleScene.ts`(+test), `src/ui/PixelType.ts`, `src/ui/BrandMark.ts`, `scripts/css-minify.mjs`(+test). Changed: `src/render/PixelText.ts`, `src/core/Game.ts`, `src/ui/Overlays.ts`, `src/ui/styles.ts`, `src/ui/ui.test.ts`, `src/data/copy.ts`, `vite.config.ts`, `vite.config.site.ts`. Not verified: rendered pixels — there is no browser/canvas engine in this environment, so the attract scene and the type scale were checked arithmetically (SVG viewBoxes, clamped widths at 1280px and 390px frames) rather than looked at; `npm run dev` is the way to eyeball it. Note the budget gate sums the ESM *and* UMD builds even though a host loads exactly one — the real download is 35.6 KB gzip.

- **Title-screen trim, stake typography, and the un-skippable wade (user-reported).** Three owner notes after previewing the redesign. (1) **Dropped the control legend and the "~90 seconds" line from the start screen** — a title screen that explains the arrow keys reads as a manual. The screen is now brand lockup → stake → challenge → two buttons. Controls still reach screen-reader users through `COPY.a11y.canvasLabel` on the canvas, and touch users get the one-tap layout regardless; `OverlayData.isTouch/autoRun` and the `show('start')` copy branch are gone (Game no longer passes them), and `COPY.start.controls*` / `COPY.meta.estimatedTime` are now unused by the UI but kept in copy.ts. (2) **The stake sentence was half bitmap, half web type** ("The average India GCC takes **24** months to go live." with only the number in the game font), which is what the owner meant by the font not matching — it read as two products stacked. It is now set *entirely* in the 5×7 font as three stacked display lines (lead-in / `24 MONTHS` at display size in the value orange / tail) via new copy keys `start.stakeLead|stakeFigure|stakeTail`, with the full sentence in one `.beam-run__sr` span so `textContent` and assistive tech still get ordinary prose. New `PX_TYPE.stakeText|stakeFigure` scale entries; `.beam-run__keys` CSS removed with the hint it styled. (3) **Screen 1's struggle sludge was skippable.** A full running jump carries ~172px and the wade was 4 tiles (160px), so the drag the screen exists to demonstrate could be cleared in one leap — and at *any* width, chained hops crossed it in a third of the walking time, because each hop left the sludge box for most of its arc and regained full acceleration. Three coordinated changes: the wade is now **8 tiles** (320px, gx6–13, so a leap covers under half of it and lands *in* it); new `QUICKSAND.SLUDGE_JUMP_MULT: 0.55` damps jump strength while standing in shallow sludge (~1 tile of height, ~1.4 tiles of ground — laboured hops, and it *looks* like struggling), wired through a new optional `Hazard.jumpMultAt()` → `Simulation` → `Player.update(dt, input, solids, speedMult, jumpMult)`; and new `QUICKSAND.SLUDGE_AIR_HEIGHT: 56` raises the *drag* test box (drag only — setbacks and jump damping still need real contact) so the air just above the wade drags too. Measured in the headless sim: wading 4.78s, hop-chaining 4.78s (was ~1.4s), leap from the dry edge 56px, running leap from further back ~172px into a 320px zone. The Growth Point at gx12 moved to gx15 (dry ground) so it isn't stranded above the widened sludge; badge/bridge/deep pit geometry unchanged, so the physics-aware validator (which searches as if assisted) stays green. Tests: +1 in `screen1.test.ts` (the wade cannot be leapt or hopped: span > 1.5× max leap, landing inside the zone, hop time ≥ 90% of walk time, walk > 3.5s) and the start-screen test now asserts no hints/estimate and three bitmap stake lines that read as the accessible sentence. Green: typecheck + lint + **213 tests (30 files)** + build + build:site + validate:levels; ESM 54.4 KB / IIFE 35.7 KB / site 37.0 KB gzip; budget gate 88.0 KB of 90 KB. Root `levels.json` + `tuning.config.ts` re-mirrored. Files changed: `src/data/{copy.ts,levels.json,tuning.config.ts}`, `src/ui/{Overlays.ts,styles.ts,ui.test.ts}`, `src/core/{Game.ts,Simulation.ts,screen1.test.ts}`, `src/world/{types.ts,Player.ts,Hazards/Quicksand.ts}`. Not verified: on-screen feel — no browser engine here, so the pace and the type were measured/computed, not watched.

- **Renamed to ANSRcade, title-screen spacing, and a visible Growth Point (user-requested).** (1) **The game is now `ANSRcade`, with "Market Entry" as the *edition*** — new `COPY.meta.name` + `COPY.meta.edition`, `title` composed from them, and the start/fallback/a11y strings updated. The DOM lockup reads `[sunburst] ANSRcade · MARKET ENTRY` (new `wordmark` option on `createBrandLockup`, defaulting to `COPY.meta.name`), so nothing says "ANSR ANSR". Framing it as name + edition means a second cabinet can ship later without another rename. Both host pages and `beam-run/README.md` retitled. **Internal identifiers deliberately unchanged**: the npm package, module paths, the `beam-run__` CSS namespace and the public `window.BeamRun.mount` embed API all stay — renaming those would break any host page already carrying the snippet, for no user-visible gain. (2) **Start-screen padding/placement.** Everything was crammed: the overlay had 5%/7% padding and a ~10–22px rhythm for the whole screen. Scene overlays now carry `clamp(18px, 5.5%, 56px) clamp(16px, 7%, 72px)` padding and a `clamp(16px, 4%, 40px)` outer gap; the stack rhythm went to `clamp(12px, 2.6%, 26px)` (start screen `clamp(20px, 5%, 52px)` — it holds only three things, so it can breathe), the stake's three bitmap lines to `clamp(8px, 1.6%, 18px)`, and the buttons to `clamp(12px, 1.8%, 20px)`. Composition changed too: on the start screen the lockup is a **marquee pinned to the top** (`justify-content: flex-start` + `margin-block: auto` on the stack), so the copy centres in the space below it and the attract art stays visible above and below instead of the logo sitting on top of the headline; on a frame too short for that the auto margins collapse and it degrades to a plain centred stack. (3) **Growth Points were nearly invisible** — light-grey bars over the bright teal lobby floor (L0) and the tan stone (L4) sat at almost the same value, so the only collectible in the game had to be hunted for in the backdrop. `drawGrowthPoint` now paints its **own dark tablet with a bright mint frame** behind the sprite (four pixel-crisp bars, not a rounded rect), the bars went to pure white and the axis to bright cyan, and `Game` adds a static mint halo behind each pickup; drawn at scale 3 instead of 2. Still no orange anywhere on it — that stays the ANSR value accent. Because the drawn pickup grew, `QUICK_WIN_SIZE` went 24 → 36 px so you can't visibly run through one without collecting it. Tests updated for the new name (`data.test.ts` now derives the title from name+edition; the lockup test asserts the ANSRcade wordmark and the edition sub-line) — **213 tests (30 files)** green, plus typecheck + lint + build + build:site + validate:levels; ESM 54.9 KB / IIFE 35.9 KB / site 37.3 KB gzip; budget gate 88.7 KB of 90 KB. Files changed: `src/data/{copy.ts,data.test.ts}`, `src/ui/{BrandMark.ts,Overlays.ts,styles.ts,ui.test.ts}`, `src/render/sprites.ts`, `src/core/{Game.ts,Simulation.ts}`, `beam-run/index.html`, `beam-run/README.md`, root `index.html`. Not verified: rendered output — no browser engine here, so spacing and pickup contrast were reasoned from the emitted CSS and the sprite's own palette/plate rather than looked at.

- **Edition renamed to "The GCC Game", title-screen rhythm, sweeping value rule, pickup card removed (user-requested).** (1) `COPY.meta.edition` is now **The GCC Game** (`title` → `ANSRcade: The GCC Game`), so the lockup reads `[sunburst] ANSRcade · THE GCC GAME`; both host pages and `beam-run/README.md` retitled. In-run copy that describes the *journey* rather than the product is untouched on purpose — the win headline is still "Market Entry Complete." and the finale title card still reads "Arrival — ANSR Tech Park", because those name what the player just did, not the cabinet. (2) **Title-screen rhythm reworked.** The top-pinned marquee from the previous pass read as a detached logo, so the lockup and the copy are centred together as one unit with a tight `clamp(6px, 1.2%, 14px)` gap; the breathing room moved *inside* the copy — the start stack's rhythm eased to `clamp(16px, 3.6%, 38px)` and the challenge headline gained `margin-top: clamp(14px, 3.4%, 38px)`, so the beat that matters (after "…to go live.", before "THINK YOU CAN BEAT THAT?") is the biggest gap on the screen. (3) **The orange value rule now spans the headline and sweeps.** It was a fixed 48–84px stub; because `.beam-run__title` shrink-wraps its bitmap art, `width: 82%` is 82% *of the text block*, and a 3.2s `beam-run-sweep` slides it ±11% of its own width — exactly the 18% of slack left over, so it travels edge to edge of the text above without ever crossing it. Disabled (and re-centred) under `prefers-reduced-motion`. (4) **Growth Point card removed.** The dark tablet + mint frame from the previous pass fixed visibility but looked like UI dropped into the level, so the contrast now comes from the sprite itself: pure white bars, a hot mint `#4BFFA5` arrow (the most saturated colour in the game apart from fire), bright cyan axis, and a one-pixel dark outline traced around the silhouette at four offsets — a border on the *shape*, which is how pixel art has always stayed legible over both light and dark ground, not a panel behind it. The soft glow in `Game` stays (light, not a plate) and was retuned to the new mint. `QUICK_WIN_SIZE` stays 36px. Green: typecheck + lint + **213 tests (30 files)** + build + build:site + validate:levels; ESM 55.0 KB / IIFE 36.0 KB / site 37.3 KB gzip; budget gate 88.8 KB of 90 KB. Files changed: `src/data/copy.ts`, `src/ui/styles.ts`, `src/render/sprites.ts`, `src/core/Game.ts`, `beam-run/index.html`, `beam-run/README.md`, root `index.html`. Not verified: rendered output — no browser engine here, so the sweep range and the spacing were derived from the emitted CSS, not watched.

- **Real ANSR sunburst in the lockup, bigger lockup, more air below it (user-requested).** (1) **The mark is now the actual logo.** New generated module `src/ui/ansrMark.ts` carries the brand SVG's sunburst — every `.cls-2` shape from the root `ANSR Logo.svg` (the circle), none of the `.cls-1` shapes (the "ANSR" wordmark, which the lockup sets in type). The source's 27 polygons and 5 rotate-transformed rects were flattened to one relative path: rect corners run through their `translate/rotate` matrix, coordinates re-origined to the sunburst's own bounding box and quantised to 0.5 source units (≈0.3 px at the size it's drawn), which encodes as small integers on a `0 0 175 181` viewBox — 1.29 KB raw / 0.55 KB gzipped, a third of the naïve absolute-coordinate dump. `BrandMark` now emits one `<path>` and the procedural 24-ray approximation is deleted; the canvas finale/tower marks stay procedural on purpose (a smooth vector logo would look wrong inside the pixel art). Height is `auto` so the non-square 175×181 mark is never squashed. (2) **Lockup enlarged**: mark 34→56px (was 26→38), wordmark `clamp(21px, 3u, 36px)` (was 16–26), edition sub-line 11→19px, with phone floors raised to match. (3) **More air under it**: the start overlay gap went `clamp(6px, 1.2%, 14px)` → `clamp(18px, 4.2%, 46px)`, so the lockup reads as the title of the thing rather than a label stuck to the copy. (4) **Budget work to pay for the logo.** The real path pushed the gate to 90.8 KB, so: terser now runs `compress: { passes: 2 }` and drops comments; the CSS minifier also strips the redundant `;` before each `}` and the leading zero on fractional values (its structural guard now checks `{`/`}`/`:` counts, since semicolons are deliberately dropped). Net: **89.6 KB of 90 KB**. Tests: new `src/ui/ansrMark.test.ts` (3 — all 32 subpaths present and closed, relative-only encoding, path bounds exactly fill the viewBox, logo orange kept distinct from the value orange) and the lockup test now asserts a real logo `<path>` in `#f05722` with zero `<line>` elements. Green: typecheck + lint + **216 tests (31 files)** + build + build:site + validate:levels; ESM 55.6 KB / IIFE 36.2 KB / site 37.9 KB gzip. Files added: `src/ui/{ansrMark.ts,ansrMark.test.ts}`. Changed: `src/ui/{BrandMark.ts,styles.ts,ui.test.ts}`, `scripts/css-minify.mjs`(+test), `vite.config.ts`. **Worth raising with the owner:** the budget gate sums the ESM *and* UMD builds even though a host loads exactly one (real download: 36.2 KB gzip), so the effective per-bundle budget is ~45 KB and headroom is now 0.4 KB. Either the gate should measure the larger single bundle, or the next visual addition needs a matching saving. Not verified: rendered output — no browser here, so the path was validated numerically (subpath count, bounds) rather than looked at.

- **Logo fidelity restored, ESM output actually minified, pickup toned down (user-reported).** (1) **The sunburst looked "broken and different" because of the byte-saving pass, not the extraction.** To fit the 90 KB gate I had quantised the path to a 0.5-unit integer grid and relative-encoded it. No shape collapsed (checked: all 32 survive, worst area retention 87%), but the rays are only ~1.2 units wide, so grid-snapping their edges changed individual ray weights by up to a quarter — at 34–56 px, where one source unit is ~0.5 px, that reads as an uneven, patchy sunburst. The mark now ships at the asset's **own 2 dp precision, absolute coordinates** (viewBox `0 0 87.68 90.55`, 3.1 KB of path data ≈ 1.0 KB gzipped). Extraction itself is unchanged and now reproducible: new `scripts/build-ansr-mark.mjs` (npm script `build:mark`) regenerates `src/ui/ansrMark.ts` from `ANSR Logo.svg` — keeps only `.cls-2` (the sunburst; the `.cls-1` wordmark stays excluded because the lockup sets "ANSRcade" in type), pushes the five `<rect>`s through their `translate/rotate` matrix, re-origins to the sunburst's bounding box. Verified the rect flattening by hand: the parallelogram side lengths come back as the source's 3.44 × 22.07. (2) **Found the real budget problem: `beam-run.esm.js` was never minified.** Vite's terser plugin has an explicit early return for `config.build.lib && outputOptions.format === 'es'` (it assumes a library consumer re-bundles), so the ESM build shipped 197 KB raw / 54 KB gzipped of readable source while the identical UMD build was 113 KB / 35 KB — i.e. ~19 KB of the gate was self-inflicted, which is what made every visual addition feel unaffordable. This widget is loaded as-is by hosts, so new `minifyEsOutput()` plugin in `vite.config.ts` runs terser on `es`-format chunks (`module: true`, 2 passes). Gate: **76.2 KB of 90 KB** (was 89.6 with a *worse* logo), so the earlier note about the gate double-counting is no longer urgent — there is real headroom again. (3) **Growth Point toned down.** The "make it pop" pass overshot: bars went to pure white, the arrow to neon `#4BFFA5`, and a 46px glow at 0.30 alpha made it read as a light source. Since the separation actually comes from the dark outline around the silhouette, the fill can sit under pure white: bars `#E8F2F4`, arrow `#7FD9AE` (mint, off the neon), axis `#49A8BC`, and the glow tightened to 34px at 0.16. Outline, scale 3 and the 36px hitbox unchanged. Tests: `ansrMark.test.ts` rewritten for the absolute path (32 closed subpaths matching the exported shape count, >200 fractional coordinates as a guard against re-quantising, bounds exactly filling the viewBox, logo orange distinct from the value orange) — **217 tests (31 files)**; typecheck + lint + build + build:site + validate:levels green; ESM 40.9 KB / IIFE 37.1 KB / site 38.8 KB gzip. Files added: `scripts/build-ansr-mark.mjs`. Changed: `src/ui/{ansrMark.ts,ansrMark.test.ts}`, `src/render/sprites.ts`, `src/core/Game.ts`, `vite.config.ts`, `package.json`. Not verified: rendered pixels — no browser here, so the path was checked numerically (shape count, bounds, hand-verified rect geometry) and the pickup by palette values.

- **Start/end screen rhythm + the headline rule made 8-bit (user-requested).** (1) **The end screens were spaced as a pile.** Win and the mid-run summary carry eight stacked elements (title, "you went live in", the figure, three meters, two attributed reference lines, the four-row receipt, the buttons) on one uniform gap, so nothing grouped. Both overlays now carry a `--receipt` modifier: frame padding comes back in (`clamp(14px, 3.2%, 34px) clamp(14px, 4.5%, 48px)` vs the title screen's roomier figures — tall content was reaching the scroll overflow before the padding earned anything), and the stack's base gap drops to `clamp(5px, 1%, 10px)` with the space spent *between groups* instead: the figure block, the meters, the receipt and the actions each open with a `clamp(8–10px, 2–2.6%, 20–26px)` step while the unit stays married to its figure and the reference lines to their meters. (2) **Start screen rebalanced.** The stake→challenge beat had grown to ~76px (stack gap + margin), which read as a hole rather than a pause; it is now ~56px (gap `clamp(14px, 3%, 30px)`, title `margin-top: clamp(10px, 2.4%, 26px)`), the lockup sits `clamp(16px, 3.6%, 38px)` above the copy, and the buttons pull a little closer to the challenge they answer (`margin-top: clamp(4px, 1%, 12px)`) so the screen reads as two groups, not four loose lines. (3) **The sweeping rule is now a loading-bar readout, not a moving hairline.** A 4px line gliding on an eased transform is a modern-web gesture and looked wrong beside bitmap type. It is now a dim orange **track** at 84% of the headline's width carrying one square 18px block, 6px tall, animated with `steps(14, end) ... alternate` on `background-position-x` — 14 discrete hops per pass, landing on a grid, exactly how an 8-bit machine would animate it, and bounded by the track's own edges so it can never cross the text above. Parks mid-track under `prefers-reduced-motion`. Tests: +1 in `ui.test.ts` asserting the animation is stepped (`steps(14, end)`), position-based, and disabled under reduced motion — **218 tests (31 files)**; typecheck + lint + build + build:site + validate:levels green; budget 76.4 KB of 90 KB (site 39.0 KB gzip). Files changed: `src/ui/{styles.ts,Overlays.ts,ui.test.ts}`. Not verified: rendered output — no browser here, so the rhythm was reasoned from the emitted CSS; the step count (14) and the block width (18px) are the two knobs if the sweep wants to feel chunkier.

- **Lockup baseline + bloom restraint (user-reported "The GCC Game seems a bit misaligned").** The lockup was one flex row with `align-items: center`, so the small edition text was centred against a much larger wordmark and sat visibly low. The wordmark, divider and edition now share a nested `.beam-run__brand-text` row on `align-items: baseline` (the mark stays optically centred on the row), and the divider is sized explicitly to the wordmark's cap height (`clamp(15px, 2.1u, 26px)`) because it inherits the overlay's font size, not the wordmark's. Two other things spotted in the same screenshot and fixed while there: the orange bloom on the stake figure (12px/0.5) and on the closing months figure (16px/0.5) was bleeding into the neighbouring lines and softening glyphs whose whole point is hard edges — now 7px/0.34 and 10px/0.38. Green: typecheck + lint + **218 tests (31 files)** + build + build:site + validate:levels; budget 76.5 KB of 90 KB. Files changed: `src/ui/{BrandMark.ts,styles.ts}`.

- **Edition set at wordmark size (user: still misaligned).** Baseline alignment wasn't the whole story — "THE GCC GAME" was two-thirds the wordmark's size, and a small line beside a large one never sits right whatever it is aligned to. The edition now matches the wordmark exactly (`clamp(21px, 3u, 36px)`, and the compact end-screen variant matches its own smaller wordmark); hierarchy is carried by weight and colour instead — wordmark bold white, edition regular light grey with slightly tighter tracking. The divider tracks each variant's cap height, and both lockup rows gained `flex-wrap` + centring so the now-wider single line can break cleanly on a narrow phone frame instead of overflowing. Green: typecheck + lint + **218 tests (31 files)** + build + build:site + validate:levels; budget 76.6 KB of 90 KB. File changed: `src/ui/styles.ts`.

- **Lockup alignment, actual root cause (user: revert the size, centre it properly, fix the divider).** The equal-size edition was reverted — it belongs at a supporting size — and the real reason it never looked centred was found: `.beam-run__brand-title` had no `line-height`, so it inherited the overlay's (~1.5) and its line box was taller than its glyphs; centring the flex boxes therefore did not centre the *text*. Every item in the row is now `line-height: 1` with `align-items: center`, which puts both cap heights on one centre line (the residual offset between a 36px and a 20px uppercase run is ~0.8px). The divider is a 2px bar at the wordmark's cap height (`clamp(16px, 2.2u, 27px)`), `flex: none`, slightly brighter, and centred on the same line; the compact end-screen variant scales all three together. Also cancelled the trailing letter-space that tracking leaves after the last glyph (`margin-right: -0.2em` on the wordmark, `-0.14em` on the edition) — without it the gap before the divider read wider than the gap after it and the whole lockup sat fractionally left of centre. **Gotcha for future edits:** backticks inside the CSS template literal terminate it — a comment written as \`line-height: 1\` broke the build until rewritten in prose. Green: typecheck + lint + **218 tests (31 files)** + build + build:site + validate:levels; budget 76.6 KB of 90 KB. File changed: `src/ui/styles.ts`.

- **Real ANSR logo in the world, not just the overlays (user-requested).** The DOM lockup had been switched to the brand asset, but the two marks painted *inside* the game were still procedural approximations: the Tech Park plaza mark on the finale (`Game.drawAnsrMark`, 28 stroked rays + a rotating ring) and the ANSR tower facade on the attract screen (`titleScene.drawPixelSunburst`, chunky pixel rays). Both now draw the same brand path the lockup uses. New `src/render/ansrLogo.ts` compiles `ANSR_MARK_PATH` once into a cached `Path2D` and exposes `drawAnsrLogo(ctx, cx, cy, diameter, rotation)` + `ansrMarkScale()`; where `Path2D` is unavailable (jsdom) it resolves to `null` and drawing is a silent no-op, so a missing canvas implementation can never take the finale down. The generator (`scripts/build-ansr-mark.mjs`) now also emits `ANSR_MARK_W/H` so canvas callers can scale by the mark's own units, and `ansrMark.ts` was regenerated. The plaza mark keeps its slow revolve (still under reduced motion) and gained a soft logo-orange glow so it reads against the plaza gradient; the wordmark under it stays type, since the logo's lettering is deliberately not shipped as artwork. `LOGO_ORANGE` now has one home (`ui/ansrMark.ts`, re-exported) instead of a duplicate literal in `Game.ts`, and `drawPixelSunburst` is deleted. Tests: new `src/render/ansrLogo.test.ts` (3 — diameter fitting by the longest side, graceful null path + no-throw draw without `Path2D`, logo orange kept distinct from the value accent) → **221 tests (32 files)**; typecheck + lint + build + build:site + validate:levels green; budget 76.5 KB of 90 KB (site 39.1 KB gzip). Files added: `src/render/ansrLogo.ts`(+test). Changed: `src/core/Game.ts`, `src/render/titleScene.ts`, `src/ui/ansrMark.ts`, `scripts/build-ansr-mark.mjs`. Not verified: rendered pixels — no canvas engine here, so the mark's placement/scale was checked arithmetically; the attract-screen facade mark is a judgement call (a vector logo inside pixel art) and is one line to revert if it looks wrong on screen.

- **Finale (screen 5, ANSR Tech Park) rebuilt (user: "not up to the mark").** Two problems: the finale was the only screen painted in smooth CSS-style gradients (sky, glass body, bloom) while the other five are chunky pixel art, so the payoff looked like a different game; and it was the *sparsest* picture in the build — one flat tower rectangle with a 4×8 pane grid on an empty slab, plus a floating mark. `core/finaleScene.ts` (still pure and snapshot-tested) now returns a full scene: 12 solid **sky bands** derived from the old gradient stops (with a `mixHex`/`sampleStops` sampler, so the palette is unchanged but the rendering is stepped), a banded **rising sun** behind the tower, a deterministic **distant skyline** that never rises above the tower, a stepped **crown + mast + blinking beacon**, a **signed facade panel** carrying the real ANSR mark plus a pixel-font wordmark, a lit **entrance + canopy** at the base (the win trigger at gx26 sits inside the doorway span, so the run now ends by walking *in*), a denser 5×10 pane grid with the panes the sign and doors occupy removed, plus **lamps, planters, a welcoming crowd** and the logo **inlaid in the pavement**. All arithmetic, no RNG. New `src/render/finale.ts` owns the painting (it has no business inside the host class — `Game.drawFinale` is now three lines): dithered band seams, pixel mullions and floor courses, three flat body bands instead of a gradient, warm pane cycles, doorway light spill onto the plaza, wet-pavement reflections, the plaza drawn with the level's own brightest paver material (`drawTileRect(5)`) so the finish looks like the same world finally finished, and drifting embers from the door light as the only free-floating motion — every animated element gated on `reduced`. Tests: `finaleScene.test.ts` rewritten to 7 cases (crown/mast/beacon stack and share the tower's centre line; doors on the ground line, inside the footprint, with the win trigger in their span; panes on the facade and clear of sign/doors; sky bands tile 0→horizon exactly; furniture on the ground line, medallion below the walking line, skyline under the tower; fresh deterministic snapshot; 1×/2× invariance) → **225 tests (32 files)**; typecheck + lint + build + build:site + validate:levels green; budget 80.4 KB of 90 KB (site 41.0 KB gzip). Files added: `src/render/finale.ts`. Changed: `src/core/{finaleScene.ts,finaleScene.test.ts,Game.ts}`. Not verified: rendered pixels — no canvas engine here, so composition was checked as geometry (overlaps, bounds, ground-line contacts) rather than looked at.

- **Finale (screen 5) second pass — this time actually looking at it (user: "still not up to the mark").** The previous rebuild was composed arithmetically, and rasterising it (see the harness above) showed three defects that no amount of code reading would have caught. (1) **The banded sun was never visible in a single frame ever shipped.** It sat at r=126 centred on a 320px-wide tower and was painted *before* it, so it was geometrically inside the tower rect — the nicest element in the scene was drawing 100% occluded. It is now r=180 raised to clear the crown by ~110px, so the tower silhouettes against it (which is also why the tower is now rim-lit on *both* edges — the light is behind it — and everything to its left catches the dawn on its right edge). (2) **The tower was 320×280 — wider than tall, which reads as a block, not a landmark** — and it occupied the right 25% with 69% of the frame bare. The facade is now 320×440 (`levels.json` screen 5 → `gy4,h11`, root mirrored) and the empty middle carries a new mid-ground layer: five **campus blocks** stepping up left→right towards the tower, warm lit ground floors, and an orange sign band on the three nearest so the ANSR campus separates from the anonymous market skyline behind it. (3) **The "skyline" alternated 64/117/66/119px** — the `(i*53)%104` term made a mechanical sawtooth across the whole frame; it now uses mixed hash terms, and a test rejects zigzag. Also new: a **campus entry gate** at the spawn end carrying "ANSR TECH PARK" (header clears a full jump), a chevron **path** inlaid in the plaza pointing at the doors, the medallion moved from x=435 (alone in an empty plaza) to directly in front of the entrance, and "GO LIVE" over the doors instead of repeating TECH PARK. Painting fixes, each one from looking at a render: panes were warm-at-0.3-alpha over teal = **muddy olive, and every single one lit** (a spreadsheet) → nearly-opaque cream with ~30% dark glass; sky stops warmed and brightened so the payoff stops reading as **midnight** (top stays dark — the win overlay's copy lives there); the plaza is no longer `drawTileRect(5)` but its own big calm slabs (the shipped 40px bricks at 5% speckle are tuned to make a *platform* pop and across the full ground band shouted over the tower — same hue family, so "the same world finally finished" survives); the value path took **three attempts** (translucent orange on cyan → grey; opaque jointed → a chocolate slab dragging the eye sideways; now a shallow channel with warm chevrons); the **welcome crowd was invisible** at #0B3B45 against a dark tower base → near-black silhouettes with a doorway rim light, standing 12px in front of the walking line so they cut against the bright pavers, two heights, some waving; the beacon needed a white-hot core to survive against the orange sun now behind it; the doorway interior is brighter with a silhouetted reception desk. Verified by eye at t=3.2 and frozen (`reduced=true`), plus the arrival frame with the hero at the win trigger — he lands framed in the lit doorway under GO LIVE. Tests: 5 new/rewritten cases in `finaleScene.test.ts` — the sun's dome must clear the crown and be wider than the tower (the exact regression), the campus must ramp and stay clear of the hero, the gate must clear a jump and the path must end at the doors, furniture must clear all three Growth Points, the skyline must not zigzag — plus one that asserts the layout's `DEFAULT_TOWER` still matches the facade in `levels.json` (they had silently disagreed for a whole pass, and since `Game` calls `finaleLayout()` with no argument the data was decorative). **229 tests (32 files)**; typecheck + lint + build + build:site + validate:levels green; ESM 44.66 KB / IIFE 40.19 KB / site 42.18 KB gzip; budget gate **82.9 KB of 90 KB**. Files changed: `src/core/{finaleScene.ts,finaleScene.test.ts}`, `src/render/finale.ts`, `src/data/levels.json` (+ root mirror).

- **Custom 404 page (user-reported: the Navigator buttons 404).** Both Navigator routes — "Skip to the Navigator" on the title screen and every capability row on the closing receipt — deep-link `navigatorUrl`, which defaults to `/gcc-opportunity-navigator`. The deployed site is a static build (`dist-site/`: `index.html` + one JS bundle), so that path matches nothing and the host answered with its own raw 404. The most valuable click in the game ended on a stranger's error page. Fixed by owning the page: new `src/ui/NotFoundPage.ts` renders the game's own screen and new `scripts/build-404.ts` writes it to `dist-site/404.html` (`npm run build:404`, chained into `build:site`) — every static host serves that filename for unmatched routes. Two constraints drove the design. (1) **Self-contained**: a 404 answers *any* path, including deep ones, where a relative asset URL resolves somewhere else entirely — so the page has no script, no `<link>`, no image file. It inlines the game's real stylesheet (`CSS`, run through the project's own `minifyCssLiteral`) and builds the lockup + headlines with the real generators (`createBrandLockup`, `createPixelSvg`), so the dither wash, the scanlines, the NES button, the 5×7 bitmap font and the ANSR sunburst are the game's and cannot drift from it. 40 KB raw / 9.5 KB gzip, zero JS. (2) **Renders at every viewport shape.** One full-frame SVG cannot: fitting it leaves gaps beside the ground on a wide window, filling it zooms into the middle on a phone. So the sky is a hard-stop CSS gradient (bands that stretch without distorting a silhouette) and the world is a bottom-anchored SVG strip (1280×360) scaled by width, with a portrait rule that scales it by height and crops the right instead. **Rasterised and looked at** (harness in `/tmp/brrender`, same approach as the finale pass) at 1280×720, 390×844 and 1600×420, which caught three things invisible in the code: the sky authored at the levels' values rendered as a dead black rectangle under the 58%-effective wash (bands are now much brighter, `#012A35`→`#149BB3`, still ≈10:1 behind white text); the barrier as light stripes on a dark board dissolved into four loose grey squares at the 4px dither (inverted to a solid bright board with dark stripes); and the hero at in-game scale 3 was a speck lost among buildings (scale 5, plus a `clear` span that empties both skyline ranks around him so he and the barrier silhouette against sky). The hero + barrier sit in the left third precisely because the portrait rule crops the right. Copy is new `COPY.notFound` (figure `404`, headline "Off the map.", one primary route home — no dead end, and orange stays on the CTA only). `HERO_IDLE` newly exported from `sprites.ts` so the page can paint the hero as SVG rects (tree-shaken from the game bundle: gate is unchanged at **82.9 KB of 90 KB**). Tests: `src/ui/notFound.test.ts` (6 — no scripts/links/images and exactly one href, a route home incl. a custom `homeHref`, prose for assistive tech with every SVG decorative and exactly one landmark, the real logo path in logo orange, rect-only path data with something standing exactly on the ground line and the group in the left third, byte-identical output across builds). Green: typecheck + lint + **235 tests (33 files)** + build + build:site + validate:levels; ESM 44.66 KB / IIFE 40.19 KB gzip. Files added: `src/ui/NotFoundPage.ts`, `src/ui/notFound.test.ts`, `scripts/build-404.ts`. Changed: `src/data/copy.ts`, `src/render/sprites.ts`, `package.json`, `README.md`. **Still open for the owner:** this only makes the dead end graceful. The actual fix is pointing `navigatorUrl` at the real GCC Opportunity Navigator URL (currently a placeholder path in `main.ts` and `DEFAULT_OPTIONS`), or adding a Vercel rewrite from `/gcc-opportunity-navigator` to it. Not verified: the DOM/CSS layout of the finished page — there is no browser layout engine here, so the artwork was rasterised and inspected but the type/spacing over it was reasoned from the emitted CSS; `npx serve dist-site` (or the deploy preview) is the way to eyeball it.

- **HUD plaques made 8-bit (user: "the two cards, top-left stage and top-right time to market, are not 8-bit style").** Correct — they were the last web-native surface in the game. Both were Moderat/system-sans text (tabular mono for the months figure, `letter-spacing`, `text-transform`) on a card with a **1px hairline border at 28% alpha, an 82%-alpha fill and a soft `0 3px 0` drop shadow** — three devices 8-bit hardware could not produce, sitting directly on the pixel art. Fixed on both axes. (1) **Type**: every HUD label and number is now drawn from the *same* 5×7 glyph data the canvas uses, via `PixelType` (`sizePixels` + `paint` in `Hud.ts`), so the HUD, the world signage and the overlay headlines are one typeface. The stage plaque became a stacked arcade readout (`STAGE` caption over the place name) to mirror the clock's caption-over-figure structure, and the months figure is **zero-padded to two digits** — arcade convention, and it stops the right-anchored plaque resizing when the count crosses ten. The quick-wins line-graph SVG (2.5px round-capped strokes) was replaced by a 3-bar pixel chart matching the Growth Point sprite. (2) **Plaque**: solid `#00161D`, square, 3px light/dark inner bevel + hard 3px rail — the NES treatment the buttons already use; the clock keeps an orange rail (it is the stake) and the capability chip a warm orange one. The delay nudge went from an eased `scale(1.08)` + border fade to a 4-frame `steps(1, end)` flash with whole-pixel hops.
  Three things the switch forced, each a real finding rather than styling: (a) sizing pixel art with `createPixelSvg`'s own `unit` mode caps at `min(96%, …)`, which is **circular** inside a shrink-wrapped plaque (panel width ← glyph width ← panel width), so `Hud.ts` sizes in frame units only (`--beam-run-u`, i.e. cqw against the stage) and `.beam-run__hud .beam-run__pixels` drops the shared `max-width: 100%`; (b) the HUD was being handed `sim.screenLabel`, whose finale value is the title card's framing line "Arrival — ANSR Tech Park" — 24 characters of bitmap type that ran into the clock, so the plaque now takes `sim.screen.name` ("ANSR Tech Park") while the title card still shows the full line on entry; (c) the two top plaques are anchored to opposite corners of one row, and **glyph floors made them collide below ~377px** (the old web-type HUD collided too, from ~348px — a pre-existing bug at 320px/Fold widths). Each `PixelSpec` therefore carries a `maxShare` (% of frame) alongside `unit/minPx/maxPx`, so below that width the glyphs shrink gracefully instead of overlapping; measured totals now 304px @320, 370px @390, 502px @1280. Portrait's second HUD row moved from +52px to +76px to clear the taller stacked plaques. New copy key `COPY.hud.stageLabel`.
  **Verified by rasterising it** (harness in `/tmp/brrender`, `hud.mts`): a pixel-accurate mock of all four plaques over real level backdrops at 1280/390/320, using the real glyph data and the real spec numbers — the composition, the caption/figure hierarchy and the phone legibility were looked at, not reasoned about. Tests: +4 in `ui.test.ts` (bitmap art present and decorative with `crispEdges` and frame-unit sizing on both top plaques while the prose survives in `textContent`; the months artwork is padded and its SVG width identical at 7 and 18 while the accessible value stays "7"; the plaque carries the bevel and the stepped bump; and an arithmetic guard that the top *and* bottom plaque pairs fit side by side at 280/320/360/390/430/560/768/1280px using the longest level name and the longest capability line) → **239 tests (33 files)**; typecheck + lint + build + build:site + validate:levels green; ESM 45.4 KB / IIFE 40.9 KB / site 43.0 KB gzip; budget gate **84.2 KB of 90 KB**. Files changed: `src/ui/{Hud.ts,styles.ts,ui.test.ts}`, `src/core/Game.ts`, `src/data/copy.ts`. Not verified: the browser's own layout of the plaques (no layout engine here) — widths/heights were computed from the emitted CSS and confirmed against the raster; and at non-integer glyph sizes (e.g. 2.56px per authored pixel at 1280) `crispEdges` will snap some strokes a pixel wider than others, exactly as it already does on the overlay headlines.

- **Button labels made 8-bit (user: "the buttons text in the first page and the last page also don't seem 8 bit").** The caps already had the NES treatment (square, 4px bevel, dark rail, 3px press) but their *labels* were still `font: inherit` — Moderat/system-sans at `font-weight: 700`, `text-transform: uppercase`, `letter-spacing: 0.08em` — so the last web-native type on the title and receipt screens was sitting inside the most 8-bit-looking element. Every `.beam-run__btn` label is now bitmap artwork from the same 5×7 glyph data as the headlines and the HUD.
  New in `PixelType.ts`, so the three places that build caps cannot drift: `setPixelButtonLabel(el, text, variant)` (hidden prose span + wrapped pixel SVG, used by `Overlays.btn`, the win CTA's copy swap, `AssistMenu`'s Done and the 404 page's home link) and `wrapPixelLabel(text, maxChars = 26)`. Wrapping is computed, not hand-authored per button: "Plan your real journey → GCC Opportunity Navigator" is 49 characters and cannot be one line of bitmap type at any readable size, and hard-coding the break points per call site would break silently on a copy change. `BUTTON_TYPE` sets the primary cap one step larger (unit 0.19 vs 0.16) — that is where the emphasis from the deleted `font-size: 1.12em` on the title-screen CTA now comes from — with dark `#00242E` glyphs and *no* drop shadow on the orange fill (a light halo under dark type only softens edges whose point is that they are hard), and light glyphs with a hard dark shadow on ghost/default.
  Also generalised the sizing fix from the HUD pass: `PixelTextOptions` gained `maxShare` (ceiling as a % of the play frame, replacing the default `min(96%, …)` cap), because a cap that shrink-wraps its label can't be sized by a percentage of itself, and because the widest wrapped CTA line (25 chars) has a floor width that alone would overflow a 390px frame — at 70% of frame it lands at 273px there and 362px at 1280 instead. `Hud.ts` now routes its own specs through the shared implementation rather than duplicating the clamp. CSS: `.beam-run__btn` became an `inline-flex` centring box, lost `text-transform`/`letter-spacing`/`font-weight` and the two now-dead `font-size` rules (title-screen CTA and the phone override), and its inner pixel art drops `max-width: 100%` and takes `pointer-events: none`.
  **Verified by rasterising it** (`/tmp/brrender/btn.mts`): the start and win action rows over the real attract scene at 1280 and 390, using the real spec numbers and the real wrap output — looked at, and the CTA's two lines centre and fit with room at both sizes. Tests: +1 in `ui.test.ts` (across start/win/summary/pause every `.beam-run__btn` carries decorative bitmap art plus a hidden span equal to its `textContent`, exactly two child nodes, frame-unit sizing and no percentage; the long CTA wraps to ≤26-char lines with the arrow folded to `>`; "Start" stays one line) → **240 tests (33 files)**; typecheck + lint + build + build:site + validate:levels green; ESM 45.7 KB / IIFE 41.1 KB gzip; budget gate 84.7 KB of 90 KB. Files changed: `src/ui/{PixelType.ts,Overlays.ts,AssistMenu.ts,NotFoundPage.ts,Hud.ts,styles.ts,ui.test.ts}`.
  **Deliberately left in web type** (say the word and they convert): the supporting prose and data on the end screens — the two attributed reference lines, the comparison-bar labels, the receipt's four capability rows (a three-column product/stage/saving list) and the quick-wins line. Chrome is bitmap (headings, figures, HUD, caps); sentences and tabular facts stay in clean type because 5×7 glyphs have no lower case, no real punctuation and no proportional spacing, which is what makes a paragraph hard to read.

- **End screens fully 8-bit (owner took the option offered in the previous pass).** Everything on the win screen and the mid-run receipt is now set in the 5×7 font: the "You went live in" caption and the "months" unit, the three comparison-bar labels and their numbers, both attributed reference lines, the clean-run line, the receipt title/hint/quick-wins line, and all four capability rows (product, stage, months saved). The assist dialog's heading joined too (new exported `PIXEL_TITLE`, so titles can't drift); its intro and checkbox labels stay web type on purpose — real form controls, real sentences — as do the 404 page's body paragraph and the brand lockup's "ANSRcade" (brand typography is an owner call, not a style fix). New `setPixelText(el, text, opts)` in `PixelType.ts` does the sr-span + wrapped-artwork pattern generically; `PX_TYPE` gained eight end-screen roles (caption/body/unitText/clockStrong/rowStrong/rowText/barLabel/barValue), each with `maxShare` because most of them sit in grid cells or shrink-wrapping flex boxes.
  **The receipt row's ✓/○ were font characters** (`content: '\\2713'`) — i.e. drawn by whatever typeface the host has, which is exactly the mismatch this pass exists to remove. They are now drawn glyphs: a hollow pixel box for a stage the run never reached, a pixel check for one ANSR handled (shape carries it; the orange is a bonus). The four-column desktop row layout is gone — one layout everywhere: mark | product + saving | stage underneath. Bitmap type is wider than the web type it replaced and the old row needed ~550px, more than the receipt now gets.
  **Found while measuring: the win screen has never fitted a 720px frame.** Computed against the real CSS gaps, the stacked content came to ~845px *before* this pass and ~960px after — the overlay scrolls (`overflow-y: auto`), so the CTA, the entire point of the screen, has been sitting below the fold on a 1280×720 frame. Rather than shrink everything to squeeze in, both end screens now split into **two columns** at frames ≥ 900px (`@container (min-width: 900px)`; new `Overlays.columns()`, classes `beam-run__cols/__col`): the result on the left (caption, figure, meters, references), the receipt and its routes on the right, with the stack widening to 1060px. Measured 641px of 720 at 1280×720 and 566 of 576 at 1024×576, with every widest element (CTA cap 437px, receipt row 388px, ref line 405px) inside its 514px column. Below 900px it stays one column and still scrolls on short frames, as before. Body/caption lines wrap at 34 characters rather than a button's 26 — "ANSR clients average 11 months." is 31 and was breaking in two for no reason (its 316px floor still clears a 390px frame).
  **Two copy fixes the raster exposed**, invisible in code: the font has no apostrophe, so `You matched ANSR's benchmark.` drew as "ANSRS" (now "You matched the ANSR benchmark."), and the receipt hint orphaned a word onto a second line (now "Pick one to talk about.", one line). A test guards the whole class: every string that gets drawn as pixels must contain no apostrophe.
  **Verified by rasterising it** (`/tmp/brrender/win.mts` paints the screen with the real specs, wraps and CSS gaps; `/tmp/brrender/winfit.mts` is the height budget) at 1280×720 two-column and 390×844 stacked — both fit, and the two copy defects above were caught this way. The emitted stylesheet plus its minified form were parsed with esbuild to confirm the new `@container` group survives minification. Tests: +4 in `ui.test.ts` (every end-screen readout is decorative `crispEdges` artwork whose hidden span equals its `textContent`, and no stray text nodes remain in the content column; the row mark is a drawn glyph with different geometry per state, one orange; both end screens split into two columns with the receipt and actions together in the aside; the apostrophe guard) → **244 tests (33 files)**; typecheck + lint + build + build:site + validate:levels green; ESM 46.1 KB / IIFE 41.5 KB gzip; budget gate 85.5 KB of 90 KB. Files changed: `src/ui/{PixelType.ts,Overlays.ts,AssistMenu.ts,styles.ts,ui.test.ts}`, `src/data/copy.ts`. Not verified: the browser's own layout (no layout engine here) — heights and column fits are arithmetic from the emitted CSS, confirmed against the raster; `npm run dev` is the way to eyeball the real thing.

- **Win screen symmetry (user sent a screenshot: "the last page isn't looking symmetrical").** The screenshot showed the real fault, which no amount of code reading would have: **the closing months figure was rendering at about a third of its intended size** — "19" was the same weight as the word "MONTHS" beside it, so the hero of the screen had no hierarchy and the left column looked collapsed against the receipt. Cause: `PX_TYPE.figure` had no `maxShare`, so it fell back to `min(96%, …)`, and it lives in `.beam-run__months-value`, which shrink-wraps its contents. A percentage there has nothing definite to resolve against, so the browser used the SVG's own intrinsic width (12 cells × the default 4px scale = 48px) instead of the intended `clamp` — 46px rendered where ~110px was specified. Measured against the screenshot: the caption beside it came out at exactly its computed 198px, which is what pinned the fault to the figure alone. Same latent bug in `PIXEL_TITLE` (headings are flex items in a centred column, i.e. also shrink-wrapped) where it cost ~10%, and in the start screen's stake lines. All four specs now carry `maxShare` (figure 30, title 72, stakeText 80, stakeFigure 60). **Any pixel spec without `maxShare` is a bug waiting to happen** — the only safe places for the percentage cap are definite-width blocks.
  Composition, on top of that: the **buttons moved out of the right column** to span both, centred (`Overlays.columns` no longer takes the actions) — a CTA tucked under the right half was what made the screen lean, and full width it also has room to sit *beside* "Play again" instead of wrapping under it. With the actions gone the two columns are within ~25px of each other, so they are top-aligned rather than each centred in the row, which puts both opening captions ("You went live in" / "What got you here") on one line. The receipt's header, hint and quick-wins line are centred on their column now, mirroring the left column, so the screen reads on a single centre axis. Measured 611px of 720 at 1280×720 and 541 of 585 at the user's frame.
  **Verified by rasterising it** at 1280×720 and at the screenshot's own 1023×585 (`/tmp/brrender/win.mts`). Tests: +1 in `ui.test.ts` (the closing figure is sized in frame units with no percentage, and its per-glyph frame share is more than double the unit label's — the assertion that would have caught the original defect) and the two-column test now asserts the actions are a direct child of the stack, not of a column → **245 tests (33 files)**; typecheck + lint + build + build:site + validate:levels green; ESM 46.1 KB / IIFE 41.5 KB gzip; budget gate 85.5 KB of 90 KB. Files changed: `src/ui/{PixelType.ts,Overlays.ts,styles.ts,ui.test.ts}`.

- **Navigator buttons went nowhere / the 404 page never appeared (user-reported).** Two separate faults, both on the path between the click and the page. (1) `Game.handleCta` navigated only when `!__DEV__` — on the dev server (`__DEV__` is `mode !== 'production'`) it logged `[BeamRun] CTA → …` to the console and returned, so the title screen's "Skip to the Navigator" and every capability row on the receipt pressed (the NES bevel flips, so the button *felt* alive) and then did nothing. That is exactly the reported symptom, and it also made the custom 404 screen unreachable while developing. The gate is gone: the dev log stays, but `window.location.href` is always assigned. (2) Even after navigating, locally you would still not have seen the 404 screen: `dist-site/404.html` is a static-host convention, and Vite's dev/preview servers apply an SPA history fallback that answers every extensionless path with `index.html` — so `/gcc-opportunity-navigator` silently re-served the game. New `scripts/not-found-plugin.ts` registers a middleware from `configureServer`/`configurePreviewServer` (not deferred, so it runs ahead of Vite's fallback) that renders `src/ui/NotFoundPage.ts` through the same jsdom + `minifyCssLiteral` path as `scripts/build-404.ts`, cached per process, and answers a real `404` — what you see locally is byte-identical to the emitted file (42114 bytes both ways). It only intercepts `GET` requests whose `Accept` includes `text/html`, and never `/`, Vite internals (`/@…`, `/src/…`, `/node_modules/…`) or anything with a file extension, so assets and HMR are untouched; `apply: env.command === 'serve'` keeps it out of both builds. Wired into `vite.config.ts` and `vite.config.site.ts`, and `npm run preview` now runs against the site config (it previously previewed the *library* build, which has no index.html at all, so preview was broken independently). Verified live with curl, not reasoned about: dev server `/gcc-opportunity-navigator?utm_source=beam_run` → `404`, 42114 bytes, title "Page not found — ANSRcade: The GCC Game", zero `script` occurrences, while `/` still serves the game; preview server the same, with `/404.html` → 200 and asset requests falling through. Green: typecheck + lint + **245 tests (33 files)** + build + build:site + validate:levels; ESM 46.1 KB / IIFE 41.5 KB gzip; budget gate 85.5 KB of 90 KB. Files added: `scripts/not-found-plugin.ts`. Changed: `src/core/Game.ts`, `vite.config.ts`, `vite.config.site.ts`, `package.json`. **Still the owner's call (unchanged from the 404 pass):** this makes the dead end graceful, it does not make the CTA land anywhere useful — `navigatorUrl` is still the placeholder `/gcc-opportunity-navigator` in `main.ts` and `DEFAULT_OPTIONS`. Point it at the real GCC Opportunity Navigator URL, or add a Vercel rewrite, and the 404 stops being the destination.
- **Lives, the delay log, and the badge on every screen (owner-requested model change; supersedes the "no lives, no game over" model of §4 in HANDOFF).** The owner asked for four things in one pass: three lives with the stage restarting on a death and the title screen after the third; a page that says take the ANSR powerup to cross hurdles safely; a running log of every death hanging from the top-right, adding +2 months each, totalled at the end with the "take the badge and these months never happen" line; the bonus Growth Points gone; and the ANSR badge on *every* screen, floating along a straight vertical line near the start of it, at a readable speed. All of it landed; the notes worth keeping are the ones where the existing design fought back.

  **Lives are a state, not a counter.** `setback()` used to book months and relocate the player inside `PLAYING` with no state change — the whole point of the old model. It now spends a life, pushes a `SetbackLogEntry`, and transitions to a new `LIFE_LOST` state; `continueAfterLifeLost()` reloads *the same screen* (`loadScreen(this._screenId)`, never `_screenId + 1` and never 0) so a death costs a life and two months but never progress. On the last life it resets the attempt and hands back to `START`. `GAME_TRANSITIONS` gained `PLAYING → LIFE_LOST` and `LIFE_LOST → TITLE_CARD | START`, and `StateMachine.test.ts` now asserts `LIFE_LOST` cannot reach `PLAYING` directly — every retry goes through the stage's title card, which is what makes the restart legible. The knockback-to-safe-ground machinery (`safeHistory`, `knockbackSpot`) is still there but now serves only `forceSetback('fall')` when the fall is *not* chargeable (invulnerable, or the "no setbacks" assist): a player falling out of the world has to be put somewhere, and it is not fair to charge them for it. `TRANSITION.SETBACK_HOLD` and `JOURNEY.SETBACK_INVULN` became dead and were deleted.

  **One surface, two jobs, told apart by the lives remaining.** Rather than a life-lost screen *and* a game-over screen, `lifelost` is one overlay repainted per delay. With lives left it is coaching with exactly one instruction — take the floating ANSR badge — and it auto-advances after `LIVES.LOST_HOLD` (2.6s) or on a press after `LOST_SKIP_AFTER` (0.45s). Out of lives it becomes the closing ledger (every obstacle itemised, repeats grouped, a total, then the argument the total is evidence for) and it deliberately does **not** time out: it is a conversion surface, so it waits for a decision and carries both "Back to the start" and the Navigator route. That keeps the one invariant the old model was built around — nobody is ever walled off from the hand-off — while adding the stake the owner wanted. `role="alertdialog"`, and the primary button is always present with only its label changing, so focus always lands on something real.

  **The delay log is a bounded, shared, pure view.** `core/setbackLog.ts` (headless) owns `SetbackLogEntry`, `ledgerRows()` (groups repeats: "OFFER DECLINED x2 +4" is a finding, four identical rows is noise) and `logPanelView()`. The panel hangs from the top of the frame and grows *downwards*, so it cannot be unbounded: `LIVES.LOG_VISIBLE_ROWS` (4) newest rows, everything older collapsed into one roll-up line, and the total always counts every entry. The HUD and the end screens both read through those two functions, so they cannot disagree about the total. Its prose is one sentence (`COPY.hud.logSummary`) rather than a list of fragments — a screen reader walking a growing table of "+2" cells learns nothing, whereas the running total is the finding. The log is not orange: orange is the value accent and a ledger of avoidable months is the opposite of value, so only the total is warmed.

  **The HUD had to stop anchoring plaques to corners.** Four independently positioned plaques worked while all four had fixed heights. The log has no fixed height, so anything sharing a corner with it needed a hand-tuned pixel offset that would be wrong again on the fifth delay (the old portrait rule was literally `+ 76px` with a comment deriving it from the type floors). The HUD is now two absolutely-positioned flex **columns**: left = stage · lives · engaged capability, right = clock · delay log. That deleted the portrait overrides entirely — everything lives in the top band, which is what portrait wanted anyway, and the bottom of the frame stays clear for thumbs. Lives are pips, not a digit and not hearts (no glyph for one): solid block held, hollow outline spent, so the state is carried by **shape** — same rule the hazards follow. `ui/LivesPips.ts` is shared by the plaque and the life-lost screen so the two cannot drift; the painter sets geometry only, because the HUD sizes in frame units against a shrink-wrapping plaque while the overlay sizes against its column.

  **The badge moving is a rules change, not decoration, and that drove the design.** `world/badgeFloat.ts` is a pure function of (anchor, simulation time): `badgeCenter`, `badgeBoxAt`, `badgeLowestBox`. Both the simulation's hitbox and the renderer's sprite read it with the *same* clock, because deriving it twice is exactly how you ship a pickup you can see but not collect. It rides a single per-screen accumulator (`screenClock`, which also became the clear time reported to analytics — there were two accumulators counting the same seconds), so `step()` stays replayable with no `Math.random()` and no wall clock. It is therefore **not** frozen under `prefers-reduced-motion`: freezing it would move the collision box, which is a rules change dressed as a comfort setting. The glow, the label and the travel rail still honour the preference. Band: ±48px around `gy 12` over a 3.2s cycle (~60 px/s average) — authored so the bottom of the swing overlaps a player standing on the ground band, which means a good pass walks into it and a mistimed pass needs a hop. Missable on purpose; unmissable would make the life-lost screen's instruction meaningless.

  **Moving the badge to the front of the screen invalidated the level grammar, the validator and a piece of the art.** The old structure was: hazards on *both* sides of a mid-screen badge, struggle zone → badge → relief zone, enforced by `validateNarrative`. The owner's model is take the badge *then* cross the hurdles, so the badge is now the first thing on the path (gx 4, before every obstacle) and there is no "before" half left. Three consequences: (1) the validator's rule inverted — it now fails if any obstacle sits at or before the badge (the instruction would be a lie) and still fails if none sit beyond it (taking the badge would prove nothing); (2) `zone` labels in `levels.json` stopped describing a position and are now documented as authoring intent, with the geometry assertions on them deleted — they would have failed every screen for being correct; (3) `Game.drawZoneRead` was a gateway-and-dimming treatment that would have drawn a triumphal arch three tiles from the spawn and dimmed almost nothing. It is now just the "ANSR is with you" read: once engaged, the ground from the badge column onwards is capped with a bright walkable edge and labelled. **Rasterising caught a defect in that immediately** — a single full-width `fillRect` drew a bright line hanging in mid-air across screen 1's pit, so the cap is now drawn per solid (and per laid bridge), which also means the platforms get it, which is right.

  Badges on all six screens needed a badge type for the two with nothing to defend against, hence `SAFE_PASSAGE` — no capability, no product name, excluded from the receipt, and the validator now allows it to repeat while still demanding each of the four real capabilities appear exactly once *and* rejecting `SAFE_PASSAGE` on any hazard screen (a badge that does nothing where something is needed). Badge reachability is proved against `badgeLowestBox` — the easiest phase to intercept, so if the BFS cannot reach it there it cannot be taken at all — plus a new structural check that the whole band stays inside the frame (an anchor can be in bounds while the swing is not).

  **Growth Points are gone end to end**: `points` out of both `levels.json` copies, `PointPickup`/`Screen.points`, `collectQuickWins`/`_quickWins`/`onQuickWin`, `TOTAL_QUICK_WINS`, the HUD plaque and its chart icon, `drawGrowthPoint` + `POINT_GRID`, the receipt's quick-win line, the validator's bounds and lethal-region checks (`lethalRegions`/`pointBox`), `RUN.KEEP_COLLECTED_ON_SETBACK`, and `quick_wins` from `game_completed`. The receipt slot they occupied now carries the delay summary, which is the number a Navigator conversation actually starts from. Analytics gained `lives_left` on `setback_incurred` and a new `game_over` event (with `game_completed` it gives the completion rate, and its `screen_id` names the stage that is ending attempts); `analytics-events.json` was rewritten where it asserted "there are no lives and no game over".

  **The budget gate went over, and chasing it found a bug that had been costing 5 KB.** The feature took the gate from 85.5 KB to 90.8 KB of 90. A dead-code sweep (unused copy, two dead tuning knobs, three near-identical `PX_TYPE` specs folded into the existing ones, the merged clocks, trimmed view models) plus two real cuts — `DebugOverlay` was constructed eagerly so the class shipped to every host despite every *use* being behind `__DEV__`, and the 404 page's copy lived in the shared `COPY` object so its strings shipped inside the game bundle even though the page never does (now `data/notFoundCopy.ts`) — got it to 90.0, which still failed on rounding. The real find came from measuring: running terser over the *shipped* `beam-run.esm.js` dropped it 176 KB → 137 KB raw, 48.5 → 43.4 KB gzipped. `minifyEsOutput()` existed for exactly this and *was running* (logged: terser returned 135 KB), but it was a `renderChunk` hook, and Vite's `vite:esbuild-transpile` runs in the **post** phase after every normal plugin's renderChunk and re-printed the chunk for the build target. Mangled identifiers survived that — which is why the output looked minified at a glance and the regression hid for many passes — while every byte of whitespace came back. Moved to `generateBundle` with `enforce: 'post'` (the last hook to see the chunk, so nothing can re-print it) and chained onto Vite's existing map so stack traces still resolve to TypeScript. Gate: **85.2 KB of 90** — better than before this feature, with the feature in. `budget.test.mjs` now asserts the two bundles stay within 10% of each other and that neither is beautified, because "the es build is much larger than the umd build" is the signature of this bug and it is cheap to fail loudly on.

  Two copy defects were caught by dumping the composed `textContent` of both variants rather than by reading the code: the out-of-lives screen stated the same months total twice (headline "Months added by delays: 6" above a ledger total row saying the same thing), now "3 delays cost 6 months"; and the HUD plaque read "Lives: 1 of 3 lives left", because the full sentence was reused under a caption that already said "Lives" (`COPY.hud.livesValue` vs `COPY.hud.lives`).

  Tests: new `src/core/setbackLog.test.ts` (10 — obstacle naming from the copy deck, totals, grouping, the panel's roll-up bound, and for the float: x never moves, the band and its period, purity of (anchor, t), the lowest box really being the lowest, and that the band dips into a standing player's box) plus new cases across `Simulation.test.ts` (a delay spends a life and writes a log line; the retry restarts the same stage with the badge available and no refund; auto-advance; the last life returning to a clean title screen; grouping; and the badge being collected where it *is*, not at its anchor — the assertion that would catch a renderer/sim disagreement), `Simulation.flow.test.ts`, `StateMachine.test.ts`, `ui.test.ts` (lives pips by shape, the log panel's hide/itemise/roll-up, both life-lost variants, the receipt's delay line, the two corner stacks, and a guard that every readout on the new screen is sized in frame units — the `maxShare` trap) and the four screen tests. **264 tests (34 files)**; typecheck + lint + build + build:site + validate:levels green; ESM 43.49 KB / IIFE 43.73 KB gzip; budget gate **85.2 KB of 90 KB**. Files added: `src/world/badgeFloat.ts`, `src/core/setbackLog.ts`(+test), `src/ui/LivesPips.ts`, `src/data/notFoundCopy.ts`. Changed: `src/core/{Simulation.ts,gameStates.ts,Game.ts}`, `src/world/{Screen.ts,Powerups.ts}`, `src/ui/{Hud.ts,Overlays.ts,styles.ts,NotFoundPage.ts}`, `src/render/sprites.ts`, `src/data/{copy.ts,levels.ts,levels.json,tuning.config.ts}`, `scripts/{validate-levels.ts,budget.test.mjs}`, `vite.config.ts`, `analytics-events.json`, root `levels.json` + `tuning.config.ts` mirrors, `src/test/helpers.ts`. **Open for the owner:** (1) the four powerup *effects* are unchanged — the owner said the per-stage effect would be specified later, so screens 1–4 keep their existing capability behaviour and the two new `SAFE_PASSAGE` badges deliberately do nothing yet; (2) screen 1 is now the one stage that is *impossible* without its badge (the 7-tile pit exceeds max jump and only the 1Wrk bridge crosses it), so a player who walks past a missable badge three times will game-over there — the badge band was authored to dip into the walking line to make that unlikely, and the life-lost screen names the fix, but if telemetry shows attempts ending on screen 1 the answer is to make that one badge unmissable rather than to soften the pit; (3) the specs in the parent folder (`01_Game_Design_Document.md` §2/§6/§7 and `07_Analytics_and_Lead_Handoff.md`) still describe the no-lives model and now disagree with the build — `analytics-events.json` and HANDOFF §4 have been updated, the prose docs have not.

- **Setup Delays rebuilt: DENIED stamps replace the red-tape sludge (owner-specified, incl. the badge's effect).** The owner replaced the obstacles of screen 1 outright and, for the first time, specified a per-stage badge *effect* (HANDOFF §7.3): "two DENIED rubber stamps that slam down from the top of the screen, then just a small wall, then two more doing the same motion, alternating rapid fire so there is barely a beat between one lifting and the next dropping. The badge slows both stamps way down, opening wide safe windows. When the power is active the character is surrounded by an ANSR orange bubble with a soft pulsing outline, and even if a stamp touches him it cannot press him — it returns from there. Without the powerup he gets flat and dies."
  **Hazard:** new `src/world/Hazards/Stamps.ts` (`stamps` hazard family). Each stamp owns a *local* cycle clock seeded from an authored `phase` — not a shared `t` + phase — because an assisted press has to abort mid-stroke, which is per-stamp state. One cycle is parked → wind-up → slam (`DROP_TIME` 0.14, eased `q²` so it slams rather than descends) → held on the floor (`HOLD_TIME` 0.34) → lift (`LIFT_TIME` 0.24) → beat. `press` 0..1 maps the head's bottom edge from `REST_BOTTOM` 64 (hanging into the top of the frame, so four stamps are visibly waiting) to the ground band at 600. Assisted, the whole mechanism runs at `ASSIST_TIME_SCALE` 0.26 and a press that overlaps the player *aborts*: `abortE`/`abortPress` are latched and the head retracts from exactly where it touched over `RETRACT_TIME`, cleared on the next wrap. New optional `Hazard.shieldsPlayer` + `Simulation.shielded` so the host only draws the bubble where contact is genuinely harmless — a shield visual on screens where help means "the obstacles ahead are cleared" (gates, fire) would promise protection the rules do not give.
  **Two findings that changed the design, both from probes rather than from reading the code.** (1) *The stamps needed a telegraph.* A `/tmp` probe drove the stage with 20 reactive policies and **not one cleared it**: the slam is 0.14s, so by the time the head moves you are already under it, and a parked stamp gave no clue how long it would stay parked. Every other hazard here telegraphs (fire glows, spikes mark the landing); this one was unfair rather than hard. Added `WARN_TIME` 0.22s at the end of the cycle — a wind-up that changes no geometry, drawn as a dashed column from the parked head down to the floor plus a brightening print line and chevrons closing on the ink pad. **The cue had to be in the column, not on the head**: a parked stamp hangs mostly above the frame, so a cock-back drawn up there is a tell nobody sees. (2) *`CYCLE` is a measured number, not a feel number.* A stamp column plus the player is 124px, ~0.48s to clear at walk speed, so the fully-safe part of the cycle has to stay comfortably above that. At 1.5s it was 0.56s and the probe still could not clear it; at **1.8s** (safe window 0.86s) a policy that watches a column stamp and goes while it lifts clears the stage in ~28s. The screen is now a reflex test that is *passable* unassisted — which matters, because the assisted read is "walk straight through".
  **Layout** (`levels.json`, both copies): full-width ground + a 2-tile `wall-paperwork` at gx15, stamps at gx **7, 12 | wall | 20, 25** with phases 0/0.5 and 0.25/0.75. Pairs are half a cycle apart, and `DROP+HOLD+LIFT` (0.72) < `CYCLE/2` (0.9) < `DROP+HOLD+LIFT+WARN` (0.94): the presses never overlap, yet the instant one finishes lifting the other is already winding up. 5-tile spacing (not 4) leaves a 104px standing slot between the two hitboxes.
  **Visuals** (rasterised and *looked at* — four defects were invisible in the code): new pure `src/render/stamps.ts` (`drawInkPads` + `drawStamps`, no wall clock, no DOM, so it can be shot on its own). `WIDTH` had to go 76 → **96** because "DENIED" at bitmap scale 2 is ~71px and the D and the D were falling off the face plate onto the frame — the one thing the hazard has to say. The flattened player was invisible *inside* the 88px head, so the guilty stamp now recoils `REVEAL_LIFT` 52px on the life-lost frames, and the squash pose is drawn at scale 4 (88×36) because at scale 3 it read as a smudge. Screen 1's stage sign moved from y70 to y100: parked stamps clipped the S off "SETUP DELAYS". New `SQUASH` hero pose (22×9) — `drawHero` now measures the frame it is drawing instead of assuming the 16×20 idle grid, which is what would have drawn it off-centre and floating. New `drawAnsrBubble` in `sprites.ts` (radial orange field + pulsing 42px ring, drawn *behind* the figure); it holds mid-pulse under `prefers-reduced-motion` rather than vanishing, because the bubble is information, not decoration.
  **`Simulation.setback()` no longer calls `hazard.reset()`.** A retry rebuilds the hazard from scratch in `loadScreen`, so the reset bought nothing — and it wiped the pose the host needs to paint the impact, snapping the stamp back up off the flattened player. `Stamps.struckAt` deliberately survives `reset()` for the same reason (the setback books first, the life-lost frames are painted after).
  **Deletions, all of them consequences.** `Quicksand.ts` + its test (screen 1 was its only user). `Hazard.blocksJump` / `jumpMultAt` and their use in `updatePlaying` — only the sludge implemented them; the lesson they encoded (the 8-tile wade existed because a running jump carries ~172px, and `SLUDGE_JUMP_MULT` existed because hop-chaining crossed it in a third of the walking time) is preserved in the earlier entries. The whole placed-tile mechanism: `BadgeSpec.placesTileAt`, `PlacedTileSpec`, `Powerups.placedTile`/`extraSolids()`, `Game.drawPlacedTile` and the bridge pass in `drawZoneRead`, and the validator's "a PLACE_TILE screen must be *un*completable without the bridge" rule. With the pit gone nothing placed a tile, so `PLACE_TILE`'s verb moved from BUILD to SET UP (`COPY.powers.PLACE_TILE` "Bridge laid" → "Setup stood up"). This also closes the old §7.4 risk: screen 1 is no longer impossible without its badge. `SetbackCause` `'delay'` → `'stamp'` ("SETUP DENIED" / "Setup denied. The paperwork goes back to the start."), mirrored into `analytics-events.json`.
  **Tests:** new `src/world/Hazards/Stamps.test.ts` (14 — travel limits, the flatten, `struckAt` surviving reset, lethal only at the bottom of the stroke and for <45% of the cycle, the wind-up's length/placement/never-while-moving, the pair never both pressing and never both idle, the assisted slow-down, the abort never completing a press, `shieldsPlayer`, the extra-time assist, reset), new `src/render/stamps.test.ts` (6 — nothing drawn wider than the hitbox, **DENIED measured against the plate**, press reaching the ground and parking inside the frame, the wind-up living in the column, ink pads per column, the recoil moving only the guilty stamp) and `src/render/sprites.test.ts` (3 — poses standing on their feet and centred, the squash pose's aspect ratio flipping, the bubble being an orange ring of sane radius). `screen1.test.ts` rewritten (13 — layout, badge-first, alternation, the setback and its cause, the stamp staying pressed for the life-lost frames, the retry, *walking straight in unassisted gets you stamped*, *walking straight through assisted is untouched*, the slow-down, the retraction, the shield not expiring). **280 tests (36 files)**; typecheck + lint + build + build:site + validate:levels green; ESM 44.08 KB / IIFE 44.35 KB gzip; budget gate **86.4 KB of 90 KB**. Files added: `src/world/Hazards/Stamps.ts`(+test), `src/render/stamps.ts`(+test), `src/render/sprites.test.ts`. Changed: `src/core/{Simulation.ts,Game.ts,screen1.test.ts,setbackLog.test.ts}`, `src/world/{types.ts,Powerups.ts}`, `src/render/{sprites.ts,scenery.ts}`, `src/data/{levels.ts,levels.json,tuning.config.ts,copy.ts,data.test.ts}`, `scripts/validate-levels.ts`, root `levels.json` + `tuning.config.ts` + `analytics-events.json` mirrors. Removed: `src/world/Hazards/Quicksand.ts`(+test). **Open for the owner:** the unassisted stage is deliberately punishing — the probe's best policy took ~28s and most died on the first pair. That is the teaching loop working (lose a life, get told to take the badge), but if telemetry shows attempts ending here, lengthen `CYCLE` rather than widening the gaps: the windows are the tunable, the geometry is the argument. The other three screens keep their existing capability behaviour and the two `SAFE_PASSAGE` badges still do nothing, pending the owner's per-screen specs.

- **Setup Delays art pass: a real office stamp, parked in view, and a proper force field (owner feedback).** Three notes from the owner on the pass above: the stamps should look like the rubber stamp on an actual desk rather than a block with a word on it; they should park *just above the middle of the frame* instead of at the ceiling, with no rail or rope holding them up; and the bubble around the player should read as a hazy superpower field, not as a circle. All three, and everything added, in the existing 8-bit language.
  **The stamp is now a sprite grid, not a pile of rectangles.** `render/stamps.ts` carries a 24×32 authored grid (`STAMP`) drawn through `drawPixels` with its own palette — the same idiom as the hero and the badge, which is what makes the silhouette read at this scale: turned knob (18 cells wide, domed, with a grip highlight) → stem → flange → body with a printed index label → a flat rubber die with a lit seam above it. `DENIED` is still set in the 5×7 font on the label, so the game still has exactly one font. Two geometry rules are now enforced by tests rather than by care: the body is **exactly** `HEAD_H` (`STAMP_BODY_ROWS 22 × STAMP_SCALE 4 = 88`) and exactly `WIDTH` (24 cells × 4 = 96), so the picture *is* the hitbox; and the knob/stem sit above the box, because being level with a stamp's handle is not being under its die. The body stays full-width rather than waisted like a real stamp — every cell of inset costs 4px of label, and the label has to carry a 71px word; the profile is carried by the knob instead. The die is deliberately full hitbox width: a narrower die would clip the player with pixels that are not there.
  **`REST_BOTTOM` 64 → 330** (just above the middle of the 720px frame) and the rail is gone. Parking at the ceiling had a knock-on nobody would guess from the code: the *wind-up* had to be drawn on the floor, because the parked stamp was 90% off-frame and a cock-back up there was invisible. With the stamp in view the tell can be on the object — it now cocks back `WARN_LIFT` 14px — and the floor cue became a *second* channel rather than the only one. A test asserts nothing is drawn above the stamp and that its topmost band is narrower than 60% of the hitbox, so a rail cannot creep back in.
  Parking lower also moves the moment of contact: travel fell from 536px to 270px, so the die now reaches a standing player at press **0.837** rather than 0.918. The lethal window is unchanged in duration (~0.39s of the 1.8s cycle) but a strike can now be booked a few frames *before* the press completes — which broke a test asserting the guilty stamp was `pressing` on the life-lost frames. The test now asserts `press > 0.8`, which is what the visual actually needs. **Re-ran the fairness probe** (`REST_BOTTOM` changes the lethal threshold, so it had to be re-proved): still clearable unassisted, and the best policy improved from ~28s to **15.5s**.
  **Floor impressions carry the column read now that nothing hangs overhead.** `drawInkPads` prints an ink-dark smudge with a worn print line, stray flecks, and a ghost of the word `DENIED` at scale 1 — so a stamp column is unmistakable even while its stamp is parked high above it. At the previous alpha the pads were invisible against the level's clay brick; found by rasterising, not by reading the code.
  **The bubble was the one thing on screen that was not 8-bit.** It was a `createRadialGradient` fill plus a smooth `arc()` stroke — a vector circle pasted over pixel art. Rebuilt out of 4px cells in three layers: a **dithered haze** (the 8-bit fake-transparency chequer, the same trick the scene overlays use), a **dashed rim** whose alternation rotates with a `phase` argument and whose upper-left quadrant catches the light the way every 8-bit sphere does, and five **orbiting sparks** just outside the shell. Two iterations were needed and both were visible only in the image: at full-disc density the hero looked like he was standing in sand, so the haze was confined to a band between 0.7r and r with a clear core at 0.5r; and the first rim was so heavy it read as a tyre, fixed by dropping the dim cells to alpha 0.12 so the ring visibly dashes. `pulse` and `phase` both come from the host, so holding them constant freezes the field — which is what `prefers-reduced-motion` should get: a steady shield, not none.
  Also: the retraction cue was two green ticks beside the die, which at 2× read as floating green sticks. It is now an orange lit edge along the die's own face plus two sparks off the corners it was stopped at — the field pushed the stamp back, so the cue belongs to ANSR and to the value accent. And screen 1's stage sign went back to y70 (it had been dropped to y100 only because parked stamps clipped it, which no longer happens).
  **Tests:** `stamps.test.ts` gained "the authored body is exactly the hitbox" and "hangs from nothing — no rail, rope or rod above the stamp", and its wind-up and reveal cases were rewritten to measure the stamp's top edge (with the sprite drawn cell by cell, nothing is a full `WIDTH` rect any more, which is what the old helper keyed off). `sprites.test.ts`'s bubble case became three: built from ≤4px cells and only in the two orange tones, encloses the figure while leaving a hollow core, and is a pure function of `(pulse, phase)`. **284 tests (36 files)**; typecheck + lint + build + build:site + validate:levels green; ESM 44.54 KB / IIFE 44.80 KB gzip; budget gate **87.2 KB of 90 KB**. Changed: `src/render/{stamps.ts,sprites.ts,scenery.ts}` (+ both tests), `src/core/{Game.ts,screen1.test.ts}`, `src/data/tuning.config.ts` + root mirror.

- **Removed the blue line that appeared on the ground when the badge was taken (owner call).** `Game.drawZoneRead` capped the top edge of every solid from the badge column onwards with a 3px `rgba(92, 226, 244, 0.85)` cyan edge, on top of the "ANSR ENGAGED" label. It was built as a "value step at the floor line" back when the badge split each screen into a struggle half and a relief half; with the badge now taken before the obstacles it applied to the whole stage, so picking up a powerup drew a bright blue stripe along the entire floor — read as a surface defect rather than as value. Deleted; the method is now `drawEngagedLabel` and paints only the orange label. Nothing was lost: the in-world "help is active" read is carried by the ANSR bubble on the player and by the engaged-capability chip in the HUD, both of which postdate the cap and both of which are attached to the thing the player is looking at.
  **Checked the two other cyan sources before concluding.** The badge's vertical float rail (`rgba(92, 226, 244, 0.16)`, `drawBadge`) is drawn only while `!powerups.collected`, so it *disappears* on pickup — the opposite of the reported symptom — and it earns its keep by showing the line the pickup travels along, so it stays. `finale.ts` uses the same cyan on screen 5's plaza, which has no badge effect and no hazard. Verified with a `/tmp` raster of every layer the engaged frame paints on screen 1 (background · solids · ink pads · stamps · bubble · hero), scanning the 22 rows around the floor line for bright blue-dominant pixels: **1 stray pixel** (a skyline window), where a line would be hundreds on a single row.
  Also swept two stale comments in `render/scenery.ts` that still justified solid dark signage plaques by "the struggle half of every screen is dimmed by the zone read" — that treatment had already been gone for two passes, and it is exactly the kind of note that sends a future session looking for code that is not there. 284 tests (36 files); gate **87.1 KB of 90 KB**. Changed: `src/core/Game.ts`, `src/render/scenery.ts`.

- **The badge levitates properly now, and it is the ANSR mark (owner call: "the powerup is too easily accessible … it should levitate to and fro just below the ceiling and on the downside only to a level the character can jump and grab, not reachable without jumping … and the powerup should be the ANSR logo, 8-bit, sized appropriately").** Two things changed together: where the pickup travels, and what it looks like.

  **The band.** `POWERUPS.FLOAT_AMPLITUDE` 48 → **155**, `FLOAT_PERIOD` 3.2 → **4.8**, and every screen's badge anchor moved from `gy 12` to **`gy 8`** (centre y=340). The two ends are measured, not chosen:
  · **bottom of the swing** centre 495, box 475–515. A player standing on the ground band occupies 556–600, so the badge clears their head by **41px** and can never be walked into; a full jump lifts 140px, so the hop needed is under a third of one. Roughly a third of the cycle sits inside jumping range.
  · **top of the swing** centre 185, box top **165**. That is as high as it can go, and the ceiling is not the constraint — **the HUD is**. The badge column is `gx 4` (x=180) and the HUD's left stack (stage plaque + lives) reaches y≈150 at a 1280 frame, directly above it. Higher and the pickup hides behind DOM chrome. The badge cannot move right instead: screens 2, 3 and 4 all put their first obstacle at `gx 6`, and the validator (rightly) fails any badge that does not precede every obstacle.
  · **period from amplitude**: 4.8s over a 310px band averages ~129 px/s, a drift you can read. Keeping 3.2s would have made it 194 px/s — a target you chase.

  **Fairness, probed rather than assumed.** Raising the band matters far more on touch than on a keyboard: with one-tap auto-run the move pad is hidden, so the player cannot stop under the badge and wait — one pass, one tap. A probe drove the real sim with `right` held and a single jump on frame *k*, for every *k*, on all six screens: the badge lands for taps in **frames 8–31, a 0.40s window**, contiguous on every screen. That is comparable to the stamps' safe window, so it stayed. The probe is now a permanent test (`src/core/badgeReach.test.ts`) rather than a `/tmp` script, because it is the kind of number a later tuning change breaks silently: it asserts the badge is *not* collectable by standing under it for a whole cycle, *is* collectable by standing and hopping, and that the one-tap window is ≥0.3s and contiguous. `validate-levels` gained the matching structural rule — the bottom of the float must clear a standing head — so the physics-aware reachability proof and the new rule together say "jumpable, not walkable".

  **The mark.** New `src/render/badge.ts` (pure, rasterisable on its own) replaces the teal `BADGE_GRID` disc with a white "A" that used to live in `sprites.ts`, and `Game.drawBadge` is now a dozen lines that hand it a band, a ground line and a phase. Four things drawn, all from whole cells: an authored **19×19 ANSR sunburst** (38px at scale 2, inside the 40px hitbox), a dashed **levitation shaft** with a bracket at each end of the swing and a three-cell wake behind the badge, a **flare** of four bright cells off the ray tips, and a **chevron on the ground** under the shaft — the affordance the screen owes the player now that taking the badge is a jump.

  **Four things about the mark that only the pixels could tell us** (rasterised with `@napi-rs/canvas`, as HANDOFF §2 insists):
  1. *Quantising the real logo path does not work.* The brand asset is a ring of ~36 hair-thin rays; sampled at 14–24 cells it comes out asymmetric and noisy at every threshold. The mark had to be **authored**, not derived. It is built from an 8-way mirrored template on an **odd** grid — odd matters, because with an even grid the centre falls between cells and every cardinal ray is forced to two cells wide, which is what turned an earlier attempt into a gear.
  2. *Sixteen 1-cell rays at 38px read as a smudge.* Adding a **hub ring** (`h`) where the rays spring from gave the mark a body; side by side at 4× and at 1×, it is the difference between "the ANSR mark" and "an orange scribble". The ring is not in the brand asset, and that is fine — it is what the real logo's density gives you at poster size.
  3. *A dithered halo is wrong at this size.* The player's bubble fakes a glow with a chequer of low-alpha cells, so the badge got the same treatment — and a warm colour at 0.15–0.4 alpha over the deep teal sky desaturates to grey-brown, so the badge came ringed with what looked like dirt or damage. Replaced with four **solid** bright cells on the ray axes, alternating cardinals and diagonals in two held frames. Few cells at full alpha read as light; many cells at low alpha read as a rendering fault. The dither still belongs on the bubble, which is 46px of field around a figure, not 12px of edge round an icon.
  4. *The capability plaque cannot sit above the badge.* It was at `cy - 52`; with the badge at the bottom of the swing that is exactly where the player's chest is on the frame they jump for it, and at the top of the swing it collides with the HUD stack. It is now always `cy + 34` — below, where the worst case is the standing player covering it, and he is drawn afterwards.

  Also gone with the old sprite: `drawBadgeDisc`, `BADGE_GRID`, `BADGE_GRID_W`, and the `createRadialGradient` + `arc()` glow in `Game.drawBadge` — the last non-8-bit drawing in the world layer. `render/badge.test.ts` guards that with a canvas stub whose `createRadialGradient` and `arc` **throw**.

  **Green:** typecheck + lint + **314 tests (38 files)** + build + build:site + validate:levels; ESM 44.94 KB / IIFE 45.21 KB gzip; budget gate **88.0 KB of 90 KB** (+0.9 KB — the new module net of the deleted disc; headroom is now 2 KB, which is worth knowing before the next visual pass). Files added: `src/render/badge.ts`(+test), `src/core/badgeReach.test.ts`. Changed: `src/core/{Game.ts,setbackLog.test.ts}`, `src/render/sprites.ts`, `src/world/badgeFloat.ts`, `src/data/{tuning.config.ts,levels.json}` + both root mirrors, `scripts/validate-levels.ts`. **Not verified:** the feel of the 0.40s one-tap window on a real phone — it is proved reachable and proved contiguous in the sim, but nobody has thumbed it.

- **The powerup is now the actual ANSR logo, on every screen (owner call).** Owner feedback: "for the powerup in all screens you have not used the ANSR logo we have — please look at what we already have and use that; one of the places it is used is the first screen beside ANSRcade. If what you have built can be used, that's best; otherwise recreate an 8-bit version that looks the same." The mark beside "ANSRcade" is `ui/ansrMark.ts` — the real brand asset's sunburst path, generated from `ANSR Logo.svg` by `scripts/build-ansr-mark.mjs`, drawn in the DOM by `ui/BrandMark.ts` and on canvas by `render/ansrLogo.ts` (the Tech Park plaza and the attract-screen tower facade already use it). The badge, by contrast, was still the **authored 19×19 pixel reduction** added in the previous pass. The owner was right: it was not the logo. The real mark is a *hollow ring of ~32 fine rays*; a 19-cell grid can only carry 16 fat ones around a filled core, so the pickup read as a generic star, and nothing about it said ANSR.

  **Which of the owner's two options to take, decided on the pixels rather than on the doc comment.** The previous pass's own comment in `render/badge.ts` asserted the vector path "turns to mush at badge size", which is what justified authoring a reduction in the first place. That claim was tested this pass with a contact sheet (`@napi-rs/canvas`, per HANDOFF §2): the real path drawn at 40px, 46px, and quantised to whole cells at 20/26/28/40 cells, each stamped on screens 1, 2 and 4's actual skies, viewed at 1× and 4×. Findings:
  1. **The vector at 40px does not mush.** At the badge's true size it is legible and unmistakably the ANSR mark — thin rays, hollow ring, correct ray count. The earlier verdict appears to have been formed against the *idea* of it, not a rasterisation.
  2. **Quantising it needs ~28 cells to survive.** At 20 cells (40px at 2px cells) the ray ring collapses into a lumpy blob — the same finding as the pass before, and the origin of the "pixel marks are authored, not quantised" invariant. It only holds together from 26–28 cells, which at 2px cells is 52–56px, i.e. 30–40% wider than the 40px pickup hitbox. Drawing a pickup larger than its own hitbox is the collectible version of the hazard rule ("a hazard sprite is its hitbox") and was rejected: it promises reach the rules do not give.
  3. So the owner's *preferred* option — use what we already have — is also the correct one on the pixels. `drawAnsrBadgeMark` is now three lines that call `drawAnsrLogo` with `diameter = RESOLUTION.TILE`, and the 19-row grid, its two palettes and `BADGE_CELLS` are gone. It costs **negative bytes**: the path was already in the bundle for the plaza, so deleting the grid took the gate from 88.0 KB to **87.9 KB of 90**.

  **One defect only the rasterisation showed: the hollow core is wrong on a small moving object.** The brand mark's centre is empty, which is right on a page and wrong here — on screen 1 a lit cyan office window sat inside the ring, and on screen 5 a whole column of warm windows did, so the pickup read as a *hole in the artwork* rather than as a mark. Fixed with a `CORE_CELLS` backing: 4×4 whole cells with the corners cut, `rgba(1, 28, 38, 0.86)`, sized `round(diameter * 0.12)` per cell, drawn *before* the path so the rays always sit on their own shadow. Measured against the rasterised mark, not guessed: at 0.10 (16px) the window edges still showed at 3 and 9 o'clock; 0.12 (20px) covers the void with a cell to spare, and at 0.62 alpha the window was still visible through it while 0.86 reads as a shadow without becoming a filled disc. This is the same lesson as the badge's failed dithered halo, from the other direction: at icon size, low alpha reads as grime, not as translucency.

  **Kept unchanged:** the levitation shaft, the four-cell flare (ray tips reach exactly `BADGE_MARK_D / 2` = 20px, so the flare's r=26 still leaves a clean 6px gap), the ground chevron, the plaque below the mark, and the phase-driven purity of the whole thing. The shimmer changed shape: the old mark swapped ray *classes* between two tones, and one path cannot do that, so the whole sunburst now glints between `#f05722` and `#ff8a4d` on held frames — both brand orange, so it reads as light catching the mark. Position still comes only from `world/badgeFloat.ts`; nothing about the hitbox moved, so `badgeReach.test.ts`'s 0.40s one-tap window and the validator's clearance proofs are untouched (both re-run green).

  **Tests rewritten** (`render/badge.test.ts`, 8 cases). The recorder canvas gained `save/restore/translate/scale/rotate/fill` and now records path fills alongside cells, and the file installs a `FakePath2D` stub that keeps its `d` string — jsdom has no `Path2D`, and `ansrMarkPath()` caches its answer on first call, so the stub has to be in place before the first draw. The assertions that matter: the badge fills **`ANSR_MARK_PATH` byte for byte** (a lookalike fails), in `LOGO_ORANGE` and never the `#FF5400` value accent; the transform sizes it to span exactly `RESOLUTION.TILE`; the core backing is whole equal cells, dark, centred, and between 30% and 60% of the hitbox; the shimmer changes colour but not geometry; and the pickup still draws >10 cells outside the mark's own box, so where `Path2D` is missing the badge is unbranded rather than invisible. Dropped: the eight-way symmetry test — the real mark's rays vary in length and angle, which is exactly why no generated ring reproduced it, so demanding cell symmetry would now be demanding the wrong thing.

  **Green:** typecheck + lint + **316 tests (38 files)** + build + build:site + validate:levels; ESM 44.84 KB / IIFE 45.12 KB gzip; budget gate **87.9 KB of 90 KB**. Changed: `src/render/badge.ts`(+test). **Verified by rasterising** all six screens at the top, middle and bottom of the float band, cropped at 4–5× (`/tmp/brrender/shot.mts` + `crop.mts`). **Not verified:** how the mark's fine rays hold up on a physically small phone screen after the frame is downscaled — the internal 1280×720 raster is right, but a 360px-wide viewport scales it by 0.28 and nobody has looked at it on glass.
- **Compliance rebuilt as a staircase maze of wandering monsters, and moved up behind Setup Delays (owner call, three rounds of feedback).** Owner brief: "The compliance screen will now come after the setup delays screen and the obstacles of Compliance stage are to be entirely changed now it's like — a staircase maze and it's not possible for the player to cross just by being on one level because there's no possible way to go directly and every step will have one or two small monsters. Monsters named after compliance headaches (Entity, Payroll, Legal, Tax, Audit) wander the corridors picking random directions at each junction, unpredictable rather than hunting the player and the movement can be sometimes slow sometimes fast. Touch one without the powerup = death. ANSR powerup makes the upset angry monster smile and open the toll gates it currently has and move fastly to the shown area", plus a reference sketch, plus "remove the files that are on top saying tax, gst, audit".
  **Running order.** Compliance is screen **2** now and Hire Under Fire is **3**. The order is nothing but the numeric `id` (`Simulation.clearScreen` advances `_screenId + 1`), so the change is the two entries swapping ids — and then every id-keyed map with them: `render/scenery.ts`'s `TILE_MATERIALS` and `drawSceneBackground` switch, `COPY.onClear`, `CAPABILITIES` (which is journey order and is asserted against a real playthrough in `golden.test.ts`, so it *had* to be reordered — that test is the reason the receipt can never drift from the level file), and the `screenN.test.ts` filenames. `monthsBase` travels with the screen, so the six still sum to the benchmark.
  **Three rounds on the geometry, because the first two were mine and not the owner's.** Round 1 was a single long ramp: right topology, wrong picture. Round 2 was the sketch's topology but built out of solid-to-the-ground masses, and the rasterisation showed why that was wrong — the right half of the frame was one grey slab. Round 3 is the sketch read as a *path*: floor corridor → stepped stair off the left corridor → the wide filings plateau (the block the sketch marks "monsters gather here") → a 120px jump back up-left onto the registers platform → two treads rising right → the approvals gallery → the statutory wall → step off onto the clearance lift → the far bay and the exit. The airy elements the sketch is actually made of — the mid-left platform, the upper treads, the gallery, the thin wall, the yellow lift — float over the mass with dark air between them, which is what makes it read as a maze rather than as terrain.
  **The measured rule that shaped every version: 40px of headroom is not headroom.** A player standing on a tread has 44px of body and needs to *jump* 40px to the next one, so anything overhead must clear 84px, i.e. **three empty rows (120px)**, not two. At two rows the flood search stopped dead on the tread below — the player could rise 36px and needed 40. This one number invalidated four separate layouts (an overhead platform above a staircase, a mezzanine above the landing, a back-up step above a tread, and a wide upper tread above the last stair) and it is now in HANDOFF's invariants.
  **Thin platforms make pockets, so the probe was extended to prove there are none.** A floor region enclosed by faces taller than a jump is a soft lock — worse than a slab, because the run cannot end. `/tmp`-style probing was not enough here: the probe now builds the whole reachability *graph* with the real `Player` physics, then floods it **backwards** from the exit states and reports every reachable state that cannot get back to the goal. Final geometry: **0 trapped states** out of 62,748, every authored surface reachable (600 → 560 → 520 → 480 → 440 → 400 → 320 → 280 → 240 → 200), and the control run — ground plus wall only — stops at x=960, the wall's face, which is the owner's "not possible to cross on one level" proved rather than asserted.
  **The monsters are the screen's existing creature, not a new one.** My first attempt invented a small brown blob from the sketch's ovals; the owner sent two reference shots of what the screen already had — the pale approval head on its slate post with a dark visor and a set mouth, and the same head in mint green with a grin and its striped boom arm swung clear. That is the old `drawGates` art, which this pass had deleted. It is back as `render/maze.ts`'s 17×26 authored grid (exactly `MONSTER_W`×`MONSTER_H` at scale 2, test-guarded), **one grid with two palettes** — `v`/`m`/`t`/`x` are the cells that change meaning between moods, which keeps a second 442-cell grid out of a 90 KB budget. Two details the rasterisation decided: the arm is drawn **only as it rises** (both reference shots agree — scowling head, nothing in its hands; grinning head, barrier clear), and it stops at 68° rather than vertical, because at 90° the two arms collapse onto one line above the head instead of splaying into the sketch's V.
  **A monster *is* its toll gate.** The owner's "makes the monster smile and open the toll gates it currently has" reads as one object, not two, so the separate cycling `tollGates` array I had built was deleted along with the `'gate'` setback cause: the creature holds the arm down, and the arm coming up *is* the gate opening. That removed a whole timing layer from a screen that already asks for route-finding, and it removed the temptation to make a gate solid — a solid barrier on the only route would make the screen impossible without the badge, which no screen in this game is.
  **Wandering, proved not to be hunting.** Each monster owns a corridor (`from`/`to`/`gy`, plus `slope` so it walks a staircase's treads rather than an interpolated diagonal) and re-rolls **direction and speed** at every junction — a column boundary or either end — from its own mulberry32 seeded from level data. The player's position is not an input anywhere in the file, and a test proves it: two runs with the player parked in completely different places produce byte-identical paths. Speed re-rolls between 52 and 132 px/s, both ends well under the player's 260, so a corridor is always winnable; a constant-speed patrol is memorised in one attempt, which is why the re-roll is on speed as well as direction. A fairness test measures the worst continuous block of a crossing column over 60s and holds it under 3s — a monster sweeps at least a full tile between decisions, so it cannot dither in a doorway.
  **"Follow the natural path" — the owner's third correction.** The gathering monsters originally moved straight to the landing at 420px/s, which meant drifting diagonally through the stone. They now walk an authored `route`: surface cells, corner by corner, so TAX climbs the four treads it has been standing next to, AUDIT comes back along the gallery and down both upper treads, LEGAL walks to the end of the registers platform and down. Authored rather than searched because a route is four corners and a pathfinder is a kilobyte of code plus a determinism risk, for the same picture. A monster with no route stops where it is, still harmless, so nothing is ever left mid-air.
  **The floating platform is a lift, and it is not made of bricks.** Owner: "the floating platform should have a different color and not a brick style — that is supposed to bring the character down." It is the one moving solid in the game: `ComplianceMaze` owns it, hands the same box to the player's collision list and to the renderer (level data holds where it *parks*, never where it *is* — the lesson `world/badgeFloat.ts` taught), and it descends **only while the player is standing on it** and returns only while it is empty. That rule is not decoration: `moveAndCollide` is driven by the player's motion, so a platform rising into an occupied box would push the player through it. Painted as a machined yellow plate with a lit top edge, down-chevrons and a dashed guide rail showing its remaining travel — the rail is the same idea as the badge's float rail, signposting the motion before the player commits to it. It is deliberately not the only way down (walking off the wall also works), which is what lets the validator keep proving completability from static solids alone.
  **The TAX/GST/AUDIT signboards are gone**, and the interesting half of that is *where the words went*: onto the monsters. The old backdrop hung five labelled boards across the middle of the frame at y=130, which the maze now fills, and those five words are the monsters' names. A label belongs on the thing that moves, where the player is looking.
  **The budget broke, and the fix is worth more than the pass.** The gate went to **92.6 KB of 90** — and ~3 KB of that was *prose*: `levels.json` is imported by the engine, so the notes explaining the maze shipped to every host. Writing shorter notes would have been the wrong lesson, so `scripts/strip-level-notes.ts` (a `pre` Vite plugin, pure function + test) now drops everything only humans read: `meta.notes`/`structure`/`clock`/`conventions`, every `note`, `meaningTag`, `zone`, the `role` on any solid that is not `noncollide` (`Screen` branches on that one), and the `hint`/`onClear`/`win` mirrors of `COPY` inside each screen's `copy`. Dev and tests read the file as authored; the bundle gets the geometry. **89.3 KB of 90**, and level authoring prose is free from now on.
  **Also probed and kept as tests:** the lift's ride time (travel ÷ speed between 1.5s and 4s), that the monsters huddle side by side (`GATHER_SPACING` had to go 30 → 40: at 30 the sprites overlapped and five name plates rendered as one unreadable word, so the plate is now dropped once a monster settles), and that every screen still passes `badgeReach` — TAX patrols the left corridor between the badge and the first stair, so its corridor was pushed to gx 7–8 to keep the badge's 0.40s one-tap window clear of it.
  **Green:** typecheck + lint + **348 tests (40 files)** + build + build:site + validate:levels; ESM 45.67 KB / IIFE 45.91 KB gzip; budget gate **89.3 KB of 90 KB** (0.7 KB of headroom — thinner than it has ever been; the next pass that adds art should spend a moment on `npm run analyze` first). Files added: `src/world/Hazards/ComplianceMaze.ts`(+test), `src/render/maze.ts`(+test), `scripts/strip-level-notes.ts`(+test). Deleted: `src/world/Hazards/Gates.ts`(+test), `Game.drawGates`. Changed: `src/data/{levels.json,levels.ts,tuning.config.ts,copy.ts,data.test.ts}` + both root mirrors, `src/core/{Simulation.ts,Game.ts,screen2.test.ts,screen3.test.ts,setbackLog.test.ts}`, `src/world/{types.ts,Powerups.ts}`, `src/render/scenery.ts`, `src/ui/ui.test.ts`, `scripts/validate-levels.ts`, `vite.config.ts`. **Verified by rasterising** the screen unassisted and assisted (`/tmp/brmaze/shot.mts`). **Not verified:** how the maze plays with a controller in hand — the route is proved climbable and trap-free by search, and the corridors are proved crossable by measurement, but nobody has played it; and the 120px jump from the top tread up to the registers platform is the tightest single move in the game (140px of lift available), so it is the first thing to soften if playtesting says the screen is hard.
- **Local Expertise deleted; the Workplace screen built in its place, at slot 3 (owner call, two rounds of art feedback).** Owner brief: "Add a workplace screen after Compliance — this is a replacement screen for Local Expertise, now we won't have local expertise screen. The screen looks like a broken office. Flickering lights, wet floor signs, and yellow caution tape everywhere. A mummy wrapped in three layers of that same caution tape trudges steadily in one direction only, looping back to his starting point when he reaches the far wall rather than turning around, so his path is a predictable metronome rather than a chase. The player spawns behind a short wall that keeps him safely out of the mummy's path from the very first frame, and that wall doubles as this level's simple jump obstacle. Touch mummy = death. The ANSR badge grants a shooting power… Three hits strip all three tape layers and the mummy unravels and the mummy doesn't die, the human in mummy wears a shirt and rolled up sleeves and runs to a nearby sparking computer terminal and starts working frantically and that's what restores everything… so the same mummy who was a blocker is someone who makes things right for the character upon use of the powerup."
  **Running order and the month model.** "After Compliance" was taken literally: Workplace is id **3** and Hire Under Fire moved to **4**. Screen count stays six and the new screen inherits Local Expertise's `monthsBase` of 2, so the bases still sum to `ANSR_BENCHMARK_MONTHS`. Every id-keyed map moved with it — `TILE_MATERIALS`, `drawSceneBackground`'s switch, `COPY.onClear`, the `screenN.test.ts` files — and `CAPABILITIES` was reordered to setup → compliance → **workplace** → hiring, which `golden.test.ts` asserts against a real playthrough, so the receipt cannot drift from the level file.
  **The capability.** `FORESIGHT` is gone and `UNWRAP` replaces it, still carrying **500Leaders** (`monthsSaved` 2, so the four still account for the whole 24 → 11 gap) with the stage renamed Workplace and the effect reworded to "On-ground leaders who unblock the team instead of adding process". **Worth the owner's confirmation:** ANSR's actual workplace product is 1Wrk, which already owns screen 1 ("entity, office and systems stood up"), and a capability may appear on exactly one screen. So the pillar that got dropped is *local expertise*, and 500Leaders was re-pointed at the man tied up in the room rather than at market context. That reading works, but it is my reading, not a brief.
  **Spikes deleted with the screen.** `Spikes.ts` (+test), `Game.drawSpikes`, `HAZARDS.SPIKES`, `SpikeColumn`, the `'spike'` setback cause and `drawIndiaMap` are all gone — ~5 KB of raw source that nothing could reach any more, and against 0.7 KB of headroom it was not optional.
  **The obstacle is a metronome, and that is the whole design.** `Workplace.ts` walks him one way at one constant speed and loops him back to `from` instead of turning him around. Deliberately the opposite of the compliance monsters, which re-roll direction and speed to be unreadable: here the player is meant to stand behind the partition, watch one sweep, and know when to move. Nothing random, nothing that reads the player. Unassisted the screen is still winnable — wait until he is at the far end and run, because he loops back *behind* you and closes at 150 px/s against your 260, so he can never catch you from there.
  **The loop needed a fairness beat nobody asked for.** Snapping a lethal 60×78 body back to the start column would put it on top of any player standing there, which is the unfair-not-hard failure the DENIED stamps already cost a pass to learn. There is now a `returning` phase: `RETURN_TIME` 0.6s during which he is **harmless** and drawn fading in at the column he is about to walk from — 156px of escape at walk speed, and the ramp *is* the telegraph. A test asserts `lethal === false` for every frame of it.
  **A new verb needed a new input, and it is an edge.** `InputAction` gains `shoot` (KeyF / KeyJ — not Ctrl/Shift, which are browser and screen-reader shortcuts, and not Enter, which activates whatever overlay button has focus), `InputState` gains `shootPressed`, and `HazardContext` gains an optional `shoot`. Optional because exactly one hazard has a verb of its own and the other three would carry a field they ignore. It is passed straight through from `input.shootPressed`, so a hazard can never auto-fire from a held button — three deliberate shots is the beat the screen is built on. Touch gets a fourth button, and it is the one control in the game that appears conditionally: `setShootVisible` shows it only once the badge has armed the cutter, because a thumb target that does nothing on five of six screens is one the player learns to ignore.
  **The cutter refuses to fire at a freed colleague**, and that is a rule rather than a nicety: once the last layer is off, the only figure on the floor is a man fixing the room, and letting the player shoot him would inverate the point of the screen. Guarded by a test.
  **No `shieldsPlayer`.** Taking the badge does not make contact safe, it makes the figure *solvable* — until the last layer is off, walking into him still stalls the stage. So there is no ANSR bubble here: it would promise protection the rules do not give (the invariant that killed `drawZoneRead`'s floor cap).
  **Pulses ignore static geometry, and the level answers for it rather than the code.** The figure's corridor starts at gx 9, two columns clear of the partition at gx 6, so the step you stand on to cut the tape already has a clear line to him. Giving the pulse its own collision pass would have bought nothing except the ability to make the screen's one safe spot the one place you cannot act from.
  **Then the art, which took a second round because the first one rasterised badly.** Owner: "the screen can change the background to something that suits — we need not keep the building background, show an inside of an office setup… the mummy needs to look human figure and visually this is not looking good, this is very basic… the gun needs to be more prominent and better… the person also doesn't look like a mummy, it needs to be like a mummy/a human silhouette… use various obstacles like an under-construction kind of barricade and other caution also… and when the mummy touches our character there should be some visual change in the character while dying." Every one of those was visible in the PNG and invisible in the code, which is the fifth pass in a row that has been true.
  1. **Indoors, so no sky.** This is the only screen that opens on an interior. Every other backdrop says "the market you are entering"; a city skyline behind an office is the wrong picture, so the market went *outside the window* where it belongs — a glazed wall on the right third with the existing `drawSkyline` clipped into it. Plus the suspended ceiling grid with **two tiles out and the wiring hanging through**, a cable tray running the length of the floor, cubicle dividers with dead monitors, a whiteboard, a server rack and a wall clock. The ceiling gap and the tray exist because the first rasterisation had 340px of empty wall between the sign and the furniture.
  2. **The figure was 34×52 and looked like a child next to the hero.** Hazard sizes in this game are measured against the *drawn* player (48×60), not his 28×44 hitbox. It is now **60×78** — the tallest thing on the floor, authored 20×26 at scale 3, hitbox exactly the sprite.
  3. **One silhouette, two palettes, and that is a design decision not an economy.** The same grid is the mummy and the colleague, so stripping a layer reveals more of *the same man*; two sprites would have made the unwrap a substitution (monster becomes human) when the point of the screen is that it never was one. Row 3 carries the trick: `e` paints as a continuous dark slit in the wrap (the single most recognisable thing about a mummy) and as skin in the human, with two `E` cells that are eyes in both.
  4. **The bandage had to go near-white.** At `#DCD6C2` — roughly the caution yellow's own value — the figure rasterised as a *yellow striped pillar*: wrap and tape merged into one shape. Cloth has to be the lightest thing on a dark floor for the silhouette to carry, and the tape has to sit on it as accent rather than as camouflage. Same class of error as the badge's dithered halo: value relationships decide legibility, and they are invisible in source.
  5. **Nine bands, thinned and inset.** The first layout covered 70% of his height and hid the body; bands are now 1–2 cells, inset from the outline, and the arm band stops at the elbow so the wrapped hand at the end of the reach stays white and the outstretched arm reads as an arm rather than as one more strip of tape sticking out of him. Three hits peel him in three legible steps (9 bands → 5 → 2 → none).
  6. **Trailing ends: three attempts.** Three long horizontal strips rasterised as *a small yellow ladder standing next to him*; two stepped ends with a white curl rasterised as a floating white square. It is now one short end off the hip, three steps, tucked against the body.
  7. **The gun was tried at scale 3 first and was worse.** At 54×39 it was as wide as the hero and read as a plank across his chest. At **36×26** (18×13 at scale 2) it lands as a substantial object beside a 48×60 figure with his silhouette intact — a receiver with a dark shade line, a tape reel on top, an orange muzzle housing and a light bore, held at *barrel* height so it sits on the pulse's own line. Recoil kick and a three-step starburst both read off `Workplace.sinceShot`, so the flash can never disagree with the pulse that left the barrel. The idle muzzle glow started as a low-alpha orange field and rasterised as **a dirty grey-brown box** over the dark room — the dithered-halo trap for the third time — so it is now two full-alpha pilot cells.
  8. **Barricades: the diagonal is the whole thing.** The first pass reused the tape's vertical ticks and every barricade rasterised as a yellow plank. `stripedRail` now steps the stripes diagonally in whole pixels (4 across per 4 down), and the trestles are 96×84 with crossed legs and an amber hazard lamp. Plus cones, wet floor signs with puddles, tape stands, and abandoned step ladders — the ladders are there for *height* as much as for meaning, because every other prop tops out at knee level.
  9. **Tape strung post to post drew one unbroken yellow line from wall to wall.** It is now strung within authored *pairs* of posts, two runs per pair with sag, and both runs sit above the figure's crown — the first version lined the lower run up exactly with the tape on his outstretched arm and the two became one unreadable bar across the picture.
  10. **The props are held at 0.78 alpha and the figure is not.** The dressing and the hazard are the same caution yellow, and at full alpha the one thing on the floor that can cost a life was just one more yellow shape among nine. The props are the set; he is the actor. Columns 9–13 are also left deliberately empty in `clutter`, because that is where he starts every sweep and a ladder plus a tape run standing there made him unreadable in the one place the player has to read him from.
  11. **The gloom came down from 0.4 to 0.28.** At 0.4 the room went so flat that the barricades and the figure lost their own shading and the whole screen rasterised as one dark smear. Gloom has to be readable gloom.
  12. **Dying now reads on the player.** `drawTangled` tapes him up where he stands — three bindings, loose ends whipping off both sides, a shred settling on the floor — the same job the flattened stamp pose does on Setup Delays, plus a burst of caution-yellow shreds off his chest on the impact frame (the only setback in the game that throws debris, because it is the only one where something visibly grabs him). First version wrapped him from the crown down and rasterised as a stack of yellow bricks with a person somewhere inside it; **the head stays clear now** — you have to be able to see whose day this is.
  **The room comes good only because somebody makes it come good.** `restore` is one 0..1 dial and it only moves once the freed man reaches `working` and the terminal chimes: then the tape, barricades, cones, signs and puddles clear, all four strip lights strike steady, the floor gets its lit edge, and the screen shows `OK`. Nothing on this screen fades on a timer.
  **Budget: the gate fails and the reason is a measurement artefact, so it is left for the owner.** `check-budget.mjs` sums **every** `.js` in `dist/`, which means it adds the ESM and IIFE builds together even though a host loads exactly one — doc 09 lists them as alternative outputs. Real download is **49.3 KB gzipped, 55% of the 90 KB budget**; the summed figure is **98.3 KB of 90**. This pass added ~4.5 KB gz per payload (the office interior, the props, the 60×78 figure with its two palettes and nine bands, the cutter, the terminal, the tangled frame) against ~2 KB recovered by deleting Spikes. Trimming was explored and abandoned: hoisting every repeated hex literal in the two new render modules recovers ~0.5 KB of the ~4.2 KB per payload that the summed gate needs, so closing it means deleting most of the art that was just asked for. HANDOFF §7 now carries the choice — fix the gate to measure the largest single payload (recommended: it still bites at 90 KB, and it is what the Ops doc's "JS (gzipped) ≤ 90 KB" means), or cut art back.
  **Green:** typecheck + lint + **347 tests (39 files)** + build + build:site + validate:levels. Budget gate **red at 98.3 KB of 90 on the summed measure, 49.3 KB on the real one** (see above). Files added: `src/world/Hazards/Workplace.ts`, `src/render/workplace.ts`. Deleted: `src/world/Hazards/Spikes.ts`(+test), `Game.drawSpikes`, `drawIndiaMap`. Changed: `src/data/{levels.json,levels.ts,tuning.config.ts,copy.ts,data.test.ts}` + both root mirrors, `src/core/{Simulation.ts,Game.ts,Input.ts,screen3.test.ts,screen4.test.ts,setbackLog.test.ts}`, `src/world/{types.ts,Powerups.ts}`, `src/render/scenery.ts`, `src/ui/{TouchControls.ts,styles.ts}`, `scripts/{validate-levels.ts,strip-level-notes.ts}`. **Verified by rasterising** eight states — found, armed, one hit, muzzle flash, one layer left, unravelling, working, restored, plus the tangled death frame and a scale sheet against the hero (`/tmp/brrender/work.mts`, `mummy.mts`, `zoom.mts`). **Not verified:** nobody has played it. Three specific unknowns — whether the 4.8s sweep is a beat or a wait when you are actually standing behind the partition; whether three shots at a 0.22s cooldown feels like a mechanic or like a chore; and whether the shoot button appearing mid-run is discoverable on a phone without a prompt, since the only place the cutter is explained is the badge's own note.
- **Hire Under Fire rebuilt as a boss fight: a dragon in a tie and glasses, and a water cannon (owner call).** Owner brief: "The obstacles of Hire under Fire stage are to be entirely changed now it's like — so the obstacle will be a big dragon wearing a tie and glasses and the Dragon gives a brief roar and telegraph for a second or two before it starts moving or shooting anything, so there is always a guaranteed safe beat at the start of the level. Once active, the dragon roams the screen and spits fire and one or two more kinds of fire attack maybe like fireball labeled with things like 'Candidate Declined' or 'Pool Too Narrow'… fire touch the character = death and +2 months in the log. The ANSR powerup when collected, a teal halo effect circle kindof appears around the player making the character invincible and the character also gets a big water weapon which would throw water in a projectile at the Dragon and the fire from the dragon vs water should be nice and water should overpower the fire from the dragon a bit and when the fire stops the the water would damage the dragon (proper sound should also be there when getting used), and it serves two purposes at once: it makes him immune to fireballs or other attacks and the dragon when attaked with water the costume would start to come off and from inside 5 candidates fall on ground and a text overlay on them saying hired, it can lool celebratory?"
  **What went, and what the family is now.** `Fire.ts` (+test), `HAZARDS.FIRE`, `FireLane`, `fireLanes` and the `'fire'` hazard kind are deleted; `Dragon.ts` (+test), `HAZARDS.DRAGON`, `DragonSpec`, `dragons` and the `'dragon'` kind replace them. The `'fire'` **setback cause** deliberately stays — the tag is still `OFFER DECLINED` and the reason still names the hiring cycle, so `setbackLog`, `ui` and `analytics` tests and the receipt are untouched. `EXTINGUISH`/Talent500 stays on the screen, so `golden.test.ts`'s capability-order assertion is untouched too. The screen also lost the last inline hazard painting in the game: `Game.drawFire` was 70 lines that could not be rasterised or tested without a browser, and it went with the lanes into a pure `render/dragon.ts`.
  **The badge does two things at once, which no other badge does.** Every other capability is a single verb — `PLACE_TILE` shields, `CLEAR_PATH` clears, `UNWRAP` arms. `EXTINGUISH` now both protects (`shieldsPlayer` → the halo, and `update()` returns no cause at all when assisted) *and* arms (a water cannon on the existing `shoot` edge). That is not a shortcut: the immunity is what buys the player the time to stand still and aim, so the two halves are one mechanic. It also means `HazardContext.shoot` now has two consumers rather than one, which is the first time that optional field has earned being on the interface.
  **The dragon's body is not a hitbox, and that is the screen's central rule.** It hovers, never lands, and touching it costs nothing; the only lethal things it owns are a breath column with 0.7s of floor telegraph and a labelled fireball with the better part of a second of flight. So nothing on this screen can cost a life without a warning in front of it — which is what licenses a boss that is *faster than the player* (see below) and what licenses art that sprawls past its own box (wing tips, tail, dangling feet), the exact opposite of the rule every other creature here follows. `Dragon.test.ts` audits it rather than asserting it: park the player inside the body for 60s and every single delay booked has to be explainable by a flame that the hazard's own snapshots say was on him. 0 unexplained, and not vacuous — he does get burnt in there.
  **Three tuning passes, all driven by a probe, and the first two were wrong.** `/tmp/brcheck/probe4.mts` drives the real `Simulation` with eight reactive policies. Round 1 (`ROAM_SPEED` 96, `ATTACK_INTERVAL` 2.6, footprint committed at the player's current position): **8/8 policies cleared with zero delays, blind sprint included** — the whole 1,200px stage fits inside the roar plus one interval, so nothing ever happened. Round 2 (speed 150, interval 0.9, leading the target): still 8/8 and 0 delays, because the dragon *lost the race* — the player walks 1,200px in 4.6s, the dragon fell behind, `near` never held so it only ever lobbed fireballs at a back it could not hit, and at a 0.55 lead those landed ~130px short every time. Round 3 is what shipped: `ROAM_SPEED` **300** (faster than the player's 260), holding a derived `STANDOFF`, full-flight lead solved in two passes, and the first attack after the roar scripted to be the breath. Result: **7/8 clear with zero delays in 6.1–6.6s, and the blind sprint loses the stage.** That is the shape the screen needed — crossing costs ~1.5s of dodging over a straight walk, and ignoring the floor costs lives.
  **`ROAM_SPEED` > the player's walk is fine here and nowhere else.** It is only defensible because of the no-hitbox rule: "you cannot outrun it" costs the player nothing except the option of ignoring it. The compliance monsters' "never take the player as an input" rule was deliberately *not* carried over — an unpredictable monster says "you cannot plan around compliance", which is the argument on that screen, but a dragon that ignores you is scenery. The roll that picks *which* attack is still seeded and still has no player input; position only decides which of two telegraphed attacks is the legible one at that range.
  **`STANDOFF` is derived, not authored, and getting that wrong would have been invisible.** It is `BODY_W × MOUTH_X_FRACTION + BREATH_REACH` = 166px: exactly the range from which the committed footprint lands on the player's own column. The obvious reading of "it comes at you" — close to zero — puts the dragon directly overhead, from where its own `BREATH_REACH` throws every flame 166px clear of the player. A boss that hunts you and then systematically cannot hit you is worse than one that ignores you.
  **The breath leads the player, and that is what makes it answerable rather than free.** Committed where they are, the mark lands 0.7s behind anyone moving. Led by `player.vx × BREATH_WINDUP`, the mark appears *in front of* them and the answer is to break stride — a decision made with the full 0.7s of warning, in the place they are already looking. Clamped to `BREATH_MIN_REACH` 110 (clear of its own 200px torso) and `BREATH_MAX_REACH` 320 (a local threat, not a screen-wide snipe), then **frozen**: `breath.x` is never re-read, so a mark on the floor cannot follow the player. A telegraph that tracks is a telegraph that lies. The fireball leads by the *whole* flight time, solved in two passes because the flight time depends on the lead and the lead depends on the flight time — one pass is short every throw.
  **It can only be hit while roaming, and finding that took two more probe rounds.** Guarding only the burn left the wind-up open and a probe took the entire suit apart inside four successive wind-ups: four hits, 2.0s, **not one jet ever meeting a flame** — the water-versus-fire exchange the owner asked for never happened once. Guarding attacks but not the opening roar let the player kill it during its own introduction, for the same 2.0s. So: vulnerable while roaming and at no other time, and water that arrives at any other moment boils off as steam with a `quenches` tick, which is the player's feedback for "not now". Plus every landed hit sets `nextAttack = 0` so it retaliates immediately. The loop is now land a hit → it commits → its charge or its column eats what you send → put the column out → the gap is your next shot. Measured: **6.85s and 23 jets (19 spent on flame) spamming the button, 8.67s and 9 jets played patiently.** That is the mechanic, expressed as a rhythm instead of a sentence.
  **The pose is the art decision that mattered, and the first version threw away both things the owner asked for.** Round 1 was a long horizontal beast at 220×140 — with the chest turned away there was nowhere for a tie to hang, so the jacket rasterised as **two filing cabinets either side of a white block**, and the 72×56 head was too small for glasses to exist at all. It is now **upright at 200×190: frontal torso, head in profile.** That gives a shirt front with a tie down the middle of it and a 90×70 head that can wear a lens. Composed from small grids (head 18×14 @5, glasses on the same registration, wing 16×13 @6) plus `pxRect` runs for torso, neck, tail and legs, the way the Workplace *props* are built — a single 44×28 grid would have been 1,232 hand-placed cells in a file where a mistyped row is invisible until it rasterises.
  **The costume is the health bar.** Four jets take off glasses → tie → jacket → shirt, drawn by handing `drawPixels` a palette that omits whatever is already gone, so it skips those cells with no per-piece branching. No bar, no number: the state of the fight is legible from what the dragon is still wearing, which is also the joke — what blocks the hire is the office dress. Glasses go first because they are the fastest read of "office" and therefore the most legible hit. Tests assert each piece's palette entry appears at its layer count and is absent one hit later.
  **Six art defects that were invisible in source and obvious in a PNG.** (1) The jacket was 148px wide on a **100px torso**, so it overhung the body on both sides — now nothing but the sleeves may leave ±50 of the centre line, and a test enforces it on the torso band. (2) The breath ran straight down through the dragon's own suit; `BREATH_REACH` throws the footprint 120px forward so the jet leans away and standing underneath is a real option. (3) The wind-up telegraph was orange on this screen's scorched terracotta ground — two warm colours at 0.4 alpha over a third, which rasterised as **a muddy brown smudge on a brown floor**. It is cream now, the only warm value here lighter than both the ground and the sky, plus a marching sight line from snout to mark. (4) The teal halo was a colour swap where a *brightness* swap was needed: teal at orange's alphas is nearly the deep-teal sky, so `BubbleTint` gained `boost` (2.6) and `spread` (1.22) — the owner asked for a halo *around* the player, and a ring that clears the figure is a different picture from one that crosses it. (5) Fireballs as three nested squares rasterised as a box inside a box; they are stepped profile rows now, and the ground burst is uneven tongues rather than a slab that read as a crate on fire. (6) Candidates at scale 3 were 24×42 and stood next to the hero like children — scale 4, and spread 1.6× the body width because five of them across a 200px costume overlap into one crowd with colliding HIRED plaques.
  **Teal on the player, on this screen only.** Orange is the value accent and one of its two legitimate homes is the bubble — but this screen is full of orange fire, and an orange shell put the one thing the player needs to see (himself, unharmed, inside a field) in the same colour as the thing it protects him from. Teal is the brand, the water's colour and the correct read anyway: the halo and the cannon arrive together and do the same job. The reserved orange keeps the badge burst, the ANSR ENGAGED label and the HUD chip here, so it still says "ANSR is with you" — it just is not painted on top of the fire.
  **Sound, without the hazard knowing an AudioEngine exists.** Five cues added (`roar`, `water`, `steam`, `strip`, `hired`); `roar` and `hired` duck the music, `water` deliberately does not because it fires six times a second and ducking on every jet would pump the whole mix. With no noise source and no filter, a growl is two detuned sawtooths falling a long way; `hired` is the same major arpeggio as `win` a fifth up, because it is the same kind of moment one screen early. The hazard exposes monotonic counters (`shotsFired`, `quenches`, `hits`) and `isRoaring`/`isBeaten`, and `Game.syncDragonAudio` plays a cue per increment it has not seen — so the cue is tied to the event the *simulation* booked, and a jet fired inside a hit-stop still gets its hiss.
  **The touch button now has two masters.** Two badges arm a tool and they arm different ones, so `setShootVisible(visible, label)` takes the label and `COPY.controls.shootWater` joins `shoot`. It is the button's only affordance — the glyph is an abstract arrow and nothing on the canvas explains either weapon — so the aria-label is the whole explanation for a screen-reader user.
  **A stripper hole, found by grepping the built bundle rather than by trusting it.** `strip-level-notes.ts` dropped `note` from screens, badges and the lift, but not from entries *inside* a hazard array — so the dragon's 700-character design note shipped to every host. Fixed (`zone` and `note` both go from every hazard entry) with two tests: one that proves prose inside the arrays is gone, and one that proves the dragon's `taunts` **survive**, because they are painted on the fireballs and a stripper that cannot tell content from commentary silently blanks the screen's argument.
  **A TypeScript trap worth remembering.** `tuning.config.ts` is `as const`, so `D.HITS_TO_STRIP` has the literal type `4` and `D.ATTACK_INTERVAL` the literal `0.9`. TypeScript only widens *fresh* literals, so a field initialised from one of those keeps the literal type and every later assignment fails — `private nextAttack: number = D.ATTACK_INTERVAL` needs the annotation. Vitest passed for several rounds while `tsc` did not, and a related bug (`beginAttack` reading an `extraTelegraph` that was never in its signature) survived three probe runs purely because the seed kept choosing the other branch. Run `typecheck` before believing a probe.
  **Budget: the summed gate is further into the red and it is still §7.1's decision, so nothing was cut unilaterally.** Real download is **56.49 KB gzipped, 63% of the 90 KB budget** (was 49.3 KB); the summed figure is **110.6 KB of 90**, because `check-budget.mjs` adds the ESM and IIFE builds together even though a host loads exactly one. This pass is ~+7.2 KB per payload: a 200×190 composed dragon with four costume pieces, the aimed breath with its cream telegraph, labelled fireballs, the cannon and its jets, steam, and five candidates with confetti — against ~2 KB recovered by deleting `Fire.ts`, the inline `drawFire` and four of the five lane entries in `levels.json`. The choice in HANDOFF §7.1 is unchanged and is now worth more: measure the largest single payload (still bites at 90 KB, still 33 KB of real headroom) or cut art.
  **Green:** typecheck + lint + **402 tests (40 files)** + build + build:site + validate:levels. Budget gate **red at 110.6 KB of 90 on the summed measure, 56.49 KB on the real one**. Files added: `src/world/Hazards/Dragon.ts`(+test), `src/render/dragon.ts`(+test). Deleted: `src/world/Hazards/Fire.ts`(+test), `Game.drawFire`. Changed: `src/data/{levels.json,levels.ts,tuning.config.ts,copy.ts}` + both root mirrors, `src/core/{Simulation.ts,Game.ts,screen4.test.ts}`, `src/world/{types.ts,Powerups.ts}`, `src/render/{sprites.ts,scenery.ts}`, `src/audio/AudioEngine.ts`, `src/ui/TouchControls.ts`, `scripts/{validate-levels.ts,strip-level-notes.ts}`(+test). **Verified by rasterising** six states — the roar with the hero for scale, the breath wind-up, the burn with a labelled ball in the air and a burst on the floor, the assisted frame (halo + cannon + jets + steam + two layers gone), the suit coming apart, and the five hires landed with confetti (`/tmp/brrender/dragonshot.mts`); grid row widths checked mechanically (`/tmp/brcheck/rows.mjs`) after a mistyped `CANNON` row. **Not verified:** nobody has played it. Three specific unknowns — whether a 7–9s boss fight is the right length inside a ~90 second game; whether the aimed breath reads as fair *in the hand* (the probe says a 160px back-off clears it, but a probe has perfect information about a mark a person has to notice); and whether the dragon's `HIRING AT SCALE` plate plus a taunt plaque plus the HUD is too much type on one screen at phone size.

---

## Pass 18 — Compliance art: brown brick, the archive wall, and a monster that is actually a monster

**Owner brief**, given as an annotated view of the Compliance screen plus three lines: *"this is the
kind of view I am looking for … if you feel it can be made to look better you can do it, the brick
has to be coloured brownish, and if you could pull the monster we have in github … locally I guess
you have deleted, but it's there on github."* The annotations on the reference marked the floating
platform, the point where all monsters gather, and the GCC-BOT chip — all three of which already
existed and behaved correctly. What the reference had that the build did not was a **row of labelled
filing cabinets across the upper frame**, and brown architecture instead of slate.

**The monster does not exist on GitHub, and proving that was the first job.** Searched every ref, not
just `main`: `git log --all -S monster -i` returns nothing, `git grep -i monster` over every commit
returns nothing, and the repository has held **120 files across its whole history with not one binary
asset** — no PNG, no SVG, no sprite sheet has ever been committed. `main` is identical to
`origin/main` (`4c9461d`), and there is no second repo (the parent `ANSR Game/` folder is not a git
work tree). So "the monster on GitHub" cannot be an asset. What *is* in history is three creature
designs that have stood on this screen:

| | where | what it is |
|---|---|---|
| A | `render/maze.ts` (current, uncommitted) | pale head on a slate post, 17×26 @2 |
| B | `Game.drawGates`, on `origin/main` — i.e. **the deployed build the owner has been looking at** | squat filing-cabinet post + striped barrier arm + a 6×5 stamp head @5px |
| C | `Game.drawPlants`, at `85279ad^` | a leaning stalk with leaves and a 6×5 "compliance weed" pod |

Rather than argue about it in prose, all three were transcribed verbatim out of `git show` and
rasterised side by side at game scale on the new brown ground, with the hero for scale
(`/tmp/brrender/cast.mts` → `cast.png`). The picture settles it: **B and C are the same 6×5 pale pod
with a dark slot across it, and A is that pod enlarged.** None of them is a monster; the largest
reads as a *skull*, which is the wrong word entirely for a screen about paperwork. There was nothing
to pull, so the creature was designed — keeping the two things the old sprite got right and changing
everything else.

**The creature.** Still exactly 17×26 cells at scale 2 = `MONSTER_W`×`MONSTER_H`, so the
sprite-is-its-hitbox rule holds untouched and its test passes unchanged. Rows 0–4 horns, 5–15 head,
16–22 torso and arms, 23–25 legs and boots. The proportions are the whole trick: a head at nearly the
full 34px width over an 18px torso reads as a creature, where an evenly-proportioned little man at
34×52 reads as a distant NPC — the same lesson the Workplace figure taught at the other end (too
small reads as a child), applied to proportion rather than to size.

**One grid, two moods, and the mouth CURVES.** This is the part worth keeping. The old sprite swapped
colours on a straight three-row bar, so "angry" and "cleared" were the same mouth in two palettes.
Two new characters fix it for free: `u` is the mouth's top corner pair and `w` its bottom pair.
Scowling, `u` is dark and `w` is hide — the mouth is 26px wide at the top and 14px at the bottom, a
frown. Cleared, they swap and the same cells widen downwards into a grin. A second 442-cell grid would
have cost bytes the gate does not have; two palette entries cost nothing. Added `e`, a single
catchlight cell per eye, after the first rasterisation: an 8px block of flat dark reads as a dead
socket, and one pale cell in it reads as alive. A test measures the **span of the darkest non-outline
fill on rows 11 and 13** and asserts top > bottom while scowling and bottom > top once cleared, so a
future edit cannot quietly make both palettes identical and lose the expression.

**The brick.** `TILE_MATERIALS[2]` slate → `#7A5A3C` face / `#A2794F` highlight / `#2A1B10` mortar /
`#C29A66` edge. The risk here is screen 1, which is *also* brown (`#6E4C3A`) and sits immediately
before this one. They are separated by **material, not hue**: this one is lighter and more golden
(kraft/manila — filed paper stacked into architecture, which is the read the screen wants) on a clean
20×20 course at 0.1 speckle, where screen 1 is a rough 24×16 at 0.22. The unplanned win is that the
maze now silhouettes against the teal skyline instead of dissolving into it — the whole climb used to
be one blue-grey mass against a blue-grey sky, which is a legibility bug nobody had named.

**The archive wall, and why it is allowed back.** Pass 15 deleted a row of five suspended TAX/GST/…
boards from this backdrop on the grounds that signage was hanging *inside* the climb as noise, and
that the five words were the monsters' names. The owner has now asked for the row back, so the
reasoning had to change rather than be ignored: it is a **bounded band**, y 134–214, and the only
geometry crossing it is the top gallery (surface y=200) and the statutory wall — which paint *over*
it and give the screen the layered depth the reference has. Three numbers are load-bearing and are
written into the source:

- **bottom at 214** — 14px behind the gallery. Raise it and the wall stops reading as being behind
  the architecture; lower it and it starts covering the gallery's walkable edge.
- **labels stop at 130** — 8px clear of y=138, which is where the AUDIT monster's name plate sits
  when it is standing on that gallery (`box.y − 10` at `gy 5`). The two label layers must not touch,
  because a label on a thing that *moves* has to win against a label on the wall behind it. The
  cabinet labels are therefore also smaller, dimmer and cool grey.
- **first unit at x=200, seven units at a 150px pitch** — not eight from 128. The HUD's left column
  is opaque and reaches x≈194, so a first cabinet at 128 was 54px of art plus a label drawn entirely
  underneath it: invisible in game and invisible in the rasteriser, because the rasteriser has no HUD.
  The last unit lands at 1100, directly over where the clearance lift parks, which is what the
  reference shows. **A backdrop rasterised without the HUD will happily hide art behind it — check
  the DOM chrome's extents by hand.**

The names repeat (TAX, GST, AUDIT, LEGAL, ENTITY, GST, AUDIT) and that is the argument, not an
oversight: the same handful of filings, over and over, all the way across the frame.

**Two rasterisation defects that were invisible in the code.**

1. **The lift's travel cue was a 4px dashed hairline down a 400px shaft**, which read as a wire
   rather than as "this goes down" — the owner's reference draws a big arrow there. It is chunky
   descending chevrons now. The affordance has to be the size of the thing it is describing. Note the
   bound that came with it: a chevron is 24px deep, so the loop must fit the **whole glyph** inside
   `remaining` or the rail paints past where the plate can actually travel (a test pins that, and the
   first version failed it).
2. **A diagonal stepped at 4px and snapped to a 4px grid rasterises as a broken ladder.** The boom
   arm rises at 68°, so its vertical advance per 4px step is 3.7px — which `pxRect` rounded either
   on top of the previous cell or 8px below it, leaving gaps. Stride 3, snap 2: **the snap has to be
   finer than the stride for any diagonal drawn this way.** While in there, the arm was moved to grow
   from the creature's *hands* (cols 2/14, row 19 → ±13px, +38px) instead of from a point near its
   head; springing out of its face was survivable on a head-on-a-post and reads as a floating object
   on an animal with arms.

**Not changed, deliberately.** No gameplay number, no level geometry, no hitbox, no tuning value and
no level data — the maze plays exactly as it did, and `validate:levels` (structural + physics-aware
+ meaning) passes untouched. The `arm > 0.02` rule still means a scowling monster shows no barrier at
all, which is pass 15's owner call from their two reference shots and was left alone.

**Budget.** Real download **56.88 KB gzipped** (was 56.49) — this pass is ~+0.4 KB per payload for
seven filing units, the chevron trail and the new grid. The summed gate reads **110.7 KB of 90** and
fails, unchanged in nature: `check-budget.mjs` adds the ESM and IIFE builds together even though a
host loads exactly one. Still HANDOFF §7.1, still the owner's decision, nothing cut unilaterally.
Grepped the built bundle for every phrase written in this pass's comments (`archive brick`, `kraft`,
`catchlight`, `gremlin`, `filing`…): zero hits, while the seven cabinet labels and the five monster
names do ship, because they are drawn.

**Green:** typecheck + lint + **403 tests (40 files)** + build + build:site + validate:levels. Budget
gate **red at 110.7 KB of 90 summed, 56.88 KB real**. Changed: `src/render/scenery.ts`,
`src/render/maze.ts`, `src/render/maze.test.ts`. **Verified by rasterising** the full screen before
and after the badge (`/tmp/brrender/maze.mts`), the creature at 6× in both moods with the hero for
scale (`mon.mts`), and the three historical candidates side by side (`cast.mts`); grid row widths and
horizontal symmetry checked mechanically inside `mon.mts` — every one of the 26 rows is 17 wide and
mirrors itself, which is the check that makes a hand-authored grid trustworthy. **Not verified:**
nobody has played it, and the HUD's real extents over the archive wall have only been reasoned about
from `Hud.ts`'s layout, not seen in a browser.

---

## Pass 19 — Compliance, second attempt: the sketch's staircase, the GitHub creature, and signage off the sky

**Owner rejected all three parts of pass 18.** Verbatim: *"You still haven't used the staircase design
I wanted from the photo and the monster also you haven't pulled from github. I don't want these eyes
and mouth in the monster, see what we already had in github. I don't want the tax, audit and other
overlays in the sky rather on top of monsters."* Same reference view attached again. All three
corrections were right, and two of them were mine to have got right the first time.

### 1. The monster: it WAS on GitHub, and I looked past it

Pass 18 concluded there was "no monster on GitHub", which was true about *assets* and wrong about the
question. `Game.drawGates` on `origin/main` — the **deployed build the owner has been looking at** —
draws exactly what the reference view shows: a squat filing cabinet with drawer seams and, standing on
it, a pale rounded approval plate with **one dark bar straight through the middle**. Pass 18 saw that,
called it "a 6×5 pale pod with a dark slot", judged it not to read as a monster, and designed a horned
fanged animal instead. The owner's second note is the correction: the featurelessness *is* the design.
A rubber stamp on a cabinet is a colder and more accurate picture of compliance than a creature with
teeth, and "monster" was a name for the obstacle, not an art brief.

Rebuilt from `git show main:src/core/Game.ts`, scaled from that version's 5px cells to this one's
17×26 grid at scale 2 so the sprite-is-its-hitbox rule holds untouched: rows 0–13 the plate (rounded
corners, one `c` band through the centre), rows 14–25 the cabinet with three drawer seams. Only `H`
(plate) and `c` (slot) change between states — pale + dark red pending, mint + dark green filed. The
horns, brows, eyes, catchlights, fangs and the frown-inverting mouth corners are all deleted, and with
them pass 18's whole "one grid, two faces" argument.

**Guarded by a structural test, because this sprite has now been wrong once.** It measures the grid
rather than the pixels: no row of the plate may contain more than one run of `c` (a pair of eyes is two
runs on one row), the rows that contain `c` must form one contiguous band (an eye band plus a mouth
band is two), and the plate is built from `.KHc` and nothing else. That fails the moment somebody draws
a face on it again.

The boom arm moved with it — from the horned version's "hands" (±13px, +38px) back to the cabinet's top
corners (±11px, +28px), which is where `drawGates` hung it (`armY = topY + PX * 2`) and the only place
on this silhouette where a barrier *can* be held.

### 2. The signage: rejected in the sky twice, so it is on the monsters

Two passes have now put TAX / GST / AUDIT / LEGAL / ENTITY into the upper frame — pass 15 as five
suspended boards (removed), pass 18 as a wall of seven labelled filing cabinets (removed now) — and
the owner has rejected both. The reason is the same one pass 15 wrote down and pass 18 overrode: those
five words are the *monsters'* names, so a copy of them hanging behind the climb is a second, duller
label layer competing with the one that matters. **`drawFilingWall` and `drawFilingUnit` are deleted
and there is a comment in `drawSceneBackground` saying not to put them back.**

They live on the monsters instead, and got promoted while moving: the name plate was scale-1 text with
an outline, and is now the **framed plaque** the cabinets were carrying (scale 2, solid dark ground,
cool grey pending / mint cleared). It is the only signage on the screen besides the stage sign, so it
can afford to be legible. `PAYROLL` was renamed `GST` so the five plaques read as the five words in the
owner's reference.

### 3. The staircase: this is what "the staircase design from the photo" means

The gap pass 18 missed entirely. The sketch's flights are **long, thin, shallow diagonals with open
sky under them**. The build's were four single columns each filled solid to the ground (`h` 1/2/3/4),
which rasterises as a stack of blocks, and they sat against an 11×8 filings slab — between them the
bottom-right two thirds of the frame was one unbroken mass of stone. Re-cut:

- both flights are **one tile thick**, so the skyline shows through underneath;
- the lower flight's treads are **two columns wide**, so it rises 40px per 80px and reads as the long
  shallow diagonal the sketch draws rather than as a 1:1 zigzag;
- the filings slab is **7×5** instead of 11×8;
- the upper flight is contiguous (gx16–19) into the gallery, so it reads as a flight rather than as
  stepping stones.

**Two-column treads needed a data change.** A monster walking that flight has to step up every
*second* column. `slope` alone cannot say that — `slope: -0.5` puts the surface on half-rows, i.e.
stands the monster 20px inside the stone, which is the same class of defect the `badgeFloat` rule
exists to prevent. Added `slopeRun` (columns per tread, default 1): `surfaceTop` divides by
`T * slopeRun`, so the row stays a whole number.

**Three geometry failures, found by machine, in order.**

1. **`validate:levels` refused the first cut: "exit not reachable".** The upper flight's first step had
   been placed at gx15 gy7, directly above the gx15 tread the player jumps *up-left* from to reach the
   registers platform. Rising to feet-320 there puts the player's head at 276 and the step's underside
   is at 320 — the one move the whole switchback depends on was walled off by a step 160px above it.
   **A step over a tread is not just a headroom question: it can block a jump that starts on that tread
   and lands somewhere else entirely.** Moved to gx16.
2. **The pocket probe found a soft lock: 1,488 trapped states.** This is the price of thin treads and
   it is worth stating as a rule. Thinning the flight opened a strip of *ground* underneath it
   (x520–680), bounded on the left by the underside of the second tread — 40px of clearance against a
   44px player, so not walkable — and on the right by the block's 200px face. The player could only
   enter it by falling off the flight, and could not get out: every upward escape was blocked by the
   treads themselves. From the strip's ground the best available jump reached feet-460 against a top
   tread at 440, 20px short. Fixed with **one 40×40 step at the block's foot** (`step-resubmit`,
   gx16 gy13): ground → 520 → the top tread at 440, two 80px hops. It is not a shortcut, because the
   strip cannot be walked into in the first place — the flight's lowest tread is solid to the ground.
   Re-probed: **0 trapped of 60,001 in-frame states.**
   The probe also had to learn a distinction pass 18's did not: states off the left/right end of the
   ground are **falls**, not pockets — no floor, so they leave the world and `forceSetback('fall')`
   books them. 586 of those, correctly ignored. Counting them as pockets is what made the first run
   report 2,069 "trapped" states at gx −0.8.
3. **The headroom sweep caught an 80px ceiling** over the block's left column, where a two-wide upper
   step overhung it. Fixed by moving the step, then deliberately re-introduced when the upper flight
   was made contiguous — it is the same 80px the shipped build has always had at that corner, the
   player only ever *walks* there, and the probe reports 0 trapped states with it in place.

The probe (`/tmp/brrender/pocket.mts`) now answers all three questions in one run: trapped states by
grid cell with a grounded/airborne split, the no-ground-route control run (reaches x=652 of an exit at
1240 — the block's left face, exactly), and headroom per tread against the 84px rule.

**Also re-cut:** every monster corridor and every route, because every surface moved. TAX on the ground
(gx7–8), GST up the lower flight (gx9–15, `slope -1`, `slopeRun 2`), LEGAL on the registers platform
(gx9–14), ENTITY on the block (gx17–22), AUDIT on the gallery (gx20–23); gather moved to gx20 gy10.
Routes were re-authored corner by corner so each monster still walks the player's own stairs home.

**Budget.** Real download **56.55 KB gzipped, down from 56.88** — deleting the archive wall paid for
the new grid, the plaques and `slopeRun` with change to spare. Summed gate **110.1 KB of 90**, still
red for the same measurement reason, still §7.1. Grepped the bundle for this pass's prose (`re-cut`,
`soft lock`, `resubmit`, `pocket`, `PENDING`): zero hits; the `step-resubmit` role is stripped, and the
five drawn names ship as they must.

**Green:** typecheck + lint + **403 tests (40 files)** + build + build:site + validate:levels.
Changed: `src/data/{levels.json,levels.ts}` + the root `levels.json` mirror,
`src/world/Hazards/ComplianceMaze.ts`, `src/render/{maze.ts,maze.test.ts,scenery.ts}`,
`src/core/screen2.test.ts`, `src/data/tuning.config.ts` (+ root mirror, comment only).
**Verified by rasterising** the full screen before and after the badge and the creature at 6× in both
states with the hero for scale; grid row widths and symmetry checked mechanically (all 26 rows 17 wide
and self-mirroring). **Not verified:** nobody has played it, and the re-cut changed every jump on the
screen — the switchback's tightest move is still the 120px up-left jump onto the registers platform,
now taken from gx15 rather than gx12.

**The lesson worth carrying, and it cost two passes:** when the owner says "use the thing we already
have", the job is to *find and reuse* it, not to evaluate it. Pass 18 found the right artefact, judged
it, and replaced it — and then wrote 40 lines of comment explaining why the replacement was better.
The owner had already answered that question by asking.

---

## Pass 20 — Hire Under Fire, third build: a Godzilla on the ground, one cone of fire, and the badge on a brick

Seven owner instructions, all on screen 4, and every one of them removes something:

1. **"Bring the dragon on feet and on ground, two feet on ground — don't show wings, more like a
   Godzilla that throws fire."**
2. **"Remove the fireball concept; instead a straight growing slightly diverging throw of fire."**
3. **"The labels of the fires can change and those labels don't move forward, they are there"** — one
   taunt per burst, pinned over the lane, replaced by the next burst's.
4. **"The ANSR badge can fall on a square brick which is floating and the player has to jump to grab
   that."**
5. **"When the costume of the dragon goes off there should be no dragon structure visible, just the
   disintegrated costume on floor."**
6. **"The dragon would just wear glasses, no jacket and tie."**
7. **"Remove the small glowing particles floating on the screen"** and **"remove the small hurdle in
   the middle of the screen."**

Mid-pass the owner attached a **reference image**: a Perler-bead Godzilla — upright, no wings, thick
legs, small arms, an enormous tail lying along the floor, dorsal fins down the spine. That image
changed the *method*, not just the shape (see "the grid decision" below).

### The beast: one grid, against the standing invariant

§6 says "a big creature is composed, not authored as one grid", and the previous build obeyed it: a
22×16 head grid plus a 16×13 wing grid plus `pxRect` runs for torso, neck, tail and legs, with a
`mirror()` helper threaded through every horizontal placement because stepped runs cannot be flipped.

Rasterised standing up, it was a **hunched lizard**. Three rounds of moving the runs around (pulling
the head back over the hips, splitting the legs, thinning the tail) improved it and never fixed it,
because the problem was not the parts, it was that a composer cannot see a silhouette.

So the rule was amended rather than followed. The beast is now **one 30×24 grid at scale 10**
(300×240px), and the four reasons the rule exists do not apply to it:

- the creature **is** a silhouette — no clothing to register against it, so a composer buys nothing;
- 720 cells, not 1,520, and every row is a handful of runs;
- a row of the wrong width is caught **mechanically** (a test measures the grid), so the
  "invisible until it rasterises" failure cannot happen;
- and one grid **mirrors for free**, which deletes the entire `mirror()` apparatus and the class of
  bug it existed to prevent.

The grid itself was produced by a throwaway **block-model generator** in `/tmp` (fill rectangles for
head/neck/torso/arms/hips/legs/feet/tail, then derive the outline by a boundary pass, then the
values, then the fins), and its *output* was pasted in as literal strings. That is the part worth
keeping as a technique: authoring a 720-cell silhouette by hand is a day of counting; authoring the
twelve rectangles it is made of, and iterating on the numbers against a PNG, took three rounds.

**It also had to get much bigger.** At the old 200×190 the upright pose had no room for legible legs,
arms, fins *and* tail — the lower half rasterised as one mass. It is **260×240** now: five drawn
heroes wide, four tall.

### Three art defects the rasteriser caught and the code could not

- **The crag had to go.** `scenery.ts` drew a scorched outcrop at x≈1080 — authored when the dragon
  *hovered* over that end. The beast now stands in exactly those columns, and two dark warm masses in
  the same place are one mass: the animal lost its silhouette completely and its head read as a hole
  in the rock. Deleting the crag put it back against the sky. **A backdrop that framed a flying boss
  will swallow a standing one.**
- **The glasses were a welding mask.** Sized to the *head* (8 cells wide, lower bar on the jaw row)
  they rasterised at scale 10 as an 80px band strapped across the whole muzzle, hiding the teeth as
  well as the eye. Sized to the **eye** (3 cells of lens, bars above and below) they are glasses.
- **The fire covered the face.** With the cone's apex at `MOUTH_X_FRACTION` 0.23 — inside the head —
  the near end of the flame painted over the skull. The apex is at the **snout tip** (0.44) now, so
  the beam leaves the jaw instead of engulfing it.

### The fire: a cone, and the arithmetic that sizes it

Gone: `Stream` (a poured column), `Wave` (rolling labelled flame fronts), `WAVE_INTERVAL/SPEED/W/H/
RANGE/FADE`, `STREAM_W`, `STREAM_REACH`, `drawFireWaves`. **Nothing on this screen travels any more.**

What replaced them is one `FireState`: an apex at the jaw, a target on the floor `CONE_REACH` in
front of it, an `extent` that grows over `CONE_GROW`, and a divergence from `CONE_NEAR_H` to
`CONE_FAR_H`. `Dragon.coneBoxes()` cuts that into `CONE_SEGMENTS` stepped AABBs, and **the simulation
collides against exactly the boxes the renderer paints** — the `badgeFloat` rule applied to a hazard.
A cone is not an AABB and both dishonest ways round that cost the player: one box over the whole
thing is lethal where there is no flame, a box round the axis alone is flame that cannot hurt anybody.

Four numbers had to be solved together, and the chain is worth writing down because it is not
obvious in either direction:

- The jaw is **high** (a Godzilla's skull is the top of the silhouette), so the flame takes a long
  while to come down to head height. **A high jaw makes the lethal lane *shorter*, not longer.** At
  `MOUTH_Y_FRACTION` 0.21 the cone only reaches a standing head about 37% of the way out.
- So the lethal strip is `CONE_REACH × 0.63`. At the first guess (480px) that was 300px ≈ 1.25s to
  walk clear of, against 1.75s of safe floor per cycle — comfortable for a blind sprint.
- Raising the reach to **560** and the near thickness to **72** gives ~350px ≈ 1.45s.
- The safe floor is `BURST_GAP + BURST_WINDUP`, and `BURST_GAP` came down 1.1 → **0.95** to make it
  1.60s. The crossing has to be *possible* and *not free*: 1.45 against 1.60.
- And the cone's **growth is the slack that makes it fair**: the far end — the end the player is
  standing at — ignites 0.3s after the near end, so the real window at the outer end is ~1.9s.

**The blind sprint still walked it, and the fix was a timing one.** `ROAR_TIME` (1.8s) plus
`BURST_WINDUP` (0.65s) is 2.45s of guaranteed safety = 637px, further than the whole lethal strip; add
`BURST_GAP` on top and a player who holds "right" from the spawn is past the lane before anything is
alight. **The roar is now the gap before the first burst** (`this.t = D.BURST_GAP` on leaving `roar`),
which puts the first flame down while a sprinter is still inside the lane and costs a reading player
nothing — a roar *is* 1.8s of warning. With that, the blind-sprint probe books a delay and the
reading probe crosses clean.

The reach still varies per burst, but **one-sided now** (`0.88 + 0.12 × roll`, never above the
nominal). `CONE_REACH` is measured against what must stay *out* of the fire — the spawn, and the drop
column behind the player — so a roll that could overshoot it would put flame on a brick the player is
standing under about one burst in two, which the telegraph never promised.

**The crossing policy is the claim, so the test states it:** wait just outside the far end of the
lane, and commit the moment a burst ends. A player who only ever walks during the *gaps* oscillates
and never crosses (0.95s ≈ 247px against a 350px strip). Gap **plus** wind-up plus growth clears it.
So the wind-up, which reads as the moment to freeze, is in fact the safest part of the run.

### The label: a caption, not a passenger

One taunt per burst, fixed at commit time, drawn at `labelAt` and never moving (owner call). Its
height is **derived**, and the first derivation was wrong: taken from the far end of the cone it
rasterised 4px inside the flame near the jaw, because the cone's top edge is highest *at the jaw*
(the axis starts there and only falls). `mouth.y − CONE_NEAR_H/2 − 44` is the top of the whole shape
plus clearance.

### The badge on a floating brick, and the one-tap cost

`badge.restGy` (12) plus three solids with `role: "pedestal"` at the drop columns. `badgeDrop.ts`
rests the badge on that row's top face instead of on the ground; `Screen.propRects` now collects
`pedestal` instead of the deleted `hurdle`; `drawFloatingBrick` paints them (stone, cyan studs, a
shadow on the floor so they read as floating); the stripper keeps the new role; and the validator
gained a rule — **every drop must have something directly under it**, or it is a badge hanging in
mid-air on a screen that deliberately has no such mechanic.

Row 12 is the only row that works, and both bounds are tight:
- **underside** at y=520 against a standing head at y=556 — 36px of clearance. One row lower and the
  brick is a **wall across the only route on the screen**;
- **top** at y=480 puts the badge's box 76px over that head: a jump of 76 against 140 available.

**The brick's left face is the trap, and it cost a debugging round.** The badge box is exactly the
40px above the brick, so to overlap it the player's box must sit in 440–480 — and any box bottom in
480–520 is *inside the brick's side*, where the horizontal move is blocked. A running player whose
jump is cut short arrives with his feet 5px below the brick's top and is stopped **one pixel short of
a badge box he is already level with**. Clearing the brick needs ~76px of rise *before* reaching it,
which needs most of the arc. The one-tap test therefore holds the button 20 frames (0.33s) where the
rail screens' equivalent holds 12 — that is a measurement the geometry forces, not a fudge.

**The touch cost is real and is now the screen's biggest open question.** On the floor, an auto-run
player collected this badge by walking into it. On the brick he has to jump — and he gets **one
chance**, because by the time the second delivery arrives (4.8s later) an auto-runner has left the
frame. The swept-tap gate says the window is one contiguous ≥0.3s band inside the first delivery's
life, so it is makeable; whether it is *discoverable* on a phone is §7 material.

### The costume, and what is left when it is gone

Four garments became **one pair of glasses**. `HITS_TO_STRIP` stays 4, so the hits now read as
progressive damage to the same object: clean → one crack → two → three, then the frame fogs, slides
down the snout and goes. The pips over the beast are unchanged.

And **the beast goes with it** (owner call). The previous build held the undressed animal at 0.32
alpha, which read as a defeated lizard standing behind the five people who are the actual payoff.
`beaten` now paints *only* `drawCostumeWreck` — a bent frame, a cracked lens, the puddle the cannon
left — and `stripping` cross-fades the animal out as the heap builds, so one becomes the other rather
than one being swapped for it.

### The two deletions

- **The rising embers are gone.** Fourteen small glowing cells drifting up the frame read as specks
  of dirt on the screen, and on a screen whose only hazard is fire, loose warm dots in the sky are
  also fourteen things that look like they might hurt you. The ground shimmer stays — it is *on* the
  floor rather than floating over it.
- **The mid-screen hurdle is gone**, with `drawPaperDrift` and the `hurdle` role. A boss screen did
  not need a paper heap to hop.

### Five test-suite failures that were about the *tests*, not the game

Worth recording, because four of them were the same mistake: a rule phrased in terms of the rail,
applied to the one screen that has no rail.

- `badgeReach.test.ts` and `setbackLog.test.ts` both measured **every** screen's badge with
  `badgeLowestBox`. On the drop screen that reads `gy` — the *drone's flight row* — as if the pickup
  hung there: 161px over a standing head, failing for being correct. Both now split rail from drop,
  and the drop screen gets its own clearance test against `dropRestBox`, on **every** column.
- `golden.test.ts` teleported to the exit while `sim.badgeBox` was still null, so it cleared screen 4
  before the badge had been delivered and reported three capabilities instead of four. It now waits
  for the delivery.
- `badgeDrop.test.ts` expected a `gone` phase inside one cycle. It cannot always be there: the
  release time grows with the column's distance across the frame, so `release + FALL + LIFETIME` can
  land past the end of the cycle and the next drone takes over while the old badge is notionally
  live. Harmless, now pinned deliberately on a column released early enough.
- The cone's "never paints outside its hitbox" test caught the **taunt plaque's glyphs**, which are
  painted in the same cream as the flame core and are 2px wide. Filter by cell size, not by colour.

### Result

**441 tests (41 files) green.** typecheck, lint, `validate:levels`, `build`, `build:site` all green.
Real download **57.5 KB** gzipped (up 0.9 KB from 56.6 — the grid and the brick cost a little more
than the deleted waves and wings saved). The summed budget gate reads **112.0 KB of 90 and fails**,
which is the same §7.1 measurement question as the last three passes, unchanged and still the owner's
to answer. No prose shipped: the bundle was grepped for every phrase written into `levels.json` this
pass, and the drawn `taunts` and the `pedestal` role both survive the stripper as they must.

- **Four owner notes in one pass: the clock plaque off the HUD, no badge on Reception, Reception rebuilt as an office lobby, and a lost life that shows no screen at all.** Every one of the four is a *deletion* — a plaque, a pickup, a sky, a dialog — which is the same shape as the last three passes. Notes worth keeping below.

  **(1) The TIME TO MARKET plaque is gone; lives took its slot, as hearts.** The clock was the loudest readout on the frame and it was static for most of a run: the only thing that moves it is a booked delay, which the delay log hanging directly under it already reports *with the reason attached*. Months are the argument the closing receipt makes; on the HUD they were a number with nothing to do. Lives are the opposite — they change, they are the stake of the next ten seconds — so they moved from the left stack into the right one, and the plaque now composes like the stage plaque opposite it (caption over content, mirrored). Deleted with the clock: `HudModel.months`, `HUD_PX.months`/`HUD_PX.unit`, the `clock*` DOM and CSS, `beam-run-bump`, and `COPY.hud.monthsLabel`/`monthsUnit`. The bump *behaviour* was kept and re-pointed: `beam-run-spent` flashes the lives plaque when a heart goes out, which is the event — the months were only its price. It is cleared unconditionally before it is re-added, because otherwise the reset to a full complement at the start of the next attempt inherited the flash from the end of the last one. The readout itself is hearts now (owner: "give a different look to life"): 7×6 cells, a *solid* heart for a life held and the **same silhouette hollowed out** for one spent, so the rule the old square pips existed for is untouched — shape carries the state, it survives greyscale, and the plaque cannot change width as lives are spent (a right-anchored readout that narrows slides the whole stack). Kept white, not the value orange: what you have left is what the obstacles have taken, which is the opposite of value. `pixelWidthPx` was split so its numeric twin `pixelArtWidthPx(cols, …)` can measure hand-built art too — the phone-frame overlap proof needed the hearts' 25 cells, and there is no string that is 25 cells wide.

  **(2) Reception carries no badge.** It held a `SAFE_PASSAGE` mark whose effect is deliberately unassigned, presented as the tutorial for "the levitating ANSR mark is always worth taking". Read the other way round, that is the first ANSR badge a player ever sees teaching them that taking one changes nothing — one screen before 1Wrk, where taking it is the difference between walking through the DENIED stamps and being flattened. The first mark in the run is now the one that saves them, and the three labelled steps are the tutorial (they teach the jump, which is all this screen has to teach). **This broke five things, and all five were the same mistake**: a rule phrased in terms of *every screen* having a badge. `validate-levels`' structural layer ("every screen, not just the hazard ones"), `badgeReach.test.ts` and `setbackLog.test.ts`'s `s.badge!` sweeps, `golden.test.ts` (which waits for a badge to arrive before clearing a screen — on a screen with none it waited 8000 frames and reported the run as unfinished), `screen4.test.ts`'s "every other screen has a box" list, and two `Simulation.test.ts` badge tests that happened to use screen 0's because `toPlaying()` starts there. This is the *third* time this class of failure has been paid for (the rail/drop split was the second): a rule about badges must exclude the screens that do not have one, or it fails for being correct. The validator's rule is now "every screen **with an obstacle** carries a badge", which is the thing that actually matters and is what the model has always argued.

  **(3) Reception is an office lobby, seen from inside** (owner: "an in-office kind of a setup… make it look like it is the inside of an office", and refined). It used to be a sky, a city skyline and a 120px desk standing in front of them, which is a street with a desk on it. It is now a room: coffered soffit with recessed downlights, full-height entrance glazing on the left with *daylight* and the market behind it, a lit feature bay carrying the real ANSR mark, a counter, wall panels, lounge seating, a two-car lift bank and planters. It has to stay distinct from the Workplace interior two screens later, and it separates on four things, none of them hue: a solid maintained ceiling vs a suspended grid with tiles missing; an entrance wall on the left vs a window band on the right; hospitality furniture vs workstations; and a value lighter throughout, because this room is lit and looked after. That contrast *is* the argument — the same building, before and after — which is why the screen is now the most finished-looking one in the game and why the "MARKET ENTRY: ON PAPER" sign still hangs over it.

  **Rasterising it caught six defects, five of them invisible in the code.** (a) The feature wall was authored *darker* than the room so the mark would be the lightest thing on it; that put a dark slab in the middle of the frame and left the desk — also dark — with nothing to read against. Lighter wall, dark desk: the counter gets a silhouette, which is the only reliable way to make a prop read at this size. (b) The wall was ruled every 44px and rasterised as a roller shutter; two panels do the job. (c) The downlights hung *below* the soffit and read as eight pendant blobs; recessed into the ceiling they read as lit holes, which is what says "maintained". (d) Their stepped light cones — three low-alpha rectangles each, chosen because hard steps are more 8-bit than a gradient — rasterised as eight grey *objects* suspended in the room. **Deleted: light in this idiom has to be a surface, not a beam** (the cove behind the desk and the daylight in the glazing do the lighting now). (e) The polished floor material had speckle, and every dot of it read as litter on a floor whose whole job is to look swept; it is the only material in the game with `speckle: 0`. (f) **Everything was at three times human scale.** The wall above the ground band is 600px, so furniture sized to fill it comes out enormous: the first counter was 88px against a 60px drawn hero — a reception desk half again the height of the person being served at it — and the sofa back was taller than a person could sit against. Anything a person *touches* is now measured against the drawn hero (counter at his eye line, seat at his knee); only the architecture (the 170px lift openings) is oversized, deliberately, because a 75px door in a 600px wall reads as a hatch. Also: the first counter ran under the tutorial steps at gx 9 and gx 16, so a step you have to jump merged into the furniture, and the left planter was authored in the 24px of free floor between the entrance frame and the first step, i.e. drawn entirely behind it and invisible.

  **(4) A lost life shows nothing; only the last one does.** `LIFE_LOST` still exists and still books the delay, but with lives left the host now paints **no overlay at all** — the state is the beat the impact is drawn on (the hero flat under the DENIED stamp, or wrapped in the Workplace tape), `LIVES.LOST_HOLD` came down 2.6s → **0.9s**, and the stage restarts from its own title card. The HUD deliberately stays up through it, because the heart going out *is* the feedback and hiding the plaque on the one frame it changes would be hiding the news. The one thing the deleted screen said that mattered — take the ANSR badge — is now a single orange line under the stage name on the retry's title card, driven by a new `Simulation.retrying` flag that `loadScreen` clears (so a stage reached by *playing* never inherits it). Nothing is lost for a screen-reader user: the delay was always announced through `onSetback` → `hud.announce`, which is a live region rather than a dialog.

  **The out-of-lives screen is now four things on one axis** (owner: less text, symmetrical, less cognitive load): the headline, one figure ("3 delays cost 6 months"), the argument that figure is evidence for, and two routes onward. Deleted from it: the cause line ("the build stalled at Compliance" — the player just watched it), the lives readout (there are none left, so it was three empty hearts saying nothing), the **itemised ledger** (the same breakdown is on the closing receipt, where it is read rather than skipped, and here it was a table competing with the instruction), and the two-column split. `buildLedger`/`fillLedger`/`LedgerView`, the ledger CSS, `createLivesPips`, and `COPY.gameOver.reached`/`ledgerTitle`/`totalLabel` plus the whole coaching half of `COPY.lifeLost` went with them. The overlay was renamed `lifelost` → `gameover`, which is what it is now. One composition note found by dumping the composed `textContent` rather than by reading the code: the ghost CTA was the other end screens' sentence form ("See what closes the gap → GCC Opportunity Navigator"), which wraps onto two bitmap lines beside an eleven-character primary button and made the pair lopsided — it is the Navigator's *name* here, 25 characters, one line.

  **A pre-existing leak, caught by the habit rather than by the change.** Grepping the built bundles for a sentence written three minutes earlier found the new Reception note absent from `dist/` (the stripper works) and **present in `dist-site/`** — and so was every other note in the file, including the compliance maze's. `vite.config.site.ts` never had `stripLevelNotesPlugin`, and *that* is the build that gets deployed; the budget gate only measures `dist/`, so nothing ever reported it. One line to fix, **~5 KB gzipped off the live page** (site payload 64.1 → 58.1 KB).

  **Green:** typecheck + lint + **440 tests (41 files)** + build + build:site + validate:levels. Real download **57.6 KB** gzipped (up 0.1: the lobby's ~1.4 KB of art, less the clock plaque, the ledger and their CSS). Summed gate still red at **112.1 KB of 90** — unchanged §7.1, and the deleted code is why it did not go up. Files: `src/data/{tuning.config,copy,levels.json}` (+ both root mirrors), `src/ui/{Hud,LivesPips,Overlays,styles}.ts`, `src/core/{Simulation,Game}.ts`, `src/render/scenery.ts`, `scripts/validate-levels.ts`, `vite.config.site.ts`, and seven test files. **Not verified:** the game in a browser — the lobby was checked as a PNG at 1280×720 with two drawn heroes in it for scale, and both changed DOM surfaces were checked by composing their prose in jsdom, but nobody has played a lost life to see whether 0.9s reads as a beat or as a stutter. That is the one number in this pass that wants a hand.

---

## Pass 22 — Setup Delays refined: a stamp you can see, brick that looks laid, a hop between each pair, a badge that rises, and the delay flying to the log

Four owner notes, and unusually for this build only one of them is a deletion. Three are
*refinements* of things that already worked mechanically and did not work in the eye, and the fourth
adds the piece of connective tissue the lives model has been missing since it was built.

### (1) "The stamp is almost the same colour as the background"

Correct, and the raster says why. The stamps were painted in `#33505C` (body), `#25404A` (shade),
`#1E353E` (die) and `#2A3F49` (handle) — against a `#00212B`→`#05303a` sky and a skyline of `#042A33`
towers whose **lit windows were `#7FC4D2`, i.e. lighter than the hazard itself**. So the only part of
a rubber stamp that read at all was its white label panel: the frame, the turned handle and the rubber
die all dissolved into the city behind them, and what the player actually saw was a floating white
card with DENIED on it. This is the wrapped-figure-in-beige failure again — an object at a *different
point on the same end* of the value scale as its background is an invisible object — and the fix is
the same one: put the tool at the opposite end.

The whole stamp is light now: a pale machined frame (`#93B2BC`/`#6F919D`) round a near-white plate,
a near-black keyline (`#07121A`) round the outside, and the die at `#12181C`, the darkest value on
the screen. That buys three separate things, and they matter in different places: it is the lightest
field in the upper half of the frame (so it reads against the sky where it parks), it has a hard
outline against *both* the sky and the clay ground (so it still reads at the bottom of its stroke),
and the darkest value in the picture is the business end — the part that can cost a life. Nothing
warm was used; slate and graphite only, orange still reserved for value.

The other half of the same problem was the background rather than the stamp, so both were changed:
screen 1's skyline windows drop from `#7FC4D2` to `#3E7280` and its towers from `#042A33` to
`#032027`. `drawSkyline` is shared by four screens, so this is per-call and nothing else moved.

### (2) Cognitive load: two props and one sign, where there were four things to read

The middle column of this screen carried the floor sign, a wall clock, a framed PERMITS board **and**
that board's caption — stacked in the one strip of sky the player looks through while four stamps are
moving. The PERMITS board and its label are **deleted**: a form saying PERMITS behind four stamps
saying DENIED is the same sentence twice, and it is the duller copy of it.

Also deleted: the ghost `DENIED` printed on each ink pad at **scale 1**. Five pixels tall is below the
size anything in this game is legible at, so it never said the word to anybody — it read as a grey
smudge on the clay, four times over, on a floor that is already the roughest material in the build.
The pad itself (dark impression, bright print line, two flecks) marks the column, and now that the
stamps are visible the column is marked by the stamp too. Same reasoning trimmed the wind-up's floor
tell from four closing marks per side to two, and its print line from 8px of near-white to 4px: at
88px wide and 0.9 alpha it had stopped being a line and become a pale lump on the ground.

The clock was the opposite call — it is the one prop that says what the level is *about*, so it was
rebuilt rather than cut. It was a 32px box whose hands were drawn with `ctx.stroke()` at 2px, the only
vector strokes left in any backdrop, and at that size they were a grey fuzz inside a dark square: the
prop rasterised as a small window. It is now an 80px case on a bracket with a pale dial, twelve hour
ticks (the quarters heavier), and hands stepped out of whole `pxRect` cells — same idiom as everything
else on the frame, and unmistakably a clock in the PNG.

### (3) "Make the brick a bit more refined"

`drawBricks` had exactly one source of variation — per-pixel speckle — which is why every surface in
this game reads as one flat slab with dirt on it. Real brickwork varies **brick to brick**, and at
8-bit scale that variation is what says "laid by hand" rather than "tiled". Two opt-in options were
added (`faces`, a set of per-brick tones picked stably from `hash2`; and `bevel`, the shadow each
course casts on the one below), and screen 1 takes both. Opt-in matters: five other materials read
through the same function and none of them changed.

Screen 1's material then moved three ways, all in the same direction: a calmer, larger course
(40×20 rather than 24×16, which also puts the new hurdle blocks at exactly one brick wide and two
courses tall), speckle from **0.22 → 0.08** with the variation moved brick-to-brick, and the bevel on.
Noise directly under four slamming hazards is the last place it belongs.

### (4) A small brick wall between each pair of stamps

The stamps are authored in pairs (gx 7 + 12, gx 20 + 25) and crossing a pair was purely a timing
test. There is now one course of brick in the middle of each pair, one tile square: 40px against a
140px jump, i.e. a hop taken in stride, so the pair is a jump *and* a piece of timing.

**The column is the whole design, and it is not the obvious one.** A player who runs into the block
is pinned against its left face, and that resting place must not be inside a stamp's press — which is
96px wide, centred on the stamp column. At gx 9 the pinned player sits at x 332–360 and the gx 7
stamp presses 252–348: sixteen pixels of overlap, i.e. a wall that holds you under a stamp, which is
the unfair-not-hard failure this screen has already paid for once. The midpoint gx 10 puts him at
372–400 with presses at 252–348 and 460–556 either side, clear of both. The second pair needed the
same check and came out *off* its midpoint: gx 22 would pin him at 852–880 against the gx 20 stamp's
772–868, so it is gx 23.

The existing `wall-paperwork` block at gx 15 was left alone and the new ones are `hurdle-filing`, so
`screen1.test.ts`'s "two stamps, a wall, then two more" layout rule still finds the right solid.

### (5) The badge rises first, and does it slower

`badgeFloatOffset` was a **sine**, which means the mark entered every screen at the *middle* of its
band travelling **down**, and only reached the bottom of the swing three quarters of a cycle later.
The owner asked for up-then-down; it is a **cosine** now, so the badge starts at `+FLOAT_AMPLITUDE`
(the bottom of the band) and rises. `FLOAT_PERIOD` went 4.8s → **6.4s** — ~129 px/s down to ~97 px/s
over the same 310px band.

The band itself is untouched by both changes, which is what kept the cost at zero: `badgeLowestBox`
is still `anchor + amplitude`, so the validator's reachability proof and the "41px over a standing
head" clearance did not have to be re-measured. And the direction change is the *generous* one on
touch, not the harsh one: with a cosine the badge is at its most reachable on the frame the screen
starts, which is precisely when a one-tap auto-run player is walking towards it.
`badgeReach.test.ts` re-proves the window on all four rail screens and it still passes untouched.

One test had to move with it, and it is the right one to have: `setbackLog.test.ts` asserted
`badgeFloatOffset(0) === 0`. It now asserts the badge starts at the bottom of the band, is higher
0.4s later, and tops out at exactly half a period — three statements about the *shape* of the motion
rather than one about the phase, which is what the owner actually specified.

### (6) The delay flies from the place of death to the log

The gap this closes: a setback books two months, spends a heart and writes a row into a panel in the
top-right of the frame — and all three of those happen where the player is not looking, because the
player is looking at the hero who just got flattened. The cost was being *reported* rather than
*shown*.

So the obstacle's name and the figure are now written on the frame **over the body**, held there long
enough to be read, and then carried up into the delay log. The geometry is a new pure module,
`core/delayFlight.ts` (start, end, progress → position and alpha), which is why it can be tested
without a canvas and why the host only chooses colours. Three decisions inside it:

- **It holds before it travels.** `HOLD` is 30% of the flight. Without it the label starts moving on
  the frame it appears, and at 22 characters that is a thing you notice rather than a thing you read.
- **It arcs.** A label sliding diagonally across a level reads as UI drifting; a quadratic bezier
  lifted 90px above the straight line reads as something being carried.
- **It does not move under `prefers-reduced-motion`.** The label holds over the player and fades —
  the information is the message, the journey is the juice.

`DELAY_FLIGHT_TIME` is **0.8s**, and that number is bounded by something else entirely: `LOST_HOLD`
is 0.9s, after which the stage restarts and its title card covers the canvas, so anything still in
the air is thrown away unseen. A test states that relationship rather than the constant, so changing
either one fails loudly.

The plaque is cool, never orange, for the same reason orange is kept off the log itself: a ledger of
avoidable months is the opposite of value. And the string is the *same* one the log row uses
(`causeLabel(cause)` + the figure) with the unit spelled out — the whole point is that the player
recognises it when it lands. `DELAY_LOG_ANCHOR` is an approximation of a CSS-laid DOM position, which
is allowed here because the label fades as it arrives rather than snapping into the row; it flies
under the HUD plaque, which is exactly the read we want.

### Findings worth keeping

- **The raster caught the whole of (1) and (2).** Every one of those defects — the dissolved stamp,
  the illegible ghost word, the pale lump on the clay, the clock that read as a window — is correct
  in source and obvious in a PNG. This is the sixth pass in a row where that has been true.
- **A backdrop can outshine the hazard in front of it.** The skyline's lit windows were lighter than
  the stamps. Whenever a hazard is repainted, check the *values* of what is behind it, not just its
  own palette — and remember the shared generator (`drawSkyline`) takes its colours per call.
- **A wall's column is decided by where a player STOPS at it, not by where it looks tidy.** Both new
  hurdles were placed by measuring the pinned player's box against the neighbouring stamps' press
  boxes, and one of the two came out off its midpoint because of it.
- **Changing the phase of a motion can change its fairness even when the band does not move.** A sine
  and a cosine cover the same 310px; only one of them has the pickup at its lowest point when the
  player arrives.

### Result

**447 tests (42 files) green.** typecheck, lint, `validate:levels`, `build`, `build:site` all green.
Real download **58.2 KB** gzipped (up 0.6 from 57.5 — the brick options, the clock, the flight module
and one new plaque, less the deleted board and ghost text). Site payload **58.8 KB**. The summed
budget gate reads **113.2 KB of 90 and fails**, which is the same §7.1 measurement question as the
last four passes, unchanged and still the owner's to answer. No prose shipped: both bundles were
grepped for every phrase written into `levels.json` this pass and the new `hurdle-filing` notes are
absent from each.

**Not verified:** nobody has played this. The hop between a pair of stamps is proved to be a hop by
arithmetic and the screen is proved completable by the physics validator, but whether jumping a wall
*while* reading a stamp's wind-up is a beat or a scramble is a hand question — and it lands on the
screen §7.9 already calls deliberately punishing. The delay flight was checked as a PNG at seven
points along its arc; the 0.8s of it, and whether it lands where the log row actually appears at a
phone frame width, are both untested by anything but that image.

---

## Pass 23 — The stamps slam 27% more often, and the stroke paid for it

One owner note: *"make the stamps more frequent, it's too slow and the user can easily pass."* The
naive reading is one number — cut `CYCLE` — and it is wrong, because cutting `CYCLE` alone takes the
*safe* part of the cycle down with it faster than it takes the busy part down, and the screen stops
being crossable. So the pass is really: how much frequency can this geometry carry, and what has to
give to buy it?

### What was measured

A probe (`/tmp`, not shipped) drives screen 1 unassisted with **60 reactive policies**: five stand-off
distances × twelve start delays. Two things about its construction matter, and the first version of it
got both wrong:

- **The policy has to be able to retreat.** Stopping is not enough — a player who stops the instant a
  column becomes dangerous can already be standing *in* it, and standing still there is death. The
  policy now backs out to the left when a live column overlaps it, and only waits when it is short of
  one.
- **The phase has to be sampled.** Everything here is deterministic, so one run per policy measures
  whether that single alignment of player against stamp cycle happens to work. The twelve start delays
  are what turn "did this one run survive" into a rate. Before they were added, the current tuning
  scored 0/18 and a *faster* cycle scored 6/18, which is noise wearing a difficulty costume.

Also worth recording: my first probe reported 0/18 everywhere because clearing the screen leaves
`PLAYING` for the next stage's **title card**, and the loop treated "not PLAYING" as death. A probe
that cannot tell winning from losing will happily rank tunings for you.

```
cycle 1.80, safe 0.86s (1.80x crossing) -> cleared 22/60 (37%), fastest 6.7s
cycle 1.50, safe 0.70s (1.47x)          -> cleared 11/60 (18%), fastest 5.8s
cycle 1.45, safe 0.65s (1.36x)          -> cleared  6/60 (10%)
cycle 1.40, safe 0.60s (1.26x)          -> cleared 11/60 (18%), fastest 5.5s   <- committed
cycle 1.38, safe 0.66s (1.38x)          -> cleared  8/60 (13%)
cycle 1.32, safe 0.60s (1.26x)          -> cleared  0/60          IMPOSSIBLE
cycle 1.30, safe 0.58s (1.22x)          -> cleared  0/60          IMPOSSIBLE
cycle 1.40 with the stroke NOT shortened -> cleared 0/60          IMPOSSIBLE
```

**The clear rate in the 1.40–1.50 band is noisy (6–18%) and the cliff below ~1.38 is not.** That is the
finding. Between 1.50 and 1.40 the rate wobbles rather than declining, because which policies survive
depends on where the pair's alternation happens to sit relative to the walk; below 1.38 *nothing*
survives, at any ratio. So the honest reading is "1.40 is the fastest setting still inside the
clearable band", not "1.40 is 18% hard".

The other half of that: **at 1.32 the safe/crossing ratio is exactly the same 1.26× as the committed
1.40, and it clears 0/60.** The ratio is necessary and not sufficient, because the actual test on this
screen is not one column — it is **stamp → hurdle → stamp**, a ~0.8s traverse (200px plus a jump)
against a cycle that must hand you a window at both ends of it. Which is why the note in tuning now
says: anything faster than this needs the geometry to change, not the clock.

### What shipped

- `CYCLE` **1.8 → 1.4** — a **27% higher slam rate** (0.56 → 0.71 slams/s per stamp).
- `HOLD_TIME` **0.34 → 0.24** and `LIFT_TIME` **0.24 → 0.20**, i.e. the busy part of the stroke
  0.72 → 0.58. **This is what paid for the frequency.** A straight cut to 1.4 leaves a 0.46s safe
  window against a 0.48s crossing — under 1.0×, and 0/60. Compressing the stroke keeps it at 0.60s.
- `WARN_TIME` **unchanged at 0.22**, deliberately. It is the fairness half of the mechanism and it is
  now a *larger* share of a shorter cycle, which is the right direction: faster stamps need the same
  warning, not less. Probed at 0.26 for completeness — it eats the safe window and drops the rate to
  1/60.
- `ASSIST_TIME_SCALE` **0.26 → 0.18**, which is not a difficulty change but a *derivation*. What 1Wrk
  has to deliver is a window wide enough to stroll through, and that window is `safe ÷ scale`: leaving
  0.26 alone while the gap fell to 0.60s would have quietly cut the assisted window from 3.3s to 2.3s.
  0.18 restores it to **3.3s**, so the unassisted screen got harder while the capability stayed exactly
  as generous — the contrast between the two is the argument this screen makes, and it widened.
- Two new arithmetic guards in `screen1.test.ts`: the safe/crossing ratio may not fall below 1.25 and
  `CYCLE` may not go below 1.38; and the assisted window must stay over 3s and over 6× the crossing
  time. The probe is the real proof, but these stop the floor being cut by accident.

### The three test failures, and why two of them were luck

**`reset()` clears aborted strokes** failed for a mundane reason: it ran the assisted stroke for a
hardcoded **40 frames**, and the die has to fall ~84% of its travel (most of `DROP_TIME`) to touch a
standing head. At the old 0.26 scale 40 frames was 0.17s of hazard time — enough. At 0.18 it is 0.12s,
three frames short of contact, so a test about `reset()` failed on a number that had nothing to do with
`reset()`. It derives the count from `DROP_TIME / ASSIST_TIME_SCALE` now.

The other two are the interesting ones, and they were **passing on floating-point luck**:

- "winds up before it slams" required the press on the very next frame after the wind-up ended.
- "alternates rapid-fire" required that *no* frame has both stamps idle.

`CYCLE / DT` at 1.4 is a whole **84**, and half of it a whole **42**. So the clock lands exactly on its
own wrap, and at `e === 0` the press is 0 *by definition* — that is the instant the drop begins, not a
moment during it. One frame at the top of the cycle therefore reads as neither warning nor pressing.
At the old 1.8 the same arithmetic gives a whole 108 and 54 — but accumulating `e += 1/60` 108 times
lands on **1.7999999999999985**, which never reaches the wrap, so the frame never existed and both
tests passed for four passes without anybody knowing why.

I could have dodged this by picking 1.42 (85.2 frames, not a whole number) and both tests would have
gone green untouched. That is the wrong fix: it encodes "CYCLE must not be an exact multiple of the
timestep" as a hidden constraint nobody would ever find. The tests now state the properties in a way
that survives the wrap — the wind-up must run into the drop *with no idle gap*, tolerating the single
wrap frame, and "both idle" is capped at one frame of 84 — with the reason written down in both.

### Findings worth keeping

- **A tuning number and its stroke are one decision.** `CYCLE` is `busy + warn + safe`; changing it
  without deciding which of the three absorbs the change is how a hazard becomes impossible.
- **A safe/crossing ratio is necessary and not sufficient.** Two tunings at 1.26× differ by
  everything, because what the player crosses is the whole *pattern*, not one hazard.
- **A probe that cannot tell winning from losing will still rank your options.** Check the exit
  condition before believing a sweep, and sample the phase or you are measuring one alignment.
- **A test that passes on float drift is a test that has not been run.** Whenever a period becomes an
  exact multiple of the timestep, expect the wrap frame to exist for the first time.

### Result

**449 tests (42 files) green** (two added). typecheck, lint, `validate:levels`, `build`, `build:site`
all green. Real download **58.2 KB** gzipped, unchanged — this pass is five numbers and a lot of
comment, and comments do not ship. Summed gate still red at 113.2 KB of 90: unchanged §7.1.

**Not verified:** nobody has played it. What the probe can say is that the stage is still clearable
unassisted and that the fastest clear got *quicker* (6.7s → 5.5s), i.e. a competent player is not
slowed down by this, they just have less slack. What it cannot say is whether 0.71 slams per second per
stamp reads as "rapid fire" or as "unfair" in the hand, and the honest risk is that this screen was
already flagged as deliberately punishing (§7.9) before it got 27% faster. If it is too much, the first
thing to move back is `CYCLE` toward 1.5 (safe 0.70s, 18% on the same probe) — not `WARN_TIME`, and not
the gaps between the columns.

---

## Pass: the compliance creature, pulled from GitHub for real this time

**The note.** "For the small moving creatures of compliance screen we had made a version which is on
github and the local one is a new one I don't like this — I want the variant of the creature that we
have on github." Two things in that sentence had to be taken literally and one of them had been
missed twice: **"small"**, and **"the variant that is on github"** — meaning the artefact, not a
description of it.

**Where it was.** `origin/main` is `4c9461d`, the same commit as local `HEAD`; the entire compliance
rebuild is in the *working tree*, uncommitted. So the deployed creature is not in history behind a
branch — it is `Game.drawGates` plus `world/Hazards/Gates.ts` at `HEAD`, both of which the working
tree deletes. `git show HEAD:src/core/Game.ts` had it in ~50 lines.

**Why the last pass was wrong even though it thought it had done this.** The previous pass had already
been told "pull the monster we have in github" and had written a module docstring saying it was
"transcribed from `git show main:src/core/Game.ts` rather than remembered". What it actually
transcribed was the *palette* and a *description*: `#CFE6EC` plate, `#3A1414` slot, `#4E7280`
cabinet, "a rounded pale plate with one dark slot, on a filing cabinet, no face" — all correct — and
then it re-authored the shape as a 17×26 grid at scale 2 (34×52 px) because that was the hitbox it
had already chosen. The deployed creature is **30×30**. A squat 30×30 stamp stretched to 34×52 is a
parking meter with a stamp on it; the owner's word for the difference was "small".

**What the deployed build actually draws**, in its own 5px cells: a 20×30 cabinet post standing on the
ground with a lit top course and two drawer seams; a 30×25 plate over it
(`' HHHH '`/`'HHHHHH'`/`'HccccH'`/`'HHHHHH'`/`' HHHH '`); and a 35×10 striped boom arm at
`armY = topY + PX*2 - open*PX*7`, each segment lifted a further `open*seg*0.55`. Two things only a
raster tells you about that code:

1. **The plate covers the whole post except its top course.** The drawer seams are painted and then
   completely hidden. So the visible creature is a plate with a blue-grey cap — which is why the new
   grid is 6 rows: one row of cabinet cap and the five plate rows, verbatim. Reproducing the seams
   would have been reproducing dead pixels.
2. **The boom is painted *before* the plate**, so at rest it is hidden behind its own head and only
   its end cell shows as a nub at the shoulder. That is the single detail that makes the pending
   creature read as a rubber stamp. My first attempt at this pass drew the arm on **top** (reasoning
   that "a barrier invisible while it blocks is a bug"), rastered it, and got a plate with a white bar
   across it — a different object, and visibly not the one on GitHub. Draw order reverted to the
   deployed order; the reasoning was sound and the picture was wrong, and the picture is what was
   asked for.

**What shipped.** `render/maze.ts`'s monster is now `MONSTER_SCALE 5` and a 6×6 grid
(`.LLLL.` / `.HHHH.` / `HHHHHH` / `HccccH` / `HHHHHH` / `.HHHH.`), `HAZARDS.MAZE.MONSTER_W/H` are
**30/30** in both `tuning.config.ts` mirrors, and the boom is drawn in both states behind the plate,
sized to exactly the hitbox width and ending flush with the feet. Two deliberate departures from the
deployed code, both about fairness rather than looks: the deployed arm was **35px wide on a 26px
hitbox and hung 4px below the feet**, i.e. a blocking obstacle painting lethal-looking pixels outside
its own collision box and into the floor. Inside the box it is 30px and stops at the feet. Raised it
leaves the box, which stays legal because a friendly monster cannot cost anything.

**The defect the raster caught in my own version.** With the creature 22px shorter, the raised boom
(21–32px above the plate) landed exactly where the name plaque sits, and the first screen-2 raster
showed five booms hidden behind five name plates. The plaque now steps up with the arm
(`box.y - 26 - arm*34`), which also reads as "something changed" on the frame where the badge lands.

**Tests.** 450 (was 449). `maze.test.ts`'s "the sprite is the hitbox" test passes unchanged and now
means something different, which is the point of writing it against the constants. Three tests were
restated rather than deleted: the "no face" structural test measures the whole grid instead of a
14-row slice (still: at most one run of slot cells per row, and the slot rows are one contiguous
band); "shows no barrier while it scowls" became **"hides the boom behind the plate while it
blocks"**, and it asserts the draw *order* — every stripe cell is painted before the first plate cell
— because order is the thing that is easy to lose in a refactor and impossible to see in a diff. One
test was added, and it is the one that should have existed two passes ago: **`MONSTER_H` must be less
than `PLAYER.HEIGHT`**, plus square. "Small" is now a number.

**Gameplay consequences, checked not assumed.** The hitbox is derived from the same constants
everywhere, so the corridor ends (`m.from*T + MONSTER_W/2`), the settle spacing and the physics-aware
validator all followed automatically: `validate:levels` is green on all six screens, and screen 2's
nine tests (including "touching a monster costs months and a life", which relies on a standing player
overlapping a monster's box on the same floor) pass with a box that is 22px shorter. A smaller lethal
box is strictly more permissive, so nothing on this screen got harder. `GATHER_SPACING` stays 40,
which is still wider than the new `MONSTER_W`; only its comment's arithmetic changed.

**Green.** typecheck · lint · 450 tests · build · build:site · validate:levels. Real download **58.1
KB** gzip (was 58.2 — the 6×6 grid is 20 rows shorter than the one it replaced), site payload **58.7
KB**, summed budget gate still red at **113.1 KB of 90** — unchanged and still §7.1, the measurement
question, not a regression.

**Open.** Nobody has played this screen by hand (§7.8 stands), and now the thing to look at is
whether a 30px creature is *too* small to notice on a phone at the far end of a corridor — the
opposite risk to the one that was just fixed. The name plaque is wider than the creature it labels,
which was already true and is more obvious now; if that reads as a sign with a toy under it, the
cheaper fix is the plaque (scale, or drop it once the player is close) than the creature, because the
creature is now the owner-approved artefact and the plaque is ours.

---

## Pass: the compliance creature, WHOLE this time — a floating head over a cabinet

**The note.** "Still you haven't brought the full version, I want exactly those creatures in the both
the states — which is on the github." The fourth rejection of this creature, and the previous pass had
transcribed the deployed drawing code cell for cell. It was still the wrong object, and the reason is
worth writing down carefully because nothing in the code review of either version could have caught
it.

**What was wrong.** `drawGates` positions its pieces from **two different anchors**:

- the cabinet post from `groundY = 15 * RESOLUTION.TILE` — the *screen floor*, hard-coded;
- the head and the boom arm from `g.topY`, which comes from the gate's **authored `gy`**.

And `git show HEAD:src/data/levels.json` authors all seven Compliance gates at **`gy 14`**, one row
above the floor. So on the deployed screen the pieces land at: head 535–560, boom 555–565, **a 5px
gap**, cabinet 570–600, feet at 600. The creature is a **filing cabinet standing on the floor with a
pale approval head floating above it** — 35×65 — which is exactly the "head on its slate post" the
owner described two passes ago. The previous pass rendered the same code with `groundY` and `baseY`
set to the same row, which stacks the head onto the cabinet and hides all of the cabinet but its top
course. That rasterised as a tidy 30×30 stamp, the raster was self-consistent, and it was 35px of the
creature short. **"Full version" meant: there is a body, and you only brought the head.**

**The lesson, promoted to `docs/INVARIANTS.md`.** Transcribing drawing code is not enough — render it
against the `levels.json` rows it was authored for. A sprite's identity lives in its code *and* its
data, and a raster is only evidence if the inputs are the shipped ones. Corollary worth keeping in
mind for any future port out of `Game.ts`: **a draw function that reads more than one anchor encodes a
layout decision in the gap between them.**

**What shipped.** `render/maze.ts`'s `MONSTER` is now a **7×13 grid at scale 5 = 35×65**, and every
piece is at the deployed build's own offset relative to the monster's feet:

```
rows 0–4   the head, verbatim: ' HHHH ' / 'HHHHHH' / 'HccccH' / 'HHHHHH' / ' HHHH '
row  5     where the boom lies while it blocks (drawn separately — it moves)
row  6     THE GAP — not padding; the head floats
rows 7–12  the cabinet: lit top course, face, and the two drawer seams at their own rows
```

The drawer seams are back, and they are visible now for the first time — in the 30×30 version they
were behind the head, which is why that version did not author them. The head is 6 cells wide against
the cabinet's 4, so it reads as wider than the body it rides on. Column 6 is used by nothing but the
boom, which is 7 cells (35px) wide: the grid is 7 rather than 6 **precisely so the deployed arm fits
inside the hitbox**, since the original drew a 35px arm on a 26px box. `MONSTER_W/H` are **35/65** in
both `tuning.config.ts` mirrors.

**Both states, which is the other half of the note.** Pending: pale head `#CFE6EC`, dark-red slot
`#3A1414`, boom down and tucked under the jaw with its ends showing either side. Cleared: mint head
`#9FE6C4`, dark-green slot `#0A3A2A`, boom swung up on the diagonal (`open * PX * 7` of lift plus
`open * seg * 0.55` per segment, so it pivots rather than slides). **The cabinet is the same slate in
both** — only the head changes, which is what makes the change read at a glance. Verified by rendering
mine and the verbatim original side by side at 4× in all three phases (pending, mid-lift, cleared):
identical to within one pixel of snapping on the raised boom.

**Kept from the previous pass** (both still right): the boom is painted **behind** the head, because
painted on top the pending creature is a head with a white bar across it; and the name plaque steps up
as the boom rises, since raised it reaches into the plaque's band.

**Tests.** 450, unchanged in count. `maze.test.ts`'s "is small — shorter than the hero" test was
**wrong about the thing it was pinning** and has been replaced: the full creature is 65px, taller than
the player's 44px hitbox, and "small" was only ever true of the head. What now guards it is the
structure that keeps getting lost — off the grid, so it cannot be lost silently again: a head block, at
least one **completely empty row**, then a cabinet block, with no cabinet cells up in the head and no
head cells down in the cabinet, the head wider than the cabinet, and the head alone under the hero's
height. That is the assertion I wish had existed two passes ago. The "no face" test's material set
grew to `.HcLPd`.

**Gameplay.** The hitbox went 30×30 → 35×65, so the lethal box is bigger than either recent version
(and 1px wider than the 34×52 it replaced two passes ago). Everything derived followed automatically:
corridor ends inset by `MONSTER_W/2`, gather spacing (40, still wider than 35), and the physics-aware
validator — **green on all six screens**, and screen 2's nine tests pass unchanged. Worth stating
plainly: a 65px-tall lethal box in a maze of 40px corridors is the tallest hazard body on the screen,
and it has never been played by hand (§7.8). If contact starts feeling unfair, the honest fix is **not**
shrinking the creature again — it is the corridor rows, because the creature is now the
owner-approved artefact.

**Green.** typecheck · lint · 450 tests · build · build:site · validate:levels. Download **58.1 KB**
gzip, site **58.7 KB**, summed budget gate still red at **113.1 KB of 90** — unchanged, still §7.1.

---

## Pass: the exodus is a walk now, and descents drop instead of floating

**The note.** "Make the movement of the creatures to the resting space a bit slow, right now it's too
fast and not natural."

**Why it was unnatural, in one number.** `HAZARDS.MAZE.GATHER_SPEED` was **420 px/s**. The player walks
at **260**. So the moment the badge was taken, five obstacles left the screen at **1.6× the speed of the
fastest thing in the game** — and at 2.4× their own top wander speed (`SPEED_MAX` 132). Nothing about
that reads as five creatures going home; it reads as them being deleted. The whole exodus was over in
**1.77s**.

**What it is now.** `GATHER_SPEED: 160`. That number is not a taste call — it is bracketed on both
sides by things already on the screen:

- **above `SPEED_MAX` (132)**, so it is faster than their aimless patrol: they are leaving with
  purpose, not dawdling;
- **well under `PLAYER.WALK_SPEED` (260)**, so the player can outpace them, which is what makes them
  read as bodies rather than as effects.

A probe over the real level data (five monsters, their authored routes, sampled after a beat of
wandering so the start positions are realistic) gives per-monster arrival times of **0.5 / 2.3 / 2.4 /
2.5 / 4.1s**, i.e. the whole exodus lands in ~4s instead of 1.8s. The far gallery (AUDIT) is the long
one, which is right: it has the furthest to come.

**The defect the slowdown exposed.** `walkHome` moved both axes at the same speed, and the comment
justifying that said a level change should read as "walking down a flight rather than sliding through
it" — true for legs that move a column per row (the staircase ones), and false for the two legs that
don't. LEGAL's `(14,8) → (15,11)` and AUDIT's `(16,7) → (15,11)` are one column across and three or
four rows **down**: the horizontal part finishes early and the rest is a pure vertical descent. At
420 px/s that was a 0.2s blur nobody could see. At 160 it is a creature **floating down a stair well**
for most of a second. So the leftover vertical part of a *descent* now falls, at a new
`GATHER_DROP_SPEED: 420` — which is the old walk speed, reused where it was always right.

Rules, kept deliberately narrow so the staircase read is untouched:

- while a leg still has horizontal ground to cover, both axes move at the walk → 45°, i.e. walking a
  flight, exactly as before;
- once the horizontal part is spent, a **downward** remainder drops;
- an **upward** remainder still walks, because a climb is a climb.

Traced off the frames: horizontal peaks at 160 (175 with the half-pixel end-of-leg snap), climbs at
160, and the two descents run at exactly 420 for 12 and 18 frames — 0.2s and 0.3s, a hop down a level.

**Tests.** 451 (was 450). One new, in `ComplianceMaze.test.ts`, and it measures the *frames* rather
than reading the constants back: nothing moves horizontally faster than the player walks, nothing moves
slower than the creature's own top wander speed, and a leg that ends in a pure descent falls faster
than it walks — with the fixture shaped like LEGAL's real route (one column across, four rows down),
because the existing `STAIR` fixture's legs cover more ground horizontally than vertically and so never
produce a pure drop. That is the whole point of the fixture: **a test for "it should not float" needs a
route that could float.** Two `screen2.test.ts` windows went from 300 to 420 frames — the exodus now
takes 4.1s and those assertions are about *arriving*, not about pace, so they had no business sitting
0.9s from the boundary. Pace is pinned in one place now.

**Green.** typecheck · lint · 451 tests · build · build:site · validate:levels. Download **58.1 KB**
gzip, site **58.7 KB**, summed gate red at 113.1 KB of 90 — still §7.1.

**Open.** 4.1s is now the longest single "watch this happen" beat on the screen, and nobody has played
it. If it feels slow *in the hand* rather than slow *on paper*, the number to move is `GATHER_SPEED`
alone (180 puts the exodus at 3.7s, 200 at 3.3s) — not `GATHER_DROP_SPEED`, which is what stops the
descents floating, and not the routes.

---

## Pass: docs audit — the handoff became a router, and what the repo hygiene sweep actually found

**Asked:** are there stale/dirty files anywhere; is the HANDOFF/JOURNAL system eating credit; is
there a better structure — and *don't* build one if it would cost more than it saves.

### The hygiene sweep — mostly clean, three real things

Measured rather than assumed. `find`/`git ls-files`/an orphan-module scan over `src` and `scripts`:

- **No orphaned source modules.** Every non-test `.ts` in `src/` is imported by something except
  `src/main.ts`, which is the Vite entry — a false positive. 116 tracked files, no dead code.
- **No stale build output tracked.** `dist/` (2.3 MB) and `dist-site/` (228 KB) are both correctly
  in `.gitignore`; `git ls-files | grep ^dist` returns 0.
- **`scripts/budget.mjs` vs `check-budget.mjs` is not duplication** — the first is the shared policy
  (`BUDGETS`, `evaluateBudget`), imported by both the gate and `budget.test.mjs`. Correct as it is.
- **The root `index.html` is NOT stale** — it was the first thing that looked it (dated Jul 25, while
  the rest of the tree is Aug 19). It is the production host-embed demo: it loads
  `./beam-run/dist/beam-run.iife.js` and calls `window.BeamRun.mount`. Leave it. Worth writing down
  because it will look stale to the next sweep too.

The three that are real:

1. **45 files uncommitted** — 32 modified, 6 deleted (`Hazards/{Fire,Gates,Spikes}.{ts,test.ts}`),
   and untracked new work including **`docs/INVARIANTS.md` itself**. `HEAD` is
   `4c9461d` "badge levitates as ANSR sunburst". So the maze rebuild, the dragon, the Workplace,
   the lives model and the invariants doc are **all** unversioned. This is the one genuine risk in
   the repo, and it also explains a note in an earlier entry ("`origin/main` is the same commit as
   `HEAD` — the whole maze rebuild is uncommitted") which has now been true for many passes.
   Not committed on this pass: not asked for, and 45 files is the owner's call to stage.
2. **`tuning.config.ts` and `levels.json` exist twice** — root and `src/data/` — and are
   **byte-identical today** (`cmp` clean). Nothing enforces that. The handoff says "update both",
   which is a human promise, not a check. A guard is possible but the parent folder is not always
   in the workspace (`beam-run/.kiro`'s own steering says to ask the user to open it), so a hard
   check would fail in a legitimate configuration. Left as a flagged hazard.
3. **The steering file exists twice** — `.kiro/steering/beam-run.md` (workspace root) and
   `beam-run/.kiro/steering/beam-run.md` — and they differ *by design*: one assumes the parent
   folder is the workspace root, the other assumes `beam-run/` is. That is deliberate and correct,
   but it means **every steering edit must be made twice**. Both were updated on this pass.

`.DS_Store` at the workspace root is untracked-and-unignorable (the root is not the repo) —
cosmetic, left alone.

### The credit question, with numbers

- `HANDOFF.md` was **48.6 KB / 592 lines ≈ 12,100 tokens**, and the steering makes it a
  **mandatory read at the start of every session** (and again after each context compaction).
  That is the single largest fixed cost in the project.
- It was also **2.4× its own stated cap** (~400 lines / ~25 KB), and §9 had already diagnosed why:
  every pass adds a per-screen entry to §4. §9 even named the fix — "move §4.9–§4.14 to a
  `docs/SCREENS.md` … do that before adding a seventh screen entry" — and it had been deferred.
- `docs/JOURNAL.md` is **248 KB ≈ 62,000 tokens**, but it is **not** a per-session cost: it is
  appended to, never read whole. The append-only design was already right. **Do not "clean up" the
  journal to save credit — it is not what costs.**

**Verdict: the system is worth keeping, and the answer was not to write less but to split it.** The
alternative to a handoff is re-deriving the architecture from ~110 source files every session, which
is far more expensive than 12k tokens and gets the owner's settled calls wrong. The waste was that
a session pays for *all* of the state to do *any* task.

### What was built: a router, not a dump

`HANDOFF.md` **592 → 241 lines (48.6 → 17.0 KB)**, and it now opens with a
"where things are, read only what the task needs" table. Three new docs, content moved **verbatim**:

- **`docs/SCREENS.md`** (122 lines) — §4.9–§4.14, the per-screen model, with a screen→hazard
  module→capability table at the top. This is the section that was doing the growing.
- **`docs/ARCHITECTURE.md`** (133 lines) — §5, the module map, with a "task touches X → read Y"
  table.
- **`docs/OPEN.md`** (109 lines) — §7's sixteen owner decisions plus §8, with the top three named.

`HANDOFF.md` keeps §1 status, §2 environment, §3 locked defaults, **§4.1–§4.8 — the model proper**,
and §10's three recent passes, which were also cut from ~20 narrative lines each to ~6 (the full
entries are here, which is the point of here). §5/§6/§7 remain as **numbered stubs pointing at the
new files**, so every "§5"/"§7" cross-reference in this journal still resolves.

Per-session read cost: **~12,100 tokens → ~4,300** for the router, plus ~2,700 for the one
companion doc a task actually needs. Roughly **7,000 tokens saved per session**, and the
end-of-pass update now edits a 241-line file instead of a 592-line one. The pass paid for itself
immediately: reading the old handoff once (12k) is the only cost, and it had to be read anyway.

Also: `docs/INVARIANTS.md` got a **five-group index** at the top (Bundle · DOM bitmap type ·
Layout · Gameplay · Testing) so a session can read one group instead of 52 KB. It is now the
largest mandatory-ish read in the docs and **Gameplay alone is ~70% of it** (lines 71–482).
Deliberately **not** split further on this pass — it is the highest-value content in the repo and
the next split should be per-screen, which is a judgement call better made when it next blocks
someone. Named as the next candidate inside the file itself.

Both steering files were rewritten to teach the router: "read HANDOFF.md, then **only** the
companion doc your task touches", and the after-each-task rule now routes new content to the doc
that owns it (rules → INVARIANTS, per-screen → SCREENS, modules → ARCHITECTURE, questions → OPEN)
with the cap tightened to ~250 lines / ~20 KB.

### What was deliberately NOT built

The brief said don't build something that costs more than it saves. Rejected:

- **An auto-generated symbol/API index.** `grep` over 110 files is already cheap and an index goes
  stale silently — it would cost a maintenance step every pass to save a search that costs nothing.
- **A `docs/MAP.md`.** `docs/ARCHITECTURE.md` already is one; a second would drift from the first.
- **A mirror-file consistency check** (see hazard 2 above) — it would fail in a legitimate
  workspace configuration.
- **Pruning the journal.** It is not a per-session cost, and the findings are the asset.

### Verification

Docs-only change, but the full gate was run: **typecheck · lint · 451 tests (42 files) · build ·
build:site · validate:levels all green.** Content preservation was checked by grepping 20
distinctive phrases from across the moved sections against the new four-file set — all present
(one apparent miss was the grep not accounting for `**bold**` markers). Numbers in §1 were
re-measured and are accurate: **IIFE 58.1 KB, ESM 57.7 KB, site payload 58.7 KB** (60,135 bytes
gzipped, i.e. KiB not KB — Vite prints 60.66 kB for the same file, which is where the apparent
discrepancy comes from), summed gate **red at 113.2 KB of 90 — still `docs/OPEN.md` §1.**

---

## Pass: the Workplace, refined — an office that is broken *and lit*, and a mummy made of cloth rather than of tape

**Brief (owner):** "the Workplace screen works fine but doesn't look that good. See every element and
see if it can be made visually better — the mummy/human figure, the environment. No compulsion to
match the other screens' colour design for the environment, just keep it 8-bit. The room can look
even more clumsy and haywired, and after the mummy is killed everything restores and lights look
good and everything."

### What the raster actually showed (before touching anything)

Rasterised both states first (`@napi-rs/canvas` + the project's own `tsx`, per §2 of the handoff), and
the images said something the code did not. Two failures dominated and they were the same failure:

1. **The room had one value.** Back wall `#0D3540`, dado `#0D3540`, cubicle dividers `#123F4A`,
   monitors `#10505E` — every piece of furniture within two values of the wall it stood against and of
   every other piece. The whole bottom third of the frame was an indistinct dark field with the
   player, the one lethal figure and nine props standing in it.
2. **"Restored" looked almost exactly like "broken."** The only difference was four slightly brighter
   grey bars at the ceiling. The payoff — the entire argument of the screen — did not land.

Plus, in order of how obvious they were in the PNG and how invisible in the source: the light was four
low-alpha **gradient wedges** thrown from the fittings to the floor, i.e. precisely the defect
Reception's downlights were deleted for (they rasterise as grey objects hanging in the room, never as
light) · the ceiling was a **34px strip of hairlines** at the very top of the frame, so "the ceiling is
out" — the first thing this screen has to say — said nothing · the ground band was a **large pale grey
slab** at 0.16 speckle that dominated the frame and read as concrete with litter on it · the wall clock
was **46px** and rasterised as a small window (the same defect screen 1's clock was rebuilt at 80px to
fix) · the whiteboard was ruled every 8px across its full width and read as a **blind** · the terminal —
the object the freed colleague runs to and the only readout of the win — was a dark box the same size
and value as the workstations, with a cone and a ladder authored on top of it in `levels.json` · and the
figure himself rasterised as a **yellow striped pillar with a dark visor**: a man in protective kit.

### The room: one shell, two layers, and the restored room underneath

The structural move of the pass. `scenery.ts`'s `drawOfficeInterior` now paints the room **as the fix
leaves it** — a sound shell, an intact suspended ceiling, glazing, workstations, storage, whiteboard,
clock — and `render/workplace.ts` lays the *damage* over the top of it, driven by `restore`. That keeps
the existing architectural boundary intact (a backdrop function still knows nothing about whether the
room has been fixed) and it is what makes the payoff a real change rather than a fade: **the good room
already exists underneath, and the fix only has to stop covering it.**

Geometry the two halves share is **exported** rather than written twice — `CEILING`, `WORK_PODS`,
`POD_SCREEN`, `CABINETS`, `WINDOW`. A lamp that misses its own aperture, or a lit screen that misses
its own monitor, is the `badgeFloat` defect in a different costume.

**The shell.** Three value registers instead of two (upper wall · a lighter mid register the furniture
reads against · a darker band at the floor), a dado rail at y=330 because 300px of one value is a
painted flat whatever stands in front of it, and panel joints every 160px.

**The ceiling** is 96px of tile grid: four courses receding upwards (darkest at the top), T-bars on an
80px pitch, and four fitting apertures cut into it. `FIT_W` is **160, exactly two tiles**, which is a
correctness constraint and not tidiness — see the test finding below.

**The furniture is DARKER than the wall, with one lit edge each.** This is the inversion that fixed
the mush. The first attempt painted it a value *up* from the wall on the reasoning that lighter reads
better; dark mass plus a bright rail is what actually reads as furniture at this size, and it leaves
the light values on this screen to the three things that have earned them: the wrapped figure's cloth,
the whiteboard, and the light itself. The divider also came down from 62px to **50px** — 62 is the drawn
hero's full height, so it hid both the monitor on the desk and anybody standing at it, and the pod had
nothing in it but a wall.

**The light is surfaces, three of them.** The fitting is one lit diffuser panel with two ribs (drawn as
two thin tubes it rasterised as a *vent*, and there is a duct on this screen to compare it with); a
stepped **pool on the floor**, seven steps so it slopes; and the **up-facing edges** under each
fitting — the top of the services duct, the dado rail, a band of wall under the ceiling. No wedges
anywhere. Two fittings hold and two strike and drop out, so a broken office is a *half-lit* one rather
than a dark one — painting all four dim left the floor lit by nothing, which meant fixing the room had
nothing to change.

**The clumsy half** (all of it in the damage layer, all of it gone at `restore = 1`): two ceiling tiles
missing, with a joist, a duct, four cables to different lengths and **one tile hanging out of the grid
by a corner** · a ceiling stain and a bucket under it · a task chair on its side · two filing drawers
hanging open with paper over the lip · four **A4 notices taped straight to the wall**, one curling off
(somebody printed the problem out instead of fixing it, and it puts the tape on the wall as well as the
floor) · a knocked-over stack of archive boxes past the terminal · and the pre-existing barricades,
cones, signs, tape runs and floor debris.

**The payoff** is the four fittings at full, four floor pools, the monitors awake, **two colleagues back
at their desks**, daylight up in the glazing, a clean floor — and a full-frame pale wash that is the
exact inverse of the gloom. Un-gloomed is a *neutral* room; "the lights come good" has to be visible
across the whole frame.

### The figure: cloth first, tape as accent

Re-authored at the same 20×26 / scale 3 (the hitbox is the sprite, so the size could not move):
- **Seams every other row, two alternating tones.** This, not the tape, is what makes him a mummy.
- **Nine bands cut to one cell tall each.** At two and three rows they covered ~40% of the body, which
  is the point at which tape stops being an accent on wound cloth and becomes the material he is made
  of. The arm band went from w4 to w2 so the forearm and the pale fist show.
- **A fist (`H`) at the end of the reach** and the body moved into columns 1–13, so only 3px of the
  60px hitbox is empty — it was 9px, mirrored to the other side when he turned round, i.e. a strip of
  box that hits the player from nothing.
- **The seam pass now holds the eye cells out.** Row 3 is odd and every odd row gets a seam, so the
  first version painted a bandage straight over the slit and closed it — the head's only feature, gone.

Rasterised at 2× he now reads as pale wound cloth with a dark slit and yellow tape at brow, chest,
waist and shin; the unravel (hair and skin showing through, tape falling) and the freed colleague at
the keyboard both read on their own.

### Level data

`clutter` rewritten: `cone 7 · post 14 · sign 15 · post 17 · barricade 19 · ladder 21 · post 22 ·
sign 26 · post 27 · barricade 30`. Two ladders side by side at 18 and 21 read as a duplicated prop and
one went; **columns 23–25 are now kept clear for the terminal** (a cone at 24 and a ladder at 25 buried
it), with the tape run from post 22 to post 27 crossing in front of it at head height instead — which
is the better picture anyway: the fix itself taped off. The `meta.conventions.clutter` note records all
three protected stretches and why. The terminal itself is bigger (124px desk, 88×62 monitor, a lit
bezel and a stand) and the floor material was refined the way screen 1's clay was: speckle 0.16 → 0.03,
variation moved tile-to-tile via `faces`, `bevel` on, and the whole thing two values darker.

### A formatting trap worth writing down

Editing `levels.json` with `json.dump(indent=2)` **reformatted the entire file** — 52 compact leaf
objects (`{ "gx": 0, "gy": 15, ... }` on one line, which is Prettier's JSON output at printWidth 100)
expanded to five lines each, turning a 12-line change into +543/−89. `npx prettier --write` does *not*
put them back: Prettier keeps an object expanded if the source had a newline after `{`, so the damage
is one-way. Recovered by writing a formatter that reproduces the rule (collapse any object/array whose
one-line form fits in 100 columns at its indent, plus the blank line before `"screens"` and between
screen objects) and **proving it byte-for-byte against `git show HEAD:src/data/levels.json`** before
using it. Diff came back to +192/−54, which is the real content. Kept at `/tmp/jsonfmt.py`; if it is
needed again it is 30 lines and the test is that round-tripping HEAD is a no-op.

### Tests

New `src/render/workplace.test.ts`, 11 tests, and two of them **failed on real defects** the PNGs had
not shown:

- **"puts every missing ceiling tile in the gap BETWEEN two fittings"** failed. A 168px aperture
  centred on 800 covers 716–884, and the missing tile at 640 ends at 720 — 4px inside it. `FIT_W` is
  160 now (exactly two tiles), so apertures are 120–280, 420–580, 720–880, 1020–1180 and the two holes
  at 320 and 640 abut them without overlapping. The test states the *relationship*, not the numbers.
- **"holds the dressing back from the wrapped figure"** failed at max alpha 1.0. The ceiling cables'
  ferrules were painted in the tape's own caution yellow at full alpha, inside the one layer the fix
  does not reach — putting the screen's one reserved-meaning colour somewhere it means nothing. They
  are cable colours now.

The rest pin: sprite = hitbox · at most 3px of empty hitbox · tape covers under half the rows and never
the slit · the slit is dark while wrapped and gone when freed · tape and name plate drop the moment he
stops being the obstacle · **nothing in the light value between ceiling and floor is taller than 20px**
(the anti-beam guard) · no pool spans half the frame · `restore = 1` paints zero caution yellow and
strictly more light · each lit screen lands on `POD_SCREEN` for every pod.

`drawBoard` was deleted with its last caller.

### Verification

**typecheck · lint · 462 tests (43 files) · build · build:site · validate:levels all green.**
Bundle **IIFE 60.4 KB / ESM 60.0 KB gzip**, site payload **63.2 KB** (was 58.1 / 58.7) — 67% of the
90 KB budget; the summed `analyze` gate is still red for the reason in `docs/OPEN.md` §1. The new
`levels.json` prose is stripped from `dist-site` (grepped). Seven rasters were used across the pass
(broken · restored · 1 layer with the cutter · working · unravelling · the figure at his start column ·
plus ceiling/figure/terminal crops at 2×) and every single change above was made because of one of
them, not because of a code review.

---

## Pass: Compliance — the mark stands on a wall, the platform became a hoist, and the weather is the payoff

**The brief, three owner notes on one screen.** (1) "Remove the ANSR powerup rail we have and instead
make a 4 or 8 brick wall which will have an ANSR powerup on it — so the user can jump and grab it —
and when the user grabs it there is *not* the effect we have right now on the character, i.e. the
orange halo circle. Instead, just when the user takes the powerup, make the gloomy weather brighter,
signalling happiness and change and that the environment is fresh." (2) "The floating horizontal
platform made of brown blocks: make this a floating platform like the yellow one on the other side but
make it go up and down so the user can jump on this and get on the top brick floor easily. And after
you add this make a brick wall on the left side of it — this is so that the user can't jump from the
powerup brick we are having now onto this platform." (3) "See what we can do to make the visual
appearance more refined and less cognitive overload; you do not have to stick to the other screens'
colours — the only thing is we stay 8-bit."

**What shipped.** `wall-ansr-mark` (gx 3-6, gy 13-14 — four blocks wide, two courses tall, i.e. eight)
with the mark standing on its **last** column; `delivery: "perch"`, a third pickup model in
`world/badgePerch.ts`. `platform-registers` is **deleted** and the clearance **hoist** stands in its
span (gx 9-14, parks gy 9, rises to gy 7) — the same yellow machine as the lift with the direction
taken from data. `wall-hoist-guide` (gx 8, gy 6-9) is the owner's left-hand wall. `ComplianceMaze` no
longer sets `shieldsPlayer`; it owns a `skyClear` dial instead, and screen 2 has weather: an overcast
lid with rain that opens into daylight with a sun over the ANSR wall. **476 tests** (was 462), IIFE
**61.8 KB** gzip of 90, site payload **64.0 KB**, validator green, 0 trapped states of 70,062 in the
re-run pocket probe.

### The geometry, and the three things that nearly went wrong

**1. A blocking wall on the ground severs the corridor it is meant to guard.** The owner's wall has a
job with a number attached: a player standing on the ANSR wall (top 520) has an apex of feet-380, and
the hoist parks at 360 — 20px, which is nothing. So the shortcut is real and had to be blocked. But
every wall tall enough to stop that jump (top above 380, i.e. gy ≤ 9) also stops the *walk* from spawn
to the staircase, and the screen becomes impossible; every wall low enough to walk past is low enough
to climb, stand on and jump from, which moves the shortcut rather than closing it. Three layouts died
here before the answer: a **pier in the air**, spanning only the heights the shortcut passes through
(gy 6-9 = 240-400), with the whole ground corridor open beneath it. It is flush with the hoist's left
edge, so it reads as the machine's guide column instead of as a floating block — and rasterised, that
is exactly what it looks like.

**2. The hoist's parking row is load-bearing, and nothing in the build could have caught it.** The
first cut parked the plate at gy 10 (top 400, underside 416). The tread beneath it, `stair-gst` at
gy 12, has its top at 480 — 64px of headroom, where a 44px player needs **84** to make the 40px hop up
to `stair-tds`. A player on that tread could still *walk* under the plate and could no longer get off
it, and since the plate is a rider-driven machine, it would sit there parked for ever: **the only
route up the maze, sealed.** The reachability flood would not have noticed, because the plate is
deliberately absent from `solids` (the hazard owns the live box), and neither would any raster. Parked
at gy 9 the underside is 376 and the headroom is 104. It is now checked twice — `validatePlates()` in
the validator measures the plate's park position against every solid under its span, and
`screen2.test.ts` measures the same thing against the live hazard.

**3. A rising plate has to carry its rider — and that is the first time the world moves the player.**
The lift got away with "moves only while carrying" because it *descends*: the player falls onto it
every frame and gravity does the work. A hoist cannot. `moveAndCollide` is driven by the player's
motion, so a plate rising under a standing body passes straight through it and drops them. `runPlate`
therefore offsets the rider's box by exactly the plate's own delta. Two rules come out of that and are
now in `docs/INVARIANTS.md`: **nothing may be authored over a hoist's travel** (there is no ceiling
test in that code path), and the rider-driven rule still holds in both directions, which is what
guarantees a plate never moves into a body it is not carrying.

**One `Plate`, two machines.** Direction is data — `toGy < gy` rises, `toGy > gy` descends — so the
lift and the hoist share the update, the state getter and the renderer (`drawPlate`, with the chevrons
and the rail mirrored). This was worth doing for a reason beyond code size: a player who learns what
the yellow plate does on the way *out* of this maze should recognise it on the way in, and two
vocabularies for one idea would be worse than none.

**LEGAL rides the hoist.** Deleting the platform deleted a level of the maze, and a level with no
monster on it is a free walk — which is the one thing this screen is not. `MonsterSpec.hoist` makes a
monster's surface the plate's live top rather than a row in `levels.json` (the `badgeFloat` rule
applied to a monster's feet: a moving surface has one author). Its authored row survives as
documentation and the uniqueness test still passes, because the plate parks on a row nothing else uses.

### The badge on the wall

`world/badgePerch.ts` is 60 lines and one rectangle, and it exists for the same reason the other two
delivery modules do: the sim collides against it, the renderer paints from it and the validator
measures it, so the pickup cannot be visible where the collision is not. No clock, no expiry — the
mark that turns a whole maze into a staircase should not also be a reflex test, and the screen's
difficulty is the maze.

**It sits on the wall's LAST column, and that is a fairness decision, not a composition one.** On a
four-wide wall, a mark in the middle can be jumped clean past by a one-tap auto-run player who cleared
the wall late and walked off the far end. On the last column, anybody who lands anywhere on the wall
and keeps going right walks into it. Two courses of brick is what keeps it out of a standing player's
reach: 36px over a standing head, the same clearance the air-drop's floating brick leaves.

**Three deliveries now, and the third one broke four rules phrased in terms of the first.** Same bill
this build has already paid for the rail/drop split and for the screen with no badge at all:
`badgeLowestBox` applied to a perch reads the wall's own row as a float anchor and puts the "band"
155px underground — correct code, meaningless measurement. `badgeReach.test.ts` and
`setbackLog.test.ts` both split on `delivery` now, and the perch has its own three proofs (out of
standing reach and inside one hop · four seconds of holding *right* without jumping never collects it ·
a one-tap pass takes it inside a contiguous window ≥0.3s).

### No halo, weather instead

`ComplianceMaze` is now the one hazard that **declines** a bubble it is entitled to. Contact really is
harmless once GCC-BOT has filed everything, so the rule ("only where contact is harmless") is not being
bent — the owner asked for the news to be on the world rather than on the hero. `shieldsPlayer` is
simply absent, and there is a test that says so **in words**, because a missing flag reads as an
omission and the next person would put the halo back.

What replaced it is a dial, `skyClear`, moved by simulation time over `CLEAR_SKY_TIME` (1.6s — slower
than the arms coming up at 0.45s, faster than the ~4s exodus, so the payoff has an order to it). And
the weather is **two layers**, which is the lesson the Workplace's `restore` already taught in a
different costume: brightening the sky alone rasterised as a bright sky in front of an unchanged dark
maze, because the sky is *behind* the level and the level is most of the frame. So `scenery.ts` paints
sky, cloud, rain and sun from a plain `weather` number (it still knows nothing about hazards or
badges) and `render/maze.ts`'s `drawWeatherWash` paints the veil-and-wash over the masonry and under
the cast — `0.22 × (1 − clear)` cool dark, `0.07 × clear` pale, exact inverses.

**Four raster findings on the weather, none of them visible in the code.**
- **The sun was behind the pier.** Placed at x=322 it sat exactly on the guide column and read as a
  lamp on a post — the occluded-sun defect, twice paid for now. Moved to 262/168, which is measured
  against the pier, the HUD's left column (x≈194) and the stage sign.
- **A shaded sun is a light bulb.** The stepped disc's bottom two rows in the rim tone read as a stem;
  a rim course *under* the disc landed on its own bottom ray and did the same with a gap in it. The
  sun is the light source on the frame, so it is the one round object here that gets no lit side.
- **Clouds must shrink, not fade.** Fading them out reads as a rendering fault. The lid contracts to
  55% towards each cloud's own centre and lifts 24px as it lightens, so the sky *opens*.
- **Rain has to be few and bright.** A dense low-alpha field is the dithered-halo trap again (grime on
  the screen). Sparse slanted two-cell drops at 0.55/0.30.

### The refinement pass on the material

The brickwork was a 20×20 course at 0.1 speckle. Over the 240px filings block that is twelve rows of
joint, and it rasterised as a mesh laid across the entire climb — on the screen with more stone in it
than any other. Now a 40×20 course at 0.05 with per-brick `faces` and a `bevel`, exactly the three
moves that quietened screen 1's clay: half the joints, variation between bricks rather than inside
them, and a shadow per course, which is what carries depth now there is a bright sky to silhouette
against. The skyline's windows came down two values as well (they were `#8FCAD6` — brighter than the
monsters standing in front of them, which is the defect screen 1 was rebuilt to fix) and both its
tones now lerp with the weather, so lit windows dominate at night and disappear in daylight.

Two smaller reads from the raster: a 240px 16px-thick plate is a **yellow ruler**, so both plates got
carriage shoes hanging under each end (below the top face, never above it — art over a platform
promises footing the box does not have) and a chevron per 80px of width.

### Probes

- **Pocket / soft-lock probe rebuilt** (`/tmp/brrender/pocket.mts`; the old one was gone). Full
  geometry with the plates parked: **0 trapped of 70,062 states**, every authored surface reachable
  (600 → 560 → 520 → 480 → 440 → 400 → 360 → 280 → 240 → 200). Plates at the far end of their travel:
  0 trapped. Control run with the climbable geometry removed: furthest x **960**, the statutory wall's
  face, so "you cannot cross on one level" is still proved rather than asserted. The 381 states past
  the ends of the ground band are **falls, not pockets** — the same distinction the last pass on this
  screen had to teach the probe, and it had to be taught again because the probe was rewritten.
- **Validator**: the two-flood rule for a plate that is part of the route (board it parked · continue
  from the top of its travel). Modelling the plate at both ends in one flood proves a jump nobody can
  make; leaving it out reports the screen as impossible.

### Ordinary bookkeeping

`hoist` joins the strip-level-notes plugin (its note is 600 characters of why the parking row is what
it is, and it was going to ship). `src/data/{levels.json,tuning.config.ts}` mirrored to the root
copies. `npm run analyze` still reads 120.2 KB of 90 for the reason in `docs/OPEN.md` §1 — it sums the
ESM and IIFE builds; the real download is 61.8 KB. Four rasters were used (gloom · riding the plate ·
half way through the change · daylight, plus wall/hoist/sun crops at 2×) and every art decision above
came out of one of them.

### Addendum, same pass: the perch had to leave the path

The owner read the first cut back immediately: *"the powerup is easily available and is on the way, so
the player would anyway take it — we need to keep it somewhere that it's on the user to take it or not,
maybe add a floating brick structure where it would reside, and the player jumps to that, takes it and
then comes back to the normal path."*

**They were right, and it is a model problem rather than a difficulty one.** `wall-ansr-mark` stood on
the floor of the left corridor, two courses tall, so it was a hurdle across the only route: every
player cleared it, and clearing it *is* collecting the mark. A badge nobody can decline is a badge
nobody decides to take — and the run's whole argument is the difference between the player who took
ANSR and the player who did not. It also quietly made the delay log a formality, because the unassisted
maze had become unreachable by accident.

So the structure is a **floating deck** now: `gx 4-6, gy 12`, three blocks, one course thick, 120px
over the corridor with **36px of clear air under it over a standing head**. Holding right walks
straight underneath, past the mark, into the maze. The rule is in the validator: a perch's support may
not reach the floor.

**Two numbers came out of the change, and both are measurements rather than choices.**
- **The deck is three blocks, not four.** It is 120px up, so it has to be cleared in a single arc, and
  every column added to its *left* end eats run-up. At gx 3-6 a one-tap auto-run player had **12
  working taps (0.20s)**; at gx 4-6 it is **21 (0.35s)**, against the 0.30s budget the rail and the
  air-drop are both held to. The right end cannot move instead: gx 6 is the last column the badge may
  use at all, because TAX's corridor starts at gx 7 and the badge has to precede every obstacle.
- **A pickup standing on a solid needs the button held for ~20 frames, where a rail needs 12.** Exactly
  the figure the air-dropped brick forced on screen 4, arrived at again from the other direction: at a
  12-frame hold jump-cut caps the rise at ~121px against a deck top 120px up, so the player lands on
  the deck's face instead of on its top. `oneTapRun` takes a hold length now.

**And "optional" had to be prevented from meaning "impossible on a phone".** One-tap auto-run is the
default on touch, so the deck is proved twice: the auto-runner who never jumps walks past it (the whole
point), and the auto-runner who taps once takes it (or executives on phones would simply never see
GCC-BOT). Both are in `badgeReach.test.ts`.

**Lifting the deck also promoted the guide pier from belt-and-braces to load-bearing.** From a deck at
480 the apex is feet-340 — *above* the parked hoist's top of 360, 80px away horizontally — so without
`wall-hoist-guide` the entire lower maze could be skipped deck → plate → upper flight. The probe now
answers that directly: with every stair, step and block removed, the only surfaces the flood can stand
on are the ground (600) and the deck (480). The plate is unreachable, so the skip does not exist.
**478 tests**, 0 trapped of 71,353 states, validator green.

### Addendum 2, same pass: "the sun and clouds are way too pixelated"

Owner, on the first weather build: *"Make the sun and clouds look a bit better — it's way too
pixelated and looks not refined. Stick to 8-bit but make it look better."*

**The diagnosis was the same for both, and it was not the cell size.** Each cloud was three wide
`pxRect`s (a base, a shoulder, a cap) and the sun was eight 8px rows following a half-width profile.
Both were snapped to 4px, so they were *technically* pixel art — and both read as slabs, because every
step in the outline was 20-40px long. **8-bit is a cell size plus a silhouette**, and what was missing
was the silhouette: an 8-bit machine would have drawn these from a tile mask with a step every cell,
not from three rectangles.

So neither shape got a smaller cell (4px is the same cell the rain, the badge halo and the ground
chevron use — dropping to 2px would have made it *less* consistent, not more refined). What both got
was **more steps of the same cell**:

- **The cloud is a height per column.** Three authored lobe sets (`CLOUD_LOBES` — `dx`, `r`, `h` per
  lobe), summed as a max, quantised to the cell, one fill per 4px column. A tall lobe off-centre, two
  shoulders and a low one trailing away is what makes a cumulus; one lobe is a hill and two symmetrical
  ones are a bow tie. On top of the run: a lit crown cell, a second crown cell wherever the silhouette
  is *climbing* (which puts the light up-left, where every other object on these screens is lit from),
  and a shaded cell along the base so the cloud has an underside instead of ending on nothing. Five
  clouds, three shapes, ~75 fills each — cheaper than the skyline it sits behind.
- **The sun is a real pixel circle.** Every 4px cell whose centre is inside R=32, in three concentric
  bands (core, face, rim) with the core pushed 5px up-left, plus twelve tapering rays starting one cell
  clear of the rim (three cells on the cardinals, two on the rest). A 64px disc on a 4px cell has
  sixteen rows instead of eight, and sixteen is where a stepped circle stops reading as a polygon. The
  rays replaced four long bars that sat 34-48px out with a hole between them and the disc, so they read
  as four detached dashes rather than as light coming off a sun.

The two rules that came out of it are in `docs/INVARIANTS.md`: **count the steps in an outline before
reaching for a smaller cell**, and **the light source on a frame cannot itself be lit from somewhere
else** — a sun gets concentric bands and an off-centre core, never a shaded lower half (which is what
made the last two attempts light bulbs).

`render/scenery.test.ts` is new and pins exactly this, because it is the part a code review cannot see:
one cell size throughout, ≥16 rows and ≥8 distinct row widths in the disc, >40 columns and ≥6 distinct
heights along a cloud's top edge, a single base line per cloud, the bank contracting *and* lifting as
the dial rises, every tone at ≥0.45 alpha (few and bright, never a wash), and no value orange anywhere
in the weather. **487 tests across 44 files**; IIFE 62.1 KB gzip of 90, site payload 64.5 KB.

### Addendum 3, same pass: the rain was rewinding, and the badge was still on the path

Two owner notes. *"The rain doesn't look nice right now — it looks like a boomerang loop that's going
on and not continuous."* And: *"The brick the ANSR powerup rests on is good but still is too reachable
— add one more floating brick structure that will have the powerup, maybe on the left side of this
existing floating brick so the user has to go on and jump the opposite direction to get it."*

#### The rain was a bug, not a look

`drift = (t * 620) % 240`, added to every drop. So the whole sheet advanced 240px and then **all of it
jumped back to the start at the same instant**, 2.6 times a second. That is exactly the boomerang the
owner described, and it is worth stating as a rule because the code read as reasonable: **a scrolling
field must wrap per particle, over its own full span, never as a shared offset over a shorter one.**
Each drop now has its own phase and sits at `(phase + t × speed) mod span`, where `span` is the whole
fall — so wraps are staggered and each one is a drop leaving at the bottom and re-entering at the top,
which is what rain does.

Three things came with the fix:
- **Two sheets.** Near (880 px/s, 18px streaks, 0.50 alpha, brighter leading cell) over far (520 px/s,
  11px, 0.28). One sheet is a pattern; two are depth, and the parallax is what stops the eye locking
  onto individual drops and noticing the loop at all.
- **The streaks travel along their own slant** (`RAIN_TILT` 0.16, ~9° off vertical), rather than being
  tilted sprites falling straight down — which reads as stripes, not as rain.
- **The span covers the frame plus one streak, so nothing is culled.** That was a side effect worth
  keeping: the sheet has a *fixed* number of streaks, which is what lets `scenery.test.ts` follow one
  drop by index from frame to frame and assert it either fell or wrapped a whole span. Over 40
  consecutive frames, every streak moves down except <10% that wrap — the old field would have failed
  that test on every fourth frame with 100% moving up.

`wet` still thins the sheets by dropping whole lanes as the sky clears, so the rain *stops* instead of
fading to a ghost, and reduced motion draws the same drops at their phase with no time term (a still
sheet of rain: this screen's weather is information, so holding it is honest where hiding it is not).

#### "Still too reachable" is a statement about direction, not height

The single deck was one hop off the floor on the forward line: a player running right taps once, lands
on it and walks into the mark. The detour cost nothing and therefore decided nothing — the same defect
as the floor-standing version, one row up. **What makes a pickup a decision is having to go the other
way.**

So there are two structures now. `step-ansr-approach` (gx 4-6, gy 12) is only the stepping stone, and
the mark stands on `wall-ansr-mark` (gx 1-2, gy 9): 120px higher, 40px back to the **left** across a
gap, and **out of reach of the ground entirely** — a full jump off the floor tops out at feet 460
against a deck at 360, which is what makes the step mandatory rather than convenient. The move is: run
right, hop up, stop, turn round, and jump back the other way with the button held (a solid has to be
cleared rather than touched — 20 held frames, the figure the air-dropped brick forced). The mark is on
the deck's **right-hand** column, which is the same "arrive at the mark" rule as before read from the
other end.

Three measurements, all now tests: the step is inside a jump of the ground · the deck is inside a jump
of the step · the deck is **not** inside a jump of the ground. And two claims about the shape: holding
forward for four seconds walks under both decks and takes nothing, and **no single forward tap, at any
frame in a 60-frame sweep, collects it** (where the previous layout had a 0.35s window of taps that
did). The probe says the same thing from the other side: with the step removed, the flood cannot stand
anywhere but the floor.

#### The touch layout had to be corrected for this to be honest

One-tap auto-run is the default on touch and that layout **hid the whole move pad**, so a phone player
could not go left at all — a badge you have to jump back to would have been unreachable for most of
this audience, which is worse than it being free. The pad now keeps its **left** button under auto-run
and hides only the right one, which is redundant when forward is automatic. One tap still plays the
game; one tap plus a back button plays the detour. "One-tap" means you never have to press forward, not
that you cannot turn round — and every future level detour depends on that distinction.

**494 tests across 44 files** · 0 trapped of 76,273 probe states · 0 states standing on the parked
hoist with the staircase removed (the skip stays closed, and lifting the badge deck to gy 9 does not
open a new one) · IIFE 62.3 KB gzip of 90, site payload 64.6 KB · validator green.

**One probe correction worth recording:** the pocket flood reported a single trapped state at x≈0.8 —
a player mid-jump off the left-hand deck at the very edge of the frame, whose only continuations are
off-frame and therefore never expanded. Leaving the world is a **fall**, which `forceSetback('fall')`
relocates out of, so a state whose successors are all off-frame is safe rather than trapped. That is
the same lesson an earlier pass learned about off-frame *dead ends*, one step further in: it applies to
the state feeding them too. With that fixed the count is 0, and the geometry never changed.

### Addendum 4, same pass: the maze had no death pose, and the mark had one ring too many

Two owner notes. *"Add a death animation for this screen — when the player dies, what happens to the
player?"* And: *"Remove the halo effect that is around the ANSR powerup."*

#### The player gets FILED

This build already had the rule — **every death that stops the stage is visible on the player** — and
two examples of it: the DENIED stamp flattens the hero on screen 1 (`flattened` → the `squash` pose,
with the stamp still holding him down), and the taped figure wraps him on screen 3 (`tangled` →
`drawTangled`). Compliance was the screen that had none. Four passes of work on it, and contact still
booked two months, froze the frame and said nothing about what had just happened.

The pose is built out of **the obstacle's own vocabulary**, which is where these things come from: the
creatures are rubber stamps on filing cabinets, so what they do to you is bury you in the queue.
`drawFiled` (pure, in `render/maze.ts`) paints three layers over the hero:

- **A mound of forms to his chest**, five courses stepping inwards. The first cut was symmetrical and
  rasterised as a *wedding cake* — something somebody built rather than something dumped on him — so
  every course is offset sideways and the keylines stop short of the ends, which turns ruling into the
  shadow one sheet casts on the next. Two tones, both lighter than anything else on this screen except
  the monsters' approval plates, because it is the same material.
- **Loose sheets still coming down**, stepped on the host's phase — and *held* rather than deleted
  under `prefers-reduced-motion`, because the information is "he is under a pile of paper" and that
  survives being still.
- **The slot mark** pressed across the top sheet in the creature's dark red. No word is set on it: the
  delay label (`TAX +2 MONTHS`) is already flying up off his body on these exact frames, and two pieces
  of type on one 48px figure is one too many.

**And the pose has to say who did it.** A creature standing beside the pile with its arm at rest reads
as a bystander, so `MonsterState.struck` now marks the one that made contact: the renderer slams its
boom 10px below rest and swaps the head to a third palette with its slot lit (same grid, never a second
sprite). That works for the same reason `Stamps.struckAt` does — `Simulation.setback()` deliberately
does not reset the hazard, so the pose survives into the frames it is painted on. `screen2.test.ts`
asserts the sim side of that (exactly one monster is `struck`, and it is TAX), because it is simulation
state rather than decoration. A burst of near-white paper joins the existing shake/flash/hit-stop on
`'monster'`, the second cause to throw debris after the tape shreds on `'mummy'`.

#### There is no ring round the mark, and that is the end of a long thread

Four haloes have now been tried on the ANSR badge: a dithered field (grey-brown dirt at 40px), four
lone cells off the ray tips (detached dots), a radial corona (which reads as *more rays*, so the logo
stops being a closed shape), and the tangential dashed ring that shipped for several passes. The owner
has removed the fourth as well, and the deletion is the right end of the thread: round a 40px mark a
ring reads as a lasso drawn round the logo rather than as light coming off it, and on a **perched**
badge — standing still on masonry — there is nothing to explain why it would be turning.

So the mark is now allowed to be the brand asset and nothing else. What says "pickup" is everything
that is *not* the logo: on a rail the shaft, its wake and the ground chevron; on a perch the lit plinth,
the contact shadow and four flare cells at full alpha. Rasterised on both screens 1 and 2 to check it
still reads, and it does — the rail is if anything cleaner, because the shaft was competing with a ring
30px away from it.

The guard is a **count in the annulus the ring lived in** rather than a check for one constant: cells
between 24 and 34px of the mark's centre are exactly 4 on a perch (the flares), fewer than 6 on a rail
(the wake), and every one of the rail's is on the shaft's own vertical axis. Any new ring at any radius
near the mark fails that immediately. `HALO_PX`/`HALO_R`/`HALO_ON`/`HALO_OFF` and `drawHalo` are gone;
the history stays in a comment above `CHEVRON` and in `docs/INVARIANTS.md`.

**503 tests across 44 files** · typecheck, lint, validator green · IIFE 62.3 KB gzip of 90.

---

## Pass: the Workplace, again — two tapes, a body with joints, a patroller instead of a respawn, and fire for ammunition

**The brief, six owner notes on one screen.** (1) "The yellow tape around the mummy can be of a
different colour because right now it merges with the other tapes in the office." (2) "The colour
scheme needs to be made better — the player and the brick and background feels the same." (3) "Add
lights once things are restored in the office." (4) "Make the caution signboards and tapes and other
such things better visually." (5) "The mummy/human isn't well shaped — make the shape better. And the
mummy right now walks in loop, i.e. when it moves to the end it just respawns from the spawn point;
instead it would be better if it goes and comes back, like to and fro." (6) "The gun isn't that good —
make it better and more visually noticeable, and the effect it has on the bandages of the mummy should
be more visually clear, like the tapes are burning. So to complement this the bullets can be small orbs
of fire that is burning the bandages, and the bandages are shown burning and getting ashed."
Plus the standing constraint: "everything should be very refined and look good but staying in the 8-bit
theme we have."

### What shipped

**Two tapes, and they are different colours on purpose.** The room keeps caution yellow (`#E8C23A`);
the figure is bound in **red barrier tape** (`WRAP_TAPE #D2402C`, shade `#8E2216`). `tapeStrip` takes a
`TapeTone` now rather than reading the module's constants, so one piece of stepping arithmetic paints
either kind, and `drawTangled` — the death pose — uses the *figure's* tape, because what caught the
player is the figure. This is the second attempt at the same problem: the previous pass held the props
back to **0.78 alpha** so the one lethal thing on the floor would not be one more yellow shape among
nine, and the raster this pass says plainly why that was not enough. Nine yellow shapes plus one
yellow figure is ten yellow shapes; alpha changes which of them is loudest, not how many there are.
The 0.78 stays, because it is still right for its own reason, but the separation is now carried by hue.
Red also survives the burn, which the yellow could not have: an ember front is *lighter* than red and
*the same value* as yellow.
The three layer pips over his head moved to his tape's colour with it — a yellow pip counting red bands
is a readout of something that is not on him.

**The figure has joints.** The 20×26 grid was re-authored rather than tweaked. What was wrong with it
was structural and invisible in code: an **8-row head** (31% of the figure, i.e. chibi proportions)
sitting straight on a full-width torso, no neck, no waist, and legs divided by a **single column of
outline** — 3px of dark inside a solid slab. So the raster was a bollard with an arm. Now: a 6-row head
with its corners cut top and bottom, a 1-row neck, a shoulder row that steps in before the torso
reaches full width, a waist that narrows, and **two legs separated by a transparent column** with the
room showing through. The nine rows that the head gave back went to the legs, which is where a human
carries them. Two consequences that had to be followed through rather than noticed later: every band
below the hips has to be authored **per leg** (a strip spanning both would tape the gap shut, which is
the seam-closing-the-eye-slit defect in a different costume), and the eye slit went to **two** rows so
it survives at 3px cells. `SEAMS` is still derived from the grid, so it could not drift.

**He paces, and that is a gameplay change, not a visual one.** `RETURN_TIME` is gone and `TURN_TIME`
(0.3s) replaced it: he walks to the end of his corridor, stands for a third of a second, turns, and
comes back. The `returning` phase — the beat he spent snapping 700px back to his start column — is
deleted along with the whole reason it had to be **harmless**, and the renderer's fade-in went with it.
Nothing teleports, so no frame can materialise a lethal 60×78 body on a standing player, and `turning`
is therefore *lethal*: he is standing where the player has been watching him walk to.

That deleted the screen's own justification for being winnable without the badge, which was, in the
level note's words, "he loops back behind you rather than turning round". **So it had to be re-earned,
and it was measured, not argued.** A probe of 30 reactive policies (jump trigger 70–150px × hold 8–20
frames × head-on-only or not) over 12 start delays:

| jump trigger | clean clears, of 12 |
|---|---|
| 70px | 0–1 |
| 90px | 0–1 |
| **110px** | **8–10** |
| 130px | 8–10 |
| 150px | 8–9 |

and the blind sprint — hold right, jump only when a wall stops you — **loses a life every time**.
That is the shape the screen wants: crossable, by one specific move, and not by holding a direction.
The move is to meet him head on, and the arithmetic behind it is now in `tuning.config.ts` beside
`WALK_SPEED`: a jump clears his 78px crown for **0.455s**, the closing speed against an oncoming figure
is 260 + 150 = **410 px/s**, so the 88px that have to pass under the player take **0.21s**. Overtaking
him from behind is deliberately impossible — 110 px/s of relative speed needs 0.8s of air against
0.455s available — which is exactly what stops "hold right" being an answer.
**The first run of that probe reported 0/12 for every policy including the blind sprint**, which is the
finding worth keeping: the partition wall at gx 6 is 80px of solid, so a policy that never jumps at a
wall never leaves the spawn. A probe has to be able to do the *boring* part of the level before its
results mean anything.

**Ammunition is fire.** `SHOT_W`/`SHOT_H` went 18×6 → **20×16**: an orb has to be roughly square to
read as one, and 20×16 is the smallest that carries a rim, a body and a white-hot core in 2px cells.
The disc is a **stepped half-width profile** (8, 8, 6, 4 either side of the centre line) in three
concentric values with the core pushed *forward and up*, plus a three-cell ember wake and two sparks,
all flickering off the orb's **own x position** rather than a clock. The first cut listed the profile
the other way up — widest rows at the poles — and rasterised as an orange brick with a hot corner:
right in code, obviously wrong in a PNG, and now stated as a test.

**The tape burns off.** `Workplace` tracks `burnT` and `burnLayer` per figure and `MummyState` carries
`burn` (0..1) and `burning` (which `need` group is going). The layer leaves the *simulation* on the
frame the orb lands — the hit is the hit — and the picture of it runs for `BURN_TIME` (0.42s, chosen so
it can never still be running when the next layer comes off, i.e. under `2 × SHOT_COOLDOWN`). Each band
is then one of three things: tape, **burning** (`burningBand`: an ember front eating along it in the
direction the orb was travelling, white-hot core, flame, deep red, then ash cells dropping out on a
stable hash), or **gone** (`scorchBand`: a permanent soot mark). So the body carries the score, not
just the pips, and the unravel throws ash and embers instead of intact strips of tape — which it had to,
because by then the player has watched all three bands burn and falling tape would contradict that.

**The gun.** Re-authored 20×14 at scale 2 (40×28, up from 36×26 — scale 3 is still out, it is a plank).
The reel of tape on top became a **glowing ember tank**, and the nose became a real **five-cell barrel
with a white-hot bore**. The receiver went **dark** first, on the room's own "furniture is darker than
the wall" rule, and the raster killed it immediately: the tool is held at chest height, which on this
screen is exactly where the dark furniture is, so the player was holding four orange cells in mid-air.
It is a **mid tone with a lit rail and a black keyline** now — the rule only ever applied to *the room*,
and a thing the hero carries has to read against whatever he is standing in front of.

**Colour scheme.** Two moves, and the constraint that shaped both is that the hero appears on six
screens and cannot be tuned for one. The floor material (`TILE_MATERIALS[3]`) came **off the teal axis**
to a warm grey-olive (`#3C443A`, edge `#96A38C`) — it was `#28383D`, two steps off the wall's own
`#0A2B33`, so wall, floor and a Light-Teal blazer were three variations on one hue and the frame read as
one dark field with shapes scored into it. And the **lowest wall register went darkest** (`#051B23`,
from `#0A2E39`): it is the 140px the hero's whole body stands against, and his shirt was carrying the
silhouette on its own.

**The lights.** Three things, and the first is a defect the raster found rather than a request.
`floorPool`'s seven bands **widened** on the way down (54 → 160 half-width) and rasterised as a
flat-topped stepped **pyramid** sitting on the floor: an object, which is the third time this screen and
Reception between them have shipped light-as-an-object. Light on a floor seen side-on is brightest where
the floor meets the wall and dies towards the camera, so the profile **narrows** now (160 → 78) with a
dithered fringe along the bottom and a bright walkable edge at the floor line. Then the payoff got
actual **fittings it did not have**: a continuous **cove** behind the ceiling line, an uplit **dado
course**, a **task lamp on each desk**, double the daylight in the glazing, and the full-frame wash up
from 0.075 to 0.11 — because four ceiling fittings coming up to full is a change in four places and a
working office floor is lit from more than four. `litSurfaces` also picked up two more genuinely
up-facing faces, since there had been 220px of wall between the duct and the dado catching nothing.

**The props.** The cone and the wet floor sign were the same picture — two filled yellow triangles, 48
and 56 tall, standing on the same floor. They separate on **silhouette** now, not colour: the cone is
taller and much narrower (2.4:1) with a curved flare, **two** white reflective collars and a square
black base plate wider than the cone; the sign is a genuine **Λ of two boards** with the room showing
through between their feet, the near board carrying the falling-figure pictogram, drawn from the
*board's* centre at each row rather than the prop's (a pictogram at the prop's midpoint hangs off a
board that has already leaned 12px away from it). The tape runs got a **twist** every fifth segment —
8px strips laid end to end read as a dashed rule, and a ribbon that turns edge-on reads as tape. The
barricade rails got a black keyline all round, and its hazard lamp became a hooded lens with four flare
cells — first drawn in amber (`#FFB04A` over `#B85E12`), which is orange in everything but name, and
four of them on the floor put the reserved value accent in competition with the badge two columns to
the left. It is in the caution-yellow family now.

### Gates

**508 tests** (44 files, up from 503). Typecheck, lint, both builds and `validate:levels` green.
Bundle **IIFE 63.84 KB gzip** (from 62.5), site payload **66.24 KB** — 71% of the 90 KB budget.
Six new tests: the figure's neck/waist/leg-gap proportions · "bound in a different tape from the room,
and not one caution-yellow cell lands on him" · the burn leaves fire and then soot · the orb is round
(widest course at its middle, poles narrower, nothing wider than the hitbox) · he paces both ways and
never leaves his authored corridor · he never moves more than one frame of walking in one frame, and
the crossability probe in miniature.

## Pass: the Workplace, third look — he throws, the badge falls out of a spotlight, and the room came off the teal axis

Six owner notes, all on screen 3, and they turned out to be one gameplay note, one layout defect and
four colour/art notes that share a single diagnosis. Verbatim:

1. "Add a capability for the mummy to throw the bandages at the player capturing him."
2. "The first computer screen that comes after things are restored is overlaying on the brick obstacle
   we have in the beginning."
3. "Change the colour of the desks, it's interfering with the character — and also the desk and computer
   screen doesn't look refined."
4. "Add 4 big spot lights from the ceiling facing down, glow up when things restore."
5. "Change the background wall colour, it's almost the same colour as the outer view from the window and
   also almost the same colour as our character."
6. "For the powerup remove the rail and add — from the spot light I just said — an ANSR powerup that
   falls and stays for a few seconds and the user has to take it otherwise it's gone, and this happens
   at regular intervals; and this powerup doesn't drop immediately, it's visible as the user comes to
   this screen but drops after a few seconds the user has spent in the screen, and this drops on a
   cabinet or something which is before the partition wall so the user can take it safely but the
   player has to put in some effort to grab it."

Notes 4 and 6 are one mechanism — the fitting the light comes out of is the fitting the badge comes out
of — and notes 2, 3 and 5 are all the same underlying fact: **this room had one hue and three of its
objects were sitting in the same place in it.** So the pass reads as four jobs: the throw, the fourth
delivery model, a floor plan, and a repaint.

### 1. He throws his bandages, and cover is the answer to it

The figure was a metronome you had to pass. He now also **unwinds a length of his own tape and throws
it down the floor**, which changes what the screen is about: the corridor is no longer the only
dangerous place on it.

The design is three numbers and one piece of geometry, and every one of them exists to keep the attack
readable rather than to make it weaker.

- **A long telegraph, on his own body.** `THROW_WINDUP` 0.55s — longer than the stamps' 0.34s warning,
  because the tell is 500px away from the player rather than directly over them. He raises a coil out of
  the fist at the end of his reach, gaining a course and a ring as it grows, and three chevrons step out
  along the line the roll will take. All of it is drawn from `MummyState.wind`, the simulation's own
  count, so the tell cannot promise a throw that is not coming.
- **He stands still through the whole thing** (`winding` is a phase, not an overlay), so every attempt
  costs him ground. That is what pays for the attack being ranged at all.
- **It is jumpable, and only jumpable.** `THROW_FLOOR_OFF` 30 puts the roll's box at 559–581 against a
  standing player's 556–600: standing still is a capture, and 41px of a 140px jump clears it. Chest
  height would have been dodged by doing nothing (there is no crouch on this screen) and head height
  would have been invisible behind the props.
- **One roll in the air, ever**, enforced in `aim` rather than hoped for.
- **`THROW_SPEED` 210, under the player's 260.** A projectile faster than the player can only be jumped;
  this one can also be backed away from, which keeps "read him and pick your moment" the skill.
- **`THROW_MIN_RANGE` 150.** At point blank the roll spawns already overlapping the player, which is a
  hit with no telegraph — the unfair-not-hard failure `WARN_TIME` exists to prevent. Inside that
  distance his body is the threat, which is the fight the screen already was.
- **He only throws at a player he is ALREADY FACING.** He never turns to aim. That is what keeps the
  patrol a metronome: his back is genuinely safe, so which way he is walking is *information*, and the
  throw cannot smuggle a direction change into the pattern the player has just read.

Then the thing that only became obvious once note 6 was in the same pass: **the partition wall has to be
cover.** The owner's brief for the drop is that the mark lands before the partition "so the user can
take it safely", and the badge now takes 3.7s to arrive — so a roll that crossed the wall would make the
one place on the floor that is meant to be safe the one place you cannot stand still. `Workplace` is
therefore the only hazard handed the screen's static solids: a roll dies against a solid, and
`hasLineOfFire` stops him even *winding up* at somebody behind one (a wind-up whose roll dies on the
wall reads as him not understanding the room, and worse, it burns the interval, so sheltering would
*suppress* the attack instead of avoiding it). The cutter's orb still ignores geometry, deliberately, and
the two rules now say opposite things for reasons that are each about the screen rather than about
physics.

**The winnability argument had to be re-measured, again**, because that is what a new attack invalidates.
Probe: 20 policies (five jump-trigger distances × four roll-dodge distances) over 12 start delays.
Result: **best 9/12, and every win in the entire sweep was delay-free.** The best policies are jump-at-
110-130 with a **late** dodge — 70px, not 140 — which is a real property of the attack rather than a
quirk of the probe: at 210 px/s against the player's 260, jumping early lands you back down into the
roll. The blind sprinter is 0/12 and is now stopped by two different things. `screen3.test.ts` plays the
shipped tuning and states the shape of that result.

### 2. The fourth delivery model: it falls out of the light

`world/badgeCeiling.ts`, alongside `badgeFloat` (rail), `badgeDrop` (airdrop) and `badgePerch` (perch).
Four beats, and each one asks a different question:

- **`held`** — the mark hangs under the first spotlight's lens for `HOLD` 3.2s, lit, obvious and
  completely untakeable. **This beat is the mechanic**: it is the only pickup in the game that is
  *visible before it is takeable*, so the offer is on screen from frame one and being ready for it is a
  decision. 3.2s is measured against the walk — the spawn is ~170px from the drop column, so a player who
  runs straight there waits ~2.5s under it.
- **`falling`** — straight down the fitting's own axis (an arc would say somebody threw it), eased t²,
  with a contact shadow tightening on the cabinet top so the run-up can start before it lands.
- **`live`** — the perch's geometry with a clock on it: `LIFETIME` 4.5s, four pips going out, and the
  whole thing blinking through the last `WARN_TIME`.
- **`gone`** — `GAP` 2.4s, then it is back in the fitting. A missed drop costs seconds, never the
  capability.

The landing pad is an **overhead storage cabinet that floats** (gx 4-5, gy 12, `role: "pedestal-cabinet"`
so the renderer paints it as furniture rather than as level brick). Row 12 is the row this build has
already proved twice: underside at 520 clears a standing head (556) by 36px, so holding right walks
underneath and declining is possible, and its top puts the mark 120px up — most of a 140px jump, i.e.
the button held for ~20 frames. Identical arithmetic to Hire Under Fire's air-dropped brick, arrived at
from the other direction.

**And the cabinet's right edge is load-bearing geometry.** At gx 4-5 it ends at x 240; a player pinned
against a partition at gx 6 occupies 212–240, i.e. *underneath it*, where its underside caps their jump
at 36px against the 80px the wall needs — **the screen would have been sealed.** So the partition moved
to **gx 7** and the figure's corridor to **gx 10**, which is also why `FIRING_COLUMN` in the tests went
7 → 9. This is the "a rising plate's park row is load-bearing and the validator cannot see it" trap in a
new costume: the thing that seals a screen is not the pickup, it is what the pickup's furniture does to
the *jump beside it*.

Everything phrased in terms of the rail had to be split for the **fourth** time (rail vs drop, then the
screen with no badge, then the perch, now this). `badgeLowestBox` on this badge reads gy 4 — the
*spotlight's* row — and puts the "band" 201px over a standing head, so `badgeReach.test.ts` and
`setbackLog.test.ts` both had to name the deliveries they apply to; the latter is now an explicit
`delivery === 'rail'` filter rather than a growing list of exclusions. `screen4.test.ts`'s "every other
screen always has a pickup box" also had to learn that there are two screens whose badge can be absent.
The validator got the perch's three geometric rules generalised (rests on a solid, that solid floats, the
rest box is out of standing reach) plus `validateCeilingTiming`, the ceiling twin of the air-drop's
fairness gate.

### 3. The floor plan, and the defect the owner spotted

`WORK_PODS` was `[190, 430, 668]`. The pod at 190 spanned 190–386 with its monitor at 224–272 — straight
through the partition wall's column, which is exactly what the owner saw: **the payoff's lit screen was
painted on top of the one solid the player has to jump.** That is the "a backdrop prop may not stand in a
column a solid stands in" rule, and this screen now has three solids to keep clear of rather than one.

Right of the new partition there is not room for three 196px pods before the terminal at 922, so the room
**lost a pod** (`[470, 690]`) and the cabinet bank moved 290 → 340 (it overlapped the partition too). The
server rack went 100 → 56. Both remaining pods get a colleague in the payoff, where it used to be two of
three. A tile-level check of the whole plan: cabinet 160–240 · partition 280–320 · cabinet bank 340–444 ·
cone gx 9 (its 48px base plate at gx 8 touched the partition) · pods 470–666, 690–886 · terminal
922–1046 · boxes 1136.

### 4. The repaint: the room came off the teal axis, and so did the furniture

The diagnosis for notes 3 and 5 is one sentence. Wall registers `#0A2B33`/`#0E3846`/`#051B23`, glazing
`#06303C`, desks `#17566A` with `#46A6BC` edges, hero blazer brand Light Teal `#005465`: **five dark
teals**, so the room, the view, the furniture and the person were one field with shapes scored into it.
The hero appears on six screens and cannot be tuned for one, so everything else moved — the same move
the floor made last pass and screen 2 made going brown, and for the third time the answer was
*temperature at the same value*, not a value change.

- **The plaster is warm grey-olive** (`WALL`: `#231F1A` / `#35322A` / `#2C2A23` / `#1A1712`), values held
  within a step or two of what they replaced, because the value structure was already right.
- **The ceiling stays cool slate.** That is what stops the warm wall reading as a sepia filter: plaster
  and painted metal are different materials and now they look like it.
- **The furniture is warm dark** (`FURN`), so below the dado rail **the only teal thing in the room is
  the player** — which is the whole of note 3. The terminal keeps its teal deliberately: it is the object
  the screen is won on and it is now the one cool thing on the floor, which makes it a beacon.
- **The damage props went warm too** (`DAMAGE`). They were `#17566A`/`#46A6BC` — the desks' old colour —
  and against a warm cabinet bank the pulled-out drawers rasterised as blue plastic trays in a brown
  cupboard. They still obey their own rule (a value or two *above* the furniture, the inverse of the
  furniture's rule against the wall); only the temperature changed.
- **The view out is cool daylight**, six stepped courses `#8FB6C4` → `#5F8C9E` with the skyline in near
  silhouette (`#2C4652` / `#5E7E8C`) and a dark frame. Two surfaces at the same end of the value scale in
  the same hue is an invisible object, and that is what the window was: a slightly different patch of
  wall. Value discipline held — at `#8FB6C4` it is a long way below the wrapped figure's near-white
  cloth, so the window is the lightest thing on the *wall* and never the lightest thing in the *frame*.
- **The desk and the monitor were rebuilt.** The desk was a 30px black box with an 8px slab on it, i.e. a
  shelf; it now has a worktop with a shadow line onto its apron, a cable tray in the leg space and a
  three-drawer pedestal that alternates ends. The divider is a framed fabric panel in two courses with
  three posts rather than one slab with a rail. The monitor was a rectangle on a 10px neck — a television
  on a stick — and is now a thin bezel with a wide panel, a lit top edge, a chin badge, a slim stand and a
  wide foot.

### 5. Four big spotlights, and the raster earning its keep again

The four recessed strip fittings became **spots hanging below the ceiling line**, and the light rules did
not change: the lens is a lit face, the pool is on the floor, the up-facing edges catch it, and there is
still **no beam** — a spot is allowed to be a visible object, but the light it makes is a surface.

The raster found four things, none of which was visible in the code:

- **The first fitting was a box.** A 160px canopy filling the whole aperture plus a 64×44 barrel with a
  flat cowl is wider than it is tall, has no taper, and is indistinguishable from the services duct 20px
  away from it. What says "spotlight" side-on is a *narrow* mounting and a can whose courses **flare
  towards the mouth** (44 → 52 → 62 → 72), with the aperture left as a dark recess behind it.
- **The mark hung in mid-air.** In `held` the badge *is* at `source`, so the two cables drawn "from the
  source to the badge" had zero length: the pickup rasterised floating 50px under the fitting with
  nothing above it. It hangs from `CEILING.SPOT_BOTTOM` now — the room's geometry, passed in by the host,
  because it is not the pickup's number.
- **A lit line lying in a hole.** The duct is **cut** around each spot (`DUCT_GAP` 96) so the fitting can
  come through it, and `litSurfaces` was still painting one 184px lit band along the duct's top centred
  on the fitting — i.e. mostly across the gap. Two bands from the cut's edges outwards. Light-as-an-object
  for the fourth time on this screen and Reception between them.
- **Four flare cells read as feet** under a white box. Two, at the corners of the lens itself.

The pools also came down from 160 to **130** half-width: at 160, four pools on a 300px pitch overlapped
(60→380 against 340→660), which paints one continuous lighter band and reads as the floor's own top edge.
A spotlight should throw a tighter pool than a strip fitting anyway, so the number and the fixture agree.

And **the thrown roll was a red box.** 26×22 filled, keyline, two bars, small hole — a warning sign
flying down the corridor. It is a **stepped disc** now (half-widths 13/12/11/9/5), with a lit crown, a
shaded base, a pale cardboard core and two spokes that step round with the **distance travelled**. Third
object on this screen to pay the "a round thing needs a profile, not nested squares" bill, after the fire
orb and the dragon's ground bursts one screen along. The wind-up chevrons needed a **dark backing cell**
each for the same class of reason: pale cream landed on the wet floor sign and the barricades and
vanished — a telegraph's colour has to beat the surface it lands on.

### Gates

**530 tests** (45 files, up from 508). Typecheck, lint, both builds and `validate:levels` green.
Bundle **IIFE 66.24 KB gzip** (from 63.84), site payload **69.3 KB** — 74% of the 90 KB budget.
Twenty-two new tests: the whole of `badgeCeiling.test.ts` (purity, the four beats, the straight fall,
collectable only where and when it rests) · six on the ceiling delivery in `badgeReach.test.ts` (it rests
on a floating cabinet out of standing reach, it is on the safe side of the partition *and* clear of the
pinned-jump column, it is untakeable through the whole hold, it expires and returns, an auto-runner
ignores it, and a player who waits then runs at the cabinet takes it) · five on the throw in
`screen3.test.ts` (winds up standing still, one roll at a time at shin height, capture books the same
delay his body does, no throw across the partition, and he stops the moment he is freed) · five on the
art in `workplace.test.ts` (the roll is a disc, never wider than its hitbox, in his tape and not the
room's, spinning off distance; the spots flare downwards and their lenses glow up on restore; nothing
lights a duct that is not there; and the cabinet is drawn as a wall-mounted unit with its underside in
shadow).

---

## Pass: Hire Under Fire, rebuilt — a Godzilla out of smaller cells, a jet instead of a girder, one brick, and an ending you can walk out of

Eight owner notes, all on screen 4, and they resolve into five jobs: an art rebuild of the beast, an art
*and* fairness rebuild of its fire, a pickup simplification that turned out to be a timing measurement,
a new ending, and a new death pose. Verbatim:

1. "The screen doesn't look refined and polished — make it better and visually better and refined."
2. "The Godzilla is not at all refined and looks like blocks of red colour — you need to make it look
   like real Godzilla, just in 8-bit style, and the fire it throws is too bad, you need to make it
   better, it's too wide right now; also decrease the size of Godzilla, it's too big."
3. "Remove the 3 brick structures where the ANSR powerup drops — remove the 2 and just keep 1."
4. "Lower the speed of drone."
5. "The water cannon and the throw of water is also bad, it's like blocks just put together — make it
   more refined and well-finished."
6. "When the Godzilla dies make the environment beautiful and well lit up, and from the dangerous
   environment it turns all bright and happy — and if you add any new elements to depict this new
   environment make sure that it is well polished and well finished."
7. "The Godzilla for the dying effect dies on the ground and on one side the Godzilla's costume opens up
   and from there the 5 candidates come out one by one saying HIRED, and the costume after some time
   vanishes."
8. "For the dying effect of our character make the character burn upon touching the fire from the
   Godzilla."

Two of these pairs turned out to be one decision each, and that is the most useful thing in this entry:
**"smaller" and "more refined" are the same change** (note 2), and **"one brick" and "a slower drone"
are the same change** (notes 3 and 4).

### 1. Smaller and more refined are one change: halve the cell, not the animal

The beast was **one 30×24 grid at scale 10 → 300×240px, 720 cells.** The owner asked for it to be both
smaller and to stop looking like blocks of red colour, which reads as a contradiction until you write
down what a 10px cell buys you: at 20 cells across a 200px animal, a leg is two cells, a jaw is one, and
every curve in the outline is a 10px stair. **That is what "blocks of red colour" describes** — not the
palette, the cell.

So the animal is now **46×38 at scale 5 → 230×190px, 1,748 cells**: 23% narrower and 21% shorter on the
frame, with two and a half times the cells in it. `BODY_W/H` came down 260×240 → 200×190, which is four
drawn heroes wide and three tall (it was five and four).

What 1,748 cells bought, and every one of these was fixed against a raster rather than in the code:

- **A deep, blocky skull with a short muzzle.** Three cuts of the head drew a long snout and all three
  rasterised as a crocodile or a raptor. A Godzilla's head is closer to a cube.
- **A short thick neck, set back from the muzzle and narrower than both the skull and the shoulders.**
  Without that narrowing the head merges into the chest and the animal has no neck at all — the same
  rule the Workplace figure's four narrowings paid for.
- **Four big dorsal plates**, narrow at the top, widest at the base, one clear row of air between each
  pair. This took four attempts: at width 4-5 and heights 4-5 they merge into one pale mass along the
  spine, which reads as **fur**. When they were drawn standing off the back behind a dark keyline they
  read as *flags pinned to the shoulder*. Fewer, taller, with air between them, base row in shade.
- **A heavy tail that lies FLAT for its last third.** Tapered all the way to a point down a straight
  diagonal — which is what the first two cuts did — it reads as a **blade**.
- **Hide bands**: runs of three darker cells with gaps of three, on every fourth row. The first version
  darkened single cells on a grid and rasterised as **polka dots**, i.e. a costume.
- **A plated belly on straight bands.** Two cuts followed the silhouette's own front edge row by row and
  both rasterised as a pale ribbon zig-zagging down the chest.
- **Three value bands across the body instead of two**, plus a lit plane on every up-facing surface,
  which is where the roundness comes from.
- **Two feet with lit top planes and claws**, and the room showing through between the legs.

The technique is the one the previous build established and it is what makes a 1,748-cell grid
affordable: the silhouette is authored as **per-row spans in a throwaway generator** in `/tmp`, which
derives the outline, the shading, the belly, the plates and the hide bands mechanically, and the
**output** is pasted in as literal strings. Nothing generated ships. One bug worth recording from it: the
first version shaded every row against the row's *full* span, and on the rows the tail leaves from that
span starts at the tail's tip — so the shading painted **a dark stripe down the middle of the chest**.
Correct arithmetic, wrong object. Each mask (body, tail, forelimb) has to be shaded by its own geometry.

The glasses had to be refitted, and that produced a defect worth writing down: the frame's lower bar,
positioned two rows under the eye, landed **on the mouth line** of the new head, so a dark rule ran
through the teeth and the whole face read as a **blindfold**. There is no bar under the lens now.

### 2. The fire: a narrower cone, and a jet painted per column instead of per box

Two things were wrong and they had different fixes.

**Too wide** (owner). `CONE_NEAR_H`/`CONE_FAR_H` were 120/190 — 190px of flame at the far end is three
standing players deep, which is weather rather than a breath. They are **70/120** now.

But narrowing a cone whose axis falls from the jaw to the floor makes the screen **easier**, because the
flame meets a standing head *later* along the axis. So this is a fairness change first, and the whole
chain had to be solved together:

```
jaw height above floor  h = BODY_H − BODY_H×MOUTH_Y_FRACTION = 190 − 28.5 = 161.5
lethal from  438.5 + 141.5f + 35 + 25f ≥ 556   →   f ≥ 0.495
lethal strip = (1 − 0.495) × CONE_REACH
```

At the old reach of 560 that is 283px ≈ 1.19s to walk clear of, against 1.60s of safe floor — a screen
a blind sprint would survive. **`CONE_REACH` therefore went UP, 560 → 620**, putting the lethal strip at
313px ≈ 1.31s and the lane at x 348–661. The two probes that matter both still pass: the reading policy
(wait outside the far end, commit the moment a burst ends) clears it with zero delays, and the blind
sprint dies. `MOUTH_X_FRACTION`/`MOUTH_Y_FRACTION` are now **read off the drawn grid** (mouth row 5,
muzzle column 41) rather than chosen: 0.46 and 0.15.

**And it looked bad.** The burn was three stacked rectangles per hitbox segment — eight boxes in three
colours, i.e. **an orange girder lying across the screen**. The fix is the clouds' lesson pointed at a
hazard: paint a **profile**, a 4px cell per column, each column with its own top and bottom.

The first attempt at that painted each column to the height of *the box it fell in*, and a box is an AABB
over a whole segment — so it rasterised as eight rectangular blocks with hard steps between them, which
is the same defect in a new costume. **The flame's band per column is computed from the same numbers
`coneBoxes` steps** (axis lerp + half-thickness lerp), which is strictly inside the hitbox because the
band is a subset of its own box. That is the rule this file has always kept — what is painted is what
burns — with the arithmetic shared rather than the geometry copied. Both edges bite *inwards* only, the
nose tapers over the last 7% so the jet has an end rather than a cut, and there is a hot root at the jaw
kept on the fire's own side of the mouth (centred on it, half of it hangs outside the first segment).

### 3. One brick and a slower drone are the same decision

Removing two of the three floating bricks is trivial. Slowing the drone is not, because
`POWERUPS.DROP.CROSS_TIME` was set by one-tap play: on touch the hero auto-runs, so the badge is only
collectable if it lands **in front of** him, and a slower drone is overhead later, releases later and
lands later. The two notes push the same variable from opposite ends.

So it was measured. A sweep of (column × `CROSS_TIME`), scoring the contiguous window of single taps that
still take the mark (the budget is ≥0.3s):

| column | 2.6 | 3.0 | 3.2 | 3.4 | 3.6 | 4.0 |
|---|---|---|---|---|---|---|
| gx 13 (the old first drop) | 0.40s | 0.40s | 0.40s | 0.40s | **0.17s** | 0 |
| gx 15 | 0.40s | 0.40s | 0.40s | 0.40s | 0.40s | 0.10s |
| gx 16 | 0.40s | 0.40s | 0.40s | 0.40s | 0.40s | 0.13s |
| gx 17 | 0.40s | 0.40s | 0.40s | 0.40s | 0.40s | 0 |
| gx 18 | 0.28s | 0.28s | 0.28s | 0.28s | 0.28s | 0 |

So the pair is **gx 16 at 3.4s** (424 px/s, 23% slower than the 554 that shipped), two steps inside the
cliff. gx 18 never clears the budget at all — the later taps die in the fire.

Then a second measurement fell out of the first: with the drone slowed, the mark landed **33px behind**
the auto-runner's front edge instead of in front of him, because **the fall spends exactly the lead the
crossing bought** (137px of lead at release, 143px of walking during a 0.55s fall). `FALL_TIME` came
down to **0.35**, which is also the more honest picture — a crate let go by a drone accelerates. Gap at
landing: 28–35px in front of him.

One test had to change its shape rather than its numbers: `badgeDrop`'s phase-walk asserted the sequence
was exactly `carrying → falling → live` inside one cycle, and with the slower drone and the shorter fall
the early columns now *expire* before the cycle is out. The **order** was always the claim; the length
of the list was an accident of the old clock.

### 4. The water cannon and the jets: neither was made of anything

The owner's word was "blocks just put together", and both objects deserved it.

The **cannon** was 26×13 at scale 2: a pale housing, a parallel-sided tube and a lit rectangle for a
mouth. It is **32×17 → 64×34** now, authored the same way as the beast (spans, mechanical outline, lit
rail per part): a pressure tank with a band and a valve, a **mid-value** housing with one lit rail (the
rule a carried thing has to obey — it is held in front of whatever the hero is standing against), a grip
and a trigger, and a mouth that **flares in whole-cell steps** to a dark aperture with two lit cells in
it. Two failed cuts on the mouth are worth keeping: filled with a pale bore it read as a **white flag on
the end of a stick**, and with parallel sides it was a **pipe**. A hole seen side-on is dark.

The **jets** were five squares stepping back from the head every 20px — a dashed row of rectangles with
the sky between them, which is the tape-ribbon defect from the Workplace in another costume. A jet is
now a **tapering line of 4px cells every 4px** with a lit spine, thickest just behind the head and
thinning to a wisp, plus a stepped nose in front of the hitbox and three droplets offset *across* the
line of travel. The head is still exactly the hitbox, because it is the hitbox.

### 5. The ending: it dies on the ground, the suit opens, and five people walk out of it

The old ending was a fade: the beast dissolved on the spot and left a heap of spectacle frames. The
owner's ending is a **sequence**, and the important structural consequence is that **a creature that
dissolves leaves nothing that can then be opened.**

- **The fall.** `stripping` (1.1s) is now a **topple**: the standing grid is drawn cell by cell with each
  row sheared sideways in proportion to its height off the floor, sinking and squashing, so the head
  travels furthest and the feet stay put. It leans *away* from the player, which is the side the five
  will come out on. The empty suit builds up underneath it as it fades, so one becomes the other.
- **The suit.** A new 52×13 grid at scale 5 → 260×65: a slumped profile interpolated between control
  points (the skull lying on its cheek with the jaw open, the shoulders still holding their shape, the
  hips, the tail trailing away), with a **zip down one side**. Authored as flat runs first, it rasterised
  as a row of boxes with vertical cliffs between them — the same "count the steps in the outline" lesson
  the clouds taught.
- **The opening is an event, not a state.** The zip's cells (`i`/`z`/`Z`) are painted only as far as
  `openness` has run; before that, those columns are the suit's own body. A costume that is open on the
  frame it lands cannot be *opened*.
- **They walk out.** `CandidateState` carries a facing and a walk now instead of a fall: everyone starts
  at the door and walks to their own place in a line-up **towards the player**, `CANDIDATE_STAGGER`
  0.55s apart, which is longer than one walk-out is visible for — so early in the sequence there is
  exactly one figure in the doorway, which is what "one by one" means as arithmetic. Stride is
  distance-driven (a bob plus a thrown leading leg), never clock-driven, or five people march in lockstep.
- **Then it vanishes.** `COSTUME_HOLD` 1.6s after the last hire arrives, `COSTUME_FADE` 1.2s, and
  `costumeState()` returns **null** rather than `fade: 1`, so "there is nothing there" is not a number
  anybody has to check. All five are out at 3.15s and the suit is gone at 5.95s — inside the walk from
  the roost to the exit, so the payoff finishes on the screen it happened on.

The whole sequence is a function of **one clock** (seconds since the beast went down), so the hazard
remembers nothing and a replay lands on the same frame.

### 6. The environment comes good, in two layers

`Dragon.relief` (0..1 over `RELIEF_TIME` 2.2s after the fall) is the dial, and it is handed to
`scenery.ts` as a plain number — the backdrop still knows nothing about a badge, a hazard or the
simulation. It is a **second parameter** rather than a second meaning for the maze's `weather`, because
one number doing both jobs reads as a bug the first time a screen wants both.

The maze's lesson is inherited wholesale: **the change has to be visible across the whole frame**, so
there are two layers — the sky (`drawSceneBackground`) and a full-frame veil-and-wash over the masonry
and under the cast (`drawReliefWash`, drawn from `Game.drawDragonScreen`, exactly where the maze draws
`drawWeatherWash`). And "un-gloomed is not lit": the veil lifting and the pale wash coming up are both
there, not one dial doing both.

What actually moves: the sky from an ember night to a bright morning; the **sun and the cloud bank**,
which are screen 2's own functions (there is one sun in this game); the skyline hazing up as its lit
windows go **out**; the heat shimmer going away with the danger it belonged to; the scorch under the
roost receding and **grass coming through it**; and the market opening — awnings up and trading, lit
windows out.

### 7. The screen itself, refined

Note 1 was the vaguest and it had a concrete diagnosis: between the horizon and the floor there was
200px of **nothing**, so the frame was a sky, a distant skyline, a brick band, a beast and three teal
smudges. Two props fix it:

- **`drawMarketRow`** — a ridge of four low blocks with stepped parapets, a water tower breaking the row,
  windows, and two striped canopies at street level. All of it **left of x=760**, which is the rule the
  deleted crag paid for: two dark warm masses in the beast's own columns is one mass, and the animal
  loses its silhouette.
- **`drawHiringQueue`** — the three loose figures became a **queue behind a rope** (posts, a sagging two-
  course rope), which says what they are: people waiting on this process.

And the name plate moved. At chest height it was clear of the HUD, clear of the animal and clear of the
sky — until the beast shrank and the cone narrowed, at which point **the jet ran straight through the
plaque**, because a jet leaving a 190px animal's jaw crosses exactly the band a chest-height label lives
in. It is 72px above the floor now, under the lane, in the one window nothing else uses.

### 8. The hero burns

The game's **fourth death pose**, and it follows the rule the other three set: build it out of the
obstacle's own vocabulary. A stamp flattens him, the Workplace figure tapes him up, a compliance monster
files him — fire **burns** him. Soot climbing from the feet, flame on the body, embers, a pale smoke
plume. Drawn *over* the hero like the tape and the paperwork, because the sim booked the delay on the
frame of contact and the person underneath has to still be recognisable.

It is the first pose that is a **process** rather than a frame, which is why `Simulation` now exposes
`lifeLostProgress` (0..1 through `LIVES.LOST_HOLD`, on **sim time**). The first cut drew a flame column
per 4px of body and every column reached a similar height, so it rasterised as an **orange box with a
head sticking out of the top** — the cone's own defect, third costume. What reads as burning is seven
tongues at very different heights, each tapering to a single cell, with the person visible between them:
the test measures it as distinct cells covering under 45% of the rectangle they span.

### Numbers

- **544 tests** (45 files), up from 530: nine new ones for the burn, the costume's three phases, the
  topple, the walk-out, the relief dial and the market/queue/wash.
- **IIFE 68.91 KB gzip** (was 66.2), site payload **72.4 KB** (was 69.3) — 77% of the 90 KB budget. The
  ~2.7 KB is the two new grids and the new art; the budget gate's own measurement question is unchanged
  (`docs/OPEN.md` §1).
- Validator green on all six screens.

---

## Pass: the game learns to make a noise that is not a beep — noise synthesis, eleven cues, and the four screens that had nothing to say

Four owner notes, and every one of them was the same defect underneath: **this engine had no noise
source.** Twelve cues, all of them built out of oscillators, because `AudioEngine` implemented exactly
`createGain` + `createOscillator` and nothing else. The file even says so out loud, in the `roar`'s own
comment — *"with no noise source and no filter, a growl has to be built out of low detuned ramps"*. A
growl built out of ramps is a beep. So is a thud, so is a jet of water, so is an electrical arc, so is
cloth through air. The owner's word for all four of them was "dumb", and he was right: **none of those
sounds has a pitch**, and every one of them had been given one.

So the pass is one engine change and then four screens' worth of wiring on top of it.

### 1. The engine grows a second half: filtered noise

`AudioContextLike` gains four **optional** members — `sampleRate`, `createBuffer`,
`createBufferSource`, `createBiquadFilter` — and the engine gains `noise(from, to, dur, gain, delay, q,
type)`: one second of white noise, generated once, looped through a biquad whose **frequency ramps over
the burst**. That ramp is the whole character of a cue, and it is the thing an oscillator cannot do:
opening upward is something *leaving* (a jet out of a barrel), closing downward is something *settling*
(a thud, a cloud of steam, a roll of tape through the air).

Three decisions inside that are load-bearing:

- **Optional, not required.** A host with no buffer source (jsdom, an embed polyfill) still gets every
  cue — just the tonal layer of it. So no cue is allowed to *be* its noise: noise is texture, the tones
  carry the meaning. There is a test for exactly this, running every noisy cue through a double with the
  three factories deleted and asserting an oscillator still starts.
- **The buffer is filled from an LCG, not `Math.random()`.** The grain is then identical on every machine
  and in every run. `step()` is the only place the no-random rule formally binds, but a quiet exception
  in the audio layer is still an exception, and there was no reason to take it.
- **A read cursor that advances 0.137 of a second per burst.** Without it every burst reads the same
  grain from the same offset, and the water cannon at six shots a second phase-locks into a *whistle* —
  the exact defect the noise was added to remove. This one is not theoretical; it is what the buffer
  being a one-second loop implies.

`playSfx` also takes an optional `level` (0..1) that scales every layer of the cue. That exists for one
reason, and it is in §2.

### 2. Setup Delays: two thuds, and they are the same object

Owner: a thud when the stamp hits the ground, and *"a muffled low power thud when it hits the powered-up
character, as if the thud didn't work"*.

The second one is the interesting half, because it is not a second sound. `stampDud` is `stampThud`
**with everything that made it land taken away**: no transient, no top end, a shorter and much lower
sub, and a lowpass that never opens above 260 Hz where the floor thud's opens to 1100. Measured: the
floor thud peaks at 0.57 with its energy at 120 Hz, the dud peaks at 0.31 with *all* of it at 60 Hz. The
player has to hear the stamp **fail**, not hear a different stamp — a fresh sound there would say
"something else happened", when what happened is that the same mechanism could not do its job.

Neither existed before because the hazard had no way to say the words. `Stamps` now carries the same kind
of monotonic counters `Dragon` has had all along — `slams`, `deflections`, plus `lastSlamAt` — and the
host diffs them in `syncStampAudio()`. Two details the counters had to get right:

- **A slam is the frame the clock crosses `DROP_TIME`**, not `press >= 1`. The latter is true for the
  whole `HOLD_TIME`, which would have thudded every frame the die sat on the floor.
- **A stroke that aborted never thuds.** The check runs *before* the cycle wrap clears `abortE`, because
  the wrap is also where a fresh stroke begins and the two would otherwise be indistinguishable.

And then the number that forced `playSfx(cue, level)`: screen 1 authors **four** stamps at phases 0,
0.25, 0.5, 0.75 on a 1.4s cycle, so something lands **every 0.35 seconds, forever**. At one volume that
is not a mechanism, it is a drum machine. The host weights each thud by the distance from the player to
the column that landed (`0.3 + 0.7·near²`), so the one over your head is a slam and the one across the
room is a pulse under the music. That is not just mixing: **the loud one is the one about to matter**, so
the weighting is information about which column to watch.

### 3. The badge: the one cue on every screen, and it sounded like a menu

Owner: replace it, it is not good. It was `tone(660→990)` then `tone(990→1320)` — two rising blips, and
660 against 990 is a bare fifth beating against its own sweep. The most valuable event in the game
sounded like a form validating.

Rebuilt as a reward rather than a notification, in four layers: a **low fifth underneath** (147 Hz — the
only good event in the game with a body), an **open arpeggio** of nothing but fifths and octaves
(D–A–D–A, so it cannot sound minor and no two notes of it beat), a **bell tail** two octaves up that
outlives the arpeggio, and a **sparkle** — a thin band of noise sweeping 2.6→7.2 kHz, which is the layer
no oscillator could have supplied. 0.89s, peak 0.49; the old one was 0.26s of two tones. `pickup` (unused
by game code, kept for the API) was reduced to the same family's two-note opening so the two can never
disagree.

### 4. The Workplace: the only screen in the game with no voice at all

Five cues, and the screen had **zero** before this — no `syncWorkplaceAudio` existed. The interesting
choice is *where* two of them attach:

- **The groan goes on the wind-up, not the release.** `mummy` is two detuned saws with a muffled breath
  over them, and it fires the frame he starts winding — which is `THROW_WINDUP` (0.55s) *before* the roll
  leaves his hand. A sound on the release would be decoration; a sound on the tell is information, and it
  doubles the screen's existing visual telegraph rather than duplicating its outcome.
- **The hush is the act it warned about.** A falling band of noise, 2 kHz down to 520 — cloth through
  air, and the only honest way to make that noise is noise.
- **The keyboard** is a flurry of seven keystrokes at *uneven* spacing (0, 0.10, 0.17, 0.27, 0.33, 0.44,
  0.52), because a fixed interval reads as a machine and this is a person. Rising edge of "somebody is at
  the terminal", so it plays as he sits down rather than once per frame he is sitting there.
- **The chime** fires on `restore` crossing **0.5** — which is the *same threshold* `drawTerminal` prints
  the word OK at. Sound and text off one number, so they can never disagree about when the room came good.
- **The arc** is the one cue with no simulation event behind it, and deliberately so: the sparks are drawn
  from a render hash (`hash2(t*14)`) and have no sim clock to borrow. So its pacing lives in the host too
  — `SPARK_INTERVAL = 1.7s` in `Game.ts`, *not* in `tuning.config.ts`, because a gameplay constant behind
  a sound that changes nothing would be a lie about where the number matters. Quiet on purpose (peak
  0.12): the screen can be on for half a minute and this has to read as a room you are standing in.

`Workplace` grew `windUps`, `throws`, `isWorking` and `isSparking` to say all of that, and stayed as
headless as it was.

### 5. Hire Under Fire: a jet made of water, and a fall that finally has a sound

The cannon was `sine(880→1560)` plus `triangle(1320→2100)`: two blips, six times a second. Water is
**broadband** — it has no pitch at all — so it is now a band of noise opening 420→2800 with a short low
chuff under it for the valve. The measured spectrum went from two spikes to energy across every band from
120 Hz to 8 kHz, which is what a jet is. `steam` became its mirror (5.2 kHz closing to 700, longer and
softer — a cloud next to a stream) and `strip` gained a tear of noise over its pluck.

The topple was the note with the biggest gap behind it. **"The Godzilla going down is very dumb"** — and
it had *no cue of its own at all*. The fourth hit played `strip`, the same 0.14s tear as the three small
hits before it, and then nothing happened until `hired` a second and a half later. The biggest event on
the screen was the quietest.

`topple` is built as a **fall**, in two parts, because that is what is on the screen: a long descending
groan (124→30 Hz over 1.05s) with a rumble under it while it goes over, and then a **floor impact 0.58s
later** when it arrives. 1.16s, peak 0.68, and nothing else in this game reaches 26 Hz. It needed one new
public getter (`Dragon.isToppling`) because the fall is the only event on that screen with no counter
behind it, and the host plays it **instead of** the fourth `strip` rather than on top: they land on the
same frame, and a tear of cloth under a falling animal is the small sound winning the mix.

### 6. Listening to it, the way we look at the pixels

There is no browser here and there was no way to hear any of this — which is the same hole the raster
harness fills for art, and the handoff is blunt about what happens when a visual pass skips the raster.
So: `node-web-audio-api` (a real Rust Web Audio implementation with a working `OfflineAudioContext`)
installed **outside the project**, `AudioEngine` pointed at it, every cue rendered to a buffer and
measured — peak, RMS, length, and a Goertzel ladder at 60/120/250/500/1k/2k/4k/8k Hz. WAVs written out
for a human to play.

Two things needed working round, both worth writing down for the next session:

- An `OfflineAudioContext` reports `state === 'suspended'` until it renders, so `AudioEngine.suspended`
  is true and **every cue silently refuses to play**. The probe wraps the context in a Proxy that reports
  `'running'`.
- Its `resume()` **never settles** (it is only meaningful mid-render), so `await engine.unlock()` hangs
  forever with no output at all. The same Proxy stubs `resume` to a resolved promise. This cost two dead
  runs that looked like an infinite loop in the measurement code.

The first measurement pass then found a real defect, and one the code could not show: **the noise-led
cues were far too quiet.** White noise through a Q≈1 bandpass keeps a small fraction of its energy, so a
noise layer at the same nominal gain as a tone lands 2–3× lower — `spark` peaked at 0.06 and `water` at
0.16, i.e. under the music bed. Ten gains were raised and re-measured. Nobody would have caught that by
reading the file; it is exactly the audio version of the occluded sun.

### Numbers

- **560 tests** (45 files), up from 544: four in `AudioEngine.test.ts` (noise layering, tone-only
  fallback, per-cue level, the thud/dud family), two on the stamp counters, two on the Workplace beats,
  one on the topple window.
- **IIFE 70.90 KB gzip** (was 68.91), site payload **73.44 KB** (was 72.4) — 79% of the 90 KB budget. The
  ~2 KB is eleven cue bodies and the noise plumbing. The gate's own measurement question is unchanged
  (`docs/OPEN.md` §1).
- Typecheck, lint, build, build:site and validator all green.

---

## Pass: the card between two screens becomes a briefing, and the run stops for it

**Owner note (verbatim in substance):** *"After every screen gets played, before the next screen we need
to stop and display a screen which will tell in brief what the next screen is — it need not be too long,
just apt — and only when the player presses a button the next screen would show up."*

Two changes in one note, and only one of them was missing.

### What was already there, and why it did not count
There has been a `TITLE_CARD` state between every pair of screens since the first session. It printed the
stage name, held for `TRANSITION.TITLE_CARD_HOLD` (1.2s) and then dropped into `PLAYING` on its own; a
press could cut it short after 0.4s. So the *place* in the flow the owner is asking for existed — what it
did there was almost nothing:

- **It said nothing about the screen.** A stage name is a label, not a briefing. The run walked into five
  screens it had never explained: a staircase with no ground route, a man who throws his own tape, a
  Godzilla that opens with a roar. Each of those is readable *once you are standing in it and have died
  in it*, which is a poor way to introduce a mechanic to an executive on a phone with three lives.
- **It timed out.** 1.2s is under the time it takes to read a stage name and look up, let alone a
  sentence. Worse, the one line the card *did* sometimes carry — `COPY.lifeLost.retryHint`, "TAKE THE
  ANSR BADGE", which is all that survives of the deleted life-lost overlay — had 1.2 seconds to be read
  in, on the very frame the player is still processing having died. The copy comment on that string
  admitted it ("read in the second and a half a title card is on screen"). A coaching line on a timer
  the coach chose is not coaching.

So the pass is: keep the state, give it something to say, and take the clock off it.

### The model change
`TITLE_CARD` is now the one mid-run state that **cannot time out**. `step()`'s case for it advances only
on `input.anyPressed`, through the new public `Simulation.requestAdvance()` — which is also what the
card's own button calls, so the keyboard route and the pointer route are the same code path and cannot
drift. The only guard left is `TITLE_CARD_SKIP_AFTER` (0.4s), and it earns its keep: the Start button
both begins the run and opens the first card, and on touch a double-tap arrives as two presses a frame
apart, so without the grace one gesture would blow straight through the briefing it had just opened.
`Simulation.titleCardReady` exposes that grace, because the card's button is drawn from frame one (a
control that appears late reads as a slow page) and the sim, not the host, decides when a press counts.

`TRANSITION.TITLE_CARD_HOLD` is **gone**, renamed `TITLE_CARD_REVEAL` in both copies of
`tuning.config.ts`. It still feeds `titleCardProgress`, which is presentation only. Leaving a constant
called HOLD in a file whose comment said "s auto-advance" next to code that no longer auto-advances is
exactly the drift `docs/INVARIANTS.md` is full of.

### The copy — six briefs, and why they are short
`COPY.titleCard.brief` is keyed by screen id, like `onClear`. **Not** authored in `levels.json`: every
word in that file ships to the host unless `strip-level-notes.ts` is taught to remove it, and this is
prose about the design (the dragon's 700-character note shipping to every host is in this journal
already).

Each brief says what the place is and what the obstacle *does* — never how to beat it, which is the
screen's own job:

| Screen | Brief |
|---|---|
| Reception (0) | On paper it all looks fine. Find the exit. |
| Setup Delays (1) | Setup approvals slam DENIED, on a timer. |
| Compliance (2) | A staircase of queries. No route on the ground. |
| Workplace (3) | A workplace taped shut. He throws his tape. |
| Hire Under Fire (4) | Hiring holds the lane and breathes fire. |
| Tech Park (5) | The ANSR Tech Park. Walk in and take the receipt. |

The length is a **measurement, not taste**, and the first draft got it wrong. Written at ~60 characters
each and set at `PX_TYPE.body`'s own 34-character measure, every one of them wrapped to three bitmap
lines whose third line was the last word on its own — `["ON PAPER IT ALL LOOKS FINE. FIND", "THE
EXIT."]`, `[..., "THEM."]`, `[..., "GROUND."]` — i.e. a one-word widow directly over a centred button, on
six screens out of six. Two fixes together: the card sets the brief at a **26-character** measure (the
default), and the copy came down to ≤50 characters, which lands every brief on two *balanced* lines
(21/20, 20/19, 26/20, 26/16, 25/14, 24/24). `ui.test.ts` now fails a brief that needs a third line **or**
whose two lines are more than 2:1 apart, so the next person to write one cannot reintroduce the widow by
being slightly more descriptive.

### The card itself
`buildTitleCard` went from two elements appended straight to the overlay shell to a real
`.beam-run__stack--titlecard`: stage name (+ its orange value rule) · the brief · the retry hint when
there is one · the primary **Continue** cap · the keyboard prompt. Three things about it that are not
cosmetic:

- **`role="dialog"`, not `role="status"`.** The special case in `overlayShell` is deleted. A surface that
  stops the run and waits for a press is not a status message going past, and it now takes focus like
  every other overlay — the `name !== 'titlecard'` exception in `show()` is gone too, since "transient →
  skip focus" was only true while it had a timer. Its accessible name is the stage plus the brief, set
  per screen because there is nothing static to label it with.
- **The prompt is `Or press SPACE`, and both halves of that string are the result of a raster.** It was
  "Press SPACE to continue", which put the word CONTINUE on the cap and again on the line directly under
  it — visible immediately in the PNG and invisible in the code. And it names SPACE rather than promising
  "any button" (the arcade phrasing everyone reaches for) because the card focuses its own button and
  `Input.onKeyDown` deliberately ignores mapped keys while a form control has focus: Space and Enter
  activate the cap, an arrow key does nothing. "Press any button" would have been a promise the DOM
  breaks.
- **The wash went from 55% to 86%.** At 1.2s it was a caption over the stage and a light wash was right;
  it is a reading surface now. It stays short of the scene overlays' 92% because the screen behind it is
  the thing being described.

The prompt also got the smallest type role on the card (`rowText`, not `caption`): measured at `caption`
it rendered **353px wide against the brief's 326**, i.e. the footnote was the biggest line on a screen
whose subject is the stage ahead. That came out of the numeric layout pass, not the picture.

### What the raster and the measurements found
Two throwaway scripts, both against the real generators (`wrapPixelLabel`, `normalizeForPixels`, `FONT`,
`PIXEL_TITLE`):

1. **A layout budget** at frames 1280 / 900 / 560 / 390 / 320: every element's rendered width and height
   from PixelType's own `min(cap, clamp(floor, ideal, ceil))` formula, summed against the frame with the
   overlay's padding. It fits everywhere down to 390. At a **320px landscape** frame the stack is 184px
   against a 162px budget — accepted: the overlay is `overflow-y: auto`, and in portrait the stage is not
   16:9 at all (`56.25vw` + a 360px control band), so a 320-wide *phone* has ~500px of frame. Written down
   here so it is a known limit rather than a surprise.
2. **A 1280×720 PNG** of the card in both variants (first attempt and retry) over a stand-in level. That
   is what caught the doubled CONTINUE. The hierarchy reads as intended: 43px title, the orange rule, two
   39px brief lines, the orange retry line where there is one, the cap, and a 16px prompt.

### The cost everywhere else: every headless driver had to learn to press
This is the part worth remembering. **Removing the timeout broke nothing in the engine and every driver
in the repo** — because the pattern for "get to PLAYING" everywhere was `while (state !== 'PLAYING')
step(neutral)`, which now sits on the card until its guard expires and then asserts against a sim that
never started. `src/test/helpers.ts` gained `driveInput(sim)` (`anyPressed` when and only when the state
is `TITLE_CARD`; ignored while PLAYING, so it is safe to feed on every frame of a drive) and
`stepToPlaying(sim)`, and `driveToScreen`, `recoverFromLifeLost`, `golden.test`'s `playToWin`,
`Simulation.flow.test`'s `driveToEnd` and both `toPlaying` helpers now go through them. Anything that
walks the run from now on has to use them.

Three tests changed meaning rather than mechanics:

- `Simulation.test.ts`'s **"auto-advances from the title card to PLAYING" is now "starts the stage on a
  press, and never on its own"** — ten seconds of neutral frames, still `TITLE_CARD`, then one press.
  That inversion is the regression guard for the whole pass.
- Two new ones beside it: the grace (a press on the opening frame does nothing; a press after
  `TITLE_CARD_SKIP_AFTER` starts the stage) and `requestAdvance` being a no-op in every other state.
- `keyboard.test.ts` — the keyboard-only proof — used to *wait out* the card with `makeInput()`. It
  presses through it with the real `Input` now, which is the honest version of "fully playable with the
  keyboard alone": a card that waits for a press is a wall for a keyboard user if a key cannot dismiss it.

### One thing the owner should confirm
The briefing applies to **retries too**, because it is the same card: lose a life and the stage restarts
from a card that now waits for a press instead of dropping you back in after 1.2s. Two arguments for it —
one surface with one rule, and the retry hint finally has time to be read — and one against: it is an
extra press after every death, and §4.2's "a lost life SHOWS NO SCREEN" was written when the card behind
it was a 1.2s flash. Logged in `docs/OPEN.md`.

### Numbers
- **565 tests** (45 files), up from 560: three on the sim's new flow, two on the card's DOM, and one
  completeness check that every screen in `SCREENS` has a brief that fits.
- **IIFE 71.31 KB gzip** (was 70.90), site payload **73.85 KB** (was 73.44) — 79% of the 90 KB budget.
  The ~0.4 KB is six briefs, the card's extra nodes and the prompt.
- Typecheck, lint, build, build:site and validator all green.

---

## Pass: the briefs say the real thing, and the card loses its footnote

Follow-up to the pass above, same conversation. Two owner notes: **"improve the copywriting — it needs to
give the basic real life idea without saying so"**, and **"the 'or press SPACE' is overlapping a bit with
the Continue button."**

### The copy: a brief is the reason the screen exists, not a description of it
The first six briefs described **mechanics**: "a staircase of queries", "he throws his tape", "hiring
holds the lane and breathes fire". Every one of them was accurate, and that was the problem — they told
the player what they were about to watch for themselves ten seconds later, and they said nothing to the
person we are actually talking to. The rewrite names the real programme risk in the language of the room,
with no B2B vocabulary anywhere:

| Screen | Was | Is | What it actually says |
|---|---|---|---|
| Reception (0) | On paper it all looks fine. Find the exit. | **Every plan looks clean from the lobby.** | the business case before contact with reality |
| Setup Delays (1) | Setup approvals slam DENIED, on a timer. | **Nothing here is approved the first time.** | resubmission loops |
| Compliance (2) | A staircase of queries. No route on the ground. | **Nothing is filed in a straight line.** | the filing chain, and that it doubles back |
| Workplace (3) | A workplace taped shut. He throws his tape. | **The team is ready. The floor is not.** | the enablement gap — hired, and nowhere to sit |
| Hire Under Fire (4) | Hiring holds the lane and breathes fire. | **Talent never waits, and it never plays fair.** | a contested market that moves faster than the plan |
| Tech Park (5) | The ANSR Tech Park. Walk in and take the receipt. | **Doors open, and a year still in hand.** | the whole argument, with no figure in it |

Every one is 36–44 characters, two balanced lines at the card's 26-char measure. Three rules came out of
writing them, all now tested: **no product name** (the receipt is where ANSR answers; a pitch on the way
into a stage is an advert), **no instruction** (how to beat the screen is the screen's job), and **no word
echoed from the stage name printed directly above it.**

That last rule is the pass's find, and the **raster** produced it, not the code. The first rewrite had
COMPLIANCE over "compliance does not run in a straight line" and WORKPLACE over "your team is ready, the
workplace is not" — the heading and the line under it saying the same word, 40px apart. It is the same
defect as CONTINUE printed twice on the previous pass, and it is invisible in the source because the two
strings live in different objects. "Nothing is filed in a straight line" and "the team is ready, the floor
is not" are the fixes, and both are *better* copy for it: `filed` is the compliance verb and `floor` is
what a workplace actually is on day one. `ui.test.ts` now walks `SCREENS`, takes each label's words over
three characters and asserts the brief does not contain any of them.

### The card: the footnote is gone
"Or press SPACE" sat under the Continue cap, and the owner is right that it *overlaps* — not in pixels
(there was a −4px margin, now deleted) but in reading: two centred lines of chrome under a button read as
one control that has been drawn wrong, so the eye keeps going back to check which one is the button. This
is the second version of that line to be cut; the previous pass had already removed "Press SPACE to
continue" for printing CONTINUE twice. The lesson is the one the start screen learned when its control
legend came out ("stating them made the title screen read as a manual"): **the card focuses its own
button, so Space and Enter already work — the line was explaining something the browser does.**

`COPY.titleCard.prompt` is deleted, and the test asserts the card carries exactly one control with nothing
under it and never mentions SPACE, so a third version cannot quietly come back.

### Numbers
- **565 tests** (45 files) — unchanged in count; two of them are stricter (no prompt, no echo, no product
  name in a brief).
- **IIFE 71.26 KB gzip**, site payload **73.80 KB** — 79% of the 90 KB budget, marginally down on the
  previous pass (a deleted string and a deleted DOM node).
- Typecheck, lint, build, build:site and validator all green.

---

## Pass — the last rail badge starts mid-rail, and that one character turns a pass-jump into a wait

**Owner note (verbatim):** "In the setup delays page make the ansr powerup start from the middle of the
rail and then go up and then down."

### What it is, in one line of trig, and why the line has now been written three ways

`badgeFloatOffset` is the whole of the change: `+A·cos` → `−A·sin`. The band did not move (±155px
around gy 8, 6.4s, `badgeLowestBox` untouched), so nothing measured in `POWERUPS` had to be
re-derived. The **phase** moved, and that is the entire story of this pass, because on this pickup the
phase is a rules change.

The three shapes, and what each says on the frame the screen starts:

| shape | t=0 | first move | bottom of the band at |
|---|---|---|---|
| `+sin` (original) | middle | **down** | 0.75P |
| `+cos` (previous, owner call "it goes up first") | bottom | up | 0 (and 1.0P) |
| `−sin` (**now**, owner call "start from the middle, then up then down") | middle | **up** | 0.75P = 4.80s |

`−sin` is the only shape that satisfies the note as written: `+sin` also starts mid-rail but sinks
first, which is the shape the owner has now ruled out twice. So the implementation was one character
and there was nothing to choose.

### The consequence is not a feel, and it was measured before anything was written down

`badgeReach.test.ts` failed immediately, in the one place that matters: **no single tap takes the badge
on a one-tap pass — 0 of 50 tap frames**, where the previous phase gave a contiguous 0.35s window. A
probe run against the real sim gives the arithmetic:

- a forward-only auto-runner's right edge reaches the badge column (gx 4) at **t=0.40s**;
- at 0.40s the mark's centre is at y 281, i.e. the box hangs **255px over a standing head**, against a
  jump that rises **140px**;
- the band's bottom does not come round until **t=4.80s**, by which time a forward-only run is at the
  exit (260 px/s × 4.8s ≈ 1,290px, and the exit is at 1,240).

So screen 1's rail is no longer a pass-jump. It is still takeable, and that was measured too: standing
under the column and tapping whenever grounded collects it at **t=3.65s** — it is caught on the way
down, a little before the true bottom.

**There is no third option, and this is worth having written down.** For the mark to be low again at
0.40s from a mid-rail start it has to cover 155px in 0.4s ≈ **390 px/s**; the band already ran at
129 px/s and the owner asked for it *slower* (hence 6.4s). Lowering or shrinking the band instead runs
into the other wall: to be reachable at 0.4s the band's middle would have to sit at y ≥ 614, which is
below the floor, and any band whose middle is inside jump range is most of the way back to the
walk-through the raised band was introduced to kill. It is genuinely one or the other — a pass-jump or
a mid-rail start — which is why it went to `docs/OPEN.md` §18 as a decision rather than being
"balanced".

### What the tests say now

The old test asserted a property that the owner's note deletes, so it was replaced by the two halves
of the new truth — the same pair the Compliance perch already has, which is the honest signal that
screen 1's rail has become the *same kind of pickup* as the perch:

1. **`cannot be taken by a single forward tap, however it is timed`** — 60 tap frames swept, all miss.
   Asserting the miss is deliberate: it is the owner's phase call, and without it a future pass would
   "fix" the window by flipping the phase back and think it was tuning.
2. **`IS taken by a player who holds under the column and waits for it to come down`** — driven with
   the inputs a one-thumb touch player actually has (forward, BACK, one jump: `TouchControls`
   keeps BACK in the auto-run layout), plus an assertion that the wait is real (`sim.clock >` half a
   period), so a future change that made it instant would not pass by accident.

`setbackLog.test.ts`'s float-shape test moved with it, and it is a better test for it: **on the anchor
at t=0, at the top at a quarter period, at the bottom of the band at three quarters** — three
statements about the shape the owner specified, rather than one about the sign of a trig call.

### Rasterised, because the phase is visible and only the picture proves the rail reads right

Four frames at 0 / P⁄4 / P⁄2 / 3P⁄4 (`/tmp/brrender/s1rail.mts`), each with a standing hero drawn under
the column for scale: centre **340 → 185 → 340 → 495**, i.e. mid-rail, top, mid-rail, bottom, and the
`rising` flag the wake is drawn from flips true → false → false → true. The image also confirms the
thing the code cannot: at t=0 the mark sits visibly **halfway up its dotted rail**, which is what the
note asks for, and at the bottom of the band it is still clearly above the hero's head.

### Files

Changed: `src/world/badgeFloat.ts` (the offset + the phase rationale rewritten with the measured
figures), `src/data/tuning.config.ts` + root mirror (the `POWERUPS` note),
`src/data/levels.json` + root mirror (the `badge` convention and screen 1's badge note — a rail badge is
now documented as a stop, not a hop), `src/core/badgeReach.test.ts`, `src/core/setbackLog.test.ts`,
`docs/{INVARIANTS,ARCHITECTURE,SCREENS,OPEN}.md`.

**Scope worth knowing:** `badgeFloatOffset` is global to rail badges, but **Setup Delays is the only
rail badge left in the game** — Reception's and the Tech Park's were deleted, and the other three
screens deliver by perch, ceiling and air-drop. So "in the setup delays page" needed no per-screen
switch, and no other screen's reachability arithmetic was touched.

**Not verified:** whether a phone player works out that he has to stop for the badge. That is the
question in `docs/OPEN.md` §18, and it compounds §9 (screen 1 unassisted has never been played by
hand), because 1Wrk is what makes the stamps survivable.

### Numbers
- **566 tests** (45 files), +1: one test replaced by two.
- **IIFE 71.26 KB gzip**, site payload **73.79 KB** — 79% of the 90 KB budget, unchanged (a sign and a
  function name).
- Typecheck, lint, build, build:site and validator all green.

---

## Pass — screen 0 is the player's own head office, not somebody's reception

**Owner note:** "change the name of first screen from reception to home office or something like that,
basically it's their own office they are having the first screen decision at: think from an expert
copywriter perspective, if home office makes sense or something else".

### The name was pointing the wrong way, and that is the whole finding
Screen 0 has been called **Reception** since the first session, and the word says *you have arrived
somewhere that is not yours*. Everything on the screen says the opposite. It is an office lobby
**interior** (owner call, an earlier pass) with entrance glazing, a counter, a lift bank and daylight
outside; its three labelled steps are **business case · board approval · budget**; it clears with
"Approved on paper." That is a company deciding, inside its own building, to build a GCC. And the
*last* screen is an **Arrival — ANSR Tech Park**, so the run had two arrivals and no departure.

### Why not "Home Office", which is what the owner suggested
It is genuine vocabulary in this market — "home office" is the parent HQ as against the offshore
centre, and ANSR's own buyers use it. It still fails as a **label on a screen**, for two reasons that
have nothing to do with whether it is correct:

1. **Post-2020 it reads as a spare bedroom.** The dominant sense for any general audience is now
   working from home. The screen it would be printed over is a polished corporate lobby with a board
   approval in it, so the name would be arguing with the picture in the reader's first half-second.
2. **To a UK/EU reader the Home Office is the government department that issues visas and runs
   immigration.** In a game whose middle screens are *compliance*, *filings* and *entering a foreign
   market*, that is the most expensive possible false association: it makes screen 0 look like a
   regulator, which is the *hazard* category, on the one screen that has no hazard.

Also considered and rejected: **"Boardroom"** (sharper on the decision, but it contradicts the art —
this is a lobby with a counter and a lift bank, not a table; renaming it would demand a new screen) ·
**"HQ"** (generic, and three letters of chrome under a card that gives the name a whole line) ·
**"Business Case"** (it is one of the three step labels *drawn on the screen*, so the cap would echo a
plaque under it — the same defect the briefs were rewritten for).

### The call: **Head Office**
It is the term of art, it is unambiguous in every English market, it belongs to the **player**, and it
fits the naming set, which is places and plain pains: Head Office · Setup Delays · Compliance ·
Workplace · Hire Under Fire · ANSR Tech Park. It also gives the run the bookend it never had — *you
leave your head office and you land in a tech park*.

### What it cost, which was less than expected and in one surprising place
The user-visible rename is **two strings** in `src/data/levels.json` — `name` **and**
`copy.titleCard` — plus the byte-identical root `levels.json` mirror. `Simulation.screenLabel` is
`copy?.titleCard ?? name`, so changing only one of the two makes the briefing card disagree with what
`screen_entered` reports as `screen_name` and with what the game-over receipt prints as the screen
reached (`reachedScreenName`). Everything else was **prose**: 40-odd comment and doc references, in
which "Reception" is used as the screen's *identifier* — `scenery.ts` alone has ten, because the
light-as-an-object trap and the architectural-scale trap were both first paid for on this screen and
are cited by name from `workplace.ts` and `INVARIANTS.md`. Those were renamed too, on the reasoning
that an invariant that cites a screen name nobody can find is an invariant nobody applies.

**Two things were deliberately not renamed.** `drawReceptionDesk` in `scenery.ts`'s history comment
(the function is gone; the name it had is a fact) and the lower-case **reception desk / reception
counter** in `scenery.ts` and `finale.ts` — that is the *furniture*, which is still exactly what it
was, and a head office has a reception desk in it. `docs/JOURNAL.md` was not touched at all: it is
append-only, and rewriting the record so that past passes appear to have used a name they did not use
is precisely the kind of tidying that destroys its value.

**Copy checked, not assumed.** The brief printed under the cap is unchanged — "Every plan looks clean
from the lobby." — and it had to be re-checked against the rule that a brief may not echo a word from
the stage name above it (the raster caught COMPLIANCE over "compliance…" and WORKPLACE over "the
workplace…" two passes ago). "lobby" is not "office", so the card is clean, and the line is still the
better one: a plan is clean *until it leaves the building*, which is the whole of screen 0's argument.
The stage label is painted as **one unwrapped line**, with no `maxChars` (unlike the brief), so a
rename is only free while the new name is shorter than the longest one already shipping — "HEAD
OFFICE" is 11 characters against "Arrival — ANSR Tech Park" at 24, which is why this needed no new
raster. A *longer* name would have.

**Not verified:** nothing was rasterised this pass, on the argument above (shorter single line, same
glyphs, all of H E A D O F I C already shipping in Hire Under Fire / Office / Compliance). If a future
rename is longer than 24 characters, that argument does not hold and the card must be re-shot.

### Also updated
The root spec docs `01_Game_Design_Document.md`, `04_Level_Design.md`, `README.md` and
`analytics-events.json` all named the screen; they are renamed for consistency of the *identifier*,
though note those three remain superseded elsewhere by HANDOFF §4 (they still describe Growth Points,
a 5-second fire shield and the pre-rebuild screen order).

### Numbers
- **566 tests** (45 files), unchanged — `data.test.ts`'s pin on the two badge-less screen names was the
  only assertion that had to move.
- **IIFE 71.26 KB gzip** / ESM 70.78 KB — unchanged to the byte-ish; the payload difference is two
  characters of string.
- Typecheck, lint, test, build, build:site and validator all green. `npm run analyze` still reads
  138.7 KB of 90 and fails for the known measurement reason (`docs/OPEN.md` §1) — not a regression.

---

## The two statistics leave the game, and the three screens either end of the run are rebuilt without them

**Owner:** "Remove the Skip to Navigator button from the First screen which comes before the game
starts and the death screen and the last screen after the game ends and also now that we dont have
those 24 months and 11 months things anymore think of what to have in these screens and implement
them" — and, on the copy: think like an expert copywriter, convey more in less words.

### What was actually there, because the second half of the note describes a state the code was not in
`JOURNEY.BASELINE_MONTHS` (24) and `ANSR_BENCHMARK_MONTHS` (11) were still live *and still printed*:
the title screen's whole hook was "The average India GCC takes **24 months** to go live." set as
three bitmap lines with the figure at display size, and the win screen answered it with a hero figure
(the run's own total), **three comparison bars** (your run · ANSR clients 11 · going alone 24), **two
attributed reference lines** and a "You matched the ANSR benchmark." line — plus a per-row "saves 4
months" on each capability, four figures whose sum is exactly 24 − 11. So the request was read as: the
two averages are out, and with them everything on those screens that only meant something next to
them. **The model keeps them** — `monthsBase`, `MAX_MONTHS`, the validator's month rules and
`br_months` are untouched — because they are arithmetic and a lead score there, not a claim. That
split is now `docs/OPEN.md` §19(a), because a funnel figure derived from a benchmark the game no
longer prints is a judgement call, not a fact.

Why it is the right call and not just compliance: an unsourced industry average is an argument the
reader can win, and both of ours were printed on precisely the two surfaces a prospect screenshots.
The run's absolute total went with them — "you went live in 14 months" asks "is 14 good?" of somebody
who now has nothing to compare it to.

### The three Navigator caps
Removed from the **start screen** (`COPY.start.skip`, a ghost cap beside Start), the **out-of-lives
screen** (`COPY.gameOver.cta`, "GCC Opportunity Navigator") and the **win receipt**
(`COPY.win.cta`/`ctaGap`, the primary). Kept: the pause menu's, the mid-run summary's, and **the four
capability rows**, which are the same offer with a declared `br_topic` — which is exactly why the win
screen's generic cap was the weakest thing on it. Three consequences that are not in the diff of the
buttons: `Game.onOutOfLives` no longer fires `ctaShown('summary')` (an impression for a CTA that is not
there), the win screen's focus target moved from the deleted cap to "Play again", and
`COPY.win.receiptHint` — "Pick one to talk about." — is now the *only* thing telling a player the rows
are live. `onSkip` survives on the `OverlayCallbacks` interface because pause and the pre-mount
fallback still use it.

### What the screens say now
**Start.** Same three-line editorial shape, no number in it:
"ANY BOARD CAN APPROVE A GCC. / **BUILDING IT** / IS THE HARD PART." — an assertion no buyer disputes
and no footnote can be demanded of, and it sets up screen 0 exactly, whose three steps are business
case, board approval and budget and which clears on "Approved on paper." Then the dare, cut from
"Think you can beat that?" to **"THINK YOU CAN?"**: *that* referred to the deleted statistic, so the
pronoun had nothing to point at; hung off "building it" it needs four fewer words. One cap: Start.

**Out of lives.** Unchanged except for the missing button — "OUT OF RUNWAY", "3 DELAYS COST 6 MONTHS",
"Take the ANSR badge and these months never happen.", "Start again". Neither figure on it is a
benchmark claim, so there was nothing to replace; three things and one route, and the route goes back
to the stage that stopped them with the badge line on the card that follows.

**Win.** The rebuilt one. The hero figure is now **months lost to delays** — caption "MONTHS LOST TO
DELAYS", the count-up landing on `delayMonths` instead of `months` — because that figure needs no
benchmark, the player watched every `+2` of it fly off their own body into the log, and **zero is the
reward**. Under it one line in the slot the benchmark line held: "A clean run. Nothing to make up."
or "Every one had an ANSR answer." Then, in the *same* column, the itemised delays under the heading
**"What cost you"**, the pair to the receipt's "What got you here" opposite. Each engaged capability
row states the outcome from `COPY.powers` ("Setup stood up", "Filings cleared", "Team unblocked",
"Roles filled") in place of "saves N months". Deleted: `buildBars` and its six CSS rules, the two
`__ref` lines, `matched`, `savesMonths`, `CapabilityCopy.monthsSaved` and the validator rule that
checked those four figures summed to the baseline gap.

### Rasterised, and it earned it twice over — four defects, none of them visible in the code
Harness `/tmp/brrender/screens.mts` (the real `FONT`, the real copy, the real `PX_TYPE` numbers and
the `clamp()` gaps out of `styles.ts`), shot at 1280×720 and 390×844.
1. **"6 STAGES. 3 LIVES." was the first replacement headline** — the arcade contract, in the title
   spec. In the picture, under three centred lines of hook, it reads as a fourth and fifth line of
   prose: a spec sheet on the frame that has to earn a press. Replaced by the dare; both facts are on
   the HUD five seconds later.
2. **The closing figure was printed twice.** "6 MONTHS" in the run's column and "2 delays added 6
   months" under the capability rows, both in the value orange. That is why the breakdown moved to the
   left column and its summary line became a *heading* ("What cost you") — and it fixed a second
   problem in the same move: with the bars, refs and matched line gone the left column was a caption,
   a number and one line, i.e. a hole beside a five-row receipt.
3. **"Every one of them had an ANSR answer." (37 chars) wrapped**, printing ANSWER alone directly under
   the loudest element on the screen. Cut to "Every one had an ANSR answer." (29). "No delays. Every
   stage cleared first time." (42) had the same fault and is now "No delays. Cleared first time."
   `ui.test.ts` runs every closing line through `wrapPixelLabel(line, 34)` and demands one line, so
   this is measured from here on.
4. **The clean run said one thing twice**: the verdict under the figure ("Nothing to make up.") and
   the receipt's credit line ("Cleared first time.") in the same column. The win screen now prints
   nothing in the breakdown slot when the ledger is empty; the mid-run summary still prints the credit
   line there, because it has no verdict slot of its own.

The mid-run summary was brought onto the same measure (its clock line reads `delayMonths`, not the
run total) so a partial exit and a finish can never report two different numbers. `a11y.won` and
`a11y.outOfLives` were rewritten for the same reason — both used to read out the absolute total,
which is now a figure no sighted player can see.

### Numbers
- **568 tests** (45 files) — net +2: the start-screen stake test became a hook test, the bars test
  became "charts nothing and quotes nobody" (it also asserts the CSS is gone, so the bundle is not
  carrying dead rules), the two CTA-variant tests became one "the only cap is not the Navigator", and
  three are new: the one-line measure guard, the no-statistic *search* over every player-facing string,
  and the breakdown's placement in the run's own column.
- **IIFE 70.36 KB gzip / ESM 69.87 KB**, down from 71.26 — deleted code, not compression: the bars,
  their CSS, two ref lines and five copy keys. Site payload **70.9 KB**. `npm run analyze` reads
  136.9 KB of 90 and fails for the known measurement reason (`docs/OPEN.md` §1) — 1.8 KB better than
  last pass, still not a regression.
- typecheck · lint · test · build · build:site · validate:levels all green.

**Not verified:** the browser's own layout. There is no layout engine here, so the two-column
composition and the new left-column group step were computed from the emitted CSS and checked against
the raster; `npm run dev` is the way to eyeball the real thing. Nobody has played to a win to see the
0 land on a clean run.

---

- **The title screen gets the offer and a control line, the closing screen becomes two blocks, and
  the Workplace pickup loses its label (owner, three asks in one pass).** Verbatim: (1) the first
  screen should carry "Play the GCC Journey before you plan it", drop the "6 stages 3 lives" part
  *and* "Think you can?", and "add the controls guide but do not make this too big — see the
  dimensions and proportions of things"; (2) "make the last screen after the game ends better and more
  well designed and symmetrical, it does not look good right now"; (3) "in the workplace screen remove
  the text from the powerup that says 500 leaders, for now do not keep any text".
  **First finding, before any code: "6 STAGES. 3 LIVES." was not on the screen.** It was drafted in the
  previous pass, rejected in that same pass's raster (it read as a fourth and fifth line of prose) and
  never shipped — `grep` of `dist-site/` confirmed it. So ask (1) was two changes, not three: delete the
  dare, add the tagline and the legend. Worth writing down because the owner was describing a screen
  they had seen in a *draft raster*, not the build; when a request names something that is not there,
  grep the deployed bundle before removing anything.
  **Start screen.** `COPY.start.challenge` is deleted and `COPY.start.tagline` ("Play the GCC journey
  before you plan it.") stands in its slot, at `caption` scale in muted ink rather than as a `title` —
  the hook above it is the headline, and setting the offer at display size gave the screen two
  headlines. It is wrapped at a **20-character measure** (20/19, "PLAY THE GCC JOURNEY / BEFORE YOU
  PLAN IT.") rather than the body's 34, where 39 characters leave one word alone over a centred button.
  The control legend is back after being cut once for reading as a manual, so the constraint is size,
  not existence: one line, `body` scale, `DIM_INK` (the smallest, dimmest type on the screen), and
  **above** the cap rather than under it, because a line of chrome under a button reads as a caption on
  the button — the trap the briefing card paid for twice. It is device-specific through a new
  `OverlayOptions.touch` (`Game` passes its own `isTouch`): keys on a desktop, tap on a phone, never
  both, since a phone player has no arrow keys and one-tap play is the default there.
  **The phone raster caught the legend out-measuring the hook.** "Tap to jump. You run on your own."
  is 33 characters, and at `body`'s *floor* (1.7px per authored pixel, which is what a 390px frame
  lands on) that is **337px against the hook lead's 312** — the footnote as the widest line on the
  screen, which is exactly the defect the briefing card's keyboard prompt shipped (353 against 326).
  Capping its `maxShare` instead would put the glyphs under 9px, so the copy gave: **"Tap to jump."**,
  which is the whole control when auto-run is on. `data.test.ts` now measures both variants against the
  hook at *both* ends of their sizing (unit × cells and minPx × cells), which is the arithmetic the
  invariant asks for and which no character count would have caught — the keys line is 29 characters
  against the hook's 28 and is still comfortably narrower, because the specs differ.
  **Closing screen.** The diagnosis is one sentence: the left column was five centred, ragged bitmap
  lines (caption, figure, unit, verdict, heading, up to three delay rows) opposite four solid,
  full-width receipt rows, in two columns of *equal width* — so only one side had any mass in it and the
  screen leaned right whatever the gaps did. Three structural changes, no new copy:
  1. **The figure, the verdict and the breakdown are one panel** (`.beam-run__cost`), in the receipt
     row's own fill and rail. They are the same fact at three levels of detail, and as a block the left
     column finally has an edge to match the right.
  2. **The receipt hint moved under the rows.** Between the heading and the list it pushed the
     right-hand block a line and a half below the left-hand one, so the two masses could never align;
     as a footnote it also sits where it is acted on, directly under the four routes, and it fills the
     right column's bottom the way the breakdown fills the left's.
  3. **The columns stretch to one height** (`align-items: stretch`, the panel `flex: 1` with its
     contents centred). This is what fixes the case that matters most: a **clean run** has three lines
     against four rows, and top-aligned that was a short box floating in a tall column. Now both blocks
     share all four edges and the figure is centred in its box. Both captions still sit on one line,
     which is why the heading stayed outside the panel.
  **Workplace pickup.** The plaque was drawn by `Game.drawBadge` 52px over the mark, which is dead sky
  on the other three deliveries and is not here: rasterised with and without it (`/tmp/brrender/wp-tag.mts`),
  the label sat **across the spotlight's canopy and its own two cables** in the `held` phase and over
  the four countdown pips in `live`, on the one screen whose ceiling is full of ducts, apertures and a
  hanging tile — and it competed with the whiteboard's own signage 200px away. Deleted. The pickup is
  signposted by the lit fitting it comes out of, the cables, the contact shadow and the pips, which is
  more than any other delivery carries. The capability is still named on the pickup toast and on the HUD
  chip (`docs/OPEN.md` §20 asks whether the toast should go too).
  **Rasterised** at 1280×720 and 390×844 (`/tmp/brrender/screens2.mts`, rewritten from the previous
  pass's harness so the receipt rows are laid out the way the DOM's grid actually lays them out —
  mark | product … detail on row 1, stage spanning row 2 — which the old harness drew as three centred
  columns). Both win variants (clean and delayed) and both start variants (keys and tap).
  **Numbers:** **570 tests** (45 files), +2 — the touch-variant control line, and the closing screen's
  two-blocks composition (it asserts the children of both columns *in order*, which is the only way to
  catch the hint drifting back between the heading and the rows). IIFE **70.50 KB** gzip / ESM 69.99;
  site payload **71.0 KB** (+0.1 — the cost panel's CSS and two copy keys against one deleted one).
  typecheck · lint · test · build · build:site · validate:levels green.
  **Not verified:** the browser's own layout, as ever — the stretch behaviour and the panel's flex
  slack were computed from the emitted CSS and checked against the raster, not measured in an engine.
  Nobody has played to a win on a phone to see the stacked single-column version of the new panel.

---

- **Same pass, second round on the title screen: the hook is deleted, and the control guide becomes
  the buttons themselves.** Owner, on seeing the round above: "from the first screen remove the line
  ANY BOARD CAN APPROVE A GCC. BUILDING IT IS THE HARD PART. For the guide show the buttons instead of
  text — and you have not shown for fire."
  **The hook is gone, and the tagline is promoted to headline.** `buildStake()`, `COPY.start.hook*`
  (four keys), `PX_TYPE.stakeFigure`, `.beam-run__stake` and `.beam-run__stake-figure` are all deleted;
  `PX_TYPE.stakeText` survives under its real job's name, **`advice`** (the out-of-lives instruction and
  the retry hint read it through the `ADVICE` alias). "Play the GCC journey before you plan it." is now
  a `.beam-run__title` at `PIXEL_TITLE` scale, which also hands it the **orange value rule** every other
  headline in the game carries — at `caption` it was a subtitle to a headline that no longer existed.
  Its two lines come from `wrapPixelLabel(tagline, 20)` rather than a hand-split array, so a copy change
  cannot quietly produce a widow. Five things have now been deleted from this one slot, in order: the
  24-month average · the dare that pointed at it · the arcade contract (drafted, rejected in its own
  raster, never shipped) · the three-line hook · and, from the round above, the written control line.
  **The legend is caps now.** Three groups — move (two arrow caps), jump, fire — each cap an 8-bit key
  in the same treatment as the NES action buttons and the HUD plaques, with a 4-letter label beside it.
  Two new specs (`PX_TYPE.key` 0.18, `keyLabel` 0.15) and one rule that is the whole reason this works:
  **a cap is the size of its glyph, not the size of its explanation**, which is what killed the written
  version — 33 characters at the body floor rendered *wider than the headline* on a 390px frame.
  Device-specific through the same `OverlayOptions.touch`: keys on a desktop (`<` `>` · SPACE · F), and
  on touch the pads it will actually draw over the game — two arrows, a big disc, a smaller disc.
  **The act button was missing and is now named in three places.** It has always existed (`KeyF`/`KeyJ`,
  and a touch button that appears once a badge arms a tool) and no surface in the game had ever said so.
  It is in the legend, in both control sentences (`controlsKeys` / `controlsTap`, which are the legend's
  *accessible* copy — the row carries one hidden sentence, not a label per cap) and in
  `COPY.a11y.canvasLabel`. `data.test.ts` asserts both sentences name it, because "you have not shown
  for fire" is the kind of omission that comes back.
  **Two findings worth keeping.** (1) The 5×7 font **had no `<`** — it has had `>` for CTAs since the
  first pass — so a legend with a right arrow and a hole in it was the first raster. One glyph added
  (the mirror of `>`), and `normalizeForPixels` now folds `\u2190` as well as `\u2192`, so arrow *copy*
  renders too instead of losing a character. (2) The touch act pad was first drawn as `>` — **the same
  glyph as the right-hand move arrow** — so the row read "> MOVE … > FIRE" and asked the player to tell
  two identical glyphs apart. The real buttons separate on **size and shape**, both being discs, so the
  legend does: `.beam-run__key--small`. `pixelMark` was generalised to `pixelGrid(rows, fill)` for the
  jump disc, since the font has no `\u2B24` either and a font character would come from the host's
  typeface — the same reason the receipt's tick is drawn.
  **Rasterised** at 1280×720 and 390×844, keys and pads (`/tmp/brrender/screens2.mts`, extended to draw
  the caps with their bevel and the title's value rule).
  **Numbers:** **571 tests** (45 files), +1 net — the hook test became "leads the title screen with the
  offer", plus a new one for the caps (three groups, four caps, one hidden sentence, every glyph drawn)
  and the touch variant now asserts round pads instead of a tap sentence. IIFE **70.79 KB** gzip / ESM
  70.30; site payload **71.3 KB** (+0.3 on the round above: the caps' CSS and one font glyph against four
  deleted copy keys and two deleted rules). typecheck · lint · test · build · build:site ·
  validate:levels green.
  **Not verified:** the browser's own layout, and nobody has held a phone. The caps' minimum sizes are
  frame-unit clamps checked arithmetically at 390 (22px caps, a 245px row that does not wrap) and in the
  raster, not measured in an engine.
  **Caught on the way out, and it is the one thing here that would have shipped broken:** deleting
  `.beam-run__stake` / `.beam-run__stake-figure` with the hook **unstyled the 404 page**, which builds
  its "404" out of those same class names — a build-time surface, so all 571 tests stayed green. The two
  rules are restored and now belong to that page in the comment. `notFound.test.ts` gained a mechanical
  guard (+1, **572 tests**): every `beam-run__` class in the page's markup must appear as a selector in
  the stylesheet it inlines, so the next shared rule deleted with its last in-game caller fails loudly.
  Final numbers: IIFE **70.82 KB** gzip / ESM 70.33, site payload **71.3 KB**.

---

## Pass — a secret tunnel in the Tech Park, and a brick breaker under it: THE GROWTH FLOOR

**The ask** (owner, one brief): put a secret tunnel in the ANSR Tech Park screen with a marker that
subtly indicates there is a way in; behind it is another level, a **brick breaker**. The player falls
in from the top centre onto the bottom centre of the floor; after 3-4 seconds a wall of floating,
fixed, colour-coded blocks appears, some carrying text; 1-2 seconds before it, a rectangular tray and
a skateboard fall and the character auto-equips them; an **ANSR logo is the ball**, with proper
physics — it bounces off the tray, vanishes when the player misses it, lies on the ground for a
moment and is replaced, and the game continues from where it was; the blocks are an optimum size,
neither large nor thick; when the wall is down the same tunnel starts **sucking in a straight line the
width of the tunnel**, and the player has to walk into it to be taken back up to the Tech Park. Make
the screen refined and polished, keep the 8-bit direction but not the other screens' palette, and
**name the stage**. The meaning: this is where we show what ANSR does *after* a GCC is set up.

### The one decision everything else follows from: it is not a screen

`levels.json` has six screens, the six `monthsBase` values sum to the benchmark, the validator
requires a badge ahead of every obstacle, every screen is introduced by a briefing card, and every
screen's name reaches analytics and the receipt. A seventh screen would have touched all of that —
for a room most players will never open. So the bonus is **a stage inside one visit to the Tech
Park**: `Simulation` holds a `BrickBreaker | null`, and while it is non-null it owns the step. The run
stays `PLAYING` on screen 5 the whole time.

That also settles the stakes, and the stakes are the model. HANDOFF §4.1: the run has two stakes and
they measure the same thing. A secret that could take a life would hide the argument's own currency
behind a door most players never find; one that *paid* months would make the benchmark a matter of
finding a secret. So **the stage books nothing and cannot cost anything**, and `bonusStage.test.ts`
says so in four ways (months, lives, log, capabilities).

Three consequences worth writing down, because each of them was a defect first:

- **The Tech Park's `winTrigger` is at x 1040 and the bonus room is 1280 wide.** Falling through to
  the tail of `updatePlaying` meant walking right in the plant room *finished the game*. The bonus
  branch returns before every exit, win-trigger, fall and hazard check, and there is a test whose only
  job is to walk right in there for twelve seconds and still be `PLAYING`.
- **It is entered on the act button, never by walking over the mouth.** This is the payoff screen, and
  every one-tap auto-run player crosses that column: a hole they fall into would take the arrival away
  from people who did not choose it. `canEnterTunnel` (standing, on the mouth) is also the whole of the
  reveal — it lights the hatch, prints the prompt, and on touch it is what makes the act pad appear.
- **`loadScreen` clears it**, so a reset or a lost life cannot leave the plant room under screen 0.

### The stage: "The Growth Floor"

A place, like every other name in the game (Head Office · Compliance · Workplace · Tech Park), and the
place is one floor under the arrival: the centre the player has just spent six screens building,
running. Under it, one line — **"LIVE IS WHERE THE WORK STARTS"** — which is the argument the six
screens have no room for, and which shares no word over three characters with the name above it (the
rule the six briefs follow). Both are painted on the frame rather than on a briefing card: the six
screens stop the run to introduce themselves, and this one is *found* — a card would announce the
discovery back to the player who just made it.

The wall is the content: **24 blocks, 6 × 4, colour-coded by row**, read bottom-up in the order the
ball takes them — footprint (cyan) · people (mint) · capability (violet) · run it better (magenta).
Fifteen of them carry the owner's words; the blanks are staggered so the wall is not a table.

### Numbers that are numbers, not taste

- **Block size is decided by the type at one end and by the room at the other.** A label is set at
  scale 2 (below that, bitmap type is texture) at a 14-character measure = 166px, and the longest word
  in the owner's list is TRANSFORMATION, at exactly 14 — so **176 wide** is as small as the words
  allow. **40 tall**, not 34: at 34 a two-line label centred with 2px of margin put its bottom row on
  the block's own shade course. And a **16px line pitch, not 14** — a scale-2 glyph *is* 14 tall, so
  14 is zero leading and ADDING / CAPABILITIES rasterised as one crushed block of type.
- **Six columns of 176 with 10px gaps leave a 47px lane inside each side wall, and the lane is
  load-bearing in both directions.** Closing it (186×14, wall spanning the full room) trapped a mark
  served out of the ceiling *above* the wall, chewing blocks on its own: the stage played itself. But a
  47px lane was a soft lock in the first cut, because a mark returned straight up can rattle in it for
  ever without meeting a block. Which brings us to the one real bug in this pass.

### The soft lock, and the two lines that fix it

The exit is an empty wall. So a rally that cannot break another block is a room the player can never
leave — the same family as the pocket the Compliance staircase paid for, and worse, because there is no
way to die out of it either.

A probe of 27 policies (tracking · predictive · react-only, three dead zones, three start offsets)
found **six of them still going at 300 seconds with up to 16 blocks left**. Cause: a paddle centred
under the mark returns it *vertically*, and a vertical mark in a column that has been emptied is a
closed orbit between the tray and the ceiling.

- **`PADDLE.MIN_BOUNCE_DEG`** — the mark is never returned straight up. A dead-centre hit leans the way
  it was already going.
- **12 degrees was not enough, and that is the second finding.** Any non-zero minimum kills the orbit,
  but 12 leaves 210px of drift per round trip — about one block — so a player who simply parks under the
  mark clears the wall left to right and then spends half a minute in the half they have already
  cleared. Measured: at 12 the tracking runs took **89s with ten watchdog nudges**; at **20** (364px,
  two blocks) they take **39s with one**.
- **The same floor applies to the serve**, because a rule about the ball's angle that only the paddle
  enforces leaves the one bounce nobody controls able to break it.
- **`BALL.STALL_NUDGE_AFTER` (5s) + `NUDGE_DEG` (18)** is the belt to that braces: five seconds without
  touching the wall is not a rally, so the mark is turned until it is. It has its own counter so the
  host can sound it — something moving on its own with nothing to hear reads as a defect.
- And the nudge needed the *same* clamp it was written to enforce: rotating a mark that is already at 20
  degrees by 18 can land it at 2, which is precisely the orbit. Right in code, wrong in effect, and only
  a test that measures the ball on **every** frame catches it. `keepAngleHonest` is now the one place a
  direction is allowed to be chosen.

After all of it: **25-40s for a player who follows the mark, 50-130s for one who only reacts when it
falls, no stalls in 27 policies.** An idle player who never touches the controls still finishes, in
**132s with 33 misses** — misses are free by the owner's own rule ("a new logo shows up continuing the
game from where it was"), so the gradient is skill making it 4× faster rather than skill being the
difference between finishing and not. Flagged in `docs/OPEN.md`.

### The rest of the model

- **The tray is carried above the head**, not pushed along the floor. That is legibility before it is a
  picture: a paddle at foot level puts the hero's own body in the ball's lane, so every rally would be
  played through him. Held up, the bounce line is 26px clear of his drawn crown and the one thing in the
  room that is not a block stays readable.
- **The tray is released over his own column**, falls, lands and slides to him over `EQUIP_SLIDE` — a
  gift that lands somewhere else and slides across the room reads as a bug, and one that teleports into
  his hands is not a delivery. Equipped at ~2.4s against a wall that appears at 3.6s: **1.2s**, inside
  the owner's "1-2 secs before" and tested (it fails under 0.9s; at `TRAY_AT` 2.0 it was 0.7s and the two
  events read as one beat).
- **The skateboard is a number**: `SKATE_SPEED_MULT` 1.25, so 260 → 325 px/s. It is the only place in
  the game the player is quicker than the run.
- **Jump is masked for the whole stage.** The tray is over his head, so a jump would take the bounce line
  with it, and there is nothing in the room to jump onto.
- **The ball is a breakout ball, not a falling body**: constant speed, pure reflection. Gravity on top of
  it would make every miss the room's fault rather than the player's, and the serve is already a drop.
  Speed 470 rising 6 per block to a 620 cap.
- **The tray is deliberately forgiving**: any contact while the mark is falling counts as a top hit. This
  is a bonus stage in a game about being helped; a pixel-exact paddle would be the only thing in it that
  punishes.
- **The shaft is one number at both ends.** `BONUS.ROOM.TUNNEL_W` is 80 and the hatch in `levels.json` is
  two tiles, so the shaft he falls down is the shaft that takes him back up — the owner's "sucking in a
  straight line, the width of the tunnel" is not a second measurement. The draught never expires, it only
  carries him **while he is inside the column**, and it is the one place in this stage where the room
  moves the player.

### Art, and the five defects only the raster found

Own palette, as asked: **indigo**, because it is a plant room under a plaza and because the four block
hues have to separate from each other *and* from the ANSR mark that breaks them. Orange appears nowhere
except the mark itself, so the only warm thing on the frame is the thing the player is hitting the wall
with. Two equipment racks with mint LEDs are the only thing in the room that says *why* it exists: the
centre is downstairs and it is running.

Rasterised with `@napi-rs/canvas` (`/tmp/brrender/growth.mts`), five frames plus the hatch. What the PNGs
caught, none of which is visible in the code:

1. **The break flash was a pale 176×34 rectangle on the block's own footprint** — a grey slab sitting in
   the wall, i.e. light-as-an-object at brick size. It is an expanding **outline** now, which reads as a
   shell coming apart and costs four fills. A test measures it (no pale cell may be block-sized).
2. **The suction was seven 20px chevrons at 0.2-0.7 alpha up a 600px shaft** — specks of dirt on the back
   wall, and this is the only way out of the room. It is a **column** now: the whole 80px lane tinted,
   a bright rail down each edge, 30px chevrons at full alpha, a lit patch of floor. (And the chevrons
   were 8px off-centre, because the offset was hand-written for a grid width — hence `upChevron`.)
3. **The dado register was a flat fill** — 170px of untextured indigo across a laid wall read as a big
   empty box hanging in the room. It is brickwork one value down.
4. **The stage printed its own name twice**, once at scale 4 in the middle of the frame and once
   stencilled on the floor. The stencil fades up exactly as the title fades out.
5. **The hatch read as a bench.** A frame all the way round the slot, 4px proud of the paving with a lit
   top rail, is a silhouette with a back and a seat. What reads as a hole: nothing above the ground line ·
   the far inside wall in near-black · the **near lip lit** · side cheeks only · and two ladder rungs
   going down out of sight, which is "you can get down there" said with no arrow at all. Plus: the prompt
   plaque at 74px landed across the hero's chest — he is standing *on* the thing being labelled, so this
   is the one plaque in the game whose clearance is measured against the player. It is at 118 now, and the
   key is a **cap** rather than a letter in the sentence ("F  DROP IN" reads as a word beginning with F).

### The HUD comes off, and that is an accessibility decision

The wall spans the full frame, the delay log's four rows hang over its right-hand column, and the
rasteriser has no HUD — the same trap the deleted archive wall paid for. But the better reason is that
**nothing down there can cost a life or a month**, so a lives plaque and a delay log would be furniture
that lies. So the plaques go.

`setVisible(false)` was the wrong lever: it sets `display: none` on the wrapper, and the `aria-live`
region lives inside it, so hiding the HUD outright would have dropped every announcement this stage
makes — for exactly the players who need them. `Hud.setBare()` hides the two stacks and keeps the
wrapper, and the stage announces three things: what the room is and how it is played, the wall coming
down, and that the shaft is drawing.

### The touch call, caught after the rasters and before the tests were finished

**One-tap auto-run had to come off in there**, and it is the biggest usability call on the feature.
Auto-run synthesises "right" every frame and it is the *default on touch* — most of this audience — so an
auto-running player would have arrived in a room that is played by moving both ways under a ball and been
pinned against the far wall with LEFT as their only control. `Game` turns it off on `onTunnelEnter` (and
gives the pad both arrows back), and restores it on the way out **from the assist controller rather than
from a flag remembered on the way in**: the pause menu is up in there like everywhere else, so a player can
change the setting while they are down a shaft. One-tap means "you never have to press forward", and this
room has no forward — the same distinction that kept the BACK button on the auto-run pad for the Compliance
badge.

### Sound: six edges, no new cues

`world/BrickBreaker.ts` counts (`serves` · `paddleHits` · `wallHits` · `breaks` · `losses` · `nudges`)
and `Game.syncBonusAudio` sounds the difference, exactly as the three hazards do. Every cue already
exists: the shaft breathes (`hush`), the mark lands on the tray like shoes on a floor (`land`), it knocks
off masonry (`stampDud` **at 0.35** — it happens several times a second and at full level it is a drum
machine, which is what screen 1's four stamps taught), a block goes with a `pickup` blip, a miss
evaporates (`steam`), the wall coming down is a `screenClear`, and the shaft taking him home is the
`badge` arpeggio, because being carried back up is ANSR doing the work. A bonus stage is not worth a byte
of the audio budget.

### Numbers

**607 tests** (48 files), +35: `world/BrickBreaker.test.ts` (15 — the room, the sequence, the mark, and
"it can always be finished"), `render/brickBreaker.test.ts` (11 — the words fit the blocks, no block-sized
flash, the shaft is a column, the hatch is a hole), `core/bonusStage.test.ts` (9 — it costs nothing, it
cannot be fallen into, it cannot win the game, it hands the plaza back). `driveToScreen` takes
`SimulationOptions` now, so a test can watch the two tunnel events.

IIFE **77.5 KB** gzip / ESM 77.0; site payload **79.8 KB** (+8.5). That is **86% of the 90 KB budget**
with ~12 KB of headroom, and it is the price of a whole extra level — no prose leaked (grepped: the
tunnel's own note is stripped by `strip-level-notes.ts` in both builds, and the only new strings in the
bundle are the ones that are *drawn*). typecheck · lint · test · build · build:site · validate:levels
green; `analyze` still reads the sum of both payloads (`docs/OPEN.md` §1).

**Not verified:** nobody has played it. The three figures that want a hand are the ball's speed, the tray's
width and whether the hatch is findable without being told — a marker that is subtle on a 1280 raster may
be invisible on a phone.

## Pass — the mark is fired out of a cannon, and the down arrow opens the hatch

**The ask** (owner, two notes on The Growth Floor, the secret stage under the Tech Park):
1. "The ball should come from one of the cannon that throws it because right now because it is coming
   from the top while dropping it's breaking some of the bricks automatically, and the first time the
   ball should come a bit late so the actual person has some time to see the screen and understand."
2. "We don't need to press the f button, instead the down arrow can do the work."

### 1. The serve was opening the wall on the room's behalf, and it was geometry, not feel

The first cut served the mark out of the tunnel mouth — the same 80px shaft the player falls down. That
mouth is at **x 640**, and the wall spans **87..1193 across and 132..322 down**: the serve therefore
started *inside the wall's own footprint*, above the middle of it, and took two or three blocks out on
the way through before the player had touched anything. The owner read that as the game breaking bricks
by itself, which is exactly what it was. Worse, it inverted the wall's own argument: the four rows are
authored to be read **bottom-up** (footprint → people → capability → run it better, the order a GCC
actually grows in), and a mark falling through the middle opened the capability and people rows first.

**The fix is two cannons on the floor, one in the lane inside each side wall, alternating.** The mark
is fired *up* and towards the middle of the room, so the first thing it can reach is the bottom course.
Numbers, and each one is pinned:

- **Placement.** The lane inside each side wall is 47px (that lane already existed, and it was already
  load-bearing twice — see the `BRICKS.W` note). A 44px carriage fits it, and it is the only floor in
  the room with no wall overhead. The cannons are **solid**, because a machine the hero walks through
  is scenery and this one is the thing serving him. **It costs him nothing**, which is the only reason
  it is allowed: the tray is clamped to `PLAY_LEFT + PADDLE.W/2` = 106, and a player stopped by the
  left carriage still centres at 110, so the tray's reach over the lane is unchanged. (It does move one
  number in a test: `bonusStage.test.ts` used to assert he ends up flat against x 1240 when he holds
  right; he now stops at the right cannon's face, 1193. The claim that test makes — that walking right
  in the plant room must not trip screen 5's win trigger at x 1040 — is untouched.)
- **Angle.** `CANNON.LEAN_MIN/MAX` = **24..38 degrees from vertical**, leaning inboard, seeded per shot.
  The floor is `PADDLE.MIN_BOUNCE_DEG` (20) with a margin, for the same reason the tray obeys it: a mark
  with no horizontal component is a closed vertical orbit and the only way out of this room is an empty
  wall. The ceiling is arithmetic: at 38 degrees the mark drifts 198px while climbing the 254px from the
  muzzle to the bottom course, so it is still under the first or second column when it arrives.
- **A tell.** `CANNON.AIM` 0.9s: the barrel lays itself at the angle it will fire on, a three-cell
  charge gauge fills on the carriage, and the mark shows in the muzzle. A gauge rather than a blinking
  lamp, because the player needs to know *when*, not just *that*. `CANNON.RECOIL` 0.3s pushes the barrel
  back down its own axis and flashes the muzzle. **The flash is cool, not warm** — the only warm thing
  in this room is the ANSR mark, and an orange flash would put a second one on the frame on the exact
  frame the first appears.
- **Measured.** A tracking player now clears the wall in **31.9s** (it was 39s), one serve, no losses,
  and the watchdog is still not needed. The determinism, angle-floor and always-clearable sweeps all
  still hold.

**The barrel is stepped cells, not `ctx.rotate`**, and it needed a second pass to read: a single run of
mid-value cells on a mid-value wall rasterised as a thin dark stick. A dark cell one size up under each
face cell fixed it — **an angled sprite needs its keyline more than a square one does**, because half of
every cell's edge is a corner rather than a side. Caught in the raster, invisible in the code.

### 2. The first mark now comes at 7.6s, not 4.8s

The wall finishes building at 4.32 (`BRICKS_AT` + 4 × `ROW_REVEAL`). 4.8 was long enough to watch it go
up and not long enough to read a word on it — and this is the one room in the game a player arrives in
having *fallen through a hole in a pavement*, holding a tray nobody offered them, in front of fifteen
phrases that are the whole point of the stage. `BEAT.SERVE_AT` is **7.6**, i.e. 3.3s of reading, and the
cannon's 0.9s of aiming lands inside the last of it so the wait ends with something to watch. **Every
later serve is unchanged** (`BALL.RESPAWN_GAP`): the room only has to be learned once.

### 3. The down arrow acts

`ArrowDown` is mapped to `shoot` alongside `KeyF`/`KeyJ`. It cost nothing: **nothing in this game
crouches**, so the down arrow had no other job, and it was already in `PREVENT_DEFAULT` (which is the
other half of not scrolling the host page with it). The hatch's prompt cap is now **↓** rather than F,
which needed a new glyph in the 5×7 font — authored under `\u2193` and not under a letter, because
`drawText` upper-cases everything it is handed and a lower-case stand-in would fold into a word. Third
character in that font that exists for one caller, after `>` and `<`.

F still fires everywhere, including the hatch, and nothing advertises it on the hatch any more. Left
alone deliberately: the title screen's legend and `canvasLabel` still name F as the act key, because F
is the act key game-wide and the down arrow is the one place the action has a *direction* in it. Whether
the legend should name both is `docs/OPEN.md` §25.

**Green:** 611 tests (48 files), typecheck, lint, build, build:site, validate:levels. IIFE **78.25 KB**
gzip (77.5 → 78.25, +0.75 for the cannons and the glyph), site payload **81.07 KB** — 87% of the 90 KB
budget. Headroom is 11.75 KB and it is still the thing to watch.

## Pass — the cannon goes on the wall and throws to the tray, and the board gets twice as quick

**The ask** (owner, one note, three parts): "Place the cannon on the side wall hanging so the user
catches it and mostly it should fall on the tray but sometimes away but still around the tray, and make
the character faster it's too slow to catch up with the ansr ball we have, and make the cannon look
better and more refined."

### 1. The serve stops being a direction and becomes a throw with a destination

The floor cannons from the previous pass fired *up and inboard* at a seeded angle: correct (the wall was
no longer opened by the room itself) but still a shot the player had to go and meet. The owner's note
turns it round — the mark should be **thrown to the player**.

- **The machines hang off the side walls at `MOUNT_Y` 356**, and that number has no freedom in it. The
  throw has to reach the tray without meeting a block, and the only band in the room where that is true
  is between the bottom course (322) and the bounce line (540). Above it the shot crosses the wall;
  below it there is no room to aim. So the machine hangs in the band and the throw passes under the
  brickwork.
- **The far machine throws.** Not an alternation: the one on the other side of the room puts the mark in
  the air for 1–2.4s, which is the time the player needs to place the tray. The near one would drop it
  190px onto somebody's head.
- **Where it lands is a decision.** `takeAim` reads the tray at the *start* of the wind-up and aims at
  its middle plus a seeded offset: `CANNON.ON_TRAY` (0.68) of throws land inside ±44 — a catch without
  moving, since tray-plus-mark is ±86 — and the rest inside ±118, which is a step. Clamped off the side
  walls, because a throw laid into a corner is one the tray cannot get under.
- **The aim is laid before the shot and the barrel *is* the aim.** The shot is planned at
  `nextServeAt - CANNON.AIM`, so what the player watches for 0.9s is the actual trajectory — the machine
  is not decorating, it is telling them where to stand.
- **The aim point is 6px INSIDE the tray, not on its top face.** A throw laid exactly on the bounce line
  arrives with its box bottom at 540 against a paddle top of 540 — a tangent, not an overlap — so it can
  pass through the tray it was aimed at. Six pixels of overlap is the whole fix.
- The cannons **left `solids`**: hung 190px over the walking line, the hero passes under them, so the
  question the floor pair raised (a machine you can walk through is scenery) disappears, and the room
  gets its full width back.
- Measured, 27 policies: clear in **33.5s min / 41.6 median / 60.8 max, and zero misses**. The throw is
  catchable, which is what the owner asked for.

### 2. The board is twice as quick

`PADDLE.SKATE_SPEED_MULT` 1.25 → **2.0**, i.e. 325 → **520 px/s**. The number it is measured against is
the mark's own horizontal pace: at the 620 cap off a 55-degree edge hit that is 508, so the board now
matches the fastest sideways the mark can ever travel. At 1.25 it could not, and the rally was a chase
the player was structurally losing. The multiplier scales `GROUND_ACCEL` too, so the answer off a
standing start moved with it. (The old comment claiming 1.35 was a ceiling was written when the serve
came out of the ceiling and the tray only had to cover the middle of the room.)

### 3. Two hours of the pass went on one clamp, and it is the finding worth keeping

Moving the throw onto the tray made the room **unclearable for a player who never moves**. A parked tray
can only return the mark up its own end, so the far columns stand: 1 to 3 blocks left after ten minutes
of holding one direction. That is not a taste question — "a room whose only exit is an empty wall must be
provably clearable" is an invariant, so the throw needed a valve.

`CANNON.RESCUE_AFTER` (5): after five marks lost **with no block down**, the machine stops throwing to
the tray and throws at the wall — the lowest block far enough across to keep the shot off the vertical,
and *the machine is chosen for the block* rather than the block for the machine (with the survivor
directly overhead, the far machine has no legal line and the shot came out vertical). It is visible
rather than hidden: the barrel swings up off the tray line onto the brickwork, which reads as the plant
getting on with it. It cannot fire in real play — 27 policies clear the wall with zero misses.

And then it still did not work, for a reason that was right in general and wrong here: the wall throw ran
through `keepAngleHonest`, which enforces **both** floors, and the `MIN_VY_FRACTION` one bent a shot laid
at 2 degrees off the horizontal up to 20 degrees. It sailed over the block. Every time, identically —
seeded, so the same miss for ever. Split into `keepOffVertical` (the sideways floor, which *every*
direction obeys because a vertical is a closed orbit) and `keepAngleHonest` (that plus the vertical
floor, which is a rule about the mark **in play**: it stops a shallow paddle return skimming the ceiling,
and a throw is not a return). With that split: idle clears in **163s**, hold-left 49s, hold-right 87s,
against ~35s for somebody playing. Skill is worth 2–4x again, and there is a test whose only job is to
stand still for five minutes and finish.

### 4. The machine, drawn: five parts and three defects fixed in the raster

Plate with four bolts · strut and gusset · yoke with a hub · barrel · magazine. Refinements, all of them
found in the image and none visible in the code:

- **`EDGE_LIT` is this machine's highlight, and it is the brightest metal in the room.** Lit like the
  ducts and the racks it hung directly over a rack's own top rail and read as one more pipe fitting.
- **A constant-width tube, not a taper.** Cells shrinking 18 → 14 along a diagonal frayed into a ragged
  wedge: a step that changes size at the same time as it moves has no edge that lines up with the step
  before it. One width, then a collar at one end and a **mouth** at the other — a lit frame round a dark
  bore — and the two ends do all the tapering the eye needs.
- **Nine cells at 4px, not four at 7.** On a shallow line the *spacing* sets how coarse the stair is, and
  a barrel that can be laid nearly flat has to survive its flattest angle.
- **The lit rail goes on whichever side of the axis is up.** Hand-picking one perpendicular lit the left
  machine on top and the right one underneath — light from two directions in one room.
- Bolts are a **lit face with a dark notch**, never a dark hole (a dark square on a mid plate is a window
  into the wall, which is the opposite of a fixing), and the loaded mark sits **inside** the bore rather
  than filling it, or the aperture stops reading as one.
- `BARREL` 46 → **56**: at 46 the whole machine read as a fitting in the corner, and it is the thing the
  player watches for two seconds before every throw.

**Green:** 612 tests (48 files), typecheck, lint, build, build:site, validate:levels. IIFE **79.07 KB**
gzip (78.25 → 79.07), site payload **81.88 KB** — 88% of the 90 KB budget, ~11 KB of headroom.

---

## Pass: the wall says where you are, the powerup is called a powerup, and the broken room can be heard

Owner, five notes in one message, and four of them are copy. Nothing structural changed: no geometry, no
physics, no level data, one new getter and one rebuilt sound. The interesting part of the pass is that
**two of the five asks were already "done" in the code** — and both were genuinely wrong anyway, for
reasons the code could not show.

### 1. The Head Office wall sign: "MARKET ENTRY: ON PAPER" → "HEAD OFFICE"

The board hanging under the lobby soffit was carrying an *argument*: on paper, this all looks fine. It
was a good line, and it was on the wrong object. A directory board in a lobby names the building — that
is the whole of what that piece of furniture does — and the verdict it was making is already made twice
on the same screen: the briefing card says "Every plan looks clean from the lobby.", and the three
labelled steps (BUSINESS CASE · BOARD APPROVAL · BUDGET) are the joke in physical form. So the sign was
the third statement of one idea, in the one place the player looks to answer a different question.

Rasterised at 1280 (`/tmp/brrender/s0.mts`, existing harness): `drawLabelPlaque` sizes itself from the
string, so 11 characters instead of 21 is simply a smaller sign, still centred at `W * 0.5`, still under
the soffit, still clear of the lit feature bay below it. No layout work needed.

**Accepted cost, written up as `docs/OPEN.md` §26:** the HUD stage plaque also says "Head Office", so
the name is now on the frame twice, which is the exact defect this build has caught three times in
rasters (COMPLIANCE over "compliance does not run in a straight line", WORKPLACE over "the workplace is
not", CONTINUE under a cap labelled Continue). The argument for leaving it: those three were all *chrome
over chrome*, two strings in one centred column. This is an object in a room, 100px up a back wall,
behind the play — and a lobby whose sign named anything else would be a lobby in someone else's
building. It is flagged rather than decided.

### 2. The Workplace brief: a line that was true one screen too early

"The team is ready. The floor is not." — the best of the six briefs as a sentence, and wrong in
position. **Hiring is stage 4 and the Workplace is stage 3.** The run has not recruited anybody when
that card is shown, so it promises a team out of nowhere, and the next card ("Talent never waits, and it
never plays fair.") then reads as a contradiction of the one before it rather than as the next problem.

It says **"The lease is signed. Nothing works yet."** Same gap — the enablement gap — named through the
*property* rather than through the people: the site is committed, signed, paid for, on the plan, and
none of it works. It names nobody, which is what makes it survive being a screen early, and it is the
language a buyer uses about this stage of a programme. Checked against the card's own constraints, all
of which are tested: 39 characters (ceiling ~50), wraps at the 26-character measure to "THE LEASE IS
SIGNED." / "NOTHING WORKS YET." — 20 and 18, well inside the 2:1 balance test — no apostrophe, and no
word longer than three characters shared with the stage label WORKPLACE above it. Rasterised with the
existing `card2.mts` harness.

The permanent rule: **read the six briefs in order as one paragraph.** They live in one object where the
others are 40 lines away, and this defect is invisible in the file and obvious in sequence.

### 3. "ANSR badge" → "powerup" on every surface a player reads

Three strings: `lifeLost.retryHint` ("Take the ANSR powerup"), `gameOver.advice` and `a11y.outOfLives`.
Nothing in `src/` was renamed — the ask was about wording, and `BadgeType`, `badgeFloat`, `badgeDrop`,
`badgePerch`, `badgeCeiling`, `badgeBox` and several hundred comments are internal vocabulary no player
can reach. That is a real inconsistency and it is written up as `docs/OPEN.md` §27 rather than pretended
away; the invariant now says which side of the line a new string is on.

One measurement, because the new word is two characters longer and the closing screen is the surface
this build has broken most often with copy: at the 26-character measure the advice still wraps to two
balanced lines — "TAKE THE ANSR POWERUP AND" (25) / "THESE MONTHS NEVER HAPPEN." (26). The word got
longer and the picture did not change.

### 4. The retry card's line, on a screen with no powerup on it

The ask was "from the intro screen of ANSR tech park remove the line take the ANSR badge". Grepping
`dist-site/` first (the rule that saved a pass three passes ago) found exactly three occurrences of that
sentence, and the only one that can appear on a *title card* is the retry hint — `Game` prints it
whenever `sim.retrying`. So the line is not authored on the Tech Park at all: it is the retry hint,
appearing on whichever stage was just lost, and the Tech Park is one of **two** screens that carry no
mark at all (Head Office is the other, both by earlier owner calls).

Fixing it as "not on screen 5" would have been a coincidence. The real rule is that **a coaching line
has to be honoured by the screen it is printed on**: with nothing to collect, "take the ANSR powerup" is
advice the room cannot obey, and it reads as a rule the player has already broken. New getter
`Simulation.screenHasPowerup` (the level's own `badge` field, so the card can never disagree with the
screen) and the host gates the hint on `retrying && screenHasPowerup`.

Deliberately **not** `badgeBox !== null`, and that distinction is the trap: `badgeBox` answers "is it
collectable on this frame", which is null on a taken mark and null while a delivery is in the air (the
Hire Under Fire drone, the Workplace's ceiling drop). A card shown *before* the stage starts needs the
level's shape, which is constant for the whole visit. One test, which also asserts the mark staying
"present" after collection.

### 5. The spark sound the game already had, and could not be heard

"Add spark sound in the workplace screen when things are not fixed." It was there: `AudioEngine`'s
`spark` cue, `Workplace.isSparking` gated on the same `restore < 0.5` the renderer draws the arc from,
a host-side timer in `Game.syncWorkplaceAudio` because the sparks are drawn off a render hash and have
no sim clock, a line in `SCREENS.md`, and a test. Everything about the wiring was right and the owner was
right too.

**The energy was in the two bands nothing reproduces.** The cue was a 120 Hz square at 0.08 gain plus
three 35ms bandpass bursts at **Q 4** centred 3000–4800 Hz. The first is below what a laptop or phone
speaker can move; the second is a needle up where those speakers are already rolling off, and 35ms of it
is barely an event. It measured as a cue and played as silence.

Rebuilt as what an arc actually is — a snap with a tail, three times:
- buzz keeps its 120 Hz body and gains its **octave** at 240 (the lowest genuinely audible thing on a
  phone), 0.14/0.10 gain;
- each crack is a **wide** burst, Q **1.1** instead of 4, falling 5200 → 900 over 70ms, gain 0.5 — width
  is what gives a burst a body instead of a whistle;
- a square tick under each one, 2000 → 700 Hz, which is the transient and is also what keeps the cue
  alive on a host with no noise source (the `AudioContextLike` noise half is optional by design).

`SPARK_INTERVAL` 1.7 → **1.5s**, so the first arc lands inside the walk from spawn (~2.5s to the mark)
rather than after a quick player has already fixed the room. It is still the longest gap of any
repeating cue in the game, and still the quietest thing on that screen relative to the `chime`:
**audible and ignorable are different axes**, and confusing them is how the cue got written this way in
the first place ("quiet on purpose" is in the original comment).

Worth stating plainly for the next session: **there is no raster equivalent for sound.** Every other
class of defect in this build was caught by looking at a picture; this one could only have been caught
by a pair of speakers, and it survived a pass whose entire subject was giving that screen a voice.

### Green

613 tests (48 files, one new), typecheck, lint, build, build:site, validate:levels. IIFE **79.09 KB**
gzip (79.07 → 79.09), site payload **81.40 KB** (81.88 → 81.40 — the deleted sign string and the shorter
brief pay for the longer word). `analyze` still reads 154 KB and still fails, for the documented reason
(`docs/OPEN.md` §1: it sums both output formats). Verified in the built bundle: no occurrence of
"MARKET ENTRY: ON PAPER" and no occurrence of "Take the ANSR badge" in `dist-site/`.

---

## Pass: the hint stops following the player, the out-of-lives screen gets a shape, the secret stage gets a name, and the mark turns

Four owner notes, in the order they arrived. Two of them were copy or composition; one was a bug that had
been shipping for several passes and had nothing to do with the code everybody would have looked at; and
one was an art change whose two halves cancelled out until a raster said so.

### 1. "Take the ANSR powerup" was on every briefing card after the first death

**The report.** By default no introduction carries the line; once the player dies, *every* later screen's
introduction carries it. Only the retry should.

**Everything that looked guilty was innocent.** The model says the line is `Simulation.retrying &&
Simulation.screenHasPowerup`. `_retry` is set in `setback()` and cleared by `loadScreen`, which runs on
every retry, every advance and every reset; there is a test (`Simulation.test.ts`) that drives to screen 1,
kills the player, asserts `retrying`, clears the stage and asserts `retrying` is false on screen 2. The
host recomputes the hint in `syncUI` every rendered frame. `Overlays.show` keys the card on
`label|brief|hint` so a changed hint always repaints, and it sets `titleCardHint.hidden = !data.hint`.
Every one of those was correct, and the defect was real.

**It was the stylesheet.** `[hidden]` is a **UA** rule — `display: none` — and it loses to any author rule
that sets `display` on the same element. `.beam-run__advice` (and `.beam-run__brief`) are
`display: flex`, being flex columns of bitmap SVG. So `el.hidden = true` set the attribute and changed
nothing: the hint was painted once, on the card of the stage that took the life, and then stayed up for
the rest of the run. Before the first death it was absent for the **wrong reason** — the element had no
content yet, not because it was hidden — which is exactly why the report reads as "by default there is no
line, but once I die…".

The fix is one rule, scoped to the widget, with `!important` because the whole job is out-ranking a
declaration further down the same file:

```
.beam-run [hidden] { display: none !important; }
```

Plus belt and braces: `show()` now **empties** `titleCardBrief` / `titleCardHint` when there is no line,
because a hidden element holding its last text is one cascade mistake away from printing it again.

**Then the fix had to be proved, and proving it moved it.** The first placement was near the top of the
stylesheet, which is right per spec — an `!important` declaration with an extra class in the selector beats
a normal one whatever the order. It was also **unprovable**: a jsdom probe reported `flex` with the rule in
place. That is not a bug in the rule, it is jsdom's cascade, which takes the **last matching rule** and
ignores specificity and `!important` entirely. Measured on the identical sheet: rule early → `flex`, rule
moved to the end → `none`. So the rule is now the **last line in the file** — correct in a browser for two
reasons and correct here for a third — and the comment says why, because it looks like a tidiness choice.

A second thing the probe taught: **every rule in this stylesheet is scoped to `.beam-run`, and the tests'
fixture is a bare `<div>`**. The real host sets that class on the widget root; `makeParent()` does not, so no
scoped rule applies in the default fixture and the first version of the guard was measuring an unstyled
document. The guard adds the class, injects the real sheet, and reads the computed `display` back — it fails
with `flex` the moment the rule is deleted, which is the check a regex over the CSS text could never be.

The retry-hint test also now walks the sequence that broke: card with no hint, card with hint, next stage's
card, hint gone and empty.

**The general form, into `docs/INVARIANTS.md`:** if you toggle visibility with the `hidden` attribute,
every class on those elements is a place `display` can be re-declared, and the existing tests will not tell
you (the old one asserted `.hidden === true` and passed throughout). The symptom of this bug class is always
"it appears where it should not, and the code that decides is provably right".

### 2. The out-of-lives screen had no design in it

**The report.** The page after three deaths is not well designed and the proportions need sorting out.

**Rasterised, the diagnosis is the win screen's from two passes ago, read from the other end.** The screen
was four centred bitmap lines on one axis — the headline, a sentence ("3 DELAYS COST 6 MONTHS") at
`clockStrong`, a two-line instruction at `advice`, and a cap — floating in the middle of an otherwise
empty 1280×720 frame with `gap` doing all the work. Two things were wrong, and neither is a spacing value:

- **the one fact that matters was not drawn as a fact.** Months lost to delays is the figure both end
  screens close on, and here it was a *sentence* set within one step of the size of everything around it.
  Headline 195px wide, cost line 570, instruction 530: no hierarchy, and the widest thing on the screen
  was the smallest type on it.
- **nothing on the screen had an edge.** Ragged centred lines have no mass, which is the exact finding
  that rebuilt the win screen's left column into a panel.

**So the fix is borrowed rather than invented**, which is the point: a caption on its own line
(`gameOver.costLabel`, "What the delays cost"), then ONE panel in the receipt row's own fill and rail
holding the months as a big orange numeral with its unit, `gameOver.fromDelays(n)` ("From 3 delays.") as
its small print, and the argument divided off under a hairline. Loudness runs numeral → headline →
argument → cap. The two end screens now report the run in the same words, the same specs
(`PX_TYPE.figure` / `unitText`) and the same shape.

Three things the raster decided:

- **The rail has to hug what it encloses.** At the old stack width of 640 (and at 560) the panel left
  ~110px of empty box either side of its widest line — a border drawn round nothing, which reads as a
  panel that has lost its contents. The widest line inside is the instruction at its 26-character
  measure, ~335px, so the column is **440**.
- **The argument moved inside the panel and dropped a size.** It was `PX_TYPE.advice` (unit 0.24), the
  last survivor of the title screen's deleted three-line hook. In the win screen's verdict slot the
  equivalent line is `body`, and a sentence a third of the way down a panel cannot also be the
  second-loudest thing on the screen. `PX_TYPE.advice` had no other caller and went with it.
- **The months are printed once.** The small print is the delay *count*, never the figure again — the same
  defect the win screen's "What cost you" heading was written to fix. `gameOver.cost(delays, months)` is
  deleted.

"These months never happen" still says *months* under a unit reading "months", and that stays: it is a
**reference** to the number directly above it, which is the one licensed way to repeat a word in a column.

Phone (390×844) checked in the same harness: 594px of content, gaps on their floors, nothing clipped.

### 3. The Growth Floor is now THE ENGINE ROOM

**The report.** The name is not going well, and the description line under it needs to be better — think
like a copywriter who conveys more in less.

Both halves were wrong for their own reason. **Growth** is the word every consultancy applies to
everything, so it named nothing and pictured nothing. **Floor** is office vocabulary bolted to a room that
is visibly plant: a services duct, cable runs, two racks of equipment with mint LEDs, brick. The name had
to be checked against the *art*, not only against the meaning, and it had never been.

**THE ENGINE ROOM** is what the picture already draws and what the fifteen phrases on the wall already
argue — the machinery under the building, where the work that keeps a place running happens, which is what
a GCC becomes once it stops being a project. Considered and dropped: *The Scale-Up Floor* (the same
register with a hyphen in it), *Day Two* (true, and not a place), *Sub-Level 1* (a place that says
nothing).

The line went from **LIVE IS WHERE THE WORK STARTS** to **LIVE IS DAY ONE, NOT THE FINISH**. The old one
put a subordinate clause in the middle and had no second half to land on; the new one is a contrast, and
the comma is doing real work. 31 characters at scale 2 is 372px, centred, well inside the room's walls.

Rasterised at 3.9s: name at scale 4 over the orange hairline over the line, and then the stencil on the
floor once the wall builds. It reads, and it now agrees with the room it is painted in.

Two structural notes:

- **The name lives in two places on purpose** — `COPY.bonus.name` for the HUD plaque, `STAGE_NAME` in
  `render/brickBreaker.ts` for the frame, because no render module imports `data/copy.ts` and none ever
  has. A rename landing on one of the two is a room that disagrees with its own label, so both are now
  exported and `brickBreaker.test.ts` asserts they are equal, measures both drawn lines against the font
  and the frame width, and applies the briefing cards' no-echo rule to the line under the name.
- **The symbols were renamed too** (`drawEngineRoom`, `drawEngineRoomProps`, `EngineRoomView`), which is
  the opposite call to the badge/powerup split — and the difference is where the word lives. "Badge" is
  300 sites of internal vocabulary no player reads; `drawGrowthFloorRoom` *is* the rejected name, in three
  files. `docs/JOURNAL.md` keeps the old name wherever it was written, because it is history.

### 4. The mark turns, and the two halves of "brighter" cancelled out

**The report.** On every page where the ANSR logo is a powerup, make it rotate and a bit brighter so it is
noticeable; in the secret screen rotate it too, on the higher side, but not so fast the logo stops being
visible.

**Rotation.** `drawAnsrBadgeMark` takes a `spin` in radians and hands it to `drawAnsrLogo` (which has
turned the mark on the plaza and the attract facade since the first pass — this is not a new capability,
it was simply never asked of the pickup). All four deliveries pass it: the rail, the drone drop
(`render/carrier.ts`), the Compliance perch and the Workplace ceiling drop. Every one of them already
receives a **phase in turns** from the host, held constant under `prefers-reduced-motion` — so the spin is
`phase × turns`, reduced motion is free, and no new branch exists anywhere. The core backing does **not**
turn with it: it is a square of whole cells, and a rotated grid of cells at 20px is anti-aliased mush.

**Rate.** `MARK_SPIN_TURNS` 1 against the hosts' own 0.3 turns/s is one revolution every 3.3s for a
pickup; `BALL_SPIN_TURNS` 4 in the secret stage is 1.2 rev/s. The ceiling is not taste: the sunburst
repeats every 11.25 degrees, so once it advances more than about a ray-pitch per frame it samples onto its
own neighbours and strobes — ~1.9 rev/s at 60Hz. Both numbers sit under it, with the faster one justified
by being *a ball somebody has just thrown across a room*. The number is written into the constant with the
ceiling beside it.

**Brightness, and the finding that cost the pass.** New tones `#ff7a45` / `#ff9570` — the brand
`#f05722` at the same hue and saturation, one step up in lightness. Rasterised against the shipped mark on
screen 1's own backdrop, four phases each, cropped and blown up 4×, **the new one was dimmer.** The
sunburst is ~32 rays, so at 40px each ray is about **one pixel** across: unrotated, the axis-aligned rays
land on whole pixels and the mark is crisp, and at any other angle every ray is spread over two columns at
partial coverage. The rotation was taking back more weight than the tone lift was adding, and both halves
were individually correct — invisible in review, obvious in a PNG. This is the `ctx.rotate` warning the
cannon barrel paid for, met from the other side: there, the answer was not to rotate; here the owner has
asked for rotation, so the answer is to pay for it.

The fix is a **second source-over fill of the same path** (`drawAnsrLogo`'s new `bold`, on only when the
mark is spinning), which takes a half-covered pixel from 0.5 to 0.75 — most of the weight back for one
extra fill and no change to the shape. Not a stroke: an outline round a 32-ray star closes the gaps
between the rays. Re-rasterised, the new mark is brighter *and* the same weight as the old.

The first lit tone was `#ffa88a`, and two things sent it back. It failed the test's own hue check (6.5
degrees off the brand mark, because it was picked by eye), and at 4× in the indigo room it read salmon.
`#ff9570` is the same lift at 72% lightness: 15.5 degrees, brighter than the `#ff8a4d` it replaces, still
unmistakably the brand orange. `badge.test.ts` now measures the **relationship** — same hue within 4
degrees, lighter on every channel than `#f05722`, red > green > blue, never `#FF5400` — rather than pinning
a literal, because "brighter" is how a pickup ends up cream. The translucent form of the lit tone (the
perch plinth, the secret stage's trail) is exported as channels and checked against the hex, since those
two had already drifted from the mark once.

### Green

616 tests (48 files; three new: the `[hidden]` guard, the stage-name coupling, the mark's spin),
typecheck, lint, build, build:site, validate:levels. IIFE **79.35 KB** gzip (79.09 → 79.35), site payload
**81.61 KB** (81.40 → 81.61) — +0.25 KB for the extra fill, the spin arithmetic and the game-over panel's
four repainted elements, against ~10.6 KB of headroom. `analyze` still reads over budget for the
documented reason (`docs/OPEN.md` §1: it sums both output formats).

Rasters, all in `/tmp/brrender`: `gameover.mts` → `z-gameover440.png`, `z-gameover-phone.png` (the rebuilt
screen at 1280 and 390); `mark.mts` → `mark-strip.png` (old vs new mark, four phases, 4×) and
`mark-frame.png`; `growth.mts` → `gf-arming.png` (the new title and line), `gf-rally.png` (the floor
stencil) and `gf-ball.png` (the spinning mark at 4×).

---

## Pass — the Godzilla is rebuilt from reference, and its ending is rebuilt with it

**Owner, one note in five parts, all of it screen 4 and all of it presentation:** "I want the godzilla to
be made better, it's not looking good right now, it's very badly shaped — I am sharing two reference images
you can see and learn from and give a better, more refined godzilla; and also the dying animation of
godzilla is also bad, and the costume opening can also be made better, and the 5 candidates that come out
can also be more refined and made better, and the fire animation can also be more refined and better."

Two reference rasters came with it: a wide 8-bit city scene with a plated beast in profile, and a small
upright sprite with a heavy tail and a cyan-lit dorsal ridge. What both of them have that the shipped
animal did not is **a silhouette with parts**: a skull you can point at, a neck narrower than both, plates
that are plainly separate objects, and legs with room between them.

Nothing in `world/` or `data/` was touched. Every change is in `src/render/dragon.ts`, which is what the
architecture doc promises for a note about how a screen *looks* — the fight's timing, the cone's geometry,
the five candidates' positions and the costume's clock are all still the hazard's, and the renderer still
only paints the snapshot it is handed.

### What the old animal actually was, measured in a PNG

`/tmp/brrender/s4.mts` rasterises this screen with the shipped level data, and the crop of the beast is the
whole diagnosis: a **featureless oval torso** with a small turtle-like head stuck on the front, four pale
flags standing off the spine with dark gaps behind them (so they read as pinned-on paper, not as plates),
a tail that merged into the legs so the stance disappeared, and a tall pale belly strip running the full
height of the front edge, which rasterised as **a sash worn by the animal**. The owner's "very badly shaped"
is precise: the shape was the defect, not the detail.

### Three attempts, and the one that worked

The first two attempts were **procedural masks written blind**: per-row spans plus an auto-shader, adjusted
by reasoning about numbers and re-rendered afterwards. Both produced something worse than what shipped — in
the second, the dorsal plates came out as detached pink blobs floating *beside* the body, because the plate
anchor was "the leftmost solid cell in this row" and for every row the tail occupies that is a tail column
fifteen cells away. The plates were correct code and nonsense as a picture.

That is two failures of the same approach, so the approach changed rather than the numbers. **The technique
this repo already documented for exactly this problem** (`docs/INVARIANTS.md`, "a big creature is composed,
not authored as one grid — UNLESS the creature is a silhouette") is: author the silhouette in a **throwaway
generator** in `/tmp`, iterate it against a PNG at 6× zoom until the shape reads, then paste the **output**
into the module as a literal. `/tmp/brrender/gz2.mts` is that generator; it prints the grid and writes
`gz2.png`, and four visual iterations went into it:

1. **Anchor each object's plates to that object.** Torso plates anchor to the *torso's own* back edge
   (`bodySpan`), never to the union silhouette's leftmost cell. This is the floating-blob fix.
2. **Stop the torso plates above the tail junction.** The tail's top edge reaches row 19 at the hips, so a
   plate hung below that protrudes *into* the tail and rasterised as a pink smear across the animal's back.
   Below the junction the spine is carried by the tail's own plates, which is where it goes anatomically.
3. **A plate needs a base and a point, and that costs three columns.** Authored one cell wide, the tail
   plates rasterised as a dotted diagonal line of **bristles** running off the tail. They are triangles now,
   three cells at the base tapering to one.
4. **The belly is an abdomen, not a front edge.** Three cells wide, rows 16–26 only, held two cells *inside*
   the front edge and stopped well short of the chin — which is what kills the sash read.

The animal that came out is **48×38 at scale 5 → 240×190** (the box is 200×190, so 20px of tail and muzzle
hang out of each side, which is allowed because the box is a water *target* and not a hitbox). 900 cells.
Deep skull with a brow shelf over an amber eye set **back** from the muzzle, teeth on both lips, short thick
neck, upright plated torso, three big dorsal plates on the back continuing as six triangles down the tail,
two legs with the room showing through, and the tail lying flat on the floor for its last third. The grid
ships as a **literal**, so nothing generated runs at load time.

### The fall is a rotation now, and rotation has a bill

The topple was a **shear**: each row offset sideways in proportion to its height, plus a squash. Cheap, and
it reads as a deck of cards sliding rather than as a body falling. It is a real **pivot** now — every cell
rotated about a point between the feet, eased, with a 16% compression and a short ground shadow plus two
outward dust kicks over the last fifth, which is the impact the fall never had.

**And the first cut of it rasterised as a speckled, half-transparent beast.** Rotating a *cell grid* spreads
the cells apart — at 45° the centres are 1.41× further apart than a cell is wide — so drawing them at their
authored size leaves the animal riddled with holes. That is this build's oldest art trap wearing a new
costume (loose cells over a lit material read as dirt), and it is the `ctx.rotate` warning the cannon barrel
paid for, met from a third side. The fix is arithmetic rather than taste: grow every cell by the rotation's
own spread, `ceil(scale × (|cos θ| + |sin θ|))`, which closes the seams exactly.

The dust and the shadow are keyed to `state.progress`, i.e. **sim time**, so they stay under reduced motion —
they are the fall's own state, not decoration on top of it.

### The costume opens like a costume

It was a **black rectangle** cut through the middle of the suit: eleven columns of `i` cells revealed as the
zip ran, which is a hole with vertical cliffs, in a shape that is otherwise all slumped curves. What replaced
it is a **side hatch at the point the five actually walk out of** (authored column 34, which lands on the
hazard's own `door`, `cx + dir × 40`): a tapered cavity whose half-width per row grows with `openness`, two
**peeled lips** displaced outwards along it — one lit, one in shade, so the fabric has two faces — with bone
studs down them, and the bright zip pull travelling down the seam as it spreads. The base suit is painted
intact underneath, so at `openness` 0 there is still not one cell of interior, which is the rule the old
implementation existed to keep: the opening has to be an *event*.

### Five people, not one person five times

They were **one 8×14 sprite in four palettes**, so the line-up was the same body repeated with recoloured
shirts, and the "cheer" was two rectangles of *shirt colour* at the shoulders — sleeves with no hands.
There are **five distinct 10×15 sprites** now (different builds, shoulder widths, hair masses and one
bare-headed), five palettes, and the celebration **alternates high and side arms** per person with a skin
cell at each wrist, so the row has a rhythm instead of a repeat. Scale 4 → 40×60, against the hero's 48×60.

### The fire

Three profile changes, all inside `fire.boxes` — the rule that what is painted is exactly what burns is
untouched, and both the axis and the half-thickness still come from `coneAxisY`/`coneHalfAt`:

- **the mid flame wanders around the axis** instead of sitting as a second straight stripe inside the shell,
  with its offset keyed to the column's own hash;
- **the core is broken**, skipping roughly one column in five away from the jaw, because a continuous cream
  line down a 500px jet is a ruler drawn through the fire;
- **a narrow lick of air** opens between two lobes every eleventh column past the near quarter, which is what
  breaks the remaining "hose" read in the silhouette.

All three are stable per column and per flicker frame, so the flame lives without crawling, and the reduced
motion branch still resolves to one fixed frame.

### Two contract tests moved, and both for the right reason

`dragon.test.ts` needed no new tests but two of its assertions were reading the old art. The jaw's "lit from
inside" check looked for the cream core and the new skull's mouth line is wider, so the hinge and tip columns
had to be re-read off the grid (38 and 47 — never guessed; a jaw that hinges in the wrong column is a head
coming apart). The confetti check counts 8×8 cells and the new cheer's hands were 7×7, which the filter
caught as confetti under reduced motion; the hands are 6×6. Both are the same lesson the fixture that kept
the old label formula taught: **a raster test pins a number off the art, so re-read it when the art moves.**

### Green

**616 tests (48 files)**, typecheck, lint, build, build:site, validate:levels — all green, no test count
change. IIFE **79.99 KB** gzip (79.35 → 79.99), site payload **82.90 KB** (81.61 → 82.90): **+0.64 KB** on
the game for a 900-cell literal grid, five candidate sprites, the pivot, the hatch and the flame's three
profile changes, against **~10 KB of headroom**. `analyze` still reads over budget for the documented reason
(`docs/OPEN.md` §1: it sums both output formats).

Rasters, all in `/tmp/brrender`: `gz2.mts` → `gz2.png` (the grid at 6×, four iterations), and `s4.mts` →
`s4-idle.png`, `s4-windup.png`, `s4-burn.png`, `s4-fall.png`, `s4-open.png`, `s4-hired.png` — the beast
against the skyline, the telegraph on its head, the cone, the pivot mid-fall, the hatch open with the first
two hires out, and the full line-up of five in the recovered daylight.
