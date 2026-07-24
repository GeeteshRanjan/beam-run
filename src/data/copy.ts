/**
 * All user-facing strings, in one place (i18n-ready). English at launch.
 *
 * Brand voice: confident, clear, understated. Understatement over exclamation
 * ("Value unlocked." not "You win!!!"). No hardcoded strings live in engine or
 * UI code — everything routes through here.
 */
export const COPY = {
  meta: {
    title: 'Beam Run: Market Entry',
    tagline: 'Play the journey before you plan it.',
    estimatedTime: '~90 seconds',
  },

  start: {
    title: 'Beam Run: Market Entry',
    tagline: 'Play the journey before you plan it.',
    controlsDesktop: 'Move: ← →   ·   Jump: Space / ↑',
    controlsTouch: 'Move: left pad   ·   Jump: right button',
    play: 'Start',
    skip: 'Skip to the Navigator',
    focusHint: 'Click or tap to play',
  },

  hud: {
    livesLabel: 'Lives',
    pointsLabel: 'Growth Points',
    powerLabel: 'Active',
  },

  pause: {
    title: 'Paused',
    resume: 'Resume',
    restart: 'Restart',
    assist: 'Assist options',
    mute: 'Mute',
    skip: 'Skip to the Navigator',
  },

  badgeToast: {
    // Interpolated with the capability name, e.g. "Value unlocked: Talent500."
    prefix: 'Value unlocked',
  },

  /** Short power labels for the HUD indicator. */
  powers: {
    PLACE_TILE: 'Bridge',
    FIRE_SHIELD: 'Fire Shield',
    PASS_THROUGH: 'Pass-through',
    FREEZE: 'Freeze',
  } as Record<string, string>,

  /** ANSR capability each badge represents (for the pickup toast). */
  capabilities: {
    PLACE_TILE: '1Wrk / Assisted setup',
    FIRE_SHIELD: 'Talent500',
    PASS_THROUGH: 'Assisted / GCC-BOT compliance',
    FREEZE: '500Leaders advisory',
  } as Record<string, string>,

  /** Per-screen "on clear" lines mirror levels.json copy but are centralised. */
  onClear: {
    1: 'Setup accelerated.',
    2: 'Talent secured.',
    3: 'Entity compliant.',
    4: 'Local expertise onboarded.',
  } as Record<number, string>,

  gameOver: {
    title: 'Not this run.',
    subtitle: 'Market entry is hard alone.',
    retry: 'Try again',
    cta: 'See how ANSR de-risks it →',
  },

  win: {
    title: 'Market Entry Complete.',
    valuationLabel: 'Company Valuation',
    valuationUnit: 'pts',
    cta: 'Plan your real journey → GCC Opportunity Navigator',
    replay: 'Play again',
  },

  assist: {
    title: 'Assist options',
    intro: 'Play your way. These can be changed any time.',
    slowMode: 'Slow mode (−30% speed)',
    extraTime: 'Extra reaction time (+0.25s telegraphs)',
    invincible: 'Practice / invincible mode',
    largerControls: 'Larger touch controls',
    muteMusic: 'Music off',
    muteSfx: 'Sound effects off',
    close: 'Done',
    on: 'On',
    off: 'Off',
  },

  /** Touch control accessible labels. */
  controls: {
    moveLeft: 'Move left',
    moveRight: 'Move right',
    jump: 'Jump',
  },

  fallback: {
    title: 'Beam Run: Market Entry',
    body: 'Play the journey before you plan it.',
    play: 'Play',
    skip: 'Skip to the Navigator →',
    dataUse: 'How we use data',
  },

  a11y: {
    canvasLabel:
      'Beam Run: Market Entry — a short platformer about building an India GCC. Use arrow keys to move and Space to jump.',
    screenEntered: (name: string) => `Entering ${name}.`,
    died: (cause: string) => `Beam was lost to ${cause}. Respawning.`,
    won: 'Market entry complete. You reached the ANSR Tech Park.',
    gameOver: 'Game over. Market entry is hard alone.',
  },
} as const;

export type Copy = typeof COPY;
