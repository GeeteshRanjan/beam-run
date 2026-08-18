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
import { badgeBoxAt } from '../world/badgeFloat';
import {
  ledgerRows,
  logPanelView,
  loggedMonths,
  type LedgerRow,
  type LogPanelView,
  type SetbackLogEntry,
} from './setbackLog';
import { Stamps } from '../world/Hazards/Stamps';
import { Fire } from '../world/Hazards/Fire';
import { Gates } from '../world/Hazards/Gates';
import { Spikes } from '../world/Hazards/Spikes';
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
  /** True on the last life: the screen becomes the closing ledger. */
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
   * Seconds of play on the current screen. Two jobs, one accumulator: it is the
   * clear time reported to analytics, and it drives the badge's vertical float —
   * so the pickup position is a pure function of level data and this number,
   * never of the wall clock, which is what keeps `step()` replayable.
   */
  private screenClock = 0;

  private titleCardT = 0;
  private lifeLostT = 0;
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
  get titleCardProgress(): number {
    return Math.min(1, this.titleCardT / TRANSITION.TITLE_CARD_HOLD);
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

  /** The badge hitbox right now, or null when there is nothing to collect. */
  get badgeBox(): AABB | null {
    const b = this._screen.data.badge;
    if (!b || this.powerups.collected) return null;
    return badgeBoxAt(b, this.screenClock);
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
      case 'fire':
        return new Fire(d.fireLanes ?? []);
      case 'gates':
        return new Gates(d.gates ?? []);
      case 'spikes':
        return new Spikes(d.spikeColumns ?? []);
      default:
        return null;
    }
  }

  /** Current hazard (for rendering). */
  get activeHazard(): Hazard | null {
    return this.hazard;
  }

  /**
   * The engaged capability makes hazard *contact* harmless on this screen, so the
   * host may draw the player inside the ANSR bubble.
   *
   * Only true where the hazard actually says so (`Hazard.shieldsPlayer`): on the
   * screens where help means "the obstacles ahead are cleared" rather than "you
   * cannot be hit", a shield visual would promise protection the rules do not
   * give.
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

  /** Public: restart from the win screen. */
  requestRestart(): void {
    if (this.sm.state === 'WIN') this.sm.transitionTo('START');
  }

  /**
   * Public: leave the life-lost screen.
   *
   * With lives left this reloads the stage the player was already on — not the
   * screen after it and never screen 0 — so a delay costs a life and two months,
   * never progress. Out of lives, the attempt is over and we hand back to the
   * title screen with a clean slate.
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

      case 'TITLE_CARD': {
        this.titleCardT += dt;
        const canSkip =
          this.titleCardT >= TRANSITION.TITLE_CARD_SKIP_AFTER && input.anyPressed;
        if (canSkip || this.titleCardT >= TRANSITION.TITLE_CARD_HOLD) {
          this.sm.transitionTo('PLAYING');
        }
        break;
      }

      case 'PLAYING':
        this.updatePlaying(dt, input);
        break;

      case 'LIFE_LOST': {
        this.lifeLostT += dt;
        // With lives left this is a coaching beat, so it moves on by itself (or
        // on a press, after a moment's grace so it cannot be skipped blind).
        // Out of lives it is the closing ledger and a conversion surface: it
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
    // Advanced before anything reads a badge position this step.
    this.screenClock += dt;

    // Collidables = static solids + any bodies the hazard contributes.
    const solids: AABB[] = this._screen.solids.concat(
      this.hazard ? this.hazard.solids() : [],
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
    }
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
   * The badge moves, so its hitbox is read from `badgeBoxAt` at the current
   * simulation clock — the same function the renderer draws from. Deriving it
   * twice is how a pickup ends up visually somewhere the collision is not.
   *
   * `SAFE_PASSAGE` badges are collected like any other; they simply have no
   * capability to add to the receipt.
   */
  private tryCollectBadge(): void {
    const b = this._screen.data.badge;
    if (!b || this.powerups.collected) return;
    const box = badgeBoxAt(b, this.screenClock);
    if (aabbOverlap(this._player.box, box)) {
      this.powerups.collect(b);
      if (!this._engaged.includes(b.type)) this._engaged.push(b.type);
      this.events.onBadgeCollected?.(this._screenId, b.type);
    }
  }
}
