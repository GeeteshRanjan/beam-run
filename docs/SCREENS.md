# Per-screen model — the owner's calls, screen by screen

These are §4.9–§4.14 of `HANDOFF.md`, moved out so the handoff stays readable at the start of
a session. **Same authority as §4**: where doc 01 or `07_Analytics_and_Lead_Handoff.md`
disagree, this wins — they predate every revision here. Rationale for every line is in
`docs/JOURNAL.md`; the rules these passes produced are in `docs/INVARIANTS.md`.

`HANDOFF.md` §4.1–§4.8 still holds the model *proper* (stakes, lives, badges, the four verbs,
the receipt). Read that first; read the screen you are touching from here.

**Screen order:** Reception (0) · Setup Delays (1) · Compliance (2) · Workplace (3) ·
Hire Under Fire (4) · Tech Park (5).

| § | Screen | Hazard module | Capability |
|---|--------|---------------|------------|
| §4.13 | Reception (0) — lobby interior, **no badge** | — | — |
| §4.14 | Setup Delays (1) — two pairs of DENIED stamps | `Hazards/Stamps.ts` | `PLACE_TILE` (1Wrk) |
| §4.9 | Compliance (2) — staircase maze, 5 monsters | `Hazards/ComplianceMaze.ts` | `CLEAR_PATH` (GCC-BOT) |
| §4.10 | Workplace (3) — taped colleague, broken floor | `Hazards/Workplace.ts` | `UNWRAP` (500Leaders) |
| §4.11 §4.12 | Hire Under Fire (4) — grounded Godzilla | `Hazards/Dragon.ts` | `EXTINGUISH` (Talent500) |
| — | Tech Park (5) — finale plaza | — | `SAFE_PASSAGE` (no effect, by design) |

**Every screen is introduced by a briefing card that waits for a press** (owner call). One line per
screen in `COPY.titleCard.brief`, keyed by screen id, and each line names the **real programme risk** in
the language of the room — the buyer recognises their own project in it with no B2B vocabulary anywhere.
Three rules, all tested: no product name (the receipt is where ANSR answers), no instruction (how to beat
the screen is the screen's job), and **no word echoed from the stage name printed above it**. Deliberately
**not** authored in `levels.json` (prose there ships to the host unless the stripper is taught about it),
and deliberately short: the card sets it at a 26-character measure, so ≤50 characters keeps it on two
balanced bitmap lines instead of stranding one word over the button. The current six:

| Screen | Brief | The real thing it says |
|---|---|---|
| Reception (0) | Every plan looks clean from the lobby. | the business case before contact with reality |
| Setup Delays (1) | Nothing here is approved the first time. | resubmission loops |
| Compliance (2) | Nothing is filed in a straight line. | the filing chain, and that it doubles back |
| Workplace (3) | The team is ready. The floor is not. | the enablement gap — hired, and nowhere to sit |
| Hire Under Fire (4) | Talent never waits, and it never plays fair. | a contested market moving faster than the plan |
| Tech Park (5) | Doors open, and a year still in hand. | the whole argument, with no figure in it |

The card is the same on a retry, with the orange "TAKE THE ANSR BADGE" line added — which is the first
time that line has had long enough to be read (`docs/OPEN.md` §10 is the owner's call on whether a retry
should wait at all).

---

9. **Compliance (2) is a staircase maze with no ground route** (owner call, from their sketch):
   floor corridor → the **ANSR wall** → stepped stair → filings plateau → back down to the top
   tread and one hop left onto the **clearance hoist** → two treads rising right → the approvals
   gallery → the statutory wall → the **clearance lift** down into the far bay → exit.
   **Three owner changes on the refinement pass, all of them on the left half of the screen:**
   · the **badge rail is gone** and the mark is now a **two-jump detour off the forward line**
   (`delivery: "perch"`, `world/badgePerch.ts`), authored over three owner notes. Run right and hop
   onto `step-ansr-approach` (gx 4-6, gy 12, three blocks, one course thick, 120px over the
   corridor); then **turn round and jump back up-LEFT**, with the button held, onto
   `wall-ansr-mark` (gx 1-2, gy 9) — 120px higher again, 40px across a gap, and **out of reach of
   the ground altogether** (a full jump off the floor tops out at feet 460 against a deck at 360).
   The mark stands on that deck's right-hand column, the end the player arrives at. Both decks
   **float**, leaving 36px over a standing head, so holding right the whole way walks under the pair
   and takes nothing. The three rejected versions, in order: a levitating rail · brickwork **on the
   floor**, which was a hurdle across the only corridor so everybody collected it for free · **one
   hop up**, where a single forward tap took it ("still too reachable"). Off the path is a distance
   from the *forward line*, not a height above it — and because a one-tap touch player has to be able
   to turn round, the auto-run layout keeps its BACK button (`ui/TouchControls.ts`) ·
   · the long brown **`platform-registers` at gy 8 is gone** and the **hoist** stands in its
   place (gx 9-14, parks at gy 9, rises to gy 7, `HAZARDS.MAZE.HOIST_*`): the same yellow machine
   as the lift with the direction reversed, so it moves only while it is carrying somebody and
   returns while empty. It replaced a 120px up-left jump with an 80px hop and a ride ·
   · a **brick guide pier** (`wall-hoist-guide`, gx 8, gy 6-9) stands at the hoist's left hand,
   which is the owner's "wall on the left side of it". Lifting the badge deck into the air made it
   load-bearing rather than belt-and-braces: from the deck at 480 the apex is feet-340, *above* the
   plate's parked top of 360 and 80px away, so without the pier the whole lower maze could be
   skipped deck → plate → upper flight. Proved with the probe: with every stair, step and block
   removed, the only surfaces the flood can stand on are the ground and the deck.
   **And the ANSR badge does not put a halo on the hero here** (owner call) — it clears the
   **weather** instead (§ below).
   Five monsters (TAX, GST, LEGAL, ENTITY,
   AUDIT) wander one corridor each, re-rolling direction *and* speed at every junction from a seeded
   generator — the player is never an input, so they are unpredictable rather than hunting.
   **The exodus is a walk** (owner call): `GATHER_SPEED` 420 → **160**, above their own `SPEED_MAX`
   (132) and well under the player's 260, so the whole thing takes ~4s rather than 1.8s. The leftover
   *vertical* part of a descending leg drops at `GATHER_DROP_SPEED` (420) instead, because at a walking
   pace a body lowering itself down the stair well reads as floating. Contact
   unassisted stalls the stage (`'monster'`). **A monster is its own toll gate**: it holds a striped
   boom arm down while scowling; GCC-BOT makes it smile, raise the arm and walk its authored
   `route` up the maze's own stairs to the plateau. No separate barrier, no `'gate'` cause.
   **Art, settled over four rejected passes (`docs/INVARIANTS.md`) — do not re-litigate any of it:**
   the creature is `Game.drawGates` from `origin/main`, **whole**: a 20×30 slate filing cabinet on the
   floor with a lit top course and two drawer seams, a 5px gap, and a 30×25 pale approval head
   **floating above it** with one dark slot through the middle and no face — 7×13 cells at scale 5,
   **35×65**. The striped boom arm lies between them, painted *behind* the head, and swings up clear
   when GCC-BOT files. Both states are the same object: pale head + dark-red slot + boom down while
   pending, mint head + dark-green slot + boom raised once cleared, cabinet unchanged in both. The
   three rejected versions, in order: a horned fanged animal · the deployed palette re-authored at
   34×52 (a parking meter) · **the head only, at 30×30**, because `drawGates` anchors the cabinet to
   the screen floor and the head to the gate's own row (`gy 14`), so rendering both from one ground
   line stacks them into a lump ·
   the architecture is **brown** · the five names TAX/GST/LEGAL/ENTITY/AUDIT are framed plaques
   **on the monsters**, and signage in the sky has been rejected twice.
   **Contact costs a life, and the player is now visibly FILED for it** (owner call: "add a death
   animation for this screen — what happens to the player when he dies"). `drawFiled` buries him in a
   mound of forms to the chest, uneven course by course, with loose sheets still coming down and the
   creature's own dark-red slot mark stamped across the top; the monster that caught him
   (`MonsterState.struck`) holds its boom slammed 10px below rest with its slot lit, so the pose says
   who did it. Third of the game's three death poses, after the stamp flattening the hero on screen 1
   and the tape wrapping him on screen 3 — this screen had none for four passes.
   **The mark itself has no halo any more** (owner call): the dashed ring is gone from both pickup
   treatments, and what says "pickup" is the shaft, the wake, the chevron, the lit plinth and four
   flare cells. `docs/INVARIANTS.md` lists the four rings that were tried; do not add a fifth.
   **LEGAL rides the hoist** (`MonsterSpec.hoist`), because the plate is a level of the maze and a
   level with no monster on it is a free walk; its feet read the plate's live top, never a row in
   `levels.json`.
   **The weather is this screen's payoff, and it is the only weather in the game.** It opens under
   an overcast lid with rain, a dark horizon and dim windows; GCC-BOT moves one dial
   (`ComplianceMaze.skyClear`, over `CLEAR_SKY_TIME` 1.6s) and the sky brightens, the cloud bank
   contracts to lit cumulus, the rain stops, a cream sun breaks through over the ANSR decks and the
   skyline hazes. **The rain is two parallax sheets that wrap per drop** over the full fall
   (`RAIN_NEAR`/`RAIN_FAR`): the first version shared one offset across every drop and rewound the
   whole sheet twice a second — "a boomerang loop that's going on and not continuous". **The sun and the clouds are built from a 4px cell and a silhouette** (owner call
   on the second look: "way too pixelated"): the sun is a real pixel circle in three concentric bands
   with twelve tapering rays, and each cloud is a *height per column* from authored lobes with a lit
   crown and a shaded base — not the three stacked rectangles they started as. `render/scenery.test.ts`
   pins both. Two halves, like the Workplace's `restore`: `scenery.ts` paints sky, cloud, sun
   and rain **behind** the level from a plain `weather` number (it still knows nothing about
   hazards), and `render/maze.ts`'s `drawWeatherWash` paints the veil-and-wash **over** the
   masonry and under the cast, because a screen whose sky brightens and whose brick does not is a
   bright sky in front of a dark maze. The material was refined with it: a 40×20 course at 0.05
   speckle with per-brick `faces` and a `bevel`, where it was a 20×20 grid at 0.1 — twelve rows of
   joint over the big block read as a mesh laid on the climb.
   Both flights are **one tile thick with sky under them and two-column treads**, which is what
   the owner's sketch draws; `step-resubmit` at gx16 gy13 is not decoration, it is the only way out
   of the strip under the flight (`docs/INVARIANTS.md`).
10. **Workplace (3) replaced Local Expertise outright** (owner call). A broken office floor — failing
   strip lights, a ceiling with tiles out, barricades, cones, wet floor signs, tape strung between
   posts — and one colleague **mummified in three layers of tape**, pacing his corridor **to and fro**
   at one constant speed with a `TURN_TIME` pivot at each end. He is a
   **metronome, deliberately the opposite of the maze's monsters**: read one leg from behind the
   partition at gx 6, then pick your moment. Contact while wrapped stalls the stage (`'mummy'`).
   He used to **loop** instead — snap back to his start column at the far end — and the owner replaced
   that because a body that vanishes at one end and reappears at the other reads as a respawn rather
   than as a person. It is also a gameplay change: waiting him out no longer works, so **unassisted the
   only way past is to jump him head on**, which is measured, not assumed (a jump clears his 78px crown
   for 0.455s, head-on closing speed is 410 px/s so 88px of overlap take 0.21s, and overtaking from
   behind needs 0.8s of air — impossible on purpose, which is what stops "hold right" being an answer).
   A probe of 30 policies × 12 start delays: best 10/12 clean, blind sprint 0/12.
   `UNWRAP` arms the cutter; three **orbs of fire** burn the layers off and he **does not die** — he
   unravels, runs to the sparking terminal, works, and the chime clears the tape, the props and the dark
   (`restore`, one 0..1 dial, moved only by him getting there). The blocker becomes the person who
   puts the place right; that is the screen. Spikes, `FORESIGHT` and the Local Expertise pillar are
   deleted.
   **Art, rebuilt on the refinement pass (owner call: "make it look better, the room can be even
   more clumsy, and after he is freed everything restores and the lights look good") — the rules it
   produced are in `docs/INVARIANTS.md`:** the screen is authored **as the fixed room** in
   `scenery.ts` and the damage is laid over it by `render/workplace.ts` from `restore`, so the payoff
   is a real change rather than a fade and the backdrop still knows nothing about the hazard. Shared
   geometry is exported (`CEILING`, `WORK_PODS`, `POD_SCREEN`, `CABINETS`, `WINDOW`), never written
   twice. The shell has **three** value registers plus a dado rail; the ceiling is **96px of tile
   grid** in four receding courses with four fitting apertures **exactly two tiles wide**; the
   furniture is **darker than the wall with one lit edge each** and the pod dividers are 50px (the
   hero's shoulder, not his height); the light is a lit diffuser panel, a **seven-step pool on the
   floor** and the up-facing edges under it — **no beams, and unlit floor between the pools** — with
   two fittings holding and two striking, because a broken office is half-lit rather than dark.
   Clumsy is: two ceiling tiles out with cables and one tile hanging by a corner · a stain and a
   bucket · a chair on its side · two filing drawers hanging open · four A4 notices taped to the wall,
   one curling off · a knocked-over box stack · and the barricades, cones, signs, tape and debris.
   Restored is: four fittings at full, four pools, monitors awake, **two colleagues back at their
   desks**, daylight in the glazing, a clean floor and a full-frame wash that is the exact inverse of
   the gloom. The figure is the same 20×26 grid at scale 3 (= the 60×78 hitbox) but **cloth-first**:
   a seam on every other row in two tones, nine tape bands cut to one cell each, a fist at the end of
   the reach, and the body moved into columns 1–13 so only 3px of the hitbox is empty. Level data
   protects **three** stretches of floor now — the figure's start columns 9–13, the terminal at 23–25,
   and the clear floor under the ceiling stain — and the terminal itself was enlarged, because it is
   the object the whole screen is won on. `src/render/workplace.test.ts` pins all of it.
   **Then six more owner notes on a second art pass — this is the current state of the picture:**
   · **Two tapes.** The room keeps caution yellow; the figure is bound in **red barrier tape**
   (`#D2402C`), because holding the props back to 0.78 alpha was never going to fix "nine yellow shapes
   plus one yellow figure". `tapeStrip` takes a tone; the layer pips and `drawTangled` follow the
   *figure's* tape ·
   · **the figure was re-authored** on the same 20×26 grid, this time with joints: a 6-row head with cut
   corners (it was 8 rows, i.e. 31% of him), a neck, a stepped shoulder, a waist, and **two legs with a
   transparent column between them** — so every band below the hips is authored per leg, and the eye slit
   went to two rows ·
   · **the ammunition is a small orb of fire** (20×16, a stepped half-width profile that *narrows* away
   from the centre line, an ember wake, position-driven flicker) and each hit sets its band **burning**:
   an ember front eats along it, ash drops out, and a **permanent soot mark** is left behind, so the body
   carries the score. `BURN_TIME` 0.42s, kept under `2 × SHOT_COOLDOWN` ·
   · **the cutter** is 40×28 with a glowing ember tank and a real barrel with a white-hot bore, in a
   **mid** value with a lit rail — dark was tried and vanished into the dark furniture it is held in
   front of ·
   · **the colour scheme** moved the *room*, because the hero cannot be tuned for one screen: the floor
   material came off the teal axis to a warm grey-olive (`#3C443A`, edge `#96A38C`) and the lowest wall
   register went darkest (`#051B23`), which is the band his whole body stands against ·
   · **the lights** — `floorPool`'s profile now **narrows** away from the wall with a dithered fringe
   (widening, it rasterised as a stepped pyramid on the floor: light-as-an-object, for the third time on
   this screen and Reception between them), and the payoff brings on **fittings the broken room does not
   have** — a cove behind the ceiling line, an uplit dado course, a task lamp per desk, double the
   daylight — because four fittings reaching full is a change in four places ·
   · **the props** separate on silhouette: the cone is 2.4:1 with two reflective collars and a black base
   plate, the wet floor sign is a real **Λ of two boards with the room showing through between their
   feet** (both were filled yellow triangles, i.e. the same object twice), the tape runs carry a
   **twist** every fifth segment, and the barricade's lamp came out of amber into the caution-yellow
   family, because amber is the reserved orange by another name.
   **And then six more, on a third pass — the throw, the fourth delivery model, a floor plan and a
   repaint (this is the current state of the screen):**
   · **HE THROWS.** Every `THROW_INTERVAL` (2.9s, first at 2.2s) he stops, raises a coil of his own tape
   over the shoulder he is already facing for `THROW_WINDUP` (0.55s), and unwinds it down the floor at
   `THROW_SPEED` 210 — under the player's 260, so it can be backed away from as well as jumped. Contact
   books the same `'mummy'` delay his body does and the player is shown wrapped where he stood, which is
   what "capturing him" looks like. `THROW_FLOOR_OFF` 30 puts the roll at 559-581 against a standing
   player's 556-600: standing still is a capture, 41px of a 140px jump clears it. One roll in the air ever;
   nothing inside `THROW_MIN_RANGE` (150), because a roll spawned inside the player is a hit with no
   telegraph; nothing beyond `THROW_RANGE` (620); and **never at a player he is not already facing**, so
   his back stays honest information. **The partition is cover** — a roll dies against a solid and
   `hasLineOfFire` stops him even winding up at somebody behind one, which is what makes the badge's side
   of that wall safe (below). Re-measured, not re-worded: 20 policies × 12 start delays, best **9/12 and
   every win in the sweep delay-free**, blind sprint 0/12, and the winning dodge is **late** (70px) ·
   · **the badge falls out of a ceiling spotlight** (`delivery: "ceiling"`, `world/badgeCeiling.ts`) — the
   fourth delivery model and the only one tied to its own screen's picture. It hangs in the first spot's
   lens for `HOLD` 3.2s **visible and untakeable**, falls straight down that fitting's axis onto a
   **floating overhead cabinet** (gx 4-5, gy 12), rests `LIFETIME` 4.5s with four pips going out and a
   blink through `WARN_TIME`, then is gone for `GAP` 2.4s and returns. Row 12 is the proven row: underside
   36px over a standing head, so holding right walks under it, and the top is 120px up — the button held
   ~20 frames. It is the only pickup in the game that is *visible before it is takeable*, which is the
   whole point of it ·
   · **the partition moved to gx 7 and the corridor to gx 10.** Not tidying: the cabinet ends at x 240, so
   at gx 6 a player pinned against the wall stood underneath it with their jump capped at 36px against the
   80px the wall needs — the screen was sealed. `FIRING_COLUMN` in the tests is 9 for the same reason ·
   · **the room lost a work pod** (`WORK_PODS` `[470, 690]`, was `[190, 430, 668]`). The pod at 190 ran its
   divider and its monitor straight through the partition's column, so the payoff's lit screen was painted
   on the one solid the player has to jump (owner note). The cabinet bank went 290 → 340 and the rack
   100 → 56 for the same reason, and both remaining pods get a colleague in the payoff ·
   · **four big spotlights**, hanging below the ceiling line and pointing down, glowing up with `restore`
   (owner call). Canopy in the aperture, stem, then a can that **flares** 44 → 72 towards a lit lens, with
   the services duct **cut** around each of them (`CEILING.DUCT_GAP`). Still no beam: lens face, floor pool
   (now 130 half-width, so the four pools no longer meet) and up-facing edges ·
   · **the room came off the teal axis.** Warm grey-olive plaster (`WALL`) and warm dark furniture
   (`FURN`, plus `DAMAGE` for the mess), a **cool** ceiling so it does not read as a sepia filter, and cool
   daylight in the glazing — so below the dado rail the only teal left in the room is the player, and the
   window is finally a different value from the wall. The terminal keeps its teal on purpose: it is the
   object the screen is won on, and it is now the one cool thing on the floor. The desk, divider and
   monitor were rebuilt with sections rather than outlines.
11. **Hire Under Fire (4) is a boss fight, and the boss is a Godzilla** (owner call, three times).
   Five fire lanes on a shared cycle went first; then a *flying* dragon in a suit that poured a column
   of fire and rolled labelled fireballs down the screen. Both are gone. What stands there now
   **stands there**: a **200×190** upright beast with **two feet on the ground, no wings and no horns**,
   authored as **one 46×38 grid at scale 5** (1,748 cells). It was 260×240 at scale 10 and the owner
   asked for it *smaller and more refined* — which is one change, because a 10px cell cannot describe an
   animal ("blocks of red colour"): halving the cell while shrinking the body bought a blocky skull with
   a short muzzle, a neck that is narrower than both skull and shoulders, four separated dorsal plates,
   a tail that lies flat for its last third, hide bands and a plated belly. It opens every attempt
   with a roar it cannot move or attack during (`ROAR_TIME` 1.8s) — the only scripted opening in the
   game, and a **guaranteed safe beat** so the screen can be read before it is played. Then it holds
   its patch of floor, shifting inside `ROOST_DRIFT`, and attacks with **one straight, growing,
   slightly diverging cone of fire** thrown from its jaw down the lane in front of it: 0.65s of cream
   scorch marks along the floor first, then the flame grows out to `CONE_REACH` over `CONE_GROW` and
   stands there for the rest of `BURST_TIME`. **Nothing travels** — no fireballs, no rolling fronts —
   so the dangerous floor is a fixed strip with a rhythm. One of the screen's taunts rides each burst
   on a plaque that **does not move** (owner call); the next burst brings the next taunt.
   The jet is **70→120px thick** (it was 120→190, "too wide"), and narrowing it pushed `CONE_REACH`
   **up** to 620: a thinner cone meets a standing head later along its own axis (f≥0.495), so a shorter
   lane would have handed the screen back to a blind sprint. Lethal strip x 348–661, ~1.31s to cross
   against 1.60s of safe floor. It is painted **per column from the hitbox's own arithmetic** rather
   than as its bounding boxes, which is what turned an orange girder into a jet with a nose.
   The name plate sits **72px above the floor, under the lane** — at chest height the jet ran through it.
   **Its body is not a hitbox at all** — only fire is lethal, so nothing here can cost a life without
   a warning in front of it. `EXTINGUISH` raises a teal halo (all fire harmless) and arms a water
   cannon: a jet crossing the cone **quenches** it (`QUENCH_TIME` off the burn, so it is a contest,
   not a switch), and a jet reaching the beast **while it is waiting** damages the one thing it wears
   — **glasses, no jacket and no tie** (owner call). Four hits crack the lenses progressively and then
   wash the frame off. The **water cannon and its jets were rebuilt** on the same pass ("blocks just put
   together"): 64×34 with a pressure tank, a mid-value housing carrying one lit rail, a grip and a mouth
   that flares in whole-cell steps to a dark aperture; and a jet is a tapering line of 4px cells with a
   lit spine rather than five squares 20px apart. The screen is won on a hire, not a kill. Unassisted the
   beast cannot be answered at all and the stage is a lane to read and cross (proved crossable, and proved
   lethal to a blind sprint).
   **The ending is a sequence** (owner call): the last jet **topples** it — the grid sheared over and
   sunk while the empty suit builds up under it (`STRIP_TIME` 1.1s) — then the **costume's zip runs back
   down one side** (`COSTUME_OPEN`), the five walk out of the opening **one at a time**
   (`CANDIDATE_STAGGER` 0.55s, `CANDIDATE_WALK_TIME` 0.85s) into a line-up towards the player stamped
   HIRED, and the empty suit lies there (`COSTUME_HOLD`) and then **vanishes** (`COSTUME_FADE`). All five
   are out at 3.15s, the suit is gone at 5.95s, and the whole thing is a function of one clock, so the
   hazard remembers nothing. `Dragon.relief` (0..1 over `RELIEF_TIME` 2.2s) runs the **environment coming
   good** alongside it — an ember night becomes a bright morning: sun and clouds up, skyline in daylight
   with its lit windows out, the heat shimmer gone, the scorch receding with grass through it, the market
   trading, and a full-frame veil-and-wash (`drawReliefWash`) so the change is not just the sky.
   **The player's own death here is a burn** (owner call): soot up the body, tongues of flame with the
   figure visible between them, embers and a pale smoke plume, taking hold over `LIVES.LOST_HOLD` — the
   game's fourth death pose and the first that is a process rather than a frame.
12. **This screen's badge is delivered onto ONE floating brick** (owner call — there were three, and the
   other two are gone). No rail: an ANSR drone crosses row 5 and drops the mark over **column 16**, onto a
   one-tile `role: "pedestal"` brick at row 12, where it sits for `POWERUPS.DROP.LIFETIME` and then is
   gone; the next drone brings another to the same brick. Row 12 is the only row that works — its underside
   clears a standing head by 36px (one row lower is a wall across the only route) and its top puts the
   badge 76px over that head (a jump of 76 against 140). So the test is "be there in time **and** jump for
   it", which is why the old mid-screen hurdle was deleted: the screen already has a jump in it.
   The column is **gx 16 because the drone was slowed** on the same pass (`CROSS_TIME` 2.6 → 3.4, i.e. 554
   → 424 px/s): a slower drone releases later, so the surviving column has to be one an auto-running hero
   has not passed. Measured by sweeping every tap frame at every candidate column — gx 13 falls off the
   cliff at a 3.6s crossing, gx 16 holds the full 0.40s window. `FALL_TIME` came down 0.55 → 0.35 with it,
   because the fall spends exactly the lead the crossing buys and the mark was landing level with his
   shoulder instead of 30px in front of him.
13. **Reception (0) is an office lobby INTERIOR** (owner call) — the second of two indoor screens, and
   the most finished-looking screen in the game, because that is the joke it makes ("on paper, this all
   looks fine"). Coffered soffit with recessed downlights, full-height entrance glazing on the left
   with **daylight** and the market behind it, a lit feature bay carrying the real ANSR mark, a
   counter, wall panels, lounge seating, a two-car lift bank, planters. Nothing broken, nothing taped
   off — which is the point, because the **Workplace (3) is the same building with the ceiling out**
   and the contrast is the argument. The two interiors separate on four things and none of them is
   hue: a solid maintained ceiling vs a suspended grid with tiles missing · an entrance wall left vs a
   window band right · hospitality furniture vs workstations · a value lighter throughout. **No sky
   on this screen.**
14. **Setup Delays (1) is two pairs of stamps with a hop in the middle of each** (owner call). The
   four DENIED stamps stay at gx 7 + 12 and gx 20 + 25, half a cycle out of phase, and they slam on a
   **1.4s cycle** — 27% more often than the 1.8 they shipped at (owner call: too slow, too easy). That
   frequency was bought by compressing the *stroke* (HOLD 0.34 → 0.24, LIFT 0.20), so the safe part of
   the cycle is 0.60s rather than the 0.46s a straight cut would have left — **1.26× the 0.48s it takes
   to cross a column, which is the floor**, and a probe puts the cliff at a 1.38s cycle (below it,
   0/60 policies clear). `WARN_TIME` was deliberately *not* cut, and `ASSIST_TIME_SCALE` came to 0.18
   so 1Wrk's walk-through window stayed at 3.3s. **Going faster than this means changing the geometry,
   not the clock** — the test is stamp → hurdle → stamp, a ~0.8s traverse. There is one
   course of brick (one tile, 40px against a 140px jump) at **gx 10 and gx 23**, so crossing a pair is
   a jump as well as a piece of timing. Those two columns are load-bearing, not tidy: a player pinned
   against a hurdle must not be inside a stamp's 96px press, which rules out gx 9 and gx 22
   (`docs/INVARIANTS.md`). The `wall-paperwork` block at gx 15 between the pairs is unchanged. The art
   was refined on the same pass: **the stamps are light** (pale frame, near-white plate, near-black
   keyline and die) because painted in the sky's own blue-greys they were invisible; the skyline behind
   them is two values darker for the same reason; the material is a 40×20 course at 0.08 speckle with
   per-brick tones and a course bevel; and the backdrop is down to **two props and one sign** — the
   PERMITS board, its caption and the ink pads' scale-1 ghost word are deleted, and the clock was
   rebuilt at 80px in whole pixels.

   **Its badge starts in the MIDDLE of the rail, rises, and then falls** (owner call) — and that is
   the whole of the pickup's difficulty, because this is the last rail badge in the game (Reception's
   and the Tech Park's are deleted; the other three screens deliver theirs by perch, ceiling and
   air-drop). The band is untouched (±155px around gy 8, 6.4s), so the mark still tops out just under
   the HUD and bottoms out 41px over a standing head. What moved is the **phase**, and it moved the
   fairness with it: the mark is climbing away when the player arrives (right edge at gx 4 at t=0.40s,
   box 255px up against a 140px jump) and the band's bottom does not come round until 4.80s. So screen
   1's rail is no longer a pass-jump — **0 of 60 tap frames** take it on a forward-only run — and it
   is now the same *kind* of pickup as the Compliance perch: you stop under it (or hold BACK to come
   back to it) and take it when it drops, ~3.6s in. Both halves are pinned in `badgeReach.test.ts`;
   the trade is `docs/OPEN.md` §18 and the arithmetic is in `docs/INVARIANTS.md`.

---

## What each screen sounds like

Wired in `Game.ts` (`syncStampAudio` · `syncWorkplaceAudio` · `syncDragonAudio`), synthesised in
`audio/AudioEngine.ts`. Every hazard signals through monotonic counters or a phase edge, never a
callback — the rules and traps are in `docs/INVARIANTS.md`, the reasoning in `docs/JOURNAL.md`.

| Screen | Cue | Fires on |
|---|---|---|
| all | `badge` | the ANSR mark collected. Low fifth + open D–A–D–A arpeggio + bell tail + a noise sparkle |
| Setup Delays (1) | `stampThud` | a stroke reaching the floor (`Stamps.slams`), **weighted by the distance from the player to `lastSlamAt`** |
| Setup Delays (1) | `stampDud` | a stroke meeting an ANSR-backed player (`Stamps.deflections`). The same sound with its transient and top end removed: the thud that did not work |
| Workplace (3) | `mummy` | the **wind-up** of a throw (`windUps`) — 0.55s before the roll, so it is a tell rather than a report |
| Workplace (3) | `hush` | the roll leaving his hand (`throws`) |
| Workplace (3) | `typing` | rising edge of `isWorking` — seven unevenly spaced keystrokes |
| Workplace (3) | `spark` | the unfixed terminal, every `SPARK_INTERVAL` (1.7s) while `isSparking`. Host-paced, because the sparks themselves have no sim clock |
| Workplace (3) | `chime` | `restore` crossing **0.5** — the same threshold `drawTerminal` prints OK at |
| Hire Under Fire (4) | `roar` / `water` / `steam` / `strip` | the opening beat · each jet · each quench · each layer |
| Hire Under Fire (4) | `topple` | rising edge of `Dragon.isToppling`. A 1.05s descending groan and rumble, then a floor impact 0.58s in. Played **instead of** the fourth `strip`, not over it |
| Hire Under Fire (4) | `hired` | rising edge of `isBeaten` |

Compliance (2), Reception (0) and the Tech Park (5) carry no screen-specific cues: they run on the
global set (jump · land · badge · setback · screenClear · win).
