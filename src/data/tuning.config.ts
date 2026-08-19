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
     * `MARGIN` off the right. 1,440px in 2.6s ≈ 554 px/s.
     *
     * **This number is set by one-tap play, not by feel.** On touch the move pad is
     * hidden and the hero runs right on his own, so a badge lying on the floor is only
     * collectable if it lands *in front of* him. A drone at 277 px/s (the first value,
     * barely over the player's 260) can never get far enough ahead to do that: it
     * released over gx 6 while the auto-runner was already at x≈480, and a probe of the
     * whole stage never picked the badge up once. At 554 the drone overtakes, drops the
     * mark ~90px ahead of him, and he walks onto it a third of a second later.
     */
    CROSS_TIME: 2.6,
    /** px it starts and finishes off-frame, so it enters and leaves rather than appearing. */
    MARGIN: 80,
    /** s of quiet after it leaves before the next one comes in. */
    GAP: 2.2,
    /** s the parcel takes to reach the ground once released. */
    FALL_TIME: 0.55,
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
     * taught us: at 200×190 it is four heroes wide and three tall, which is the
     * smallest size at which this reads as a boss rather than as a large lizard.
     *
     * The box's **bottom sits on the ground band** — it stands, it no longer flies
     * (owner call), so there is no hover row in level data any more and nothing
     * derives its height from one. Its head is drawn *above* the box, the way the
     * tail and the feet are drawn slightly outside it: the box is what water has to
     * hit, not an outline of the animal.
     */
    BODY_W: 260,
    BODY_H: 240,
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
     * The beast stands over gx 23–29 with its jaw around x≈1014 and 138px off the
     * floor (`MOUTH_Y_FRACTION` — it is a Godzilla, so the skull is the top of the
     * silhouette), so 600px puts the far end of the fire at x≈414 and still leaves
     * the spawn and the first two drop columns as the place the pattern is read from.
     *
     * The part of that lane which is lethal to a *standing* player starts where the
     * cone's lower edge drops past a standing head — about 37% of the way out, because
     * the jaw is high and the flame takes that long to come down — so the dangerous
     * floor is roughly x 414–793: 379px, or ~1.57s to walk clear of with the player's
     * own width. Against 1.75s of safe floor per cycle (`BURST_GAP` + `BURST_WINDUP`)
     * that is a dash a reading player wins and a blind sprint loses, which is the
     * balance two earlier tunings of this screen failed in the other direction,
     * clearing it 8/8 with no delays. **A high jaw makes the lane shorter, not
     * longer**: raise `MOUTH_Y_FRACTION` and this number has to go up with it.
     */
    CONE_REACH: 560,
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
     * "Slightly diverging" in numbers — a 2.1× spread over 600px, i.e. under 4° off
     * the axis either side. Wide enough that the far end of the cone covers the whole
     * of a standing player (44px) with margin, narrow enough that it still reads as a
     * *jet* rather than as a fan: this is an atomic breath, not a flamethrower fan.
     *
     * The near figure is also why the strip under the jaw is safe. The axis starts
     * 138px up and only meets the floor at the end of its reach, so the near end of
     * the cone passes over a standing head — and that pocket is deliberate. A beast
     * that sets fire to its own feet is a beast whose fire nobody believes, and it
     * gives "get in close" a meaning on a screen whose body is not a hitbox.
     */
    CONE_NEAR_H: 120,
    CONE_FAR_H: 190,
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
     * s between jets, and live jets at once (bounded, so the array cannot grow).
     *
     * 0.24 rather than the cutter's 0.22 and emphatically not lower: at 0.16 four
     * hits was 0.64s of held button, and a boss with a five-candidate payoff that
     * comes apart inside a second is not a fight. Together with the retaliation every
     * hit provokes (`strike`), this makes the exchange a rhythm you can hear.
     */
    WATER_COOLDOWN: 0.24,
    MAX_WATER: 5,
    /**
     * s knocked off the remaining burst by one jet crossing the cone.
     *
     * This is what "water overpowers the fire a bit" is, in numbers: three jets end
     * a 1.2s burst early rather than one jet switching it off, so the exchange is a
     * contest you win instead of a button you press. 0.42 is `BURST_TIME / 3` rounded
     * up, and a test holds it there — at 0.34 it took four, which is more jets than
     * the whole costume needs and made putting the fire out the harder job.
     */
    QUENCH_TIME: 0.42,
    /**
     * Jets on the dragon needed to take the glasses off (only between bursts).
     *
     * The costume is **one piece** now (owner call: glasses, no jacket and no tie),
     * so this is no longer "one hit per garment" — the four hits crack the lenses
     * progressively and the last one washes them off the snout. The pips over the
     * beast and the state of the glass are the same health bar they always were.
     */
    HITS_TO_STRIP: 4,
    /** s the costume takes to come apart once the last jet lands. */
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
    /** Candidates inside the costume, and how long they take to land. */
    CANDIDATES: 5,
    CANDIDATE_FALL_TIME: 0.8,
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
  },
  /**
   * The Workplace (Screen 3 — owner-specified, and the screen that replaced Local
   * Expertise entirely).
   *
   * A broken office: flickering lights, wet floor signs, caution tape over
   * everything, and one figure mummified in three layers of that same tape
   * trudging the floor. Two things make this screen unlike anything else here:
   *
   *  - **The obstacle is a metronome, not a patrol.** He walks one way only, at a
   *    single constant speed, and loops back to his starting column instead of
   *    turning around. A compliance monster is unreadable on purpose (§4.9); this
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
     * rather than a race, and high enough that waiting for the loop is a beat
     * (~5s over the authored corridor) rather than a wait.
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
     * s spent looping back to the start column. He is **harmless** for this whole
     * beat and drawn fading in where he restarts, because materialising a lethal
     * body on top of a player standing at the start of the corridor is the
     * unfair-not-hard failure the DENIED stamps already taught us. 0.6s is 156px
     * of escape at walk speed.
     */
    RETURN_TIME: 0.6,
    /** px/s the cutter's pulse travels. Fast enough to feel like a tool, slow enough to watch. */
    SHOT_SPEED: 620,
    SHOT_W: 18,
    SHOT_H: 6,
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
