/**
 * Simulation — the authoritative, headless game state.
 *
 * This is the single source of gameplay truth, shared by the DOM `Game`
 * (which renders it) and by `Game.simulate()` (which drives it without a
 * canvas for deterministic tests). It owns the top-level StateMachine, the
 * current Screen, the Player, and the run's one currency: **months**.
 *
 * The model, in one paragraph: there are no lives and no game over. Clearing a
 * screen books its `monthsBase`; the six bases sum to ANSR's published benchmark,
 * so a clean run lands exactly there. Touching a hazard books `SETBACK_MONTHS`
 * and drops the player back at the last solid ground they stood on — a delay,
 * never a death — and the total is capped below the going-alone baseline so
 * leaning on ANSR always beats doing it alone. Quick wins are counted, never
 * scored, so the closing figure stays a single credible number.
 *
 * A setback never rebuilds the Screen, so collected pickups stay collected
 * (RUN.KEEP_COLLECTED_ON_SETBACK) for free.
 *
 * It never imports rendering or DOM APIs.
 */
import { RESOLUTION, TRANSITION, ASSIST, JOURNEY } from '../data/tuning.config';
import { SCREEN_COUNT, TOTAL_QUICK_WINS, type BadgeType } from '../data/levels';
import { StateMachine } from './StateMachine';
import { GAME_TRANSITIONS, type GameState } from './gameStates';
import type { InputState } from './Input';
import { Player } from '../world/Player';
import { Screen } from '../world/Screen';
import { aabbOverlap, type AABB } from '../world/Physics';
import { Powerups, type ActivePowerView } from '../world/Powerups';
import { Quicksand } from '../world/Hazards/Quicksand';
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
  quickWins: number;
  totalQuickWins: number;
  /** Capabilities engaged this run, in the order they were picked up. */
  engaged: BadgeType[];
  reachedScreenId: number;
  reachedScreenName: string;
}

export interface SimulationEvents {
  onStateChange?: (from: GameState, to: GameState) => void;
  onScreenEnter?: (screenId: number, screenName: string) => void;
  onScreenClear?: (screenId: number, timeS: number, setbacks: number) => void;
  /** A hazard cost the player time. `totalMonths` is the new clock reading. */
  onSetback?: (cause: SetbackCause, monthsAdded: number, totalMonths: number) => void;
  onQuickWin?: (id: string, count: number) => void;
  onBadgeCollected?: (screenId: number, badgeType: BadgeType) => void;
}

export interface SimulationOptions extends SimulationEvents {
  startScreen?: number;
  assist?: Partial<AssistState>;
}

/**
 * Pickup hitbox (px, centred on the point). Sized to the *drawn* collectible,
 * which grew when the Growth Point got its own contrast plate — a pickup you can
 * clearly see but visibly run through without collecting feels broken.
 */
const QUICK_WIN_SIZE = 36;
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
  private _quickWins = 0;
  private readonly _engaged: BadgeType[] = [];

  readonly powerups = new Powerups();
  private hazard: Hazard | null = null;

  private titleCardT = 0;
  private setbackHold = 0;
  private screenTimeS = 0;
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
  get quickWins(): number {
    return this._quickWins;
  }
  /** Capabilities engaged this run, in pickup order. */
  get engaged(): readonly BadgeType[] {
    return this._engaged;
  }
  /** True while a setback is being registered (host pauses input feedback). */
  get inSetback(): boolean {
    return this.setbackHold > 0;
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
      quickWins: this._quickWins,
      totalQuickWins: TOTAL_QUICK_WINS,
      engaged: [...this._engaged],
      reachedScreenId: this._screenId,
      reachedScreenName: this._screen.name,
    };
  }

  // --- run lifecycle --------------------------------------------------------

  private startRun(): void {
    this.monthsBooked = 0;
    this._setbacks = 0;
    this._quickWins = 0;
    this._engaged.length = 0;
    this.loadScreen(0);
    this.enterTitleCard();
  }

  private loadScreen(id: number): void {
    this._screenId = id;
    this._screen = new Screen(id);
    this.powerups.reset();
    this.hazard = this.buildHazard();
    this._player.respawn(this._screen.spawnX, this._screen.spawnY);
    this.setbacksOnScreen = 0;
    this.screenTimeS = 0;
    this.setbackHold = 0;
    this.resetSafeHistory();
  }

  /** Build the (single) hazard family for the current screen from level data. */
  private buildHazard(): Hazard | null {
    const d = this._screen.data;
    switch (d.hazard) {
      case 'quicksand':
        return new Quicksand(d.quicksand ?? []);
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
   * Hard reset back to the START screen from any state (pause "Start over", the
   * kill switch). Bypasses the transition allow-list deliberately.
   */
  reset(): void {
    this.monthsBooked = 0;
    this._setbacks = 0;
    this._quickWins = 0;
    this._engaged.length = 0;
    this.loadScreen(0);
    this.titleCardT = 0;
    this.sm.force('START');
  }

  /** Screen label for the title card / HUD (copy override or name). */
  get screenLabel(): string {
    return this._screen.data.copy?.titleCard ?? this._screen.name;
  }

  // --- setbacks (there is no death) -----------------------------------------

  private resetSafeHistory(): void {
    this.safeHistory.length = 0;
    this.safeHistory.push({ x: this._screen.spawnX, y: this._screen.spawnY });
  }

  /**
   * Remember solid ground the player is genuinely standing on. Sludge contact
   * (speed multiplier below 1) is never "safe", so a setback can't drop you back
   * into the pit you just climbed out of.
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
   * Book a delay. No lives are lost and no state changes — the run continues.
   * No-op during the grace period, or with the "no setbacks" assist on.
   */
  setback(cause: SetbackCause): void {
    if (this.sm.state !== 'PLAYING') return;
    if (this.assist.noSetbacks || this._player.isInvulnerable) return;

    this._setbacks += 1;
    this.setbacksOnScreen += 1;

    const spot = this.knockbackSpot();
    this._player.respawn(spot.x, spot.y);
    this._player.grantInvulnerability(JOURNEY.SETBACK_INVULN);
    this.hazard?.reset();
    this.setbackHold = TRANSITION.SETBACK_HOLD;

    this.events.onSetback?.(cause, JOURNEY.SETBACK_MONTHS, this.months);
  }

  private clearScreen(): void {
    this.monthsBooked += this._screen.data.monthsBase ?? 0;
    this.events.onScreenClear?.(this._screenId, this.screenTimeS, this.setbacksOnScreen);
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

      case 'WIN':
      case 'BOOT':
      default:
        break;
    }
  }

  private updatePlaying(dt: number, input: InputState): void {
    this.screenTimeS += dt;

    // A setback holds the world for a beat so the delay registers, then play
    // resumes exactly where it left off (no fade, no respawn ceremony).
    if (this.setbackHold > 0) {
      this.setbackHold -= dt;
      this._player.tickInvulnerability(dt);
      return;
    }

    // Collidables = static solids + the laid bridge + hazard bodies.
    const solids: AABB[] = this._screen.solids
      .concat(this.powerups.extraSolids())
      .concat(this.hazard ? this.hazard.solids() : []);
    const speedMult = this.hazard ? this.hazard.speedMultAt(this._player) : 1;
    // Some hazards suppress jumping (deep red-tape sludge). Strip the jump bits
    // rather than special-casing the Player, so this stays a hazard concern.
    const effective =
      this.hazard?.blocksJump?.(this._player) === true
        ? { ...input, jumpPressed: false, jumpHeld: false }
        : input;
    // …and some only weigh jumps down (shallow sludge: laboured hops, not leaps).
    const jumpMult = this.hazard?.jumpMultAt?.(this._player) ?? 1;
    this._player.update(dt, effective, solids, speedMult, jumpMult);

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

    this.collectQuickWins();

    // Fell out of the world → the ground gave way; costs months, not a life.
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

  private tryCollectBadge(): void {
    const b = this._screen.data.badge;
    if (!b || this.powerups.collected) return;
    const T = RESOLUTION.TILE;
    const box: AABB = { x: b.gx * T, y: b.gy * T, w: T, h: T };
    if (aabbOverlap(this._player.box, box)) {
      this.powerups.collect(b);
      if (!this._engaged.includes(b.type)) this._engaged.push(b.type);
      this.events.onBadgeCollected?.(this._screenId, b.type);
    }
  }

  private collectQuickWins(): void {
    const p = this._player.box;
    for (const pt of this._screen.points) {
      if (pt.collected) continue;
      const box: AABB = {
        x: pt.x - QUICK_WIN_SIZE / 2,
        y: pt.y - QUICK_WIN_SIZE / 2,
        w: QUICK_WIN_SIZE,
        h: QUICK_WIN_SIZE,
      };
      if (aabbOverlap(p, box)) {
        pt.collected = true;
        this._quickWins += 1;
        this.events.onQuickWin?.(pt.id, this._quickWins);
      }
    }
  }
}
