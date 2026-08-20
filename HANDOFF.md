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

- **Tests:** 544 passing (45 files)
- **Bundle:** ESM 68.4 KB / IIFE 68.9 KB gzip — **the real download is 68.9 KB, 77% of the
  90 KB budget.** The deployed site payload is **72.4 KB**. The `analyze` gate reads **~137 KB of 90 and
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
- **Next:** resolve `docs/OPEN.md` §1 (the budget measurement), then no queued task. **All four
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

1. **Two stakes, one measure: months and three lives.** Clearing a screen books its `monthsBase`;
   the six sum to `ANSR_BENCHMARK_MONTHS` (11), so a clean run lands exactly on the benchmark. An
   obstacle books `SETBACK_MONTHS` (2), writes a **delay log** line and costs one of `LIVES.TOTAL`
   (3). Capped at `MAX_MONTHS` (23), always under the going-alone baseline (24).
2. **A lost life restarts the SAME stage and SHOWS NO SCREEN** (owner call). `LIFE_LOST` still books
   the delay, but with lives left the host paints **no overlay**: the state is the beat the impact is
   drawn on (`LIVES.LOST_HOLD` 0.9s — the hero flat under the stamp, or wrapped in the tape), the HUD
   stays up so the heart going out is visible, and then the stage restarts from its own title card,
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
   one that saves them. Its three labelled steps are the tutorial. On three screens the badge
   levitates: a straight vertical line, ±`POWERUPS.FLOAT_AMPLITUDE` around `gy 8`,
   one cycle per `FLOAT_PERIOD` (**6.4s** — owner call, slower than the old 4.8) — topping out just
   under the HUD and bottoming out **41px above a standing head**, so it is a timed jump and never a
   walk-through (owner call). It **rises first and then falls**, which is why `badgeFloatOffset` is a
   cosine: it starts at the bottom of the band, i.e. at its most reachable on the frame the screen
   starts (owner call — do not flip it back to a sine, see `docs/INVARIANTS.md`). On Hire Under Fire it
   is **delivered onto a floating brick** instead (`docs/SCREENS.md` §4.12) and on Compliance it
   **stands on a floating brick deck** the player can walk under (owner call — `delivery: "perch"`,
   `world/badgePerch.ts`,
   `docs/SCREENS.md` §4.9), and on the Workplace it **falls out of a ceiling spotlight** onto a floating
   cabinet and expires (owner call — `delivery: "ceiling"`, `world/badgeCeiling.ts`; the only pickup in
   the game that is *visible before it is takeable*): **four** delivery models, one rule.
   (Rail screens: 1 and the Tech Park.) Missable on purpose: that is what the
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

Sixteen items in priority order, plus §8 (what stays in web type). Top three: the budget gate's
measurement · the placeholder `navigatorUrl` · screen 1 unassisted, played by hand.

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

- **Hire Under Fire, rebuilt: a Godzilla out of smaller cells, a jet instead of a girder, one brick, and an ending you can walk out of.**
  Eight owner notes, and two pairs of them were single decisions. **"Smaller" and "more refined" are the same
  change**: 300×240 at a 10px cell → **230×190 at a 5px cell** (720 cells → 1,748), because at 20 cells across an
  animal a leg is two cells and every curve is a stair — which is what "blocks of red colour" describes. That
  bought a blocky skull, a real neck, four *separated* dorsal plates (merged they read as fur, stood off the back
  as flags), a tail that lies flat instead of tapering to a blade, and hide bands instead of polka dots.
  **"One brick" and "a slower drone" are also one change**: a slower drone releases later, so the surviving column
  has to be one an auto-runner has not passed — **gx 16 at a 3.4s crossing** keeps the full 0.40s one-tap window
  where the old gx 13 falls off the cliff, and `FALL_TIME` went 0.55 → 0.35 because the fall spends exactly the
  lead the crossing buys. The fire is **70→120px** instead of 120→190, which *lengthened* `CONE_REACH` to 620 (a
  thinner cone meets a standing head later along its own axis), and it is painted **per column from the hitbox's
  own arithmetic** rather than from its bounding boxes — the distinction that turned an orange girder into a jet.
  Cannon and jets rebuilt for the same note: a flared bell to a dark aperture, a stream of cells rather than five
  squares. The ending is a **sequence** now — topple, a costume that **unzips**, five hires walking out one at a
  time, then the suit vanishing — because a creature that dissolves leaves nothing that can be opened. The screen
  comes good on `Dragon.relief`, and the hero **burns**: the fourth death pose and the first that is a *process*,
  hence `Simulation.lifeLostProgress`. **544 tests**; the raster found a blindfold, a girder, a white flag on a
  stick, polka dots and an orange box with a head on top. Detail: `docs/SCREENS.md` §4.11–§4.12.
- **The Workplace, third look: he throws, the badge falls out of a spotlight, and the room came off the teal axis.**
  Six owner notes, four jobs. The figure **throws his bandages** (0.55s wind-up, one roll in the air, at shin
  height so the answer is a jump) and the **partition wall is cover** — a roll dies against a solid and he will
  not even wind up at somebody behind one, which is what makes the badge's side of that wall safe (winnability
  re-measured: best 9/12, every win clean, and the dodge is *late*). The **rail is gone**: the mark hangs in a
  ceiling **spotlight** for 3.2s, visible and untakeable, then drops onto a **floating cabinet** and expires — a
  fourth delivery model, and the fourth time a rule phrased in terms of the rail had to name the deliveries it
  applies to. That cabinet moved the **partition to gx 7**, because at gx 6 a pinned player stood under it with
  36px of jump against the 80 he needed, i.e. the screen was sealed. The room lost a work pod and went **off the
  teal axis** (warm plaster and furniture, a cool ceiling so it is not a sepia filter). The raster found five
  defects the code could not, including a spotlight that was a box and a mark hanging from nothing. **530 tests.**
- **The Workplace again: two tapes, a body with joints, a patroller instead of a respawn, fire for ammunition.**
  Six owner notes. The figure's tape went **red** (alpha was never going to fix nine yellow shapes plus one yellow
  figure) and his 20×26 grid was **re-authored with joints** — a 6-row head, a neck, a stepped shoulder, a waist,
  two legs with a *transparent* column between them. He **paces to and fro** now, which deleted the screen's own
  winnability argument and re-earned it by probe (**10/12 clean, blind sprint 0/12**, the move being to jump him
  head on). Ammunition is a **fire orb** that leaves a permanent soot mark; the cutter went to a **mid** value
  because dark vanished into the furniture it is held in front of; the floor came off the teal axis and the lowest
  wall register went darkest, since the hero cannot be tuned for one screen. **508 tests.**
