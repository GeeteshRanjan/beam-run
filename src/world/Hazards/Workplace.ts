/**
 * The Workplace (Screen 3 — owner-specified; it replaced Local Expertise).
 *
 * A broken office: flickering lights, wet floor signs and caution tape over
 * everything, with one figure mummified in three layers of that same tape
 * trudging the floor. Two things separate this hazard from every other one here.
 *
 * **The obstacle is a metronome.** He walks one way only, at one constant speed,
 * and loops back to his starting column when he reaches the far end instead of
 * turning around. The compliance monsters are unreadable on purpose; this figure
 * is the opposite — you are meant to stand behind the partition wall, watch one
 * full sweep, and know exactly when to move. Nothing about the player is ever an
 * input, and nothing here is random, so the pattern is the same on every attempt.
 *
 * **The badge hands the player a verb.** `UNWRAP` makes a cutter appear and the
 * shoot button live; three hits strip the three layers. He does *not* die: the
 * colleague underneath (shirt, sleeves rolled up) runs to the sparking terminal
 * and works, the terminal chimes, and *that* is what clears the tape, the signs
 * and the dark. The blocker becomes the person who puts the place right, which is
 * the whole argument of the screen — so the moment he unravels he is harmless,
 * permanently, and the cutter refuses to fire at a freed colleague.
 *
 * Note what is deliberately absent: `shieldsPlayer`. Taking the badge does not
 * make contact safe, it makes the figure *solvable*. Until the last layer is off,
 * walking into him still stalls the stage — so there is no ANSR bubble promising
 * protection the rules do not give.
 */
import { RESOLUTION, HAZARDS } from '../../data/tuning.config';
import type { MummySpec, GridPos } from '../../data/levels';
import { type AABB, aabbOverlap } from '../Physics';
import type { Player } from '../Player';
import type { Hazard, SetbackCause, HazardContext } from '../types';

const T = RESOLUTION.TILE;
const W = HAZARDS.WORKPLACE;

/**
 * `wrapped` is the only phase that costs the player time.
 *
 * `returning` is the loop back to the start column: he is harmless for the whole
 * beat and drawn fading in where he restarts, because materialising a lethal body
 * on top of a player standing at the start of the corridor is exactly the
 * unfair-not-hard failure the DENIED stamps already cost us a pass to learn.
 */
export type MummyPhase =
  | 'wrapped'
  | 'returning'
  | 'unravelling'
  | 'running'
  | 'working'
  | 'restored';

export interface MummyState {
  /** Uppercase name plate, drawn only while he is still the obstacle. */
  name: string;
  /** Hitbox — exactly what is drawn (see `render/workplace.ts`). */
  box: AABB;
  /** −1 facing left, 1 facing right. */
  dir: -1 | 1;
  phase: MummyPhase;
  /** Layers of caution tape still on him (3 → 0). */
  layers: number;
  /** 0..1 through the current timed phase (returning / unravelling / working). */
  progress: number;
  /** Contact costs the player time right now. */
  lethal: boolean;
}

export interface ShotState {
  box: AABB;
  dir: -1 | 1;
}

interface MummyEntry {
  readonly name: string;
  /** Corridor ends for his CENTRE (px), inset by half his width. */
  readonly minX: number;
  readonly maxX: number;
  /** Top of the surface he walks along (px). */
  readonly feetY: number;
  cx: number;
  dir: -1 | 1;
  phase: MummyPhase;
  layers: number;
  /** Seconds inside the current timed phase. */
  t: number;
}

interface Shot {
  x: number;
  y: number;
  dir: -1 | 1;
}

export class Workplace implements Hazard {
  private readonly mummies: MummyEntry[];
  private readonly shots: Shot[] = [];
  /** Where the freed colleague runs to (px, centre of the terminal). */
  private readonly terminal: { x: number; y: number } | null;
  private cooldown = 0;
  private armed = false;
  private restoreT = 0;
  /** Seconds since the cutter last fired — the host draws the muzzle flash from it. */
  private sinceShotT = Number.POSITIVE_INFINITY;

  constructor(mummies: MummySpec[], terminal?: GridPos) {
    this.mummies = mummies.map((m) => ({
      name: m.name,
      minX: m.from * T + W.MUMMY_W / 2,
      maxX: (m.to + 1) * T - W.MUMMY_W / 2,
      feetY: m.gy * T,
      cx: m.from * T + W.MUMMY_W / 2,
      dir: 1,
      phase: 'wrapped' as MummyPhase,
      layers: W.TAPE_LAYERS,
      t: 0,
    }));
    this.terminal = terminal ? { x: terminal.gx * T + T / 2, y: terminal.gy * T } : null;
  }

  private box(m: MummyEntry): AABB {
    return {
      x: m.cx - W.MUMMY_W / 2,
      y: m.feetY - W.MUMMY_H,
      w: W.MUMMY_W,
      h: W.MUMMY_H,
    };
  }

  private static lethalPhase(m: MummyEntry): boolean {
    return m.phase === 'wrapped';
  }

  /** No geometry: the partition wall is authored in `levels.json` as a solid. */
  solids(): AABB[] {
    return [];
  }

  speedMultAt(): number {
    return 1;
  }

  update(dt: number, player: Player, ctx: HazardContext): SetbackCause | null {
    this.armed = ctx.assisted;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sinceShotT += dt;

    if (ctx.assisted && ctx.shoot === true) this.fire(player);
    this.advanceShots(dt);

    let cause: SetbackCause | null = null;
    for (const m of this.mummies) {
      this.advance(m, dt);
      if (Workplace.lethalPhase(m) && aabbOverlap(player.box, this.box(m))) cause = 'mummy';
    }
    // The room comes good only once somebody is actually working on it.
    if (this.mummies.every((m) => m.phase === 'restored')) {
      this.restoreT = Math.min(W.RESTORE_TIME, this.restoreT + dt);
    }
    return cause;
  }

  /**
   * Fire the cutter. Bounded by a cooldown *and* a live-pulse cap, so three hits
   * read as three deliberate acts rather than a spray — and the array can never
   * grow without limit.
   *
   * A pulse ignores static geometry, and the level answers for that rather than
   * the code: the figure's corridor starts two columns clear of the partition, so
   * the place you stand to cut the tape already has a clear line to him. Giving
   * the pulse its own collision pass would buy nothing but the ability to make the
   * screen's one safe spot the one place you cannot act from.
   *
   * It refuses to fire once nobody is wrapped any more: by then the only figure on
   * the floor is a colleague fixing the place, and letting the player shoot at him
   * would invert the point of the screen.
   */
  private fire(player: Player): void {
    if (this.cooldown > 0 || this.shots.length >= W.MAX_SHOTS) return;
    if (!this.mummies.some((m) => m.layers > 0)) return;
    this.cooldown = W.SHOT_COOLDOWN;
    this.sinceShotT = 0;
    const dir = player.facing;
    this.shots.push({
      x: dir === 1 ? player.box.x + player.box.w : player.box.x - W.SHOT_W,
      // Chest height: it leaves the tool, not the shoes.
      y: player.box.y + player.box.h * 0.4,
      dir,
    });
  }

  private shotBox(s: Shot): AABB {
    return { x: s.x, y: s.y, w: W.SHOT_W, h: W.SHOT_H };
  }

  private advanceShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i -= 1) {
      const s = this.shots[i]!;
      s.x += s.dir * W.SHOT_SPEED * dt;
      let spent = s.x + W.SHOT_W < 0 || s.x > RESOLUTION.WIDTH;
      if (!spent) {
        for (const m of this.mummies) {
          if (m.layers <= 0) continue;
          if (!aabbOverlap(this.shotBox(s), this.box(m))) continue;
          m.layers -= 1;
          spent = true;
          if (m.layers === 0) {
            m.phase = 'unravelling';
            m.t = 0;
          }
          break;
        }
      }
      if (spent) this.shots.splice(i, 1);
    }
  }

  /** One figure's step. Every phase is a plain timer or a constant-speed walk. */
  private advance(m: MummyEntry, dt: number): void {
    switch (m.phase) {
      case 'wrapped': {
        m.dir = 1;
        m.cx += W.WALK_SPEED * dt;
        if (m.cx >= m.maxX) {
          // He does not turn around (owner call): he loops. Snapping the position
          // now rather than at the end of the beat means the fade-in the renderer
          // draws is at the column he is about to walk from, which is where the
          // player has to be looking.
          m.cx = m.minX;
          m.phase = 'returning';
          m.t = 0;
        }
        break;
      }
      case 'returning': {
        m.t += dt;
        if (m.t >= W.RETURN_TIME) {
          m.phase = 'wrapped';
          m.t = 0;
        }
        break;
      }
      case 'unravelling': {
        m.t += dt;
        if (m.t >= W.UNRAVEL_TIME) {
          m.phase = 'running';
          m.t = 0;
        }
        break;
      }
      case 'running': {
        // A shade over a tile short of the terminal, so his outstretched hand lands
        // on the keyboard and his head does not overlap the monitor.
        const target = this.terminal ? this.terminal.x - T * 1.2 : m.cx;
        const dx = target - m.cx;
        m.dir = dx >= 0 ? 1 : -1;
        const step = W.RUN_SPEED * dt;
        m.cx += Math.sign(dx) * Math.min(Math.abs(dx), step);
        if (Math.abs(target - m.cx) < 0.5) {
          m.cx = target;
          m.dir = 1;
          m.phase = 'working';
          m.t = 0;
        }
        break;
      }
      case 'working': {
        m.t += dt;
        if (m.t >= W.WORK_TIME) {
          m.phase = 'restored';
          m.t = 0;
        }
        break;
      }
      default:
        break;
    }
  }

  reset(): void {
    this.shots.length = 0;
    this.cooldown = 0;
    this.armed = false;
    this.restoreT = 0;
    this.sinceShotT = Number.POSITIVE_INFINITY;
    for (const m of this.mummies) {
      m.cx = m.minX;
      m.dir = 1;
      m.phase = 'wrapped';
      m.layers = W.TAPE_LAYERS;
      m.t = 0;
    }
  }

  /** Per-figure snapshot for rendering. */
  mummyStates(): MummyState[] {
    return this.mummies.map((m) => ({
      name: m.name,
      box: this.box(m),
      dir: m.dir,
      phase: m.phase,
      layers: m.layers,
      progress: Workplace.phaseProgress(m),
      lethal: Workplace.lethalPhase(m),
    }));
  }

  private static phaseProgress(m: MummyEntry): number {
    const span =
      m.phase === 'returning'
        ? W.RETURN_TIME
        : m.phase === 'unravelling'
          ? W.UNRAVEL_TIME
          : m.phase === 'working'
            ? W.WORK_TIME
            : 0;
    return span === 0 ? 0 : Math.min(1, m.t / span);
  }

  /** Live cutter pulses. */
  shotStates(): ShotState[] {
    return this.shots.map((s) => ({ box: this.shotBox(s), dir: s.dir }));
  }

  /** The badge is taken, so the cutter is in the player's hands. */
  get hasCutter(): boolean {
    return this.armed;
  }

  /**
   * Seconds since the cutter fired (`Infinity` before the first shot). The host
   * draws the muzzle flash and the recoil kick from this, so the two can never
   * disagree with the pulse that actually left the barrel.
   */
  get sinceShot(): number {
    return this.sinceShotT;
  }

  /** Where the sparking terminal stands (px), if the screen authored one. */
  get terminalAt(): { x: number; y: number } | null {
    return this.terminal;
  }

  /** 0 = the office as found, 1 = lit, clean and taped off no longer. */
  get restore(): number {
    return Math.min(1, this.restoreT / W.RESTORE_TIME);
  }

  /** True from the frame the terminal chimes success onwards. */
  get isFixed(): boolean {
    return this.mummies.length > 0 && this.mummies.every((m) => m.phase === 'restored');
  }

  /** Tape layers still on the floor's one obstacle (the on-screen proof). */
  get layersLeft(): number {
    return this.mummies.reduce((sum, m) => sum + m.layers, 0);
  }
}
