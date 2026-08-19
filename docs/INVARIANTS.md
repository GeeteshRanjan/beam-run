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
screen) · **Testing**. Gameplay is ~70% of this file; if it keeps growing, split it per screen
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
- **A hazard that snaps to a new position must be harmless while it does.** The Workplace figure
  loops back to his start column rather than turning round, and materialising a lethal 60×78 body
  on top of a player standing there is the same unfair-not-hard failure the stamps taught us. Hence
  `RETURN_TIME`: harmless for the whole beat, drawn fading in at the column he is about to walk
  from, 156px of escape at walk speed. The ramp *is* the telegraph.
- **A headless hazard signals sound with monotonic counters, never a callback.** `Dragon` exposes
  `shotsFired`/`quenches`/`hits` plus `isRoaring`/`isBeaten`, and `Game.syncDragonAudio` plays a cue
  per increment it has not seen. That keeps `world/*` clear of the AudioEngine and ties the cue to
  the event the *simulation* booked — a jet fired inside a hit-stop still gets its hiss.
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
  is 600px, so anything sized to fill it lands at ~3× human scale: Reception's first counter was 88px
  against a 60px hero (a desk half again the height of the person being served at it) and its sofa back
  was taller than a person could sit against. Anything a person *touches* is measured against the hero
  — counter at his eye line, seat at his knee, call button at hand height. Only **architecture** may be
  oversized, deliberately: the lift openings are 170px because a realistic 75px door in a 600px wall
  reads as a hatch.
- **Interior light has to be a SURFACE, not a beam.** Reception's downlights first threw three stepped
  low-alpha rectangles each (hard steps being more 8-bit than a gradient). Rasterised, a 20px column of
  pale grey hanging 90px under each fitting read as eight grey *objects* suspended in the room. The
  cones are gone; the room is lit by a cove line behind the desk and by daylight in the glazing. Same
  family as the dithered-halo trap: low alpha over a dark field reads as grime or as fog, never as
  light. Recess the fittings *into* the ceiling for the same reason — hung below it they were pendants.
- **A backdrop prop may not stand in a column a solid stands in.** Reception's counter ran under the
  tutorial steps at gx 9 and gx 16, and the step and the desk's front panel rasterised as one dark
  shape — a step you have to jump reading as furniture. Its lit *wall* still spans them, which is
  right: a light wall behind a step is what gives the step a silhouette. Watch the inverse too — the
  24px of free floor between the entrance frame and the first step had a planter authored in it, drawn
  entirely behind the step and invisible.
- **A floor that is meant to look swept gets `speckle: 0`.** Reception's polished stone is the only
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
  Reception's badge broke five things in one go and they were all one mistake: the validator's
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
  no-beam rule has been paid for (Reception's downlights, then this screen's gradient wedges). What
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
- **When the dressing and the hazard share a colour, hold the dressing back.** The Workplace props
  draw at 0.78 alpha and the figure does not: at full alpha the one thing that can cost a life was
  one more yellow shape among nine. Level data also leaves the columns he starts each sweep in
  **empty**, because a ladder standing there made him unreadable exactly where he must be read.
- **Stripes that mean "barrier" have to run diagonally.** Reusing the tape's vertical ticks on the
  barricade rails rasterised as yellow planks. `stripedRail` steps the diagonal in whole pixels.
- **Every death that stops the stage should be visible on the player.** The stamp flattens him
  (`flattened`); the Workplace figure tapes him up (`tangled` → `drawTangled`). Leave the head
  clear — the first version wrapped him from the crown down and read as a stack of yellow bricks.
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
  (owner call) and screen 1 already was. They separate on value and course — kraft/manila at 20×20
  and 0.1 speckle against muddy clay at 24×16 and 0.22 — not on hue. The unplanned win: the maze had
  been a blue-grey mass against a blue-grey sky, and brown gives the whole climb a silhouette.
- **The rasteriser has no HUD, so it will happily approve art hidden behind one.** The (now deleted)
  archive wall's first cabinet was at x=128 with the HUD's opaque left column reaching x≈194: 54px of
  art plus a label that could never be seen, and invisible in a PNG because the PNG has no chrome.
  Check the DOM chrome's extents (`ui/Hud.ts`) by hand before trusting a backdrop shot.

**Testing**
- For time-windowed hazards, read the hazard's own state getter right after `update()` rather than
  recomputing `t = i * DT` (float consistency).
- Test helpers live in `src/test/helpers.ts`: `driveToScreen`, `expireGrace`, `engageBadge` (reads
  `sim.badgeBox`, never the anchor cell), `standAtColumn`, `forceSetbackAt` and
  **`recoverFromLifeLost`** — almost every hazard test needs the last one now, because a delay
  leaves the sim in `LIFE_LOST` and the stage restarts from its title card.

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
  `badgeFloatOffset` is a **cosine** (owner call: the badge goes up first), so the mark starts at the
  bottom of its band and rises. As a sine it entered every screen at the middle of the band heading
  *down* and only reached the bottom three quarters of a cycle later — long after a one-tap auto-run
  player has walked past the column. Same 310px band, same `badgeLowestBox`, completely different
  window. Do not flip it back, and re-run `badgeReach.test.ts` after touching the phase *or* the
  period, not just the amplitude.
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
