# Open for the owner (unresolved, in priority order)

This was §7 and §8 of `HANDOFF.md`. Nothing here is a bug to go and fix unprompted — each item is
either a decision the owner owes, or a thing only a hand on a real device can answer. When one is
resolved, delete it from here and record the resolution in `docs/JOURNAL.md`.

**Top three:** §1 the budget gate's measurement · §2 the placeholder `navigatorUrl` ·
§9 screen 1 unassisted, played by hand.

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
   design; Reception's was deleted outright, and **the same question now applies to the one
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
10. Are these four pains the ones the pipeline actually voices, or the four service lines? Swapping
   a pain is cheap now (level data + re-skin), expensive after launch.
11. Mobile traffic share, to confirm the auto-run default.
12. Portrait play area: the camera is one fixed 1280×720 screen per level, so there is nothing to
   crop. A bigger portrait frame means either a rotate-to-landscape hint or a portrait-specific
   camera — both product decisions.
13. Brand typography: the lockup's "ANSRcade" and the 404 body copy are still web type by choice.
14. The prose specs (doc 01 §2/§6/§7, doc 07) still describe the pre-lives model and the quicksand
   screen, so they now disagree with the build. §4 and `analytics-events.json` are current.
15. **Two things want a hand, not a probe** (they would sit higher than 14 if the list
   were renumbered). **(a) `LIVES.LOST_HOLD` is 0.9s** and it is the whole of what a lost life now
   shows: long enough to read the impact pose, or a stutter before the title card? Nobody has played
   it. If it reads as a stutter the fix is the number, not the screen coming back. **(b) With
   Reception's badge gone, the first ANSR mark in the run is on Setup Delays** — the screen that is
   deliberately punishing without it (§9 above). Nothing now teaches "jump for the mark" before it counts,
   which is exactly why the badge was removed (the old lesson was "taking one changes nothing"), but it
   does mean screen 1 is the first *and* the sharpest lesson. Watch for attempts ending there; the
   cheapest answer would be a badge on Reception with a real effect rather than a no-op one.
16. **`DELAY_LOG_ANCHOR` is an approximation of a DOM position, and it has only been checked at 1280.**
   The `+2 MONTHS` label flies to a fixed point in the internal 1280×720 space (`x = W − 160, y = 120`)
   because the delay log itself is CSS-laid DOM in the HUD's right stack. That is deliberate — the label
   fades as it arrives rather than snapping into the row — but the HUD's inset is a `clamp()` and its
   plaques shrink-wrap their art, so on a narrow portrait frame the row may sit a little away from where
   the label lands. Worth one look on a phone; if it is off, the fix is to measure the log element and
   convert through `Renderer`'s viewport rather than to hand-tune the constant.

---

## Deliberately left in web type

The two attributed reference lines' *supporting* prose, the assist dialog's intro and checkbox
labels (real form controls, real sentences), the 404 page's body paragraph, and the brand wordmark.
Everything else on the start, HUD, pause, win and summary screens is bitmap.
