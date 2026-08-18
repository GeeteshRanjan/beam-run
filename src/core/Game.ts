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
import { Fire } from '../world/Hazards/Fire';
import { Gates } from '../world/Hazards/Gates';
import { Spikes } from '../world/Hazards/Spikes';
import { Effects } from './Effects';
import { finaleLayout } from './finaleScene';
import { drawFinaleScene } from '../render/finale';
import { AudioEngine } from '../audio/AudioEngine';
import { drawHero, drawBadgeDisc, type HeroMotion } from '../render/sprites';
import { badgeCenter } from '../world/badgeFloat';
import { drawTileRect, drawSceneBackground } from '../render/scenery';
import { drawTitleScene } from '../render/titleScene';
import { pxRect, hash2 } from '../render/PixelArt';
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
 * `SAFE_PASSAGE` — the badge on the two screens with nothing to defend against —
 * has no capability and so no product tag. It falls back to the brand rather
 * than to the raw badge type, which would draw as "SAFE PASSAGE" (the 5×7 font
 * has no underscore) and name a product that does not exist.
 */
function solutionTag(badge: string): string {
  return capabilityFor(badge)?.tag ?? 'ANSR';
}

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
   * Walk-cycle phase (s), advanced by *distance covered* rather than wall clock,
   * so wading the sludge visibly slows the stride. A time-driven cycle made a
   * dragged hero look like he was running at full pace on the spot — the main
   * reason the slowdown read as "not slow" even when it was.
   */
  private strideClock = 0;
  private readonly popups: Popup[] = [];
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
        // already moved to LIFE_LOST, which is what actually reports the cost.
        // No in-world popups here any more: the overlay lands on the next frame
        // and would immediately cover them.
        this.effects.addShake();
        this.effects.addFlash();
        this.effects.addHitStop();
        this.audio.playSfx('setback');
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
        const b = this.sim.screen.data.badge;
        // The badge is mid-float, so the burst has to come from where it actually
        // was — its anchor cell is only where it started.
        const c = b ? badgeCenter(b, this.sim.clock) : null;
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
    if (!this.paused) this.updatePopups(dt);

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

    const shake = this.effects.shakeOffset();
    this.renderer.begin(shake.x, shake.y);
    const { ctx } = this.renderer;
    this.drawBackground(ctx);

    if (state !== 'START' && state !== 'BOOT') {
      this.drawWorld(ctx, alpha);
      this.drawParticles(ctx);
      this.drawPopups(ctx);
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
    // The life-lost screen outranks nothing and is outranked by pause and the
    // mid-run receipt: both are things the player asked for, and neither loses
    // the delay — the sim stays in LIFE_LOST until it is acknowledged.
    else if (state === 'LIFE_LOST') overlay = 'lifelost';
    else if (state === 'WIN') overlay = 'win';

    // The assist dialog sits above everything; hide the base overlay behind it.
    if (this.assistOpen) overlay = null;

    this.overlays.show(overlay, {
      levelLabel: this.sim.screenLabel,
      receipt: this.sim.receipt,
      lifeLost: this.sim.lifeLost ?? undefined,
    });

    // On-screen touch controls: only while actively playing on a touch device.
    this.touch.setVisible(
      this.isTouch &&
        state === 'PLAYING' &&
        !this.paused &&
        !this.assistOpen &&
        !this.summaryOpen,
    );

    const hudVisible =
      !this.paused &&
      !this.summaryOpen &&
      (state === 'PLAYING' || state === 'TITLE_CARD');
    this.hud.setVisible(hudVisible);
    // The model is fed even while hidden, so the plaques are already correct
    // (lives spent, log grown) the instant the next title card puts them back.
    {
      const power = this.sim.activePower;
      this.hud.update({
        // The plaque gets the place name, not the title card's framing line
        // ("Arrival — ANSR Tech Park"): a 24-character string set in the bitmap
        // font would run into the clock on a phone frame. The title card still
        // shows the full line on entry.
        levelLabel: this.sim.screen.name,
        months: this.sim.months,
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
    if (id !== 5) drawSceneBackground(ctx, id, t, this.reducedMotion);
  }

  private drawWorld(ctx: CanvasRenderingContext2D, alpha: number): void {
    const screen = this.sim.screen;

    if (screen.id === 5) {
      // Finale is the one hand-crafted hero scene (sky/plaza/glass tower/bloom).
      this.drawFinale(ctx);
    } else {
      // Ground/platforms/walls as textured 8-bit level material (per-level
      // meaning: lobby floor, red-tape ground, scorched brick, etc.).
      for (const s of screen.solids) drawTileRect(ctx, screen.id, s.x, s.y, s.w, s.h);
    }

    this.drawZoneRead(ctx);
    this.drawHazards(ctx);
    this.drawPlacedTile(ctx);
    this.drawBadge(ctx);

    const p = this.sim.player;
    const cx = lerp(p.prevX, p.box.x, alpha) + p.box.w / 2;
    const feetY = lerp(p.prevY, p.box.y, alpha) + p.box.h;
    const flicker =
      !this.reducedMotion && p.isInvulnerable && Math.floor(this.now() * 20) % 2 === 0;
    if (!flicker) this.drawPlayer(ctx, cx, feetY);
  }

  /**
   * The "ANSR is with you" read: once the badge is taken, the ground from the
   * badge column onwards is capped with a bright walkable edge and labelled.
   *
   * This replaced a gateway-and-dimming treatment built for the old layout, where
   * the badge sat mid-screen and split it into a dimmed struggle half and a lit
   * relief half. The badge is now taken *before* the obstacles, so there is no
   * "before" half left to dim — the whole screen is the after. Keeping the
   * gateway would have drawn a triumphal arch three tiles from the spawn and
   * dimmed almost nothing.
   *
   * The cue is still a plain value step at the floor line rather than a colour
   * swap, and it is skipped on the finale, which paints its own plaza.
   */
  private drawZoneRead(ctx: CanvasRenderingContext2D): void {
    const screen = this.sim.screen;
    const badge = screen.data.badge;
    if (!badge || screen.id === 5) return;
    if (!this.sim.powerups.isAssisted) return;
    const T = RESOLUTION.TILE;
    const groundY = 15 * T;
    const fromX = badge.gx * T + T / 2;

    // Cap each solid's own top edge, not one band across the screen: a single
    // full-width rect drew a bright line hanging in mid-air across screen 1's
    // pit. Per-solid also means the platforms get the edge, which is right —
    // everything you can stand on from here is ANSR-backed.
    ctx.fillStyle = 'rgba(92, 226, 244, 0.85)';
    for (const s of screen.solids) {
      const x = Math.max(fromX, s.x);
      if (s.x + s.w <= x) continue;
      ctx.fillRect(x, s.y - 3, s.x + s.w - x, 3);
    }
    // Also cap the bridge ANSR just laid, so the relief reads as continuous.
    for (const s of this.sim.powerups.extraSolids()) {
      const x = Math.max(fromX, s.x);
      if (s.x + s.w <= x) continue;
      ctx.fillRect(x, s.y - 3, s.x + s.w - x, 3);
    }
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
    if (!p.onGround) motion = p.vy < 0 ? 'jump' : 'fall';
    else motion = Math.abs(p.vx) > 20 ? 'run' : 'idle';
    // Feet land ~2px into the tile so the shoes sit on the surface. The 16×20
    // grid at scale 3 → a 48×60 figure (bigger, clearly a person).
    drawHero(
      ctx,
      { motion, facing: p.facing, time: this.strideClock, still: this.reducedMotion },
      centerX,
      feetY + 2,
      3,
    );
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
    if (data.hazard === 'fire') {
      this.drawFire(ctx);
      return;
    }
    if (data.hazard === 'gates') {
      this.drawGates(ctx);
      return;
    }
    if (data.hazard === 'spikes') {
      this.drawSpikes(ctx);
      return;
    }
    if (data.hazard === 'quicksand' && data.quicksand) {
      const T = RESOLUTION.TILE;
      const t = this.reducedMotion ? 0 : this.now();
      const PX = 5;
      for (const q of data.quicksand) {
        const x = q.gx * T;
        const y = q.gy * T;
        const w = q.w * T;
        const h = q.h * T;
        const deep = q.deep ?? true;
        // Base sludge + stable dithered churn. Shallow struggle sludge is
        // lighter and clearly wadeable; the deep pit is near-black so the
        // "you are not getting across this alone" read is instant.
        ctx.fillStyle = deep ? '#06222A' : '#12495A';
        ctx.fillRect(x, y, w, h);
        for (let py = 0; py < h; py += PX) {
          for (let pxi = 0; pxi < w; pxi += PX) {
            const n = hash2((x + pxi) >> 0, (y + py) >> 0);
            if (n < 0.16) pxRect(ctx, '#06232B', x + pxi, y + py, PX, PX, PX);
            else if (n > 0.9) pxRect(ctx, '#12505E', x + pxi, y + py, PX, PX, PX);
          }
        }
        // Slow chunky ripple bands rolling across the surface (shape + motion).
        for (let row = 0; row < h; row += 15) {
          for (let px = 0; px <= w; px += PX) {
            const yy = y + row + Math.round(Math.sin((px + t * 60 + row * 8) * 0.06) * 4);
            pxRect(ctx, 'rgba(230,230,230,0.22)', x + px, yy, PX, PX, PX);
          }
        }
        // Sinking paperwork flecks — you are literally stuck in the "red tape".
        for (let f = 0; f < 6; f += 1) {
          const seed = hash2(q.gx * 13 + f, q.gy + f * 5);
          const fx = x + 12 + seed * (w - 28);
          const phase = ((t * 0.22 + seed) % 1 + 1) % 1;
          const fy = y + 6 + phase * (h - 18);
          const a = 0.55 * (1 - phase);
          pxRect(ctx, `rgba(207,230,236,${a})`, fx, fy, 10, 8, 2); // sheet
          pxRect(ctx, `rgba(10,44,53,${a})`, fx + 2, fy + 3, 6, 2, 2); // text line
        }
        // A hard bright lip on the deep pit so the drop edge is unmissable.
        if (deep) {
          pxRect(ctx, 'rgba(230,230,230,0.5)', x, y, w, 3, 3);
        }
      }
    }
  }

  private drawFire(ctx: CanvasRenderingContext2D): void {
    const hazard = this.sim.activeHazard;
    if (!(hazard instanceof Fire)) return;
    const T = RESOLUTION.TILE;
    const groundY = 15 * T;
    const t = this.reducedMotion ? 0 : this.now();
    const PX = 5; // chunky flame pixels
    for (const lane of hazard.laneStates()) {
      const cx = lane.x + T / 2;
      if (lane.state === 'out') {
        // Talent500 filled the role: the lane is out for good. Visible proof —
        // a cool doused column with steam, in grey/teal, never the value orange.
        const d = lane.doused;
        ctx.fillStyle = `rgba(159, 216, 228, ${0.06 + 0.06 * (1 - d)})`;
        ctx.fillRect(lane.x + 6, 0, T - 12, groundY);
        // Extinguished stub at the base.
        pxRect(ctx, '#4A5A60', cx - PX * 2, groundY - PX * 3, PX * 4, PX * 3, PX);
        pxRect(ctx, '#6E8288', cx - PX * 2, groundY - PX * 3, PX * 4, PX, PX);
        // Steam curling up (settles as the douse completes; static if reduced).
        const steam = this.reducedMotion ? 0 : (1 - d) * 0.8 + 0.2;
        for (let s = 0; s < 4; s += 1) {
          const seed = hash2(lane.x + s * 11, 7);
          const sy = groundY - 20 - ((t * 40 * steam + seed * 200) % 140);
          const sx = cx + Math.sin(t * 2 + s) * 8;
          pxRect(ctx, `rgba(207,230,236,${0.28 * steam})`, sx, sy, PX, PX, PX);
        }
        continue;
      }
      if (lane.state === 'telegraph') {
        // Smooth warning ramp (never a strobe) — a growing orange glow column.
        const a = 0.1 + lane.progress * 0.25;
        ctx.fillStyle = `rgba(255, 84, 0, ${a})`;
        ctx.fillRect(lane.x + 4, 0, T - 8, groundY);
        // A pixel warning marker at the top of the lane.
        const markColor = `rgba(255, 84, 0, ${0.4 + lane.progress * 0.4})`;
        const s = 3 + Math.round(lane.progress * 4);
        pxRect(ctx, markColor, cx - s * PX, 30, s * PX * 2, PX, PX);
        pxRect(ctx, markColor, cx - PX, 24, PX * 2, PX * 3, PX);
      } else if (lane.state === 'active') {
        // Lethal pixel flame: full and hot at the base, tapering into wavy
        // tongues with a white-hot core and rising embers (hiring pressure).
        for (let y = 0; y < groundY; y += PX) {
          const up = y / groundY; // 0 at ground → 1 at top
          const wave = this.reducedMotion ? 0 : Math.sin(t * 12 + y * 0.12 + lane.x) * 3;
          const half = Math.max(PX, (T / 2 - 4) * (1 - up * 0.55) + wave);
          const base = up > 0.66 ? '#FF5400' : up > 0.33 ? '#FF7A2A' : '#FFA24A';
          pxRect(ctx, base, cx - half, groundY - PX - y, half * 2, PX, PX);
          pxRect(ctx, '#FFD9A8', cx - PX, groundY - PX - y, PX * 2, PX, PX); // core
        }
        // Rising embers (respect reduced-motion).
        if (!this.reducedMotion) {
          for (let e = 0; e < 5; e += 1) {
            const seed = hash2(lane.x + e * 7, 3);
            const ey = groundY - ((t * (70 + seed * 70) + seed * 500) % groundY);
            const ex = cx + Math.sin(t * 3 + e) * 10;
            pxRect(ctx, '#FFB07A', ex, ey, PX, PX, PX);
          }
        }
      }
    }
  }

  /**
   * Approval gates: a filing-cabinet post with a striped barrier arm that sweeps
   * across the path, plus a rubber stamp head. Replaces the old carnivorous
   * plant, which said nothing about tax, GST or audit. Once GCC-BOT clears the
   * filing the arm lifts and the stamp reads OK — same object, opposite meaning.
   */
  private drawGates(ctx: CanvasRenderingContext2D): void {
    const hazard = this.sim.activeHazard;
    if (!(hazard instanceof Gates)) return;
    const groundY = 15 * RESOLUTION.TILE;
    const PX = 5;
    for (const g of hazard.gateStates()) {
      const open = g.open; // 0 = blocking, 1 = cleared
      // Post: a squat cabinet with drawer lines, standing still on the ground.
      const postX = g.cx - PX * 2;
      pxRect(ctx, '#33505C', postX, groundY - PX * 6, PX * 4, PX * 6, PX);
      pxRect(ctx, '#4E7280', postX, groundY - PX * 6, PX * 4, PX, PX);
      for (let d = 1; d <= 2; d += 1) {
        pxRect(ctx, '#1E353E', postX + PX, groundY - PX * 6 + d * PX * 2, PX * 2, PX, PX);
      }

      // Barrier arm: sweeps laterally while blocking, rotates up when cleared.
      const lift = open * (PX * 7); // how far the arm has risen
      const armY = g.topY + PX * 2 - lift;
      const armLen = PX * 7;
      const sweep = (1 - open) * g.sway * 0.5;
      for (let i = 0; i < armLen / PX; i += 1) {
        const seg = i * PX;
        // Hazard stripes read without colour (shape + pattern).
        const stripe = Math.floor(i / 2) % 2 === 0 ? '#E6E6E6' : '#233A44';
        pxRect(ctx, stripe, g.cx - armLen / 2 + seg + sweep, armY - open * seg * 0.55, PX, PX * 2, PX);
      }

      // Stamp head on top of the post: a dark "PENDING" block, or a bright
      // cleared plate once the filing is through.
      const headY = g.topY - PX;
      const face = open > 0.5 ? '#9FE6C4' : '#CFE6EC';
      const core = open > 0.5 ? '#0A3A2A' : '#3A1414';
      const head = [' HHHH ', 'HHHHHH', 'HccccH', 'HHHHHH', ' HHHH '];
      for (let r = 0; r < head.length; r += 1) {
        for (let c = 0; c < head[r]!.length; c += 1) {
          const ch = head[r]![c];
          if (ch === ' ') continue;
          pxRect(
            ctx,
            ch === 'c' ? core : face,
            g.cx - 3 * PX + c * PX + sweep,
            headY - PX + r * PX,
            PX,
            PX,
            PX,
          );
        }
      }
    }
  }

  private drawSpikes(ctx: CanvasRenderingContext2D): void {
    const hazard = this.sim.activeHazard;
    if (!(hazard instanceof Spikes)) return;
    const T = RESOLUTION.TILE;
    const groundY = 15 * T;
    for (const s of hazard.spikeStates()) {
      const cx = s.x + T / 2;

      // 500Leaders: local context. The drop rhythm is unchanged — you can just
      // read it now. Landing spots are marked well ahead, and the clear ground
      // between columns is called out as the safe line.
      if (s.foreseen) {
        const lead = Spikes.previewWindow;
        const incoming = s.state === 'telegraph' && s.timeToFall <= lead;
        const urgency = incoming ? 1 - s.timeToFall / lead : 0;
        // Landing footprint on the ground.
        ctx.fillStyle = `rgba(159, 230, 196, ${0.18 + 0.3 * urgency})`;
        ctx.fillRect(s.x + 4, groundY - 6, T - 8, 6);
        // Dashed drop corridor, always visible so the pattern is legible.
        ctx.strokeStyle = `rgba(159, 230, 196, ${0.14 + 0.2 * urgency})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 10]);
        ctx.beginPath();
        ctx.moveTo(cx, 20);
        ctx.lineTo(cx, groundY);
        ctx.stroke();
        ctx.setLineDash([]);
        if (incoming) {
          drawText(ctx, 'INCOMING', cx, 26, {
            scale: 2,
            color: '#9FE6C4',
            align: 'center',
            outline: 'rgba(0,20,26,0.9)',
            alpha: 0.5 + 0.5 * urgency,
          });
        }
      }

      if (s.state === 'telegraph') {
        // Warning marker at the column top — a smooth ramp, never a strobe.
        const a = 0.15 + s.progress * 0.35;
        ctx.fillStyle = `rgba(255, 84, 0, ${a})`;
        // Downward-pointing chevron hint so it reads without colour.
        ctx.beginPath();
        ctx.moveTo(cx - 12, 6);
        ctx.lineTo(cx + 12, 6);
        ctx.lineTo(cx, 6 + 14 + s.progress * 6);
        ctx.closePath();
        ctx.fill();
        // Faint drop guide-line down the column.
        ctx.strokeStyle = `rgba(230, 230, 230, ${0.08 + s.progress * 0.12})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(cx, 22);
        ctx.lineTo(cx, groundY);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }

      // Falling / resting / despawning: a chunky steel spike (apex up, wide
      // base) built row by row — distinct silhouette + metallic shading.
      const alpha = s.state === 'despawning' ? 1 - s.progress : 1;
      const top = s.y;
      const PX = 4;
      ctx.save();
      ctx.globalAlpha = alpha;
      for (let i = 0; i * PX < T; i += 1) {
        const yy = top + i * PX;
        const frac = (i * PX) / T; // 0 apex → 1 base
        const halfW = Math.max(PX, 4 + frac * (T / 2 - 6));
        pxRect(ctx, BRAND.LIGHT_GREY, cx - halfW, yy, halfW * 2, PX, PX); // steel face
        pxRect(ctx, '#9AA0A6', cx + halfW - PX, yy, PX, PX, PX); // right-edge shade
        pxRect(ctx, '#FFFFFF', cx - PX / 2, yy, PX, PX, PX); // centre highlight ridge
      }
      // Motion streak while falling (respects reduced-motion).
      if (s.state === 'falling' && !this.reducedMotion) {
        pxRect(ctx, 'rgba(230,230,230,0.25)', cx - PX / 2, top - 28, PX, 18, PX);
      }
      ctx.restore();
    }
  }

  private drawPlacedTile(ctx: CanvasRenderingContext2D): void {
    const tile = this.sim.powerups.placedTile;
    if (!tile) return;
    // The ANSR "solved-once" bridge: rendered in the bright finale/plaza
    // material so it reads as the solution laid across the red-tape pit.
    drawTileRect(ctx, 5, tile.x, tile.y, tile.w, tile.h);
    // Bright walkable cap + subtle stud marks so it clearly reads as placed.
    ctx.fillStyle = 'rgba(230,230,230,0.85)';
    ctx.fillRect(tile.x, tile.y, tile.w, 3);
    ctx.fillStyle = 'rgba(230,230,230,0.35)';
    for (let sx = tile.x + 8; sx < tile.x + tile.w - 6; sx += 20) {
      ctx.fillRect(sx, tile.y + 8, 4, 4);
    }
  }

  /**
   * The badge, drawn wherever the simulation currently says it is.
   *
   * The position comes from `badgeCenter` with the *simulation* clock, not from
   * the wall clock and not from a render-only bob: the hitbox travels with the
   * sprite, so any second opinion about where the badge is would be a pickup you
   * can see but not collect. For the same reason the float is not frozen under
   * `prefers-reduced-motion` — that would move the collision box. The glow and
   * the label are still juice and still honour the preference.
   *
   * A faint trail marks the vertical line it travels, so the motion reads as a
   * path to intercept rather than as a wobble.
   */
  private drawBadge(ctx: CanvasRenderingContext2D): void {
    const badge = this.sim.screen.data.badge;
    if (!badge || this.sim.powerups.collected) return;
    const c = badgeCenter(badge, this.sim.clock);
    const cx = c.x;
    const cy = c.y;
    const r = 20;

    // The rail: the straight line the badge floats along, so it is obvious the
    // pickup will come back down to meet you.
    const lane = POWERUPS.FLOAT_AMPLITUDE;
    const anchorY = badge.gy * RESOLUTION.TILE + RESOLUTION.TILE / 2;
    pxRect(ctx, 'rgba(92, 226, 244, 0.16)', cx - 1.5, anchorY - lane, 3, lane * 2, 3);

    // Gentle teal glow (orange is reserved for the active power, not the pickup).
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.8);
    glow.addColorStop(0, 'rgba(0,84,101,0.9)');
    glow.addColorStop(1, 'rgba(0,84,101,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Pixel ANSR disc (12 cells wide → scale 3 gives a ~36px badge).
    drawBadgeDisc(ctx, cx, cy, 3);
    // Name the ANSR capability this badge unlocks, so the "solution" is explicit.
    const tag = solutionTag(badge.type);
    if (tag) {
      drawLabelPlaque(ctx, tag, cx, cy - 52, {
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
