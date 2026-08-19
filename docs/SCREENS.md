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

---

9. **Compliance (2) is a staircase maze with no ground route** (owner call, from their sketch):
   floor corridor → stepped stair → filings plateau → a jump back up-left onto the registers
   platform → two treads rising right → the approvals gallery → the statutory wall → the
   **clearance lift** down into the far bay → exit. Five monsters (TAX, PAYROLL, LEGAL, ENTITY,
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
   Both flights are **one tile thick with sky under them and two-column treads**, which is what
   the owner's sketch draws; `step-resubmit` at gx16 gy13 is not decoration, it is the only way out
   of the strip under the flight (`docs/INVARIANTS.md`).
10. **Workplace (3) replaced Local Expertise outright** (owner call). A broken office floor — failing
   strip lights, a ceiling with tiles out, barricades, cones, wet floor signs, tape strung between
   posts — and one colleague **mummified in three layers of that tape**, walking *one way only* at
   one constant speed and looping back to his start column instead of turning round. He is a
   **metronome, deliberately the opposite of the maze's monsters**: read one sweep from behind the
   partition at gx 6, then pick your moment. Contact while wrapped stalls the stage (`'mummy'`).
   `UNWRAP` arms the cutter; three pulses strip the layers and he **does not die** — he unravels,
   runs to the sparking terminal, works, and the chime clears the tape, the props and the dark
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
11. **Hire Under Fire (4) is a boss fight, and the boss is a Godzilla** (owner call, three times).
   Five fire lanes on a shared cycle went first; then a *flying* dragon in a suit that poured a column
   of fire and rolled labelled fireballs down the screen. Both are gone. What stands there now
   **stands there**: a 260×240 upright beast with **two feet on the ground, no wings and no horns**,
   modelled on a reference image the owner supplied (a bead-grid Godzilla). It opens every attempt
   with a roar it cannot move or attack during (`ROAR_TIME` 1.8s) — the only scripted opening in the
   game, and a **guaranteed safe beat** so the screen can be read before it is played. Then it holds
   its patch of floor, shifting inside `ROOST_DRIFT`, and attacks with **one straight, growing,
   slightly diverging cone of fire** thrown from its jaw down the lane in front of it: 0.65s of cream
   scorch marks along the floor first, then the flame grows out to `CONE_REACH` over `CONE_GROW` and
   stands there for the rest of `BURST_TIME`. **Nothing travels** — no fireballs, no rolling fronts —
   so the dangerous floor is a fixed strip with a rhythm. One of the screen's taunts rides each burst
   on a plaque that **does not move** (owner call); the next burst brings the next taunt.
   **Its body is not a hitbox at all** — only fire is lethal, so nothing here can cost a life without
   a warning in front of it. `EXTINGUISH` raises a teal halo (all fire harmless) and arms a water
   cannon: a jet crossing the cone **quenches** it (`QUENCH_TIME` off the burn, so it is a contest,
   not a switch), and a jet reaching the beast **while it is waiting** damages the one thing it wears
   — **glasses, no jacket and no tie** (owner call). Four hits crack the lenses progressively and then
   wash the frame off; on the last one **the beast goes with the costume** and five candidates walk
   out of the wreckage stamped HIRED. The screen is won on a hire, not a kill. Unassisted the beast
   cannot be answered at all and the stage is a lane to read and cross (proved crossable, and proved
   lethal to a blind sprint).
12. **This screen's badge is delivered onto a floating brick** (owner call). No rail: an ANSR drone
   crosses row 5 and drops the mark over columns 13, 8 and 18 in turn, onto a one-tile
   `role: "pedestal"` brick at row 12, where it sits for `POWERUPS.DROP.LIFETIME` and then is gone.
   Row 12 is the only row that works — its underside clears a standing head by 36px (one row lower is
   a wall across the only route) and its top puts the badge 76px over that head (a jump of 76 against
   140). So the test is "be there in time **and** jump for it", which is why the old mid-screen hurdle
   was deleted: the screen already has a jump in it.
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
