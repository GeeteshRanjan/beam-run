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
 * screenshots.
 *
 * **There is no `monthsSaved` any more** (owner call). Each row used to claim a
 * figure ("saves 4 months") and the four summed to the gap between the going-alone
 * average and the ANSR benchmark — the two published statistics the end screens have
 * now dropped. With the benchmark gone that per-row figure is an unsourced number on
 * the one surface a prospect screenshots, so an engaged row states the **outcome**
 * instead (`COPY.powers`, e.g. "Setup stood up") — what ANSR actually did on the
 * stage the player just cleared.
 */
export interface CapabilityCopy {
  badge: BadgeType;
  /** Real ANSR product/service name. */
  product: string;
  /** The market-entry stage it covers. */
  stage: string;
  /** What it does, in one clause. */
  effect: string;
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
    topic: 'setup',
    tag: 'ANSR 1WRK',
  },
  {
    badge: 'CLEAR_PATH',
    product: 'GCC-BOT',
    stage: 'Compliance',
    effect: 'Entity, payroll, legal, tax and audit obligations handled',
    topic: 'compliance',
    tag: 'GCC-BOT',
  },
  {
    badge: 'UNWRAP',
    product: '500Leaders',
    stage: 'Workplace',
    effect: 'On-ground leaders who unblock the team instead of adding process',
    topic: 'workplace',
    tag: '500LEADERS',
  },
  {
    badge: 'EXTINGUISH',
    product: 'Talent500',
    stage: 'Hiring',
    effect: 'Roles filled at scale without stalling the build',
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
    /**
     * **The headline, and now the only sentence on the screen** (owner call).
     *
     * Everything else that has stood here has been deleted, in this order: the
     * 24-month industry average (an unsourced claim on the frame before the player has
     * played anything), "Think you can?" (a dare whose antecedent went with that
     * figure), the arcade contract "6 STAGES. 3 LIVES." (a spec sheet, rejected in its
     * own raster and never shipped), and finally the three-line hook "Any board can
     * approve a GCC. / BUILDING IT / is the hard part." — an argument, on a screen
     * whose job is to get somebody to press a button.
     *
     * What is left is the offer, and it is the line the rest of ANSR's material uses,
     * so the title screen and the deck say the same thing. It is set as the **title**
     * now that nothing is above it, on two balanced lines at a **20-character
     * measure** (20/19): at the body's own 34 the greedy wrap leaves one word alone
     * over a centred button, which is the widow the briefing cards were rewritten to
     * avoid. It carries the word GCC where `COPY.meta.tagline` does not — that one
     * labels the *game* in host chrome, this one is the promise.
     */
    tagline: 'Play the GCC journey before you plan it.',
    /**
     * The control guide, **drawn as key caps rather than written as a sentence**
     * (owner call: "for the guide show the buttons instead of text, and you have not
     * shown for fire").
     *
     * These two strings are what assistive tech and `textContent` get: the caps
     * themselves are decorative pixel artwork, so the legend needs one real sentence
     * behind it. They are also the only place the **act** button is named in words.
     * A legend was cut from this screen once for reading as a manual, so the
     * constraint is the size, not the fact: one row of small caps with a two- or
     * three-letter label each, in the dimmest ink on the screen, and **above** the
     * Start cap — a line of chrome under a button reads as a caption on the button.
     *
     * Which one is used depends on the device (`OverlayOptions.touch`): a phone player
     * has no arrow keys and gets one-tap play by default, so the caps become the
     * on-screen pads they will actually see.
     */
    controlsKeys: 'Arrow keys move. Space jumps. F fires an ANSR tool.',
    controlsTap: 'The pads move you, the big button jumps, the small one fires.',
    /**
     * The label under each cap in the legend. Two or three characters wherever the
     * word allows it, because a label wider than the cap it sits beside turns a row of
     * buttons into a row of words — which is what the owner asked to get away from.
     *
     * FIRE rather than SHOOT or CUT: one button does two jobs (the Workplace cutter
     * and the hiring dragon's water cannon) and it only exists once a badge has armed
     * one of them, so the legend names the *control*, not either tool. The per-tool
     * wording lives on the touch button's own `aria-label` (`COPY.controls`).
     */
    legend: { move: 'Move', jump: 'Jump', fire: 'Fire' },
    play: 'Start',
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
     * the no-effect mark on Head Office and the Tech Park; the owner has now deleted both
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
   * "the lease is signed, nothing works yet" is the enablement gap · "talent never
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
      /*
       * The Workplace. It used to read "The team is ready. The floor is not." — a
       * good line on the wrong screen (owner call): **hiring is the stage after
       * this one**, so a brief that opens with a team already in place promises
       * people the run has not recruited yet, and the argument of the next screen
       * ("talent never waits") reads as a contradiction of it.
       *
       * The problem this room is actually about is the one nobody budgets for: the
       * site is committed — signed, paid for, on the plan — and none of it works.
       * No power, no fit-out, half of it taped off. So the brief names the gap
       * between the property and a place anybody could do a day of work in, and it
       * names nobody, which is what keeps it true a screen early.
       */
      3: 'The lease is signed. Nothing works yet.',
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
   * ("the powerup is why this happened") without a dialog to dismiss.
   *
   * Kept deliberately short: it is read in the second and a half a title card is
   * on screen, and the full sentence still reaches assistive tech through the
   * setback announcement (`a11y.setback` + `a11y.livesLeft`).
   *
   * **The player-facing word is POWERUP, not badge** (owner call). "Badge" is what
   * the code calls it — the type, the module, the data key — and it is the wrong
   * word to hand a player: a badge is something you are *given* and wear, and this
   * is a thing you go and take that changes what the screen can do to you. Every
   * surface a player reads says powerup now (here, the out-of-lives argument and
   * both screen-reader lines); nothing in `src/` was renamed, because the internal
   * vocabulary is consistent and this is a copy decision, not a refactor.
   *
   * It is only printed on a card whose screen actually carries one — Head Office
   * and the Tech Park have no powerup at all (`Game.titleCardModel`).
   */
  lifeLost: {
    retryHint: 'Take the ANSR powerup',
  },

  /**
   * Out of lives — the only end-of-attempt screen there is now, and a conversion
   * surface rather than a wall.
   *
   * Deliberately three things and one route (owner call: less text, symmetrical, low
   * cognitive load): the headline, the one figure that matters, the argument that
   * figure is evidence for, and a cap back into the stage. The itemised ledger it used
   * to carry is gone — the same breakdown is on the closing receipt, and here it was a
   * table competing with the instruction — and so is the Navigator cap that stood
   * beside "Start again".
   */
  gameOver: {
    title: 'Out of runway.',
    /**
     * The caption over the figure, and the figure is the **same one the win screen
     * closes on** — months lost to delays (`win.lostLabel` / `win.monthsUnit`).
     *
     * It used to be one sentence at the size of every other line on the screen ("3
     * delays cost 6 months"), which is why the screen had no hierarchy: the one fact
     * that matters was set in the same type as the instruction under it and the
     * headline over it. Now it is a caption, a big orange numeral and a unit — the
     * arcade readout the closing screen already uses, so the two end screens report
     * the run in the same words and the same shape.
     *
     * The wording is this screen's own rather than `win.lostLabel`, because here the
     * unit is directly underneath it and "Months lost to delays" over a figure reading
     * "6 months" prints MONTHS twice in one column.
     */
    costLabel: 'What the delays cost',
    /**
     * The panel's small print: where the figure came from. Not `${months} months` in a
     * second place — a total and a restatement of the total in one column is the defect
     * the win screen's "What cost you" heading was written to fix.
     */
    fromDelays: (delays: number) =>
      delays === 1 ? 'From 1 delay.' : `From ${delays} delays.`,
    /*
     * The argument that figure is evidence for. POWERUP, not badge (see
     * `lifeLost.retryHint`); it still wraps to the same two balanced bitmap lines at
     * the 26-character measure — "TAKE THE ANSR POWERUP AND" / "THESE MONTHS NEVER
     * HAPPEN." — so the word is longer and the picture is not.
     *
     * "These months" is a **reference** to the figure printed directly above it, which
     * is the one licensed way to say a word twice in a column: it points at the number
     * rather than repeating it.
     */
    advice: 'Take the ANSR powerup and these months never happen.',
    /**
     * The only route off this screen (owner call: no Navigator button on the first
     * screen, this one, or the last). An attempt that ran out of lives has been shown
     * the argument and nothing else — the ask is that they play it again and take the
     * badge, not that they leave mid-lesson. The Navigator is still one press away
     * from the pause menu, and it is the whole right-hand column of the win receipt.
     */
    restart: 'Start again',
  },

  win: {
    title: 'Market Entry Complete.',
    /**
     * The closing figure, and it is **what the delays cost, not how long the run
     * took** (owner call).
     *
     * The screen used to headline the run's own total ("You went live in 14 months")
     * and then justify it with two published statistics — ANSR clients average 11,
     * going alone averages 24 — drawn as three comparison bars. All of that is gone:
     * an absolute month total means nothing without the two figures beside it, and
     * the two figures are unsourced averages printed on the surface a prospect
     * screenshots.
     *
     * Months lost to delays needs no benchmark. It is arithmetic the player watched
     * happen, obstacle by obstacle, and **zero is the reward** — the one closing
     * number a clean run can be proud of and a delayed run has to explain.
     */
    lostLabel: 'Months lost to delays',
    monthsUnit: (months: number) => (months === 1 ? 'month' : 'months'),
    /**
     * The line under the figure, in the slot the "you matched the ANSR benchmark"
     * line used to hold. Two variants and no third: the run was clean, or every
     * month on that figure had an answer the player walked past.
     *
     * No apostrophe in either (the 5×7 font has none).
     *
     * Both are measured, not felt: at the body measure of 34 characters each has to
     * fit **one** line. The first draft of the delayed one ran to 37 ("Every one of
     * them had an ANSR answer.") and the raster printed it as a line plus the word
     * ANSWER on its own under the figure — the same widow the briefing cards were
     * rewritten to avoid.
     */
    verdictClean: 'A clean run. Nothing to make up.',
    verdictDelayed: 'Every one had an ANSR answer.',
    receiptTitle: 'What got you here',
    /* Short enough to set on one bitmap line beside the list it introduces. */
    receiptHint: 'Pick one to talk about.',
    /**
     * The delay line on the closing receipt, in place of the old quick-win
     * count. A clean run gets the credit; anything else gets the itemised cost,
     * because that is the number the Navigator conversation starts from.
     */
    /* One line at the body measure, like both verdicts: at 42 characters ("No delays.
     * Every stage cleared first time.") it wrapped, under a figure reading 0. */
    delaysNone: 'No delays. Cleared first time.',
    /**
     * The heading over the itemised delays, and the pair to `receiptTitle`: what got
     * you here on one side, what cost you on the other.
     *
     * It replaced a summary line — "2 delays added 6 months" — which the raster showed
     * was **the closing figure printed a second time, in the same orange, one column
     * over**. The figure is the total now; this list is its breakdown, so it needs a
     * label rather than a restatement.
     */
    delaysTitle: 'What cost you',
    delayRow: (label: string, count: number, months: number) =>
      count > 1 ? `${label} x${count}  +${months}` : `${label}  +${months}`,
    notReached: 'not reached',
    /*
     * There is no Navigator *button* on this screen any more (owner call). It was the
     * primary cap, in two variants ("Plan your real journey" / "See what closes the
     * gap"), and it was the same offer as the four capability rows beside it —
     * generically, with no topic attached, next to four routes that each declare
     * one. The rows are the conversion surface now and `receiptHint` is the whole
     * instruction, which is why that line has to stay pointed at them.
     */
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
    /**
     * The same button, on the one screen where it opens a door instead of firing a
     * tool: standing on the Tech Park's service hatch. On touch this label *is* the
     * reveal, because there is no key cap to paint on the paving.
     */
    enterTunnel: 'Drop into the service tunnel',
  },

  /**
   * The secret stage under the Tech Park (`world/BrickBreaker.ts`).
   *
   * A **place**, like every other stage name in the game (Head Office · Compliance ·
   * Workplace · Tech Park), and the place is one floor down from the arrival: the
   * centre the player has just spent six screens building, running.
   *
   * **It was "The Growth Floor" and the owner sent that back.** Fairly: "growth" is
   * the word every consultancy uses for every deck it has ever written, so it names
   * nothing and pictures nothing — and "floor" then borrowed the *office* vocabulary
   * for a room that is visibly a plant room, with services overhead and two racks of
   * equipment humming in the corners. A name has one job here, because there is no
   * briefing card to explain it.
   *
   * **The Engine Room** is what the picture already shows and what the argument
   * already says. It is the machinery under the building, which is the art; it is
   * where the work that keeps a place running happens, which is the fifteen phrases on
   * the wall; and it is the thing a GCC actually becomes once it stops being a
   * project. Rejected on the way: "The Scale-Up Floor" (the same consultancy register
   * with a hyphen in it), "Day Two" (true, and not a place), and "Sub-Level 1" (a
   * place, and it says nothing).
   *
   * The name is not on a briefing card. The six screens stop the run to introduce
   * themselves; this one is *found*, and a card would announce the discovery back to
   * the player who just made it. It is painted on the frame for the first three
   * seconds and carried on the HUD's stage plaque while they are down there —
   * `render/brickBreaker.ts`'s `STAGE_NAME`, which a test holds to this string.
   */
  bonus: {
    name: 'The Engine Room',
  },

  fallback: {
    title: 'ANSRcade: The GCC Game',
    body: 'Play the journey before you plan it.',
    play: 'Play',
    /**
     * **This one stays**, although the same cap was deleted from the title screen. The
     * fallback card is shown when the game is *not running* — before a lazy mount
     * intersects, when the kill switch is off, when the boot failed — and in the last
     * two of those cases there is no Play button, so this is the only route off the
     * surface. Deleting it here would be the dead end the rule was written to prevent.
     */
    skip: 'Skip to the Navigator \u2192',
    dataUse: 'How we use data',
  },

  a11y: {
    canvasLabel:
      'ANSRcade: The GCC Game — a short platformer about building an India GCC. Use arrow keys to move, Space to jump and F to use an ANSR tool once you have one. You have three lives; each obstacle costs one and adds months to the clock.',
    screenEntered: (name: string) => `Entering ${name}.`,
    setback: (reason: string, months: number) => `${reason} That is ${months} more months.`,
    livesLeft: (left: number) =>
      left === 1 ? 'One life left.' : `${left} lives left.`,
    /*
     * Both of these announce **what the delays cost**, not a running total, because
     * the total clock is not on the screen any more (see `COPY.win.lostLabel`): an
     * announcement that reports a figure sighted players cannot see is a different
     * game read out loud.
     */
    outOfLives: (delayMonths: number, delays: number) =>
      `Out of lives. ${delays} delays cost ${delayMonths} months. ` +
      'Take the ANSR powerup at every stage and those months never happen.',
    won: (delayMonths: number) =>
      delayMonths === 0
        ? 'Market entry complete. You reached the ANSR Tech Park with no delays.'
        : `Market entry complete. You reached the ANSR Tech Park. Delays cost ${delayMonths} months.`,
    summary: 'Your journey so far, with the ANSR capabilities you engaged.',
    /*
     * The secret stage, for anybody who cannot see it. Three announcements, because a
     * player using a screen reader has to be told the frame changed completely, what
     * the room is for, and that the way out is the way they came in — the picture says
     * all three with a shaft, a wall and a set of chevrons.
     */
    tunnelEntered:
      'You dropped into a service tunnel under the tech park: the Engine Room. ' +
      'Break the wall of blocks with the ANSR mark. Each block is work that only ' +
      'starts once the centre is live. Move left and right; the tray catches the mark.',
    bonusCleared: 'The wall is down. The shaft is drawing: stand in it to go back up.',
    tunnelLeft: 'Back on the tech park plaza.',
  },
} as const;

export type Copy = typeof COPY;
