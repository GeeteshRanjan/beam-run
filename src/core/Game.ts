/**
 * Game — DOM/render host around the headless Simulation.
 *
 * Builds the stage (canvas + DOM UI layer), owns the Renderer, Input, Loop and
 * (dev) DebugOverlay, and presents the Simulation each frame with decoupled
 * interpolation. HUD and overlays are real DOM for accessibility; the canvas
 * only draws the world. Pause is a host-level concern (it halts stepping); all
 * gameplay truth stays in `Simulation`.
 */
import { RESOLUTION, BRAND, LOOP, ASSIST, PLAYER, POWERUPS } from '../data/tuning.config';
import { COPY, capabilityFor } from '../data/copy';
import { Loop } from './Loop';
import { Renderer } from './Renderer';
import { Input, makeInput, type InputState } from './Input';
import { DebugOverlay } from './DebugOverlay';
import { Simulation, type SimulationOptions } from './Simulation';
import type { GameState } from './gameStates';
import { Hud } from '../ui/Hud';
import { Overlays, type OverlayName, type CtaContext } from '../ui/Overlays';
import { injectStyles } from '../ui/styles';
import { Stamps } from '../world/Hazards/Stamps';
import { Dragon } from '../world/Hazards/Dragon';
import { ComplianceMaze } from '../world/Hazards/ComplianceMaze';
import { Workplace } from '../world/Hazards/Workplace';
import { Effects } from './Effects';
import { causeLabel } from './setbackLog';
import { DELAY_FLIGHT_TIME, delayFlightPose } from './delayFlight';
import { finaleLayout } from './finaleScene';
import { drawFinaleScene } from '../render/finale';
import { AudioEngine } from '../audio/AudioEngine';
import {
  drawHero,
  drawAnsrBubble,
  BUBBLE_TEAL,
  type HeroMotion,
} from '../render/sprites';
import { drawBadgePickup, drawBadgePerch, drawBadgeCeilingDrop } from '../render/badge';
import { drawInkPads, drawStamps as drawStampHeads } from '../render/stamps';
import {
  drawMonsters,
  drawGatherPad,
  drawLift,
  drawHoist,
  drawWeatherWash,
  drawFiled,
} from '../render/maze';
import {
  drawMummies,
  drawShots,
  drawBandages,
  drawOverheadCabinet,
  drawCutter,
  drawOffice,
  drawTerminal,
  drawTangled,
} from '../render/workplace';
import {
  drawDragon,
  drawCone,
  drawWaterShots,
  drawWaterCannon,
  drawSteam,
  drawHiredCandidates,
  drawFloatingBrick,
  drawScorchedGround,
  drawBurningHero,
} from '../render/dragon';
import { drawBadgeDelivery } from '../render/carrier';
import { badgeCenter } from '../world/badgeFloat';
import { isPerched, perchCenter } from '../world/badgePerch';
import { drawTileRect, drawSceneBackground, drawReliefWash, CEILING } from '../render/scenery';
import { drawTitleScene } from '../render/titleScene';
import { drawText, drawLabelPlaque } from '../render/PixelText';
import { AssistController } from './AssistController';
import { TouchControls, isTouchDevice } from '../ui/TouchControls';
import { AssistMenu } from '../ui/AssistMenu';
import { Analytics, detectDevice } from '../analytics/Analytics';
import { buildNavigatorPayload, buildNavigatorUrl, type CtaContext as NavCtaContext } from '../analytics/navigator';
import { getSessionId, getMutePref, setMutePref } from '../analytics/Save';

/**
 * The short ANSR product tag shown on a badge (single source: CAPABILITIES).
 *
 * Every badge in the game maps to a capability now — the no-effect `SAFE_PASSAGE`
 * mark was deleted with its last holder, the Tech Park's (owner call) — so the
 * fallback is unreachable from level data. It stays because this takes a `string`:
 * the brand is a safe answer, where the raw badge type would draw as "SAFE PASSAGE"
 * (the 5×7 font has no underscore) and name a product that does not exist.
 */
function solutionTag(badge: string): string {
  return capabilityFor(badge)?.tag ?? 'ANSR';
}

/**
 * Where the delay log's newest row lands, in internal (1280×720) coordinates.
 *
 * The log is real DOM in the HUD's top-right stack, so this is an approximation of
 * a CSS-laid position — and it is allowed to be one, because the flying label fades
 * out as it arrives rather than snapping into the row. The figures come from
 * `ui/styles.ts`: the stack is inset `clamp(8px, 2.2%, 22px)` from the right edge
 * and the log hangs under the lives plaque, so the panel's own rows start around
 * y≈120 at a 1280-wide frame. `x` is pulled well inside the right edge because the
 * label is centred and is up to ~270px wide at scale 2.
 */
const DELAY_LOG_ANCHOR = { x: RESOLUTION.WIDTH - 160, y: 120 };

/**
 * Seconds between crackles off the Workplace's unfixed terminal.
 *
 * Presentation-only, so it lives here rather than in `tuning.config.ts`: the sparks it
 * accompanies are themselves drawn off a render clock and have no simulation state at
 * all, and a gameplay constant behind a sound that changes nothing would be a lie about
 * where the number matters. Long enough that the arc reads as a room the player is
 * standing in rather than an alarm — the screen can be on for half a minute.
 */
const SPARK_INTERVAL = 1.7;

/** A short-lived floating label (value gained / capability unlocked). */
interface Popup {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  scale: number;
}

export interface GameOptions {
  navigatorUrl?: string;
  consent?: boolean;
  onCta?: (payload: Record<string, string | number>) => void;
  onStateChange?: (from: GameState, to: GameState) => void;
}

export const DEFAULT_OPTIONS: Required<Pick<GameOptions, 'navigatorUrl' | 'consent'>> = {
  navigatorUrl: '/gcc-opportunity-navigator',
  consent: false,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class Game {
  readonly root: HTMLElement;
  readonly stage: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly renderer: Renderer;
  readonly input: Input;
  readonly sim: Simulation;
  readonly hud: Hud;
  readonly overlays: Overlays;
  readonly options: GameOptions;

  private readonly loop: Loop;
  /**
   * Dev-only. Constructed lazily behind `__DEV__` so the class is genuinely
   * dropped from production: every *use* of it was already gated, but the eager
   * field initialiser kept it reachable, so it shipped to every host.
   */
  private readonly debug = __DEV__ ? new DebugOverlay() : null;
  private readonly effects: Effects;
  private readonly audio = new AudioEngine();
  private readonly assist: AssistController;
  private readonly touch: TouchControls;
  private readonly assistMenu: AssistMenu;
  private readonly isTouch = isTouchDevice();
  private readonly analytics: Analytics;
  private runStartS = 0;
  private reducedMotion = false;
  private paused = false;
  private assistOpen = false;
  private summaryOpen = false;
  private destroyed = false;
  private wired = false;
  private lastFrameS = 0;
  private prevOnGround = false;
  /**
   * Last-seen values of the hiring dragon's monotonic counters.
   *
   * The hazard is headless, so it cannot play a sound; the host polls instead and
   * fires a cue for every increment it has not seen. That keeps `world/*` free of
   * the AudioEngine and, more usefully, keeps the cue tied to the event the
   * *simulation* booked rather than to a frame the renderer happened to draw — a
   * jet fired inside a hit-stop still gets its hiss.
   */
  private dragonCues = {
    shots: 0,
    quenches: 0,
    hits: 0,
    roaring: false,
    toppling: false,
    beaten: false,
  };
  /** Last-seen DENIED stamp counters: strokes that landed, strokes that were refused. */
  private stampCues = { slams: 0, deflections: 0 };
  /**
   * Last-seen Workplace state. Two counters and three edges, plus one timer: the
   * terminal's crackle has no simulation clock behind it (the sparks are drawn off a
   * render hash), so its cue is paced here — which keeps the sound and the picture
   * answering to the same thing, i.e. nothing in the sim.
   */
  private workplaceCues = { winds: 0, throws: 0, working: false, ok: false, sparkT: 0 };
  /**
   * Walk-cycle phase (s), advanced by *distance covered* rather than wall clock,
   * so any hazard that drags the player visibly slows the stride too. A
   * time-driven cycle made a slowed hero look like he was running at full pace on
   * the spot.
   */
  private strideClock = 0;
  private readonly popups: Popup[] = [];
  /**
   * The delay currently in flight from the place of death to the log panel, if
   * any. One at a time by construction: a setback ends the stage, so a second one
   * cannot be booked while the first is still in the air.
   */
  private delayFlight: { from: { x: number; y: number }; text: string; t: number } | null = null;
  private stageObserver: ResizeObserver | null = null;

  constructor(root: HTMLElement, options: GameOptions = {}) {
    this.root = root;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    injectStyles(root.ownerDocument);

    const doc = root.ownerDocument;
    this.stage = doc.createElement('div');
    this.stage.className = 'beam-run__stage';

    this.canvas = doc.createElement('canvas');
    this.canvas.className = 'beam-run__canvas';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', COPY.a11y.canvasLabel);
    this.stage.appendChild(this.canvas);

    const ui = doc.createElement('div');
    ui.className = 'beam-run__ui';
    this.stage.appendChild(ui);
    this.root.appendChild(this.stage);

    this.reducedMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    this.effects = new Effects(this.reducedMotion);
    this.analytics = new Analytics({
      consent: this.options.consent ?? false,
      sessionId: getSessionId(),
      device: detectDevice(),
      reducedMotion: this.reducedMotion,
      getInput: () => (this.isTouch ? 'touch' : 'keyboard'),
    });

    this.renderer = new Renderer(this.canvas);
    this.input = new Input();
    this.input.attach(window);

    // Build the DOM UI before the Simulation, because the Simulation's
    // constructor fires an initial state change (→ START) that syncs the UI.
    this.hud = new Hud(ui);
    this.overlays = new Overlays(
      ui,
      {
      onStart: () => {
        void this.audio.unlock(); // Start button = the autoplay-unlock gesture.
        this.sim.requestStart();
      },
      onSkip: () => this.handleSkip(),
      onResume: () => this.closeSummaryAndResume(),
      onRestart: () => this.handleRestart(),
      onContinue: () => this.sim.continueAfterLifeLost(),
      // The briefing card's button. The sim decides whether the press counts (it
      // ignores one inside the opening grace), so there is nothing to check here.
      onAdvance: () => {
        void this.audio.unlock(); // also a gesture, on a touch device it may be the first
        this.sim.requestAdvance();
      },
      onCta: (ctx, topic) => this.handleCta(ctx, topic),
      onToggleMute: () => {
        this.audio.toggleMuteAll();
        this.assist.syncMutes(this.audio.isMuted('music'), this.audio.isMuted('sfx'));
        this.persistMute();
      },
      onOpenAssist: () => this.openAssist(),
      },
      { reducedMotion: this.reducedMotion },
    );

    this.sim = new Simulation({
      onStateChange: (from, to) => this.onSimStateChange(from, to),
      onScreenEnter: (id, name) => {
        this.effects.clear();
        this.popups.length = 0;
        this.delayFlight = null;
        this.prevOnGround = false;
        this.analytics.screenEntered(id, name);
        this.hud.announce(COPY.a11y.screenEntered(name));
      },
      onScreenClear: (id, timeS, setbacks) => {
        this.audio.playSfx('screenClear');
        this.analytics.screenCleared(id, timeS, setbacks, this.sim.months);
      },
      onSetback: (cause, monthsAdded, totalMonths, livesLeft) => {
        // A short shake, one non-strobe flash, brief hit-stop — then the sim has
        // already moved to LIFE_LOST, which is the beat the impact is painted on.
        this.effects.addShake();
        this.effects.addFlash();
        this.effects.addHitStop();
        // Caught by the wrapped figure: a burst of tape shreds off the player, in
        // the screen's caution yellow. It is the one setback that throws debris,
        // because it is the one where something visibly grabs him.
        if (cause === 'mummy') {
          const p = this.sim.player;
          this.effects.emitBurst(p.box.x + p.box.w / 2, p.box.y + p.box.h / 2, '#E8C23A', 14, 150);
        }
        // Caught by a compliance monster: a burst of loose forms, in the same near-white
        // the monsters' approval plates are drawn in, because the pile that lands on him
        // and the head that filed him are the same material.
        if (cause === 'monster') {
          const p = this.sim.player;
          this.effects.emitBurst(p.box.x + p.box.w / 2, p.box.y + p.box.h / 3, '#E4EAEC', 16, 170);
        }
        this.audio.playSfx('setback');
        /*
         * The cost, written where it was paid and then carried to where it is
         * recorded (owner call). The obstacle's name plus "+2 MONTHS" appears over
         * the body, holds long enough to be read, and flies up into the delay log —
         * so the row that appears in the panel visibly came off the player rather
         * than materialising in a corner nobody was looking at.
         *
         * Presentation only: the sim booked the delay on the frame of contact and
         * `logPanel` is already correct. The label is the *same string the log row
         * uses* (`COPY.hud.logRow`) with the unit spelled out, because the whole
         * point is that the player recognises it when it lands.
         */
        {
          const p = this.sim.player;
          this.delayFlight = {
            from: { x: p.box.x + p.box.w / 2, y: p.box.y - 6 },
            text: `${causeLabel(cause)} +${monthsAdded} MONTHS`,
            t: 0,
          };
        }
        this.analytics.setbackIncurred(this.sim.screenId, cause, totalMonths, livesLeft);
        const reason = COPY.setback.reason[cause] ?? cause;
        this.hud.announce(
          `${COPY.a11y.setback(reason, monthsAdded)} ${COPY.a11y.livesLeft(livesLeft)}`,
        );
      },
      onOutOfLives: (screenId, months, delays) => {
        this.audio.playSfx('setback');
        this.analytics.gameOver(screenId, months, delays);
        this.analytics.ctaShown('summary');
        this.hud.announce(COPY.a11y.outOfLives(months, delays));
      },
      onBadgeCollected: (id, type) => {
        // The badge moves — it is mid-float on five screens and lying where a drone
        // put it on the sixth — so the burst has to come from where it actually was.
        // Its anchor cell is only where the *rail* starts, and on the dragon screen
        // it means nothing at all. `badgePoint` answers for both.
        const c = this.sim.badgePoint;
        if (c) {
          // Orange = the "value" accent, reserved for the badge burst.
          this.effects.emitBurst(c.x, c.y, BRAND.ORANGE, 16, 190);
        }
        this.audio.playSfx('badge');
        this.analytics.badgeCollected(id, type);
        const cap = capabilityFor(type);
        this.hud.announce(
          `${COPY.badgeToast.prefix}: ${cap?.product ?? COPY.meta.name}. ${cap?.effect ?? ''}`,
        );
        // Floating "ANSR ENGAGED" + the product name, in the value orange.
        if (c) {
          this.spawnPopup(c.x, c.y - 24, 'ANSR ENGAGED', BRAND.ORANGE, 2);
          this.spawnPopup(c.x, c.y - 8, solutionTag(type), '#CFE6EC', 2);
        }
      },
    });

    this.loop = new Loop({
      step: (dt) => {
        // Hit-stop briefly freezes the sim on impact for game feel (reduced-motion: off).
        if (!this.paused && !this.effects.hitStopActive) {
          this.sim.step(dt, this.input.getState());
        }
      },
      render: (alpha) => this.render(alpha),
    });

    // Touch controls (built before the assist controller so the "larger
    // controls" hook can resize them) and the assist options dialog.
    this.touch = new TouchControls(ui, {
      setVirtual: (dir, down) => this.input.setVirtual(dir, down),
      onFirstInteraction: () => void this.audio.unlock(),
    });
    this.assist = new AssistController(
      {
        sim: this.sim,
        loop: this.loop,
        audio: this.audio,
        setLargerControls: (larger) => this.touch.setLarger(larger),
        setAutoRun: (on) => {
          this.input.setAutoRun(on);
          this.touch.setAutoRun(on);
        },
      },
      (message) => this.hud.announce(message),
      (option, enabled) => {
        this.analytics.assistToggled(option, enabled);
        if (option === 'muteMusic' || option === 'muteSfx') this.persistMute();
      },
      // One-tap play is the default on touch: a non-gamer should not have to
      // drive a virtual d-pad to hear our message.
      { autoRun: this.isTouch && ASSIST.AUTO_RUN_DEFAULT_ON_TOUCH },
    );
    this.assistMenu = new AssistMenu(ui, this.assist, () => {
      this.assistOpen = false;
      this.syncUI();
    });

    // Restore the saved mute preference (privacy-safe localStorage).
    const savedMute = getMutePref();
    if (savedMute) {
      this.audio.setMuted('music', savedMute.music);
      this.audio.setMuted('sfx', savedMute.sfx);
      this.assist.syncMutes(savedMute.music, savedMute.sfx);
    }

    this.bindWindowEvents();
    this.wired = true;
    this.syncUI();
    this.loop.start();
    this.analytics.gameLoaded(); // assets ready, start screen shown
  }

  private persistMute(): void {
    setMutePref({ music: this.audio.isMuted('music'), sfx: this.audio.isMuted('sfx') });
  }

  // --- lifecycle wiring -----------------------------------------------------

  private readonly onResize = (): void => this.renderer.resize();
  private readonly onVisibility = (): void => {
    if (document.hidden) this.loop.stop();
    else if (!this.destroyed) this.loop.start();
  };
  private readonly onDebugKey = (e: KeyboardEvent): void => {
    if (e.code === 'Backquote') this.debug?.toggle();
  };

  private bindWindowEvents(): void {
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (__DEV__) window.addEventListener('keydown', this.onDebugKey);

    // A window `resize` misses every container-driven size change: a host layout
    // reflow, a late webfont, the mobile URL bar collapsing (dvh), or simply the
    // fact that our first resize() in the ctor ran before the stage had been laid
    // out. Observing the stage covers all of them (and fires once on observe, so
    // it doubles as the authoritative initial measurement).
    if (typeof ResizeObserver === 'function') {
      this.stageObserver = new ResizeObserver(() => {
        if (!this.destroyed) this.renderer.resize();
      });
      this.stageObserver.observe(this.stage);
    }
  }

  private onSimStateChange(from: GameState, to: GameState): void {
    // Kick the ambient bed + game_started once the run actually begins.
    if (to === 'TITLE_CARD' && from === 'START') {
      this.audio.startMusic();
      this.runStartS = this.now();
      this.analytics.gameStarted();
    }
    if (to === 'WIN') {
      this.audio.playSfx('win');
      const r = this.sim.receipt;
      this.analytics.gameCompleted(
        r.months,
        this.now() - this.runStartS,
        r.setbacks,
        r.engaged.length,
      );
      this.analytics.ctaShown('win');
      this.hud.announce(COPY.a11y.won(r.months));
    }
    // A fresh attempt after running out of lives is a new run for the funnel:
    // without this, only the first attempt of a session was ever counted.
    if (to === 'TITLE_CARD' && from === 'LIFE_LOST') this.runStartS = this.now();
    if (to === 'PLAYING') this.setPaused(false);
    this.syncUI();
  }

  /**
   * "Skip to the Navigator" mid-run shows the partial receipt first, so a session
   * that never reaches the finale still lands the message. From the start screen
   * (nothing to show yet) it hands off immediately.
   */
  private handleSkip(): void {
    const midRun = this.sim.state === 'PLAYING' || this.sim.state === 'TITLE_CARD';
    if (!midRun) {
      this.handleCta('skip');
      return;
    }
    this.summaryOpen = true;
    this.analytics.runSummary(
      this.sim.screenId,
      this.sim.months,
      this.now() - this.runStartS,
    );
    this.analytics.ctaShown('summary');
    this.hud.announce(COPY.a11y.summary);
    this.syncUI();
  }

  private closeSummaryAndResume(): void {
    this.summaryOpen = false;
    this.setPaused(false);
    this.syncUI();
  }

  private setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.syncUI();
  }

  private openAssist(): void {
    this.assistOpen = true;
    // Refresh mute toggles from the live audio state before showing.
    this.assist.syncMutes(this.audio.isMuted('music'), this.audio.isMuted('sfx'));
    this.assistMenu.show();
    this.syncUI();
  }

  private handleRestart(): void {
    this.summaryOpen = false;
    if (this.sim.state === 'WIN') {
      this.sim.requestRestart();
    } else {
      this.sim.reset();
    }
    this.setPaused(false);
  }

  /**
   * Hand off to the Navigator. `topic` is present only when the click came from a
   * capability row on the receipt — a declared interest, never an inferred one.
   */
  private handleCta(context: CtaContext, topic?: string): void {
    const target = this.options.navigatorUrl ?? DEFAULT_OPTIONS.navigatorUrl;
    // "Skip" is a mid-game click-through; log it before the hand-off.
    if (context === 'skip') this.analytics.gameSkipped(this.sim.screenId);
    this.analytics.ctaClicked(context as NavCtaContext, target, topic);

    const payload = buildNavigatorPayload(context as NavCtaContext, this.sim.months, topic);
    if (this.options.onCta) {
      this.options.onCta(payload as unknown as Record<string, string | number>);
      return;
    }
    const url = buildNavigatorUrl(target, payload);
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info('[BeamRun] CTA →', url);
    }
    // Always navigate. This used to be gated on production, which meant the two
    // Navigator routes (title-screen skip, receipt capability rows) pressed but
    // went nowhere on the dev server — indistinguishable from a broken button,
    // and it made the custom 404 screen unreachable while developing.
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  }

  // --- headless simulation (tests) -----------------------------------------

  static simulate(script: Partial<InputState>[], opts: SimulationOptions = {}): Simulation {
    const sim = new Simulation(opts);
    for (const frame of script) {
      sim.step(LOOP.FIXED_DT, makeInput(frame));
    }
    return sim;
  }

  // --- rendering ------------------------------------------------------------

  private render(alpha: number): void {
    this.handleFrameInput();

    // Real-time dt drives all presentation-only animation (effects, count-up).
    const nowS = this.now();
    const dt = this.lastFrameS ? Math.min(0.1, nowS - this.lastFrameS) : 0;
    this.lastFrameS = nowS;
    this.effects.update(dt);
    if (!this.paused) {
      this.updatePopups(dt);
      if (this.delayFlight) {
        this.delayFlight.t += dt;
        if (this.delayFlight.t >= DELAY_FLIGHT_TIME) this.delayFlight = null;
      }
    }

    const state = this.sim.state;
    const p = this.sim.player;
    // Stride cadence follows actual ground speed (capped at 1× walk speed).
    this.strideClock += dt * Math.min(1, Math.abs(p.vx) / PLAYER.WALK_SPEED);
    const px = lerp(p.prevX, p.box.x, alpha) + p.box.w / 2;
    if (state === 'PLAYING') {
      // Landing dust + cue on the touchdown frame.
      if (p.onGround && !this.prevOnGround) {
        this.effects.emitDust(px, p.box.y + p.box.h, BRAND.LIGHT_GREY, 8);
        this.audio.playSfx('land');
      }
      // Jump cue on the take-off frame (left ground moving upward).
      if (!p.onGround && this.prevOnGround && p.vy < 0) {
        this.audio.playSfx('jump');
      }
    }
    this.prevOnGround = p.onGround;
    this.syncStampAudio();
    this.syncWorkplaceAudio(dt);
    this.syncDragonAudio();

    const shake = this.effects.shakeOffset();
    this.renderer.begin(shake.x, shake.y);
    const { ctx } = this.renderer;
    this.drawBackground(ctx);

    if (state !== 'START' && state !== 'BOOT') {
      this.drawWorld(ctx, alpha);
      this.drawParticles(ctx);
      this.drawPopups(ctx);
      this.drawDelayFlight(ctx);
    }
    this.drawFlash(ctx);
    this.renderer.end();

    if (__DEV__) {
      const dpr = this.renderer.toDeviceSpace();
      const p = this.sim.player;
      this.debug?.render(ctx, dpr, [
        `state: ${state}${this.paused ? ' (paused)' : ''}`,
        `fps: ${this.loop.fps}  steps: ${this.loop.lastSteps}`,
        `screen: ${this.sim.screenId} ${this.sim.screen.name}`,
        `months: ${this.sim.months}  delays: ${this.sim.setbacks}  lives: ${this.sim.lives}/${this.sim.livesTotal}`,
        `assisted: ${this.sim.powerups.isAssisted}  autorun: ${this.input.isAutoRun}`,
        `pos: ${p.box.x.toFixed(0)},${p.box.y.toFixed(0)} ground:${p.onGround}`,
        '` toggles this overlay',
      ]);
    }

    this.syncUI();

    // Drive the closing months count-up on the win screen (real-time dt).
    if (state === 'WIN' && !this.paused) this.overlays.advanceMonths(dt);

    this.input.endFrame();
  }

  private handleFrameInput(): void {
    const s = this.input.getState();
    if (s.pausePressed && (this.sim.state === 'PLAYING' || this.paused)) {
      this.setPaused(!this.paused);
    }
    // Master mute toggle (M).
    if (s.mutePressed) {
      void this.audio.unlock();
      this.audio.toggleMuteAll();
      this.assist.syncMutes(this.audio.isMuted('music'), this.audio.isMuted('sfx'));
      this.persistMute();
    }
  }

  /** Reconcile DOM HUD + overlays with the current sim/pause state. */
  private syncUI(): void {
    if (!this.wired) return;
    const state = this.sim.state;
    let overlay: OverlayName | null = null;
    // The mid-run receipt outranks pause: it is the thing we most want seen.
    if (this.summaryOpen) overlay = 'summary';
    else if (this.paused) overlay = 'pause';
    else if (state === 'START' || state === 'BOOT') overlay = 'start';
    else if (state === 'TITLE_CARD') overlay = 'titlecard';
    /*
     * A lost life shows NOTHING (owner call). The sim holds in LIFE_LOST for
     * `LIVES.LOST_HOLD`, which is the beat the impact is painted on — the hero
     * flat under the stamp, or wrapped in the Workplace tape — and then restarts
     * the stage from its title card, where the retry hint carries the one thing
     * the deleted overlay used to say. The delay is still announced to assistive
     * tech (`onSetback` → `hud.announce`), so nothing is lost for a screen-reader
     * user by there being no dialog.
     *
     * The last life is the exception: that is the end of the attempt, and it lands
     * on the conversion surface.
     */
    else if (state === 'LIFE_LOST') {
      overlay = this.sim.lifeLost?.outOfLives ? 'gameover' : null;
    } else if (state === 'WIN') overlay = 'win';

    // The assist dialog sits above everything; hide the base overlay behind it.
    if (this.assistOpen) overlay = null;

    this.overlays.show(overlay, {
      levelLabel: this.sim.screenLabel,
      // What the stage ahead is, in one line. Keyed by screen id in `COPY` rather
      // than authored in `levels.json`: it is prose about the design, and every word
      // in that file ships to the host unless the stripper is taught to remove it.
      brief: COPY.titleCard.brief[this.sim.screenId],
      // The retry hint, and the only surviving trace of the life-lost screen.
      hint: this.sim.retrying ? COPY.lifeLost.retryHint : undefined,
      receipt: this.sim.receipt,
      lifeLost: this.sim.lifeLost ?? undefined,
    });

    // The fourth thumb target exists only where it does something, and says which
    // tool it is: the Workplace cutter or the hiring dragon's water cannon.
    const cannon = this.dragon?.hasCannon === true;
    this.touch.setShootVisible(
      cannon || this.workplace?.hasCutter === true,
      cannon ? COPY.controls.shootWater : COPY.controls.shoot,
    );
    // On-screen touch controls: only while actively playing on a touch device.
    this.touch.setVisible(
      this.isTouch &&
        state === 'PLAYING' &&
        !this.paused &&
        !this.assistOpen &&
        !this.summaryOpen,
    );

    /*
     * The HUD stays up through a lost life now that nothing covers the frame: the
     * heart going out *is* the feedback, and hiding the plaque on the one frame it
     * changes would be hiding the news. It goes on the last life, where the screen
     * over the top of it is the whole message.
     */
    const hudVisible =
      !this.paused &&
      !this.summaryOpen &&
      (state === 'PLAYING' ||
        state === 'TITLE_CARD' ||
        (state === 'LIFE_LOST' && this.sim.lifeLost?.outOfLives === false));
    this.hud.setVisible(hudVisible);
    // The model is fed even while hidden, so the plaques are already correct
    // (lives spent, log grown) the instant the next title card puts them back.
    {
      const power = this.sim.activePower;
      this.hud.update({
        // The plaque gets the place name, not the title card's framing line
        // ("Arrival — ANSR Tech Park"): a 24-character string set in the bitmap
        // font would run into the lives plaque opposite on a phone frame. The
        // title card still shows the full line on entry.
        levelLabel: this.sim.screen.name,
        lives: this.sim.lives,
        livesTotal: this.sim.livesTotal,
        log: this.sim.logPanel,
        power: power ? { name: power.name, product: power.product } : null,
      });
    }
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() * 0.001 : 0;
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const { WIDTH: w, HEIGHT: h } = RESOLUTION;
    const id = this.sim.screen.id;
    const t = this.reducedMotion ? 0 : this.now();

    // Base fill (also covers the START/boot screens before a world exists).
    ctx.fillStyle = BRAND.DEEP_TEAL;
    ctx.fillRect(0, 0, w, h);

    // Before the run starts we are on the attract screen, not in level 0: it gets
    // its own composed title scene (skyline rising towards the lit ANSR tower)
    // rather than showing the tutorial level's backdrop and in-world signage
    // through the copy.
    const state = this.sim.state;
    if (state === 'START' || state === 'BOOT') {
      drawTitleScene(ctx, t, this.reducedMotion);
      return;
    }

    // The finale paints its own bespoke hero sky/plaza in drawFinale; every
    // other screen gets its meaningful pixel backdrop here.
    //
    // The last argument is the Compliance maze's weather (0 overcast, 1 daylight),
    // which is what GCC-BOT looks like on that screen instead of a halo on the hero
    // (owner call). It is read off the hazard here rather than inside `scenery.ts`,
    // which has no business knowing a badge exists.
    // …and the last one is Hire Under Fire's `relief` (0 while the beast holds the far end,
    // 1 once it is beaten and the five have walked out of its costume), which is what
    // "the environment turns all bright and happy" is as a number. Same arrangement as the
    // maze's weather, and read off the hazard here for the same reason.
    if (id !== 5) {
      drawSceneBackground(
        ctx,
        id,
        t,
        this.reducedMotion,
        this.maze?.skyClear ?? 0,
        this.dragon?.relief ?? 0,
      );
    }
  }

  private drawWorld(ctx: CanvasRenderingContext2D, alpha: number): void {
    const screen = this.sim.screen;

    if (screen.id === 5) {
      // Finale is the one hand-crafted hero scene (sky/plaza/glass tower/bloom).
      this.drawFinale(ctx);
    } else {
      // Ground/platforms/walls as textured 8-bit level material (per-level
      // meaning: lobby floor, red-tape ground, scorched brick, etc.). Solids the
      // screen paints as its own prop (`Screen.propRects` — the badge's floating
      // bricks on Hire Under Fire) are skipped here and drawn with that screen's art.
      for (const s of screen.solids) {
        if (screen.propRects.includes(s)) continue;
        drawTileRect(ctx, screen.id, s.x, s.y, s.w, s.h);
      }
    }

    this.drawEngagedLabel(ctx);
    this.drawHazards(ctx);
    this.drawBadge(ctx);

    const p = this.sim.player;
    const cx = lerp(p.prevX, p.box.x, alpha) + p.box.w / 2;
    const feetY = lerp(p.prevY, p.box.y, alpha) + p.box.h;
    const flicker =
      !this.reducedMotion && p.isInvulnerable && Math.floor(this.now() * 20) % 2 === 0;
    if (!flicker) {
      this.drawPlayer(ctx, cx, feetY);
      const workplace = this.workplace;
      // The cutter is *held*, so it goes on after the figure — and only where the
      // badge has actually armed it.
      if (workplace?.hasCutter) {
        drawCutter(ctx, cx, feetY, p.facing, workplace.sinceShot, this.reducedMotion);
      }
      // Same rule for the water cannon on Hire Under Fire: held, so it is drawn
      // after the hero, and only once Talent500 has put it in his hands.
      const dragon = this.dragon;
      if (dragon?.hasCannon) {
        drawWaterCannon(ctx, cx, feetY, p.facing, dragon.sinceShot, this.reducedMotion);
      }
      // Caught by the wrapped figure: the room does to the player exactly what it
      // did to him. Same job as the flattened stamp pose on Setup Delays.
      if (this.tangled) {
        drawTangled(ctx, cx, feetY, this.reducedMotion ? 0 : this.now(), this.reducedMotion);
      }
      // Caught by a compliance monster: he is buried in the queue. The third of the three
      // death poses, and the screen that had none until now — a frozen frame with no pose
      // says a delay happened without saying what did it.
      if (this.filed) {
        drawFiled(
          ctx,
          cx,
          feetY,
          this.reducedMotion ? 0.2 : (this.now() * 0.6) % 1,
          this.reducedMotion,
        );
      }
      // Caught by the dragon's fire: he BURNS (owner call). The fourth death pose, and the
      // fourth time the answer was to build it out of the obstacle's own vocabulary — a
      // stamp flattens him, tape wraps him, paperwork buries him, and fire burns him.
      if (this.burning) {
        drawBurningHero(
          ctx,
          cx,
          feetY,
          this.lifeLostProgress,
          this.reducedMotion ? 0 : this.now(),
          this.reducedMotion,
        );
      }
    }
  }

  /** The current screen's Workplace hazard, or null anywhere else. */
  private get workplace(): Workplace | null {
    const hazard = this.sim.activeHazard;
    return hazard instanceof Workplace ? hazard : null;
  }

  /** The current screen's Compliance maze, or null anywhere else. */
  private get maze(): ComplianceMaze | null {
    const hazard = this.sim.activeHazard;
    return hazard instanceof ComplianceMaze ? hazard : null;
  }

  /** The current screen's hiring dragon, or null anywhere else. */
  private get dragon(): Dragon | null {
    const hazard = this.sim.activeHazard;
    return hazard instanceof Dragon ? hazard : null;
  }

  /**
   * Turn the dragon's counters into sound, once each.
   *
   * Six cues, six edges: the opening roar, a jet leaving the cannon, a jet
   * beating the fire back, a layer of the costume going, the animal going over, and
   * the five hires landing. The counters only ever go up, so "how many have I not
   * played yet" is subtraction — and a reload resets them to zero, which is why the
   * roar and the topple are detected as *rising edges* of a phase rather than counted.
   */
  /**
   * Setup Delays: the DENIED stamps, which are two sounds and not one.
   *
   * A stroke that reaches the floor thuds; a stroke that meets an ANSR-backed player
   * gives up, and *that* is the muffled version — the thud that did not work (owner
   * call). The whole screen is one mechanism either landing or being stopped, so the
   * pair has to be audibly the same object, which is why `stampDud` is `stampThud` with
   * its transient and its top end removed rather than a different noise.
   *
   * Both come off monotonic counters for the reason the dragon's do: several stamps can
   * land inside one rendered frame, and a hazard that fired callbacks would sound them
   * during a hit-stop.
   */
  private syncStampAudio(): void {
    const hazard = this.sim.activeHazard;
    const stamps = hazard instanceof Stamps ? hazard : null;
    if (!stamps) {
      this.stampCues = { slams: 0, deflections: 0 };
      return;
    }
    if (this.sim.state !== 'PLAYING') return;
    const c = this.stampCues;
    // One cue per kind per frame, as with the jets: four thuds on the same millisecond
    // is a click, not four stamps.
    if (stamps.slams > c.slams) {
      /*
       * Weighted by how far the column that landed is from the player: the four stamps
       * land every 1.4s between them, and at one volume that is a drum machine. Near it
       * is a slam, a screen away it is a pulse under the music — which is the read the
       * screen wants anyway, since the loud one is the one about to matter.
       */
      const at = stamps.lastSlamAt;
      const p = this.sim.player;
      const d = at === null ? 0 : Math.abs(at - (p.box.x + p.box.w / 2));
      const near = Math.max(0, 1 - d / (RESOLUTION.WIDTH * 0.55));
      this.audio.playSfx('stampThud', 0.3 + 0.7 * near * near);
    }
    if (stamps.deflections > c.deflections) this.audio.playSfx('stampDud');
    c.slams = stamps.slams;
    c.deflections = stamps.deflections;
  }

  /**
   * The Workplace, which until now was the only screen in the game with no voice of
   * its own (owner call: five cues). Four of them are the figure and the room —
   *
   *  - **the figure**, groaning as he winds up. On the wind-up rather than on the
   *    release, because that is the frame the *telegraph* starts: the sound is worth
   *    having only if it is information, and `THROW_WINDUP` later is too late to be.
   *  - **the hush** of the roll leaving his hand, which is the act the groan warned of.
   *  - **the keyboard**, once the freed colleague is at it. A rising edge, so the flurry
   *    plays as he sits down and not once per frame he is sitting there.
   *  - **the arc** off the unfixed terminal, paced on a real-time timer here because the
   *    sparks themselves are drawn off a render hash and have no sim clock to borrow.
   *  - **the chime**, on the frame the screen says OK — which is `restore` crossing 0.5,
   *    the same threshold `drawTerminal` prints the word at, so the sound and the text
   *    cannot disagree.
   */
  private syncWorkplaceAudio(dt: number): void {
    const w = this.workplace;
    if (!w) {
      this.workplaceCues = { winds: 0, throws: 0, working: false, ok: false, sparkT: 0 };
      return;
    }
    if (this.sim.state !== 'PLAYING') return;
    const c = this.workplaceCues;
    if (w.windUps > c.winds) this.audio.playSfx('mummy');
    if (w.throws > c.throws) this.audio.playSfx('hush');
    c.winds = w.windUps;
    c.throws = w.throws;

    const working = w.isWorking;
    if (working && !c.working) this.audio.playSfx('typing');
    c.working = working;

    const ok = w.restore > 0.5;
    if (ok && !c.ok) this.audio.playSfx('chime');
    c.ok = ok;

    if (w.isSparking) {
      c.sparkT += dt;
      if (c.sparkT >= SPARK_INTERVAL) {
        c.sparkT = 0;
        this.audio.playSfx('spark');
      }
    } else {
      c.sparkT = 0;
    }
  }

  private syncDragonAudio(): void {
    const dragon = this.dragon;
    if (!dragon) {
      this.dragonCues = {
        shots: 0,
        quenches: 0,
        hits: 0,
        roaring: false,
        toppling: false,
        beaten: false,
      };
      return;
    }
    const c = this.dragonCues;
    const roaring = dragon.isRoaring && this.sim.state === 'PLAYING';
    if (roaring && !c.roaring) this.audio.playSfx('roar');
    c.roaring = roaring;

    // Capped at one cue per frame per kind: several jets can land inside one
    // rendered frame, and four hisses stacked on the same millisecond is a click.
    /*
     * The fall (owner call: it "is very dumb", and it was — it had no cue of its own, so
     * the moment the boss went over sounded exactly like the three small hits before it).
     * The topple *replaces* the fourth `strip`: they land on the same frame, and a tear
     * of cloth under a falling animal is the small sound winning the mix.
     */
    const toppling = dragon.isToppling;
    const fell = toppling && !c.toppling;
    if (fell) this.audio.playSfx('topple');
    c.toppling = toppling;

    if (dragon.shotsFired > c.shots) this.audio.playSfx('water');
    if (dragon.quenches > c.quenches) this.audio.playSfx('steam');
    if (dragon.hits > c.hits && !fell) this.audio.playSfx('strip');
    c.shots = dragon.shotsFired;
    c.quenches = dragon.quenches;
    c.hits = dragon.hits;

    if (dragon.isBeaten && !c.beaten) {
      this.audio.playSfx('hired');
      // Confetti in the world as well as on the canvas: the one burst in the game
      // that is not about a badge, so it gets the mint the HIRED stamps are in.
      const b = dragon.dragonState().box;
      this.effects.emitBurst(b.x + b.w / 2, b.y + b.h / 2, '#9FE6C4', 18, 210);
    }
    c.beaten = dragon.isBeaten;
  }

  /**
   * True on the life-lost frames that follow the dragon's fire: the player is drawn
   * **burning** (owner call), charring from the feet up with smoke over his head.
   *
   * Presentation only, like the other three poses — the sim booked the delay the instant the
   * flame touched him. `'fire'` is the dragon's cause and no other screen uses it.
   */
  private get burning(): boolean {
    return this.sim.state === 'LIFE_LOST' && this.sim.lifeLost?.cause === 'fire';
  }

  /** How far through the life-lost hold we are — the burn takes hold over it. */
  private get lifeLostProgress(): number {
    return this.sim.lifeLostProgress;
  }

  /** True on the life-lost frames that follow contact with the wrapped figure. */
  private get tangled(): boolean {
    return this.sim.state === 'LIFE_LOST' && this.sim.lifeLost?.cause === 'mummy';
  }

  /**
   * True on the life-lost frames that follow contact with a compliance monster: the player
   * is drawn buried in the paperwork it just filed him under (`render/maze.ts`).
   *
   * Presentation only, like the other two: the sim booked the delay on the frame of contact.
   * `'monster'` is the maze's cause and no other screen uses it, so this needs no screen
   * check — but the monster's own pose does come from the hazard (`MonsterState.struck`),
   * which is why `Simulation.setback()` must keep not resetting it.
   */
  private get filed(): boolean {
    return this.sim.state === 'LIFE_LOST' && this.sim.lifeLost?.cause === 'monster';
  }

  /**
   * The in-world "ANSR is with you" read once the badge is taken: one label, in
   * the value orange, anchored at the badge column.
   *
   * It used to also cap the top edge of every solid from that column onwards with
   * a bright cyan walkable edge. That has gone (owner call): it painted a blue
   * line along the floor the moment the badge was picked up, which read as a
   * surface defect rather than as value. Everything it was trying to say is now
   * said by things attached to the player instead — the ANSR bubble around him
   * and the engaged-capability chip in the HUD.
   *
   * Before that it was a gateway-and-dimming treatment, built for the old layout
   * where the badge sat mid-screen and split it into a dimmed struggle half and a
   * lit relief half. The badge is taken *before* the obstacles now, so there is no
   * "before" half left to dim.
   *
   * Skipped on the finale, which paints its own plaza.
   */
  private drawEngagedLabel(ctx: CanvasRenderingContext2D): void {
    const screen = this.sim.screen;
    const badge = screen.data.badge;
    if (!badge || screen.id === 5) return;
    if (!this.sim.powerups.isAssisted) return;
    const T = RESOLUTION.TILE;
    const groundY = 15 * T;
    const fromX = badge.gx * T + T / 2;

    drawText(ctx, 'ANSR ENGAGED', fromX + 40, groundY - 124, {
      scale: 2,
      color: BRAND.ORANGE,
      align: 'left',
      outline: 'rgba(0,20,26,0.9)',
      alpha: 0.9,
    });
  }

  /** Draw the human hero, choosing a pose from the sim's motion state. */
  private drawPlayer(ctx: CanvasRenderingContext2D, centerX: number, feetY: number): void {
    const p = this.sim.player;
    let motion: HeroMotion;
    if (this.flattened) motion = 'squash';
    else if (!p.onGround) motion = p.vy < 0 ? 'jump' : 'fall';
    else motion = Math.abs(p.vx) > 20 ? 'run' : 'idle';
    // The bubble goes behind the figure so the hero stays the readable thing.
    if (this.sim.shielded) this.drawShield(ctx, centerX, feetY);
    // Feet land ~2px into the tile so the shoes sit on the surface. The 16×20
    // grid at scale 3 → a 48×60 figure (bigger, clearly a person). The squash
    // pose gets scale 4: it is 22×9, so at scale 3 it read as a 66×27 smudge —
    // pressed out to 88px wide it reads as a person who has just been flattened,
    // which is the entire point of the frame.
    drawHero(
      ctx,
      { motion, facing: p.facing, time: this.strideClock, still: this.reducedMotion },
      centerX,
      feetY + 2,
      motion === 'squash' ? 4 : 3,
    );
  }

  /**
   * True on the life-lost frames that follow a DENIED stamp: the player is drawn
   * flat on the floor with the stamp still holding them there. Presentation only
   * — the sim booked the delay the instant the stamp landed.
   */
  private get flattened(): boolean {
    return this.sim.state === 'LIFE_LOST' && this.sim.lifeLost?.cause === 'stamp';
  }

  /**
   * The ANSR bubble: what "the power is active" looks like on the player rather
   * than on the world.
   *
   * Only drawn where contact is genuinely harmless (`Simulation.shielded`), so it
   * never promises protection the rules do not give. The pulse is the only
   * wall-clock part; under `prefers-reduced-motion` it holds mid-pulse, which is a
   * steady ring rather than no ring (the bubble is information, not decoration).
   */
  private drawShield(ctx: CanvasRenderingContext2D, centerX: number, feetY: number): void {
    const t = this.reducedMotion ? 0 : this.now();
    const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3.2);
    // Teal on Hire Under Fire, orange everywhere else: an orange field on a screen
    // of orange fire hid the player inside his own hazard (see `BUBBLE_TEAL`).
    const tint = this.dragon ? BUBBLE_TEAL : undefined;
    // `phase` turns the rim dither and the sparks; frozen with the pulse under
    // reduced motion, which leaves a steady field rather than none.
    drawAnsrBubble(ctx, centerX, feetY, pulse, (t * 0.22) % 1, tint);
  }

  // --- floating value popups ------------------------------------------------

  private spawnPopup(x: number, y: number, text: string, color: string, scale = 2): void {
    if (this.popups.length > 24) this.popups.shift();
    this.popups.push({ x, y, vy: -34, life: 1.1, maxLife: 1.1, text, color, scale });
  }

  private updatePopups(dt: number): void {
    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      const p = this.popups[i]!;
      p.life -= dt;
      if (!this.reducedMotion) p.y += p.vy * dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }

  private drawPopups(ctx: CanvasRenderingContext2D): void {
    for (const p of this.popups) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      drawText(ctx, p.text, p.x, p.y, {
        scale: p.scale,
        color: p.color,
        align: 'center',
        outline: 'rgba(0,20,26,0.9)',
        alpha: a,
      });
    }
  }

  /**
   * The booked delay, in flight from the place of death to the delay log.
   *
   * Drawn last of everything in the world, because for these 0.8s it *is* the
   * news. The geometry is `core/delayFlight.ts` (pure, and tested there); this
   * method only chooses the plaque's colours.
   *
   * The plaque is cool, never the value orange. Same rule that keeps orange off
   * the log itself: a ledger of avoidable months is the opposite of value, and the
   * one warm thing on it is the running total on the panel it is flying into.
   */
  private drawDelayFlight(ctx: CanvasRenderingContext2D): void {
    const flight = this.delayFlight;
    if (!flight) return;
    const pose = delayFlightPose(
      flight.from,
      DELAY_LOG_ANCHOR,
      flight.t / DELAY_FLIGHT_TIME,
      this.reducedMotion,
    );
    drawLabelPlaque(ctx, flight.text, pose.x, pose.y, {
      scale: 2,
      fg: '#F2FBFD',
      bg: 'rgba(0,20,27,0.86)',
      frame: 'rgba(159,200,210,0.7)',
      padX: 8,
      padY: 6,
      alpha: pose.alpha,
    });
  }

  /** Landing dust + pickup/badge bursts (empty under reduced motion). */
  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const pt of this.effects.activeParticles()) {
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Single brief death flash (suppressed under reduced motion — no strobe). */
  private drawFlash(ctx: CanvasRenderingContext2D): void {
    const a = this.effects.flashAlpha();
    if (a <= 0) return;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.45 * a})`;
    ctx.fillRect(0, 0, RESOLUTION.WIDTH, RESOLUTION.HEIGHT);
  }

  private drawHazards(ctx: CanvasRenderingContext2D): void {
    const data = this.sim.screen.data;
    if (data.hazard === 'stamps') {
      this.drawStamps(ctx);
      return;
    }
    if (data.hazard === 'dragon') {
      this.drawDragonScreen(ctx);
      return;
    }
    if (data.hazard === 'maze') {
      this.drawMaze(ctx);
      return;
    }
    if (data.hazard === 'workplace') {
      this.drawWorkplace(ctx);
      return;
    }
  }

  /**
   * DENIED rubber stamps slamming down from the top of the frame. The painting
   * lives in `render/stamps.ts` — it is pure, so it can be rasterised and
   * inspected on its own, and it needs nothing from this host but the snapshot.
   *
   * The ink pads go down *before* the world's own decoration reads over them and
   * the heads after, so a pressed stamp covers its own pad.
   */
  private drawStamps(ctx: CanvasRenderingContext2D): void {
    const hazard = this.sim.activeHazard;
    if (!(hazard instanceof Stamps)) return;
    drawInkPads(ctx, hazard.columns);
    drawStampHeads(
      ctx,
      hazard.stampStates(),
      hazard.isSlowed,
      this.flattened ? hazard.struckAt : null,
    );
  }

  /**
   * Hire Under Fire: the dragon, its fire, and the water going the other way.
   *
   * All of the painting lives in `render/dragon.ts` — pure, so it rasterises on its
   * own — and this host supplies only the snapshot and a clock. The order is the
   * argument: the dragon and its fire go down first, then the water and the steam
   * over them, then the people who came out of the costume on top of everything,
   * because by the time they are on screen nothing else on it matters.
   *
   * The inline flame painting this replaced was the last hazard in the game that
   * was still drawn from inside `Game` — 70 lines that could not be rasterised or
   * tested without a browser. It went with the fire lanes.
   */
  private drawDragonScreen(ctx: CanvasRenderingContext2D): void {
    const hazard = this.sim.activeHazard;
    if (!(hazard instanceof Dragon)) return;
    const t = this.reducedMotion ? 0 : this.now();
    const state = hazard.dragonState();
    // The payoff's full-frame half first: a cool veil that lifts and a pale wash that comes
    // up, over the brickwork the backdrop cannot reach and under everything that moves, so
    // the cast stays saturated against it. Exactly the two layers the maze's weather needs.
    drawReliefWash(ctx, hazard.relief);
    // Then the ground: the floor it has already burnt, receding as the light comes good.
    drawScorchedGround(ctx, state.box.x + state.box.w / 2, hazard.relief);
    // The floating bricks the badge is delivered onto. Before the fire, because the
    // outer end of the cone crosses the last one and fire goes in front of masonry.
    drawFloatingBrick(ctx, this.sim.screen.propRects, t, this.reducedMotion);
    drawDragon(ctx, state, t, this.reducedMotion);
    drawCone(ctx, hazard.fireState(), t, this.reducedMotion);
    drawWaterShots(ctx, hazard.waterStates());
    drawSteam(ctx, hazard.steamStates());
    drawHiredCandidates(ctx, hazard.candidateStates(), t, this.reducedMotion);
  }

  /**
   * The compliance maze: toll gates, then the five monsters over them, then the
   * pad they leave for once GCC-BOT has filed everything.
   *
   * The painting lives in `render/maze.ts` — pure, so it rasterises on its own —
   * and this host supplies nothing but the hazard's snapshot. The lift and the
   * landing pad go down first, so the monsters read in front of them: they are the
   * thing to watch on this screen.
   */
  private drawMaze(ctx: CanvasRenderingContext2D): void {
    const hazard = this.sim.activeHazard;
    if (!(hazard instanceof ComplianceMaze)) return;
    // The weather goes down first, over the masonry the backdrop cannot reach and
    // under everything that moves, so the cast stays saturated against it.
    drawWeatherWash(ctx, hazard.skyClear);
    drawLift(ctx, hazard.liftState());
    drawHoist(ctx, hazard.hoistState());
    drawGatherPad(ctx, hazard.gatherAt, hazard.isFriendly);
    drawMonsters(ctx, hazard.monsterStates());
  }

  /**
   * The Workplace. The room first (gloom, fittings, tape, signs), then the
   * terminal, then the figure and any pulses in the air.
   *
   * All of it lives in `render/workplace.ts` — pure, so it rasterises on its own —
   * and this host supplies only the snapshot and a clock. The room is painted here
   * rather than in `scenery.ts` because everything in it is driven by the hazard's
   * `restore` dial, and `drawSceneBackground` has no business knowing about a
   * hazard.
   */
  private drawWorkplace(ctx: CanvasRenderingContext2D): void {
    const hazard = this.sim.activeHazard;
    if (!(hazard instanceof Workplace)) return;
    const t = this.reducedMotion ? 0 : this.now();
    const mummies = hazard.mummyStates();
    drawOffice(ctx, this.sim.screen.data.clutter ?? [], hazard.restore, t, this.reducedMotion);
    drawTerminal(
      ctx,
      hazard.terminalAt,
      mummies.some((m) => m.phase === 'working'),
      hazard.restore,
      t,
      this.reducedMotion,
    );
    // The cabinet the ANSR mark drops onto. A `pedestal` solid, so `drawWorld` skips it
    // and it is painted as the room's own furniture rather than as level brickwork.
    drawOverheadCabinet(ctx, this.sim.screen.propRects, hazard.restore);
    drawMummies(ctx, mummies, t, this.reducedMotion);
    drawShots(ctx, hazard.shotStates());
    // …and the bandages he has thrown, over the figure that threw them.
    drawBandages(ctx, hazard.bandageStates());
  }

  /**
   * The badge, drawn wherever the simulation currently says it is.
   *
   * The position comes from `badgeCenter` with the *simulation* clock, not from
   * the wall clock and not from a render-only bob: the hitbox travels with the
   * sprite, so any second opinion about where the badge is would be a pickup you
   * can see but not collect. For the same reason the float is not frozen under
   * `prefers-reduced-motion` — that would move the collision box. The shimmer,
   * the halo and the label are juice and do honour the preference.
   *
   * The painting itself lives in `render/badge.ts` (pure, so it can be rasterised
   * and looked at on its own). This method's only job is to hand it the band, the
   * ground line and a phase.
   */
  private drawBadge(ctx: CanvasRenderingContext2D): void {
    const badge = this.sim.screen.data.badge;
    if (!badge || this.sim.powerups.collected) return;
    const T = RESOLUTION.TILE;

    // Delivered rather than hung up (Hire Under Fire): the drone, the mark falling
    // out of it, and the clock running down on the ground. All of the positions come
    // from the sim, which collides against the same function.
    const delivery = this.sim.badgeDrop;
    if (delivery) {
      drawBadgeDelivery(
        ctx,
        delivery,
        this.reducedMotion ? 0.12 : (this.now() * 0.3) % 1,
        this.reducedMotion,
      );
      // The capability plaque rides with it, above the mark rather than below: there
      // is no float band to collide with here, and while the badge is on the floor
      // *below* it is inside the ground.
      if (delivery.phase !== 'gone') {
        const tag = solutionTag(badge.type);
        if (tag) {
          // High enough to clear the carrier's own "TAKE IT" plaque, which appears
          // 46px over the mark in the last beat of its life (`render/carrier.ts`).
          drawLabelPlaque(ctx, tag, delivery.badge.x, delivery.badge.y - 92, {
            scale: 2,
            fg: '#CFE6EC',
            bg: 'rgba(0,26,34,0.7)',
            frame: 'rgba(28,130,150,0.6)',
            alpha: 0.95,
          });
        }
      }
      return;
    }

    /*
     * Falling out of a ceiling spotlight (the Workplace): no rail and no carrier — the
     * source is a fitting the room already has. The host supplies the phase and the row
     * it lands on; everything else comes from the sim, which collides against the same
     * function (`world/badgeCeiling.ts`).
     */
    const ceiling = this.sim.badgeCeiling;
    if (ceiling) {
      drawBadgeCeilingDrop(ctx, {
        phase: ceiling.phase,
        source: ceiling.source,
        badge: ceiling.badge,
        restY: (badge.restGy ?? 15) * T - T / 2,
        remaining: ceiling.remaining,
        progress: ceiling.progress,
        tick: this.reducedMotion ? 0.12 : (this.now() * 0.3) % 1,
        warnAt: POWERUPS.CEILING.WARN_TIME,
        // The lens it hangs from is the ROOM's geometry, so it comes from the room.
        hangFromY: CEILING.SPOT_BOTTOM,
      });
      // The capability plaque rides above the mark: below it is the cabinet's own top
      // course while it is down, and the fitting's cowl while it is still up there.
      const ceilingTag = solutionTag(badge.type);
      if (ceilingTag && ceiling.phase !== 'gone') {
        drawLabelPlaque(ctx, ceilingTag, ceiling.badge.x, ceiling.badge.y - 52, {
          scale: 2,
          fg: '#CFE6EC',
          bg: 'rgba(0,26,34,0.7)',
          frame: 'rgba(28,130,150,0.6)',
          alpha: 0.95,
        });
      }
      return;
    }

    // Standing on a wall (the Compliance maze): no rail, no band, no clock. The
    // position is a constant, so the only thing this host supplies is a phase.
    if (isPerched(badge)) {
      const at = perchCenter(badge);
      drawBadgePerch(ctx, {
        cx: at.x,
        cy: at.y,
        surfaceY: at.y + T / 2,
        phase: this.reducedMotion ? 0.12 : (this.now() * 0.3) % 1,
      });
      const perchTag = solutionTag(badge.type);
      if (perchTag) {
        // Above the mark here, not below: below is the wall's own top course, where a
        // plaque would be painted onto the masonry the badge is standing on.
        drawLabelPlaque(ctx, perchTag, at.x, at.y - 40, {
          scale: 2,
          fg: '#CFE6EC',
          bg: 'rgba(0,26,34,0.7)',
          frame: 'rgba(28,130,150,0.6)',
          alpha: 0.95,
        });
      }
      return;
    }

    const c = badgeCenter(badge, this.sim.clock);
    const anchorY = badge.gy * T + T / 2;
    const lane = POWERUPS.FLOAT_AMPLITUDE;

    drawBadgePickup(ctx, {
      cx: c.x,
      cy: c.y,
      bandTop: anchorY - lane,
      bandBottom: anchorY + lane,
      groundY: 15 * T,
      // Held at a fixed frame under reduced motion: a steady mark, not no mark.
      phase: this.reducedMotion ? 0.12 : (this.now() * 0.3) % 1,
      // Read from the same clock the position comes from, so the wake never
      // disagrees with the direction of travel.
      rising: badgeCenter(badge, this.sim.clock + 0.05).y < c.y,
    });

    // Name the ANSR capability this badge unlocks, so the "solution" is explicit.
    // Always *below* the mark, never above it: above the badge is exactly where
    // the player's body is on the frame they jump for it (rasterised — the plaque
    // sat across his chest), and at the top of the swing it would collide with the
    // HUD's left stack. Below, the worst case is the standing player covering it,
    // and he is drawn after this.
    const tag = solutionTag(badge.type);
    if (tag) {
      drawLabelPlaque(ctx, tag, c.x, c.y + 34, {
        scale: 2,
        fg: '#CFE6EC',
        bg: 'rgba(0,26,34,0.7)',
        frame: 'rgba(28,130,150,0.6)',
        alpha: 0.95,
      });
    }
  }

  /**
   * The Tech Park arrival. Layout comes from the pure finaleScene; the painting
   * lives in render/finale.ts (it is the densest picture in the game and has no
   * business inside the host class).
   */
  private drawFinale(ctx: CanvasRenderingContext2D): void {
    drawFinaleScene(ctx, finaleLayout(), this.reducedMotion ? 0 : this.now(), this.reducedMotion);
  }

  // --- teardown -------------------------------------------------------------

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loop.stop();
    this.input.detach();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (__DEV__) window.removeEventListener('keydown', this.onDebugKey);
    this.stageObserver?.disconnect();
    this.stageObserver = null;
    this.audio.destroy();
    this.touch.destroy();
    this.assistMenu.destroy();
    this.hud.destroy();
    this.overlays.destroy();
    this.stage.remove();
  }
}
