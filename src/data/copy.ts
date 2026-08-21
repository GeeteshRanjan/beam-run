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
 * The four ANSR capabilities, in journey order — setup, compliance, workplace,
 * hiring (Compliance moved up behind Setup Delays, and the Workplace screen
 * replaced Local Expertise outright). The order is asserted against the run itself (`core/golden.test.ts` walks every
 * screen and expects the badges it collects to be exactly this list), so it can
 * never drift from `levels.json`. This is the closing receipt —
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
    badge: 'CLEAR_PATH',
    product: 'GCC-BOT',
    stage: 'Compliance',
    effect: 'Entity, payroll, legal, tax and audit obligations handled',
    monthsSaved: 3,
    topic: 'compliance',
    tag: 'GCC-BOT',
  },
  {
    badge: 'UNWRAP',
    product: '500Leaders',
    stage: 'Workplace',
    effect: 'On-ground leaders who unblock the team instead of adding process',
    monthsSaved: 2,
    topic: 'workplace',
    tag: '500LEADERS',
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
    /*
     * There is no TIME TO MARKET plaque on the HUD any more (owner call): the
     * clock was the loudest thing on the frame, and the figure it showed only
     * moves when a delay is booked — which the delay log already reports, with
     * the reason attached. The months live where they are the argument: the
     * closing receipt. Lives took the plaque's place in the top-right.
     */
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
    PLACE_TILE: 'Setup stood up',
    EXTINGUISH: 'Roles filled',
    CLEAR_PATH: 'Filings cleared',
    /* Ordering note: the receipt lists capabilities in journey order, which is
     * setup → compliance → workplace → hiring. `CAPABILITIES` above is that
     * order. */
    UNWRAP: 'Team unblocked',
    /*
     * There is no `SAFE_PASSAGE` line any more. It read "Badge taken" and belonged to
     * the no-effect mark on Reception and the Tech Park; the owner has now deleted both
     * of those badges, so every entry in here is a capability that changed a screen.
     */
  } as Record<string, string>,

  /**
   * The card between two screens — a **briefing**, and it waits for the player
   * (owner call: stop before every stage, say in brief what the next one is, and
   * move on only when a button is pressed).
   *
   * Each line names the **real-world** problem in the language of the room the
   * player is walking into, so the buyer recognises their own programme in it with no
   * B2B vocabulary anywhere: "nothing here is approved the first time" is
   * resubmission loops · "nothing is filed in a straight line" is the filing chain ·
   * "the team is ready, the floor is not" is the enablement gap · "talent never
   * waits, and it never plays fair" is a contested market · "doors open, and a year
   * still in hand" is the entire argument with no figure in it.
   *
   * The first draft described the *mechanics* ("a staircase of queries", "he throws
   * his tape"): accurate, and it told the player nothing they would not see for
   * themselves ten seconds later. **A brief is the reason the screen exists, not a
   * description of it.**
   *
   * Three things it never does: name a product (the receipt is where ANSR answers —
   * tested), say how to beat the screen (that is the screen's job), or **echo a word
   * from the stage name printed directly above it.** The raster caught the last one
   * twice: COMPLIANCE over "compliance does not run in a straight line", and
   * WORKPLACE over "the workplace is not". Same defect as printing CONTINUE twice —
   * invisible in the source, obvious in the picture.
   *
   * **Two balanced bitmap lines, and that is a measurement, not a feel.** The card
   * sets these at a 26-character measure, so ~50 characters is the ceiling: at 60
   * the wrap needs a third line and the third line is always the last word on its
   * own — a widow sitting over the button. Check any change with `wrapPixelLabel`
   * (`ui.test.ts` fails a brief that needs three lines, or whose two lines are
   * lopsided). The 5×7 font has no apostrophe, so none of these carry one.
   *
   * The stage's *name* is not repeated here — the card already prints it, from
   * `Simulation.screenLabel`.
   */
  titleCard: {
    brief: {
      0: 'Every plan looks clean from the lobby.',
      1: 'Nothing here is approved the first time.',
      2: 'Nothing is filed in a straight line.',
      3: 'The team is ready. The floor is not.',
      4: 'Talent never waits, and it never plays fair.',
      5: 'Doors open, and a year still in hand.',
    } as Record<number, string>,
    /**
     * The card advances on a press, and this cap is the whole of how it says so.
     *
     * **There is no keyboard prompt line, and two were tried.** "Press SPACE to
     * continue" printed CONTINUE twice, once on the cap and once directly under it;
     * "Or press SPACE" then read as a second, quieter button sitting on the first —
     * the eye takes two centred lines of chrome under a cap as one control that has
     * been drawn wrong. The card focuses this button, so Space and Enter already
     * activate it: the instruction was explaining something the browser does. Same
     * call the start screen made when its control legend came out ("stating them made
     * the title screen read as a manual"). Do not add a third one.
     */
    begin: 'Continue',
  },

  /** Per-screen "on clear" lines (mirrored in levels.json, centralised here). */
  onClear: {
    0: 'Approved on paper.',
    1: 'Setup accelerated.',
    2: 'Compliance cleared.',
    3: 'Workplace running.',
    4: 'Talent secured.',
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
      stamp: 'SETUP DENIED',
      fire: 'OFFER DECLINED',
      /*
       * The compliance monsters. The old 'gate' cause went with the separate
       * barriers: each monster now IS the barrier, so there is one line for it.
       */
      monster: 'QUERY RAISED',
      /*
       * The Workplace figure. The line names the *room*, never the person wrapped
       * up in it — he is the one who fixes the place two beats later, so calling
       * him the obstacle would undercut the whole screen.
       */
      mummy: 'WORKPLACE BLOCKED',
      fall: 'GROUND GAVE WAY',
    } as Record<string, string>,
    /** Full sentence for the aria-live announcement. */
    reason: {
      stamp: 'Setup denied. The paperwork goes back to the start.',
      fire: 'An offer was declined. The hiring cycle restarts.',
      monster: 'A compliance query came back. The stage waits on an answer.',
      mummy: 'The workplace is still taped off. Nobody can get to work.',
      fall: 'The ground gave way. Rebuilt from the last solid step.',
    } as Record<string, string>,
    months: (months: number) => `+${months} months`,
  },

  /**
   * Losing a life no longer shows a screen at all (owner call): the stage simply
   * starts again. What is left of the old coaching overlay is this one line,
   * printed under the stage name on the title card of a retry — the teaching beat
   * ("the badge is why this happened") without a dialog to dismiss.
   *
   * Kept deliberately short: it is read in the second and a half a title card is
   * on screen, and the full sentence still reaches assistive tech through the
   * setback announcement (`a11y.setback` + `a11y.livesLeft`).
   */
  lifeLost: {
    retryHint: 'Take the ANSR badge',
  },

  /**
   * Out of lives — the only end-of-attempt screen there is now, and a conversion
   * surface rather than a wall.
   *
   * Deliberately four things and nothing else (owner call: less text, symmetrical,
   * low cognitive load): the headline, the one figure that matters, the argument
   * that figure is evidence for, and the two routes onward. The itemised ledger it
   * used to carry is gone — the same breakdown is on the closing receipt, and here
   * it was a table competing with the instruction.
   */
  gameOver: {
    title: 'Out of runway.',
    /** The one fact: what the delays cost, in a single line. */
    cost: (delays: number, months: number) =>
      `${delays === 1 ? '1 delay' : `${delays} delays`} cost ${months} months`,
    /** The argument that figure is evidence for. */
    advice: 'Take the ANSR badge and these months never happen.',
    restart: 'Start again',
    /**
     * The Navigator route, named rather than pitched.
     *
     * The other end screens use the sentence form ("See what closes the gap → GCC
     * Opportunity Navigator"), which wraps onto two bitmap lines. Beside an
     * eleven-character primary button that made the pair lopsided, and it is a
     * second sentence on a screen whose whole revision was about having fewer of
     * them. At 25 characters this still fits one line.
     */
    cta: 'GCC Opportunity Navigator',
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
    /**
     * The act button's label. Two badges arm a tool, and they arm two different
     * ones, so the button says what it does rather than naming a generic "fire".
     * `shoot` is the Workplace cutter and the default; `shootWater` is the hiring
     * dragon's cannon. Sentences, not bitmap type — these are aria-labels.
     */
    shoot: 'Cut the tape',
    shootWater: 'Spray water at the dragon',
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
