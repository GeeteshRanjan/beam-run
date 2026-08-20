/**
 * BEAM RUN: MARKET ENTRY — Single source of truth for all tunable values.
 * ---------------------------------------------------------------------------
 * Every gameplay number lives here so design can tune without touching engine
 * code. Units: distances in *pixels* (internal resolution), time in *seconds*,
 * velocities in px/s, accelerations in px/s². Simulation runs at a FIXED
 * timestep of 60 Hz (see FIXED_DT); rendering is decoupled and interpolated.
 *
 * Coordinate system: origin top-left, +x right, +y DOWN (screen space).
 * Internal render resolution: 1280 x 720 (16:9). Grid: 32 x 18 tiles @ 40px.
 */

export const RESOLUTION = {
  WIDTH: 1280,
  HEIGHT: 720,
  TILE: 40,           // px per tile → 32 cols x 18 rows
  COLS: 32,
  ROWS: 18,
} as const;

export const LOOP = {
  FIXED_DT: 1 / 60,   // physics step (s)
  MAX_FRAME_DT: 0.25, // clamp to avoid spiral-of-death after tab-away (s)
  TARGET_FPS: 60,
} as const;

/** Core avatar physics. Tuned so a full jump clears ~3.4 tiles of height. */
export const PLAYER = {
  WALK_SPEED: 260,          // px/s top horizontal speed
  GROUND_ACCEL: 3000,       // px/s² accel toward target speed on ground
  GROUND_FRICTION: 3600,    // px/s² decel when no input on ground
  AIR_ACCEL: 1800,          // px/s² weaker air control
  AIR_FRICTION: 600,        // px/s² light air drag
  GRAVITY: 2400,            // px/s²
  MAX_FALL_SPEED: 1200,     // px/s terminal velocity
  JUMP_VELOCITY: -820,      // px/s initial (height ≈ 820²/(2·2400) ≈ 140px ≈ 3.4 tiles)
  JUMP_CUT_MULTIPLIER: 0.45,// on early release, vy *= this (variable-height jump)
  COYOTE_TIME: 0.09,        // s after leaving ledge you can still jump
  JUMP_BUFFER: 0.12,        // s before landing an early press still registers
  WIDTH: 28,                // hitbox px (visual sprite is larger, see art spec)
  HEIGHT: 44,               // hitbox px
  SPAWN_INVULN: 0.8,        // s of i-frames after (re)spawn
} as const;

/**
 * The journey clock — the currency the run is *scored* in.
 *
 * Market-entry problems cost **time**, which is the currency every GCC buyer
 * actually feels: each one books SETBACK_MONTHS on the clock and is written into
 * the delay log. A clean assisted run lands exactly on ANSR's published
 * benchmark; the total is capped below the going-alone baseline, so leaning on
 * ANSR always beats doing it alone (the story can never invert).
 *
 * Time is not the only stake any more — see `LIVES` below.
 */
export const JOURNEY = {
  /** Industry average months to stand up an India GCC alone (stated reference). */
  BASELINE_MONTHS: 24,
  /** ANSR client average. A flawless assisted run lands exactly here. */
  ANSR_BENCHMARK_MONTHS: 11,
  /** Months booked by one setback (hazard contact or a fall). */
  SETBACK_MONTHS: 2,
  /** Hard ceiling — always at least one month better than going alone. */
  MAX_MONTHS: 23,
  /** How far a setback pushes you back along the path (px). */
  SETBACK_KNOCKBACK_PX: 120,
  /** Count-up duration for the closing months readout (s). */
  MONTHS_COUNT_UP_S: 1.2,
} as const;

/**
 * Lives — the arcade stake on top of the clock (owner call).
 *
 * An obstacle does not just cost months, it costs a life. Losing one drops the
 * player onto the life-lost screen and restarts the *same* stage, so the ground
 * already covered is never taken away. Losing the last one ends the attempt and
 * returns to the title screen with the full delay log, which is the argument:
 * every one of those months was avoidable with the ANSR badge.
 */
export const LIVES = {
  /** Lives per attempt. */
  TOTAL: 3,
  /**
   * How long a lost life holds before the stage restarts (s).
   *
   * There is no life-lost *screen* any more (owner call): with lives left, the
   * game holds on the frame of the impact — the flattened hero, the stamp still
   * on him — and then drops straight back into the same stage's title card. So
   * this is a beat, not a dialog, and it is short enough that the restart reads
   * as "again" rather than as an interruption.
   */
  LOST_HOLD: 0.9,
  /** Input is ignored for this long so the beat cannot be skipped blind (s). */
  LOST_SKIP_AFTER: 0.25,
  /** Delay-log rows shown on the HUD panel at once (older ones roll up). */
  LOG_VISIBLE_ROWS: 4,
} as const;

/** Screen transitions. */
export const TRANSITION = {
  TITLE_CARD_HOLD: 1.2,     // s auto-advance
  TITLE_CARD_SKIP_AFTER: 0.4, // s before input may skip (prevents accidental skip)
  FADE: 0.18,               // s cut-to-black on transition
} as const;

/**
 * Powerups (ANSR badges) — each maps to a real ANSR capability and each does a
 * structurally DIFFERENT thing (build / staff / clear / foresee), never one
 * reskinned shield.
 *
 * They do NOT expire. A five-second shield would say "ANSR helps you briefly
 * and then leaves"; help lasts for the rest of the screen.
 */
export const POWERUPS = {
  /**
   * The badge levitates along a straight vertical line: it rises and falls
   * through a band of ±FLOAT_AMPLITUDE px around its authored anchor, one full
   * cycle every FLOAT_PERIOD seconds.
   *
   * The band is a measured figure, not a feel one (owner call: the badge was too
   * easy to take, because the old ±48 band dipped into a standing player and a
   * walk-through collected it). With the anchor authored at gy 8 (centre y=340):
   *
   *  - **Top of the swing** — centre 185, so the mark's box tops out at y=165.
   *    That is as high as it can go: the HUD's left stack (stage plaque + lives)
   *    reaches y≈150 at a 1280-wide frame and the badge column, gx 4, sits under
   *    it, so a higher band would hide the pickup behind the DOM chrome. It reads
   *    as just below the ceiling, which is the intent.
   *  - **Bottom of the swing** — centre 495, box bottom 515. A player standing on
   *    the ground band occupies y 556–600, so the badge is 41px clear of their
   *    head and can never be walked into; a jump (140px of rise) reaches it with
   *    room to spare. Roughly a third of the cycle is inside jumping range.
   *
   * FLOAT_PERIOD is set from the amplitude: 6.4s over a 310px band averages
   * ~97 px/s, which is a drift you can read and time. Shortening it without
   * shrinking the band turns the pickup into a target you have to chase; it was
   * 4.8s (~129 px/s) and the owner asked for it slower.
   *
   * The badge **rises first** and then falls (owner call) — see
   * `badgeFloatOffset`, which is a cosine for exactly that reason. The band is
   * unchanged by both of those, so nothing below has to be re-measured.
   *
   * This motion is GAMEPLAY, not juice: the hitbox moves with it, so the sim and
   * the renderer must derive the position from the same function of sim time
   * (`badgeCenter` in world/badgeFloat.ts). It is therefore not disabled under
   * `prefers-reduced-motion` — doing so would change the hitbox.
   */
  FLOAT_AMPLITUDE: 155,             // px above/below the anchor
  FLOAT_PERIOD: 6.4,                // s for one full up-and-down cycle
  /**
   * AIR-DROPPED badges (owner call, Hire Under Fire only).
   *
   * On the dragon screen the badge is not a levitating pickup on a rail: a flying
   * ANSR supply drone carries it in, drops it on the ground, and it **expires**.
   * The test stops being "can you time a jump" and becomes "can you get there in
   * time", which is the right question on the one screen where standing still is
   * how you get burnt.
   *
   * Every number here is read by ONE pure function of (badge spec, simulation
   * time) — `world/badgeDrop.ts` — so the drone, the falling parcel and the pickup
   * box are all derived once and agree by construction. Same rule as
   * `badgeFloat.ts`: a pickup whose position is computed twice is a pickup you can
   * see and cannot take.
   *
   * The cycle is a fixed length, deliberately: the drone always crosses the whole
   * frame in `CROSS_TIME`, whichever column it is dropping on, so "which drop am I
   * on" is `floor(t / cycle)` and nothing has to be remembered between frames.
   */
  DROP: {
    /**
     * s for the drone to cross the frame, from `MARGIN` off the left edge to
     * `MARGIN` off the right. 1,440px in 3.4s ≈ 424 px/s.
     *
     * **This number is set by one-tap play, not by feel** — in both directions, and it
     * has now been pushed from each end. On touch the move pad is hidden and the hero
     * runs right on his own, so the badge is only collectable if it lands *in front of*
     * him. A drone at 277 px/s (the first value, barely over the player's 260) never got
     * far enough ahead to do that and a probe of the whole stage never picked the badge
     * up once; 554 px/s (2.6s) fixed that and shipped. The owner then asked for the
     * drone to be **slower**, which is a fairness change disguised as a pace note: a
     * slower drone is overhead later, releases later and lands the mark later, so the
     * badge can arrive *behind* the auto-runner instead of in front of him.
     *
     * 3.4 is the measured answer, taken with the drop column as the second variable
     * (they are one decision — see `levels.json`). Sweeping every tap frame at every
     * candidate column: the one-tap window holds at the full 0.40s for gx15 all the way
     * to a 3.6s crossing and collapses to 0.10s at 4.0, while the old gx13 falls off the
     * cliff at 3.6. So the pair is **gx15 at 3.4s**, two probe steps inside the cliff and
     * 23% slower than the drone that shipped. Re-run `src/core/screen4.test.ts` after
     * touching either number.
     */
    CROSS_TIME: 3.4,
    /** px it starts and finishes off-frame, so it enters and leaves rather than appearing. */
    MARGIN: 80,
    /** s of quiet after it leaves before the next one comes in. */
    GAP: 2.2,
    /**
     * s the parcel takes to reach the brick once released.
     *
     * 0.35 rather than 0.55, and it came down with the drone's speed because **the fall
     * spends exactly the lead the crossing bought**. At 424 px/s the drone is ~137px
     * ahead of an auto-runner when it releases over the brick, and a 0.55s fall gives him
     * 143px of walking in the meantime — so the mark landed *level with his shoulder*
     * instead of in front of him, which is the one thing this delivery is not allowed to
     * do. A shorter fall is also the honest picture: a crate let go by a drone
     * accelerates, and 280px in 0.35s is a drop rather than a lowering.
     */
    FALL_TIME: 0.35,
    /**
     * s the badge lies on the ground before it is gone.
     *
     * The whole point of the mechanic, and measured against the walk: 4s is 1,040px
     * at 260 px/s, so from anywhere on the left two-thirds of the frame the drop is
     * makeable — and standing still through it is not. A missed drop is not a dead
     * screen: the drone comes back with another one, on the next authored column.
     */
    LIFETIME: 4,
    /** s of blinking at the end of the lifetime — the "now or never" tell. */
    WARN_TIME: 1.4,
  },
  /**
   * CEILING-DROPPED badges (owner call, the Workplace only).
   *
   * The fourth delivery model, and the one that is tied to the *picture* of its own
   * screen: the Workplace's badge rail is gone and the mark now hangs in the beam of
   * the first of the four ceiling spotlights, drops out of it onto the overhead
   * storage cabinet before the partition wall, sits there for a few seconds, and is
   * gone until the next cycle (owner call: "remove the rail and add — from the
   * spotlight — an ANSR powerup that falls and stays for a few seconds, and the user
   * has to take it otherwise it's gone, and this happens at regular intervals").
   *
   * Two things make it different from the air-drop it is closest to. There is **no
   * carrier**: the source is a fitting the room already has, which is why this
   * delivery only makes sense on a screen whose lights are part of its argument. And
   * it is **visible before it is takeable** — the mark is up there from frame one and
   * the player watches it for `HOLD` seconds before it falls, which is the owner's
   * "doesn't drop immediately, it's visible as the user comes to this screen but
   * drops after a few seconds". Both halves are one pure function of (spec, sim
   * time) in `world/badgeCeiling.ts`, for the same reason the other three are.
   */
  CEILING: {
    /**
     * s the mark hangs in the spot before it lets go — every cycle, not just the
     * first, so the whole thing is `t mod cycle` and nothing has to be remembered.
     *
     * 3.2s is measured against the walk: the spawn is ~170px from the drop column, so
     * a player who runs straight there waits ~2.5s under it, which is the beat the
     * owner asked for. Longer and the screen opens by making you stand still; shorter
     * and it is not a wait at all.
     */
    HOLD: 3.2,
    /** s the mark takes to fall from the fitting to the cabinet top. */
    FALL_TIME: 0.5,
    /**
     * s it rests on the cabinet before it is gone.
     *
     * The jump onto that cabinet needs the button held for ~20 frames (0.33s) and one
     * run-up, so 4.5s is room for two attempts and a mistake. It is deliberately not
     * generous enough to walk away and come back.
     */
    LIFETIME: 4.5,
    /** s of blinking at the end of the lifetime — the "now or never" tell. */
    WARN_TIME: 1.4,
    /** s of nothing at all before the next one appears in the fitting. */
    GAP: 2.4,
  },
} as const;

/** Hazard behaviour, per family. */
export const HAZARDS = {
  /**
   * DENIED stamps (Screen 1 — Setup Delays). Owner-specified replacement for the
   * old red-tape sludge.
   *
   * One cycle is: parked at the top of the frame → SLAM down → held pressed on
   * the floor → lifted back up → a short beat. Stamps are authored in pairs half
   * a cycle out of phase, so the busy part of the cycle (DROP+HOLD+LIFT = 0.72s)
   * is just under half of CYCLE: the second stamp starts dropping ~0.03s after
   * the first finishes lifting. That "barely a beat" alternation is the whole
   * feel of the screen at full speed.
   *
   * A stamp only costs you time at the bottom of its stroke — you are flattened
   * by the landing, not brushed by the descent — so the reflex test is about not
   * being in the column when the drop starts.
   */
  STAMPS: {
    /**
     * s for one full parked → wind-up → slam → press → lift → beat cycle.
     *
     * **1.4, down from 1.8** (owner call: the stamps were too slow and the screen
     * was too easy to walk). That is a **27% higher slam rate**, and the way it was
     * bought matters more than the number: the *stroke* was compressed with it
     * (HOLD 0.34 → 0.24, LIFT 0.24 → 0.20), so the fully-safe part of the cycle
     * only fell from 0.86s to **0.60s** rather than to the 0.46s a straight cut to
     * 1.4 would have left. Shortening the cycle without shortening the stroke is
     * how this screen becomes impossible — see the numbers below.
     *
     * None of this is a feel number. A stamp column plus the player is 124px wide,
     * which takes **0.48s** to clear at walk speed, and the safe part of the cycle
     * (CYCLE − DROP − HOLD − LIFT − WARN) has to stay above that or the screen
     * stops being a test and becomes a wall. A probe drives the stage unassisted
     * with 60 reactive policies (five stand-off distances × twelve reaction delays,
     * so the phase is sampled rather than guessed at) and the cliff is sharp:
     *
     *   cycle 1.80, safe 0.86s (1.80× crossing) → cleared 22/60, fastest 6.8s
     *   cycle 1.50, safe 0.70s (1.47×)         → cleared 11/60, fastest 5.8s
     *   cycle 1.40, safe 0.60s (1.26×)         → cleared 11/60, fastest 5.5s
     *   cycle 1.38, safe 0.66s (1.38×)         → cleared  8/60
     *   cycle 1.32, safe 0.60s (1.26×)         → cleared  0/60   ← impossible
     *   cycle 1.40, stroke NOT compressed      → cleared  0/60   ← impossible
     *
     * So **1.26× the crossing time is the floor**, and below a ~1.38 cycle the
     * pair stops being crossable at all whatever the ratio says — because the test
     * is not one column, it is *stamp → hurdle → stamp*, and that traverse is
     * ~0.8s. Anything faster than this needs the geometry to change, not the clock.
     * The fastest clear got *quicker* (6.8s → 5.5s): a competent player is not
     * slowed by this, they just have less slack.
     */
    CYCLE: 1.4,
    DROP_TIME: 0.14,          // s of the slam itself (too fast to react to)
    /**
     * s held flat on the floor, and s to rise back up.
     *
     * Both came down with the cycle (0.34 → 0.24 and 0.24 → 0.20) and that is what
     * paid for the extra frequency: the "busy" part of the stroke is 0.58s instead
     * of 0.72s, so the safe gap kept 0.60 of the 0.14s the cycle lost. 0.24s is
     * still 14 frames of a stamp sitting on the floor, which is what the flattened
     * hero is read against.
     */
    HOLD_TIME: 0.24,
    LIFT_TIME: 0.2,
    /**
     * s of visible wind-up before the slam, at the END of the cycle.
     *
     * **Deliberately NOT cut when the cycle came down.** It is the fairness half of
     * the mechanism, and it is now a larger share of a shorter cycle, which is the
     * right way round: faster stamps need the same warning, not less of it. The
     * probe agrees — lengthening it to 0.26 at cycle 1.40 eats the safe gap and
     * takes the clear rate to 1/60, and cutting it would make the slam unreadable.
     *
     * Every hazard in this game telegraphs (fire glows, the wrapped figure walks
     * one way at one speed);
     * a stamp that dropped with no tell was the one that did not, and it was
     * unfair rather than hard — the drop is 0.14s, so by the time the head moves
     * you are already under it. Nothing about the geometry changes during the
     * wind-up, only the picture.
     */
    WARN_TIME: 0.22,
    /**
     * px: the pressing face's height while parked.
     *
     * Sits just above the middle of the 720px frame (owner call) rather than up
     * against the ceiling, so the whole stamp — wooden knob, stem, body, rubber
     * die — is on screen and reads as an object rather than as a block sliding in
     * from off-frame. Nothing holds it up: there is no rail, and there was never a
     * reason for one beyond "the head was somewhere you could not see".
     */
    REST_BOTTOM: 330,
    /**
     * px: hitbox = the pressing face. Drawn exactly this wide, never wider.
     * 96 rather than a tidier 80 because the face has to carry the word DENIED at
     * bitmap scale 2 (~71px) inside its plate — at 76 the D and the D fell off
     * the plate onto the frame, which is the only thing this hazard has to say.
     */
    WIDTH: 96,
    /**
     * px: height of the pressing body — flange down to the rubber die. This is
     * the hitbox, and the sprite's body is authored to exactly this height
     * (`STAMP_BODY_ROWS * STAMP_SCALE` in `render/stamps.ts`, guarded by a test).
     * The handle above it is deliberately outside the box: being level with a
     * stamp's knob is not being under its die.
     */
    HEAD_H: 88,
    /** px the stamp visibly cocks back during its wind-up. */
    WARN_LIFT: 14,
    /**
     * Assisted (1Wrk): approvals move at ANSR speed, so the whole mechanism runs
     * at this fraction of real time.
     *
     * **0.26 → 0.18, because this number is derived from CYCLE and not chosen.**
     * What it has to deliver is a safe window wide enough to stroll through, and
     * that window is `safe gap ÷ scale`: at 0.26 against the old 0.86s gap it was
     * 3.3s, and leaving it alone while the gap fell to 0.60s would have quietly cut
     * the assisted window to 2.3s. 0.18 puts it back at **3.3s** — a seventh of the
     * crossing time — so the capability is exactly as generous as it was while the
     * unassisted screen got harder. The contrast between the two is the argument
     * this screen makes, so it widened rather than narrowed.
     */
    ASSIST_TIME_SCALE: 0.18,
    /**
     * s for a press that met an ANSR-backed player to retract from where it
     * touched. It never completes the stamp: it cannot press you, so it goes
     * back up from there.
     */
    RETRACT_TIME: 0.28,
    /** "Extra reaction time" assist: run the mechanism this much slower again. */
    EXTRA_TIME_SCALE: 0.8,
    /**
     * px the guilty stamp is lifted on the life-lost frames so the flattened
     * player is visible under it. Presentation only — the delay was booked the
     * instant it landed. Without it the whole gag happens inside an 88px block
     * and the player never sees what became of them.
     */
    REVEAL_LIFT: 52,
  },
  /**
   * The hiring dragon (Screen 4 — Hire Under Fire; owner-specified, three times).
   *
   * Four rules shape every number below, and all four are owner calls:
   *
   *  - **The first beat of the level is guaranteed safe.** The dragon opens with a
   *    roar and does not move or attack for `ROAR_TIME`. It is the only hazard in
   *    the game with a scripted opening, and it is the reason the screen can be
   *    read before it is played: you always get to see it before it does anything.
   *  - **Its fire is the hazard, the dragon is not.** Its body has no hitbox at
   *    all, so nothing here can cost a life without a telegraph in front of it.
   *    Every lethal thing on this screen is fire, and every piece of fire
   *    announces itself first.
   *  - **It stands on the ground on two feet, and it throws its fire in a straight
   *    line** (owner call, third pass). It used to hover over its own end of the
   *    level and pour a column onto the floor which then rolled *fireballs* — flame
   *    fronts — back down the screen at the player. Both of those are gone: the
   *    beast is planted on the ground like a Godzilla, and what comes out of it is
   *    one **cone** — a jet of fire that leaves the jaw, grows out along a straight
   *    line towards the player and diverges slightly as it goes (`CONE_*`). Nothing
   *    travels *past* the end of that cone, so the lane it threatens is a fixed
   *    piece of the floor the player can read once and then plan around.
   *  - **Water beats fire before it beats the wearer.** Assisted, the badge is a
   *    water cannon: a jet crossing the cone quenches it, and a jet that reaches
   *    the dragon *between* bursts cracks and then washes off the one thing it is
   *    wearing — its glasses (owner call: no jacket, no tie).
   */
  DRAGON: {
    /**
     * s of roar before it moves or attacks — the guaranteed safe beat.
     *
     * 1.8 is measured against the walk, not chosen for feel: it stands over gx 23+
     * and the first cone needs `BURST_WINDUP` on top of this, so a player who
     * spawns and walks is still in the left third of the frame when anything becomes
     * lethal. It also covers the first air-drop, which lands at ~1.8s
     * (`POWERUPS.DROP`): the roar is the beat the badge arrives in, so the screen
     * introduces the boss and the answer to it before either matters.
     */
    ROAR_TIME: 1.8,
    /**
     * px: the drawn beast, and deliberately NOT a hitbox (see above). It *is* the
     * box a water jet has to reach, so it is the target, not a threat.
     *
     * Sized against the drawn hero (48×60), the same rule the Workplace figure
     * taught us: at 200×190 it is four heroes wide and three tall.
     *
     * **Down from 260×240** (owner call: "decrease the size, it's too big"), and the two
     * halves of that note — smaller *and* more refined — are answered by the same change:
     * `render/dragon.ts` halved the cell (10px → 5px) while shrinking the animal, so the
     * beast lost 23% of its width and gained 1,000 cells. Four heroes wide is still a
     * boss; what it no longer does is fill a third of the frame.
     *
     * Everything about the fire is measured off this box, so moving it moves the level
     * design: the jaw sits at `BODY_H × MOUTH_Y_FRACTION` from the top, which decides how
     * far down the lane the flame takes to reach a standing head, which decides
     * `CONE_REACH`. Re-measure that chain, do not nudge one number.
     *
     * The box's **bottom sits on the ground band** — it stands, it no longer flies
     * (owner call), so there is no hover row in level data any more and nothing
     * derives its height from one. Its tail, muzzle and claws are drawn slightly outside
     * it: the box is what water has to hit, not an outline of the animal.
     */
    BODY_W: 200,
    BODY_H: 190,
    /**
     * px it shifts along the ground either side of its roost centre, and px/s of
     * that shift.
     *
     * It does not roam and it does not chase (owner call): `from`/`to` in level data
     * are the patch of ground it holds, and it only ever shifts its weight inside
     * `ROOST_DRIFT` of the middle of them. 40px at 60 px/s is a 1.3s sweep each way,
     * which stops the sprite looking pinned without ever moving the fire lane
     * somewhere the telegraph did not say.
     */
    ROOST_DRIFT: 40,
    ROOST_SPEED: 60,
    /**
     * s of quiet between the end of one burst and the wind-up of the next.
     *
     * The window, and it does two jobs: it is when the lane is clear enough to
     * cross, and it is the only time the dragon can be hit (`Dragon.isVulnerable`).
     * 1.1s is measured against both. Together with `BURST_WINDUP` it gives 1.75s of
     * safe floor, against `CONE_REACH`/walk speed ≈ 1.23s to clear the whole lane —
     * so crossing is a dash with margin, and at a 0.24s cannon cooldown the same
     * window is four or five jets, of which the retaliation every hit provokes lets
     * exactly one land.
     */
    BURST_GAP: 0.95,
    /**
     * s of telegraph before a burst becomes lethal, with the tell along the FLOOR:
     * a cream scorch lane running from the dragon's jaw out to the end of the cone's
     * reach — exactly the ground that is about to be on fire. Where the player is
     * looking, not where the hazard lives, which is the lesson the parked stamps
     * taught.
     */
    BURST_WINDUP: 0.65,
    /**
     * s the jaw throws fire. **Continuous** (owner call): one unbroken jet for the
     * whole beat rather than a shot, so the lethal geometry is a cone standing in
     * one place for every frame of it.
     */
    BURST_TIME: 1.2,
    /**
     * px the cone reaches, measured horizontally from the jaw towards the player.
     *
     * This one number is the level design, and it is measured from both ends.
     *
     * The beast stands over gx 23–29, so with a 200px body its jaw is at x≈968 and
     * 161px off the floor (`MOUTH_Y_FRACTION` — it is a Godzilla, so the skull is the top
     * of the silhouette). 620px puts the far end of the fire at x≈348, which still leaves
     * the spawn 280px clear as the place the pattern is read from.
     *
     * The part of that lane which is lethal to a *standing* player starts where the
     * cone's lower edge drops past a standing head. Solve it: the axis falls from 438 to
     * 580 over the reach and the flame's half-thickness grows from 35 to 60, so
     * `438.5 + 141.5f + 35 + 25f ≥ 556` → **f ≥ 0.495**. Everything before that passes
     * overhead, so the dangerous floor is x 348–661: 313px, or ~1.31s to walk clear of
     * with the player's own width. Against 1.60s of safe floor per cycle (`BURST_GAP` +
     * `BURST_WINDUP`) plus the 0.3s the flame takes to grow, that is a dash a reading
     * player wins and a blind sprint loses — the balance two earlier tunings of this
     * screen failed in the other direction, clearing it 8/8 with no delays.
     *
     * **This number went UP (560 → 620) as the fire got NARROWER**, which is the whole
     * arithmetic in one line: a thinner cone meets a standing head later along the axis,
     * so a shorter lane would have handed the screen back to the sprinter. **A high jaw
     * makes the lane shorter, not longer** for the same reason — move `MOUTH_Y_FRACTION`,
     * `CONE_NEAR_H` or `CONE_FAR_H` and all of this has to be solved again together.
     *
     * **…and then DOWN to 510, because the flame now reaches the floor and runs along
     * it** (`CONE_TOUCHDOWN`). Same chain, solved again from the top, and this time the
     * new number let the lane get *shorter* rather than longer:
     *
     *   axis, descending:  438.5 + 234.2f   (jaw → the ground-run height, over 0..0.55)
     *   half thickness:    14 + 34f         (CONE_NEAR_H 28 → CONE_FAR_H 96)
     *   lethal when the lower edge passes a standing head (556):
     *     438.5 + 234.2f + 14 + 34f ≥ 556 → **f ≥ 0.386**
     *
     * So 0.614 of the reach is lethal where 0.505 of it used to be — a flame that comes
     * down to the floor is dangerous over more of its own length, which is the whole
     * point of it. 510 × 0.614 = **313px of lethal floor**, the same figure the screen
     * was balanced on: ~1.31s to walk clear with the player's own width, against 1.60s
     * of safe floor per cycle (`BURST_GAP` + `BURST_WINDUP`) plus the 0.3s the flame
     * takes to grow.
     *
     * Two things the shorter reach bought, and both matter more than the pixels: the far
     * end of the fire is now at x≈458 rather than 348, which leaves the spawn **418px**
     * clear instead of 280 — and that is the room the badge's brick moved into when the
     * owner asked for it "closer to the spawn point" (`levels.json`). The fire's reach
     * and the drop column are measured against each other; they always were.
     */
    CONE_REACH: 510,
    /**
     * Fraction of the reach at which the flame's axis has come DOWN to the floor. After
     * it, the axis runs level and the fire lies along the ground.
     *
     * Owner call: "make the flame look more realistic". A jet whose axis descends in one
     * straight line all the way to the far end is a *ramp* — it is thickest and lowest at
     * exactly the same moment, so it reads as a girder leaned against the floor. Real
     * fire thrown downwards hits the ground and then **runs**, and that is two segments:
     * a throw and a floor run.
     *
     * 0.55 is measured, not felt. It has to leave the beast a safe pocket at its own feet
     * (the invariant that a beast which sets fire to its own shoes is a beast nobody
     * believes) — lethal starts at f 0.386, i.e. 197px in front of the jaw — and it has to
     * put the flame on the floor for enough of the lane that "the floor is on fire" is the
     * read. It also has to stay **above** the lethal threshold, or the fire touches a
     * standing head before it has finished descending, which would make the touchdown
     * invisible.
     */
    CONE_TOUCHDOWN: 0.55,
    /**
     * s for the cone to grow from the jaw to its full reach.
     *
     * The fire **grows** rather than appearing (owner call), and the growth is a
     * fairness mechanism as much as a picture: it ignites next to the dragon first
     * and arrives at the far end 0.3s later, so a player caught at the outer end of
     * the lane when the burst starts still has a beat to leave. Any slower and the
     * jet reads as a lamp warming up.
     */
    CONE_GROW: 0.3,
    /**
     * px: the flame's thickness at the jaw and at full reach.
     *
     * **28 → 96, down from 70 → 120, which was down from 120 → 190.** Three passes, one
     * note each time, and the third one said what the first two had not: "reduce the
     * thickness of the flame — it is of uniform thickness; make the flame thinner near
     * the Godzilla's mouth and wider at the end, so it looks natural."
     *
     * 70 → 120 *was* thinner at the mouth. It read as uniform because a 1.7× spread over
     * 620px is 25px of growth in a shape 35px deep to begin with — arithmetically a cone
     * and visually a pipe. What reads as a cone is the **ratio**: 28 → 96 is 3.4×, i.e. the
     * flame is 14px off its own axis where it leaves the jaw and 48px at the far end, which
     * is a shape whose two ends are plainly different. And it is *thinner overall*: the
     * widest the fire ever gets is 96px where it used to be 120, and where it leaves the
     * mouth it is 28 where it used to be 70.
     *
     * Narrowing it is a **fairness** change before it is a picture: a thinner cone meets a
     * standing head later along its axis, which shortens the lethal strip. Twice now that
     * has been paid for by lengthening `CONE_REACH`; this time `CONE_TOUCHDOWN` paid for it
     * instead — a flame that comes down to the floor and runs along it is lethal over more
     * of its length, so the reach could come *down* to 510. The far figure still has to
     * cover a standing player (44px) with margin, or a burst could be walked through: 96 is
     * 2.2× that.
     *
     * The near figure is also why the strip under the jaw is safe. The axis starts 161px up
     * and does not reach the floor until `CONE_TOUCHDOWN`, so the near end of the cone
     * passes over a standing head — and that pocket is deliberate. A beast that sets fire to
     * its own feet is a beast whose fire nobody believes, and it gives "get in close" a
     * meaning on a screen whose body is not a hitbox.
     */
    CONE_NEAR_H: 28,
    CONE_FAR_H: 96,
    /**
     * Segments the cone's hitbox is cut into, and therefore exactly what is drawn.
     *
     * A cone is not an AABB, and the two dishonest ways to handle that both cost the
     * player: one box round the whole thing is lethal where there is no flame, and a
     * box round the axis only is flame that cannot hurt anybody. Eight stepped boxes
     * are within 8px of the drawn silhouette everywhere, and `Dragon.coneBoxes` is
     * the single function the simulation collides against and the renderer paints —
     * the `badgeFloat` rule applied to a hazard.
     */
    CONE_SEGMENTS: 8,
    /**
     * px/s the water jet travels, and its hitbox.
     *
     * 44×22 rather than the Workplace cutter's 18×6: the owner asked for a *big*
     * water weapon, and a jet the size of a rifle pulse rasterised as a small blue
     * arrow — the wrong read for the thing that beats a fire. It also has to be wide
     * enough to actually meet the cone while crossing it at speed.
     */
    WATER_SPEED: 720,
    WATER_W: 44,
    WATER_H: 22,
    /**
     * s between one segment of the stream and the next, and how many may be live at once
     * (bounded, so the array cannot grow).
     *
     * **It is a HOSE now** (owner call: "make the water gun throw a continuous flow of
     * water when engaged"), so this is no longer a weapon's cooldown — it is the spacing
     * of the stream. 0.045s at 720 px/s puts a segment every 32px along the line, which
     * against a 44px hitbox is a continuously overlapping column of water: the jet reads
     * as one unbroken flow and the simulation still owns discrete boxes, which is what
     * keeps "what is painted is what hits" true.
     *
     * `MAX_WATER` had to grow with it. A stream crossing ~500px of frame at 720 px/s is
     * 0.7s in flight, i.e. ~16 segments, and the cap is the only thing standing between a
     * held button and an unbounded array.
     *
     * **Holding it does not make the fight quicker**, and that is checked rather than
     * hoped for: the beast is only vulnerable between bursts and every landed hit provokes
     * one immediately (`Dragon.strike`), so a continuous stream lands exactly one hit per
     * gap — the same rhythm the 0.24s trigger gave. What the stream changes is that the
     * *fire* is now fought with a sustained flow instead of with three taps, which is what
     * `QUENCH_RATE` exists to keep honest.
     */
    WATER_COOLDOWN: 0.045,
    MAX_WATER: 20,
    /**
     * s of burn knocked off per **second** of stream on the fire.
     *
     * A rate rather than a per-jet figure, and that change is forced: it used to be
     * `QUENCH_TIME` 0.42s off the burst per jet, tuned so that three jets at a 0.24s
     * cooldown ended a 1.2s burst. Keep a per-jet figure with a 0.045s stream and a held
     * button puts a burst out in three frames — the "contest, not a switch" rule broken by
     * a change that was only supposed to be about the picture.
     *
     * 1.7 is that same balance restated: 0.72s of water on the flame ends a 1.2s burst,
     * which is what it took before. Each segment therefore removes
     * `QUENCH_RATE × WATER_COOLDOWN` ≈ 0.077s, so the arithmetic is independent of how
     * finely the stream is chopped — change the spacing and the contest does not move.
     */
    QUENCH_RATE: 1.7,
    /**
     * Jets on the dragon needed to beat it (only between bursts).
     *
     * It wears **nothing** now (owner call: "remove the spectacles from the Godzilla"), so
     * these four hits are no longer damage to a costume that is visible on its face — which
     * is exactly why the same note asked for a health readout ("remove the life visibility
     * of the Godzilla and add a better one, a more visible one"). The glasses *were* the
     * health bar; with them gone the bar has to be a bar.
     */
    HITS_TO_STRIP: 4,
    /**
     * s the beast takes to GO DOWN once the last jet lands (owner call: "it dies on the
     * ground").
     *
     * It used to dissolve on the spot over this beat. It topples now — the drawn grid
     * shears over and sinks while the empty suit builds up under it — because a creature
     * that fades leaves nothing that can then be *opened*, and the opening is the ending.
     * 1.1s is long enough to read as a fall and short enough that nobody waits for it.
     */
    STRIP_TIME: 1.1,
    /**
     * s one hit's worth of damage takes to play out on the glasses (owner call).
     *
     * Water does not pop glass off a face — it fogs it, cracks it, and runs it down
     * the snout until the frame slides. 0.55s is long enough to see that happen and
     * short enough that the fight's rhythm is unchanged, because the hit is already
     * booked in the *rules* the frame the jet lands (see `Dragon.strike`).
     */
    DISSOLVE_TIME: 0.55,
    /**
     * The ending, in five numbers (owner call): "on one side the Godzilla's costume opens
     * up and from there the 5 candidates come out ONE BY ONE saying HIRED, and the costume
     * after some time vanishes."
     *
     * The whole sequence is a function of one clock — the seconds since the beast went
     * down — so `Dragon` remembers nothing and a replay lands on the same frame. It reads
     * in order: the zip runs back (`COSTUME_OPEN`), then one person leaves the suit every
     * `CANDIDATE_STAGGER` and takes `CANDIDATE_WALK_TIME` to reach their place in the
     * line-up, and once the last of them is standing the empty suit lies there for
     * `COSTUME_HOLD` before fading over `COSTUME_FADE`.
     *
     * 0.55s of stagger is what makes it "one by one" rather than a crowd: it is longer than
     * a person's own walk-out is *visible* for, so at any moment early in the sequence there
     * is exactly one figure in the doorway. All five are out at 3.15s and the suit is gone
     * at 5.95s, which is inside the time it takes to walk from the roost to the exit — the
     * payoff finishes while the player is still on the screen it happened on.
     */
    CANDIDATES: 5,
    COSTUME_OPEN: 0.7,
    CANDIDATE_STAGGER: 0.55,
    CANDIDATE_WALK_TIME: 0.85,
    COSTUME_HOLD: 1.6,
    COSTUME_FADE: 1.2,
    /**
     * s for the environment to come good once it is beaten (owner call: "make the
     * environment beautiful and well lit up — from the dangerous environment it turns all
     * bright and happy").
     *
     * Slower than the costume opening on purpose: the light comes up *while* the five are
     * walking out, so the two payoffs are one event rather than a sequence of two. Read as
     * `Dragon.relief` and handed to `scenery.ts` as a plain number, exactly like the maze's
     * weather dial.
     */
    RELIEF_TIME: 2.2,
  },
  /**
   * The Compliance maze (Screen 2 — owner-specified rebuild of the screen).
   *
   * The obstacles are no longer a row of barriers on the flat: the screen is a
   * staircase maze with no route along the ground, and the things moving in it
   * are the compliance headaches themselves — ENTITY, GST, LEGAL, TAX and
   * AUDIT — one wandering each corridor.
   *
   * Two rules give the monsters their character, and both are deliberate:
   *
   *  - **They wander, they do not hunt.** At every junction (a column boundary,
   *    or either end of the corridor) a monster re-rolls its direction and its
   *    speed from its own seeded generator. Nothing about the player is an input.
   *    A hunting monster would say "compliance is out to get you", which is a
   *    horror story; an unpredictable one says "you cannot plan around this",
   *    which is the truth being sold against.
   *  - **The speed re-roll is what makes them unreadable.** A constant-speed
   *    patrol is memorised in one attempt. Re-rolling between SPEED_MIN and
   *    SPEED_MAX means the same corridor is a different crossing every time,
   *    while both ends of the range stay well under the player's 260px/s so the
   *    maze is a reading test, never a race.
   *
   * Each monster IS its toll gate (owner call): the creature holds a striped boom
   * arm down while it is scowling, and once GCC-BOT has filed everything it smiles
   * and raises the arm. There is no separate barrier object any more — that split
   * put two things in a corridor where the owner's design has one.
   */
  MAZE: {
    /** px/s: slowest a monster wanders (the player walks at 260). */
    SPEED_MIN: 52,
    /** px/s: fastest. Still ~1/2 walk speed, so a corridor can always be won. */
    SPEED_MAX: 132,
    /**
     * Chance a monster reverses at a junction it did not have to turn at.
     * 0.35 reads as indecision; at 0.5 it dithers on the spot and stops
     * patrolling the corridor at all.
     */
    TURN_CHANCE: 0.35,
    /**
     * px: the monster's hitbox, and exactly what is drawn (`render/maze.ts`
     * authors 7×13 cells at scale 5). This is the **whole** creature that is on
     * `origin/main`, i.e. the deployed build, transcribed piece by piece at its own
     * 5px scale (owner call, four times): a 20×30 slate filing cabinet on the floor,
     * a 5px gap, and a 30×25 approval head floating above it, with the striped boom
     * arm between them. Two earlier attempts got this wrong in instructive ways —
     * 34×52 (a re-authored parking meter), then 30×30 (the head only, because
     * `drawGates` anchors the cabinet to the screen floor and the head to the gate's
     * own row, so rendering both from one row stacks them into a lump).
     * The boom is 7 cells wide, which is why the grid is 7: at rest it is inside the
     * box, and it only hangs outside once raised — safe precisely because a friendly
     * monster cannot cost anything.
     */
    MONSTER_W: 35,
    MONSTER_H: 65,
    /** s for the boom arm to swing up once the monster turns friendly. */
    ARM_LIFT_TIME: 0.45,
    /**
     * px/s a monster walks home at once GCC-BOT has filed everything.
     *
     * **This is a walk, not a sprint** (owner call: "make the movement of the
     * creatures to the resting space a bit slow, right now it's too fast and not
     * natural"). It was 420 — **1.6× the player's own walk speed of 260** — which is
     * why it read as unnatural: five obstacles teleporting off the screen, at a pace
     * no body on this screen moves at. 160 sits just above the top of their own
     * wander range (SPEED_MAX 132), so it reads as the same creature leaving with
     * purpose, and well under the player, so he can outpace them. The whole exodus
     * takes ~4.5s from the far gallery instead of 1.8s.
     */
    GATHER_SPEED: 160,
    /**
     * px/s for the part of a route that is a **drop**.
     *
     * A route leg is walked at GATHER_SPEED on both axes while it still has ground
     * to cover, which reads as walking a flight at 45°. But some legs finish with a
     * purely vertical descent (LEGAL and AUDIT both come down a stair well), and at
     * a walking pace that reads as *floating* down through the level. So the
     * leftover vertical part of a descent falls instead. It was invisible at 420 —
     * slowing the walk is what exposed it, which is the usual shape of these things.
     */
    GATHER_DROP_SPEED: 420,
    /**
     * px between monsters once they are huddled on the landing. Wider than
     * MONSTER_W on purpose: shoulder to shoulder they overlapped, and five
     * overlapping name plates rendered as one unreadable word.
     */
    GATHER_SPACING: 40,
    /**
     * The clearance lift at the end of the maze (its parked position and span are
     * authored in `levels.json`).
     *
     * px thick. A plate, not a tile: it is the one thing on this screen that is
     * machinery rather than masonry, and it is drawn in its own colour instead of
     * the level material for the same reason (see `render/maze.ts`).
     */
    LIFT_H: 16,
    /**
     * px/s down. 150 is slow enough to read as a ride and fast enough that nobody
     * waits: the drop from the gallery to the bay floor is 360px, so ~2.4s.
     * Well under gravity, so a player standing on it stays on it.
     */
    LIFT_DOWN_SPEED: 150,
    /** px/s back up once the player steps off. Only ever moves up while empty. */
    LIFT_UP_SPEED: 110,
    /**
     * The clearance HOIST — the same plate pointing the other way (owner call: the
     * long brown platform at gy 8 is gone, "make it go up and down so the user can
     * jump on this and get on the top brick floor easily").
     *
     * px/s up while it is carrying somebody. Its travel is two rows (80px), so a ride
     * is ~0.65s: long enough to read as a machine doing the work, short enough that
     * nobody stands there wondering whether they have to jump after all. Bracketed by
     * the speeds already on this screen, like every other pace here: a little under
     * the monsters' own top speed (132) and a long way under the player's walk (260),
     * so it reads as machinery rather than as a launch.
     */
    HOIST_UP_SPEED: 120,
    /** px/s back down to its park once it is empty. Slower, because nobody is waiting on it. */
    HOIST_DOWN_SPEED: 90,
    /**
     * s for the weather to clear once GCC-BOT is engaged.
     *
     * This screen does not put the ANSR bubble on the player (owner call) — it lifts
     * the gloom off the market instead. 1.6s is slower than the arms coming up
     * (`ARM_LIFT_TIME` 0.45) and faster than the exodus (~4s), so the three beats of
     * the payoff land in an order: the arms, the sky, the walk home.
     */
    CLEAR_SKY_TIME: 1.6,
  },
  /**
   * The Workplace (Screen 3 — owner-specified, and the screen that replaced Local
   * Expertise entirely).
   *
   * A broken office: flickering lights, wet floor signs, caution tape over
   * everything, and one figure mummified in three layers of that same tape
   * trudging the floor. Two things make this screen unlike anything else here:
   *
   *  - **The obstacle is a metronome.** He paces his corridor **to and fro** at a
   *    single constant speed, pausing to turn at each end (owner call: he used to
   *    loop back to his start column, and a figure that vanishes at one end and
   *    reappears at the other reads as a respawn bug rather than as a person). A
   *    compliance monster is unreadable on purpose (§4.9); this
   *    figure is the opposite — the whole point is that you *can* read him from
   *    behind the partition wall and decide when to move. Which is also why the
   *    player spawns behind that wall: he is out of reach on frame one.
   *  - **The badge hands the player a verb.** `UNWRAP` makes a cutter appear and
   *    the shoot button live; three hits strip the three layers. He does not die.
   *    The colleague underneath goes straight to the sparking terminal, and *his*
   *    work is what clears the tape, the signs and the dark. The blocker becomes
   *    the person who puts it right, which is the entire argument of the screen.
   */
  WORKPLACE: {
    /**
     * px/s. Deliberately well under the player's 260 so the pass is a decision
     * rather than a race: one length of the authored corridor is ~4.7s, so reading
     * one leg from behind the partition is a beat rather than a wait.
     *
     * Now that he paces **to and fro**, this number also decides whether the screen
     * can be crossed at all unassisted. It can, and the move is to meet him head on:
     * a jump clears his 78px crown for 0.455s, and against an oncoming figure the
     * closing speed is 260 + 150 = 410 px/s, so the 88px that have to pass under the
     * player take 0.21s. Overtaking him from behind is deliberately *not* possible
     * (110 px/s of relative speed needs 0.8s of air), which is what stops "hold
     * right" from being an answer. Raising this narrows the head-on window; lowering
     * it makes overtaking possible. Either way, re-run `screen3.test.ts`.
     */
    WALK_SPEED: 150,
    /**
     * px: the hitbox, and exactly what is drawn (`render/workplace.ts` authors
     * 20×26 cells at scale 3).
     *
     * Measured against the *drawn* hero, not his hitbox: the player is a 28×44 box
     * painted as a 48×60 figure, so the first attempt at 34×52 — the compliance
     * monster's size — stood next to him like a child and rasterised as a striped
     * blob rather than a body. At 60×78 he is the tallest thing on the floor, which
     * is what a mummy in a doorway is supposed to be.
     *
     * The width includes the outstretched arms. That is the read that makes the
     * silhouette a mummy rather than a man in a bad shirt, and they are real art, so
     * the box stays honest.
     */
    MUMMY_W: 60,
    MUMMY_H: 78,
    /** Layers of caution tape, i.e. hits needed to free him. */
    TAPE_LAYERS: 3,
    /**
     * s he stands at each end of his corridor before setting off the other way.
     *
     * This replaced `RETURN_TIME`, the beat he used to spend *snapping back* to his
     * start column, and the swap deletes a whole class of unfairness rather than
     * tuning it: nothing teleports any more, so there is no frame on which a lethal
     * 60×78 body can materialise on top of a standing player, and the phase does not
     * have to be harmless to be fair. What it buys instead is a **telegraph for the
     * reversal** — he is the one hazard on this floor you are meant to be able to
     * read, and a body that pivots on the spot for a third of a second announces the
     * turn where an instant flip would hide it.
     */
    TURN_TIME: 0.3,
    /*
     * ---------------------------------------------------------------------
     * The thrown bandage (owner call: "add a capability for the mummy to throw
     * the bandages at the player capturing him").
     * ---------------------------------------------------------------------
     *
     * He unwinds a length of his own tape and throws it down the floor. It is the
     * only ranged attack on the screen, and the only reason the figure is now a
     * threat before you are next to him — which is what makes the partition a place
     * to *read* him from rather than a place to be safe in.
     *
     * Every number below is set by one requirement: **the answer is to jump it, and
     * the jump has to be available.** The roll flies at the player's shins
     * (`THROW_FLOOR_OFF`), so clearing it needs 41px of a 140px jump; he stands
     * still for the whole wind-up *and* the throw, so every attempt costs him
     * ground; and only one roll is ever in the air, so the floor is never a wall.
     */
    /**
     * s between throws, measured from the frame one leaves his hand.
     *
     * Bracketed, like every other pace on this build: a jump is 0.75s of air and a
     * roll crosses his whole corridor in ~2.4s, so anything under ~2s would put a
     * second roll in front of a player still landing from the first. Raising it makes
     * him decoration again; lowering it makes the corridor a wall. Re-run
     * `screen3.test.ts`, which plays the screen.
     */
    THROW_INTERVAL: 2.9,
    /**
     * s before his FIRST throw of an attempt.
     *
     * The screen has to be readable before it is played (the same debt the dragon's
     * roar pays on screen 4): the player arrives behind the partition, watches one leg
     * of the patrol, and only then has something thrown at them.
     */
    THROW_FIRST_DELAY: 2.2,
    /**
     * s of wind-up, standing still, before the roll leaves his hand.
     *
     * This is the telegraph, and it is long on purpose — 0.55s is longer than the
     * stamps' 0.34s warning, because the tell is 500px away from the player rather
     * than directly over them. He raises the coil over the shoulder of whichever
     * side he is facing, so the tell is on the thing that is about to act.
     */
    THROW_WINDUP: 0.55,
    /**
     * px/s the roll travels. **Under** the player's 260 on purpose: a projectile
     * faster than the player is one you can only jump, and this one can also be
     * backed away from, which is what keeps "read him and pick your moment" the
     * skill of the screen rather than reaction time.
     */
    THROW_SPEED: 210,
    /**
     * px: the roll's hitbox, and exactly what is drawn (`render/workplace.ts`).
     * A hazard sprite is its hitbox — no exceptions, and the streamers trailing
     * behind it are drawn outside the box and are inert.
     */
    THROW_W: 26,
    THROW_H: 22,
    /**
     * px the roll's CENTRE flies above the floor line.
     *
     * 30 puts its box at 559..581 against a standing player's 556..600, so standing
     * still is a capture and 41px of rise clears it. It is deliberately low rather
     * than at chest height: a chest-high projectile is dodged by doing nothing on a
     * screen with no crouch, and a head-high one is invisible behind the props.
     */
    THROW_FLOOR_OFF: 30,
    /**
     * px: he only throws at a player this close, and only at one he is facing.
     *
     * 620 is a shade under the corridor's own length, so a player standing behind the
     * partition at the far end can still be reached — the point of the attack is that
     * the partition stops being a place to wait — while a player who has already run
     * past him is left alone rather than shot in the back from off-frame.
     */
    THROW_RANGE: 620,
    /**
     * px: he will NOT throw at a player closer than this.
     *
     * At point-blank the roll spawns already overlapping the player, which is a hit
     * with no telegraph — the unfair-not-hard failure the stamps' `WARN_TIME` exists
     * to prevent. Inside this distance his body is the threat, which is the fight the
     * screen was already about.
     */
    THROW_MIN_RANGE: 150,
    /** px/s the fire orb travels. Fast enough to feel like a tool, slow enough to watch. */
    SHOT_SPEED: 620,
    /**
     * px: the orb's hitbox, and exactly what is drawn.
     *
     * It was an 18×6 sliver — a bullet — and the owner asked for "small orbs of fire
     * that burn the bandages". An orb has to be roughly square to read as one at
     * all, and 20×16 is the smallest that carries a white-hot core, a body and a
     * dark rim in 4px cells. Widening it is a gameplay change in the player's
     * favour, which is the right direction for the one screen where the badge hands
     * over a verb rather than a shield.
     */
    SHOT_W: 20,
    SHOT_H: 16,
    /**
     * s a stripped layer spends burning off him.
     *
     * The layer is gone from the simulation the instant the orb lands (the hit is
     * the hit), so this only drives the picture: embers running along the band it
     * came off, the band charring, and ash falling away. It is deliberately shorter
     * than `SHOT_COOLDOWN × 2` so a burn can never still be running when the layer
     * *after* it comes off — two overlapping burns read as one smear.
     */
    BURN_TIME: 0.42,
    /** s between shots — enough that three hits read as three separate acts. */
    SHOT_COOLDOWN: 0.22,
    /** Live pulses at once. Bounded so the array can never grow without limit. */
    MAX_SHOTS: 3,
    /** s he stands still as the last of the tape falls away. */
    UNRAVEL_TIME: 0.7,
    /** px/s he covers the floor to the terminal. Faster than the player: he is keen. */
    RUN_SPEED: 300,
    /** s at the keyboard before the terminal chimes success. */
    WORK_TIME: 1.6,
    /** s for the room to come good after the chime (lights up, tape and signs gone). */
    RESTORE_TIME: 1.2,
  },
} as const;

/** Camera is FIXED per screen (no scroll). Kept for shake only. */
export const CAMERA = {
  SHAKE_ON_SETBACK: 0.18,   // s
  SHAKE_MAGNITUDE: 5,       // px
} as const;

/** Accessibility / assist options (see UX doc). All default OFF unless noted. */
export const ASSIST = {
  REDUCED_MOTION_DEFAULT_FROM_OS: true, // respect prefers-reduced-motion
  SLOW_MODE_TIME_SCALE: 0.7,            // optional 30% slowdown
  NO_SETBACKS: false,                   // "just explore" mode toggle
  EXTRA_TELEGRAPH_BONUS: 0.25,          // s added to all telegraphs when ON
  /** One-tap play: the hero runs forward, a single tap acts. Default on touch. */
  AUTO_RUN_DEFAULT_ON_TOUCH: true,
} as const;

/** Brand palette (from ANSR Brand Style Guide 2022) — engine reference only. */
export const BRAND = {
  DEEP_TEAL: '#00242E',
  LIGHT_TEAL: '#005465',
  ORANGE: '#FF5400',
  LIGHT_GREY: '#E6E6E6',
  WHITE: '#FFFFFF',
} as const;
