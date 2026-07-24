# Beam Run: Market Entry — Build Handoff & Living Status

> **This file is the source of truth for build progress across chat sessions.**
> Any agent resuming this project MUST read this first, then update it after
> completing each task (tick the checklist + append a short "what changed" note).

---

## 0. Read before coding (authoritative spec on disk)

Original spec lives in the workspace root **`ANSR Game/`**
(`/Users/geeteshranjan/Downloads/ANSR Game/`). Read these — they define the
complete requirements and **win over anything summarised here**:

`01_Game_Design_Document.md`, `02_Technical_Architecture.md`, `04_Level_Design.md`,
`05_Art_and_Audio_Production.md`, `06_Frontend_UX_Accessibility.md`,
`07_Analytics_and_Lead_Handoff.md`, `08_QA_Test_Plan.md`, `09_Build_Deploy_Ops.md`,
`10_Project_Plan_and_Roadmap.md`, plus `tuning.config.ts`, `levels.json`,
`analytics-events.json`, and the ANSR SVG logos.

The game code is in the subfolder **`ANSR Game/beam-run/`** (this folder).
`beam-run/src/data/{tuning.config.ts,levels.json}` are verbatim copies of the
root files and are the single source of truth for gameplay numbers/layouts —
the engine hardcodes none. Keep BOTH folders.

The stray `ANSR Game/index.html` is a saved Microsoft login page — **not** the
game; ignore it (it gets replaced with a real demo page in Task 16).

---

## 1. Environment gotchas (these bit us — respect them)

- **Node is NOT on the system PATH.** Local Node v20.18.1 is at `~/.local/node`.
  Prefix every shell command with: `export PATH="$HOME/.local/node/bin:$PATH"`
- npm (10.8.2) works once PATH is set. Dependencies are already installed.
- The `ANSR Game` folder was read-only originally; already `chmod u+w`'d.
- The bash tool prints a **spurious `Exit Code: 1`** on nearly every command —
  ignore exit codes, rely on stdout.
- Test output sometimes doesn't stream. Run:
  `npx vitest run > /tmp/vitest.out 2>&1` then read `/tmp/vitest.out`.
- Work inside `beam-run/` for all npm scripts.

### Verify after every task (all must be green)
```
export PATH="$HOME/.local/node/bin:$PATH"
npm run typecheck && npm run lint && npm run test && npm run build && npm run validate:levels
```
Baseline at last handoff: **87 tests passing** (16 files); build ~**18.7 KB gzip**
ESM. Budgets: JS ≤ 90 KB, total ≤ 250 KB gzipped.

---

## 2. Task checklist (update this as you go)

- [x] 1. Scaffold Vite+TS (doc-02 structure), ESLint/Prettier, Vitest, scripts, tokens, copy.ts, data import
- [x] 2. Fixed-timestep Loop + StateMachine + Renderer (1280×720 HiDPI, teal letterbox) + keyboard Input + debug overlay
- [x] 3. Swept AABB Physics + Player (walk, var-jump, coyote, buffer, i-frames) + Screen loader; `Game.simulate()`
- [x] 4. Real-DOM HUD + overlays + transitions + Growth Points persistence + lives/death/respawn/game-over
- [x] 5. Quicksand + PLACE_TILE permanent-bridge badge → Screen 1 completable
- [x] 6. Fire (telegraph/active/lanes/phases) + Fire Shield badge → Screen 2
- [x] 7. Swaying Plants (per-plant phase) + Pass-through badge → Screen 3
- [x] 8. Spikes (telegraph→falling→resting→despawning) + global Freeze badge → Screen 4
- [x] 9. Tech Park finale + win + Company Valuation count-up + **physics-aware** blocking CI level-validator
- [x] 10. Art pass: Beam anims+trail, procedural hazard visuals+telegraph glows, glyphs, parallax backdrops, feel FX, reduced-motion
- [x] 11. Tech Park hero finale scene + title-card/overlay polish + Moderat WOFF2 subset + arcade valuation readout
- [x] 12. Audio: Web Audio buses (music/sfx), all cues, mute+ducking, autoplay-safe, OGG+MP3
- [x] 13. Touch controls + responsive letterbox + assist menu + full keyboard/screen-reader a11y
- [x] 14. Consent-gated Analytics adapter + full event taxonomy + Navigator CTA deep link + Save (sessionStorage)
- [x] 15. React `<BeamRun/>` + IIFE `window.BeamRun.mount()` + lazy mount + fallback card + error boundary + kill switch + budget gate
- [x] 16. Harden: cross-browser/perf, object pooling, memory stability, final a11y+brand, replace stray index.html, docs

---

## 3. Locked decisions & defaults (keep enforcing)

- Vite + TypeScript; modular engine per doc 02 (`core/ world/ world/Hazards/ data/ ui/ react/`);
  thin React `<BeamRun/>` **and** IIFE `window.BeamRun.mount()`; Vitest; `validate:levels`; `analyze` budget gate.
- Palette from `tuning.config.ts` (Deep Teal `#00242E`, Light Teal `#005465`, Orange `#FF5400`,
  Light Grey `#E6E6E6`, White `#FFFFFF`). **Orange reserved for the "value" accent** (badges, active power, CTA, fire).
- Determinism: fixed 1/60s + accumulator, interpolated render, seeded RNG (no `Math.random()` in `step()`); `Game.simulate()` headless.
- Hard constraints: privacy-first (no PII, no gate to play, consent-gated analytics that no-ops without consent),
  WCAG 2.2 AA, ≤ ~250 KB gzipped lazy bundle, never on host critical path, kill switch, config-only tunability.
- Hazards distinguishable by **shape + motion, not colour alone**. All juice respects `prefers-reduced-motion`.
- Defaults: Navigator CTA `/gcc-opportunity-navigator` with doc-07 UTM/outcome payload; GA4-style analytics adapter + debug sink;
  Moderat subset with system-sans fallback; short non-harsh OGG+MP3 audio (≤ ~80 KB), fully playable muted.
- **`world/*` and `Simulation` stay headless** — never import Renderer/DOM.

---

## 4. Architecture map (what exists — reuse, don't duplicate)

**Engine (`src/core/`)**
- `Loop.ts` — `advanceAccumulator()` (pure) + `Loop` (fixed 1/60, MAX_FRAME_DT clamp, timeScale, injectable now/raf/caf, fps/lastSteps).
- `StateMachine.ts` — generic `StateMachine<S>{state,can,transitionTo,force,onChange}` (`force` bypasses allow-list).
- `gameStates.ts` — `GameState` + `GAME_TRANSITIONS` (BOOT→START→TITLE_CARD→PLAYING; PLAYING→[TITLE_CARD,DEATH,WIN]; DEATH→[PLAYING,GAMEOVER]; GAMEOVER/WIN→START).
- `Renderer.ts` — `computeViewport()` (pure contain-fit) + `Renderer` (HiDPI, teal letterbox, internal-space transform + clip to 1280×720, `begin(shakeX,shakeY)/end/toDeviceSpace`).
- `Input.ts` — `Input` + `InputState{left,right,jumpPressed(edge),jumpHeld,pausePressed,mutePressed,anyPressed}`; KEY_MAP arrows/WASD/Space/Esc/P/M; `setVirtual()` (touch), `isFormControl` guard; `NEUTRAL_INPUT`/`makeInput()` for headless.
- `DebugOverlay.ts` — dev-only readout (backtick toggles).
- `Simulation.ts` — **authoritative headless sim**. Owns sm + Player + Screen + lives(3) + points + `powerups` + `hazard`. `buildHazard()` switch on `screen.data.hazard` (quicksand/fire/plants done; **spikes TODO**). `updatePlaying`: solids = screen.solids + `powerups.extraSolids()` + `hazard.solids()`; speedMult from hazard; `player.update`; `tryCollectBadge`; `hazard.update(dt,player,ctx{freeze,extraTelegraph})` → `kill(cause)` unless `powerups.protectsFrom(cause)`; `powerups.update`. Getters: state/screen/player/lives/points/screenId/screenLabel/activeHazard/activePower. `requestStart/requestRestart/reset/kill`. Events: onStateChange/onScreenEnter/onScreenClear/onDeath/onPointCollected/onBadgeCollected. `AssistState{slowMode,extraTime,invincible,largerControls}`.
- `Game.ts` — DOM/render host. Builds stage(canvas+ui), `injectStyles`, owns Loop/Renderer/Input/Hud/Overlays/DebugOverlay. **hud+overlays created BEFORE sim** (sim ctor fires START→syncUI); `wired` guard. Host-level `paused` (Esc/P). `syncUI` maps state/paused→overlay+HUD. `handleCta→buildCtaPayload{utm_source:beam_run,utm_medium:web_game,utm_campaign:market_entry,br_outcome,br_points}`. Canvas draws world + death fade only. `drawHazards` routes quicksand/fire/plants (+spikes TODO). Static `Game.simulate(script,opts)→Simulation`.
- `index.ts` — `mountBeamRun(target,options)→{destroy}`; exports Game/GameOptions/VERSION. `main.ts` — dev bootstrap.

**World (`src/world/`, headless)**
- `Physics.ts` — `AABB`, `aabbOverlap`, `isOnGround`, `moveAndCollide` (≤8px substeps, no tunneling, axis-separated).
- `Player.ts` — walk/air accel+friction, semi-implicit gravity clamp, coyote+buffer, single jump-cut, spawn i-frames. Apex ~140px.
- `Screen.ts` — grid→px; skips `noncollide` solids; `PointPickup`.
- `types.ts` — `DeathCause`, `HazardContext{freeze,extraTelegraph}`, `Hazard` interface `{solids();speedMultAt();update();reset()}`.
- `Powerups.ts` — badge system: PLACE_TILE→permanent `placedTile`; FIRE_SHIELD/PASS_THROUGH/FREEZE timed; `protectsFrom(cause)`; `extraSolids()`; `hudModel()`.
- `Hazards/Quicksand.ts`, `Hazards/Fire.ts`, `Hazards/Plants.ts` done. **`Hazards/Spikes.ts` = next.** Fire is the closest pattern for a time-windowed hazard.

**UI (`src/ui/`, DOM)**
- `styles.ts` (scoped CSS, `injectStyles`), `Hud.ts` (lives/points/power + aria-live), `Overlays.ts` (start/titlecard/pause/gameover/win; every overlay routes to Navigator = no dead ends).

**Data (`src/data/`)** — `tuning.config.ts` + `levels.json` (source of truth), `tokens.ts`, `copy.ts` (incl `COPY.powers` + `COPY.capabilities`), `levels.ts` (typed loader).

**Scripts** — `validate-levels.ts` (STRUCTURAL only — **upgrade to physics-aware in Task 9**); `check-budget.mjs` (gzip gate; extend for assets in Task 15).

**Test helpers** (in screen1/2/3 tests): `driveToScreen(target)` (teleport `player.box.x=exitX` through screens) and `expireInvuln(sim)`. For time-windowed hazards, read the hazard's own state getter right after `update()` (float-consistent) instead of recomputing `t=i*DT`.

---

## 5. NEXT — Task 8: Spikes + global Freeze → Screen 4

Screen 4 data (`levels.json`): badge FREEZE at gx4/gy13; spikeColumns cols 7/11/16/20/25 phaseIndex 0/2/1/3/0; platform cols13-14 gy13. `HAZARDS.SPIKES = {INTERVAL 2.5, TELEGRAPH 0.5, FALL_SPEED 900, REST_TIME 3.0, DESPAWN_FADE 0.3}`.

- `src/world/Hazards/Spikes.ts` (implements `Hazard`, headless). Each column = mini state machine
  telegraph(0.5s) → falling(FALL_SPEED to ground top y=600, spike ~40×40 rests y560–600) → resting(3.0s) →
  despawning(0.3s fade), cycling every INTERVAL with per-column phase from phaseIndex (e.g. `phaseIndex*(INTERVAL/4)`).
  **Lethal in falling + resting ONLY** (never telegraph/despawning). Spikes are hazards, NOT solids (player jumps over/around).
  Honor `ctx.freeze`: when frozen, do NOT advance time/positions and return `null` (Freeze pauses ALL spikes). `reset()`. `spikeStates()` for rendering.
- Wire `Simulation.buildHazard`: `case 'spikes' → new Spikes(d.spikeColumns ?? [])`. Freeze immunity already via `powerups.protectsFrom('spike')`; also pause motion on `ctx.freeze`.
- `Game.drawHazards`: route `'spikes' → drawSpikes` (light-grey/steel triangles; telegraph marker; falling; resting; fade; distinct silhouette+motion, colour-blind safe).
- Tests: `src/world/Hazards/Spikes.test.ts` (lethal fall+rest not despawn/telegraph — read `spikeStates()` after `update()`; cycles correctly; `ctx.freeze` pauses all + no kill). `src/core/screen4.test.ts` (`driveToScreen(4)`+`expireInvuln`: collect FREEZE → `isFreeze`, `activePower.duration` 4; frozen → no kill & no advance; without freeze → DEATH in fall/rest).

Then run the verify block, report the demoable result, and continue to Task 9.

---

## 6. Change log (append one line per completed task)

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
