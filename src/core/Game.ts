/**
 * Game — DOM/render host around the headless Simulation.
 *
 * Builds the stage (canvas + DOM UI layer), owns the Renderer, Input, Loop and
 * (dev) DebugOverlay, and presents the Simulation each frame with decoupled
 * interpolation. HUD and overlays are real DOM for accessibility; the canvas
 * only draws the world and the death fade. Pause is a host-level concern (it
 * halts stepping); all gameplay truth stays in `Simulation`.
 */
import { RESOLUTION, BRAND, LOOP, ASSIST, PLAYER } from '../data/tuning.config';
import { COPY, capabilityFor } from '../data/copy';
import { TOTAL_QUICK_WINS } from '../data/levels';
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
import { drawHero, drawGrowthPoint, drawBadgeDisc, type HeroMotion } from '../render/sprites';
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

/** The short ANSR product tag shown on a badge (single source: CAPABILITIES). */
function solutionTag(badge: string): string {
  return capabilityFor(badge)?.tag ?? badge;
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
  private readonly debug = new DebugOverlay();
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
      onSetback: (cause, monthsAdded, totalMonths) => {
        // A delay, not a death: a short shake, one non-strobe flash, brief hit-stop.
        this.effects.addShake();
        this.effects.addFlash();
        this.effects.addHitStop();
        this.audio.playSfx('setback');
        this.analytics.setbackIncurred(this.sim.screenId, cause, totalMonths);
        const reason = COPY.setback.reason[cause] ?? cause;
        this.hud.announce(COPY.a11y.setback(reason, monthsAdded));
        // The popup blames the system, and it is NOT orange — orange means value.
        const p = this.sim.player.box;
        const cx = p.x + p.w / 2;
        const cy = p.y;
        this.spawnPopup(cx, cy - 30, COPY.setback.tagMonths(monthsAdded), BRAND.WHITE, 3);
        this.spawnPopup(cx, cy - 8, COPY.setback.tag[cause] ?? '', BRAND.LIGHT_GREY, 2);
      },
      onQuickWin: (id) => {
        const pt = this.sim.screen.points.find((p) => p.id === id);
        if (pt) {
          this.effects.emitBurst(pt.x, pt.y, BRAND.LIGHT_GREY, 10, 140);
          this.spawnPopup(pt.x, pt.y - 16, 'QUICK WIN', '#9FE6C4', 2);
        }
        this.audio.playSfx('pickup');
      },
      onBadgeCollected: (id, type) => {
        const b = this.sim.screen.data.badge;
        if (b) {
          const T = RESOLUTION.TILE;
          // Orange = the "value" accent, reserved for the badge burst.
          this.effects.emitBurst(b.gx * T + T / 2, b.gy * T + T / 2, BRAND.ORANGE, 16, 190);
        }
        this.audio.playSfx('badge');
        this.analytics.badgeCollected(id, type);
        const cap = capabilityFor(type);
        this.hud.announce(
          `${COPY.badgeToast.prefix}: ${cap?.product ?? type}. ${cap?.effect ?? ''}`,
        );
        // Floating "ANSR ENGAGED" + the product name, in the value orange.
        if (b) {
          const T = RESOLUTION.TILE;
          const cx = b.gx * T + T / 2;
          const cy = b.gy * T + T / 2;
          this.spawnPopup(cx, cy - 24, 'ANSR ENGAGED', BRAND.ORANGE, 2);
          this.spawnPopup(cx, cy - 8, solutionTag(type), '#CFE6EC', 2);
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
    if (e.code === 'Backquote') this.debug.toggle();
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
        r.quickWins,
        r.engaged.length,
      );
      this.analytics.ctaShown('win');
      this.hud.announce(COPY.a11y.won(r.months));
    }
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
    if (!__DEV__ && typeof window !== 'undefined') {
      window.location.href = url;
    } else if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info('[BeamRun] CTA →', url);
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
      this.debug.render(ctx, dpr, [
        `state: ${state}${this.paused ? ' (paused)' : ''}`,
        `fps: ${this.loop.fps}  steps: ${this.loop.lastSteps}`,
        `screen: ${this.sim.screenId} ${this.sim.screen.name}`,
        `months: ${this.sim.months}  setbacks: ${this.sim.setbacks}  wins: ${this.sim.quickWins}`,
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
    else if (state === 'WIN') overlay = 'win';

    // The assist dialog sits above everything; hide the base overlay behind it.
    if (this.assistOpen) overlay = null;

    this.overlays.show(overlay, {
      levelLabel: this.sim.screenLabel,
      receipt: this.sim.receipt,
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
    if (hudVisible) {
      const power = this.sim.activePower;
      this.hud.update({
        // The plaque gets the place name, not the title card's framing line
        // ("Arrival — ANSR Tech Park"): a 24-character string set in the bitmap
        // font would run into the clock on a phone frame. The title card still
        // shows the full line on entry.
        levelLabel: this.sim.screen.name,
        months: this.sim.months,
        quickWins: this.sim.quickWins,
        totalQuickWins: TOTAL_QUICK_WINS,
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

    for (const pt of screen.points) {
      if (pt.collected) continue;
      const bob = this.reducedMotion ? 0 : Math.sin(this.now() * 3 + pt.x) * 3;
      // A faint mint glow lifts the pickup off whatever material is behind it —
      // light, not a plate (the sprite carries its own dark outline). Kept low
      // and tight: at 0.30 over 46px it read as a light source rather than a
      // collectible. Static — the glow never pulses, it just sits there.
      const halo = ctx.createRadialGradient(pt.x, pt.y + bob, 0, pt.x, pt.y + bob, 34);
      halo.addColorStop(0, 'rgba(127, 217, 174, 0.16)');
      halo.addColorStop(1, 'rgba(127, 217, 174, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y + bob, 34, 0, Math.PI * 2);
      ctx.fill();
      drawGrowthPoint(ctx, pt.x, pt.y + bob, 3);
    }

    const p = this.sim.player;
    const cx = lerp(p.prevX, p.box.x, alpha) + p.box.w / 2;
    const feetY = lerp(p.prevY, p.box.y, alpha) + p.box.h;
    const flicker =
      !this.reducedMotion && p.isInvulnerable && Math.floor(this.now() * 20) % 2 === 0;
    if (!flicker) this.drawPlayer(ctx, cx, feetY);
  }

  /**
   * The struggle/relief read: a gateway at the badge column marks where ANSR
   * comes in, and once engaged the ground beyond it brightens. This is what lets
   * a player *see* the before/after rather than just feel it — a plain value
   * step at the floor line, no colour-only cue.
   */
  private drawZoneRead(ctx: CanvasRenderingContext2D): void {
    const screen = this.sim.screen;
    const badge = screen.data.badge;
    if (!badge) return;
    const T = RESOLUTION.TILE;
    const groundY = 15 * T;
    const gateX = badge.gx * T + T / 2;
    const engaged = this.sim.powerups.isAssisted;

    // Dim the struggle side very slightly so the relief side reads as brighter.
    ctx.fillStyle = 'rgba(0, 14, 20, 0.22)';
    ctx.fillRect(0, 0, gateX, groundY);

    // Gateway posts flanking the badge column.
    const postColor = engaged ? BRAND.ORANGE : 'rgba(159, 216, 228, 0.55)';
    for (const side of [-1, 1]) {
      const x = gateX + side * (T * 0.75);
      pxRect(ctx, postColor, x - 3, groundY - 96, 6, 96, 3);
    }
    // Lintel across the top of the gateway.
    pxRect(ctx, postColor, gateX - T * 0.75 - 3, groundY - 102, T * 1.5 + 6, 6, 3);

    // Once engaged, cap the relief-side ground with a bright walkable edge.
    if (engaged) {
      ctx.fillStyle = 'rgba(92, 226, 244, 0.85)';
      ctx.fillRect(gateX, groundY - 3, RESOLUTION.WIDTH - gateX, 3);
      drawText(ctx, 'ANSR ENGAGED', gateX, groundY - 124, {
        scale: 2,
        color: BRAND.ORANGE,
        align: 'center',
        outline: 'rgba(0,20,26,0.9)',
        alpha: 0.9,
      });
    }
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

  private drawBadge(ctx: CanvasRenderingContext2D): void {
    const badge = this.sim.screen.data.badge;
    if (!badge || this.sim.powerups.collected) return;
    const T = RESOLUTION.TILE;
    const bob = this.reducedMotion ? 0 : Math.sin(this.now() * 3) * 4;
    const cx = badge.gx * T + T / 2;
    const cy = badge.gy * T + T / 2 + bob;
    const r = 20;
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
