# ANSRcade: The GCC Game — Handoff

Current state + cross-cutting traps only. Read once per session, and only when about to change
code or when asked about project state. The model is `docs/MODEL.md`; domain rules are
`docs/INVARIANTS.md`; history is `HANDOFF_LOG.md` (grep/tail only). Where to find everything else
is in the steering file.

## Now

All 16 planned build tasks are complete and the game is playable end to end
(6 screens, win receipt, embed API, analytics, a11y, audio, touch). Everything
since then has been post-launch passes: a meaning-model rebuild (`docs/MODEL.md` §4), layout and
mobile adaptivity, an 8-bit conversion of every remaining web-native surface, the
finale rebuild, a custom 404 page and the badge work.

- **Tests:** 682 passing (48 files)
- **Bundle:** IIFE 87.25 KB gzip — **the real download is 87.25 KB, 97% of the
  90 KB budget, ~2.75 KB of headroom.** The deployed site payload is **90.56 KB**. Both figures jumped
  ~8.5 KB eight passes ago (the secret brick-breaker stage) and ~5.3 KB over the seven since (its cannons,
  the spinning mark and the rebuilt out-of-lives panel, the Godzilla's finer grids, two more
  overlay surfaces plus ~40 authored strings, the Godzilla's walk cycle and rigid jaw, and now its stomp),
  and that is the whole of the reason headroom is the thing to watch before the next art pass. The `analyze` gate reads
  **160 KB of 90 and fails**, because it sums *every* `.js` in `dist/` and so adds the two alternative
  output formats together. **This is an open owner decision, not a regression — see `docs/OPEN.md` §1.**
  Everything else is green.
- **Validator:** green on all 6 screens (structural + physics-aware + meaning layers)
- **Screen order (owner calls), and they are numbered on the frame now** — `Level 0` … `Level 4`, the Tech
  Park deliberately unnumbered because it is the arrival rather than a level: **The Headquarters (0)**
  (was Head Office; older docs and comments still say that) — an
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
- **Docs layout (2026-09-29):** `docs/JOURNAL.md` is frozen; history is `HANDOFF_LOG.md`. HANDOFF §3–§4
  moved verbatim to `docs/MODEL.md` (numbering kept, so older "HANDOFF §4.x" references mean that file).

## Gotchas

- **Two copies of the data.** `src/data/{tuning.config.ts,levels.json}` mirror the root
  `ANSR Game/` files — **update both** (byte-identical today; nothing enforces it).
- **Specs vs model.** Root spec docs `01_…`–`10_…` are authoritative **except** where `docs/MODEL.md`
  supersedes them; doc 01 and `07_Analytics_and_Lead_Handoff.md` predate every model revision and still
  describe a no-lives model.
- **`npm run analyze` fails by design** (sums both output formats; `docs/OPEN.md` §1). Read the IIFE
  gzip figure from `npm run build` instead.
- **Every transition is two cards**, so every headless driver presses twice per boundary
  (`driveInput` / `stepToPlaying` in `src/test/helpers.ts`), and a card about the stage behind reads
  `clearedScreenId`, never `screenId`.
- **The hidden level has its own two cards, inside `PLAYING`** (`Simulation.bonusCard`: `'brief'` on
  the drop, `'clear'` after the lift out; the room is frozen under both). Anything driving the room
  has to press through them (`bonusStage.test.ts`'s `drop` / `clearTheWall`), and the host picks the
  overlay off `bonusCard` before it reads `state`.
- **"Powerup" is the player's word; "badge" is internal only** (`docs/OPEN.md` §27).
- **`src/ui/styles.ts` is CSS inside a TS template literal**: write CSS comments in prose — a backtick
  in one ends the literal and produces unrelated syntax errors far away (`docs/INVARIANTS.md`).
- **Look at the pixels for any visual change.** No browser here, but `@napi-rs/canvas` installs in
  seconds and the render modules run directly:
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
- **Domain traps are in `docs/INVARIANTS.md`** (~180 KB): `grep -n '^## '` for the eight groups, or
  `grep -n -i '<keyword>'`, then read only that range. Every entry there is a defect that shipped once.
