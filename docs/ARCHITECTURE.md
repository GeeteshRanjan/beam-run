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
  PLAYING→WIN, plus PLAYING→**SCREEN_CLEAR**→TITLE_CARD (next stage) and PLAYING→**LIFE_LOST**→TITLE_CARD
  (same stage) | START (out of lives)).
  `LIFE_LOST` cannot reach PLAYING directly — every retry goes via the stage's title card.
  **Every transition is TWO waiting cards** (owner call): `SCREEN_CLEAR` congratulates the stage just
  cleared and `TITLE_CARD` briefs the next one. `PLAYING` can no longer reach `TITLE_CARD` directly, and
  the next screen is loaded by the press that *leaves* `SCREEN_CLEAR` — so `Simulation.clearedScreenId`,
  not `screenId`, is what the congratulations card is drawn from (`docs/INVARIANTS.md`).
  **`TITLE_CARD` is the briefing between two screens and it waits for a press** — neither card times out
  (owner call). `Simulation.requestAdvance()` is the only way out of all three waiting states and is
  state-aware (`SCREEN_CLEAR` → load + brief · `LIFE_LOST` → the same stage · `TITLE_CARD` → play), called
  by both `step()` (a mapped key) and each card's own button; `titleCardReady` / `clearCardReady` /
  `deathCardReady` report the 0.4s grace each needs, `titleCardProgress` is presentation only. Every
  headless driver therefore has to press **twice per boundary**: see `driveInput`/`stepToPlaying` in
  `src/test/helpers.ts`.
  With lives left `LIFE_LOST` paints nothing over the frame for `LIVES.LOST_HOLD` — the impact beat —
  and then, on the four stages that carry a powerup, `deathCardUp` turns the per-stage **death card** on
  and the sim stops advancing by itself. The two screens with no powerup keep the old behaviour.
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
  Screen audio lives here and nowhere else: `syncStampAudio()`, `syncWorkplaceAudio(dt)` and
  `syncDragonAudio()` run once per rendered frame and diff the hazards' monotonic counters and phase
  edges into cues, so `world/*` never imports the AudioEngine. `SPARK_INTERVAL` is here rather than in
  `tuning.config.ts` because the sparks it paces have no simulation state at all.
- `Effects.ts` — deterministic mulberry32 RNG, pooled particles (140) + trail ring buffer (14),
  shake / hit-stop / flash; one `reducedMotion` switch disables all of it.
- `delayFlight.ts` — **pure**: (place of death, log anchor, progress) → position + alpha for the
  `+2 MONTHS` label that flies from the body into the delay log. Holds 30% of the flight before it
  travels, arcs rather than sliding, and holds-and-fades without moving under `prefers-reduced-motion`.
- `AssistController.ts`, `DebugOverlay.ts`, `finaleScene.ts` (pure finale geometry, snapshot-tested).
- **The secret stage lives in `Simulation` as a field, not as a state.** `_bonus: BrickBreaker | null`
  plus `enterTunnel()` / `leaveTunnel()` / `canEnterTunnel` / `tunnelSpan` / `inBonus`, and two events
  (`onTunnelEnter` / `onTunnelExit`) that are **not** state changes — the run stays `PLAYING` on screen
  5 throughout. While it is non-null `updatePlaying` hands it the entire step and **returns before every
  one of that screen's own endings**, which is load-bearing: the Tech Park's `winTrigger` is inside the
  bonus room's play area (`docs/INVARIANTS.md`). `loadScreen` clears it.

**World (`src/world/`, headless)**
- **`BrickBreaker.ts`** — the whole of THE ENGINE ROOM, the secret stage under the Tech Park: the room's
  solids, the opening sequence, the tray on its skateboard, the **two wall-hung cannons** that throw the
  mark (`takeAim` picks the far one and lays it on a line to the tray; `aimAtWall` is the valve that keeps
  the room clearable; `cannonStates` is their whole view — a unit vector, a charge and a recoil, so the
  renderer owns no clock and no geometry of its own), the mark itself (a breakout ball — constant speed,
  pure reflection), the 24-block wall and the draught that takes the player home. It is
  **not** a `Hazard`, because a hazard is a thing that can cost a life and this can cost nothing; it is
  handed the `Player` because two of the things that happen to him belong to the room (the skateboard's
  pace, and being lifted up a shaft). `keepOffVertical` / `keepAngleHonest` are the only places the mark's
  direction may be clamped — read both comments before touching either, they are a soft lock and they are
  deliberately *not* the same rule (a throw obeys the first and not the second). Counters (`serves`/`paddleHits`/
  `wallHits`/`breaks`/`losses`/`nudges`) are how the host sounds it, the same arrangement the hazards use.
- `Physics.ts` — `AABB`, `aabbOverlap`, `isOnGround`, `moveAndCollide` (≤8px substeps, axis-separated).
- `Player.ts` — walk/air accel + friction, gravity clamp, coyote + buffer, jump-cut, i-frames.
  `update(dt, input, solids, speedMult, jumpMult)` — accel is scaled by `speedMult` too, so a
  dragging hazard costs traction, not just top speed. No hazard uses either multiplier today.
- `Screen.ts` (grid→px, skips `noncollide`; no collectibles any more), `Powerups.ts` (timer-free;
  permanent help; badges carry no geometry), `badgeDrop.ts` (**pure** — the whole air-drop as a function of (spec, sim time): drone, parcel, the
  rest position on the brick at `restGy`, and the pickup box, so nothing about the delivery is derived
  twice), `badgeCeiling.ts` (**pure** — the *fourth* delivery model, and the only one tied to its own screen's
  picture: the Workplace's mark hanging in a ceiling spotlight, falling straight down that fitting's axis
  onto the floating cabinet under it, resting for a few seconds and expiring. `isCeilingDrop`/
  `ceilingStateAt`/`ceilingBoxAt`/`ceilingRestBox`/`ceilingLandsAt`/`ceilingCycleLength`. Four beats —
  `held` (visible and **untakeable**, which is the mechanic) · `falling` · `live` · `gone` — read by the
  sim, the renderer and the validator, so the one rectangle has one author),
  `badgePerch.ts` (**pure** — the third delivery model and the simplest: the Compliance mark
  **standing on the top course of a brick wall**, `isPerched`/`perchBox`/`perchCenter`, no clock and
  no expiry, read by the sim, the renderer and the validator so the one rectangle has one author),
  `badgeFloat.ts` (**pure**
  `badgeCenter`/`badgeBoxAt`/`badgeLowestBox` — the one source of the badge's position, read by the
  sim *and* the renderer with the same clock; **`-sin`, so the mark starts mid-rail, rises, then
  falls**), `types.ts`
  (`Hazard {solids, speedMultAt, shieldsPlayer?, update, reset}`,
  `HazardContext {assisted, extraTelegraph}`).
- `Hazards/` — `Stamps.ts` (screen 1's slamming DENIED stamps; replaced `Quicksand.ts`),
  **`ComplianceMaze.ts`** (screen 2's wandering monsters, the clearance lift, the clearance hoist and
  the weather dial; replaced
  `Gates.ts`, which replaced `Plants.ts`), **`Workplace.ts`** (screen 3's pacing taped figure, the
  **bandages he throws**, the cutter's pulses, and the `restore` dial; replaced `Spikes.ts`, deleted with
  Local Expertise. It is the **only hazard handed the screen's static solids**, because a thrown bandage
  has to be stopped by the partition wall and `hasLineOfFire` has to stop him winding up at a player
  behind it — that wall is where the badge lands, so it has to be cover),
  **`Dragon.ts`** (screen 4's grounded Godzilla: roar beat, the patch of floor it holds, **one
  growing diverging cone of fire** with a pinned taunt, the water cannon, the glasses, and the ending —
  the topple, the **costume that unzips and then vanishes** (`costumeState()`), the five who **walk out
  of it one at a time** (`CandidateState` carries a facing and a walk, not a fall), and **`relief`**, the
  0..1 sim-time dial the backdrop reads for "the environment comes good"; replaced `Fire.ts`). It also
  exports `MOUTH_X_FRACTION`/`MOUTH_Y_FRACTION` — the jaw is the one piece of anatomy the sim and the
  renderer both need, so it has one source, and both are read off the drawn grid — and **`coneBoxes()`,
  the single function that says what burns *and* what is painted**. Its whole ending is a function of one
  clock (seconds since the beast went down), so nothing about it is remembered.
  Each answers `assisted` in its own way; `Stamps`,
  `ComplianceMaze` and `Dragon` set `shieldsPlayer`, which is what licenses the bubble on the player.
  `ComplianceMaze` is also the only hazard that returns **solids** — the clearance **lift** (down)
  and the clearance **hoist** (up, which replaced the long brown platform at gy 8) — because they are
  the only moving geometry in the game and one object must own their positions. Both are one `Plate`
  with the direction taken from data (`toGy` vs `gy`), and the rising one is the single place in the
  game where the world moves the player: it offsets a rider's box by its own delta. It also owns
  `skyClear`, the 0..1 weather dial that is what the badge looks like on that screen instead of a halo
  (`shieldsPlayer` is deliberately absent there), and it reads a monster's surface off the plate when
  the monster is authored `hoist: true`.

**Render (`src/render/`, canvas)** — `PixelArt.ts` (crisp fillRect core; `drawBricks` takes optional
`faces` — per-brick tones — and `bevel`, both opt-in, used by screen 1 only), `PixelText.ts` (5×7 font,
`FONT` exported), `sprites.ts` (hero incl. the `squash` pose, `drawAnsrBubble`),
`sprites.ts` also owns `BubbleTint` (`BUBBLE_ORANGE` / `BUBBLE_TEAL` — colour **plus** an alpha
`boost` and a radius `spread`, because a colour swap is not a brightness swap),
`badge.ts` (the pickups — four delivery treatments now, incl. **`drawBadgeCeilingDrop`**, the mark on
cables under a spotlight's lens, its fall with a tightening contact shadow, and the resting perch plus a
four-pip countdown that blinks out; the lens it hangs from is the *room's* number, passed in, never
`source.y`: the two are equal in `held` and cables between them had zero length — the pickup rasterised
floating with nothing above it. Also: the **real ANSR mark** via `ansrLogo.ts`, sized to the hitbox, on a
dark cell core, plus levitation shaft + flare + ground chevron — pure, so it rasterises alone;
`Game.drawBadge` supplies only the band and a phase — plus **`drawBadgePerch`**, the same mark
standing still on a wall with a contact shadow, a lit plinth and four flare cells, and none of the
rail's shaft, brackets or ground chevron),
`stamps.ts` (screen 1's hazard — pure, no wall clock, so it rasterises alone. **Two words per stamp**: the
approval it refuses on the pale index plate, from `StampState.label` (authored in `levels.json`, carried
through `Hazards/Stamps.ts` so the picture has one source), and **DENIED on the rubber die** in the inverse
value. `STAMP_LABEL_INNER` is exported — the plate is the full 22 authored cells between the keylines, 88px,
because 7 characters at scale 2 is 82px and the old 20-cell plate was 80),
`maze.ts` (screen 2: the **7×13 grid at scale 5 = 35×65**, i.e. the *whole* creature that is on
`origin/main` — slate cabinet, a gap, and the approval head floating above it — read through two mood
palettes; the striped boom arm painted **behind** the head, 7 cells so it fits the box at rest;
the gather pad; **both plates through one `drawPlate`** — the lift's chevrons stepping down below it
and the hoist's stepping up above it, plus carriage shoes under each end and a mark per 80px of plate;
and **`drawWeatherWash`**, the full-frame veil-and-wash half of that screen's weather, painted over the
masonry the backdrop cannot reach and under the cast; pure, rasterises alone),
**`dragon.ts`** (screen 4: the Godzilla as **one 80×63 grid at scale 3** — the hero's own cell; see
`docs/INVARIANTS.md` for why that breaks the composed-creature rule on purpose, and why shrinking the cell
three times over is what "make it smaller / more refined" always meant — plus the opening **jaw** drawn on
top in *cell* coordinates so it mirrors with the grid (a wedge from `JAW_ROW`, its own teeth at the grid's
pitch, and a mandible under them); the cone
of fire, painted **per column from `coneBoxes`' own arithmetic** rather than from the boxes themselves,
with its cream floor telegraph and pinned taunt plaque; the floating brick the badge lands on; the
**topple** (`drawTopplingBeast`, a per-row shear) and the **fallen costume** it becomes (a second grid,
87×22 at the same scale 3, whose zip is painted only as far as it has been opened); the cannon (32×17, a flared bell) and its
jets (a tapering line of cells, not five squares); steam; the five HIRED candidates walking out; and
**`drawBurningHero`**, the game's fourth death pose. Pure, rasterises alone),
`workplace.ts` (screen 3 — also **`drawBandages`** (the thrown roll as a stepped *disc* with a pale core
and spokes that step round with distance), **`drawOverheadCabinet`** (the badge's landing pad, a
`pedestal` solid drawn as wall-mounted furniture) and `spotLight` (the four **flared cans** that replaced
the recessed strips, glowing up with `restore`); plus **one 20×26 figure grid read through two palettes** — the wrap and the
colleague — with the wound-cloth seams derived from that grid, the tape bands, the cutter, its pulses,
the barricade/cone/sign/post/ladder props, `drawTangled`, the enlarged terminal, **and the whole
damage-and-light layer**: the missing ceiling tiles, the room somebody walked out of, the gloom, the
fittings with their floor pools and lit edges, and the restored payoff. It draws all of that **over**
the room `scenery.ts` paints, and reads that room's geometry from the constants that module exports —
`CEILING`, `WORK_PODS`, `POD_SCREEN`, `CABINETS`, `WINDOW`. Pure, rasterises alone; guarded by
`workplace.test.ts`),
**`brickBreaker.ts`** (the secret stage, and the only screen in the game with a palette of its own —
indigo, so the four block hues separate from each other and from the ANSR mark. Two entry points because
the host draws the hero between them: `drawEngineRoom` (shell, services, racks, the shaft as a lit
column, **the two wall-hung cannons** — plate, strut, yoke, magazine and a *stepped* barrel of one width
with a collar and a mouth, never `ctx.rotate` — the wall of blocks with their labels in ink, the titles, the
floor stencil) and
`drawEngineRoomProps` (the skateboard, the arms, the tray, the mark and its trail, the miss). Plus
**`drawTunnelHatch`**, the other half of the feature: the mouth in the Tech Park's pavement, quiet until
somebody stands on it, and then a key cap and a prompt. Pure, rasterises alone, guarded by
`brickBreaker.test.ts`),
`scenery.ts` (per-level materials, skies, signage — **and screen 2's weather**: `drawSkyBand` +
`mixHex` interpolate every sky stop, `drawCloudBank` contracts an overcast lid into lit cumulus,
`drawRain` and `drawSunBreak` come and go, all driven by one `weather` number the host passes in, so
this module still knows nothing about hazards or badges. Cloud and sun are built from `WEATHER_CELL`
(4px) plus a silhouette — a height per column from authored lobes, and a real pixel circle in three
bands — and both are exported for `scenery.test.ts`, which is the only test this module has — **and the two interiors**: `drawLobbyInterior`
for Head Office, `docs/SCREENS.md` §4.13, and `drawOfficeInterior` for the Workplace, which paints that
room **as the fix leaves it** and exports the geometry the damage layer draws against — now off the teal
axis (`WALL` warm plaster, `FURN` warm furniture, a **cool** ceiling, cool daylight in the glazing), with
two work pods instead of three and the services duct **cut** around each spotlight. Screen 1's backdrop also
owns **`drawPermitFile`**, the grey ruled folder hanging under the clock — back by owner call, in the one
gap in that sky no stamp parks in; both props' x is load-bearing, see `docs/SCREENS.md` §4.14).
**Screen 4 has a second dial now**: `drawSceneBackground` takes `relief` alongside `weather` (a separate
parameter, not a second meaning for one number), which turns an ember night into a bright morning — the
same sun and cloud bank screen 2 uses, the skyline's lit windows going *out*, the heat haze off — and
`drawMarketRow` / `drawHiringQueue` are that screen's middle distance (four low blocks, a water tower,
canopies that only trade in daylight, and the queue behind a sagging rope), all of it kept **left of
x=760** so the beast keeps its silhouette. **`drawReliefWash`** is the full-frame veil-and-wash half of
it, the exact counterpart of `drawWeatherWash`),
`titleScene.ts` (attract screen),
`finale.ts` (screen 5 painting), `ansrLogo.ts` (cached `Path2D` of the real brand mark;
resolves to null without `Path2D`, draw is a no-op).

**UI (`src/ui/`, DOM)** — `styles.ts` (scoped CSS in a TS template literal, minified by a Vite plugin),
`Overlays.ts` carries **eight** surfaces, three of which are the run's punctuation and are built from the
same parts: `clearcard` (you cleared THAT stage) · `titlecard` (here is THIS one) · `deathcard` (what just
happened, and the powerup that answers it). `titlecard` is a **briefing**, not a caption: the level number
as an eyebrow (`COPY.titleCard.tag`) · the stage name · one line about the stage
(`COPY.titleCard.brief[screenId]`, at a 26-char measure) · **the control legend on two of the six cards**
(`fillLegend`, driven by `LEGEND_ON_SCREEN` in `Game.ts`) · a primary **Continue** cap wired to
`onAdvance`, and **nothing under it** (two keyboard-prompt lines were tried and cut — see
`docs/INVARIANTS.md`). `role="dialog"` and it takes focus like every other overlay —
the two `titlecard` special cases (`role="status"`, "transient → skip focus") are deleted. Its variable
lines are repainted only when one of them changes, because the host calls `show()` every frame — and the
legend row is **emptied**, not just hidden, when a card teaches nothing (`display: none` does not take text
out of `textContent`). `clearcard` and `deathcard` each repaint behind their own key; `deathcard` is an
`alertdialog`, like `gameover`. The old `retryHint` line and its element are **deleted**: the per-stage
death card says the same thing better.
`Hud.ts` (two absolutely-positioned flex **columns**: left = stage · engaged capability,
right = **lives · delay log**. There is **no TIME TO MARKET plaque** — owner call, §4; the months live
on the receipt. `pixelArtWidthPx` is the numeric twin of the CSS sizing formula, taking cells so it
answers for hand-built art too), `Overlays.ts` (start / clearcard / titlecard / deathcard / pause /
**gameover** / win / summary — `columns()` splits the two *receipt* screens at ≥900px; `gameover` is
deliberately one centred column. On `win` the left column is the run's cost — the **months lost to
delays** figure that `startMonthsCountUp`/`advanceMonths` drive, the verdict line, and the itemised
delays, which is why `buildReceipt` takes an optional `delaysHost`: the breakdown belongs to the figure
it adds up to, while the mid-run summary keeps it inside the receipt. `buildBars` and the two `__ref`
lines are **deleted** with the two published averages — `docs/INVARIANTS.md`), `LivesPips.ts` (the lives readout, **hearts**: solid = held, the same
silhouette hollowed out = spent, so shape carries it and the plaque cannot change width),
`PixelType.ts` (bitmap type in the DOM as inline SVG:
`setPixelText`, `setPixelButtonLabel`, `wrapPixelLabel`, `PX_TYPE` specs), `BrandMark.ts` +
`ansrMark.ts` (generated brand path), `AssistMenu.ts`, `NotFoundPage.ts`
(build-time only — its copy lives in `data/notFoundCopy.ts`, apart from `COPY`, so the 404 page's
strings do not ship inside the game bundle).

`TouchControls.ts` builds **three** clusters: the move pad bottom-left, the act cluster bottom-right
(jump largest and lowest-right, the armed tool lifted onto a diagonal beside it) and **pause** in the top
band. Only the pads are `aria-hidden` — pause duplicates no key on a phone, so it keeps a real label — and
pause raises the same `pause` **edge** the Escape key does rather than touching the Game's flag, so one
guard decides. `touchGeometry.ts` is its numbers: every portrait size is a `clamp(min, N × --beam-run-u,
max)` spec, `styles.ts` generates the CSS from it and `touchAndAssist.test.ts` sums the row — four targets
across a 390px frame do not fit at hand-picked pixel sizes, which is why the arithmetic is a module and not
four literals in a stylesheet (`docs/INVARIANTS.md`, **Layout**). `styles.ts` also exports
`stageClassName(isTouch)`: the stage stops being 16:9 and grows a control band **only on a touch device**,
never on `@media (orientation: portrait)`, which used to give every narrow desktop window the phone box.

**Other** — `audio/AudioEngine.ts` (Web Audio buses, 23 synthesised cues, 0 audio bytes shipped;
two synthesis primitives — `tone()` for anything with a pitch and `noise()`, a looped white-noise buffer
through a frequency-ramped biquad, for anything without one. The noise half of `AudioContextLike` is
**optional**, so a host without it still gets every cue's tonal layer. `playSfx(cue, level)` scales a
whole cue, which is how screen 1's four stamps stay a mechanism instead of a drum machine),
`analytics/{Analytics,navigator,Save}.ts` (consent-gated), `embed/{mount,FallbackCard}.ts`
(kill switch, lazy IntersectionObserver boot, error boundary, React factory),
`data/{tuning.config.ts,levels.json,tokens.ts,copy.ts,levels.ts}`.

**Scripts** — `validate-levels.ts` (three layers: structural · physics-aware BFS over the reachable
state space using the real Player, with badge reachability proved against `badgeLowestBox` ·
meaning-layer, i.e. every screen *with an obstacle* has a badge, it precedes every obstacle,
obstacles exist beyond it, capabilities unique, months sum to the benchmark — the rule that checked the
four capabilities' `monthsSaved` against the baseline gap went with that field) · `check-budget.mjs` + `budget.mjs` ·
`css-minify.mjs` ·
`build-ansr-mark.mjs` (regenerates the logo path from the SVG) · `build-404.ts` ·
`not-found-plugin.ts` (serves the real 404 page in dev/preview) ·
**`strip-level-notes.ts`** (Vite `pre` plugin: drops `levels.json`'s human-only fields from the
bundle — see `docs/INVARIANTS.md`. It is wired into **both** `vite.config.ts` and `vite.config.site.ts`; it was missing
from the site one for many passes, which is the build that gets deployed).
