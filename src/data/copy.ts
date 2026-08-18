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
    powerLabel: 'ANSR engaged',
    livesLabel: 'Lives',
    /** Full sentence, for the life-lost screen and the plaque's label. */
    lives: (left: number, total: number) => `${left} of ${total} lives left`,
    /**
     * The plaque's own reading. Deliberately not the sentence above: the plaque
     * already carries the caption "Lives", so the long form said "Lives: 1 of 3
     * lives left".
     */
    livesValue: (left: number, total: number) => `${left} of ${total}`,
    /**
     * The delay log hanging from the top of the frame. "Delay log" rather than
     * anything with the word "death" in it: the register throughout is that the
     * system cost you time, not that you failed.
     */
    logLabel: 'Delay log',
    logTotal: 'Total',
    logRow: (label: string, months: number) => `${label} +${months}`,
    logEarlier: (count: number) => `+${count} earlier`,
    logMonths: (months: number) => `+${months} months`,
    /**
     * The one sentence the panel says out loud. A screen reader walking a growing
     * table of "+2" cells learns nothing; the running total is the finding. The
     * label is not repeated here — the plaque already carries it.
     */
    logSummary: (count: number, months: number) =>
      `${count === 1 ? '1 delay' : `${count} delays`}, +${months} months`,
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
    /* The two screens with nothing to defend against still carry the mark. */
    SAFE_PASSAGE: 'Badge taken',
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
   * Setbacks cost months *and* a life. Every line still names the **system** as
   * the cause — the player is never told they failed, only what the obstacle
   * took. That distinction is the whole reason this game can be shown to a buyer:
   * the hazards are their reality, not their mistakes.
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
  },

  /**
   * The life-lost screen. Two jobs, one surface.
   *
   * With lives left it is coaching, and it has exactly one instruction: take the
   * ANSR badge. That line is the reason the screen exists — a player who loses a
   * life and is told only "try again" learns nothing about why the badge is
   * there. It names the obstacle, shows what the obstacle cost, and sends them
   * back into the same stage.
   *
   * Note the headline: the stage stalled, not the player. Same rule as the
   * setback lines.
   */
  lifeLost: {
    title: 'The stage stalled.',
    /** Interpolated with the obstacle tag, e.g. "Red tape stopped the build." */
    cause: (obstacle: string) => `${obstacle} stopped the build.`,
    cost: (months: number) => `That is ${months} more months on the clock`,
    livesLeft: (left: number) => (left === 1 ? '1 life left' : `${left} lives left`),
    /**
      * The instruction. This is the point of the screen. It is wrapped into
      * bitmap lines at render time rather than authored twice — two copies of the
      * same sentence is two places for it to drift.
      */
    advice: 'Take the floating ANSR badge and you clear the hurdles safely.',
    cont: 'Keep going',
  },

  /**
   * Out of lives. Not a wall and not a scolding — the closing ledger.
   *
   * Everything the run lost is itemised by obstacle, totalled, and followed by
   * the one sentence the ledger is evidence for. Then the same two routes every
   * other end screen offers: play again, or talk to us. An attempt that ends
   * here still ends on a conversion surface.
   */
  gameOver: {
    title: 'Out of runway.',
    reached: (name: string) => `The build stalled at ${name}.`,
    ledgerTitle: 'Where the time went',
    /**
     * The headline cost. It names the delays rather than repeating the ledger's
     * own total label, which is the same figure two inches lower.
     */
    cost: (delays: number, months: number) =>
      `${delays === 1 ? '1 delay' : `${delays} delays`} cost ${months} months`,
    totalLabel: 'Months added by delays',
    /** The argument the ledger is evidence for. */
    advice: 'Take the ANSR badge at every stage and these months never happen.',
    restart: 'Back to the start',
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
    /**
     * The delay line on the closing receipt, in place of the old quick-win
     * count. A clean run gets the credit; anything else gets the itemised cost,
     * because that is the number the Navigator conversation starts from.
     */
    delaysNone: 'No delays. Nothing avoidable left on the clock.',
    delays: (count: number, months: number) =>
      `${count === 1 ? '1 delay' : `${count} delays`} added ${months} months`,
    delayRow: (label: string, count: number, months: number) =>
      count > 1 ? `${label} x${count}  +${months}` : `${label}  +${months}`,
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

  fallback: {
    title: 'ANSRcade: The GCC Game',
    body: 'Play the journey before you plan it.',
    play: 'Play',
    skip: 'Skip to the Navigator \u2192',
    dataUse: 'How we use data',
  },

  a11y: {
    canvasLabel:
      'ANSRcade: The GCC Game — a short platformer about building an India GCC. Use arrow keys to move and Space to jump. You have three lives; each obstacle costs one and adds months to the clock.',
    screenEntered: (name: string) => `Entering ${name}.`,
    setback: (reason: string, months: number) => `${reason} That is ${months} more months.`,
    livesLeft: (left: number) =>
      left === 1 ? 'One life left.' : `${left} lives left.`,
    outOfLives: (months: number, delays: number) =>
      `Out of lives. ${delays} delays added months, for a total of ${months} months. ` +
      'Take the ANSR badge at every stage and those months never happen.',
    won: (months: number) =>
      `Market entry complete. You went live in ${months} months and reached the ANSR Tech Park.`,
    summary: 'Your journey so far, with the ANSR capabilities you engaged.',
  },
} as const;

export type Copy = typeof COPY;
