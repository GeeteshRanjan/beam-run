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
 * The journey clock — the ONE currency of the run.
 *
 * There are no lives and no game over. Market-entry problems do not kill the
 * player, they cost **time**, which is the currency every GCC buyer actually
 * feels. A clean assisted run lands exactly on ANSR's published benchmark; the
 * total is capped below the going-alone baseline, so leaning on ANSR always
 * beats doing it alone (the story can never invert).
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
  /** Grace period after a setback so you cannot chain-lose months (s). */
  SETBACK_INVULN: 1.1,
  /** Count-up duration for the closing months readout (s). */
  MONTHS_COUNT_UP_S: 1.2,
} as const;

/** Run-wide progression state. */
export const RUN = {
  /**
   * Quick wins (the collectibles) are flavour only: they are counted, never
   * scored, and never gate progress — so the closing figure stays a single,
   * credible number (months) instead of an arcade score.
   */
  KEEP_COLLECTED_ON_SETBACK: true,
} as const;

/** Screen transitions. */
export const TRANSITION = {
  TITLE_CARD_HOLD: 1.2,     // s auto-advance
  TITLE_CARD_SKIP_AFTER: 0.4, // s before input may skip (prevents accidental skip)
  FADE: 0.18,               // s cut-to-black on transition
  /** Brief hold while a setback registers (feel only, no state change). */
  SETBACK_HOLD: 0.3,
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
  PICKUP_BOB_AMPLITUDE: 6,          // px idle bob
  PICKUP_BOB_PERIOD: 1.6,           // s
} as const;

/** Hazard behaviour, per family. */
export const HAZARDS = {
  QUICKSAND: {
    SINK_SETBACK_TIME: 1.4,   // s of continuous contact before a delay is booked
    SINK_VISUAL_RATE: 18,     // px/s the avatar visibly sinks while in contact
    /**
     * Drag while wading the shallow struggle sludge. Deliberately low: at 0.55
     * the hero still moved at 143 px/s and playtesting could not tell the sludge
     * from dry ground, which quietly killed the screen's whole claim. 0.26 →
     * ~68 px/s, so the 8-tile wade takes ~4.7s instead of ~1.2s.
     */
    WALK_SPEED_MULT: 0.26,
    /** The deep pit is worse still — you barely inch forward once you're in it. */
    DEEP_WALK_SPEED_MULT: 0.14,
    /**
     * Jump strength while standing in the shallow sludge. A full jump carries
     * ~140px, which meant the wade could be cleared in one leap (and chained
     * hops skipped it whatever its length) — the drag was optional, so the
     * screen's claim went unfelt. At 0.55 the hop clears ~1 tile of height and
     * ~2 tiles of ground: enough to still reach anything the level asks for,
     * far too little to vault the zone.
     */
    SLUDGE_JUMP_MULT: 0.55,
    /**
     * How far above the shallow sludge its drag still applies (px). Damped jumps
     * peak ~42px up, so the whole hop stays inside this band: hopping across the
     * wade is no longer faster than walking it, which is the point — you cannot
     * hop over setup delays. Above the band, full control returns instantly.
     */
    SLUDGE_AIR_HEIGHT: 56,
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
