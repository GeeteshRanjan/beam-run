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
  /** How long the life-lost screen holds before it advances itself (s). */
  LOST_HOLD: 2.6,
  /** Input is ignored for this long so the screen cannot be skipped blind (s). */
  LOST_SKIP_AFTER: 0.45,
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
   * The badge floats along a straight vertical line: it rises and falls through
   * a band of ±FLOAT_AMPLITUDE px around its authored anchor, one full cycle
   * every FLOAT_PERIOD seconds (~60 px/s average — a drift you can read and
   * time, not a bob and not a target you have to chase).
   *
   * This motion is GAMEPLAY, not juice: the hitbox moves with it, so the sim and
   * the renderer must derive the position from the same function of sim time
   * (`badgeCenter` in world/badgeFloat.ts). It is therefore not disabled under
   * `prefers-reduced-motion` — doing so would change the hitbox.
   */
  FLOAT_AMPLITUDE: 48,              // px above/below the anchor
  FLOAT_PERIOD: 3.2,                // s for one full up-and-down cycle
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
     * 1.8 is not a feel number, it is a measured one. A stamp column plus the
     * player is 124px wide, which takes ~0.48s to clear at walk speed, so the
     * fully-safe part of the cycle (CYCLE − DROP − HOLD − LIFT − WARN = 0.86s)
     * has to stay comfortably above that or the screen stops being a test and
     * starts being a wall. A probe that drives the stage with a reactive policy
     * could not clear it at 1.5s; it can at 1.8s.
     */
    CYCLE: 1.8,
    DROP_TIME: 0.14,          // s of the slam itself (too fast to react to)
    HOLD_TIME: 0.34,          // s held flat on the floor
    LIFT_TIME: 0.24,          // s to rise back to the ceiling
    /**
     * s of visible wind-up before the slam, at the END of the cycle.
     *
     * Every hazard in this game telegraphs (fire glows, spikes mark the landing);
     * a stamp that dropped with no tell was the one that did not, and it was
     * unfair rather than hard — the drop is 0.14s, so by the time the head moves
     * you are already under it. Nothing about the geometry changes during the
     * wind-up, only the picture.
     */
    WARN_TIME: 0.22,
    /** px: head bottom while parked, i.e. how far it hangs into the frame. */
    REST_BOTTOM: 64,
    /**
     * px: hitbox = the pressing face. Drawn exactly this wide, never wider.
     * 96 rather than a tidier 80 because the face has to carry the word DENIED at
     * bitmap scale 2 (~71px) inside its plate — at 76 the D and the D fell off
     * the plate onto the frame, which is the only thing this hazard has to say.
     */
    WIDTH: 96,
    /** px: height of the stamp head (the block that carries the DENIED face). */
    HEAD_H: 88,
    /**
     * Assisted (1Wrk): approvals move at ANSR speed, so the whole mechanism runs
     * at this fraction of real time. 0.26 turns a 1.5s cycle into ~5.8s and the
     * safe gap into ~3s — wide enough to walk through at a stroll.
     */
    ASSIST_TIME_SCALE: 0.26,
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
  FIRE: {
    INTERVAL: 2.2,            // s between drop cycles on a lane
    TELEGRAPH: 0.6,           // s warning glow before flame is lethal
    ACTIVE: 0.8,              // s flame is lethal
    LANE_PHASE_OFFSET: 0.7,   // s stagger between adjacent lanes
    /** Assisted (Talent500): lanes within this distance ahead go out for good. */
    EXTINGUISH_RADIUS: 260,
    DOUSE_FADE: 0.35,         // s for a doused lane to visibly go out
  },
  GATES: {
    SWAY_PERIOD: 2.0,         // s full oscillation of an approval barrier
    SWAY_AMPLITUDE: 34,       // px lateral sweep
    /** Assisted (GCC-BOT): gates within this distance ahead open for good. */
    OPEN_RADIUS: 240,
    OPEN_TIME: 0.28,          // s for a barrier arm to lift
    // per-gate phase offsets live in levels.json to force gap-reading
  },
  SPIKES: {
    INTERVAL: 2.5,            // s between drop cycles
    TELEGRAPH: 0.5,           // s warning before it falls
    FALL_SPEED: 900,          // px/s descent
    REST_TIME: 3.0,           // s it stays as a ground obstacle after landing
    DESPAWN_FADE: 0.3,        // s fade-out after rest
    /**
     * Assisted (500Leaders): how far ahead a foreseen drop is previewed (s).
     * Only the *preview* window changes — the drop rhythm is untouched, so
     * nothing teleports when the badge is collected. Knowledge, not magic.
     */
    FORESIGHT_TELEGRAPH: 1.8,
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
