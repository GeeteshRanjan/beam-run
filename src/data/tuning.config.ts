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

/** Run-wide progression state. */
export const RUN = {
  STARTING_LIVES: 3,
  POINTS_PER_PICKUP: 5,     // "Growth Points" value each
  // Points model (RESOLVED open question): points from *completed* screens are
  // banked permanently. Within a screen, collected pickups stay collected across
  // mid-screen respawns (they do NOT reappear) and their value counts immediately.
  KEEP_COLLECTED_ON_RESPAWN: true,
} as const;

/** Screen transitions. */
export const TRANSITION = {
  TITLE_CARD_HOLD: 1.2,     // s auto-advance
  TITLE_CARD_SKIP_AFTER: 0.4, // s before input may skip (prevents accidental skip)
  FADE: 0.18,               // s cut-to-black on death/transition
} as const;

/** Powerups (ANSR badges). Each maps to a real ANSR capability (see GDD §Meaning). */
export const POWERUPS = {
  FIRE_SHIELD: { duration: 5.0 },   // Level 2 — maps to Talent500 / 500Flex
  PASS_THROUGH: { duration: 4.0 },  // Level 3 — maps to Assisted / entity setup
  FREEZE: { duration: 4.0 },        // Level 4 — maps to 500Leaders / advisory
  // Level 1 tile is PERMANENT for the attempt → no duration key.
  PICKUP_BOB_AMPLITUDE: 6,          // px idle bob
  PICKUP_BOB_PERIOD: 1.6,           // s
} as const;

/** Hazard behaviour, per family. */
export const HAZARDS = {
  QUICKSAND: {
    SINK_KILL_TIME: 1.4,      // s of continuous contact before death
    SINK_VISUAL_RATE: 18,     // px/s the avatar visibly sinks while in contact
    WALK_SPEED_MULT: 0.55,    // movement drag while touching quicksand
  },
  FIRE: {
    INTERVAL: 2.2,            // s between drop cycles on a lane
    TELEGRAPH: 0.6,           // s warning glow before flame is lethal
    ACTIVE: 0.8,              // s flame is lethal
    LANE_PHASE_OFFSET: 0.7,   // s stagger between adjacent lanes
  },
  PLANTS: {
    SWAY_PERIOD: 2.0,         // s full oscillation
    SWAY_AMPLITUDE: 34,       // px lateral (or angular, see level data)
    // per-plant phase offsets defined in levels.json to force gap-reading
  },
  SPIKES: {
    INTERVAL: 2.5,            // s between drop cycles
    TELEGRAPH: 0.5,           // s warning before it falls
    FALL_SPEED: 900,          // px/s descent
    REST_TIME: 3.0,           // s it stays as a ground obstacle after landing
    DESPAWN_FADE: 0.3,        // s fade-out after rest
  },
} as const;

/** Camera is FIXED per screen (no scroll). Kept for shake only. */
export const CAMERA = {
  SHAKE_ON_DEATH: 0.25,     // s
  SHAKE_MAGNITUDE: 6,       // px
} as const;

/** Accessibility / assist options (see UX doc). All default OFF unless noted. */
export const ASSIST = {
  REDUCED_MOTION_DEFAULT_FROM_OS: true, // respect prefers-reduced-motion
  SLOW_MODE_TIME_SCALE: 0.7,            // optional 30% slowdown
  INVINCIBLE_PRACTICE: false,           // "just explore" mode toggle
  EXTRA_TELEGRAPH_BONUS: 0.25,          // s added to all telegraphs when ON
} as const;

/** Brand palette (from ANSR Brand Style Guide 2022) — engine reference only. */
export const BRAND = {
  DEEP_TEAL: '#00242E',
  LIGHT_TEAL: '#005465',
  ORANGE: '#FF5400',
  LIGHT_GREY: '#E6E6E6',
  WHITE: '#FFFFFF',
} as const;
