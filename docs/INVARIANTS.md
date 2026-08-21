# Invariants & traps — the expensive lessons

> **Read this before editing anything.** Every entry below is a defect that shipped
> once, or a dead end that was paid for once, written down so it is not paid for
> twice. It was §6 of `HANDOFF.md` until that file passed twice its size guide; the
> content is unchanged and it is still the most valuable thing in this repo's docs.
>
> **This is the one document that is meant to grow.** When a pass uncovers a
> permanent rule or trap, append it here (in the section it belongs to) as part of
> that pass — not into `HANDOFF.md`, and not left buried in `docs/JOURNAL.md`.
>
> `HANDOFF.md` is the *router* and current state (status, environment, defaults, model §4.1–§4.8),
> with the detail in `docs/SCREENS.md` (per-screen model), `docs/ARCHITECTURE.md` (module map) and
> `docs/OPEN.md` (owner decisions). `docs/JOURNAL.md` is *history*, append-only.
> This file is *rules*.

**Five groups, in order. Read the ones your task touches** (line numbers drift as it grows —
grep the bold heading): **Bundle** (build, minification, budget) · **DOM bitmap type** ·
**Layout** · **Gameplay** (the big one — physics, lives, badges, hazards, and the art traps per
screen) · - **A pickup's furniture can seal a screen even when the pickup is fine.** The Workplace's badge cabinet
  floats at gx 4-5, ending at x 240, and the partition wall was at gx 6 — so a player pinned against that
  wall stood at 212-240, i.e. **underneath the cabinet**, where its underside capped their jump at 36px
  against the 80px the wall needs. Every measurement *about the badge* was correct and the screen was
  unfinishable. Same family as a hoist's park row: when you hang anything over a corridor, measure the
  headroom at the place a player **stops**, not just along the walk — and remember that a wall is a place
  they stop. The fix moved the wall (gx 6 → 7) and the hazard's corridor with it (gx 9 → 10).
- **A ranged attack on a screen whose promise is "you can read this man" needs cover, and the cover has to
  suppress the WIND-UP, not just eat the projectile.** The Workplace figure throws his tape now, and the
  ANSR mark takes 3.7s to arrive on the near side of the partition — so a roll that crossed that wall
  would make the one place the owner designated as safe the one place you cannot stand still. `Workplace`
  is the only hazard handed the screen's solids for this reason. And `hasLineOfFire` stops him *starting*
  a throw at somebody behind the wall: a wind-up whose roll dies on the masonry reads as a creature that
  does not understand its own room, and because it burns the interval, sheltering would **suppress** the
  attack rather than avoid it — which teaches the player the opposite of the truth.
- **A projectile that is meant to be jumped is positioned against the standing box, not by feel.**
  `THROW_FLOOR_OFF` 30 puts the roll at 559-581 against a standing player's 556-600: standing still is a
  hit, and 41px of a 140px jump clears it. Chest height is dodged by doing nothing on a screen with no
  crouch, and head height is invisible behind the props. Related: **a slow projectile is dodged LATE.** At
  210 px/s against the player's 260, the probe's best policies jumped at 70px, not 140 — jump early and
  you land back down into it. Write that into the probe's comment, or the next person reads the trigger
  distance as taste.
- **A hazard that stops to attack pays for the attack.** `winding` is a phase, not an overlay: he stands
  still for the whole 0.55s wind-up, so every throw costs him ground. That is what licenses a *ranged*
  attack on a screen that is otherwise a timing puzzle — and it is why the phase can be lethal, like
  `turning`, since he has not moved anywhere the player could not already see him.
- **A hazard may only attack in a direction it is ALREADY facing.** He never turns to aim. That is what
  keeps a patrol readable: his back is genuinely safe, so which way he is walking is *information* rather
  than decoration — and an attack that swung him round would smuggle a direction change into the pattern
  the player has just spent a leg reading.
- **There are FOUR delivery models now, and every rule phrased in terms of one of them has to name the
  ones it applies to.** This exact bill has been paid four times: rail vs drop, then the screen with no
  badge at all, then the perch, now the ceiling drop. `badgeLowestBox` on a ceiling-dropped badge reads
  the *spotlight's* row and puts the "band" 201px over a standing head — right in code, nonsense as a
  measurement. Prefer an explicit positive filter (`delivery === 'rail'`) to a growing list of
  exclusions, which is what `setbackLog.test.ts` now uses. The *question* is always the same — "is it a
  jump and not a walk-through, and can a one-tap player still take it" — and each delivery answers it with
  different arithmetic against its own rest box.
- **A pickup may be visible before it is takeable, and that beat is a mechanic rather than a delay.** The
  Workplace's mark hangs in a ceiling spotlight for `HOLD` 3.2s and cannot be collected up there
  (`ceilingBoxAt` returns null in every phase but `live`). Making it collectable early — or shortening the
  hold to "get on with it" — deletes the only thing this delivery has that the other three do not: the
  offer is on screen from frame one, so being ready for it is a decision. Measure the hold against the
  walk from spawn (~170px, so ~2.5s of standing under it) and gate it in the validator, which is what
  `validateCeilingTiming` does.
- **A pickup that hangs from something must be drawn hanging from THAT thing's geometry, not from its own
  position.** In the `held` phase the mark *is* at `source`, so cables drawn "from source to badge" had
  zero length and it rasterised floating 50px under the fitting with nothing above it. The lens it hangs
  from (`CEILING.SPOT_BOTTOM`) is the room's number and is passed in by the host — the pickup module has
  no business knowing it, and the renderer has no business inventing it.
- **A luminaire is allowed to be an object; the light it makes still is not.** Four "big spot lights
  facing down" (owner call) replaced four recessed strips, and the no-beam rule is intact: a lit lens
  face, a pool on the floor, up-facing edges. What the raster taught is that the *fixture* needs a
  silhouette — a 160px canopy plus a 64×44 barrel with a flat cowl is a **box hanging off the ceiling**,
  wider than it is tall, indistinguishable from the duct 20px away. A spot side-on is a narrow mounting
  and a can whose courses **flare towards the mouth** (44 → 52 → 62 → 72), with its aperture left as a
  dark recess behind it. And keep the flare cells **on the lamp**: four of them below the mouth read as
  feet under a white box.
- **Cutting a service run to let a fitting through means the lit line along it has to be cut too.** The
  duct is broken by `CEILING.DUCT_GAP` at every spotlight, and `litSurfaces` went on painting one 184px
  band along the duct's top centred on the fitting — a pale line lying in a 96px hole. Fourth costume for
  the light-as-an-object defect on this screen and Head Office between them. Two bands, from the cut's edges
  outwards.
- **Pool width is a function of the fitting's PITCH, and it changes when the fixture does.** At 160px
  half-width four pools on a 300px pitch cover 60-380, 340-660, 640-960, 940-1260 — they overlap, which
  paints the whole ground band one value lighter and reads as the floor's own top edge. 130 leaves 40px of
  unlit floor between each pair, and a spot *should* throw a tighter pool than a strip fitting, so the
  number and the fixture agree rather than merely coexisting.
- **When a room has one hue, moving the hero is not an option — so everything else moves, at the same
  value.** The Workplace was five dark teals (wall, glazing, furniture, damage props, and the hero's brand
  Light Teal blazer). Third time this build has answered that with *temperature at the same value*: the
  plaster went warm grey-olive, the furniture with it, and the **ceiling stayed cool**, which is what
  stops a warm wall reading as a sepia filter — plaster and painted metal are different materials and
  should look like it. Below the dado rail the only teal left in the room is the player. Corollaries:
  the one object that keeps the old hue becomes a **beacon** (the terminal, which is the thing the screen
  is won on), and anything that was tuned *against* the old furniture colour has to move with it — the
  damage props were the desks' own teal, so pulled-out drawers rasterised as blue plastic trays in a brown
  cupboard while still obeying their own "a value above the furniture" rule.
- **A window is only a window if it is a different VALUE from the wall.** The Workplace's glazing was
  `#06303C` behind a `#083744` skyline inside a `#0E3846` wall: two surfaces at the same end of the value
  scale in the same hue, i.e. an invisible object, and the owner read it as a slightly different patch of
  wall. It is cool daylight now (six stepped courses `#8FB6C4` → `#5F8C9E`) with the city in near
  silhouette and a dark frame. The value discipline still binds: daylight may be the lightest thing on the
  **wall** and never the lightest thing in the **frame**, which on this screen belongs to the wrapped
  figure's cloth.
- **Furniture needs a section, not an outline.** "The desk and computer screen doesn't look refined" was
  three objects each drawn as two rectangles. What fixed them is structure rather than detail: a worktop
  with a shadow line onto its apron, a cable tray in the leg space and a drawer pedestal (a 30px box with
  an 8px slab on top is a shelf); a framed fabric panel in two courses with three posts (one slab with a
  rail is a wall); and a monitor with a thin bezel, a chin, a slim stand and a **wide** foot (a rectangle
  on a 10px neck is a television on a stick).

**Testing**. Gameplay is ~70% of this file; if it keeps growing, split it per screen
into `docs/INVARIANTS-<screen>.md` and leave the cross-screen rules here.

---

**Bundle**
- Vite's terser plugin **skips `es`-format library output**; `minifyEsOutput()` in `vite.config.ts`
  re-adds it. Without it the ESM bundle ships unminified (~5 KB of the gate).
- **That plugin must run in `generateBundle`, not `renderChunk`.** Vite's `vite:esbuild-transpile`
  runs in the post phase and re-prints the chunk, so a `renderChunk` hook's work was silently undone
  — mangled names survived, whitespace came back, and the output *looked* minified for many passes.
  `budget.test.mjs` guards it: "es much bigger than umd" is the signature.
- Dev-only code must be **constructed** behind `__DEV__`, not merely used behind it. `DebugOverlay`
  was an eager field initialiser, so the class stayed reachable and shipped to every host.
- Copy for build-time-only pages does not belong in `COPY` — that object is imported by the game,
  so anything in it ships (this is why the 404 strings live in `data/notFoundCopy.ts`).
- **There are TWO builds, and a build-time plugin has to be in both.** `vite.config.site.ts` never ran
  `stripLevelNotesPlugin`, so every word of `levels.json`'s authoring prose shipped to the deployed
  page — ~5 KB gzipped — for as long as that plugin has existed. Nothing reported it because the budget
  gate only measures `dist/` and **`dist-site/` is what is actually deployed.** Grep *both* outputs.
- **Grep the built bundle for any prose you just wrote.** `strip-level-notes.ts` covers the places
  it was taught about, and a `note` on a *hazard array entry* was not one of them until the dragon's
  700-character note shipped to every host. Anywhere a human can write in `levels.json`, the
  stripper has to be able to take it back out — and it must not take out strings that are **drawn**
  (the dragon's `taunts` are painted on its fireballs; both cases now have tests).
- **`levels.json` ships, prose included — so write the notes freely and let the build strip them.**
  The engine imports the file, so `meta.notes`/`structure`/`clock`/`conventions`, every `note`,
  `meaningTag`, `zone`, most `role`s and the `hint`/`onClear`/`win` mirrors of `COPY` were going out
  to every host: documenting the compliance maze properly cost ~3 KB gzipped and broke the gate.
  `scripts/strip-level-notes.ts` removes them at build time (dev and tests read the file as
  authored). Two things it must keep: `role` when it contains `noncollide` (`Screen` branches on it)
  and `copy.titleCard` (`Simulation.screenLabel`). Never shorten a level note to save bytes — add
  the key to the stripper.
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
- **A wrapped bitmap line whose last line is one word is a widow, and `wrapPixelLabel` is greedy, so
  the copy has to be written for the measure.** All six stage briefs were authored at ~60 characters
  and set at `body`'s own 34-char measure: every one of them wrapped to three lines with the final word
  alone, directly over a centred button. The fix is both ends — a 26-char measure on the card and copy
  at ≤50 characters — and it is now *tested* (`ui.test.ts` fails a brief needing three lines, or whose
  two lines are more than 2:1 apart), because "slightly more descriptive" is how it comes back.
  Balance is not decoration when the lines are centred: 33/9 reads as a mistake.
- **Measure a new line against the lines around it, not just against the frame.** The briefing card's
  keyboard prompt was authored at `caption` and rendered **353px wide against the brief's 326** — the
  footnote was the biggest thing on the screen. Do the arithmetic (`unit × cols` against the caps) for
  every role you add to a surface, or one clamp quietly inverts the hierarchy.
- **Do not print the same word twice in a column, and that includes a heading and the line under it.**
  Three of these have shipped and all three were invisible in the source (the strings live in different
  objects) and obvious in the raster: "Press SPACE to continue" under a cap labelled **Continue** ·
  **COMPLIANCE** over "compliance does not run in a straight line" · **WORKPLACE** over "the workplace is
  not". Read a screen's strings *in the order they are painted*, then look at the picture. `ui.test.ts`
  now enforces it for the briefs (no word over three characters from the stage label may appear in the
  brief) — the general rule still needs a human eye.
- **Do not caption a button.** Two versions of "press SPACE" under the briefing card's cap were cut: the
  first repeated the verb, the second read as a *second, quieter button drawn on the first*, so the eye
  kept going back to check which one was the control. A focused button already answers Space and Enter —
  a line saying so is documentation of the browser. Same call the start screen made when its control
  legend came out ("stating them made the title screen read as a manual").

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
- **`TITLE_CARD` is a briefing and it WAITS. Never give it a timeout again** (owner call). It is the one
  mid-run state that does not advance by itself: `step()` leaves it only on `input.anyPressed`, through
  the public `requestAdvance()` — which is also what the card's button calls, so the pointer and the
  keyboard are one code path. `TRANSITION.TITLE_CARD_HOLD` is gone (renamed `TITLE_CARD_REVEAL`, and it
  is presentation only); the surviving `TITLE_CARD_SKIP_AFTER` is not a nicety — the Start button both
  begins the run and opens the first card, and a touch double-tap is two presses a frame apart, so
  without the grace one gesture skips the briefing it just opened. Corollary for **every** headless
  driver, probe and helper: a loop that feeds neutral frames until `PLAYING` now sits on the card until
  its guard expires and then asserts against a run that never started. Use
  `src/test/helpers.ts`'s `driveInput(sim)` / `stepToPlaying(sim)`.
- **A coaching line on a timer somebody else chose is not coaching.** The retry hint ("TAKE THE ANSR
  BADGE") had 1.2s on the frame after a death — its own copy comment admitted it. Anything the player is
  *meant to read* has to sit on a surface they dismiss; anything on a timer is a flourish, and should be
  written as one.
- **40px of headroom is not headroom: leave three empty rows (120px) over any tread.** A standing
  player is 44px and has to *jump* 40px to reach the next tread, so an overhead needs to clear 84px.
  Two empty rows (80px) looks generous on paper and is a wall in practice — the flood search stops
  dead, having risen 36px of the 40 it needed. This one number invalidated four Compliance layouts
  (a platform over a staircase, a mezzanine over the landing, a step over a tread, a wide tread over
  the last stair). Measure it as `treadTop − overheadBottom ≥ 84`, and re-run the reachability probe
  after any geometry change.
- **Thin platforms make pockets, and a pocket is worse than an ugly slab** — a floor enclosed by
  faces taller than a jump is a soft lock, because the player can neither finish nor die. "The exit is
  reachable" does not cover it: build the reachability graph with the real `Player`, flood it
  **backwards** from the exit and assert every reachable state can still get home (Compliance shipped
  at 0 of 62,748 trapped). Probe in `docs/JOURNAL.md`; re-run it with the climbable geometry removed
  and it also proves "you cannot cross on one level".
- **A moving solid must be owned by one object, and it may only move away from the player.**
  `moveAndCollide` is driven by the player's motion, so a platform rising into an occupied box pushes
  the player through it. The clearance lift descends only while it is carrying and returns only while
  it is empty. `levels.json` says where it *parks*; `ComplianceMaze` owns where it *is*, and hands the
  same box to the collision list and to the renderer (the `badgeFloat` rule, applied to geometry).
- **On the maze screen the monsters are the barrier** — one object, not a creature plus a gate. They
  hold a striped arm down while scowling and raise it when GCC-BOT files everything. Do not re-add a
  standalone gate: a *solid* one on the only route makes the screen impossible without the badge (no
  screen in this game is), and a *lethal cycling* one stacks a timing test on a route-finding test.
- **Assisted monsters walk the level, they do not drift through it** (owner call — moving straight to
  the gather point read as a bug). Each carries an authored `route` of surface cells. Authored, not
  pathfound: a route is four corners, a search is a kilobyte and a determinism risk, for the same
  picture. A monster with no route stops where it is rather than floating.
- The physics-aware validator searches **hazard-ignoring** (as if assisted), so hazard tuning
  changes cannot break it — but geometry changes can.
- **The badge moves, so its position has exactly one source: `world/badgeFloat.ts`.** Derive it a
  second time anywhere (a render-only bob, a `now()`-based offset, the anchor cell) and you ship a
  pickup that is visible where the collision is not. Same reason it is **not** frozen under
  `prefers-reduced-motion`: that would move the hitbox, which is a rules change, not a comfort
  setting. Its clock is `Simulation.screenClock`, a sim-time accumulator — never the wall clock,
  or `step()` stops being replayable.
- **The float band's ceiling is the HUD, not the frame.** The badge column is `gx 4` (x=180) and
  the HUD's left stack hangs directly over it to y≈150 at a 1280 frame, so the top of the swing
  stops at a box top of 165. The badge cannot be moved right to escape it either — screens 2–4 put
  their first obstacle at `gx 6` and the validator requires the badge to precede every obstacle.
- **Raising the band is a touch decision before it is a difficulty one.** One-tap auto-run hides the
  move pad, so a phone player gets one pass and one tap — currently a **0.40s** window
  (`src/core/badgeReach.test.ts` fails below 0.3s or if the working taps stop being contiguous).
  Re-prove it there after any change to the band, the period, `JUMP_VELOCITY` — or to what stands in
  the badge's run-up (a monster in that corridor eats the window).
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
  running total is warmed. **Same rule keeps the lives plaque cool** now that it holds the loud
  top-right slot: what you have left is what the obstacles have taken, not value.
- **A right-anchored readout may not change width as its value changes**, or the whole stack slides.
  The lives hearts draw spent lives as hollow silhouettes rather than dropping them, which is what
  fixes the width; the old clock zero-padded its figure for the same reason.
- **Feedback belongs on the thing that changed.** The clock plaque used to flash when a delay was
  booked; the plaque is gone and the flash moved to the lives (`beam-run-spent`), because losing a life
  is the event and the months were only its price. Clear the class unconditionally before re-adding it,
  or the reset to a full complement at the start of the next attempt inherits the flash from the end of
  the last one.
- **"Help is active" is signalled on the player, not on the world** (bubble + HUD chip). A cue
  painted along the level's surface reads as a rendering defect, which is why `drawZoneRead`'s cyan
  floor cap is gone. The badge's rail is the exception: it is drawn only *before* pickup and it shows
  the line the pickup travels.
- **Every hazard telegraphs, and the tell has to be where the player is looking.** Screen 1's
  stamps slam in 0.14s; with no wind-up a probe of 20 reactive policies could not clear the stage at
  all — unfair, not hard (`HAZARDS.STAMPS.WARN_TIME`). Where a hazard *rests* decides where its tell
  can live: parked at the ceiling, 90% of a stamp was off-frame.
- **A hazard sprite is its hitbox** — guarded by a test in both hazards that have one
  (`STAMP_BODY_ROWS * STAMP_SCALE` = `HEAD_H`; the monster grid = `MONSTER_W`×`MONSTER_H`). Wider art
  clips the player with pixels that are not there; narrower art hits them from nothing. Anything
  outside the box must be inert (the stamp's handle, the monster's *raised* arm — raised only when it
  can no longer cost anything). Moving `STAMPS.REST_BOTTOM` also moves the press at which the die
  reaches a standing player, so re-run the fairness probe after touching it.
- **A hazard that aims has to LEAD, or a sprinter is immune.** Committed at the player's current
  position, the dragon's breath mark landed 0.7s behind anyone moving and a probe of eight policies
  cleared screen 4 **8/8 with zero delays, blind sprint included** — the boss was decoration. Led by
  `vx × windup` the mark appears *in front of* them and the answer is to break stride, with all the
  warning intact. Lead a *projectile* by the whole flight time and solve it in two passes: the flight
  time depends on the lead and the lead depends on the flight time, so one pass is always short.
  Then **freeze** it — a mark that follows the player is a telegraph that lies.
- **A boss may be faster than the player only if it cannot touch them.** `DRAGON.ROAM_SPEED` is 300
  against the player's 260, which is defensible on that screen and nowhere else: the dragon's body
  is **not a hitbox**, so "you cannot outrun it" costs the player nothing except the option of
  ignoring it. Two probe rounds at 96 and 150 px/s both ended 8/8 with zero delays because the boss
  simply lost the race and spent the stage lobbing fire at a back it could not reach.
- **Range behaviour has to be derived from the attack's own geometry.** `Dragon.STANDOFF` is
  `BODY_W × MOUTH_X_FRACTION + BREATH_REACH` — the exact range from which the footprint lands on the
  player's column. Closing to zero (the obvious reading of "it comes at you") parks the dragon
  overhead, from where its own reach throws every flame clear of the target: a boss that hunts you
  and then cannot hit you is worse than one that ignores you.
- **A boss needs a window in which it cannot be hit, or the fight is one held button.** Guarding only
  the *burn* left the wind-up open and a probe took the dragon's whole costume off inside four
  successive wind-ups — four hits, 2.0s, and not one jet ever meeting a flame, i.e. the mechanic the
  owner asked for never happened. Guarding attacks but not the opening roar let the player kill it
  during its own introduction. It is vulnerable **while roaming and at no other time**, water at any
  other moment boils off as visible steam, and every landed hit provokes an immediate retaliation
  (`nextAttack = 0`). That produced a 6.9s (spamming) to 8.7s (patient) fight.
- **A hazard's cycle length is a measured number.** Column width + player width ÷ walk speed is the
  crossing time (124px ≈ 0.48s on screen 1); the fully-safe part of the cycle must stay comfortably
  above it or the screen is a wall, not a test. Tune `CYCLE`, never the gaps — the geometry is the
  argument. Re-run the probe (`docs/JOURNAL.md`) after any change to either.
- `Simulation.setback()` does **not** reset the hazard: `loadScreen` rebuilds it on every retry, and
  resetting wiped the pose the host paints the impact from (the stamp holding the player flat).
  `Stamps.struckAt` survives `reset()` for the same reason.
- **THERE IS NO RING ROUND THE ANSR MARK, and four were tried.** In order: a dithered field (grey-brown
  dirt at badge size) · four lone cells off the ray tips (detached dots) · a radial corona (reads as
  *more rays*, so the logo stops being a closed shape) · a tangential dashed ring, which shipped for
  several passes and which the owner has now removed too ("remove the halo effect that is around the
  ANSR powerup"). Round a 40px mark a ring reads as a lasso drawn round the logo, and on a *perched*
  badge there is nothing to explain why it would be turning. What carries "this is a pickup" is
  everything that is not the logo — the levitation shaft and its wake, the ground chevron, and on a
  perch the lit plinth plus four flare cells at full alpha. `badge.test.ts` counts the cells in the
  24-34px annulus (4 on a perch, <6 on a rail, all of them on the shaft's axis) so a fifth ring fails
  immediately. **Do not add one.**
- **A dithered glow works at bubble size and fails at badge size.** Warm cells at 0.15–0.4 alpha over
  the deep teal sky desaturate to grey-brown — a field round a 46px figure, dirt round a 38px icon.
  Few cells at full alpha say "light"; many at low alpha say "rendering fault".
- **Anywhere the ANSR mark appears it is the brand asset, never an interpretation of it.** One path
  (`ui/ansrMark.ts`, from `ANSR Logo.svg`) feeds the DOM lockup, the plaza, the attract-screen facade
  *and* the badge. The owner has rejected a procedural stand-in three times: the real mark is a
  hollow ring of ~32 fine rays and nothing generated reproduces it. It reads correctly on canvas from
  ~40px up (rasterised and checked — do not re-litigate it from a code comment); quantising it to
  cells needs ≥26 cells / 52px, which is why the badge draws the vector.
- **The mark's hollow core needs a dark backing on anything small and moving.** Empty is right on a
  page; over a skyline it framed a lit window and the pickup read as a hole in the art. `CORE_CELLS`
  in `render/badge.ts`: whole cells, corners cut, ~0.12 of the diameter each, high alpha (low alpha
  at icon size reads as grime — the dithered-halo trap again).
- **Pickup art may never be bigger than its pickup box** (`BADGE_MARK_D` = `RESOLUTION.TILE`) — the
  hazard sprite rule pointing the other way: wider art promises reach the rules do not give. Shaft,
  flare and chevron are signposting, not the mark, so they may sit outside it.
- `drawAnsrLogo` is a silent no-op without `Path2D` (jsdom). Anything gameplay-visible that uses it
  must still be findable without it — the badge's cells carry that, and a test asserts it. Tests
  must stub `Path2D` **before the first draw**: the path is cached on first call, null included.
- Only draw a shield on the player where contact is genuinely harmless (`Hazard.shieldsPlayer` →
  `Simulation.shielded`). On the screens where help means "the obstacles ahead are cleared", a
  bubble would promise protection the rules do not give — and on the Workplace, where help means
  "the obstacle is now *solvable*", contact still costs a life until the last layer is off.
- **A hazard that snaps to a new position must be harmless while it does — and the better answer is
  not to snap.** The Workplace figure used to *loop*: at the far end he jumped 700px back to his start
  column, and materialising a lethal 60×78 body on top of a player standing there is the same
  unfair-not-hard failure the stamps taught us. That bought `RETURN_TIME`, a harmless beat drawn fading
  in at the column he was about to walk from. He **paces to and fro** now (owner call — a body that
  vanishes at one end and reappears at the other reads as a respawn, not as a person), which deletes
  the problem rather than tuning it: nothing teleports, so `turning` can be lethal, and the renderer
  needs no ramp. Keep the rule for the next hazard that snaps; note that the cheapest way to satisfy it
  is usually to stop snapping.
- **Changing a patrol from a loop to a to-and-fro invalidates the screen's winnability argument, and
  the argument has to be re-measured, not re-worded.** The Workplace's was, verbatim from its level
  note, "he loops back behind you rather than turning round" — i.e. the answer was to wait. A patroller
  who comes back cannot be waited out, so the only move left is to jump him, and whether that *works*
  is arithmetic: a jump clears his 78px crown for 0.455s, the closing speed head-on is
  `PLAYER.WALK_SPEED + WALK_SPEED` = 410 px/s, so 88px of overlap take 0.21s. Overtaking from behind is
  0.8s against 0.455s, i.e. impossible, which is what stops "hold right" being an answer. A probe of 30
  reactive policies × 12 start delays put the best at 10/12 clean and the blind sprint at 0. **Write
  the three numbers into the constant's comment**, because the next person will otherwise read
  `WALK_SPEED` as taste, and it now decides whether the screen can be finished.
- **A crossability probe has to be able to do the boring part of the level.** The first run of the
  Workplace probe reported 0/12 for every policy *including the blind sprint*, which is not a difficulty
  finding, it is a broken probe: the partition wall at gx 6 is 80px of solid, so a policy that never
  presses jump at a wall never leaves the spawn. Give every policy a "jump when you stop moving" reflex
  before believing any of its numbers. Same family as the probe that could not tell winning from losing.
- **A headless hazard signals sound with monotonic counters, never a callback.** `Dragon` exposes
  `shotsFired`/`quenches`/`hits` plus `isRoaring`/`isBeaten`, and `Game.syncDragonAudio` plays a cue
  per increment it has not seen. That keeps `world/*` clear of the AudioEngine and ties the cue to
  the event the *simulation* booked — a jet fired inside a hit-stop still gets its hiss.
- **Sound design: a thud, a hiss, a jet, an arc and cloth in the air HAVE NO PITCH.** Every cue in this
  game that the owner sent back as "dumb" was a physical noise built out of oscillators — the file even
  admitted it in the `roar`'s comment. `AudioEngine.noise()` (looped white-noise buffer → biquad whose
  **frequency ramps over the burst**) is the layer those cues actually need; the ramp is their whole
  character, opening upward for something leaving and closing downward for something settling. Rules that
  came with it:
  - **No cue may *be* its noise.** `createBuffer`/`createBufferSource`/`createBiquadFilter` are optional
    on `AudioContextLike` (jsdom and embed polyfills have none), so every cue keeps a tonal layer that
    carries it alone. A test runs all of them through a double with the three factories deleted.
  - **A noise layer at a tone's nominal gain lands 2–3× quieter** — a Q≈1 bandpass throws most of the
    energy away. First measured pass had `spark` at peak 0.06 and `water` at 0.16, i.e. under the music
    bed. Measure, do not reason about it.
  - **Loop the noise buffer from a moving offset.** Same offset every burst means the water cannon's six
    shots a second phase-lock into a whistle.
  - **Fill the buffer from an LCG, not `Math.random()`.** Identical grain on every machine, and no quiet
    exception to the determinism habit outside `step()`.
- **You can LISTEN to the cues, and a sound pass that does not is the audio version of skipping the
  raster.** `node-web-audio-api` installs in seconds *outside* the project and has a working
  `OfflineAudioContext`: point `AudioEngine` at it, render each cue, measure peak/RMS/length plus a
  Goertzel ladder, write WAVs. Two traps, both of which look like a hang or a no-op rather than a mistake:
  an offline context reports `state === 'suspended'` until it renders (so `AudioEngine.suspended` is true
  and **every cue silently refuses**), and its `resume()` **never settles** (so `await unlock()` hangs with
  no output). Wrap it in a Proxy that reports `'running'` and stubs `resume`.
- **Sound the TELL, not just the act.** The Workplace groan fires on the throw's wind-up, 0.55s before the
  roll leaves his hand; a cue on the release would be decoration, a cue on the telegraph is information.
  Same reason the dragon's roar is a cue and its walk is not.
- **A cue and the text it accompanies must come off ONE number.** The Workplace chime fires on `restore`
  crossing 0.5, which is the threshold `drawTerminal` prints OK at. Two thresholds means the sound and
  the screen eventually disagree about when the room came good.
- **A hazard that repeats a cue several times a second needs `playSfx(cue, level)`.** Screen 1 lands a
  stamp every 0.35s (four columns, 1.4s cycle): at one volume that is a drum machine. Weighted by the
  distance from the player to the column that landed, it becomes a mechanism standing somewhere — and the
  loud one is the one about to matter, so the mix is information. `lastSlamAt` exists for this.
- **A "slam landed" edge is the clock crossing `DROP_TIME`, not `press >= 1`** (true for the whole hold),
  and it must be tested **before** the cycle wrap clears `abortE`, or an aborted stroke thuds on a floor
  it never reached.
- **`tuning.config.ts` is `as const`, so a field initialised from it keeps a LITERAL type.**
  TypeScript only widens *fresh* literals, so `private nextAttack = D.ATTACK_INTERVAL` has type
  `0.9` and every later assignment fails to compile. Annotate: `private nextAttack: number = …`.
  Related: **vitest does not typecheck.** A probe ran green three times while `tsc` was red, and a
  real bug (a method reading a parameter that was never in its signature) survived because the seed
  kept choosing the other branch. Run `typecheck` before believing a probe.
- **A new input action means six touchpoints, not one:** `InputAction`, `InputState`,
  `NEUTRAL_INPUT`, `KEY_MAP`, the `edges` record, `getState`, `endFrame` — plus `VirtualControl`,
  a `TouchControls` button and a `COPY.controls` label. `HazardContext.shoot` is **optional** on
  purpose: one hazard has a verb, and the other three should not carry a field they ignore. Pass
  edges (`shootPressed`), never held state, or a hazard auto-fires from a held button.
- **Size FURNITURE against the drawn hero too, not against the wall.** The wall above the ground band
  is 600px, so anything sized to fill it lands at ~3× human scale: Head Office's first counter was 88px
  against a 60px hero (a desk half again the height of the person being served at it) and its sofa back
  was taller than a person could sit against. Anything a person *touches* is measured against the hero
  — counter at his eye line, seat at his knee, call button at hand height. Only **architecture** may be
  oversized, deliberately: the lift openings are 170px because a realistic 75px door in a 600px wall
  reads as a hatch.
- **Interior light has to be a SURFACE, not a beam.** Head Office's downlights first threw three stepped
  low-alpha rectangles each (hard steps being more 8-bit than a gradient). Rasterised, a 20px column of
  pale grey hanging 90px under each fitting read as eight grey *objects* suspended in the room. The
  cones are gone; the room is lit by a cove line behind the desk and by daylight in the glazing. Same
  family as the dithered-halo trap: low alpha over a dark field reads as grime or as fog, never as
  light. Recess the fittings *into* the ceiling for the same reason — hung below it they were pendants.
- **A backdrop prop may not stand in a column a solid stands in.** Head Office's counter ran under the
  tutorial steps at gx 9 and gx 16, and the step and the desk's front panel rasterised as one dark
  shape — a step you have to jump reading as furniture. Its lit *wall* still spans them, which is
  right: a light wall behind a step is what gives the step a silhouette. Watch the inverse too — the
  24px of free floor between the entrance frame and the first step had a planter authored in it, drawn
  entirely behind the step and invisible.
- **A floor that is meant to look swept gets `speckle: 0`.** Head Office's polished stone is the only
  material in the game with none: every speckle dot rasterised as litter. What carries it is the course
  grid at low contrast plus the bright top edge.
- **Size a hazard against the DRAWN hero (48×60), never his 28×44 hitbox.** The Workplace figure
  was first authored at the compliance monster's 34×52 and rasterised as a child standing next to
  the player. 60×78 is the figure that reads.
- **A telegraph's colour must beat the surface it lands on, not just look warm.** Screen 4's wind-up
  mark was the value orange on that screen's scorched terracotta ground: two warm colours at 0.4
  alpha over a third, which rasterised as a muddy brown smudge on a brown floor. It is cream now —
  the only warm value there lighter than both the ground *and* the sky, so it reads wherever it
  lands. Same class of error as the badge's dithered halo: right in code, invisible in a PNG.
- **A colour swap is not a brightness swap.** Orange at 0.1–0.35 alpha reads against the deep teal
  sky because it is the sky's complement; the same alphas in teal are nearly the sky, and the first
  teal halo rasterised as a faint dashed ring nobody would call a halo. `BubbleTint` therefore
  carries a `boost` and a `spread`, not just two colours. And "a halo *around* the player" is a
  different picture from a field *on* him: the default 46px shell crosses his shoulders, so the teal
  one is wider.
- **The player's shield may leave the value orange where orange is the hazard.** Screen 4 is full of
  orange fire, and an orange shell put the one thing the player needs to see — himself, unharmed,
  inside a field — in the same colour as the thing it protects him from. The badge burst, the ANSR
  ENGAGED label and the HUD chip keep the accent there, so it still says "ANSR is with you".
- **"Pull the version that is on GitHub" means transcribing its GEOMETRY, not its palette.** The
  compliance creature has now been rejected three times, and the third rejection was the expensive
  one because the pass that caused it believed it had already done what was asked. It lifted the
  deployed creature's colours (`#CFE6EC` plate, `#3A1414` slot, `#4E7280` cabinet) and its structure
  in words ("a plate on a filing cabinet, no face") and then re-authored it at 34×52 — and a squat
  30×30 stamp stretched to 34×52 is a parking meter, not the same object. **Two numbers carry more of
  a sprite's identity than any description of it: its size, and its aspect.** When the instruction is
  "use the one on GitHub", `git show <ref>:<file>` the drawing code and port the arithmetic — cells,
  scale, offsets — then put the two side by side in **one raster** before claiming it is done. That
  raster is what found this; nothing in the code review of either version could have.
- **Speed hides cheats. Slowing a motion down is a review of the motion, not a tweak to it.** The
  maze's exodus ran at 420 px/s and `walkHome` moved both axes at that one speed, justified by a comment
  saying a level change "reads as walking down a flight". That is true only for legs that cover a column
  per row; two of the authored routes end in a **pure vertical descent**, and those were a 0.2s blur at
  420 and a creature floating down a stair well at 160. So expect a slowdown to surface a second
  defect, and budget for fixing it in the same pass. The fix shape that worked: keep the honest case
  untouched (both axes at the walk while a leg still has horizontal ground) and give the dishonest
  remainder its own constant (`GATHER_DROP_SPEED`) — a drop for a descent, a walk for a climb.
- **A speed is defensible when it is bracketed by speeds already on the screen.** `GATHER_SPEED` 160
  is above the creatures' own `SPEED_MAX` (132) and well under `PLAYER.WALK_SPEED` (260), so it reads
  as "leaving with purpose" and the player can still outpace it. The rejected 420 was 1.6× the fastest
  thing in the game. When a pace note comes in ("too fast", "too slow"), find the two numbers it has to
  sit between before picking one, and write them into the comment — the next person will otherwise read
  the constant as taste.
- **A test for "it should not float" needs a fixture that could float.** The new pace test first passed
  vacuously against the existing `STAIR` fixture, whose legs all cover more ground horizontally than
  vertically and therefore never produce the pure descent the bug lives in. Any test for a *degenerate*
  case has to be handed input that reaches it; prefer copying the shape of the real level data
  (LEGAL's one-column-across, four-rows-down leg) over inventing a tidy one.
- **Transcribing drawing code is not enough: render it with the LEVEL DATA it was authored against.**
  The fourth rejection of the compliance creature was caused by a transcription that was correct cell
  for cell and still shipped the wrong object. `drawGates` anchors the cabinet post to the *screen
  floor* (`groundY = 15 * TILE`) and the head and boom to the *gate's own row* — and the gates are
  authored at `gy 14`. One row of difference, and the creature is a body with a **floating head** and a
  5px gap, not a stamp with a hat. I had rastered the code against a single convenient ground line,
  which collapsed the two pieces into one 30×30 lump, and the raster looked self-consistent, so
  nothing flagged it. **When a draw function reads more than one anchor, feed it the real
  `levels.json` rows before believing the picture.** The general form: a sprite's identity lives in
  its code *and* its data, and a raster is only evidence if the inputs are the shipped ones.
- **Draw order is part of a sprite's identity too.** The deployed creature paints the boom arm and
  *then* the plate over it, so at rest the barrier is hidden behind its own head and only the end cell
  shows. That reads as a rubber stamp; the same arm painted on top reads as a plate with a white bar
  across it. Both are "a stamp with a striped boom", and they are not the same picture. Where a
  transcription can put an element in front or behind, check which the original does.
- **The hitbox is the sprite, so a re-sized sprite is a gameplay change — check the corollaries.**
  Dropping the monster 34×52 → 30×30 moved `MONSTER_W`-derived corridor ends, `GATHER_SPACING`'s
  premise ("wider than MONSTER_W") and the name plaque's clearance, and the raised boom promptly
  ended up hidden behind five name plates. The plaque now steps up with the arm. Anything in
  `tuning.config.ts` whose comment *mentions* the constant you changed is a place the change has to
  be thought about, not just a comment to fix — and both mirrors of that file need it.
- **A big creature is composed, not authored as one grid — UNLESS the creature is a silhouette.**
  This rule produced the maze monster (now 7×13 at scale 5) and the Workplace figure (20×26), and it was right to
  compose the *flying* dragon out of a head grid, a wing grid and `pxRect` runs. It was wrong for the
  Godzilla, and following it cost three art rounds: composed and stood upright, the beast rasterised
  as a hunched lizard, because **a composer cannot see a silhouette** — you can move the parts around
  forever and never find the shape. It is one 30×24 grid at scale 10 now, and the four reasons the
  rule exists all fail for it: there is no clothing to register against it, 720 cells is
  proof-readable, a row of the wrong width is caught mechanically by a test that measures the grid,
  and **one grid mirrors for free** (which deletes the whole `mirror()` apparatus and the "a
  left-facing dragon is a subtly different animal" bug class with it). The technique that made it
  cheap: author the *twelve rectangles* it is made of in a throwaway generator in `/tmp` (fill blocks,
  derive the outline by a boundary pass, then values, then fins), iterate the numbers against a PNG,
  and paste the **output** in as literal strings. Nothing generated ships.
- **A grid is only as good as its size.** The same upright silhouette at 200×190 had no room for
  legible legs, arms, fins *and* tail — the lower half was one mass. 260×240 (five drawn heroes wide,
  four tall) is where it reads. If a creature is not reading, try the size before the shape.
- **A backdrop that framed a flying boss will swallow a standing one.** `scenery.ts` had a scorched
  crag at x≈1080, authored under a dragon that hovered over that end. The beast now stands in exactly
  those columns, and two dark warm masses in the same place are one mass: the animal lost its
  silhouette and its head read as a hole in the rock. Deleting the crag put it back against the sky.
  Any time a hazard *moves* — including from the air to the floor — re-rasterise what is behind it.
- **Nothing on this screen travels, and the hitbox is the painting.** `Dragon.coneBoxes()` cuts the
  cone into stepped AABBs, and the simulation collides against exactly the boxes the renderer paints.
  A cone is not an AABB and both dishonest ways round it cost the player: one box over the whole thing
  is lethal where there is no flame, a box round the axis alone is flame that cannot hurt anybody.
- **A high jaw makes a fire lane SHORTER, not longer.** The flame leaves a Godzilla's head 190px up,
  so it takes ~37% of its reach to come down to a standing head — everything before that passes
  overhead. `CONE_REACH`, `CONE_NEAR_H` and `BURST_GAP` are solved *together* against that: lethal
  strip = `CONE_REACH × 0.63` ≈ 350px ≈ 1.45s to walk clear of, against `BURST_GAP + BURST_WINDUP` =
  1.60s of safe floor. Move `MOUTH_Y_FRACTION` and all three have to be re-measured.
- **The safe pocket under the jaw is deliberate.** A beast that sets fire to its own feet is a beast
  whose fire nobody believes, and it gives "get in close" a meaning on a screen whose body is not a
  hitbox.
- **A growing attack is a fairness mechanism, not a flourish.** The cone ignites next to the beast
  first and arrives at the far end 0.3s later — the end the player is standing at — so somebody caught
  in the outer lane still has a beat to leave.
- **An opening beat plus a wind-up can hand a sprinter the whole screen.** `ROAR_TIME` (1.8s) +
  `BURST_WINDUP` (0.65s) is 637px of guaranteed safety, further than the entire lethal strip; with a
  `BURST_GAP` on top of it, a player holding "right" from the spawn walked the level before anything
  was alight — the same "boss is decoration" failure two earlier tunings of this screen shipped. **The
  roar is now the gap before the first burst**, which costs a reading player nothing (a roar *is*
  1.8s of warning) and puts the first flame down while a sprinter is still in the lane.
- **A hazard whose range varies must vary DOWNWARDS only.** `CONE_REACH` is measured against what has
  to stay out of the fire — the spawn, and the drop column behind the player. A symmetric ±10% roll
  overshot it every other burst and put flame on a brick the player was standing under, which the
  telegraph never promised. `0.88 + 0.12 × roll`.
- **Crossing a lane uses the wind-up, not the gap.** One gap is 0.95s ≈ 247px against a 350px strip,
  so a player who only walks during gaps oscillates and never crosses. Gap **plus** wind-up plus
  growth is ~1.9s. The moment that reads as "freeze" is in fact the safest part of the run — and the
  test states that policy explicitly, because it is the claim.
- **A pinned label's clearance is derived from the hazard's HIGHEST edge.** The cone's top is highest
  at the jaw (the axis starts there and only falls), so a plaque positioned from the *far* end
  rasterised 4px inside the flame near the beast. `mouth.y − CONE_NEAR_H/2 − 44`.
- **A pickup resting on a solid can be blocked by that solid's side.** The badge box is exactly the
  40px above its brick, so overlapping it means having your box in 440–480 — and any box bottom in
  480–520 is *inside the brick's face*, where the horizontal move is stopped. A running player whose
  jump is cut short arrives with his feet 5px below the brick's top and is halted **one pixel short of
  a badge box he is already level with**. Clearing the brick needs ~76px of rise *before* reaching it,
  i.e. most of the arc, i.e. the button held (20 frames, where the rail screens need 12).
- **A floating platform has exactly one legal row here, and both bounds bite.** Row 12: underside at
  y=520 clears a standing head (556) by 36px — **one row lower and the brick is a wall across the only
  route on the screen** — and its top puts the pickup 76px over that head, a jump of 76 against 140.
- **Rules phrased in terms of "every screen having a badge" must exclude the screen with none.** Same
  class of failure as the rail/drop split below, and the third time it has been paid for. Deleting
  Head Office's badge broke five things in one go and they were all one mistake: the validator's
  structural rule, two `s.badge!` sweeps (`badgeReach`, `setbackLog`), the golden run (which *waits*
  for a badge to arrive and so waited 8,000 frames), `screen4`'s "every other screen has a box" list,
  and two `Simulation.test.ts` badge tests that used screen 0's only because `toPlaying()` starts
  there. The rule that actually matters is **"every screen with an obstacle carries a badge"**.
- **Rules phrased in terms of the rail must exclude the screen with no rail.** Four test failures this
  pass were one mistake: `badgeReach.test.ts`, `setbackLog.test.ts` and the validator's float rules all
  measured *every* screen with `badgeLowestBox`, which on the drop screen reads `gy` — the **drone's
  flight row** — as if the pickup hung there. 161px over a standing head, failing for being correct.
  Split rail from drop, and prove the drop screen against `dropRestBox`, on **every** column.
- **A golden run must wait for a badge that has to arrive.** `golden.test.ts` teleported to the exit
  while `sim.badgeBox` was still null and cleared screen 4 before the delivery landed, reporting three
  capabilities instead of four.
- **A SCROLLING FIELD MUST WRAP PER PARTICLE, over its own full span — never as a shared offset
  over a shorter one.** The first rain shared `drift = (t × 620) % 240` across every drop, so twice a
  second the entire sheet jumped back up the screen: the owner called it "a boomerang loop that's
  going on and not continuous", and it is the whole class of bug in one line. Each particle now has
  its own phase and its position is `(phase + t × speed) mod span`, where `span` is the full height it
  falls through — so wraps are staggered, and each one is a drop *leaving at the bottom and
  re-entering at the top* rather than the sheet rewinding. Corollaries worth keeping: make the span
  cover the frame plus one sprite length so nothing has to be culled (which also keeps the field a
  fixed size, which is what lets a test follow one particle from frame to frame and prove it never
  steps backwards); give a slanted sprite a path on its own slant, or it reads as a stripe falling
  vertically; and use **two sheets** at different speeds and values, because one sheet is a pattern
  and two are depth.
- **Ambient glowing particles read as dirt on the screen.** Fourteen small warm cells drifting up the
  frame were meant as hot air; the owner saw specks, and on a screen whose only hazard is fire they
  are also fourteen things that look like they might hurt you. Deleted. The ground shimmer stays,
  because it is *on* the floor rather than floating over it.
- **When a hazard is answered, remove it from the frame.** The beaten beast used to stand there
  undressed at 0.32 alpha, which read as a defeated lizard behind the five people who are the payoff.
  `beaten` now paints only the wreck of the costume, and `stripping` cross-fades one into the other.
- **A colour-only filter in a render test will catch the labels.** The cone's "never paints outside
  its hitbox" test failed on the taunt plaque's glyphs, which are the same cream as the flame core.
  Filter by cell size as well as colour.

- **Furniture goes DARKER than the wall, with one lit edge each.** The Workplace floor was painted a
  value *up* from its wall on the reasoning that lighter reads better, and three workstation pods, a
  cabinet bank and the terminal all landed within two values of the wall and of each other: the whole
  bottom third of the frame was one indistinct field, with the player, the one lethal figure and nine
  props standing in it. Dark mass plus a bright top rail is what reads as an object at this size — and
  it keeps the light values for the things that have earned them (on that screen: the wrapped figure's
  cloth, the whiteboard, the light itself). Corollary: **a backdrop prop may be the lightest thing on
  the WALL, never the lightest thing in the FRAME.** The whiteboard at `#AFC8D0` and a near-white clock
  dial both had to come down two steps for the same reason.
- **A screen with two states must author the GOOD state and lay the damage over it.** The Workplace's
  broken room was authored in the backdrop and its repair was a set of things that faded out, so
  "restored" rasterised as the same dark room with four slightly brighter bars in it. `scenery.ts` now
  paints the room as the fix leaves it and `render/workplace.ts` paints the damage over the top, driven
  by `restore`. The payoff is then a real change rather than a fade, because the good room already
  exists underneath — and the architectural boundary survives, since the backdrop still knows nothing
  about whether the room has been fixed. Geometry the two halves share (`CEILING`, `WORK_PODS`,
  `POD_SCREEN`, `CABINETS`, `WINDOW`) is **exported, not written twice**: a lamp that misses its own
  aperture is the `badgeFloat` defect in a different costume.
- **"Un-gloomed" is not "lit".** Taking a 0.28 shadow layer off gets you back to a *neutral* room, and
  "the lights come good" has to be visible across the whole frame. The Workplace's payoff paints the
  exact inverse of its gloom (a full-frame pale wash at `0.075 × restore`) under the figures, so they
  stay saturated against it.
- **A broken room is HALF-lit, not dark.** All four Workplace fittings at one dim level rasterised as
  four grey bars in a room with no light in it — which also left the floor lit by nothing, so fixing
  the room had nothing to change. Two hold and two strike and drop out.
- **A light needs a POOL and up-facing EDGES, and it needs unlit floor beside it.** Third time the
  no-beam rule has been paid for (Head Office's downlights, then this screen's gradient wedges). What
  works: the fitting as one lit diffuser panel; a stepped pool on the floor with **seven** steps so it
  slopes (four wide bands read as painted patches); and the up-facing faces under it — the top of the
  duct, the dado rail, a band of wall under the ceiling. And the pools must not meet: at 192px half-
  width, four of them covered 8→392, 308→692, 608→992, 908→1292, i.e. the entire ground band one value
  lighter, which reads as the floor's own top edge. **The dark between the pools is as much of the
  picture as the pools are.**
- **A lit fitting drawn as two thin bars is a vent.** Especially on a screen that has a duct on it for
  comparison. One lit rectangle with two ribs across it reads as a fitting.
- **An aperture and the hole beside it must be on the same grid, and a test has to say so.** A 168px
  fitting centred on 800 covers 716–884; the Workplace's missing ceiling tile at 640 ends at 720, i.e.
  4px inside it, so a hole in the ceiling rasterised as a dark smudge above a light fitting. `FIT_W` is
  **exactly two tiles** now. The test states the *relationship* (no gap may overlap any aperture, and
  every gap is on the tile pitch) rather than the four numbers, which is what makes it survive the next
  time somebody moves a light.
- **A hanging plate's steps must overlap.** The ceiling tile hanging by its corner stepped 16px cells by
  8 across and 6 down and reads as one plate on the slant; stepped by more than their own size the same
  cells are a dashed diagonal line. Same rule as the maze's boom arm — a diagonal's snap has to be finer
  than its stride — and it also has to be painted **over** whatever is below it (the first version hung
  behind the services duct, i.e. nowhere).
- **A wrapped figure is made of CLOTH, and the tape is the accent on it.** The Workplace mummy's nine
  tape bands were two and three rows tall and covered ~40% of the body: rasterised, he was a yellow
  striped pillar with a dark visor, i.e. a man in protective kit. Every band is one cell tall now and
  what carries the read is a **seam on every other row** of pale cloth, in two alternating tones. If a
  figure is not reading as wrapped, thin the tape before touching the silhouette.
- **Anything drawn ACROSS a silhouette has to know which cells are holes in it.** The seam pass paints
  every odd row and the mummy's eye slit is on row 3, so it closed the slit — the head's only feature —
  and the defect was invisible in the code because both layers were individually correct. The seam
  builder holds `e`/`E` out by name.
- **A sprite must FILL its hitbox, not just fit inside it.** The hazard-sprite rule pointing the other
  way. The Workplace figure left three empty columns (9px) at one edge, and because he mirrors, that
  strip swapped sides when he turned round: 9px of box that touches the player with pixels that are not
  there. The body sits in columns 1–13 with the reach out to 19 now, and a test caps the empty columns
  at 3px.
- **A prop the player has to FOLLOW SOMEBODY TO must be findable from the far end of the frame.** The
  Workplace terminal is the thing the freed colleague runs to, the thing the screen is won on and the
  only readout of that win, and it was drawn at the workstations' size and value — a dark box in a row
  of dark boxes, with a cone and a ladder authored on top of it in `levels.json`. Bigger, brighter, and
  its columns are now protected level data like the figure's start columns are.
- **A ruled panel is a blind; handwriting is uneven.** `drawBoard` ruled every 8px across a board's full
  width and the Workplace whiteboard rasterised as a barcode. Runs of different lengths, an indent, a
  boxed diagram and an arrow are what say a person wrote it. That function had no other caller and was
  deleted with the pass.
- **A divider as tall as the hero hides everything behind it.** The Workplace pods' screens were 62px —
  the drawn hero's full height — so they hid the monitor on the desk *and* anybody standing at it, and
  the pod contained nothing but a wall. 50px is a real 1.4m screen against a 1.75m person, the monitor
  crests it, and the payoff can put somebody back behind it.
- **Editing `levels.json` with a naive JSON dumper reformats the whole file, and Prettier will not put
  it back.** `json.dump(indent=2)` expanded 52 compact leaf objects (`{ "gx": 0, "gy": 15, … }`, which
  is Prettier's own output at printWidth 100) to five lines each and turned a 12-line change into
  +543/−89. `prettier --write` keeps an object expanded when the source has a newline after `{`, so the
  damage is one-way. Either hand-edit the JSON, or use a dumper that reproduces the rule — collapse any
  object/array whose one-line form fits in 100 columns at its indent, keep the blank line before
  `"screens"` and between screen objects — and **prove it reproduces `git show HEAD:src/data/levels.json`
  byte for byte before pointing it at the working file.**

- **Composed art has to mirror by hand.** `drawPixels` can flip a grid; the `pxRect` runs that make
  up a torso, neck, tail and legs cannot. One `mirror()` helper is used for every horizontal
  placement in `render/dragon.ts`, and a test compares the left- and right-facing spans so a
  left-facing dragon is the same animal rather than a subtly broken one.
- **Clothing on a creature needs a chest to sit on, and must not exceed it.** The dragon was first
  drawn side-on: with the torso turned away there was nowhere for a tie to hang, so the jacket
  rasterised as two filing cabinets either side of a white block, and the head was too small for
  glasses to exist. Upright (frontal torso, profile head) fixed both. Then the jacket was 148px wide
  on a **100px torso** and overhung the body — nothing but sleeves may leave ±50 of the centre line.
- **A round thing needs a stepped profile, not nested squares.** Three nested squares rasterised as
  a box inside a box; rows whose widths follow a half-width profile read as a sphere. A ground burst
  needs uneven tongues for the same reason — one filled rectangle read as a crate on fire.
- **Value relationships decide legibility, and they are invisible in source.** The wrapped figure
  in a beige at the caution yellow's own value rasterised as a striped pillar: wrap and tape merged
  into one shape. Cloth is now near-white — the lightest thing on a dark floor — so the silhouette
  carries and the tape reads as accent. Same class of error as the badge's dithered halo.
- **When the dressing and the hazard share a colour, hold the dressing back — and if that is not
  enough, stop sharing the colour.** The Workplace props draw at 0.78 alpha and the figure does not: at
  full alpha the one thing that can cost a life was one more yellow shape among nine. Level data also
  leaves the columns he starts each sweep in **empty**, because a ladder standing there made him
  unreadable exactly where he must be read. Both were right and neither worked, because **alpha changes
  which yellow shape is loudest, not how many there are** — nine props plus one figure is ten yellow
  shapes whatever their alphas. The figure is bound in **red barrier tape** now and the room keeps
  caution yellow (owner call). Two corollaries: `tapeStrip` takes a *tone*, so one piece of stepping
  arithmetic paints either tape and they cannot drift apart; and everything that counts or depicts the
  figure's tape follows the figure — the layer pips over his head, and `drawTangled`, because a death
  pose has to say who did it. The 0.78 stays: it is still right for its own reason.
- **A silhouette with no narrowings is not a body, and no amount of surface detail rescues it.** The
  Workplace figure had an **8-row head** on a 26-row grid (31%, i.e. chibi), no neck, no waist, and legs
  divided by a *single column of outline* — 3px of dark inside a solid slab. Seams, tape and a fist were
  all authored onto it and it still rasterised as a bollard with an arm out. What fixed it was four
  narrowings and one hole: a 6-row head with its corners cut, a 1-row neck, a shoulder row that steps in
  before the torso reaches full width, a waist, and legs separated by a **transparent** column with the
  room showing through. Corollary that has to be followed through in the same pass: **a hole in the
  silhouette forbids anything that spans it**, so every band below the hips is authored *per leg* — one
  strip across both would tape the gap shut, which is the seam-closing-the-eye-slit defect in a new
  costume. And a feature that has to survive 3px cells needs **two** rows (the eye slit).
- **A thing the HERO CARRIES is exempt from "furniture goes darker than the wall".** The rebuilt cutter
  was given a dark receiver on that rule and rasterised as nothing at all: it is held at chest height,
  which on this screen is exactly where the dark furniture is, so the player was holding four orange
  cells in mid-air. The rule is about *the room*, where the background is a known wall. Anything the
  player carries has to read against whatever he happens to be standing in front of, which means a mid
  tone, one lit rail, and a black keyline round the whole shape.
- **A projectile that is meant to be round needs a profile that NARROWS away from the centre line,
  and the list is easy to write upside down.** The fire orb's first cut had its widest courses at the
  poles and rasterised as an orange brick with a hot corner — correct arithmetic, wrong picture, and
  invisible in review because "stepped half-width profile" was in the comment. `workplace.test.ts` now
  measures it: widest course within 6px of the orb's middle, poles strictly narrower, nothing wider than
  the hitbox. Related: **flicker a projectile off its own POSITION, never a clock** — the same reason the
  Workplace trudge is distance-driven.
- **A light pool must narrow AWAY from the wall, or it is a pyramid.** Third costume for the
  light-as-an-object defect (Head Office's downlight cones, then this screen's gradient wedges, now this).
  `floorPool`'s seven bands *widened* on the way down — 54 → 160 half-width — and the stepped silhouette
  that produces is a flat-topped pile of rubble sitting on the floor. Light on a floor seen side-on is
  brightest where the floor meets the wall and dies towards the camera, so the profile runs 160 → 78,
  with a **dithered fringe** along the bottom (hard steps are right for a *silhouette* — clouds, a sun —
  and wrong for the boundary of a light, which has no edge) and a bright course on the walkable line.
  Dither the fringe only: a fully dithered 280×100 pool is ~1,700 fills, a fringe is ~30.
- **"The lights come good" means MORE SOURCES, not the same four turned up.** Four ceiling fittings
  reaching full is a change in four places, and a working office floor is lit from more than four. The
  Workplace payoff adds fittings the broken room does not have: a continuous **cove** behind the ceiling
  line, an uplit **dado course**, a **task lamp per desk**, and double the daylight in the glazing. All
  four are lit *faces* — the no-beam rule is intact — and they are what make the wash (0.075 → 0.11)
  read as light rather than as a filter.
- **Two props in the same colour separate on SILHOUETTE or not at all.** The Workplace cone and its wet
  floor sign were both filled yellow triangles, 48 and 56 tall, standing on the same floor: the same
  object twice. The cone is 2.4:1 with a curved flare, **two** reflective collars and a square black base
  plate wider than itself; the sign is a genuine **Λ of two boards with the room showing through between
  their feet**, which is what a folding sign actually is and what a filled triangle can never be.
  Corollary: **art painted onto a leaning board must be positioned from the BOARD's centre at each row**,
  not the prop's — a pictogram at the prop's midpoint hangs off a board that has already leaned 12px away.
- **A ribbon needs a twist; strips laid end to end are a dashed rule.** The tape runs were 8px segments
  in a sagging line and read as a dashed underline across the picture. One segment in five drawn narrow,
  dark and pinched — the flat of the tape turning edge-on — is the whole fix, and it costs nothing.
- **A hazard lamp in amber is orange.** The barricade's blinker was first drawn `#FFB04A` over
  `#B85E12`, which is the reserved value accent by another name, and four of them standing on the floor
  put it in competition with the badge levitating two columns to the left. Anything on this screen that
  is *warning* stays in the caution-yellow family; the only orange is the ANSR capability — the cutter
  and its fire.
- **Burning a thing off is a picture of a hit the simulation already booked, and the two must not be
  able to disagree.** `UNWRAP`'s layer leaves the hazard on the frame the orb lands; the burn
  (`MummyState.burn`/`burning`, driven by the hazard's own clock, never a render-local timer) runs for
  `BURN_TIME` afterwards. Three states per band — tape, burning, **soot** — because a band that simply
  stops being drawn is a wipe, and the permanent scorch is what puts the score on the body rather than
  only on the pips over his head. Two constraints worth keeping: `BURN_TIME` must be under
  `2 × SHOT_COOLDOWN` or two burns overlap into one smear, and once every band burns, the unravel has to
  throw **ash and embers** rather than intact tape, or it contradicts the three burns just watched.
- **Stripes that mean "barrier" have to run diagonally.** Reusing the tape's vertical ticks on the
  barricade rails rasterised as yellow planks. `stripedRail` steps the diagonal in whole pixels.
- **Every death that stops the stage should be visible on the player, and there are three of them
  now.** The stamp flattens him (`flattened`); the Workplace figure tapes him up (`tangled` →
  `drawTangled`); a compliance monster **files him** (`filed` → `drawFiled`, a mound of forms to his
  chest with the creature's own slot mark stamped across it). Leave the head clear — the first tape
  version wrapped him from the crown down and read as a stack of yellow bricks. The maze went four
  passes without a pose, and what that looked like was a frozen frame in which a delay had obviously
  happened and nothing said what had caused it. **Build the pose out of the obstacle's own
  vocabulary**: these creatures are rubber stamps on filing cabinets, so the answer was paperwork, and
  the pile is drawn in the same near-white as their approval plates because it is the same material.
- **The pose has to say WHO did it, not just what happened.** A creature standing beside the buried
  player with its arm at rest reads as a bystander, so `MonsterState.struck` marks the one that made
  contact and the renderer slams its boom 10px below rest and lights its slot (a third palette on the
  same grid — never a second sprite). Same device as the DENIED stamp still holding the flattened hero
  down on screen 1, and it works for the same reason `Stamps.struckAt` does: `Simulation.setback()`
  deliberately does not reset the hazard, so the pose survives into the frames it is painted on.
- **A pile of anything must be uneven, or it reads as built rather than dumped.** The mound's five
  courses were symmetrical first and rasterised as a wedding cake; offsetting each course sideways
  (and stopping the keylines short of the ends, so they read as shadows between sheets rather than as
  ruling) is what turns a pyramid into a stack of loose paper.
- **"Use the thing we already have" is an instruction to find and reuse it, not to evaluate it.**
  This cost two passes. There are **no binary assets anywhere in this repo's history** (120 files
  across every commit on every branch; `main` == `origin/main`; the parent `ANSR Game/` folder is not
  a git work tree), so "pull it from GitHub" always means a routine in a past commit. The compliance
  creature *was* there — `Game.drawGates` on `origin/main`, which is the **deployed build the owner
  has been looking at**. Pass 18 found it, judged it "not a monster", designed a horned fanged animal
  instead and wrote forty lines explaining why that was better; the owner rejected it in one line.
  When you are pointed at something that exists, transcribe it out of `git show` and scale it. If it
  genuinely looks wrong, rasterise both and **ask** — do not ship the substitute.
- **A featureless obstacle can be the design.** The compliance creature is a rubber stamp on a filing
  cabinet: one dark slot through a pale plate, no eyes and no mouth (owner call). "Monster" is the
  name of the obstacle, not an art brief. A structural test in `maze.test.ts` measures the grid — no
  row of the plate may hold more than one run of slot cells, and the slot rows must be one contiguous
  band — so a face cannot be drawn back on by accident.
- **Signage that duplicates a gameplay label has now been rejected twice on this screen.** Five
  suspended boards (pass 15) and a wall of seven labelled filing cabinets (pass 18) both went into the
  sky above the Compliance maze and both came out: TAX/GST/AUDIT/LEGAL/ENTITY are the *monsters'*
  names, so a copy of them hanging behind the climb is a second, duller label layer competing with the
  one that matters. The names are framed plaques on the monsters. Do not put them back in the sky.
- **A thin staircase over open ground makes a pocket, and the treads are what seal it.** Making the
  Compliance flights one tile thick (which is what the owner's sketch draws) opened a strip of ground
  underneath, enterable only by falling off the flight and impossible to leave: the second tread's
  underside left 40px against a 44px player, and every upward escape was blocked by the treads
  themselves — the best jump from the strip reached feet-460 against a top tread at 440, 20px short.
  1,488 trapped states. The fix is one 40×40 step at the far end (`step-resubmit`), giving two 80px
  hops back onto the flight; it is not a shortcut because the strip cannot be *walked* into. **Any
  time a solid is thinned, re-run the backwards flood** — thinning only ever adds reachable places,
  and the new ones are exactly the ones nobody designed an exit for.
- **In that probe, off-frame dead ends are falls, not pockets.** States where the player is past
  either end of the ground have no floor: they leave the world and `forceSetback('fall')` books them.
  Counting them made the first run report 2,069 "trapped" states at gx −0.8. A pocket has a **floor**.
- **A step over a tread can block a jump that lands somewhere else entirely.** The 84px headroom rule
  is about jumping *straight up* off a tread. The Compliance switchback's key move goes up-*left* from
  a tread to a platform two rows above it, and a step 160px overhead — comfortably clear by the
  headroom rule — put its underside exactly where the player's head passes. `validate:levels` caught
  it as "exit not reachable", which is the only reason it was not shipped.
- **`slope` alone cannot describe a wide tread.** A monster on a two-column staircase steps up every
  *second* column; `slope: -0.5` would put its surface on half-rows, i.e. stand it 20px inside the
  stone. `slopeRun` (columns per tread, default 1) keeps the row a whole number. Same principle as
  `badgeFloat`: a position must never be derived in a way that can land between the geometry.
- **A diagonal's snap must be finer than its stride.** The boom arm rises at 68°, so its vertical
  advance per 4px step is 3.7px, which `pxRect` rounded either onto the previous cell or 8px past it:
  the barrier rasterised as a broken ladder. Stride 3, snap 2. Related: **an affordance has to be the
  size of the thing it describes** — the lift's travel was a 4px dashed hairline down a 400px shaft
  and read as a wire, and it is chunky chevrons now. A repeating glyph drawn down a shaft must fit
  **whole** inside the travel that is left, or it promises a descent the machine does not have.
- **Two adjacent screens may share a hue if they do not share a material.** Compliance is brown now
  (owner call) and screen 1 already was. They separate on value and course — kraft/manila against
  muddy clay, and now that both have been refined, a 0.05-speckle 40×20 course against an
  0.08-speckle one two values warmer — not on hue. (Compliance was a 20×20 grid at 0.1: over a 240px
  block that is twelve rows of joint, and it read as a mesh laid across the whole climb.) The
  unplanned win: the maze had
  been a blue-grey mass against a blue-grey sky, and brown gives the whole climb a silhouette.
- **The HERO cannot be tuned for one screen, so a screen that swallows him has to move.** The
  Workplace had wall `#0A2B33`, floor `#28383D` and a hero in brand Light Teal `#005465`: three
  variations on one hue, and the frame read as a single dark field with shapes scored into it (owner:
  "the player and the brick and background feels the same"). He appears on six screens, so the two fixes
  are both on the room. The floor came **off the teal axis** to a warm grey-olive (`#3C443A`, edge
  `#96A38C`) — same value family, different temperature, which is the separation without adding a fifth
  colour, and the same move screen 2 made going brown. And the **lowest wall register went darkest**
  (`#051B23`), because that band is the 140px the hero's whole body stands against and his shirt was
  carrying the silhouette on its own. General form: when a figure disappears, check whether the
  background *behind that figure's height* is the thing to change, not the figure.
- **The rasteriser has no HUD, so it will happily approve art hidden behind one.** The (now deleted)
  archive wall's first cabinet was at x=128 with the HUD's opaque left column reaching x≈194: 54px of
  art plus a label that could never be seen, and invisible in a PNG because the PNG has no chrome.
  Check the DOM chrome's extents (`ui/Hud.ts`) by hand before trusting a backdrop shot.
- **A moving plate that RISES has to carry its rider, and that makes it the one place the world moves
  the player.** The lift got away with "moves only while carrying" because it descends: the player
  falls onto it every frame and gravity does the work. A hoist cannot — a plate rising under a
  standing body passes straight through it, since `moveAndCollide` is driven by the player's motion.
  So `runPlate` offsets the player's box by exactly the plate's own delta while it is carrying and
  rising. Two consequences that are now rules: **nothing may be authored over a hoist's travel**
  (there is no ceiling test in that code, and 40px of masonry over the top of the shaft would push a
  rider into it), and a plate may still only move *towards its travel while loaded and back to its
  park while empty*, so it can never move into a body it is not carrying.
- **A rising plate's PARK ROW is load-bearing geometry, and the level validator cannot see it.** The
  plate is deliberately not in `solids` (the hazard owns the live box), so the reachability flood
  never meets it — which means a hoist parked one row too low silently seals the screen: its underside
  takes the headroom off the tread beneath it, the player can still *walk* under the plate but can no
  longer hop up off that tread, and the only route up the maze is gone. Measure it as
  `surfaceTop − plateBottom ≥ 84` for every solid under the plate's span (the same 84px the whole
  level obeys) and state it as a check — `validatePlates` in `scripts/validate-levels.ts` does, and
  `screen2.test.ts` says it again against the live hazard. **Rising plates only:** the lift descends
  into the ground band on purpose, so the same rule applied to it fails for being correct.
- **A plate that is part of the route needs TWO floods, one per end of its travel.** Modelling it at
  both ends in one flood proves a jump nobody can make (from the parked plate onto a plate hanging
  120px directly above it); leaving it out entirely reports the screen as impossible. The honest pair
  is: with the plate **parked**, can it be boarded from spawn — and starting **on top of it at the far
  end**, does the route continue. Same principle as proving a floating badge against the bottom of its
  band: pick the one position each question is actually asked at.
- **A pickup can be delivered three ways now, and any rule phrased in terms of one of them has to
  exclude the other two.** Third time this exact bill has been paid (rail vs drop, then the screen
  with no badge at all, now the perch): `badgeLowestBox` on a perched badge reads the wall's own row
  as a float anchor and puts the "band" 155px underground, which is right in code and nonsense as a
  measurement. `badgeReach.test.ts` and `setbackLog.test.ts` both split on `delivery` now. The general
  form: the *question* is always "is it a jump and not a walk-through", and each delivery answers it
  with different arithmetic.
- **A pickup ON the path is not a decision, and this model is about a decision.** The perch's first
  cut stood its brickwork on the floor of the only corridor: a hurdle you had to clear anyway, so
  every player collected GCC-BOT on the way through without ever choosing it (owner: "the powerup is
  easily available and is on the way so the player would anyway take it — keep it somewhere that it is
  on the user to take it or not"). The structure **floats** now (underside 36px over a standing head),
  so holding right walks under it and declining is possible — which is what makes taking it mean
  something, and what makes the delay log an argument rather than a formality. The validator states it:
  a perch's support must not reach the floor.
- **"Off the path" is a distance from the FORWARD LINE, not a height above it.** One hop up off the
  floor was rejected too ("still too reachable"), and rightly: a player running right taps once,
  lands on the deck and walks into the mark, so the detour costs nothing and decides nothing. What
  makes a pickup a decision is having to go **the other way** — the badge now sits on a second deck
  120px higher and 40px back to the *left*, with the first deck as the stepping stone, and it is out
  of reach of the ground entirely (a full jump off the floor tops out at feet 460 against a deck at
  360). Sweeping every single forward tap and finding that *none* of them collects it is the test
  that says so; "harder" would have been a bigger number, and this is a different shape.
- **A perched badge belongs on the column its player ARRIVES at.** On a deck approached from the
  left that is the last column; on one approached by jumping back leftwards it is the right-hand
  column, which is the same rule read from the other end. A mark in the middle can be walked off the
  far side by somebody who landed late.
- **A two-deck climb needs the lower deck to be unavoidable, and a test to prove the upper one is
  not reachable without it.** Both are measured against the same jump height: the step must be inside
  a jump of the *ground*, the deck inside a jump of the *step*, and the deck out of reach of the
  ground. Re-run all three after moving either. The probe states it from the other side: with the
  step removed, the flood cannot stand anywhere but the floor.
- **A pickup standing on a solid needs the jump button held ~20 frames where a rail needs 12** — the
  figure the air-dropped brick forced, arrived at again here, because a solid has to be *cleared*
  rather than touched and jump-cut caps a 12-frame arc at ~121px.
- **Optional must not mean impossible on a phone — and the one-tap layout used to make it so.**
  Auto-run is the default on touch, and that layout hid the *whole* move pad, so anything behind the
  player was unreachable for most of this audience: a badge that has to be jumped back to could
  never be taken. The pad now keeps its **left** button under auto-run and hides only the redundant
  right one. One-tap means "you never have to press forward", not "you cannot turn round" — and any
  future level detour depends on that distinction. Both halves are tested: the auto-runner who only
  holds forward walks past the badge, and the same player with one back-and-jump takes it.
- **"Help is active" may be shown on the WORLD instead of on the player, and on one screen it now is.**
  The bubble rule still stands (only where contact is genuinely harmless), but the Compliance maze
  declines the bubble it is entitled to and clears the weather instead (owner call). So
  `ComplianceMaze` deliberately does **not** set `shieldsPlayer`, and there is a test saying so in
  words — a missing flag reads as an omission, and the next person would put the halo back.
- **Weather is two layers, not one, because the sky is behind the level and the level is most of the
  frame.** Brightening screen 2's sky alone rasterised as a bright sky in front of an unchanged dark
  maze. What reads as "the environment is fresh" is `scenery.ts` (sky, cloud, sun, rain) **plus** a
  full-frame veil-and-wash over the masonry and under the cast (`drawWeatherWash`: `0.22 × (1−clear)`
  cool dark, `0.07 × clear` pale). Same shape as the Workplace's payoff, and the same lesson —
  "un-gloomed" is not "lit". Keep the dial in the *hazard* (sim time, replayable) and hand the
  backdrop a plain number, so `scenery.ts` still knows nothing about badges.
- **A cloud that fades out is a rendering fault; a cloud that shrinks is weather.** The overcast lid
  contracts towards each cloud's own centre and lifts as it lightens, so the sky *opens*.
- **8-bit is a CELL SIZE plus a silhouette, not a handful of big rectangles.** Both the sun and the
  clouds were rejected as "way too pixelated and not refined", and the diagnosis was the same for both:
  they were built out of a few wide `pxRect`s snapped to 4, so every step in the shape was 20-40px long
  and the eye read slabs. What fixed it was *more steps of the same cell*, not a smaller cell and not
  anti-aliasing — a cloud is now a **height per 4px column** derived from overlapping lobes (a profile,
  which is what a tile mask would have been), and the sun is a **real pixel circle** (every 4px cell
  whose centre is inside R) in three concentric bands with twelve tapering rays. Same cell as the rain
  and the badge halo; ~16 rows across a 64px disc rather than 8, which is the difference between a
  circle and a polygon. When something reads as "too pixelated", count the steps in its outline before
  reaching for a smaller cell.
- **A sun gets no lit side, but it does get an off-centre core.** Shading its lower rows read as a stem
  and turned it into a light bulb; a rim course under it landed on its own bottom ray and did the same
  with a gap in it. What works is concentric bands with the brightest one pushed up-left, so it reads
  as a sphere of light rather than as a coin — the light source on the frame cannot itself be lit from
  somewhere else.
- **Rasterise the sun. It will be behind something.** Placed at x=322 it sat exactly on the hoist's
  brick guide pier and read as a lamp on a post — the occluded-sun defect, paid for twice now. Its
  position is measured against three things: the pier, the HUD's left column (x≈194) and the frame's
  own signage.
- **A blocking wall that stands on the ground severs the corridor it is meant to guard.** The owner's
  "wall on the left side of the platform" cannot reach the floor: every height that stops a jump from
  the ANSR wall (the player's apex is feet-380) also stops the walk to the staircase, and every wall
  low enough to walk past is low enough to climb and jump from. The answer is a **pier in the air**
  spanning only the heights the shortcut passes through (gy 6-9, i.e. 240-400), with the whole ground
  corridor open beneath it — and because it is flush with the hoist's left edge it reads as the
  machine's guide column rather than as a floating block.

**Testing**
- For time-windowed hazards, read the hazard's own state getter right after `update()` rather than
  recomputing `t = i * DT` (float consistency).
- Test helpers live in `src/test/helpers.ts`: `driveToScreen`, `expireGrace`, `engageBadge` (reads
  `sim.badgeBox`, never the anchor cell), `standAtColumn`, `forceSetbackAt` and
  **`recoverFromLifeLost`** — almost every hazard test needs the last one now, because a delay
  leaves the sim in `LIFE_LOST` and the stage restarts from its title card.
- **Anything that walks the run has to press through the briefing card**, which waits for the player.
  `driveInput(sim)` returns `anyPressed` when and only when the state is `TITLE_CARD` (ignored while
  PLAYING, so it is safe on every frame of a drive) and `stepToPlaying(sim)` wraps the common loop.
  Every driver in the repo had to be converted the day the timeout was removed —
  `driveToScreen`, `recoverFromLifeLost`, `golden.test`'s `playToWin`, `driveToEnd` and both `toPlaying`
  helpers — and none of them *failed loudly*: they timed out on a guard and then asserted against a sim
  still sitting on a card. Write new probes against the helpers, not against `makeInput()`.
- **A "keyboard-only" test that waits out a screen is not testing keyboard operability.**
  `keyboard.test.ts` used to sit through the title card with neutral frames; a card that needs a press
  is a wall for a keyboard user, so the proof has to *press* with the real `Input`.

- **A backdrop can be lighter than the hazard in front of it, and then the hazard is invisible.**
  Screen 1's stamps were painted in the same dark blue-greys as the sky (`#33505C` body against a
  `#00212B` sky) while the skyline's lit windows were `#7FC4D2` — *lighter than the hazard*. Only the
  white label panel read, so a rubber stamp rasterised as a floating card. Fixing it took both ends:
  the tool is light now (pale frame, near-white plate, near-black keyline and die, so it holds against
  the sky *and* against the clay it presses onto) and screen 1's skyline dropped two values. Note that
  `drawSkyline` is shared by four screens and takes its colours **per call** — dim it for one screen,
  not for all of them. Same family as the wrapped figure in beige: an object at a different point on
  the *same end* of the value scale as its background is an invisible object.
- **Type below scale 2 is not type, it is texture.** The ink pads printed a ghost `DENIED` at scale 1
  — 5px tall — which nobody ever read as a word; four of them read as smudges on the clay. If a string
  cannot be set at scale 2, it is decoration and should be drawn as decoration or deleted. Related:
  **a telegraph painted in near-white across 88px stops being a line and becomes a lump.** The stamps'
  wind-up print line is one 4px cell thick and has two closing marks per side, not four.
- **Hands, dials and anything round need whole cells, never `ctx.stroke()`.** The wall clock was the
  last vector stroke in any backdrop: 2px anti-aliased hands in a 32px case rasterised as grey fuzz
  inside a dark square, i.e. as a small window. At 80px with stepped `pxRect` hands and twelve ticks
  it is unmistakably a clock. Size before shape, again.
- **Brickwork varies brick to brick; speckle only varies within a brick.** `drawBricks` had per-pixel
  speckle as its only variation, which is why every surface read as a flat slab with dirt on it — and
  at screen 1's 0.22 the dirt read as litter. `faces` (per-brick tones from `hash2`) and `bevel` (the
  shadow each course casts on the one below) are what make masonry look laid. Both are **opt-in**:
  five other materials read through the same function, and a refinement to one screen must not move
  the other five.
- **A wall's column is decided by where a player STOPS at it, not by where it looks tidy.** A hurdle
  in the middle of a pair of hazards pins a running player against its left face, and that resting
  place must not be inside a hazard's box. Screen 1's first hurdle sits at the pair's midpoint (gx 10:
  pinned at x 372–400 against presses at 252–348 and 460–556); the second is deliberately **off** its
  midpoint, because gx 22 would have pinned the player at 852–880 against the gx 20 stamp's 772–868.
  Measure the pinned box against every neighbouring hazard box before choosing the column.
- **Changing the PHASE of a pickup's motion changes its fairness even when the band does not move.**
  The rule, three owner calls deep on the same one line of trig. `badgeFloatOffset` is now **`-sin`**
  (owner: "start from the middle of the rail, then go up and then down"): offset 0 at t=0, the top at
  a quarter period, the **bottom at three quarters** (4.8s). Before it was `+cos` — the bottom of the
  band on the frame the screen started — and before that `+sin`, which starts mid-rail but **sinks
  first** and is the shape ruled out twice. Same 310px band, same `badgeLowestBox`, and yet:
  - `+cos` made screen 1's rail a **pass-jump**: a forward-only auto-runner took it on the way past,
    0.35s of tap frames wide.
  - `-sin` makes it a **wait**. His right edge reaches gx 4 at **t=0.40s** with the box **255px over
    his head against a 140px jump**, and the band does not come back down until 4.80s — a forward-only
    run is at the exit by then. Measured: **0 of 60 tap frames** take it, and the badge is takeable
    ~3.6s in by standing under the rail.
  So the arithmetic to do before touching this is not "is it inside the band" but **"where is the mark
  on the frame the player is under the column"** — the pass is 0.3s wide and the cycle is 6.4s. There
  is no phase that starts mid-rail *and* keeps the pass-jump: to be low at 0.4s from a mid-rail start
  the mark has to move >300 px/s, which is the speed the owner already rejected. It is one or the
  other, which is why it is `docs/OPEN.md` §18 rather than a tuning number. Re-run
  `badgeReach.test.ts` after touching the phase *or* the period, not just the amplitude.
- **Feedback belongs on the thing that changed — and it has to get there from where it happened.**
  The delay log is in the top-right; the player's eyes are on the hero. So a booked delay now writes
  the obstacle's name and `+2 MONTHS` over the body, holds for 30% of the flight so it can be read,
  and arcs up into the panel (`core/delayFlight.ts`, pure). Three rules it encodes: it **holds before
  it travels** (a label that moves on the frame it appears is noticed, not read); it **arcs** (a
  straight diagonal reads as UI drifting, an arc reads as something carried); and under
  `prefers-reduced-motion` it **holds and fades without travelling** — the information is the message,
  the journey is the juice. `DELAY_FLIGHT_TIME` (0.8s) is bounded by `LIVES.LOST_HOLD` (0.9s), after
  which the title card covers the canvas and anything still in the air is thrown away unseen; a test
  states that *relationship*, not the constant.

- **A hazard's period and its stroke are ONE decision.** `CYCLE = busy + warn + safe`, so shortening
  the cycle without deciding which of the three absorbs it silently spends the safe window: cutting
  screen 1's stamps from 1.8 to 1.4 on its own leaves 0.46s of safe floor against a 0.48s crossing and
  the stage becomes uncrossable (0/60 policies). It works at 1.4 **because the stroke was compressed
  with it** (HOLD 0.34 → 0.24, LIFT 0.24 → 0.20), keeping 0.60s. Never cut `WARN_TIME` to buy
  frequency — a faster hazard needs the same warning, not less, and as a share of a shorter cycle the
  telegraph should grow.
- **A safe/crossing ratio is necessary, not sufficient.** Screen 1 at cycle 1.32 has the *same* 1.26×
  ratio as the shipped 1.40 and clears 0/60, because what the player crosses is the whole pattern —
  stamp → hurdle → stamp, a ~0.8s traverse — not one column. Any hazard spaced into a *pattern* has a
  period floor that no single-obstacle arithmetic will find; only a probe over the whole stage will.
  Screen 1's floor is a **1.38s cycle** and the guard for it is in `screen1.test.ts`.
- **An assist scale is DERIVED from the hazard's period, never left alone when the period changes.**
  What a capability promises is a window wide enough to walk through, and that window is
  `safe ÷ ASSIST_TIME_SCALE`. Cutting the stamps' cycle while leaving the scale at 0.26 would have
  shrunk 1Wrk's payoff from 3.3s to 2.3s without a line of code changing — the unassisted screen gets
  harder and the *capability quietly gets worse too*, which inverts the argument the screen exists to
  make. It is 0.18 now, and a test holds the window over 3s and over 6× the crossing time.
- **When a hazard's period becomes an exact multiple of the timestep, the wrap frame exists for the
  first time.** `CYCLE / DT` is a whole 84 at 1.4s (and half of it a whole 42), so the clock lands
  exactly on its own wrap, where `press` is 0 *by definition* — the instant the drop begins. That is
  one frame reading as neither pressing nor warning, and two `Stamps` tests had been asserting it could
  never happen. They passed for four passes on **floating-point luck**: at the old 1.8s, accumulating
  `e += 1/60` 108 times reaches 1.7999999999999985 and never wraps on a frame boundary. Do not "fix"
  this by choosing a period that is not a whole number of frames — that hides the constraint where
  nobody will find it. State the property so it survives the wrap instead.
- **A probe that cannot tell winning from losing will still rank your options.** Clearing a screen
  leaves `PLAYING` for the *next* stage's title card, so "state is not PLAYING" reads a win as a death:
  the first version of the stamp-frequency probe scored 0/60 on every tuning including the shipped one.
  And **sample the phase**: everything here is deterministic, so one run per policy measures a single
  alignment of player against hazard cycle — a spread of start delays is what turns "did this run
  survive" into a rate, and without it a *faster* cycle scored better than a slower one.

---

**Gameplay & art — Hire Under Fire's rebuild** (owner notes on the beast, its fire, the pickup, the
ending and the death pose; full narrative in `docs/JOURNAL.md`)

- **"Make it smaller" and "make it more refined" are the SAME change, and the answer is the cell, not the
  pixels.** The Godzilla was 30×24 at scale 10 (300×240, 720 cells) and the owner asked for both at once.
  At a 10px cell a 200px animal is 20 cells across: a leg is two cells, a jaw is one, and every curve is
  a 10px stair — **that is what "blocks of red colour" describes.** It is 46×38 at scale 5 now (230×190,
  1,748 cells): smaller on the frame and two and a half times the cells. Same lesson as screen 2's sun
  and clouds, arrived at from the opposite direction: when something reads as too pixelated, count the
  steps in its outline before touching its size.
- **A 1,748-cell grid is affordable only if it is GENERATED and pasted.** Author the silhouette as per-row
  spans in a throwaway generator, derive the outline, the value bands, the plates and the texture
  mechanically, iterate against a PNG, and paste the **output** in as literal strings. Nothing generated
  ships. This is now how two creatures and two props on this screen were made.
- **Each mask has to be shaded by its OWN geometry.** The first cut shaded every row against that row's
  full span, and on the rows the tail leaves from, the span starts at the tail's *tip* — so the shading
  painted a dark stripe down the middle of the chest. Right arithmetic, wrong object. Body, tail and limb
  are separate masks with separate profiles.
- **Dorsal plates: fewer, taller, with air between them.** Four attempts. At 4–5 cells wide and 4–5 rows
  tall on adjacent rows they merge into one pale mass along the spine, which reads as **fur**; standing
  off the back behind a dark keyline they read as **flags pinned to the shoulder**. Narrow at the top,
  widest at the base, base row in shade, one clear row of air between each pair.
- **A tail that tapers to a point down a straight diagonal is a BLADE.** It has to thicken at the hips
  and **lie flat along the floor** for its last third, which is also what makes an upright stance
  believable.
- **Hide texture is BANDS, not dots.** Darkening single cells on a grid rasterises as polka dots (a
  costume). Runs of three with gaps of three on every fourth row read as hide.
- **A plated belly is drawn on STRAIGHT bands.** Following the silhouette's own front edge row by row
  puts a step in the band wherever the body has one, and a plated belly with a zig-zag in it reads as a
  ribbon lying on the chest. The steps in the outline are the body's business, not the plates'.
- **Re-drawing a head moves the level design.** `MOUTH_X_FRACTION`/`MOUTH_Y_FRACTION` are read off the
  drawn grid (mouth row, muzzle column), the jaw's height above the floor decides how far down the lane
  the flame takes to reach a standing head, and that decides `CONE_REACH`. Solve the chain; never nudge
  one number.
- **NARROWING a hazard can make a screen easier, so the reach has to grow with it.** `CONE_NEAR_H`/
  `CONE_FAR_H` 120/190 → 70/120 (owner: "too wide") moves the lethal threshold from f≈0.42 to **f≈0.495**,
  because a thinner cone meets a standing head later along its own axis. At the old 560px reach that is a
  283px lethal strip ≈1.19s against 1.60s of safe floor — a screen a blind sprint survives, which is the
  failure two earlier tunings of it shipped. `CONE_REACH` went **up** to 620. Write the solved inequality
  into the constant, not the conclusion.
- **Anything drawn from a hazard's bounding BOXES will look like boxes.** The cone's burn was three
  stacked rectangles per segment: eight blocks in three colours, i.e. an orange girder. Painting a 4px
  column *to the height of the box it falls in* is the same defect, because a box is an AABB over a whole
  segment. Compute the flame's real band per column from the **same numbers the hitbox steps** (axis lerp
  + half-thickness lerp): the band is a subset of its box, so "what is painted is what burns" survives and
  the shape is a jet. Bite both edges *inwards* only, taper a nose over the last few columns, and keep a
  root cell on the fire's own side of the mouth — a root centred on the jaw hangs half its width outside
  the first segment.
- **"Lower the speed of the drone" is a fairness change wearing a pace note.** `POWERUPS.DROP.CROSS_TIME`
  is set by one-tap play: a slower drone is overhead later, releases later and lands later, so the mark
  can arrive *behind* the auto-runner. Sweep (column × crossing time) and read the contiguous one-tap
  window off it — gx 13 falls off the cliff at 3.6s, gx 15–17 hold the full 0.40s to 3.6, and gx 18 never
  clears the 0.3s budget because its later taps die in the fire. **The column and the drone's speed are
  one decision.**
- **The parcel's FALL spends exactly the lead the crossing bought.** At 424 px/s the drone is ~137px ahead
  of an auto-runner when it releases, and a 0.55s fall gives him 143px of walking — so the mark landed
  level with his shoulder instead of in front of him, which is the one thing this delivery may not do.
  `FALL_TIME` 0.55 → 0.35. Whenever the drone's speed moves, re-measure the *gap at landing*, not just the
  tap window.
- **A test that pins a sequence must assert the ORDER, not the length of the list.** `badgeDrop`'s phase
  walk asserted exactly `carrying → falling → live` inside one cycle; with a slower drone and a shorter
  fall the early columns now expire before the cycle is out, and a `gone` beat appeared. The order was
  always the claim.
- **A thing the hero CARRIES gets a mid body, one lit rail, and a dark keyline — and a mouth that flares.**
  The water cannon was a pale housing (a bar of soap at chest height), a parallel-sided tube (a pipe) and
  a lit rectangle for a mouth (a white flag on the end of a stick). A hole seen side-on is **dark**: the
  aperture is a dark line at the tip with two lit cells in it, and the bell widens in whole-cell steps —
  the same rule the ceiling spotlight paid for, pointed at a weapon.
- **A projectile that is meant to be a STREAM is drawn every cell, not every 20px.** Five squares stepping
  back from the head is a dashed row of rectangles with the sky between them (the tape-ribbon defect
  again). 4px cells every 4px with a lit spine, thickest just behind the head, thinning to a wisp — and
  the head stays exactly the hitbox, because it is the hitbox.
- **A creature that DISSOLVES leaves nothing that can then be opened.** The owner's ending needs the beast
  on the floor with a costume that unzips, so `stripping` is a **topple**: the standing grid drawn cell by
  cell with each row sheared sideways in proportion to its height off the floor, sinking and squashing, so
  the head travels furthest and the feet stay put. A shear is the cheapest honest way to drop a 190px
  animal without authoring a second animation. It leans *away* from the player, which is the side the
  payoff comes out on.
- **An opening is an event, not a state.** The suit's inside and its zip are painted only as far as
  `openness` has run; before that those columns are the suit's own body. A costume that is already open on
  the frame it lands cannot be *opened*, and the opening is the ending.
- **"One by one" is a STAGGER longer than one walk-out is visible for.** `CANDIDATE_STAGGER` 0.55s against
  `CANDIDATE_WALK_TIME` 0.85s means there is exactly one figure in the doorway early in the sequence.
  Their stride is distance-driven, never clock-driven, or five people march in lockstep.
- **"It vanishes" reports NULL, not a fully faded thing.** `costumeState()` returns null once the fade is
  done, so "there is nothing there any more" is not a number anybody has to remember to check. Same shape
  as the pickup boxes.
- **A payoff that has to be visible needs a full-frame layer, and the dial belongs to the hazard.**
  `Dragon.relief` is sim time (0..1 over `RELIEF_TIME`), handed to `scenery.ts` as a plain number — the
  backdrop knows nothing about badges or hazards — and the frame-wide half is `drawReliefWash`, drawn
  where the maze draws `drawWeatherWash`. Both halves of "un-gloomed is not lit" are there: a cool veil
  that lifts *and* a pale wash that comes up. And it is a **second parameter** rather than a second
  meaning for `weather`: one number doing two screens' jobs reads as a bug the first time a screen wants
  both.
- **A payoff has to reach the MIDDLE DISTANCE, not just the sky.** What sold this one was the market
  opening (awnings up, lit windows out), the heat shimmer going away with the danger it belonged to, the
  scorch receding and grass coming through it. And **anything new in the middle distance stays out of the
  beast's own columns** (left of x=760 here) — two dark warm masses in one place is one mass, which is what
  the deleted crag proved.
- **Confetti and any other loose cells belong over the thing they are about.** 24 six-pixel cells
  scattered across the frame read as specks of dirt once the payoff brings a bright sky up — the same
  defect that deleted this screen's drifting embers. 14 eight-pixel cells in the band above the line-up.
- **A pinned label's clearance has to be re-measured when either the hazard or the animal changes size.**
  The name plate sat at chest height, clear of the HUD, the animal and the sky, until the beast shrank and
  the cone narrowed — and then the jet ran straight through the plaque, because a jet leaving a 190px
  animal's jaw crosses exactly that band. It is 72px above the floor now, *under* the lane.
- **A death pose may be a PROCESS, and then it needs sim time.** Fire burns, so the hero's pose takes hold
  over `LIVES.LOST_HOLD` rather than being one frame — hence `Simulation.lifeLostProgress`, on sim time
  like every other replayable dial. It is still drawn *over* the hero, like the tape and the paperwork,
  because the sim booked the delay on the frame of contact and the person has to stay recognisable.
- **Fire on a body is TONGUES with air between them.** A flame column per 4px of body, all reaching
  similar heights, rasterises as an orange box with a head sticking out of the top — the cone's defect in
  its third costume. Seven roots at very different heights, each tapering to a single cell, hot heart in
  the lower third only, and the person visible between them. The test measures it: distinct cells cover
  under 45% of the rectangle the flame spans.
- **Smoke has to be PALE.** Grey at low alpha over a near-black sky is nothing at all; and over a bright
  one it is the specks problem. Few cells, whole-cell steps, high enough alpha to read.

---
**Copy — naming a screen**
- **A screen's name is a data change in FOUR places, and one of them is analytics.** Renaming screen 0
  Reception → Head Office touches `name` **and** `copy.titleCard` in `src/data/levels.json` *and* the
  root `levels.json` mirror (nothing enforces that the two are byte-identical, so `diff` them). `name`
  is what `screen_entered` reports as `screen_name`, what the game-over receipt prints as the screen
  reached (`reachedScreenName`) and the HUD's stage; `copy.titleCard` is what the briefing card prints,
  because `Simulation.screenLabel` is `copy?.titleCard ?? name`. Change one and the card disagrees with
  the analytics. `data.test.ts` pins the names of the two screens that carry no badge, so a rename that
  misses one end fails there.
- **A rename is only safe if the new name is not longer than the longest name already shipping.** The
  card's stage label is painted as **one unwrapped line** (`paintPixelSvg(art, [levelLabel])` — there is
  no `maxChars` on it, unlike the brief), so a long name has nothing to fall back to. "Arrival — ANSR
  Tech Park" (24 chars) is the ceiling that has been rasterised; anything under it needs no new picture.
- **Check the name against the brief printed under it.** `COPY.titleCard.brief` may not echo a word from
  the stage name above it (the raster caught COMPLIANCE over "compliance…" and WORKPLACE over "the
  workplace…"), so a rename can *create* that defect without the brief changing. Head Office over
  "Every plan looks clean from the lobby." is clear — "lobby" is not "office".
- **Screen names are places or plain pains, and the first one belongs to the PLAYER.** "Reception" said
  the player was arriving somewhere as a visitor; the screen is their own building, taking the GCC
  decision (its three steps are business case, board approval, budget), and screen 5 is the arrival.
  Rejected on copy, not art: **"Home Office"** is real GCC vocabulary for the parent HQ but now reads as
  working from home, and to a UK reader it is the department that issues visas — the wrong association
  for a game about entering a market. **"Boardroom"** contradicts the art (a lobby, a counter, a lift
  bank; no table). Full reasoning: `docs/SCREENS.md` §4.13.
