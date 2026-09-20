# ANSRcade: The GCC Game — Handoff (current state)

> **Read §1–§4 of this file, then the ONE section file your task touches.** This file is the
> router and the current state; the detail lives in four companion docs so a session does not
> pay to load all of it.

## Where things are — read only what the task needs

| Doc | Holds | Read it when |
|---|---|---|
| **`HANDOFF.md`** (this) | status · environment · locked defaults · the model proper (§4.1–§4.8) · recent passes | **always, first** |
| **`docs/INVARIANTS.md`** | every rule and trap this build paid for, each one a defect that shipped once | **before editing anything** |
| **`docs/SCREENS.md`** | the per-screen model, §4.9–§4.14 (Head Office · Setup Delays · Compliance · Workplace · Hire Under Fire) | touching one screen's gameplay, art or hazard |
| **`docs/ARCHITECTURE.md`** | the module map, §5 — engine · world · render · ui · scripts, with a "where to look by task" table | writing code anywhere in `src/` |
| **`docs/OPEN.md`** | §7 open owner decisions, §8 what stays in web type | picking the next job, or the answer is "the owner decides" |
| **`docs/JOURNAL.md`** | full narrative of every pass, append-only, never pruned | you need the *background* on one past decision |

**After a pass:** append the full entry to `docs/JOURNAL.md` · add a one-liner to §10 here and
drop the oldest so the list stays at 3 · refresh the numbers in §1 · put any permanent rule in
`docs/INVARIANTS.md` (the doc that is *meant* to grow) · put per-screen detail in `docs/SCREENS.md`,
not back into §4 here.

---

## 1. Status

All 16 planned build tasks are complete and the game is playable end to end
(6 screens, win receipt, embed API, analytics, a11y, audio, touch). Everything
since then has been post-launch passes: a meaning-model rebuild (§4), layout and
mobile adaptivity, an 8-bit conversion of every remaining web-native surface, the
finale rebuild, a custom 404 page and the badge work.

- **Tests:** 638 passing (48 files)
- **Bundle:** ESM 82.00 KB / IIFE 82.48 KB gzip — **the real download is 82.48 KB, 92% of the
  90 KB budget, ~7.5 KB of headroom.** The deployed site payload is **85.7 KB**. Both figures jumped
  ~8.5 KB six passes ago (the secret brick-breaker stage) and ~3.8 KB over the five since (its cannons,
  the spinning mark and the rebuilt out-of-lives panel, the Godzilla's finer grids, and now two more
  overlay surfaces plus ~40 authored strings),
  and that is the whole of the reason headroom is the thing to watch before the next art pass. The `analyze` gate reads
  **160 KB of 90 and fails**, because it sums *every* `.js` in `dist/` and so adds the two alternative
  output formats together. **This is an open owner decision, not a regression — see `docs/OPEN.md` §1.**
  Everything else is green.
- **Validator:** green on all 6 screens (structural + physics-aware + meaning layers)
- **Screen order (owner calls), and they are numbered on the frame now** — `Level 0` … `Level 4`, the Tech
  Park deliberately unnumbered because it is the arrival rather than a level: **The Head Office (0)** — an
  office lobby interior, the player's own
  building, and the one screen with **no badge** · **Setup Delays (1)** · **The Compliance Maze (2)** ·
  **The Fit-Out Trap (3)** · **Hire Under Fire (4)** · **Tech Park (5)**, whose pavement now carries a
  **secret tunnel** down to **The Engine Room** — a brick breaker (opened with the **down arrow**, and its
  mark is **thrown onto the tray by a cannon hanging off the far side wall**) that is deliberately *not* a screen
  (no months, no lives, no badge; `docs/SCREENS.md` §4.15). Local Expertise is gone (the
  Workplace replaced it outright). **Every per-screen detail is in `docs/SCREENS.md`** — the four badge
  deliveries, the maze's hoist and weather, the Godzilla, the taped figure: read the one screen you are
  touching from there, and do not summarise it back into here.
- **Next:** `docs/OPEN.md`, **in its own order** — §29 first (a transition is now four presses and five
  extra taps across a run; the cards are correct as specified and nobody has felt them on a phone, and
  the player is now steering as well since auto-run is off by default on touch), then **§32** (on a tablet
  in landscape the thumb buttons still overlay ~10% of the frame's bottom corners; closing that costs ~14%
  of its width, which is a price, not a bug) and **§33** (the art upscales by a fractional factor above
  1280px — the only remaining reason one machine looks different from another), then
  §22–25 (the secret stage has still never been held: ball
  speed, tray width, the hatch on a phone, whether a bored player should clear the wall at all, analytics,
  and the act button's third key), §30–31 (two stale authoring strings in `levels.json`; whether the levels
  should count from 1), §20 (the pickup toast — §21's key-cap legend is now **resolved**: the legend moved
  onto the briefing cards), §19 (`br_months`
  in the funnel), §18 (Setup Delays' badge is no longer takeable on the way past) and §1 (the budget
  measurement). That file owns the detail; do not restate it here. **All four capability effects are
  owner-specified and built**; the Tech Park's `SAFE_PASSAGE` badge is the only one still deliberately
  unassigned.

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
  mirrors of the root files — **update both** (they are byte-identical today; nothing enforces it).

### Verify after every task (all must be green)
```
export PATH="$HOME/.local/node/bin:$PATH"
npm run typecheck && npm run lint && npm run test && npm run build && npm run build:site && npm run validate:levels
```
`npm run analyze` prints the gzip budget report. Budgets: JS ≤ 90 KB, total ≤ 250 KB.

### You can look at the pixels — do it for any visual change
No browser here, but `@napi-rs/canvas` installs in seconds and the render modules run directly:

```
mkdir -p /tmp/brrender && cd /tmp/brrender && npm init -y && npm i @napi-rs/canvas
# set globalThis.Path2D from the package (drawAnsrLogo needs it), await import the render
# module, draw into createCanvas(1280,720), writeFileSync a PNG
"<abs>/beam-run/node_modules/.bin/tsx" shot.mts   # project's own tsx resolves TS + JSON
```
Keep it out of the project (native binary; nothing in `src/` may depend on it). DOM screens
rasterise the same way via jsdom + the real generators. **Every visual pass that skipped this
shipped a defect** invisible in the code and obvious in the image — an occluded sun, an invisible
crowd, a figure at a third of its size, and one pass a maze that was one grey slab.

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

The owner has redesigned the *meaning layer* repeatedly since launch — the lives model, then
Compliance, then the Workplace, then Hire Under Fire; structure, art direction, physics and budgets
are unchanged. Where doc 01 or `07_Analytics_and_Lead_Handoff.md` disagree, **this
section wins** — they predate every one of those revisions and still describe a no-lives model.
`analytics-events.json` matches this. Rationale for every line is in `docs/JOURNAL.md`.

**§4.1–§4.8 below are the model proper. The per-screen calls (§4.9–§4.14) are in
`docs/SCREENS.md`** — read the one screen you are touching from there.

**EVERY TRANSITION IS TWO CARDS, AND THE RUN STOPS FOR BOTH** (owner call — the one model change that
touches the flow rather than a screen, now made twice). `SCREEN_CLEAR` congratulates the stage just
**cleared** (`COPY.clearCard`, a credit plus a hand-off) and then `TITLE_CARD` briefs the stage **ahead**:
its number (`COPY.titleCard.tag`), its name, **one line** saying what it is (`COPY.titleCard.brief`) and,
on two of the six cards, the control legend. Neither times out — the only exit from each is
`Simulation.requestAdvance()`, from a mapped key or the card's own button. Two consequences before you
write anything: the next screen is **not loaded** until the congratulations card is left, so a card about
the stage behind reads `clearedScreenId` and never `screenId`; and **every headless driver now presses
twice per boundary** (`driveInput` / `stepToPlaying` in `src/test/helpers.ts`). The per-screen copy and the
two legend placements are in `docs/SCREENS.md`, the rules in `docs/INVARIANTS.md`, and how it *feels* on a
phone is `docs/OPEN.md` §29.

1. **Two stakes, one measure: months and three lives.** Clearing a screen books its `monthsBase`;
   the six sum to `ANSR_BENCHMARK_MONTHS` (11), so a clean run lands exactly on the benchmark. An
   obstacle books `SETBACK_MONTHS` (2), writes a **delay log** line and costs one of `LIVES.TOTAL`
   (3). Capped at `MAX_MONTHS` (23), always under the going-alone baseline (24).
   **The two averages — 24 and 11 — are MODEL ONLY: no player sees either, and nor do they see the
   run's absolute total, which meant nothing without them** (owner call). What is shown is the
   avoidable part, **months lost to delays**, which the player watched happen and whose best value is
   zero. Rules and the reasoning: `docs/INVARIANTS.md` ("Copy — figures a prospect can argue with");
   the funnel still scores `br_months`, which is `docs/OPEN.md` §19.
2. **A lost life restarts the SAME stage, and it now SHOWS A CARD — after the impact, never instead of
   it** (owner call, reversing the earlier "shows no screen at all"). `LIFE_LOST` books the delay and the
   first `LIVES.LOST_HOLD` (0.9s) is still exactly what it was: **no overlay**, the beat the impact is drawn
   on — the hero flat under the stamp, or wrapped in the tape — with the HUD up so the heart going out is
   visible. *Then* the per-stage **death card** comes up and waits: the system's own word for what happened
   ("Denied!", "Declined!") and, in the value orange, the one instruction this game has, aimed at this stage
   ("Take the ANSR powerup to avoid legal drama"). `COPY.deathCard`, four entries, and the four are exactly
   the screens that **carry a powerup** — on Head Office and the Tech Park it would be advice the room
   cannot obey, so those two keep the old behaviour outright (beat, then the stage restarts by itself). The
   retry always reloads the same stage, never the next screen and never screen 0.
   The generic `lifeLost.retryHint` on the retry's briefing card is **deleted, element and all**: the death
   card says the same thing louder, sooner and specifically, and printing both put the instruction on two
   consecutive surfaces (`docs/INVARIANTS.md`). **Powerup is the
   player's word for it; "badge" is internal only** (owner call — `docs/INVARIANTS.md`, `docs/OPEN.md` §27); the delay itself is still announced through the HUD's live region.
   **The cost is shown where it was paid** (owner call): the obstacle's name and `+2 MONTHS` are
   written over the body, held long enough to read, and then flown up into the delay log
   (`core/delayFlight.ts`, pure; 0.8s, inside `LOST_HOLD`; holds and fades instead of travelling under
   `prefers-reduced-motion`). It applies on every screen.
   **The last life is the exception** and the only end-of-attempt screen there is: `gameover` (§4.3).
3. **No dead ends, and nothing blames the player.** Every setback line names the *system*, by
   obstacle name. Out of lives is **three things and one route** (owner call: less text, symmetrical,
   low cognitive load): the headline — **"Business Case, Closed"**, the owner's line, and the only
   end-screen headline in the game that names a *document* rather than a state, which is the register the
   whole run has been in — **one figure — months lost to delays, drawn as a figure** — the
   argument it is evidence for, and **"Start again"**, which hands the player back to the stage that
   stopped them. The figure, its delay count and the argument are **one panel** in the win screen's own
   fill and rail (owner call this pass: the screen was not designed and its proportions were wrong —
   four ragged centred lines all at the same weight, so nothing on it was loud and nothing had mass).
   Both end screens now report the run in the same words and the same shape; the composition rules are
   in `docs/INVARIANTS.md`. The ledger, the cause line, the lives readout and the two-column split went earlier;
   **the Navigator cap went this pass** — there is now none on the start screen, this screen or the win
   receipt (owner call). Still not a dead end: the route is on the pause menu, on the mid-run summary
   and on all four capability rows, where it carries a topic instead of being a generic exit.
4. **Every screen WITH AN OBSTACLE carries an ANSR badge, ahead of the obstacles it answers, and it is
   always a jump.** **Head Office carries none** (owner call): its badge was a `SAFE_PASSAGE` mark with
   no effect, which taught the player that taking an ANSR badge changes nothing one screen before the
   one that saves them. Its three labelled steps are the tutorial. On **one** screen the badge
   levitates: a straight vertical line, ±`POWERUPS.FLOAT_AMPLITUDE` around `gy 8`,
   one cycle per `FLOAT_PERIOD` (**6.4s** — owner call, slower than the old 4.8) — topping out just
   under the HUD and bottoming out **41px above a standing head**, so it is a timed jump and never a
   walk-through (owner call). It **starts in the middle of the rail, rises, then falls** (owner call),
   which is why `badgeFloatOffset` is a `-sin` — never a `+sin`, which starts mid-rail but sinks first.
   That phase is fairness, not decoration: mid-rail-and-rising means the mark is out of reach when a
   running player passes the column, so **the last rail badge is a pickup you stop for, not a hop on
   the way past** (`docs/INVARIANTS.md` for the arithmetic, `docs/OPEN.md` §18 for the trade). On Hire Under Fire it
   is **delivered onto a floating brick** instead (`docs/SCREENS.md` §4.12) and on Compliance it
   **stands on a floating brick deck** the player can walk under (owner call — `delivery: "perch"`,
   `world/badgePerch.ts`,
   `docs/SCREENS.md` §4.9), and on the Workplace it **falls out of a ceiling spotlight** onto a floating
   cabinet and expires (owner call — `delivery: "ceiling"`, `world/badgeCeiling.ts`; the only pickup in
   the game that is *visible before it is takeable*): **four** delivery models, one rule.
   (**Rail: Setup Delays only** — Head Office's badge and the Tech Park's were both deleted.)
   Missable on purpose: that is what the
   retry title card's line is for. `POWERUPS` derives both ends of the band;
   the validator fails the build if the band dips into a standing player, if a drop or a perch has
   nothing under it, if a perch is inside standing reach, **if a perch's structure reaches the floor**
   (a badge on the path is a badge nobody chooses), if any obstacle sits at or before the badge,
   or if none sit beyond it. **Never offer a
   "do it yourself" route** — self-build is the actual competitor.
5. **Four structurally different verbs, never one reskinned shield.**
   `PLACE_TILE` slows the DENIED stamps to a walk-through pace *and* shields (1Wrk) ·
   `CLEAR_PATH` turns the compliance monsters friendly, raises their toll arms, walks them off
   the route and **clears the weather over the market** (GCC-BOT — the one capability whose "help is
   active" read is on the world rather than a halo on the hero, owner call) · `UNWRAP` hands the player a cutter and a shoot button; three hits
   free the taped-up colleague — who **throws lengths of his own tape** at anybody standing in the open
   until he is freed — and he then fixes the room (500Leaders) · `EXTINGUISH` raises a
   teal halo the hiring dragon's fire cannot touch **and** hands over a water cannon that quenches
   that fire and then strips the dragon's suit off (Talent500). All four owner-specified; the screen
   mechanics are in `docs/SCREENS.md` §4.9–§4.11.
   `UNWRAP` is the only one that gives the player a verb *instead of* changing the world, and the
   only one that does not make contact safe — it makes the obstacle *solvable*, so there is
   deliberately no bubble on that screen. `EXTINGUISH` is the only one that does **both**: the
   immunity is what buys the player time to stand still and aim, so the two halves are one mechanic
   rather than two effects bolted to one badge.
   `SAFE_PASSAGE` is the non-capability badge on the Tech Park (its only holder now), effect
   deliberately unassigned. **Help never expires** (a 5-second shield would say ANSR helps briefly then leaves).
   No badge places geometry any more.
6. **No score collectibles.** The Growth Points are gone (owner call): a second score competed with
   the only figure the game argues about, and picking one up said nothing about ANSR.
7. **The receipt is the conversion surface, and on the win screen it is now the ONLY one.** Two
   columns: what the run cost (the "months lost to delays" figure, with the itemised delays under it
   headed "What cost you") and what ANSR did (four capability rows that are Navigator links carrying a
   declared `br_topic`, each stating an outcome — "Setup stood up" — not a months-saved figure). The
   generic Navigator cap is **deleted** (§4.3), so `receiptHint` carries the instruction and "Play
   again" is the only button. Leaving mid-run shows the same receipt and keeps its Navigator cap.
   Intent is declared, never inferred.
8. **Touch players steer. One-tap auto-run is an assist option, and it is no longer the default**
   (owner call, reversing the original). The audience is executives on phones, which is why auto-run
   shipped on — but forward motion is the only thing a player controls between obstacles, so auto-run
   carried them into every hazard on a timer they had no part in setting, and "walk up to it, look at it,
   then jump" was unavailable on the platform most of this audience is on. A phone and a tablet now get a
   real pad: back and forward bottom-left, **jump** the largest target bottom-right with the armed tool
   lifted onto a diagonal beside it, and **pause** in the top band — the first route a touch player has
   ever had to the pause menu, the assist options or the way out, since a phone has no Escape key. One
   checkbox turns one-tap back on and that layout is intact (it hides *forward* only — the Compliance badge
   is reached by jumping backwards). Every size is arithmetic rather than taste, because four targets have
   to fit across a 390px frame and the shipped ones did not: `ui/touchGeometry.ts`, and the rules in
   `docs/INVARIANTS.md` under **Layout**.

---

## 5. Architecture map — moved to `docs/ARCHITECTURE.md`

Engine · world · render · ui · scripts, one line per module, with a "where to look by task"
table at the top. Read the block for the layer you are touching.

## 6. Invariants & traps — moved to `docs/INVARIANTS.md`

**Read it before editing anything.** Every expensive lesson this build has paid for — bundle traps,
DOM bitmap type, layout, gameplay, art and testing — each one a defect that shipped once. **This is
the document that is meant to grow.**

## 7. Open for the owner — moved to `docs/OPEN.md`

Thirty-one items in priority order, plus §8 (what stays in web type). Newest: **§29** (two waiting cards
per transition is **four presses** between two stages and five extra taps across a run — correct as
specified, never felt on a phone), **§30** (`copy.hint` and the `onClear` mirrors in `levels.json` now
describe a game that does not exist) and **§31** (the levels are numbered from 0). Top three: **§29 the
press count across a transition** · the budget gate's measurement · the placeholder `navigatorUrl`. Then
**§18 Setup Delays' badge is no longer takeable on the way past** (pairs with §9 screen 1 unassisted).

---

## 9. Document rotation rules

- **`docs/JOURNAL.md` is append-only and complete.** Nothing is ever deleted from it — the findings
  (what was measured, what was ruled out, why) are what stop a future session repeating a dead end.
- **This file keeps the last 3 passes** as one short paragraph each (§10). When a fourth is added the
  oldest drops off here and stays in the journal. Before an entry rotates out, any permanent rule it
  contains must already be in `docs/INVARIANTS.md`.
- **Nothing per-screen comes back into §4.** New screen detail goes to `docs/SCREENS.md`; new module
  detail to `docs/ARCHITECTURE.md`; new owner questions to `docs/OPEN.md`. This file is the router
  plus current state, and it should stay under ~250 lines / ~20 KB. It reached 592 lines / 48 KB —
  twice its own guide — before §4.9–§4.14, §5 and §7 were split out into those three docs; the
  growth was almost entirely §4 gaining a per-screen entry every pass, which is exactly what
  `docs/SCREENS.md` now absorbs.
- **§10 has been pruned back, as the last note here asked.** Its three paragraphs had crept to ~18 lines
  each when the rule is "one short paragraph"; they are now ~12, ~11 and ~9, on the principle that the
  findings are all in `docs/JOURNAL.md` and a §10 entry only has to be enough to **recognise the pass by**.
  Do the same thing again rather than letting them grow back. Nothing per-screen has come back into §4; the
  growth there is §4.2, §4.3 and §4.8, all of which are genuine model changes. If §4 keeps growing,
  §4.1–§4.8 is the next thing that wants its own doc (`docs/MODEL.md`), leaving this file as the router and
  §1–§3 alone.

---

## 10. Recent passes (newest first — full entries in `docs/JOURNAL.md`)

Three only, one short paragraph each. The findings live in the journal; anything permanent is
already in `docs/INVARIANTS.md`.

- **The shape of the box, and a real pad for the phone.** Owner: the game looks a different aspect ratio on
  different screens and OSes · add buttons for mobile and tablet and turn off auto-forward · put them where
  good games put them. The world was never distorted (the renderer's fit is uniform and tested) — the
  **box** was: the control band was gated on `@media (orientation: portrait)`, so every narrow *desktop*
  window got the phone layout (a strip of game between two empty bands) while a tablet in landscape got no
  band and had the buttons drawn on the gameplay. Now `stageClassName(isTouch)`, fed by the same
  `isTouchDevice()` that builds the controls. **Auto-run off by default on touch** (owner call, reversing
  the original) — it took away the only thing a player controls between obstacles. The pad is move
  bottom-left, jump + a **lifted** tool button bottom-right, and **pause** in the top band, which is the
  first route a touch player has ever had to the pause menu. Three measurements, three defects: four
  targets never fitted a 390px frame (396 demanded — now a `clamp` spec module, `ui/touchGeometry.ts`); the
  tallest thing in the cluster is `lift + pad`, not jump, and a lift tuned by eye put it outside the band;
  and pause centred "between the corners" landed *on* the stage plaque, because the two plaques are
  different widths — caught by the raster after the sum passed. **638 tests**, IIFE **82.48 KB**, site
  **85.70 KB**. Ten rules in `docs/INVARIANTS.md` (**Layout**), §4.8 above, §32–33 new in `docs/OPEN.md`,
  full entry in `docs/JOURNAL.md`.
- **The run learns to speak: two cards per transition, a death card per stage, the controls taught in play,
  and four stamps that stop saying the same thing.** Owner, three sets of notes — almost every word a player
  reads is now written for the surface it is on. **Two waiting cards per transition** (`SCREEN_CLEAR` then
  `TITLE_CARD`), and the load-bearing bit is that the next screen is loaded by the press that *leaves* the
  first, so a congratulations card can name the stage **behind** (`clearedScreenId`). **A lost life shows a
  screen again**, but only *after* the impact beat, on exactly the four screens with a powerup;
  `lifeLost.retryHint` deleted with its element. **The controls moved off the title screen** onto two cards
  — and two pre-built rows toggled by `hidden` put the whole guide inside *every* card, because
  `display: none` does not empty `textContent`. Levels numbered as an **eyebrow**. Set C: DENIED onto the
  stamp's **die** with each stamp naming an approval, the **PERMITS file** back under the clock (the tile is
  40px), the monsters became the **filings**, ROAR deleted. **627 tests**, IIFE **81.94 KB**.
- **The Godzilla's third resolution, and a mouth that is a jaw.** Owner: the mouth is badly shaped · reduce
  the pixel size — **one change**, because the size on screen is fixed by what a boss must be beside a
  48×60 person, so refinement is only available in the **cell**. 30×24@10 → 48×38@5 → **80×63 at scale 3**,
  the hero's own cell and therefore where it stops. What the cell bought: a tapered mouth line with
  interlocking teeth, an overbite and a lit chin; a skull lit **down its own contour** per column; plates
  re-cut as **leaves**; a mandible with mass. A curve in the mouth line was reverted — a step in a tooth row
  rasterises as two teeth that have fallen out. The costume came with it (they cross-fade together).
  **619 tests**, IIFE **80.62 KB**. Twenty rules in `docs/INVARIANTS.md`.
