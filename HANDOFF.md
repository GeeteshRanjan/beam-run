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

- **Tests:** 462 passing (43 files)
- **Bundle:** ESM 60.0 KB / IIFE 60.4 KB gzip — **the real download is 60.4 KB, 67% of the
  90 KB budget.** The deployed site payload is **63.2 KB**. The `analyze` gate reads **~117 KB of 90 and
  fails**, because it sums *every* `.js` in `dist/` and so adds the two alternative output formats
  together. **This is an open owner decision, not a regression — see `docs/OPEN.md` §1.**
  Everything else is green.
- **Validator:** green on all 6 screens (structural + physics-aware + meaning layers)
- **Screen order (owner calls):** Reception (an office lobby interior, and the one screen with
  **no badge**) · **Setup Delays (1)** · **Compliance (2)** · **Workplace (3)** ·
  **Hire Under Fire (4)** · Tech Park (5). Compliance was rebuilt from scratch as a staircase maze;
  **Local Expertise is gone** — the Workplace screen replaced it outright and took the slot after
  Compliance; Hire Under Fire is now a **boss fight against a dragon in a tie and glasses**. Detail
  for all of these: `docs/SCREENS.md`.
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
   one that saves them. Its three labelled steps are the tutorial. On four screens the badge
   levitates: a straight vertical line, ±`POWERUPS.FLOAT_AMPLITUDE` around `gy 8`,
   one cycle per `FLOAT_PERIOD` (**6.4s** — owner call, slower than the old 4.8) — topping out just
   under the HUD and bottoming out **41px above a standing head**, so it is a timed jump and never a
   walk-through (owner call). It **rises first and then falls**, which is why `badgeFloatOffset` is a
   cosine: it starts at the bottom of the band, i.e. at its most reachable on the frame the screen
   starts (owner call — do not flip it back to a sine, see `docs/INVARIANTS.md`). On Hire Under Fire it
   is **delivered onto a floating brick** instead (`docs/SCREENS.md` §4.12) — same rule, different
   question. (Four rail screens: 1, 2, 3 and the Tech Park.) Missable on purpose: that is what the
   retry title card's line is for. `POWERUPS` derives both ends of the band;
   the validator fails the build if the band dips into a standing player, if a drop has nothing under
   it, if any obstacle sits at or before the badge, or if none sit beyond it. **Never offer a
   "do it yourself" route** — self-build is the actual competitor.
5. **Four structurally different verbs, never one reskinned shield.**
   `PLACE_TILE` slows the DENIED stamps to a walk-through pace *and* shields (1Wrk) ·
   `CLEAR_PATH` turns the compliance monsters friendly, raises their toll arms and walks them off
   the route (GCC-BOT) · `UNWRAP` hands the player a cutter and a shoot button; three hits
   free the taped-up colleague, who then fixes the room (500Leaders) · `EXTINGUISH` raises a
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

- **The Workplace, refined: an office that is broken *and lit*, and a mummy made of cloth.** The
  raster said two things the code did not — the room had **one value** (wall, dividers, cabinets and
  terminal all within two steps, so the bottom third was an indistinct field) and **"restored" looked
  like "broken"**. `scenery.ts` now authors the room **as the fix leaves it** and `render/workplace.ts`
  lays the damage over it from `restore`, sharing exported geometry; furniture went *darker* than the
  wall with one lit edge each; the four gradient wedges became a lit diffuser, a **seven-step floor
  pool** and up-facing edges, with two fittings holding and two striking. Clumsy is now ceiling tiles
  out, a tile hanging by a corner, a bucket under a stain, a chair over, drawers open and notices
  taped to the wall; the payoff is four pools, live monitors, two colleagues back at their desks and a
  full-frame wash. The figure is **cloth-first** (seams every other row, tape cut to one-cell bands, a
  fist on the reach, 3px of empty hitbox instead of 9). **462 tests**; the new
  `render/workplace.test.ts` caught two live defects — a ceiling hole 4px inside a light's aperture,
  and caution yellow at full alpha in a layer the fix does not reach.
- **Docs audit: this file became a router.** It was 592 lines / 48 KB — 2.4× its own cap — and a
  mandatory read every session (~12k tokens). §4.9–§4.14, §5 and §7 moved verbatim to
  `docs/SCREENS.md`, `docs/ARCHITECTURE.md` and `docs/OPEN.md`; §10's entries were cut to ~6 lines
  each. **241 lines / 17 KB now**, ~7k tokens saved per session. `docs/INVARIANTS.md` got a
  five-group index (Gameplay is ~70% of it — split per screen if it grows). The hygiene sweep found
  **no dead code and no stale tracked files**, but three things worth knowing: **45 files are
  uncommitted** (the maze, the dragon, the Workplace, the lives model *and* `docs/INVARIANTS.md`
  are all unversioned — `HEAD` is still `4c9461d`) · the root/`src/data` copies of
  `tuning.config.ts` + `levels.json` are byte-identical with **nothing enforcing it** · the steering
  file exists **twice** by design, so edit both. The root `index.html` looks stale and is not — it
  is the host-embed demo.
- **The exodus is a walk now, and descents drop instead of floating.** `GATHER_SPEED` 420 → **160**
  (bracketed by things already on screen: above the creatures' own `SPEED_MAX` 132, well under the
  player's 260), so taking the badge sends five obstacles home over ~4s instead of deleting them in
  1.77s. Slowing it exposed a second defect: `walkHome` moved both axes at one speed, so LEGAL's and
  AUDIT's pure-vertical descents read as *floating* — the leftover vertical part of a descent now
  falls at a new `GATHER_DROP_SPEED` (420). **451 tests**; the new one measures frames with a fixture
  shaped like LEGAL's real route, because the existing `STAIR` fixture never produces a pure drop.
