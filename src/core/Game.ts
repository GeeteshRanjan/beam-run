/**
 * Game — DOM/render host around the headless Simulation.
 *
 * Builds the stage (canvas + DOM UI layer), owns the Renderer, Input, Loop and
 * (dev) DebugOverlay, and presents the Simulation each frame with decoupled
 * interpolation. HUD and overlays are real DOM for accessibility; the canvas
 * only draws the world and the death fade. Pause is a host-level concern (it
 * halts stepping); all gameplay truth stays in `Simulation`.
 */
import { RESOLUTION, BRAND, LOOP } from '../data/tuning.config';
import { COPY } from '../data/copy';
import { Loop } from './Loop';
import { Renderer } from './Renderer';
import { Input, makeInput, type InputState } from './Input';
import { DebugOverlay } from './DebugOverlay';
import { Simulation, type SimulationOptions, type DeathCause } from './Simulation';
import type { GameState } from './gameStates';
import { Hud } from '../ui/Hud';
import { Overlays, type OverlayName, type CtaContext } from '../ui/Overlays';
import { injectStyles } from '../ui/styles';
import { Fire } from '../world/Hazards/Fire';
import { Plants } from '../world/Hazards/Plants';
import { Spikes } from '../world/Hazards/Spikes';
import { Effects } from './Effects';
import { finaleLayout } from './finaleScene';
import { AudioEngine } from '../audio/AudioEngine';
import { drawHero, drawGrowthPoint, drawBadgeDisc, type HeroMotion } from '../render/sprites';
import { drawTileRect, drawSceneBackground } from '../render/scenery';
import { pxRect, hash2 } from '../render/PixelArt';
import { AssistController } from './AssistController';
import { TouchControls, isTouchDevice } from '../ui/TouchControls';
import { AssistMenu } from '../ui/AssistMenu';
import { Analytics, detectDevice } from '../analytics/Analytics';
import { buildNavigatorPayload, buildNavigatorUrl, type CtaContext as NavCtaContext } from '../analytics/navigator';
import { getSessionId, getMutePref, setMutePref } from '../analytics/Save';

/** ANSR logo orange (from the brand SVG — kept in its own colour per brief). */
const LOGO_ORANGE = '#f05722';

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
  private destroyed = false;
  private wired = false;
  private lastFrameS = 0;
  private prevOnGround = false;
  private prevHasPower = false;

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
      onSkip: () => this.handleCta('skip'),
      onResume: () => this.setPaused(false),
      onRestart: () => this.handleRestart(),
      onCta: (ctx) => this.handleCta(ctx),
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
        this.prevOnGround = false;
        this.analytics.screenEntered(id, name);
        this.hud.announce(COPY.a11y.screenEntered(name));
      },
      onScreenClear: (id, timeS, deaths) => {
        this.audio.playSfx('screenClear');
        this.analytics.screenCleared(id, timeS, deaths);
      },
      onDeath: (cause, livesLeft) => {
        // Death feel: short shake + a single (non-strobe) flash + hit-stop.
        this.effects.addShake();
        this.effects.addFlash();
        this.effects.addHitStop();
        this.audio.playSfx('death');
        this.analytics.playerDied(this.sim.screenId, cause, livesLeft);
        this.hud.announce(COPY.a11y.died(cause as DeathCause));
      },
      onPointCollected: (id) => {
        const pt = this.sim.screen.points.find((p) => p.id === id);
        if (pt) this.effects.emitBurst(pt.x, pt.y, BRAND.LIGHT_GREY, 10, 140);
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
        const capability = COPY.capabilities[type] ?? type;
        this.hud.announce(`${COPY.badgeToast.prefix}: ${capability}.`);
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
      },
      (message) => this.hud.announce(message),
      (option, enabled) => {
        this.analytics.assistToggled(option, enabled);
        if (option === 'muteMusic' || option === 'muteSfx') this.persistMute();
      },
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
      this.analytics.gameCompleted(
        this.sim.points,
        this.now() - this.runStartS,
        this.sim.totalDeathCount,
      );
      this.analytics.ctaShown('win');
      this.hud.announce(COPY.a11y.won);
    }
    if (to === 'GAMEOVER') {
      this.analytics.gameOver(this.sim.screenId, this.sim.points, this.now() - this.runStartS);
      this.analytics.ctaShown('game_over');
      this.hud.announce(COPY.a11y.gameOver);
    }
    if (to === 'PLAYING') this.setPaused(false);
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
    if (this.sim.state === 'GAMEOVER' || this.sim.state === 'WIN') {
      this.sim.requestRestart();
    } else {
      this.sim.reset();
    }
    this.setPaused(false);
  }

  private handleCta(context: CtaContext): void {
    const target = this.options.navigatorUrl ?? DEFAULT_OPTIONS.navigatorUrl;
    // "Skip" is a mid-game click-through; log it before the hand-off.
    if (context === 'skip') this.analytics.gameSkipped(this.sim.screenId);
    this.analytics.ctaClicked(context as NavCtaContext, target);

    const payload = buildNavigatorPayload(context as NavCtaContext, this.sim.points);
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

    const state = this.sim.state;
    const p = this.sim.player;
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
      // Power-expiry cue when a timed power lapses.
      const hasPower = this.sim.activePower !== null;
      if (this.prevHasPower && !hasPower) this.audio.playSfx('powerExpire');
      this.prevHasPower = hasPower;
    }
    this.prevOnGround = p.onGround;

    const shake = this.effects.shakeOffset();
    this.renderer.begin(shake.x, shake.y);
    const { ctx } = this.renderer;
    this.drawBackground(ctx);

    if (state !== 'START' && state !== 'BOOT') {
      this.drawWorld(ctx, alpha);
      this.drawParticles(ctx);
      if (state === 'DEATH') this.drawFade(ctx);
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
        `lives: ${this.sim.lives}  pts: ${this.sim.points}`,
        `pos: ${p.box.x.toFixed(0)},${p.box.y.toFixed(0)} ground:${p.onGround}`,
        '` toggles this overlay',
      ]);
    }

    this.syncUI();

    // Drive the Company Valuation count-up on the win screen (real-time dt).
    if (state === 'WIN' && !this.paused) this.overlays.advanceValuation(dt);

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
    if (this.paused) overlay = 'pause';
    else if (state === 'START' || state === 'BOOT') overlay = 'start';
    else if (state === 'TITLE_CARD') overlay = 'titlecard';
    else if (state === 'WIN') overlay = 'win';
    else if (state === 'GAMEOVER') overlay = 'gameover';

    // The assist dialog sits above everything; hide the base overlay behind it.
    if (this.assistOpen) overlay = null;

    this.overlays.show(overlay, { levelLabel: this.sim.screenLabel, points: this.sim.points });

    // On-screen touch controls: only while actively playing on a touch device.
    this.touch.setVisible(
      this.isTouch && state === 'PLAYING' && !this.paused && !this.assistOpen,
    );

    const hudVisible =
      !this.paused && (state === 'PLAYING' || state === 'TITLE_CARD' || state === 'DEATH');
    this.hud.setVisible(hudVisible);
    if (hudVisible) {
      const power = this.sim.activePower;
      this.hud.update({
        levelLabel: this.sim.screenLabel,
        lives: this.sim.lives,
        points: this.sim.points,
        power: power ? { name: power.name, remaining: power.remaining, duration: power.duration } : null,
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

    this.drawHazards(ctx);
    this.drawPlacedTile(ctx);
    this.drawBadge(ctx);

    for (const pt of screen.points) {
      if (pt.collected) continue;
      const bob = this.reducedMotion ? 0 : Math.sin(this.now() * 3 + pt.x) * 3;
      drawGrowthPoint(ctx, pt.x, pt.y + bob, 3);
    }

    const p = this.sim.player;
    const cx = lerp(p.prevX, p.box.x, alpha) + p.box.w / 2;
    const feetY = lerp(p.prevY, p.box.y, alpha) + p.box.h;
    const flicker =
      !this.reducedMotion && p.isInvulnerable && Math.floor(this.now() * 20) % 2 === 0;
    if (!flicker) this.drawPlayer(ctx, cx, feetY);
  }

  /** Draw the human hero, choosing a pose from the sim's motion state. */
  private drawPlayer(ctx: CanvasRenderingContext2D, centerX: number, feetY: number): void {
    const p = this.sim.player;
    let motion: HeroMotion;
    if (!p.onGround) motion = p.vy < 0 ? 'jump' : 'fall';
    else motion = Math.abs(p.vx) > 20 ? 'run' : 'idle';
    // Feet land ~4px above the raw hitbox bottom so the shoes sit on the tile.
    drawHero(
      ctx,
      { motion, facing: p.facing, time: this.now(), still: this.reducedMotion },
      centerX,
      feetY + 2,
      3,
    );
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
    if (data.hazard === 'plants') {
      this.drawPlants(ctx);
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
        // Base sludge + stable dithered churn (the "red-tape" pit).
        ctx.fillStyle = '#0A3540';
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
        // Lethal pixel flame filling the lane: stacked orange blocks whose edge
        // tongues flicker via stable hash noise + time (chunky, not gradient).
        const left = lane.x + 4;
        const colW = T - 8;
        for (let y = 0; y < groundY; y += PX) {
          const heat = 1 - y / groundY; // hotter (whiter) near the top-source
          const base = heat > 0.6 ? '#FFB07A' : heat > 0.3 ? '#FF7A2A' : '#FF5400';
          pxRect(ctx, base, left, y, colW, PX, PX);
          // Flickering ragged edges.
          const flick = Math.sin(t * 16 + y * 0.4 + lane.x) * 0.5 + 0.5;
          if (hash2(lane.x + y, Math.floor(t * 12)) < 0.35 + flick * 0.2) {
            pxRect(ctx, '#FFB07A', left, y, PX, PX, PX);
            pxRect(ctx, '#FFB07A', left + colW - PX, y, PX, PX, PX);
          }
        }
      }
    }
  }

  private drawPlants(ctx: CanvasRenderingContext2D): void {
    const hazard = this.sim.activeHazard;
    if (!(hazard instanceof Plants)) return;
    const groundY = 15 * RESOLUTION.TILE;
    const PX = 5;
    for (const p of hazard.plantStates()) {
      // Chunky stalk that leans with the sway (shape + motion, colour-blind safe).
      const topY = p.topY + 8;
      for (let y = groundY; y > topY; y -= PX) {
        const f = (groundY - y) / Math.max(1, groundY - topY); // 0 base → 1 top
        const x = p.cx - p.sway * 0.4 * f;
        pxRect(ctx, '#0C4A3A', x - PX, y - PX, PX * 2, PX, PX);
        // A leaf every few segments.
        if (Math.round(f * 6) % 3 === 1) {
          pxRect(ctx, '#0F6B4E', x + PX, y - PX, PX * 2, PX, PX);
          pxRect(ctx, '#0F6B4E', x - PX * 3, y - PX, PX * 2, PX, PX);
        }
      }
      // Menacing "compliance weed" head: a light pod with a dark biting mouth.
      const hx = p.cx - p.sway * 0.4;
      const hy = p.topY;
      const pod = [
        ' HHHH ',
        'HHHHHH',
        'HmmmmH',
        'HHHHHH',
        ' HHHH ',
      ];
      for (let r = 0; r < pod.length; r += 1) {
        for (let c = 0; c < pod[r]!.length; c += 1) {
          const ch = pod[r]![c];
          if (ch === ' ') continue;
          const color = ch === 'm' ? '#0A2C22' : '#CFEBD9';
          pxRect(ctx, color, hx - 3 * PX + c * PX, hy - PX + r * PX, PX, PX, PX);
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
    // Pixel ANSR disc (12 cells wide → scale ~3 gives a ~36px badge).
    drawBadgeDisc(ctx, cx, cy, 3);
  }

  private drawFade(ctx: CanvasRenderingContext2D): void {
    const { WIDTH: w, HEIGHT: h } = RESOLUTION;
    ctx.fillStyle = 'rgba(0, 36, 46, 0.55)';
    ctx.fillRect(0, 0, w, h);
  }

  /** The Tech Park hero scene: layered sky, plaza, glowing glass tower, bloom. */
  private drawFinale(ctx: CanvasRenderingContext2D): void {
    const { WIDTH: w } = RESOLUTION;
    const l = finaleLayout();
    const t = this.reducedMotion ? 0 : this.now();

    // Layered gradient sky.
    const sky = ctx.createLinearGradient(0, 0, 0, l.horizonY);
    for (const s of l.sky) sky.addColorStop(s.offset, s.color);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, l.horizonY);

    // Warm dawn glow behind the tower.
    const dawn = ctx.createRadialGradient(l.bloom.x, l.horizonY, 0, l.bloom.x, l.horizonY, 460);
    dawn.addColorStop(0, 'rgba(255, 84, 0, 0.26)');
    dawn.addColorStop(1, 'rgba(255, 84, 0, 0)');
    ctx.fillStyle = dawn;
    ctx.fillRect(0, 0, w, l.horizonY);

    // Plaza.
    const plaza = ctx.createLinearGradient(0, l.plaza.y, 0, l.plaza.y + l.plaza.h);
    plaza.addColorStop(0, '#0A5566');
    plaza.addColorStop(1, '#00242E');
    ctx.fillStyle = plaza;
    ctx.fillRect(l.plaza.x, l.plaza.y, l.plaza.w, l.plaza.h);
    ctx.strokeStyle = 'rgba(230, 230, 230, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, l.horizonY + 1);
    ctx.lineTo(w, l.horizonY + 1);
    ctx.stroke();

    // Glass tower body.
    const body = ctx.createLinearGradient(l.tower.x, 0, l.tower.x + l.tower.w, 0);
    body.addColorStop(0, '#013947');
    body.addColorStop(0.5, '#0A5566');
    body.addColorStop(1, '#013947');
    ctx.fillStyle = body;
    ctx.fillRect(l.tower.x, l.tower.y, l.tower.w, l.tower.h);
    ctx.strokeStyle = 'rgba(230, 230, 230, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(l.tower.x + 1, l.tower.y + 1, l.tower.w - 2, l.tower.h - 2);

    // Glowing window grid (gentle twinkle; steady under reduced motion).
    for (let i = 0; i < l.windows.length; i += 1) {
      const win = l.windows[i]!;
      const lit = this.reducedMotion ? 0.5 : 0.32 + 0.32 * (0.5 + 0.5 * Math.sin(t * 1.4 + i * 1.3));
      ctx.fillStyle = `rgba(255, 190, 110, ${lit})`;
      ctx.fillRect(win.x, win.y, win.w, win.h);
    }

    // Bloom crown (orange = the value earned at the finish).
    const pulse = this.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 2);
    const r = l.bloom.r * pulse;
    const bloom = ctx.createRadialGradient(l.bloom.x, l.bloom.y, 0, l.bloom.x, l.bloom.y, r);
    bloom.addColorStop(0, 'rgba(255, 84, 0, 0.5)');
    bloom.addColorStop(1, 'rgba(255, 84, 0, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(l.bloom.x, l.bloom.y, r, 0, Math.PI * 2);
    ctx.fill();

    // ANSR sunburst mark on the plaza (rendered in the logo's own orange).
    this.drawAnsrMark(ctx, l.mark.x, l.mark.y, l.mark.r, t);
  }

  /** A procedural nod to the ANSR sunburst mark + wordmark (own brand orange). */
  private drawAnsrMark(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    t: number,
  ): void {
    const rays = 28;
    const spin = this.reducedMotion ? 0 : t * 0.05;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = LOGO_ORANGE;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < rays; i += 1) {
      const a = (i / rays) * Math.PI * 2 + spin;
      const inner = r * 0.5;
      const outer = r * (0.82 + 0.18 * (i % 2));
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = LOGO_ORANGE;
    ctx.font = "700 22px 'Moderat', system-ui, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ANSR', x, y + r + 16);
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
    this.audio.destroy();
    this.touch.destroy();
    this.assistMenu.destroy();
    this.hud.destroy();
    this.overlays.destroy();
    this.stage.remove();
  }
}
