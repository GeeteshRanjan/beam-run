/**
 * All user-facing strings, in one place (i18n-ready). English at launch.
 *
 * Brand voice: confident, clear, understated. Understatement over exclamation
 * ("Value unlocked." not "You win!!!"). No hardcoded strings live in engine or
 * UI code — everything routes through here.
 *
 * Two rules specific to this build:
 *
 *  1. **Numbers are interpolated, never typed.** Month figures come from
 *     `JOURNEY` in tuning.config so the copy can never drift from the model.
 *  2. **Setback lines blame the environment, never the player.** These hazards
 *     are the buyer's current reality; "Red tape sent the filing back" is the
 *     register, "You failed" never is.
 */
import type { BadgeType } from './levels';

/**
 * The four ANSR capabilities, in journey order. This is the closing receipt —
 * the only place the product names are stated in full, and the thing a prospect
 * screenshots. `monthsSaved` sums to BASELINE_MONTHS − ANSR_BENCHMARK_MONTHS.
 */
export interface CapabilityCopy {
  badge: BadgeType;
  /** Real ANSR product/service name. */
  product: string;
  /** The market-entry stage it covers. */
  stage: string;
  /** What it does, in one clause. */
  effect: string;
  /** Months off the going-alone baseline (sums to the full gap). */
  monthsSaved: number;
  /** Non-PII topic slug carried into the Navigator deep link. */
  topic: string;
  /** Short uppercase tag for the in-world pixel label. */
  tag: string;
}

export const CAPABILITIES: readonly CapabilityCopy[] = [
  {
    badge: 'PLACE_TILE',
    product: '1Wrk',
    stage: 'Setup',
    effect: 'Entity, office and systems stood up once, properly',
    monthsSaved: 4,
    topic: 'setup',
    tag: 'ANSR 1WRK',
  },
  {
    badge: 'EXTINGUISH',
    product: 'Talent500',
    stage: 'Hiring',
    effect: 'Roles filled at scale without stalling the build',
    monthsSaved: 4,
    topic: 'talent',
    tag: 'TALENT500',
  },
  {
    badge: 'CLEAR_PATH',
    product: 'GCC-BOT',
    stage: 'Compliance',
    effect: 'Filings, tax and entity obligations handled',
    monthsSaved: 3,
    topic: 'compliance',
    tag: 'GCC-BOT',
  },
  {
    badge: 'FORESIGHT',
    product: '500Leaders',
    stage: 'Local expertise',
    effect: 'On-ground leadership and market context from day one',
    monthsSaved: 2,
    topic: 'expertise',
    tag: '500LEADERS',
  },
] as const;

/** Lookup a capability by badge type. */
export function capabilityFor(badge: string): CapabilityCopy | undefined {
  return CAPABILITIES.find((c) => c.badge === badge);
}

export const COPY = {
  meta: {
    /**
     * The game is **ANSRcade** (owner call). "The GCC Game" is the edition — the
     * first cabinet in the arcade — so the lockup reads `ANSRcade · THE GCC GAME`
     * and there is room for later editions without renaming anything.
     *
     * Note the internal package, module and CSS names stay `beam-run`: they are
     * not user-facing, and renaming the embed API (`window.BeamRun.mount`) would
     * break any host page already carrying the snippet.
     */
    name: 'ANSRcade',
    edition: 'The GCC Game',
    title: 'ANSRcade: The GCC Game',
    tagline: 'Play the journey before you plan it.',
    estimatedTime: '~90 seconds',
  },

  start: {
    title: 'ANSRcade: The GCC Game',
    /** The hook: a number a busy executive cannot scroll past. */
    stake: (months: number) => `The average India GCC takes ${months} months to go live.`,
    /**
     * The same sentence broken into three display lines, so it can be set in the
     * game's bitmap font with the figure at display size. `stake()` above stays
     * the single accessible sentence — these must always read as that sentence.
     */
    stakeLead: 'The average India GCC takes',
    stakeFigure: (months: number) => `${months} months`,
    stakeTail: 'to go live.',
    challenge: 'Think you can beat that?',
    controlsDesktop: 'Move: \u2190 \u2192   \u00b7   Jump: Space / \u2191',
    controlsTouch: 'Move: left pad   \u00b7   Jump: right button',
    controlsAutoRun: 'You run forward automatically. Tap to jump.',
    play: 'Start',
    skip: 'Skip to the Navigator',
    focusHint: 'Click or tap to play',
  },

  hud: {
    stageLabel: 'Stage',
    monthsLabel: 'Time to market',
    monthsUnit: 'months',
    quickWinsLabel: 'Quick wins',
    powerLabel: 'ANSR engaged',
  },

  pause: {
    title: 'Paused',
    resume: 'Resume',
    restart: 'Start over',
    assist: 'Assist options',
    mute: 'Mute',
    skip: 'Skip to the Navigator',
  },

  badgeToast: {
    // Interpolated with the capability, e.g. "ANSR engaged: Talent500."
    prefix: 'ANSR engaged',
  },

  /** Short label for the persistent HUD chip once a capability is engaged. */
  powers: {
    PLACE_TILE: 'Bridge laid',
    EXTINGUISH: 'Roles filled',
    CLEAR_PATH: 'Filings cleared',
    FORESIGHT: 'Local context',
  } as Record<string, string>,

  /** Per-screen "on clear" lines (mirrored in levels.json, centralised here). */
  onClear: {
    0: 'Approved on paper.',
    1: 'Setup accelerated.',
    2: 'Talent secured.',
    3: 'Compliance cleared.',
    4: 'Local expertise onboarded.',
    5: 'Live.',
  } as Record<number, string>,

  /**
   * Setbacks cost months, never lives. Every line names the *system* as the
   * cause — the player is never told they failed.
   */
  setback: {
    /** Short uppercase tag for the in-world popup (pixel font: A-Z 0-9 + - . , : ! ? / >). */
    tag: {
      delay: 'RED TAPE',
      fire: 'OFFER DECLINED',
      gate: 'FILING REJECTED',
      spike: 'NO LOCAL CONTEXT',
      fall: 'GROUND GAVE WAY',
    } as Record<string, string>,
    /** Full sentence for the aria-live announcement. */
    reason: {
      delay: 'Red tape. The filing went back to the start.',
      fire: 'An offer was declined. The hiring cycle restarts.',
      gate: 'Approval refused. The filing is resubmitted.',
      spike: 'No local context, so it was the wrong call.',
      fall: 'The ground gave way. Rebuilt from the last solid step.',
    } as Record<string, string>,
    months: (months: number) => `+${months} months`,
    tagMonths: (months: number) => `+${months} MONTHS`,
  },

  win: {
    title: 'Market Entry Complete.',
    /** Big headline figure. */
    monthsLabel: 'You went live in',
    monthsUnit: (months: number) => (months === 1 ? 'month' : 'months'),
    /** Two attributed reference lines — ANSR's data, not the player's score. */
    benchmark: (months: number) => `ANSR clients average ${months} months.`,
    baseline: (months: number) => `Going it alone, the average is ${months}.`,
    /*
     * No possessive: the 5×7 font has no apostrophe, so "ANSR's" rendered as
     * "ANSRS" and read like a typo on the biggest screen in the game.
     */
    matched: 'You matched the ANSR benchmark.',
    /** Labels on the closing comparison bars (your run vs the two references). */
    barYou: 'Your run',
    barAnsr: 'ANSR clients',
    barAlone: 'Going alone',
    receiptTitle: 'What got you here',
    /* Short enough to set on one bitmap line beside the list it introduces. */
    receiptHint: 'Pick one to talk about.',
    quickWins: (found: number, total: number) => `Quick wins found: ${found} of ${total}`,
    savesMonths: (months: number) => `saves ${months} months`,
    notReached: 'not reached',
    cta: 'Plan your real journey \u2192 GCC Opportunity Navigator',
    ctaGap: 'See what closes the gap \u2192 GCC Opportunity Navigator',
    replay: 'Play again',
  },

  /** Shown when someone leaves mid-run — nobody exits empty-handed. */
  summary: {
    title: 'Your journey so far',
    reached: (name: string) => `You reached ${name}.`,
    cta: 'See what closes the gap \u2192 GCC Opportunity Navigator',
    resume: 'Keep playing',
  },

  assist: {
    title: 'Assist options',
    intro: 'Play your way. These can be changed any time.',
    slowMode: 'Slow mode (\u221230% speed)',
    extraTime: 'Extra reaction time (+0.25s warnings)',
    noSetbacks: 'No setbacks (just explore)',
    autoRun: 'Auto-run (one-tap play)',
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

  /**
   * The custom not-found page for the standalone deployment.
   *
   * This exists because the two Navigator routes (the title screen's "Skip to
   * the Navigator" and the closing receipt) deep-link a path the static host
   * does not serve, so the last thing a prospect saw was the host's raw 404.
   * A dead end is a dead end whoever renders it, so the page is ours: same
   * cabinet, same bitmap type, one route back.
   */
  notFound: {
    pageTitle: 'Page not found \u2014 ANSRcade: The GCC Game',
    /** Big arcade figure. */
    code: '404',
    /** Accessible sentence behind the figure. */
    codeLabel: 'Error 404. Page not found.',
    title: 'Off the map.',
    body: 'This route is not part of the journey. The game is one press away.',
    play: 'Back to the game',
  },

  fallback: {
    title: 'ANSRcade: The GCC Game',
    body: 'Play the journey before you plan it.',
    play: 'Play',
    skip: 'Skip to the Navigator \u2192',
    dataUse: 'How we use data',
  },

  a11y: {
    canvasLabel:
      'ANSRcade: The GCC Game — a short platformer about building an India GCC. Use arrow keys to move and Space to jump. Setbacks cost time, never lives.',
    screenEntered: (name: string) => `Entering ${name}.`,
    setback: (reason: string, months: number) => `${reason} That is ${months} more months.`,
    monthsBooked: (total: number) => `Time to market now ${total} months.`,
    won: (months: number) =>
      `Market entry complete. You went live in ${months} months and reached the ANSR Tech Park.`,
    summary: 'Your journey so far, with the ANSR capabilities you engaged.',
  },
} as const;

export type Copy = typeof COPY;
