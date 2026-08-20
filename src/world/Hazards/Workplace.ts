/**
 * The Workplace (Screen 3 — owner-specified; it replaced Local Expertise).
 *
 * A broken office: flickering lights, wet floor signs and caution tape over
 * everything, with one figure mummified in three layers of that same tape
 * trudging the floor. Two things separate this hazard from every other one here.
 *
 * **The obstacle is a metronome.** He paces his corridor to and fro at one
 * constant speed, standing still for `TURN_TIME` at each end while he turns round.
 * The compliance monsters are unreadable on purpose; this figure
 * is the opposite — you are meant to stand behind the partition wall, watch one
 * full sweep, and know exactly when to move. Nothing about the player is ever an
 * input, and nothing here is random, so the pattern is the same on every attempt.
 * He used to *loop* instead, snapping back to his start column at the far end
 * (owner call to change it: a body that disappears at one end and reappears at the
 * other reads as a respawn, not as a person), and that snap is why this hazard
 * needed a harmless beat at all. Pacing deletes the problem rather than tuning it.
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
 * `wrapped` and `turning` are the phases that cost the player time.
 *
 * `winding` is the third of them, and the newest: the wind-up of a **throw** (owner
 * call — "add a capability for the mummy to throw the bandages at the player
 * capturing him"). He stops where he is, raises a coil of his own tape over his
 * shoulder for `THROW_WINDUP`, and then unwinds it down the floor. It is lethal for
 * the same reason `turning` is — he has not moved, so there is nothing about his
 * body the player could not already see — and it costs him ground, which is what
 * pays for the attack being ranged at all.
 *
 * `turning` is the pivot at either end of the corridor: he is standing still, and
 * he is still lethal, because he has not gone anywhere the player could not already
 * see him. It replaced `returning`, the beat he used to spend snapping back to his
 * start column — and *that* phase had to be harmless, because a lethal 60×78 body
 * materialising on top of a standing player is exactly the unfair-not-hard failure
 * the DENIED stamps already cost us a pass to learn. Pacing to and fro deletes the
 * problem instead of tuning it.
 */
export type MummyPhase =
  | 'wrapped'
  | 'turning'
  | 'winding'
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
  /** Layers of tape still on him (3 → 0). */
  layers: number;
  /** 0..1 through the current timed phase (turning / unravelling / working). */
  progress: number;
  /** Contact costs the player time right now. */
  lethal: boolean;
  /**
   * 0..1 through the burn of the layer that came off last, 1 once it has finished
   * (and 1 before the first hit, so nothing is ever mid-burn on frame one).
   *
   * Presentation only — the layer left the simulation on the frame the orb landed.
   * The renderer needs it because "the tape is burning off" is a *picture* of a hit
   * that has already been booked, and it must not be able to disagree with the
   * layer count about which band is going.
   */
  burn: number;
  /** Which `BANDS.need` group is burning, or 0 when nothing is. */
  burning: number;
  /**
   * 0..1 through the wind-up of a throw, 0 when he is not winding one up.
   *
   * The renderer draws the raised coil from it, so the telegraph grows on the frames
   * the simulation is actually counting — a tell painted off a render-local timer can
   * disagree with the throw it is warning about, which is the whole point of it.
   */
  wind: number;
}

export interface ShotState {
  box: AABB;
  dir: -1 | 1;
}

/**
 * One thrown bandage in the air.
 *
 * The sprite is the box and nothing but the box (`THROW_W`×`THROW_H`); the streamers
 * that trail behind it are drawn outside it and are inert, the same licence the
 * cutter's orb has for its wake.
 */
export interface BandageState {
  box: AABB;
  dir: -1 | 1;
  /** Distance travelled (px) — the renderer spins the roll off it, never off a clock. */
  travelled: number;
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
  /** Seconds since the last layer was burnt off (`Infinity` before the first). */
  burnT: number;
  /** The layer count the burning band belonged to, or 0 when nothing is burning. */
  burnLayer: number;
  /** Seconds until he may wind up another throw. Starts at `THROW_FIRST_DELAY`. */
  throwCool: number;
  /** The phase he was walking in when he stopped to throw, so he resumes it. */
  windFrom: MummyPhase;
}

interface Shot {
  x: number;
  y: number;
  dir: -1 | 1;
}

/** A bandage in flight. `travelled` is distance, which is what the spin reads. */
interface Bandage {
  x: number;
  y: number;
  dir: -1 | 1;
  travelled: number;
}

export class Workplace implements Hazard {
  private readonly mummies: MummyEntry[];
  private readonly shots: Shot[] = [];
  private readonly bandages: Bandage[] = [];
  /**
   * The screen's static solids, and the only reason this hazard is handed any: a thrown
   * bandage **stops at the partition wall**.
   *
   * The cutter's orb deliberately ignores geometry (the level answers for its line of
   * sight instead), and this goes the other way for a reason that is the screen's design
   * rather than its physics: the ANSR mark drops on the near side of that wall, and the
   * owner's brief for it was that the player can take it *safely*. A projectile that
   * crosses the wall would make the one place on the floor that is meant to be safe the
   * one place you cannot stand still. So the wall is cover — and stepping out from behind
   * it is what puts you in range, which is the decision the whole screen is built on.
   */
  private readonly blockers: readonly AABB[];
  /** Where the freed colleague runs to (px, centre of the terminal). */
  private readonly terminal: { x: number; y: number } | null;
  private cooldown = 0;
  private armed = false;
  private restoreT = 0;
  /**
   * Monotonic counters for the host's cues — the same contract as `Dragon.shotsFired`
   * and `Stamps.slams`, and the reason this file still has no idea an AudioEngine
   * exists. `_windUps` is the groan (the tell), `_throws` is the hush (the act); they
   * are separate because they are `THROW_WINDUP` apart and the gap is the telegraph.
   */
  private _windUps = 0;
  private _throws = 0;
  /** Seconds since the cutter last fired — the host draws the muzzle flash from it. */
  private sinceShotT = Number.POSITIVE_INFINITY;

  constructor(mummies: MummySpec[], terminal?: GridPos, blockers: readonly AABB[] = []) {
    this.blockers = blockers;
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
      burnT: Number.POSITIVE_INFINITY,
      burnLayer: 0,
      throwCool: W.THROW_FIRST_DELAY,
      windFrom: 'wrapped' as MummyPhase,
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

  /**
   * Both walking phases cost the player time. `turning` is lethal on purpose: he is
   * standing in a place the player has been watching him walk to, so there is
   * nothing to warn them about.
   */
  private static lethalPhase(m: MummyEntry): boolean {
    return m.phase === 'wrapped' || m.phase === 'turning' || m.phase === 'winding';
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
    for (const m of this.mummies) m.burnT += dt;

    if (ctx.assisted && ctx.shoot === true) this.fire(player);
    this.advanceShots(dt);

    let cause: SetbackCause | null = null;
    for (const m of this.mummies) {
      this.advance(m, dt);
      this.aim(m, player, dt);
      if (Workplace.lethalPhase(m) && aabbOverlap(player.box, this.box(m))) cause = 'mummy';
    }
    // The rolls he has already thrown, which outlive the phase that threw them.
    if (this.advanceBandages(dt, player)) cause = 'mummy';
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
      // Clear of the barrel rather than flush with the hitbox: the drawn tool
      // reaches ~40px from his centre, and an orb born inside it reads as a spark on
      // his own hand.
      x: dir === 1 ? player.box.x + player.box.w + 12 : player.box.x - W.SHOT_W - 12,
      // CENTRED on the muzzle, which is why the half-height is taken off: the orb is
      // 16 tall now, and a top-aligned orb hangs below the barrel it left.
      y: player.box.y + player.box.h * 0.4 - W.SHOT_H / 2,
      dir,
    });
  }

  private shotBox(s: Shot): AABB {
    return { x: s.x, y: s.y, w: W.SHOT_W, h: W.SHOT_H };
  }

  /**
   * Decide whether to start a throw, and finish one that is already wound up
   * (owner call: "add a capability for the mummy to throw the bandages at the player
   * capturing him").
   *
   * Four gates, and every one of them is there to keep the attack readable rather
   * than to make it weaker:
   *
   *  - **only while he is walking and still wrapped.** A freed colleague has no tape
   *    to throw and is not an obstacle any more.
   *  - **only at a player he is ALREADY FACING.** He never turns to aim, which is what
   *    keeps the patrol a metronome: his back is genuinely safe, so watching which way
   *    he is walking is information rather than decoration. It also means the throw
   *    cannot smuggle a direction change into the pattern the player has just read.
   *  - **only inside `THROW_RANGE` and outside `THROW_MIN_RANGE`.** The far bound stops
   *    him firing at a back he cannot see from off-frame; the near one stops a roll
   *    being spawned inside the player, which is a hit with no telegraph.
   *  - **only one roll in the air.** The corridor is never a wall, and the claim in
   *    `levels.json` ("only one roll is ever in the air") is enforced here rather than
   *    hoped for.
   */
  private aim(m: MummyEntry, player: Player, dt: number): void {
    if (m.phase === 'winding') {
      m.t += dt;
      if (m.t >= W.THROW_WINDUP) {
        this.release(m);
        m.phase = m.windFrom;
        m.t = 0;
        m.throwCool = W.THROW_INTERVAL;
      }
      return;
    }
    if (m.phase !== 'wrapped' || m.layers <= 0) return;
    m.throwCool = Math.max(0, m.throwCool - dt);
    if (m.throwCool > 0 || this.bandages.length > 0) return;
    const gap = player.box.x + player.box.w / 2 - m.cx;
    if (Math.sign(gap) !== m.dir) return;
    const dist = Math.abs(gap);
    if (dist < W.THROW_MIN_RANGE || dist > W.THROW_RANGE) return;
    // …and he does not throw at somebody behind cover. The roll would only die against
    // the partition, which reads as him not understanding the room — and worse, it would
    // burn the interval, so a player standing safely behind the wall would be *stopping*
    // the attack rather than sheltering from it.
    if (!this.hasLineOfFire(m, player)) return;
    m.windFrom = m.phase;
    m.phase = 'winding';
    m.t = 0;
    this._windUps += 1;
  }

  /**
   * Is there clear floor between him and the player at the roll's own height?
   *
   * Tested as one box the full length of the shot, at exactly the band the bandage flies
   * in — so "cover" is decided by the same geometry that will stop the roll, and the two
   * can never disagree about whether the player was safe.
   */
  private hasLineOfFire(m: MummyEntry, player: Player): boolean {
    const y = m.feetY - W.THROW_FLOOR_OFF - W.THROW_H / 2;
    const from = Math.min(m.cx, player.box.x);
    const to = Math.max(m.cx, player.box.x + player.box.w);
    const lane: AABB = { x: from, y, w: to - from, h: W.THROW_H };
    return !this.blockers.some((s) => aabbOverlap(lane, s));
  }

  /** The roll leaves his hand: clear of his own box, flying at the player's shins. */
  private release(m: MummyEntry): void {
    this._throws += 1;
    this.bandages.push({
      x: m.dir === 1 ? m.cx + W.MUMMY_W / 2 : m.cx - W.MUMMY_W / 2 - W.THROW_W,
      y: m.feetY - W.THROW_FLOOR_OFF - W.THROW_H / 2,
      dir: m.dir,
      travelled: 0,
    });
  }

  private bandageBox(b: Bandage): AABB {
    return { x: b.x, y: b.y, w: W.THROW_W, h: W.THROW_H };
  }

  /** Advance every roll in the air. Returns true if one caught the player. */
  private advanceBandages(dt: number, player: Player): boolean {
    let hit = false;
    for (let i = this.bandages.length - 1; i >= 0; i -= 1) {
      const b = this.bandages[i]!;
      const step = W.THROW_SPEED * dt;
      b.x += b.dir * step;
      b.travelled += step;
      const box = this.bandageBox(b);
      const caught = aabbOverlap(box, player.box);
      if (caught) hit = true;
      // Cover: the partition wall eats it. Nothing else on this screen is tall enough at
      // shin height to be in its way, so this is one rule with one consequence.
      const blocked = this.blockers.some((s) => aabbOverlap(box, s));
      if (caught || blocked || b.x + W.THROW_W < 0 || b.x > RESOLUTION.WIDTH) {
        this.bandages.splice(i, 1);
      }
    }
    return hit;
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
          // Which layer this was is recorded *before* it is taken off, because the
          // renderer needs to know which band is on fire and the band is authored
          // against the layer that still had it.
          m.burnLayer = m.layers;
          m.burnT = 0;
          m.layers -= 1;
          spent = true;
          if (m.layers === 0) {
            m.phase = 'unravelling';
            m.t = 0;
            // Every roll still in the air was a length of the tape that has just come
            // off him. A projectile that outlives its author is a hazard with nobody
            // behind it, and on the frame he becomes a colleague there is nothing on
            // this floor that should still be able to cost the player a life.
            this.bandages.length = 0;
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
        // To and fro (owner call). He walks to the end of his corridor, stops, turns
        // and comes back — no snap, so nothing about him is ever unfair, and the
        // player has to *pass* him rather than wait for him to vanish.
        m.cx += m.dir * W.WALK_SPEED * dt;
        if (m.cx >= m.maxX) {
          m.cx = m.maxX;
          m.phase = 'turning';
          m.t = 0;
        } else if (m.cx <= m.minX) {
          m.cx = m.minX;
          m.phase = 'turning';
          m.t = 0;
        }
        break;
      }
      case 'turning': {
        m.t += dt;
        if (m.t >= W.TURN_TIME) {
          // The flip lands at the END of the pause, not the start of it, so the beat
          // reads as "he stopped, then he turned" rather than as a figure standing
          // there already facing the way he is about to go.
          m.dir = m.dir === 1 ? -1 : 1;
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
    this.bandages.length = 0;
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
      m.burnT = Number.POSITIVE_INFINITY;
      m.burnLayer = 0;
      // Back to the opening delay, not to the interval: every attempt owes the player
      // the same beat to read the screen in before anything is thrown at them.
      m.throwCool = W.THROW_FIRST_DELAY;
      m.windFrom = 'wrapped';
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
      burn: Math.min(1, m.burnT / W.BURN_TIME),
      burning: m.burnT < W.BURN_TIME ? m.burnLayer : 0,
      wind: m.phase === 'winding' ? Math.min(1, m.t / W.THROW_WINDUP) : 0,
    }));
  }

  private static phaseProgress(m: MummyEntry): number {
    const span =
      m.phase === 'turning'
        ? W.TURN_TIME
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

  /**
   * The bandages he has thrown that are still in the air (at most one).
   *
   * The renderer draws the roll from this box and nothing else, so what is painted
   * is what can catch the player — the same rule the figure and the orb obey.
   */
  bandageStates(): BandageState[] {
    return this.bandages.map((b) => ({
      box: this.bandageBox(b),
      dir: b.dir,
      travelled: b.travelled,
    }));
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

  /** Wind-ups started (the groan). Monotonic; a retry rebuilds the hazard. */
  get windUps(): number {
    return this._windUps;
  }

  /** Rolls that have actually left his hand (the hush). Monotonic. */
  get throws(): number {
    return this._throws;
  }

  /** Somebody is at the keyboard right now. */
  get isWorking(): boolean {
    return this.mummies.some((m) => m.phase === 'working');
  }

  /**
   * The terminal is arcing right now — the same condition the renderer draws the
   * sparks from (`restore < 0.5`, and only where the screen authored a terminal), so
   * the crackle can never be heard off a terminal that is not throwing sparks.
   */
  get isSparking(): boolean {
    return this.terminal !== null && this.restore < 0.5;
  }

  /** Tape layers still on the floor's one obstacle (the on-screen proof). */
  get layersLeft(): number {
    return this.mummies.reduce((sum, m) => sum + m.layers, 0);
  }
}
