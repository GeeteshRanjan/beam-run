# Open for the owner (unresolved, in priority order)

This was §7 and §8 of `HANDOFF.md`. Nothing here is a bug to go and fix unprompted — each item is
either a decision the owner owes, or a thing only a hand on a real device can answer. When one is
resolved, delete it from here and record the resolution in `docs/JOURNAL.md`.

**New this pass:** §26 (the Head Office name is on the frame twice) · §27 (the code says badge, the
player reads powerup).

**Top three:** §18 screen 1's badge is no longer a pass-jump (new, and it pairs with §9) ·
§1 the budget gate's measurement · §2 the placeholder `navigatorUrl`. Then §9, screen 1 unassisted
played by hand.

---

1. **The budget gate is red, and the question is how it measures — decide before the next art pass.**
   `scripts/check-budget.mjs` sums **every** `.js` in `dist/`, so it adds `beam-run.esm.js` and
   `beam-run.iife.js` together. Doc 09 lists those as *alternative* outputs (ESM for the React
   import, IIFE for `window.BeamRun.mount`) and a host loads exactly one. So:
   - **Real download: 58.2 KB gzipped — 65% of the 90 KB budget, ~32 KB of headroom.**
   - **Summed figure: 113.2 KB of 90 → the gate fails.**
   - Neither figure covers the deployed page, which the gate does not measure at all: `dist-site` is
     **58.8 KB** gzipped. Whatever is decided here, the gate should measure that file too.
   The Workplace screen added ~4.5 KB gz per payload and the dragon another ~7.2 KB. Trimming was
   explored on the Workplace pass: hoisting every repeated hex literal in a render module recovers
   ~0.5 KB, so closing the summed gate means deleting most of two screens' art. Two options:
   **(a) measure the largest single payload** (recommended — one line, still fails at 90 KB, and it
   is what "JS (gzipped) ≤ 90 KB" means for a host); **(b) keep the sum and cut art back.** Nothing
   was changed unilaterally: the gate and the art are both exactly as described. Everything else in
   the verify list is green.
2. **`navigatorUrl` is still the placeholder `/gcc-opportunity-navigator`** (in `main.ts` and
   `DEFAULT_OPTIONS`). Every CTA in the game lands on our own 404 page until it points at the real
   GCC Opportunity Navigator, or a Vercel rewrite is added. Highest-value fix outstanding.
3. Does the Navigator accept a parameter that **pre-selects a stage**? If so, wire `br_topic` to it.
4. **Screen 4's badge now needs a jump on touch, and that is the biggest live risk on the screen.**
   The badge lands on a floating brick (owner call), so an auto-run player who used to collect it by
   walking into it must now tap jump — and he gets **one chance**, because by the time the second
   delivery arrives (4.8s later) an auto-runner has left the frame. The swept-tap gate in
   `screen4.test.ts` proves the window is one contiguous ≥0.3s band inside the first delivery's life,
   so it is makeable; whether it is *discoverable* on a phone is untested by anything but that probe.
   If telemetry shows screen 4 attempts ending without the capability, the cheapest fixes in order are:
   a fourth drop column further right, then `POWERUPS.DROP.LIFETIME`, then the brick's row (which has
   **no slack below it** — see `docs/INVARIANTS.md`).
5. **The per-screen powerup effects are DONE** — all four capabilities are owner-specified and built
   (§4.5 and `docs/SCREENS.md` §4.9–§4.11). The Tech Park's `SAFE_PASSAGE` badge collects and does nothing, by
   design; Head Office's was deleted outright, and **the same question now applies to the one
   that is left** — a mark on the finale plaza that does nothing is the last no-op pickup in the run. The one thing left to confirm: **screen 4's fight is 5–9 seconds long inside a
   ~90 second game**, still the longest single interaction in the run, and it is the owner's call
   whether the payoff earns it or whether `HITS_TO_STRIP` should come down to 3.
6. **`UNWRAP` is carried by 500Leaders, and that is my reading rather than a brief.** ANSR's actual
   workplace product is 1Wrk, which already owns screen 1, and a capability may appear on exactly
   one screen — so with Local Expertise gone, 500Leaders was re-pointed from "market context" to
   "leaders who unblock the team". Confirm the product/stage pairing, or say which product should
   own the Workplace and what 500Leaders should own instead.
7. **Neither the Workplace nor Hire Under Fire has been played by hand.** Workplace: whether the
   4.8s sweep is a beat or a wait when you are standing behind the partition; whether three shots at
   a 0.22s cooldown feels like a mechanic or a chore. Dragon: whether the *aimed* breath reads as
   fair in the hand (a probe says a 160px back-off clears it, but a probe has perfect information
   about a mark a person has to notice), and whether the name plate plus a taunt plaque plus the HUD
   is too much type on one screen at phone size. Both: whether the shoot button appearing mid-run is
   discoverable on a phone, since nothing on the canvas explains either tool — its aria-label is the
   only explanation that exists.
8. **Compliance has never been played by hand, and the staircase re-cut changed every jump on it.**
   The route is proved climbable and trap-free by search (0 trapped of 60,001 states) and the corridors
   are proved crossable by measurement, but the **120px up-left jump from the gx15 tread onto the
   registers platform** is still the tightest single move in the game (140px of lift available) and it is
   now taken from a one-tile-wide tread rather than from the old solid column. Second thing to watch:
   `step-resubmit` (gx16 gy13) exists so a player who falls off the flight can climb back out — that is
   a recovery path nobody has tried in the hand, and if it feels like a dead end the answer is a second
   step, never removing it.
9. **Screen 1 unassisted is deliberately punishing, and it has now been made harder twice in two
   passes — this is the top thing to play by hand.** It got a brick hop in the middle of each pair, and
   then the stamps got **27% faster** (`docs/SCREENS.md` §4.14). A 60-policy probe says the stage is still clearable
   (11/60, against 22/60 at the old 1.8s cycle) and that the *fastest* clear got quicker — 6.7s → 5.5s
   — so a competent player is not slowed down, they just have less slack. What the probe cannot say is
   whether 0.71 slams per second reads as rapid fire or as unfair in the hand, or whether jumping a
   wall *while* reading a wind-up is a beat or a scramble. If it is too much, in order: **`CYCLE` back
   toward 1.5** (safe 0.70s, same 18% on the probe), then delete the gx 10 hurdle and keep gx 23 (the
   second pair is the one the player meets with 1Wrk in hand). **Never** cut `WARN_TIME`, and never
   widen the gaps between columns — the geometry is the argument and the telegraph is the fairness.
10. **Does the briefing card apply to a RETRY too?** It does today, because it is the same card: the
   stage briefing now waits for a press (owner call), so losing a life restarts the stage on a card that
   waits rather than dropping back in after 1.2s. Two arguments for leaving it: one surface with one
   rule, and the retry line ("TAKE THE ANSR BADGE") finally has time to be read — which is the only
   reason that line exists. One against: it is an extra press after every death, and §4.2's "a lost life
   SHOWS NO SCREEN" was written when the card behind it was a 1.2s flash. If the owner wants a retry to
   resume immediately, the change is one condition in `Simulation.step`'s `TITLE_CARD` case (advance
   without a press while `retrying`) — but then the badge line goes back to being unreadable, and it
   should be moved somewhere else rather than left on a card nobody can read.
11. Are these four pains the ones the pipeline actually voices, or the four service lines? Swapping
   a pain is cheap now (level data + re-skin), expensive after launch.
12. Mobile traffic share, to confirm the auto-run default.
13. Portrait play area: the camera is one fixed 1280×720 screen per level, so there is nothing to
   crop. A bigger portrait frame means either a rotate-to-landscape hint or a portrait-specific
   camera — both product decisions.
14. Brand typography: the lockup's "ANSRcade" and the 404 body copy are still web type by choice.
15. The prose specs (doc 01 §2/§6/§7, doc 07) still describe the pre-lives model and the quicksand
   screen, so they now disagree with the build. §4 and `analytics-events.json` are current.
16. **Two things want a hand, not a probe** (they would sit higher than 15 if the list
   were renumbered). **(a) `LIVES.LOST_HOLD` is 0.9s** and it is the whole of what a lost life now
   shows: long enough to read the impact pose, or a stutter before the title card? Nobody has played
   it. If it reads as a stutter the fix is the number, not the screen coming back. **(b) With
   Head Office's badge gone, the first ANSR mark in the run is on Setup Delays** — the screen that is
   deliberately punishing without it (§9 above). Nothing now teaches "jump for the mark" before it counts,
   which is exactly why the badge was removed (the old lesson was "taking one changes nothing"), but it
   does mean screen 1 is the first *and* the sharpest lesson. Watch for attempts ending there; the
   cheapest answer would be a badge on Head Office with a real effect rather than a no-op one.
17. **`DELAY_LOG_ANCHOR` is an approximation of a DOM position, and it has only been checked at 1280.**
   The `+2 MONTHS` label flies to a fixed point in the internal 1280×720 space (`x = W − 160, y = 120`)
   because the delay log itself is CSS-laid DOM in the HUD's right stack. That is deliberate — the label
   fades as it arrives rather than snapping into the row — but the HUD's inset is a `clamp()` and its
   plaques shrink-wrap their art, so on a narrow portrait frame the row may sit a little away from where
   the label lands. Worth one look on a phone; if it is off, the fix is to measure the log element and
   convert through `Renderer`'s viewport rather than to hand-tune the constant.
18. **Screen 1's badge is no longer takeable on the way past, and that is the direct cost of the phase
   you asked for — confirm it is the trade you want.** Owner call, this pass: the mark "starts from the
   middle of the rail and then goes up and then down". Implemented exactly (`badgeFloatOffset` is a
   `-sin`), band untouched. The consequence is not a feel, it is arithmetic: a forward-only auto-runner
   is under the column at **t=0.40s**, when the mark is **255px over his head against a 140px jump**,
   and the band's bottom does not come round until **4.80s** — he is at the exit by then. Measured:
   **0 of 60 tap frames** collect it on the pass, where the previous phase gave a 0.35s window. It is
   still takeable — stand under the rail (or hold BACK) and jump when it drops, ~3.6s in — so the
   pickup has become a **decision**, like the Compliance perch, rather than a timed hop.
   Why there is no third option: to be low again at 0.40s from a mid-rail start the mark would have to
   travel >300 px/s, which is faster than the 129 px/s you already asked to slow down. So it is one or
   the other. **This matters more than it looks**, because 1Wrk is what makes screen 1 survivable and
   §9 says screen 1 unassisted has never been played by hand: a phone player who does not work out
   that he has to stop for the badge meets the stamps unassisted. Three ways forward:
   **(a) keep it** — the pickup is a decision, and the retry card's "TAKE THE ANSR BADGE" line is
   already the coaching for it (recommended only if §9 gets played first);
   **(b) keep the motion and make the wait visible** — e.g. hold the mark at the bottom of the band
   for a beat each cycle, which keeps "middle, up, then down" and gives the pass a window back;
   **(c) go back to starting at the bottom** (one character in `badgeFloatOffset`).

19. **The two averages are gone from the screens but are still in the funnel, and one route was
   removed with no replacement.** This pass took the 24-month going-alone average and the 11-month
   ANSR benchmark out of every player-facing surface (owner call), and with them the win screen's
   absolute month total, its two attributed reference lines, its three comparison bars and the
   per-row "saves 4 months". Two consequences to confirm:
   **(a) `br_months` still carries the run's total into the Navigator link**
   (`buildNavigatorPayload`), and `gameCompleted` / `gameOver` still report it. Nothing shows it to the
   player now, so it is purely a lead-quality signal — defensible, but it is a figure derived from a
   benchmark the game no longer stands behind on screen. Say if the funnel should score the delays
   instead.
   **(b) the out-of-lives screen has no Navigator route at all.** Asked for and implemented; worth
   knowing that an attempt ending there can now only replay or leave, and that screen was the one
   conversion surface a player who never reaches the Tech Park was given. The mid-run summary (pause →
   "Skip to the Navigator") still carries it, so the route exists — it is one press further away.
20. **The Workplace pickup lost its plaque — should the pickup TOAST lose the words too?** "Remove the
   text from the powerup that says 500 leaders" was read as the persistent label hanging over the mark
   (deleted — `docs/SCREENS.md` §4.10). Two other places still print the product on that screen: the
   burst at the moment of collection (`Game.spawnPopup` → "ANSR ENGAGED" plus the capability tag, ~1s,
   on every screen) and the HUD chip that stays up for the rest of the stage. Both are *feedback on a
   choice the player just made* rather than signage on an object, which is why they were left — but if
   "no text on the powerup" meant no text at all, the toast's second line is the one to cut, and it
   would have to go on all four screens or none.
21. **The title screen's key-cap legend is device-specific and has not been held in a hand.** Desktop
   draws `<` `>` · SPACE · F; touch draws the pads (two arrows, a big disc, a smaller act disc). Two
   things an owner may want to call: **(a)** the row shows the **act** button on a screen where no badge
   has armed it yet — the touch button itself only appears once one has, so the legend is a promise the
   first two screens do not keep (the alternative is not teaching the control at all, which is what the
   game did until now); and **(b)** it no longer says that a touch player *runs automatically*. That was
   in the written line it replaced, and the caps have no way to say it. If a phone player looks lost, the
   answer is one short line under the row, not a longer sentence — that sentence is what out-measured the
   headline (`docs/INVARIANTS.md`).

22. **The secret stage has never been played, and three of its numbers want a hand rather than a probe.**
   THE ENGINE ROOM is proved *finishable* (27 policies, no stalls) and proved *free* (no months, no
   lives), but nobody has held it. The three: **(a) the ball's speed** - 470 rising to 620, which a probe
   clears in 25-40s and a react-only policy in 50-130s; **(b) the tray's width** - 132px against a 40px
   mark, chosen to be forgiving because this is a bonus in a game about being helped; **(c) whether the
   hatch is findable at all on a phone.** The marker is deliberately subtle (a slot, a lit near lip, two
   ladder rungs, three chevrons) and it was judged on a 1280 raster; subtle at 1280 can be invisible at
   390. If it needs help, the cheap answer is bigger chevrons, not words.
23. **An idle player still clears the bonus wall - should a miss cost something?** The owner's own rule is
   that a missed mark vanishes and "a new logo shows up continuing the game from where it was", so misses
   are free. Two passes have moved this number without settling it. It was **132s over 33 serves** when the
   serve dropped out of the ceiling and chewed the wall on its own; **58s** when the mark was fired up off
   the floor and rattled along the underside of the wall; and it is now **163s** with the throw aimed at
   the tray, against **~35s** for somebody playing (27 policies: 33.5 / 41.6 / 60.8, zero misses). So skill
   is worth 4-5x again, which is the healthiest that ratio has been.
   **What is worth knowing is how it got there.** Aiming the throw at the tray made the wall *unclearable*
   for a player who never moves - a parked tray only returns the mark up its own end, so the far columns
   stood after ten minutes - and "a room whose only exit is an empty wall must be provably clearable" is an
   invariant, not a preference. So `CANNON.RESCUE_AFTER` (5) now has the machine throw **at the wall**
   after five misses with no block down. That is a deliberate design decision taken to keep a guarantee,
   and it is the thing to overrule if the owner would rather a bored player were simply stuck: the honest
   alternative is a **cap on marks** plus a way out of the room without finishing (the shaft would have to
   open), i.e. "you may leave the bonus without clearing it". As it stands the stage still cannot be lost,
   which is consistent with a secret that carries no stakes.
24. **The bonus fires no analytics, and that is a deliberate gap.** `analytics-events.json` is the
   authoritative event list and nothing in it describes a secret stage, so nothing is sent - not the entry,
   not the clear, not the time spent. It is arguably the most interesting engagement signal in the game (a
   player who finds it *and* finishes it is a player enjoying themselves), and adding it is one new event in
   that file plus a line in `Analytics`. Owner call, because it is a spec change.
25. **The act button is three keys now, and only one surface names any of them.** `ArrowDown` was added
   alongside F and J so the secret hatch opens on the down arrow (owner call), and the hatch's own key cap
   shows **↓**. Everything else still says F and only F: the title screen's legend cap, `COPY.start.controlsKeys`
   ("Arrow keys move. Space jumps. F fires an ANSR tool.") and the canvas `aria-label`. That is defensible -
   F is the act key game-wide and the down arrow is the one place the action has a *direction* in it - but it
   means a player who learned the game from the title screen will not know the arrow works, and a player who
   learned it from the hatch will not know F does. Three options: leave it, name both in the sentences and
   keep one cap, or make the legend cap a pair. It is a copy call, not a code one; the keys already work.
   (Related: §21, which is the same legend's other unanswered question.)
26. **The Head Office name is now on the frame twice, and that was accepted rather than solved.** The wall
   sign says HEAD OFFICE (owner call, replacing "MARKET ENTRY: ON PAPER") and the HUD's stage plaque says
   Head Office over it for as long as the screen is playing. Every other duplication of this kind in the
   build was treated as a defect — COMPLIANCE over "compliance does not run in a straight line", CONTINUE
   under a cap labelled Continue — and the argument for leaving this one is that a directory board is an
   *object in a room* rather than chrome, it is 100px up a back wall behind the play, and a lobby whose sign
   named anything else would be a lobby in someone else's building. If the owner reads it as a repeat, the
   cheap answers in order: drop the sign entirely (the three step plaques already carry the room), or let it
   name the floor rather than the company ("RECEPTION", "LEVEL 1"), which puts a word on the wall that is
   *about* the room without competing with the HUD. Head Office is also the only screen where this can
   happen, because it is the only one whose sign is its own name.
27. **Two words in the internal vocabulary now disagree with the player's, on purpose.** Every surface a
   player reads says **powerup**; every identifier, module and comment says **badge** (`docs/INVARIANTS.md`
   has the rule). That is a deliberate, cheap decision and it is also the kind that costs a session an hour
   in six months, when somebody greps for "powerup" and finds three strings. Options: leave it and rely on
   the invariant, or spend one mechanical pass renaming `Badge*` → `Powerup*` across ~40 files with no
   behaviour change. Worth doing only if the owner expects to read the code, or if a second word (mark? the
   raster comments call it "the ANSR mark" in a third register) ever reaches a player-facing string.
28. **How fast the powerup should turn, and how much brighter it should be, are two judgements nobody has
   seen in motion.** The owner asked for a rotating, brighter mark and both are built — 0.3 rev/s as a
   pickup, 1.2 in the Engine Room, in `#ff7a45`/`#ff9570` against the old `#f05722`. What a raster cannot
   show is *motion*: the sunburst repeats every 11.25 degrees, so at the pickup's rate the eye may read a
   slow shimmer rather than a turning object, and the honest answer might be to take the pickups nearer the
   room's rate. The hard ceiling is ~1.9 rev/s (a ray-pitch per frame, above which it strobes) and the two
   numbers are constants with the arithmetic written beside them, so it is a one-line change either way — it
   just needs somebody to watch it. Same for the tone: it is deliberately a *lift* of the brand orange
   rather than a new colour, and if the mark is still not catching the eye the next move is the **staging**
   (the shaft, the chevron, the plinth) rather than a lighter orange, because the step after this one is
   cream.

---

## Deliberately left in web type

The assist dialog's intro and checkbox labels (real form controls, real sentences), the 404 page's
body paragraph, and the brand wordmark. Everything else on the start, HUD, pause, win and summary
screens is bitmap. (The two attributed reference lines that used to head this list are deleted — §19.)
