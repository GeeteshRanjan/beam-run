# Locked decisions & the model — read before touching gameplay

Moved verbatim from `HANDOFF.md` §3–§4 on 2026-09-29. Section numbers are kept, so any
"HANDOFF §3" / "§4.1–§4.8" reference elsewhere means this file. Per-screen detail
(§4.9–§4.15) is `docs/SCREENS.md`. List headings first: `grep -n '^#\|^[0-9]\. \*\*' docs/MODEL.md`.

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
   ("Denied!", "Declined!") and, in white under the turning ANSR sunburst it names, the one instruction this game has, aimed at this stage
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
   teal halo the hiring dragon's fire cannot touch (nor its stomp — it still stomps a haloed player,
   harmlessly; added 2026-09-29) **and** hands over a water cannon that quenches
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
   headed "What cost you") and what ANSR did (four **read-only** capability rows, each stating an
   outcome — "Setup stood up" — not a months-saved figure). The rows were Navigator links carrying a
   declared `br_topic` under a "Pick one to talk about." hint until 2026-09-29, when the owner made them
   unclickable and the hint went with them. The generic Navigator cap is **deleted** (§4.3), so "Play
   again" is the only button and **the win screen has no Navigator route**. Leaving mid-run shows the
   same receipt and keeps its Navigator cap.
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
