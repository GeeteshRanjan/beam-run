/**
 * Simulation — the authoritative, headless game state.
 *
 * This is the single source of gameplay truth, shared by the DOM `Game`
 * (which renders it) and by `Game.simulate()` (which drives it without a
 * canvas for deterministic tests). It owns the top-level StateMachine, the
 * current Screen, the Player, and the run's one currency: **months**.
 *
 * The model, in one paragraph: the run has two stakes, and they measure the same
 * thing. Clearing a screen books its `monthsBase`; the six bases sum to ANSR's
 * published benchmark, so a clean run lands exactly there. Being stopped by an
 * obstacle books `SETBACK_MONTHS` on the clock, writes a line in the delay log,
 * and costs one of `LIVES.TOTAL` — the run then resumes at the *start of the same
 * stage*, so nothing already earned is taken away. Spend the last life and the
 * attempt ends on the ledger and returns to the title screen. The month total
 * stays capped below the going-alone baseline, so leaning on ANSR always beats
 * doing it alone.
 *
 * Two things the model deliberately does not do: it never blames the player (the
 * months are charged to the obstacle, by name) and it never walls anyone off
 * from the hand-off — running out of lives lands on a conversion surface, the
 * same as reaching the Tech Park.
 *
 * A lost life *does* rebuild the Screen, which is what makes the badge available
 * again on the retry.
 *
 * It never imports rendering or DOM APIs.
 */
import { RESOLUTION, TRANSITION, ASSIST, JOURNEY, LIVES } from '../data/tuning.config';
import { SCREEN_COUNT, type BadgeType } from '../data/levels';
import { StateMachine } from './StateMachine';
import { GAME_TRANSITIONS, type GameState } from './gameStates';
import type { InputState } from './Input';
import { Player } from '../world/Player';
import { Screen } from '../world/Screen';
import { aabbOverlap, type AABB } from '../world/Physics';
import { Powerups, type ActivePowerView } from '../world/Powerups';
import { badgeBoxAt, badgeCenter } from '../world/badgeFloat';
import { dropBoxAt, dropStateAt, isAirdropped, type DropView } from '../world/badgeDrop';
import { isPerched, perchBox, perchCenter } from '../world/badgePerch';
import {
  ceilingBoxAt,
  ceilingStateAt,
  isCeilingDrop,
  type CeilingView,
} from '../world/badgeCeiling';
import {
  ledgerRows,
  logPanelView,
  loggedMonths,
  type LedgerRow,
  type LogPanelView,
  type SetbackLogEntry,
} from './setbackLog';
import { BrickBreaker } from '../world/BrickBreaker';
import { Stamps } from '../world/Hazards/Stamps';
import { Dragon } from '../world/Hazards/Dragon';
import { ComplianceMaze } from '../world/Hazards/ComplianceMaze';
import { Workplace } from '../world/Hazards/Workplace';
import type { Hazard, SetbackCause } from '../world/types';

export type { SetbackCause } from '../world/types';

export interface AssistState {
  slowMode: boolean;
  extraTime: boolean;
  /** Explore freely — hazards stop booking months. */
  noSetbacks: boolean;
  largerControls: boolean;
  /** One-tap play: the hero runs forward on its own. */
  autoRun: boolean;
}

export const DEFAULT_ASSIST: AssistState = {
  slowMode: false,
  extraTime: false,
  noSetbacks: false,
  largerControls: false,
  autoRun: false,
};

/** The closing receipt — what the run actually produced. */
export interface RunReceipt {
  /** Final months to market (already capped). */
  months: number;
  /** ANSR client average, for the reference line. */
  benchmarkMonths: number;
  /** Going-alone average, for the reference line. */
  baselineMonths: number;
  /** True when the player matched the benchmark exactly (no setbacks). */
  matchedBenchmark: boolean;
  setbacks: number;
  /** Months booked by delays alone (the avoidable part of the total). */
  delayMonths: number;
  /** The delay breakdown by obstacle — the closing argument. */
  ledger: LedgerRow[];
  livesLeft: number;
  /** Capabilities engaged this run, in the order they were picked up. */
  engaged: BadgeType[];
  reachedScreenId: number;
  reachedScreenName: string;
}

/** What the life-lost screen needs to know about the delay that just happened. */
export interface LifeLostView {
  cause: SetbackCause;
  monthsAdded: number;
  livesLeft: number;
  livesTotal: number;
  screenName: string;
  /**
   * True on the last life, and the only case the host shows a screen for: with
   * lives left the stage simply restarts (see `continueAfterLifeLost`).
   */
  outOfLives: boolean;
  ledger: LedgerRow[];
  delayMonths: number;
  delays: number;
}

export interface SimulationEvents {
  onStateChange?: (from: GameState, to: GameState) => void;
  onScreenEnter?: (screenId: number, screenName: string) => void;
  onScreenClear?: (screenId: number, timeS: number, setbacks: number) => void;
  /**
   * An obstacle stopped the player: months booked, one life spent, one line in
   * the delay log. `totalMonths` is the new clock reading, `livesLeft` what is
   * left of the attempt (0 means this was the last one).
   */
  onSetback?: (
    cause: SetbackCause,
    monthsAdded: number,
    totalMonths: number,
    livesLeft: number,
  ) => void;
  /** The attempt ran out of lives. Fired once, before the state change. */
  onOutOfLives?: (screenId: number, months: number, delays: number) => void;
  /**
   * The player dropped into the secret tunnel, or came back up out of it.
   *
   * Not a state change, on purpose: the run is still `PLAYING` the Tech Park and
   * nothing about its months, lives or receipt moves. The host uses these two to
   * announce the stage, clear the frame's particles and swap the HUD's stage plaque.
   */
  onTunnelEnter?: () => void;
  onTunnelExit?: () => void;
  onBadgeCollected?: (screenId: number, badgeType: BadgeType) => void;
}

export interface SimulationOptions extends SimulationEvents {
  startScreen?: number;
  assist?: Partial<AssistState>;
}

/** Minimum travel between recorded safe-ground samples (px). */
const SAFE_SAMPLE_STEP = 8;
/** How many safe-ground samples to remember (bounded, no growth over time). */
const SAFE_HISTORY_MAX = 160;

interface SafeSpot {
  x: number;
  y: number;
}

export class Simulation {
  readonly sm: StateMachine<GameState>;
  assist: AssistState;

  private _screen: Screen;
  private _player: Player;
  private _screenId: number;

  /** Months booked by screens already cleared. */
  private monthsBooked = 0;
  private _setbacks = 0;
  private _lives: number = LIVES.TOTAL;
  private readonly _log: SetbackLogEntry[] = [];
  private _lastCause: SetbackCause | null = null;
  private readonly _engaged: BadgeType[] = [];

  readonly powerups = new Powerups();
  private hazard: Hazard | null = null;

  /**
   * The secret stage, while the player is in it (`world/BrickBreaker.ts`).
   *
   * It is deliberately **not** a screen and **not** a hazard: it books no months, it
   * cannot cost a life, and it is not in `SCREEN_COUNT`. While it is non-null it owns
   * the frame — `updatePlaying` hands it the whole step, including the player — and the
   * run is exactly where it was when the player comes back up. See the module for why
   * a bonus with stakes would break the model.
   */
  private _bonus: BrickBreaker | null = null;
  /** The column he dropped in at, so the plaza gives him back the ground he left. */
  private bonusReturnX = 0;

  /**
   * Seconds of play on the current screen. Two jobs, one accumulator: it is the
   * clear time reported to analytics, and it drives the badge's vertical float —
   * so the pickup position is a pure function of level data and this number,
   * never of the wall clock, which is what keeps `step()` replayable.
   */
  private screenClock = 0;

  private titleCardT = 0;
  private lifeLostT = 0;
  /**
   * True while the stage the player is on is a *retry* — i.e. the last thing that
   * happened was a lost life on this same screen.
   *
   * It exists because losing a life no longer shows a screen (owner call): the
   * stage simply starts again, so the one thing the deleted overlay said that
   * mattered — take the ANSR badge — has to be said somewhere, and the retry's
   * title card is the only surface left. The host reads this to decide whether the
   * card carries that line. Cleared by `loadScreen`, so progressing forwards or
   * starting a fresh attempt never inherits it.
   */
  private _retry = false;
  private setbacksOnScreen = 0;
  private readonly safeHistory: SafeSpot[] = [];
  private readonly events: SimulationEvents;

  constructor(opts: SimulationOptions = {}) {
    this.events = opts;
    this.assist = { ...DEFAULT_ASSIST, ...opts.assist };
    this._screenId = opts.startScreen ?? 0;
    this._screen = new Screen(this._screenId);
    this._player = new Player(this._screen.spawnX, this._screen.spawnY);
    this.hazard = this.buildHazard();
    this.resetSafeHistory();

    this.sm = new StateMachine<GameState>('BOOT', GAME_TRANSITIONS, (from, to) => {
      this.events.onStateChange?.(from, to);
    });
    // Assets are ready → advance to START.
    this.sm.transitionTo('START');
  }

  // --- public read-only view (for rendering) --------------------------------
  get state(): GameState {
    return this.sm.state;
  }
  get screen(): Screen {
    return this._screen;
  }
  get player(): Player {
    return this._player;
  }
  get screenId(): number {
    return this._screenId;
  }
  /**
   * 0..1 through the briefing card's reveal. Presentation only — the card does
   * **not** advance when this reaches 1 (it waits for a press), so nothing about
   * the flow may be derived from it.
   */
  get titleCardProgress(): number {
    return Math.min(1, this.titleCardT / TRANSITION.TITLE_CARD_REVEAL);
  }
  /**
   * True once a press on the briefing card would be taken. The host shows the
   * card's button from the first frame regardless — a control that appears late
   * reads as a slow page — and this is simply the grace being over.
   */
  get titleCardReady(): boolean {
    return this.titleCardT >= TRANSITION.TITLE_CARD_SKIP_AFTER;
  }
  /** True when the current stage is a retry after a lost life (see `_retry`). */
  get retrying(): boolean {
    return this._retry;
  }

  /**
   * The journey clock: months booked so far, plus the cost of every setback,
   * capped so the run always beats the going-alone baseline.
   */
  get months(): number {
    const raw = this.monthsBooked + this._setbacks * JOURNEY.SETBACK_MONTHS;
    return Math.min(JOURNEY.MAX_MONTHS, raw);
  }
  get setbacks(): number {
    return this._setbacks;
  }
  /** Lives left in this attempt. */
  get lives(): number {
    return this._lives;
  }
  get livesTotal(): number {
    return LIVES.TOTAL;
  }
  /** The delay log, newest last. */
  get log(): readonly SetbackLogEntry[] {
    return this._log;
  }
  /** Months booked by delays alone — the avoidable part of the clock. */
  get delayMonths(): number {
    return loggedMonths(this._log);
  }
  /** The HUD panel view of the log (bounded; see `logPanelView`). */
  get logPanel(): LogPanelView {
    return logPanelView(this._log, LIVES.LOG_VISIBLE_ROWS);
  }
  /** Simulation time on the current screen (s) — drives the badge float. */
  get clock(): number {
    return this.screenClock;
  }

  /**
   * Does this screen carry a powerup at all — whatever its delivery, and whether or
   * not it has already been taken?
   *
   * Deliberately **not** `badgeBox !== null`, which is a different question: that one
   * answers "can it be collected on this frame" and goes null on a taken mark and on
   * a delivery mid-flight. This is the level's own shape, so it is constant for the
   * whole visit — which is what the retry card needs, since two of the six screens
   * (Head Office and the Tech Park) carry no mark and the card must not tell a player
   * to take one that does not exist.
   */
  get screenHasPowerup(): boolean {
    return this._screen.data.badge != null;
  }

  /**
   * The badge hitbox right now, or null when there is nothing to collect.
   *
   * Null has two meanings and they are both "not now": the badge is already taken,
   * or this screen's badge is air-dropped and is currently in the air, expired, or
   * waiting for the next drone (`world/badgeDrop.ts`). The rail is always
   * collectable somewhere, and so is a perch (`world/badgePerch.ts`, the Compliance
   * maze's mark standing on its brick wall); a delivery is not, and that is the
   * mechanic.
   */
  get badgeBox(): AABB | null {
    const b = this._screen.data.badge;
    if (!b || this.powerups.collected) return null;
    if (isPerched(b)) return perchBox(b);
    // The Workplace's mark falls out of a ceiling spotlight and expires, so like the
    // air-drop it is only collectable for part of its cycle (`world/badgeCeiling.ts`).
    if (isCeilingDrop(b)) return ceilingBoxAt(b, this.screenClock);
    return isAirdropped(b) ? dropBoxAt(b, this.screenClock) : badgeBoxAt(b, this.screenClock);
  }

  /**
   * The ceiling delivery in progress, or null anywhere but the Workplace.
   *
   * Read by the host to draw the mark waiting in the fitting, the fall, and the
   * countdown on the cabinet. A plain function of the clock, like `badgeDrop`.
   */
  get badgeCeiling(): CeilingView | null {
    const b = this._screen.data.badge;
    if (!b || !isCeilingDrop(b)) return null;
    return ceilingStateAt(b, this.screenClock);
  }

  /**
   * The air-drop delivery in progress, or null on a rail screen.
   *
   * Read by the host to draw the drone, the parcel and the countdown. Still
   * reported after the badge has been collected being *pointless* rather than
   * wrong — the host stops drawing at that point — so this getter stays a plain
   * function of the clock and nothing has to be remembered.
   */
  get badgeDrop(): DropView | null {
    const b = this._screen.data.badge;
    if (!b || !isAirdropped(b)) return null;
    return dropStateAt(b, this.screenClock);
  }

  /**
   * Where the badge is on screen right now, whichever way it is delivered.
   *
   * Valid after collection too, because both delivery models are pure functions of
   * the clock: that is what lets the host throw the pickup burst from where the
   * badge actually was rather than from its anchor cell.
   */
  get badgePoint(): { x: number; y: number } | null {
    const b = this._screen.data.badge;
    if (!b) return null;
    if (isPerched(b)) return perchCenter(b);
    if (isCeilingDrop(b)) return ceilingStateAt(b, this.screenClock).badge;
    return isAirdropped(b) ? dropStateAt(b, this.screenClock).badge : badgeCenter(b, this.screenClock);
  }
  /** Capabilities engaged this run, in pickup order. */
  get engaged(): readonly BadgeType[] {
    return this._engaged;
  }
  /** Engaged capability for the HUD chip (persistent, no countdown). */
  get activePower(): ActivePowerView | null {
    return this.powerups.hudModel();
  }

  /** Snapshot for the win screen and the mid-run summary. */
  get receipt(): RunReceipt {
    return {
      months: this.months,
      benchmarkMonths: JOURNEY.ANSR_BENCHMARK_MONTHS,
      baselineMonths: JOURNEY.BASELINE_MONTHS,
      matchedBenchmark: this._setbacks === 0,
      setbacks: this._setbacks,
      delayMonths: this.delayMonths,
      ledger: ledgerRows(this._log),
      livesLeft: this._lives,
      engaged: [...this._engaged],
      reachedScreenId: this._screenId,
      reachedScreenName: this._screen.name,
    };
  }

  /**
   * Snapshot for the life-lost screen. Null unless a delay has been booked, so
   * the host can never paint the screen with nothing to report.
   */
  get lifeLost(): LifeLostView | null {
    const last = this._log[this._log.length - 1];
    if (!last || this._lastCause === null) return null;
    return {
      cause: this._lastCause,
      monthsAdded: last.months,
      livesLeft: this._lives,
      livesTotal: LIVES.TOTAL,
      screenName: last.screenName,
      outOfLives: this._lives <= 0,
      ledger: ledgerRows(this._log),
      delayMonths: this.delayMonths,
      delays: this._log.length,
    };
  }

  /**
   * 0..1 through the life-lost hold (`LIVES.LOST_HOLD`), and 0 at every other time.
   *
   * Presentation only, and the reason it exists is that one of the death poses is not a
   * *pose* but a **process**: the dragon's fire burns the player, so the picture has to
   * take hold over the beat rather than appear whole (`render/dragon.ts`'s
   * `drawBurningHero`). The other three poses are single frames and need nothing from here.
   *
   * It is sim time, not the wall clock — the same rule the badge's float and the maze's
   * weather follow — so the burn is the same on a replay and it holds still if the sim does.
   */
  get lifeLostProgress(): number {
    if (this.state !== 'LIFE_LOST') return 0;
    return Math.min(1, this.lifeLostT / LIVES.LOST_HOLD);
  }

  // --- run lifecycle --------------------------------------------------------

  private startRun(): void {
    this.resetRunState();
    this.loadScreen(0);
    this.enterTitleCard();
  }

  /** Everything that belongs to one attempt (lives, clock, log, capabilities). */
  private resetRunState(): void {
    this.monthsBooked = 0;
    this._setbacks = 0;
    this._lives = LIVES.TOTAL;
    this._log.length = 0;
    this._lastCause = null;
    this._engaged.length = 0;
  }

  private loadScreen(id: number): void {
    this._screenId = id;
    this._retry = false;
    // Loading any screen leaves the secret stage: it exists only inside one visit to
    // the Tech Park, and a reset that kept it would put the plant room under screen 0.
    this._bonus = null;
    this._screen = new Screen(id);
    this.powerups.reset();
    this.hazard = this.buildHazard();
    this._player.respawn(this._screen.spawnX, this._screen.spawnY);
    this.setbacksOnScreen = 0;
    this.screenClock = 0;
    this.resetSafeHistory();
  }

  /** Build the (single) hazard family for the current screen from level data. */
  private buildHazard(): Hazard | null {
    const d = this._screen.data;
    switch (d.hazard) {
      case 'stamps':
        return new Stamps(d.stamps ?? []);
      case 'dragon':
        return new Dragon(d.dragons ?? []);
      case 'maze':
        return new ComplianceMaze(d.monsters ?? [], d.gather, d.lift, d.hoist);
      case 'workplace':
        // It is handed the screen's static solids, and it is the only hazard that is:
        // the bandages the figure throws are **stopped by the partition wall**, which is
        // what makes the badge's side of that wall the safe side (owner call: the mark
        // drops before the partition "so the user can take it safely").
        return new Workplace(d.mummies ?? [], d.terminal, this._screen.solids);
      default:
        return null;
    }
  }

  /** Current hazard (for rendering). */
  get activeHazard(): Hazard | null {
    return this.hazard;
  }

  // --- the secret stage under the Tech Park ---------------------------------

  /** The bonus stage in progress, or null (which is almost always). */
  get bonus(): BrickBreaker | null {
    return this._bonus;
  }
  get inBonus(): boolean {
    return this._bonus !== null;
  }

  /** The tunnel mouth on this screen, in px, or null on the five without one. */
  get tunnelSpan(): { x: number; w: number } | null {
    const t = this._screen.data.tunnel;
    if (!t) return null;
    return { x: t.gx * RESOLUTION.TILE, w: t.w * RESOLUTION.TILE };
  }

  /**
   * True when the player is standing on the mouth and a press would take him down.
   *
   * The host reads this for two things and both of them are the *reveal*: the prompt
   * painted on the hatch, and the touch act pad, which otherwise only exists where a
   * badge has armed a tool. Standing on the hatch is the whole of how this feature
   * announces itself, so nothing about it is shown anywhere else.
   */
  get canEnterTunnel(): boolean {
    const span = this.tunnelSpan;
    if (!span || this._bonus || this.sm.state !== 'PLAYING') return false;
    if (!this._player.onGround) return false;
    const cx = this._player.box.x + this._player.box.w / 2;
    return cx >= span.x && cx <= span.x + span.w;
  }

  /**
   * Drop into the tunnel. No-op unless the player is standing on it.
   *
   * Entered on the **act button**, never by walking over the mouth: this screen is the
   * payoff, and a hole a runner falls into would take the arrival away from anybody who
   * found it by accident — including every one-tap auto-run player, who cannot choose
   * not to walk over it.
   */
  enterTunnel(): void {
    if (!this.canEnterTunnel) return;
    this.bonusReturnX = this._player.box.x;
    this._bonus = new BrickBreaker();
    const at = BrickBreaker.spawnPoint();
    this._player.respawn(at.x, at.y);
    this.events.onTunnelEnter?.();
  }

  /** Back onto the plaza, at the column he left it from. */
  private leaveTunnel(): void {
    this._bonus = null;
    this._player.respawn(this.bonusReturnX, this._screen.spawnY);
    this.events.onTunnelExit?.();
  }

  /**
   * The engaged capability makes hazard *contact* harmless on this screen, so the
   * host may draw the player inside the ANSR bubble.
   *
   * Only true where the hazard actually says so (`Hazard.shieldsPlayer`): the
   * DENIED stamps cannot press an ANSR-backed player, and the hiring dragon's fire
   * cannot touch a haloed one. On the screens where help means "the obstacles ahead
   * are cleared" rather than "you cannot be hit" — the Workplace, where the badge
   * makes the obstacle *solvable* — a shield visual would promise protection the
   * rules do not give.
   *
   * The **Compliance maze is the exception in the other direction** (owner call): its
   * monsters really are harmless once GCC-BOT has filed everything, so a bubble would
   * be honest there — and it still does not draw one, because that screen shows the
   * same news on the world instead, by clearing the weather
   * (`ComplianceMaze.skyClear`).
   */
  get shielded(): boolean {
    return this.powerups.isAssisted && this.hazard?.shieldsPlayer === true;
  }

  private enterTitleCard(): void {
    this.titleCardT = 0;
    this.sm.transitionTo('TITLE_CARD');
    this.events.onScreenEnter?.(this._screenId, this._screen.name);
  }

  /** Public entry: begin a run from the START screen. */
  requestStart(): void {
    if (this.sm.state === 'START') this.startRun();
  }

  /**
   * Public: leave the briefing card and start the stage.
   *
   * The one way out of `TITLE_CARD`, and it is deliberately a *request*: it is
   * called both by `step()` (a mapped key went down) and by the card's own button
   * (pointer or touch), and either may arrive during the grace, in which case
   * nothing happens and the card stays up. No-op in every other state, so the
   * host can wire the button once and never check.
   */
  requestAdvance(): void {
    if (this.sm.state !== 'TITLE_CARD') return;
    if (!this.titleCardReady) return;
    this.sm.transitionTo('PLAYING');
  }

  /** Public: restart from the win screen. */
  requestRestart(): void {
    if (this.sm.state === 'WIN') this.sm.transitionTo('START');
  }

  /**
   * Public: leave the lost-life state.
   *
   * With lives left this reloads the stage the player was already on — not the
   * screen after it and never screen 0 — so a delay costs a life and two months,
   * never progress. There is no screen to acknowledge any more (owner call): the
   * host shows nothing, `step()` calls this itself after `LIVES.LOST_HOLD`, and the
   * stage restarts from its own title card, which is now flagged as a retry so it
   * can carry the badge instruction.
   *
   * Out of lives, the attempt is over and we hand back to the title screen with a
   * clean slate — that one *is* a screen, and it is the only one left.
   */
  continueAfterLifeLost(): void {
    if (this.sm.state !== 'LIFE_LOST') return;
    if (this._lives <= 0) {
      this.resetRunState();
      this.loadScreen(0);
      this.titleCardT = 0;
      this.sm.transitionTo('START');
      return;
    }
    this.loadScreen(this._screenId);
    this._retry = true;
    this.enterTitleCard();
  }

  /**
   * Hard reset back to the START screen from any state (pause "Start over", the
   * kill switch). Bypasses the transition allow-list deliberately.
   */
  reset(): void {
    this.resetRunState();
    this.loadScreen(0);
    this.titleCardT = 0;
    this.lifeLostT = 0;
    this.sm.force('START');
  }

  /** Screen label for the title card / HUD (copy override or name). */
  get screenLabel(): string {
    return this._screen.data.copy?.titleCard ?? this._screen.name;
  }

  // --- setbacks: months, a life, and a line in the log ----------------------

  private resetSafeHistory(): void {
    this.safeHistory.length = 0;
    this.safeHistory.push({ x: this._screen.spawnX, y: this._screen.spawnY });
  }

  /**
   * Remember solid ground the player is genuinely standing on. Ground a hazard
   * is dragging on (speed multiplier below 1) is never "safe", so a fall can't
   * put you back into the thing you just climbed out of.
   */
  private recordSafeSpot(): void {
    if (!this._player.onGround) return;
    if (this.hazard && this.hazard.speedMultAt(this._player) < 1) return;
    const last = this.safeHistory[this.safeHistory.length - 1];
    if (last && Math.abs(this._player.box.x - last.x) < SAFE_SAMPLE_STEP) return;
    this.safeHistory.push({ x: this._player.box.x, y: this._player.box.y });
    if (this.safeHistory.length > SAFE_HISTORY_MAX) this.safeHistory.shift();
  }

  /** Most recent safe spot at least `KNOCKBACK` behind the player. */
  private knockbackSpot(): SafeSpot {
    const limit = this._player.box.x - JOURNEY.SETBACK_KNOCKBACK_PX;
    for (let i = this.safeHistory.length - 1; i >= 0; i -= 1) {
      const spot = this.safeHistory[i]!;
      if (spot.x <= limit) return spot;
    }
    return this.safeHistory[0] ?? { x: this._screen.spawnX, y: this._screen.spawnY };
  }

  /**
   * Book a delay: months on the clock, one line in the log, one life gone, and
   * out to the life-lost screen. No-op during the grace period, or with the "no
   * setbacks" assist on.
   *
   * The knockback-to-safe-ground behaviour this used to have is still needed, but
   * only for the un-chargeable fall (see `forceSetback`): a player who falls
   * while invulnerable has to be put somewhere, and it is not fair to charge them
   * for it. When a delay *is* charged, the retry starts the stage over, which is
   * both easier to read and honest about what an obstacle costs.
   */
  setback(cause: SetbackCause): void {
    if (this.sm.state !== 'PLAYING') return;
    if (this.assist.noSetbacks || this._player.isInvulnerable) return;

    this._setbacks += 1;
    this.setbacksOnScreen += 1;
    this._lives = Math.max(0, this._lives - 1);
    this._lastCause = cause;
    this._log.push({
      index: this._log.length + 1,
      screenId: this._screenId,
      screenName: this._screen.name,
      cause,
      months: JOURNEY.SETBACK_MONTHS,
    });

    // The hazard is deliberately NOT reset here. A retry rebuilds it from
    // scratch (`loadScreen`), so resetting bought nothing — and it wiped the
    // pose the host needs to paint the moment of impact on the life-lost frames
    // (the DENIED stamp holding the player flat under it).
    this.lifeLostT = 0;

    this.events.onSetback?.(cause, JOURNEY.SETBACK_MONTHS, this.months, this._lives);
    if (this._lives <= 0) {
      this.events.onOutOfLives?.(this._screenId, this.months, this._log.length);
    }
    this.sm.transitionTo('LIFE_LOST');
  }

  private clearScreen(): void {
    this.monthsBooked += this._screen.data.monthsBase ?? 0;
    this.events.onScreenClear?.(this._screenId, this.screenClock, this.setbacksOnScreen);
    const next = this._screenId + 1;
    if (next < SCREEN_COUNT) {
      this.loadScreen(next);
      this.enterTitleCard();
    }
  }

  private finishRun(): void {
    this.monthsBooked += this._screen.data.monthsBase ?? 0;
    this.sm.transitionTo('WIN');
  }

  // --- per-step update ------------------------------------------------------

  step(dt: number, input: InputState): void {
    switch (this.sm.state) {
      case 'START':
        if (input.anyPressed) this.startRun();
        break;

      /*
       * The briefing card. It **waits** (owner call): the stage is described in one
       * line and nothing starts until the player says so, so there is no timeout
       * here and no way for a screen to begin while somebody is still reading about
       * it. The only guard is `TITLE_CARD_SKIP_AFTER`, which stops the press that
       * opened the card (the Start button, or a fast second click) from also
       * dismissing it.
       */
      case 'TITLE_CARD': {
        this.titleCardT += dt;
        if (input.anyPressed) this.requestAdvance();
        break;
      }

      case 'PLAYING':
        this.updatePlaying(dt, input);
        break;

      case 'LIFE_LOST': {
        this.lifeLostT += dt;
        // With lives left this is not a screen at all: it is the beat the impact
        // is drawn on (the flattened hero, the stamp still on him), and then the
        // stage starts again by itself. A press cuts the beat short, after a
        // moment's grace so a held button cannot skip it before it is seen.
        // Out of lives it is the closing screen and a conversion surface: it
        // waits for a deliberate choice and never times out from under the
        // player.
        if (this._lives > 0) {
          const canSkip = this.lifeLostT >= LIVES.LOST_SKIP_AFTER && input.anyPressed;
          if (canSkip || this.lifeLostT >= LIVES.LOST_HOLD) this.continueAfterLifeLost();
        }
        break;
      }

      case 'WIN':
      case 'BOOT':
      default:
        break;
    }
  }

  private updatePlaying(dt: number, input: InputState): void {
    /*
     * The secret stage owns the whole step while it is up, and nothing after this
     * branch may run: it moves the player itself, it has no hazard, no badge and no
     * clock in the run's currency — and, load-bearing, the Tech Park's own
     * `winTrigger` sits at x 1040, which is *inside* the bonus room's play area. Fall
     * through to the tail of this method and walking right in the plant room finishes
     * the game.
     */
    if (this._bonus) {
      if (this._bonus.update(dt, this._player, input)) this.leaveTunnel();
      return;
    }

    // Advanced before anything reads a badge position this step.
    this.screenClock += dt;

    // Collidables = static solids + any bodies the hazard contributes.
    // The player is handed to `solids()` **before** he moves, on purpose: a one-way
    // platform is "solid only if you were above it", and where he was is the only
    // reading of that which cannot be fooled by the move that is about to happen.
    const solids: AABB[] = this._screen.solids.concat(
      this.hazard ? this.hazard.solids(this._player) : [],
    );
    const speedMult = this.hazard ? this.hazard.speedMultAt(this._player) : 1;
    this._player.update(dt, input, solids, speedMult);

    this.tryCollectBadge();
    this.recordSafeSpot();

    // Advance the hazard; it may cost time this step.
    if (this.hazard) {
      const cause = this.hazard.update(dt, this._player, {
        assisted: this.powerups.isAssisted,
        extraTelegraph: this.assist.extraTime ? ASSIST.EXTRA_TELEGRAPH_BONUS : 0,
        // Passed straight through as an edge: the one hazard with a verb of its
        // own fires once per press, never from a held button.
        shoot: input.shootPressed,
        // …and the held state alongside it, for the one hazard whose verb is a hose
        // rather than a trigger (see `HazardContext.shootHeld`).
        shootHeld: input.shoot,
      });
      if (cause) {
        this.setback(cause);
        return;
      }
    }

    // Fell out of the world → the ground gave way.
    if (this._player.box.y > RESOLUTION.HEIGHT + 80) {
      this.forceSetback('fall');
      return;
    }

    // Win trigger (finale) takes priority over any exit.
    if (
      this._screen.winTriggerX !== undefined &&
      this._player.box.x + this._player.box.w >= this._screen.winTriggerX
    ) {
      this.finishRun();
      return;
    }

    // Reached the exit → next screen.
    if (
      this._screen.exitX !== undefined &&
      this._player.box.x + this._player.box.w >= this._screen.exitX
    ) {
      this.clearScreen();
      return;
    }

    // Standing on the secret tunnel with the act button: down he goes. Read last,
    // after the exit and the win trigger, so a screen's own ending always wins.
    if (input.shootPressed) this.enterTunnel();
  }

  /**
   * A fall must always relocate the player even inside the grace period or with
   * the "no setbacks" assist on — otherwise they would keep falling forever.
   */
  private forceSetback(cause: SetbackCause): void {
    const chargeable = !this.assist.noSetbacks && !this._player.isInvulnerable;
    if (chargeable) {
      this.setback(cause);
      return;
    }
    const spot = this.knockbackSpot();
    this._player.respawn(spot.x, spot.y);
  }

  /**
   * The badge moves, so its hitbox is read from the same function the renderer
   * draws from, at the current simulation clock — `badgeBoxAt` on a rail screen,
   * `dropBoxAt` on the air-drop one. Deriving it twice is how a pickup ends up
   * visually somewhere the collision is not.
   *
   * There is no such thing as a badge with no capability behind it any more: the
   * `SAFE_PASSAGE` mark went with the last screen that carried it (owner call, the
   * Tech Park). So every collection here adds a row to the receipt, and `engaged` and
   * the four capability links are the same list.
   */
  private tryCollectBadge(): void {
    const b = this._screen.data.badge;
    if (!b || this.powerups.collected) return;
    const box = this.badgeBox;
    if (box && aabbOverlap(this._player.box, box)) {
      this.powerups.collect(b);
      if (!this._engaged.includes(b.type)) this._engaged.push(b.type);
      this.events.onBadgeCollected?.(this._screenId, b.type);
    }
  }
}
