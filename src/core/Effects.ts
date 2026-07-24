/**
 * Effects — the "juice" layer: camera shake, hit-stop, death flash, the Beam
 * light-trail, and particle bursts (landing dust, pickup sparkle).
 *
 * It is intentionally headless and deterministic (seeded RNG, no DOM, no
 * `Date`/`Math.random`), so the feel logic is unit-testable and the renderer
 * only has to draw the state it exposes. Nothing here touches the authoritative
 * Simulation — effects are pure presentation.
 *
 * ACCESSIBILITY: when `reducedMotion` is set, every motion effect is disabled —
 * shake stays (0,0), the trail and particles never accumulate, hit-stop is a
 * no-op, and the death flash is suppressed (no strobe). This is the single
 * switch behind the `prefers-reduced-motion` guarantee.
 */
import { CAMERA } from '../data/tuning.config';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

export interface TrailSample {
  x: number;
  y: number;
  /** Remaining life 0..1 (1 = freshest). */
  life: number;
}

/** Deterministic RNG (mulberry32) — keeps shake/particles reproducible in tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_PARTICLES = 140;
const MAX_TRAIL = 14;
const TRAIL_LIFE = 0.28; // s
const HIT_STOP_MAX = 0.12; // s cap

export class Effects {
  reducedMotion: boolean;
  private readonly rng: () => number;

  private shakeT = 0;
  private shakeDur = 0;
  private shakeMag = 0;

  private flashT = 0;
  private flashDur = 0;

  private hitStopT = 0;

  // Preallocated pools — no per-frame object allocation (memory stability).
  private readonly pool: Particle[] = [];
  private activeCount = 0;
  private readonly trailPool: TrailSample[] = [];
  private trailHead = 0;
  private trailCount = 0;

  constructor(reducedMotion = false, seed = 0x9e3779b9) {
    this.reducedMotion = reducedMotion;
    this.rng = mulberry32(seed);
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      this.pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: '', gravity: 0 });
    }
    for (let i = 0; i < MAX_TRAIL; i += 1) this.trailPool.push({ x: 0, y: 0, life: 0 });
  }

  /** Advance all transient effects by dt seconds. */
  update(dt: number): void {
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
    if (this.hitStopT > 0) this.hitStopT = Math.max(0, this.hitStopT - dt);

    // Trail: entries age uniformly, so the oldest (at head) always dies first.
    for (let n = 0; n < this.trailCount; n += 1) {
      const s = this.trailPool[(this.trailHead + n) % MAX_TRAIL]!;
      s.life -= dt / TRAIL_LIFE;
    }
    while (this.trailCount > 0 && this.trailPool[this.trailHead]!.life <= 0) {
      this.trailHead = (this.trailHead + 1) % MAX_TRAIL;
      this.trailCount -= 1;
    }

    // Particles: integrate, then swap-remove dead ones (compact, no splice).
    for (let i = 0; i < this.activeCount; i += 1) {
      const p = this.pool[i]!;
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) {
        const last = this.pool[this.activeCount - 1]!;
        this.pool[this.activeCount - 1] = p;
        this.pool[i] = last;
        this.activeCount -= 1;
        i -= 1;
      }
    }
  }

  /** Claim a pooled particle slot (or null if the pool is full). */
  private claim(): Particle | null {
    if (this.activeCount >= MAX_PARTICLES) return null;
    return this.pool[this.activeCount++]!;
  }

  // --- triggers -------------------------------------------------------------

  /** Kick a camera shake (magnitude px, duration s). No-op under reduced motion. */
  addShake(magnitude: number = CAMERA.SHAKE_MAGNITUDE, duration: number = CAMERA.SHAKE_ON_DEATH): void {
    if (this.reducedMotion) return;
    // Take the stronger of any ongoing shake.
    if (duration >= this.shakeT) {
      this.shakeT = duration;
      this.shakeDur = duration;
    }
    this.shakeMag = Math.max(this.shakeMag, magnitude);
  }

  /** Flash the screen (death). Suppressed under reduced motion (no strobe). */
  addFlash(duration: number = 0.22): void {
    if (this.reducedMotion) return;
    this.flashT = duration;
    this.flashDur = duration;
  }

  /** Brief freeze on impact. No-op under reduced motion. */
  addHitStop(duration: number = 0.06): void {
    if (this.reducedMotion) return;
    this.hitStopT = Math.max(this.hitStopT, Math.min(HIT_STOP_MAX, duration));
  }

  /** Record a Beam position for the light-trail. No-op under reduced motion. */
  pushTrail(x: number, y: number): void {
    if (this.reducedMotion) return;
    let idx: number;
    if (this.trailCount < MAX_TRAIL) {
      idx = (this.trailHead + this.trailCount) % MAX_TRAIL;
      this.trailCount += 1;
    } else {
      // Full ring: overwrite the oldest and advance the head.
      idx = this.trailHead;
      this.trailHead = (this.trailHead + 1) % MAX_TRAIL;
    }
    const s = this.trailPool[idx]!;
    s.x = x;
    s.y = y;
    s.life = 1;
  }

  /** Emit a radial particle burst (pickups, badges). No-op under reduced motion. */
  emitBurst(x: number, y: number, color: string, count: number = 12, speed: number = 160): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i += 1) {
      const p = this.claim();
      if (!p) break;
      const a = this.rng() * Math.PI * 2;
      const sp = speed * (0.4 + this.rng() * 0.6);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = 0.4 + this.rng() * 0.3;
      p.maxLife = 0.7;
      p.size = 2 + this.rng() * 3;
      p.color = color;
      p.gravity = 240;
    }
  }

  /** Emit landing dust (a low, sideways puff). No-op under reduced motion. */
  emitDust(x: number, y: number, color: string, count: number = 8): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i += 1) {
      const p = this.claim();
      if (!p) break;
      const dir = this.rng() < 0.5 ? -1 : 1;
      const sp = 40 + this.rng() * 90;
      p.x = x;
      p.y = y;
      p.vx = dir * sp;
      p.vy = -this.rng() * 60;
      p.life = 0.25 + this.rng() * 0.2;
      p.maxLife = 0.45;
      p.size = 1.5 + this.rng() * 2.5;
      p.color = color;
      p.gravity = 120;
    }
  }

  // --- render-facing getters ------------------------------------------------

  /** Current camera-shake offset in internal px (always (0,0) under reduced motion). */
  shakeOffset(): { x: number; y: number } {
    if (this.reducedMotion || this.shakeT <= 0 || this.shakeDur <= 0) return { x: 0, y: 0 };
    const decay = this.shakeT / this.shakeDur; // 1 → 0
    const mag = this.shakeMag * decay;
    return { x: (this.rng() * 2 - 1) * mag, y: (this.rng() * 2 - 1) * mag };
  }

  /** Death-flash alpha 0..1 (always 0 under reduced motion). */
  flashAlpha(): number {
    if (this.reducedMotion || this.flashT <= 0 || this.flashDur <= 0) return 0;
    return Math.min(1, this.flashT / this.flashDur);
  }

  get hitStopActive(): boolean {
    return this.hitStopT > 0;
  }

  get shakeActive(): boolean {
    return !this.reducedMotion && this.shakeT > 0;
  }

  trailSamples(): readonly TrailSample[] {
    const out: TrailSample[] = [];
    for (let n = 0; n < this.trailCount; n += 1) {
      out.push(this.trailPool[(this.trailHead + n) % MAX_TRAIL]!);
    }
    return out;
  }

  activeParticles(): readonly Particle[] {
    return this.pool.slice(0, this.activeCount);
  }

  /** Clear everything (screen change / teardown). No reallocation of pools. */
  clear(): void {
    this.shakeT = 0;
    this.shakeMag = 0;
    this.flashT = 0;
    this.hitStopT = 0;
    this.trailHead = 0;
    this.trailCount = 0;
    this.activeCount = 0;
  }
}
