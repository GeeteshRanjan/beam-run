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

- **Tests:** 616 passing (48 files)
- **Bundle:** ESM 79.47 KB / IIFE 79.99 KB gzip — **the real download is 79.99 KB, 89% of the
  90 KB budget, ~10 KB of headroom.** The deployed site payload is **82.9 KB**. Both figures jumped
  ~8.5 KB four passes ago (the secret brick-breaker stage) and ~1.9 KB over the three since (its cannons,
  then the spinning mark and the rebuilt out-of-lives panel),
  and that is the whole of the reason headroom is the thing to watch before the next art pass. The `analyze` gate reads
  **151 KB of 90 and fails**, because it sums *every* `.js` in `dist/` and so adds the two alternative
  output formats together. **This is an open owner decision, not a regression — see `docs/OPEN.md` §1.**
  Everything else is green.
- **Validator:** green on all 6 screens (structural + physics-aware + meaning layers)
- **Screen order (owner calls):** **Head Office (0)** — an office lobby interior, the player's own
  building, and the one screen with **no badge** · **Setup Delays (1)** · **Compliance (2)** ·
  **Workplace (3)** · **Hire Under Fire (4)** · **Tech Park (5)**, whose pavement now carries a
  **secret tunnel** down to **The Engine Room** — a brick breaker (opened with the **down arrow**, and its
  mark is **thrown onto the tray by a cannon hanging off the far side wall**) that is deliberately *not* a screen
  (no months, no lives, no badge; `docs/SCREENS.md` §4.15). Local Expertise is gone (the
  Workplace replaced it outright). **Every per-screen detail is in `docs/SCREENS.md`** — the four badge
  deliveries, the maze's hoist and weather, the Godzilla, the taped figure: read the one screen you are
  touching from there, and do not summarise it back into here.
- **Next:** `docs/OPEN.md`, **in its own order** — §22–25 (the secret stage has still never been held: ball
  speed, tray width, the hatch on a phone, whether a bored player should clear the wall at all, analytics,
  and the act button's third key), then §20–21 (the pickup toast and the key-cap legend), §19 (`br_months`
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

**Every screen is introduced by a briefing card, and the run stops for it** (owner call — the one model
change that touches the flow rather than a screen). `TITLE_CARD` prints the stage name plus **one line**
saying what the stage is (`COPY.titleCard.brief`; the six are in `docs/SCREENS.md`) and **does not time
out** — the only exit is `Simulation.requestAdvance()`, from a mapped key or the card's Continue button.
Consequence before you write anything: **every headless driver has to press** (`driveInput` /
`stepToPlaying` in `src/test/helpers.ts`). Rules in `docs/INVARIANTS.md`; the retry card waits too, which
is `docs/OPEN.md` §10.

1. **Two stakes, one measure: months and three lives.** Clearing a screen books its `monthsBase`;
   the six sum to `ANSR_BENCHMARK_MONTHS` (11), so a clean run lands exactly on the benchmark. An
   obstacle books `SETBACK_MONTHS` (2), writes a **delay log** line and costs one of `LIVES.TOTAL`
   (3). Capped at `MAX_MONTHS` (23), always under the going-alone baseline (24).
   **The two averages — 24 and 11 — are MODEL ONLY: no player sees either, and nor do they see the
   run's absolute total, which meant nothing without them** (owner call). What is shown is the
   avoidable part, **months lost to delays**, which the player watched happen and whose best value is
   zero. Rules and the reasoning: `docs/INVARIANTS.md` ("Copy — figures a prospect can argue with");
   the funnel still scores `br_months`, which is `docs/OPEN.md` §19.
2. **A lost life restarts the SAME stage and SHOWS NO SCREEN** (owner call). `LIFE_LOST` still books
   the delay, but with lives left the host paints **no overlay**: the state is the beat the impact is
   drawn on (`LIVES.LOST_HOLD` 0.9s — the hero flat under the stamp, or wrapped in the tape), the HUD
   stays up so the heart going out is visible, and then the stage restarts from its own title card —
   which is now a **briefing that waits for a press** (see above; `docs/OPEN.md` §10),
   never the next screen and never screen 0. The card carries **one orange line, "TAKE THE ANSR
   POWERUP"** (`Simulation.retrying && screenHasPowerup` → `COPY.lifeLost.retryHint`), which is all that
   survives of the deleted coaching overlay — and it is **not printed on the two screens that carry no
   mark** (Head Office, Tech Park), where it would be advice the room cannot obey — and it is on the
   retry's card and **nowhere else**, which took a stylesheet fix this pass: for several passes it leaked
   onto the briefing card of every screen after the first death (`docs/INVARIANTS.md`). **Powerup is the
   player's word for it; "badge" is internal only** (owner call — `docs/INVARIANTS.md`, `docs/OPEN.md` §27); the delay itself is still announced through the HUD's live region.
   **The cost is shown where it was paid** (owner call): the obstacle's name and `+2 MONTHS` are
   written over the body, held long enough to read, and then flown up into the delay log
   (`core/delayFlight.ts`, pure; 0.8s, inside `LOST_HOLD`; holds and fades instead of travelling under
   `prefers-reduced-motion`). It applies on every screen.
   **The last life is the exception** and the only end-of-attempt screen there is: `gameover` (§4.3).
3. **No dead ends, and nothing blames the player.** Every setback line names the *system*, by
   obstacle name. Out of lives is **three things and one route** (owner call: less text, symmetrical,
   low cognitive load): the headline, **one figure — months lost to delays, drawn as a figure** — the
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
8. **One-tap auto-run is the default on touch.** The audience is executives on phones.

---

## 5. Architecture map — moved to `docs/ARCHITECTURE.md`

Engine · world · render · ui · scripts, one line per module, with a "where to look by task"
table at the top. Read the block for the layer you are touching.

## 6. Invariants & traps — moved to `docs/INVARIANTS.md`

**Read it before editing anything.** Every expensive lesson this build has paid for — bundle traps,
DOM bitmap type, layout, gameplay, art and testing — each one a defect that shipped once. **This is
the document that is meant to grow.**

## 7. Open for the owner — moved to `docs/OPEN.md`

Twenty-eight items in priority order, plus §8 (what stays in web type). Newest: **§28** (the powerup's
spin rate and the size of its tone lift — both built, neither ever seen in motion), **§26** (the Head Office
name is on the frame twice) and **§27** (every player-facing string says *powerup*, every identifier still
says *badge*). Top three: **§18 Setup Delays' badge is no longer
takeable on the way past** (pairs with §9 screen 1 unassisted) · the budget gate's measurement · the
placeholder `navigatorUrl`.

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

---

## 10. Recent passes (newest first — full entries in `docs/JOURNAL.md`)

Three only, one short paragraph each. The findings live in the journal; anything permanent is
already in `docs/INVARIANTS.md`.

- **The Godzilla is rebuilt from reference, and its ending is rebuilt with it.** Owner, one note in five
  parts plus two reference rasters; all presentation, so `world/` and `data/` are untouched. Two procedural
  attempts made it *worse* (plates anchored to "leftmost cell in this row" float beside the body, because on
  every tail row that cell is a tail column), so the approach changed rather than the numbers: authored in a
  **throwaway generator** against a PNG and pasted in as a literal — 48×38 at scale 5, brow shelf, plates
  continuing as **triangles** down the tail, belly cut back to an abdomen (it read as a sash). The topple is
  a real **pivot**, whose first cut was a *speckled, half-transparent* beast until every cell was grown by
  `ceil(scale × (|cos|+|sin|))`. The costume opens as a shaped **side hatch with two peeled lips**; the five
  hires are **five distinct sprites** with alternating arms and hands; the flame gained a wandering mid body
  and a **broken** core. **616 tests**, IIFE **79.99 KB**, site **82.90 KB**. Ten rules in
  `docs/INVARIANTS.md`, §4.11 in `docs/SCREENS.md`, full entry in `docs/JOURNAL.md`.
- **The hint stops following the player, out of lives gets a shape, the secret stage gets a name, and the
  mark turns.** Owner, four notes. The retry line sat on **every** briefing card after the first death and
  the model was innocent: `[hidden]` is a UA rule and loses to `.beam-run__advice { display: flex }`, so
  `el.hidden = true` changed nothing (one scoped `!important` rule as the **last line of the stylesheet** —
  jsdom cascades by source order, so higher up it was right per spec and unprovable — plus clearing the
  text). **Out of
  lives** was four ragged centred lines with its one fact set as a *sentence*; it is the win screen's
  vocabulary now — caption, one panel, big orange numeral, "From 3 delays." as small print, argument
  divided off — at a **440** column, because at 560 the rail left 110px of empty box either side of its
  widest line. `gameOver.cost()` and `PX_TYPE.advice` deleted. **The Growth Floor is THE ENGINE ROOM**
  ("growth" is the word every deck uses; "floor" was office vocabulary on a room that is visibly plant),
  line **LIVE IS DAY ONE, NOT THE FINISH**, symbols renamed with it. **The mark spins** — 0.3 rev/s as a
  pickup, 1.2 in the secret room, ceiling ~1.9 because the sunburst repeats every 11.25° — in a lifted
  brand orange, and **the first cut rasterised dimmer than what it replaced**, because a rotated
  one-pixel ray spreads over two columns at partial coverage. Paid for with a second fill of the same
  path. **616 tests**, IIFE **79.35 KB**, site **81.61 KB**. Nine rules in `docs/INVARIANTS.md`, §4.15
  extended in `docs/SCREENS.md`, full entry in `docs/JOURNAL.md`.
- **The wall says where you are, the powerup is called a powerup, and the broken room can be heard.** Owner,
  five notes, four of them copy and no geometry touched. Head Office's directory board reads **HEAD OFFICE**
  instead of "MARKET ENTRY: ON PAPER" (a sign names the place; the verdict was already made twice on that
  screen — and the HUD now says it too, which is accepted and flagged as **§26**). The Workplace brief was
  **true one screen too early** — "the team is ready" promises people the run recruits on *stage 4* — and is
  now "The lease is signed. Nothing works yet." (39 chars, wraps 20/18, tested). Every player-facing string
  says **powerup**; nothing in `src/` was renamed, which is the deliberate split in **§27**. The retry card's
  line is gated on the new `Simulation.screenHasPowerup`, because **two screens carry no mark** and there
  "take the ANSR powerup" is advice the room cannot obey. Two asks were already built and both were wrong
  anyway: **the `spark` cue was wired, tested, documented and inaudible** — a 120 Hz square plus three 35ms
  **Q-4** bursts at 3–4.8 kHz, i.e. the two bands a laptop speaker does not reproduce. Rebuilt as a snap
  with a tail. There is **no raster equivalent for sound**. **613 tests**, IIFE **79.09 KB**, site
  **81.40 KB**. Six rules in `docs/INVARIANTS.md`, §26–27 in `docs/OPEN.md`, full entry in
  `docs/JOURNAL.md`.

