# ANSRcade: The GCC Game — Handoff (current state)

> **Read §1–§4 of this file, then the ONE section file your task touches.** This file is the
> router and the current state; the detail lives in four companion docs so a session does not
> pay to load all of it.

## Where things are — read only what the task needs

| Doc | Holds | Read it when |
|---|---|---|
| **`HANDOFF.md`** (this) | status · environment · locked defaults · the model proper (§4.1–§4.8) · recent passes | **always, first** |
| **`docs/INVARIANTS.md`** | every rule and trap this build paid for, each one a defect that shipped once | **before editing anything** |
| **`docs/SCREENS.md`** | the per-screen model, §4.9–§4.14 (Reception · Setup Delays · Compliance · Workplace · Hire Under Fire) | touching one screen's gameplay, art or hazard |
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

- **Tests:** 566 passing (45 files)
- **Bundle:** ESM 70.8 KB / IIFE 71.3 KB gzip — **the real download is 71.3 KB, 79% of the
  90 KB budget.** The deployed site payload is **73.8 KB**. The `analyze` gate reads **~138 KB of 90 and
  fails**, because it sums *every* `.js` in `dist/` and so adds the two alternative output formats
  together. **This is an open owner decision, not a regression — see `docs/OPEN.md` §1.**
  Everything else is green.
- **Validator:** green on all 6 screens (structural + physics-aware + meaning layers)
- **Screen order (owner calls):** Reception (an office lobby interior, and the one screen with
  **no badge**) · **Setup Delays (1)** · **Compliance (2)** · **Workplace (3)** ·
  **Hire Under Fire (4)** · Tech Park (5). Compliance was rebuilt from scratch as a staircase maze and
  then refined: its badge **stands on a brick wall** (no rail), the long brown platform is a **rising
  hoist**, and its badge clears the **weather** instead of putting a halo on the hero;
  **Local Expertise is gone** — the Workplace screen replaced it outright and took the slot after
  Compliance; Hire Under Fire is a **boss fight against a Godzilla in glasses**, rebuilt smaller out of a finer
  cell, with a narrower jet, **one** badge brick, a slower drone and an ending its costume opens; the Workplace
  figure **throws his bandages** and that screen's badge **falls out of a ceiling spotlight** onto a floating
  cabinet on the safe side of its partition wall. Detail for all of these: `docs/SCREENS.md`.
- **Next:** `docs/OPEN.md` **§18 — an owner decision this pass created**: Setup Delays' badge starts
  mid-rail now (owner call), so it can no longer be taken on the way past; confirm that trade, since
  1Wrk is what makes screen 1 survivable. Then §1 (the budget measurement). **All four
  capability effects are owner-specified and built**; the Tech Park's `SAFE_PASSAGE` badge is the
  only one still deliberately unassigned (Reception's was deleted with its badge).

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
2. **A lost life restarts the SAME stage and SHOWS NO SCREEN** (owner call). `LIFE_LOST` still books
   the delay, but with lives left the host paints **no overlay**: the state is the beat the impact is
   drawn on (`LIVES.LOST_HOLD` 0.9s — the hero flat under the stamp, or wrapped in the tape), the HUD
   stays up so the heart going out is visible, and then the stage restarts from its own title card —
   which is now a **briefing that waits for a press** (see above; `docs/OPEN.md` §10),
   never the next screen and never screen 0. The card carries **one orange line, "TAKE THE ANSR
   BADGE"** (`Simulation.retrying` → `COPY.lifeLost.retryHint`), which is all that survives of the
   deleted coaching overlay; the delay itself is still announced through the HUD's live region.
   **The cost is shown where it was paid** (owner call): the obstacle's name and `+2 MONTHS` are
   written over the body, held long enough to read, and then flown up into the delay log
   (`core/delayFlight.ts`, pure; 0.8s, inside `LOST_HOLD`; holds and fades instead of travelling under
   `prefers-reduced-motion`). It applies on every screen.
   **The last life is the exception** and the only end-of-attempt screen there is: `gameover` (§4.3).
3. **No dead ends, and nothing blames the player.** Out of lives lands on a conversion surface, the
   same as reaching the Tech Park. Every setback line names the *system*, by obstacle name.
   That screen is **four things on one centre line** (owner call: less text, symmetrical, low
   cognitive load): the headline, one figure ("3 DELAYS COST 6 MONTHS"), the argument it is evidence
   for, and two single-line routes (Start again · GCC Opportunity Navigator). The itemised ledger,
   the cause line, the lives readout and the two-column split are all **deleted** — the same
   breakdown is on the closing receipt, where it is read rather than skipped.
4. **Every screen WITH AN OBSTACLE carries an ANSR badge, ahead of the obstacles it answers, and it is
   always a jump.** **Reception carries none** (owner call): its badge was a `SAFE_PASSAGE` mark with
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
   (**Rail: Setup Delays only** — Reception's badge and the Tech Park's were both deleted.)
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
7. **The receipt is the conversion surface.** Months, two *attributed* reference lines, the delay
   summary, and four capability rows that are Navigator links carrying a declared `br_topic`.
   Leaving mid-run shows the same receipt. Intent is declared, never inferred.
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

Eighteen items in priority order, plus §8 (what stays in web type). Top three: **§18 Setup Delays'
badge is no longer takeable on the way past** (new this pass, and it pairs with §9 screen 1
unassisted) · the budget gate's measurement · the placeholder `navigatorUrl`.

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

- **The last rail badge starts mid-rail, and that one character turns a pass-jump into a wait.**
  Owner: Setup Delays' powerup should "start from the middle of the rail and then go up and then down".
  `badgeFloatOffset` went `+A·cos` → `−A·sin` (not `+sin` — that also starts mid-rail but *sinks* first,
  the shape ruled out twice); the band is untouched, and this is the only rail badge left in the game,
  so no per-screen switch was needed. The cost is arithmetic, not feel, and the suite found it on the
  first run: a forward-only auto-runner is under gx 4 at **t=0.40s**, when the mark hangs **255px over
  his head against a 140px jump**, and the band's bottom does not return until **4.80s** — he is at the
  exit. **0 of 60 tap frames** take it now, where there was a contiguous 0.35s window; standing under
  the column and tapping collects it at **3.65s**. No third option exists (a mid-rail start that is low
  again by 0.40s needs ~390 px/s, and the owner asked for *slower*), so screen 1's rail is now the same
  *kind* of pickup as the Compliance perch and the two tests say exactly that. Rasterised at
  0/P⁄4/P⁄2/3P⁄4: 340 → 185 → 340 → 495. **566 tests.** The trade is `docs/OPEN.md` §18 and it
  compounds §9. Full entry: `docs/JOURNAL.md`.
- **The card between two screens becomes a briefing, and the run stops for it.**
  Half of the owner's note already existed: `TITLE_CARD` has sat between every pair of screens since the first
  session, but it printed a *stage name*, held 1.2s and advanced itself — so the run walked into five screens it
  had never explained, and the one coaching line it sometimes carried ("TAKE THE ANSR BADGE", all that survives of
  the deleted life-lost overlay) had a second and a half on the frame after a death. It **waits** now: one line
  per screen, a Continue cap, `role="dialog"` with focus like every other overlay, and no timeout —
  `requestAdvance()` is the single exit, keeping only the 0.4s grace, because the press that opens the card must
  not also skip it. **The briefs were then rewritten** (owner: "give the basic real life idea without saying
  so"): the first set described mechanics — "a staircase of queries", "he throws his tape" — i.e. told the player
  what they were about to see for themselves. They name the real programme risk now, in the language of the room
  ("nothing here is approved the first time" · "the team is ready, the floor is not" · "doors open, and a year
  still in hand"), under three tested rules: no product name, no instruction, no word echoed from the stage name
  above. Length is measured, not felt: at ~60 characters all six wrapped to a third line holding their own last
  word over a centred button, hence a 26-char measure and ≤50 chars of copy. **Everything else was caught by the
  raster and could not have been caught in the code** — CONTINUE printed on the cap and again under it, then
  COMPLIANCE over "compliance does not…" and WORKPLACE over "the workplace is not". The card's keyboard prompt is
  **gone**, in two versions: the second read as a quieter second button drawn on the first, and a focused cap
  already answers Space. The real cost landed in the **drivers**: every
  `while (state !== 'PLAYING') step(neutral)` loop now sits on the card and asserts against a run that never
  started, so `helpers.ts` gained `driveInput`/`stepToPlaying` and six were converted. **565 tests.** Owner call
  outstanding: whether a *retry* should wait too (`docs/OPEN.md` §10).
- **The game learns to make a noise that is not a beep: filtered noise, eleven cues, and the four screens that had nothing to say.**
  Four owner notes with one defect under all of them — **this engine had no noise source**, so every cue was
  oscillators, and a thud, a jet of water, an electrical arc and cloth through air *have no pitch*. `AudioEngine`
  gained `noise()` (looped white-noise buffer through a frequency-ramped biquad — opening upward is something
  leaving, closing downward something settling), with that half of `AudioContextLike` **optional** so no cue may
  *be* its noise. On top of it: **two stamp thuds that are the same object**, the muffled one being the floor
  thud with its transient and top end removed (the mechanism *failing*, not a different sound) and both weighted
  by distance, because four columns land every 1.4s and one volume is a drum machine — which is what
  `playSfx(cue, level)` is for; a **badge cue rebuilt as a reward** instead of two beating blips; **five cues for
  the Workplace**, which had none, the groan on the *wind-up* not the release and the chime on the same 0.5 the
  renderer prints OK at; and a **`topple`**, the dragon's fall having had no cue at all. Cues were **measured**:
  `node-web-audio-api` offline, peak/RMS/Goertzel per cue, which found the noise layers 2–3× too quiet and cost
  two dead runs to an offline context that reports `suspended` forever and a `resume()` that never settles.
  **560 tests.** Detail: `docs/SCREENS.md` (what each screen sounds like) and `docs/INVARIANTS.md`.
