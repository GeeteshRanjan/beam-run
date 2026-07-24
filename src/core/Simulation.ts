/**
 * Simulation — the authoritative, headless game state.
 *
 * This is the single source of gameplay truth, shared by the DOM `Game`
 * (which renders it) and by `Game.simulate()` (which drives it without a
 * canvas for deterministic tests). It owns the top-level StateMachine, the
 * current Screen, the Player, and run-wide progression (lives, points).
 *
 * It never imports rendering or DOM APIs.
 */
import { RESOLUTION, RUN, TRANSITION, ASSIST } from '../data/tuning.config';
import { SCREEN_COUNT } from '../data/levels';
import { StateMachine } from './StateMachine';
import { GAME_TRANSITIONS, type GameState } from './gameStates';
import type { InputState } from './Input';
import { Player } from '../world/Player';
import { Screen } from '../world/Screen';
import { aabbOverlap, type AABB } from '../world/Physics';
import { Powerups, type ActivePowerView } from '../world/Powerups';
import { Quicksand } from '../world/Hazards/Quicksand';
import { Fire } from '../world/Hazards/Fire';
import { Plants } from '../world/Hazards/Plants';
import { Spikes } from '../world/Hazards/Spikes';
import type { Hazard, DeathCause } from '../world/types';

export type { DeathCause } from '../world/types';

export interface AssistState {
  slowMode: boolean;
  extraTime: boolean;
  invincible: boolean;
  largerControls: boolean;
}

export const DEFAULT_ASSIST: AssistState = {
  slowMode: false,
  extraTime: false,
  invincible: false,
  largerControls: false,
};

export interface SimulationEvents {
  onStateChange?: (from: GameState, to: GameState) => void;
  onScreenEnter?: (screenId: number, screenName: string) => void;
  onScreenClear?: (screenId: number, timeS: number, deaths: number) => void;
  onDeath?: (cause: DeathCause, livesLeft: number) => void;
  onPointCollected?: (id: string, total: number) => void;
  onBadgeCollected?: (screenId: number, badgeType: string) => void;
}

export interface SimulationOptions extends SimulationEvents {
  startScreen?: number;
  assist?: Partial<AssistState>;
}

const POINT_SIZE = 24;

export class Simulation {
  readonly sm: StateMachine<GameState>;
  assist: AssistState;

  private _screen: Screen;
  private _player: Player;
  private _lives = RUN.STARTING_LIVES;
  private _points = 0;
  private _screenId: number;

  readonly powerups = new Powerups();
  private hazard: Hazard | null = null;

  private titleCardT = 0;
  private deathTimer = 0;
  private screenTimeS = 0;
  private deathsOnScreen = 0;
  private totalDeaths = 0;
  private readonly events: SimulationEvents;

  constructor(opts: SimulationOptions = {}) {
    this.events = opts;
    this.assist = { ...DEFAULT_ASSIST, ...opts.assist };
    this._screenId = opts.startScreen ?? 0;
    this._screen = new Screen(this._screenId);
    this._player = new Player(this._screen.spawnX, this._screen.spawnY);
    this.hazard = this.buildHazard();

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
  get lives(): number {
    return this._lives;
  }
  get points(): number {
    return this._points;
  }
  get screenId(): number {
    return this._screenId;
  }
  get titleCardProgress(): number {
    return Math.min(1, this.titleCardT / TRANSITION.TITLE_CARD_HOLD);
  }
  get totalDeathCount(): number {
    return this.totalDeaths;
  }
  /** Active timed power for the HUD (null for the permanent bridge tile). */
  get activePower(): ActivePowerView | null {
    return this.powerups.hudModel();
  }

  // --- run lifecycle --------------------------------------------------------

  private startRun(): void {
    this._lives = RUN.STARTING_LIVES;
    this._points = 0;
    this.totalDeaths = 0;
    this.loadScreen(0);
    this.enterTitleCard();
  }

  private loadScreen(id: number): void {
    this._screenId = id;
    this._screen = new Screen(id);
    this.powerups.reset();
    this.hazard = this.buildHazard();
    this._player.respawn(this._screen.spawnX, this._screen.spawnY);
    this.deathsOnScreen = 0;
    this.screenTimeS = 0;
  }

  /** Build the (single) hazard family for the current screen from level data. */
  private buildHazard(): Hazard | null {
    const d = this._screen.data;
    switch (d.hazard) {
      case 'quicksand':
        return new Quicksand(d.quicksand ?? []);
      case 'fire':
        return new Fire(d.fireLanes ?? []);
      case 'plants':
        return new Plants(d.plants ?? []);
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

  /** Re-enter the current screen fresh after a death (per-attempt reset). */
  private respawnScreen(): void {
    const collected = new Set(this._screen.points.filter((p) => p.collected).map((p) => p.id));
    this._screen = new Screen(this._screenId);
    // Points model: collected pickups stay collected across mid-screen respawns.
    if (RUN.KEEP_COLLECTED_ON_RESPAWN) {
      for (const p of this._screen.points) {
        if (collected.has(p.id)) p.collected = true;
      }
    }
    // Badge + placed tile do NOT carry into the retry (re-collect required).
    this.powerups.reset();
    this.hazard = this.buildHazard();
    this._player.respawn(this._screen.spawnX, this._screen.spawnY);
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

  /** Public: restart from Game Over / Win. */
  requestRestart(): void {
    if (this.sm.state === 'GAMEOVER' || this.sm.state === 'WIN') {
      this.sm.transitionTo('START');
    }
  }

  /**
   * Hard reset back to the START screen from any state (pause "Restart", the
   * kill switch). Bypasses the transition allow-list deliberately.
   */
  reset(): void {
    this._screenId = 0;
    this._screen = new Screen(0);
    this.powerups.reset();
    this.hazard = this.buildHazard();
    this._player.respawn(this._screen.spawnX, this._screen.spawnY);
    this._lives = RUN.STARTING_LIVES;
    this._points = 0;
    this.totalDeaths = 0;
    this.deathsOnScreen = 0;
    this.screenTimeS = 0;
    this.titleCardT = 0;
    this.sm.force('START');
  }

  /** Screen label for the title card / HUD (copy override or name). */
  get screenLabel(): string {
    return this._screen.data.copy?.titleCard ?? this._screen.name;
  }

  /** Kill the player (from a hazard or a fall). No-op while invulnerable. */
  kill(cause: DeathCause): void {
    if (this.sm.state !== 'PLAYING') return;
    if (this.assist.invincible || this._player.isInvulnerable) return;
    this.deathsOnScreen += 1;
    this.totalDeaths += 1;
    this._lives -= 1;
    this.deathTimer = TRANSITION.FADE;
    this.sm.transitionTo('DEATH');
    this.events.onDeath?.(cause, Math.max(0, this._lives));
  }

  private clearScreen(): void {
    this.events.onScreenClear?.(this._screenId, this.screenTimeS, this.deathsOnScreen);
    const next = this._screenId + 1;
    if (next < SCREEN_COUNT) {
      this.loadScreen(next);
      this.enterTitleCard();
    }
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

      case 'DEATH':
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) {
          if (this._lives > 0) {
            this.respawnScreen();
            this.sm.transitionTo('PLAYING');
          } else {
            this.sm.transitionTo('GAMEOVER');
          }
        }
        break;

      case 'GAMEOVER':
      case 'WIN':
      case 'BOOT':
      default:
        break;
    }
  }

  private updatePlaying(dt: number, input: InputState): void {
    this.screenTimeS += dt;

    // Collidables = static solids + placed bridge tile + hazard bodies.
    const solids: AABB[] = this._screen.solids
      .concat(this.powerups.extraSolids())
      .concat(this.hazard ? this.hazard.solids() : []);
    const speedMult = this.hazard ? this.hazard.speedMultAt(this._player) : 1;
    this._player.update(dt, input, solids, speedMult);

    this.tryCollectBadge();

    // Advance the hazard; it may be lethal this step (unless a power protects).
    if (this.hazard) {
      const cause = this.hazard.update(dt, this._player, {
        freeze: this.powerups.isFreeze,
        extraTelegraph: this.assist.extraTime ? ASSIST.EXTRA_TELEGRAPH_BONUS : 0,
      });
      if (cause && !this.powerups.protectsFrom(cause)) {
        this.kill(cause);
        return;
      }
    }
    this.powerups.update(dt);

    this.collectPoints();

    // Fell out of the world → death by falling.
    if (this._player.box.y > RESOLUTION.HEIGHT + 80) {
      this.kill('fall');
      return;
    }

    // Win trigger (finale) takes priority over any exit.
    if (
      this._screen.winTriggerX !== undefined &&
      this._player.box.x + this._player.box.w >= this._screen.winTriggerX
    ) {
      this.sm.transitionTo('WIN');
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

  private tryCollectBadge(): void {
    const b = this._screen.data.badge;
    if (!b || this.powerups.collected) return;
    const T = RESOLUTION.TILE;
    const box: AABB = { x: b.gx * T, y: b.gy * T, w: T, h: T };
    if (aabbOverlap(this._player.box, box)) {
      this.powerups.collect(b);
      this.events.onBadgeCollected?.(this._screenId, b.type);
    }
  }

  private collectPoints(): void {
    const p = this._player.box;
    for (const pt of this._screen.points) {
      if (pt.collected) continue;
      const box: AABB = {
        x: pt.x - POINT_SIZE / 2,
        y: pt.y - POINT_SIZE / 2,
        w: POINT_SIZE,
        h: POINT_SIZE,
      };
      if (aabbOverlap(p, box)) {
        pt.collected = true;
        this._points += RUN.POINTS_PER_PICKUP;
        this.events.onPointCollected?.(pt.id, this._points);
      }
    }
  }
}
