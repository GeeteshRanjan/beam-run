/**
 * Hud — the in-play heads-up display, built from real DOM (not canvas) so it is
 * screen-reader accessible. Shows the level name, lives, the running Growth
 * Points total, and the active-power timer bar. Includes an `aria-live` region
 * used to announce state changes (level start, death, win).
 */
import { COPY } from '../data/copy';

export interface PowerHud {
  name: string;
  remaining: number;
  duration: number;
}

export interface HudModel {
  levelLabel: string;
  lives: number;
  points: number;
  power: PowerHud | null;
}

const GRAPH_SVG =
  '<svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="vertical-align:-0.12em">' +
  '<polyline points="3,17 9,11 13,14 21,5" fill="none" stroke="currentColor" stroke-width="2.5" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

export class Hud {
  readonly root: HTMLDivElement;
  private readonly level: HTMLDivElement;
  private readonly lives: HTMLDivElement;
  private readonly points: HTMLDivElement;
  private readonly power: HTMLDivElement;
  private readonly powerName: HTMLSpanElement;
  private readonly powerFill: HTMLDivElement;
  private readonly live: HTMLDivElement;

  constructor(parent: HTMLElement) {
    const doc = parent.ownerDocument;
    this.root = doc.createElement('div');
    this.root.className = 'beam-run__hud';

    this.level = doc.createElement('div');
    this.level.className = 'beam-run__hud-row beam-run__hud-level';

    this.lives = doc.createElement('div');
    this.lives.className = 'beam-run__hud-row beam-run__hud-lives';
    this.lives.setAttribute('aria-label', COPY.hud.livesLabel);

    this.points = doc.createElement('div');
    this.points.className = 'beam-run__hud-row beam-run__hud-points';

    this.power = doc.createElement('div');
    this.power.className = 'beam-run__hud-row beam-run__hud-power';
    this.powerName = doc.createElement('span');
    this.powerName.className = 'beam-run__hud-power-name';
    const bar = doc.createElement('div');
    bar.className = 'beam-run__hud-power-bar';
    this.powerFill = doc.createElement('div');
    this.powerFill.className = 'beam-run__hud-power-fill';
    bar.appendChild(this.powerFill);
    this.power.append(this.powerName, bar);

    this.live = doc.createElement('div');
    this.live.className = 'beam-run__sr';
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');

    this.root.append(this.level, this.lives, this.points, this.power, this.live);
    parent.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('beam-run__hud--visible', visible);
  }

  update(model: HudModel): void {
    this.level.textContent = model.levelLabel;

    const hearts = model.lives > 0 ? '\u2665'.repeat(model.lives) : '\u2661';
    this.lives.textContent = hearts;

    this.points.innerHTML = `${GRAPH_SVG} <span>${model.points}</span>`;
    this.points.setAttribute('aria-label', `${COPY.hud.pointsLabel}: ${model.points}`);

    if (model.power) {
      this.power.classList.add('beam-run__hud-power--visible');
      this.powerName.textContent = model.power.name;
      const frac = model.power.duration > 0 ? model.power.remaining / model.power.duration : 0;
      this.powerFill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
    } else {
      this.power.classList.remove('beam-run__hud-power--visible');
    }
  }

  /** Announce a message to assistive tech. Toggling text forces re-read. */
  announce(message: string): void {
    this.live.textContent = '';
    // Next tick so screen readers register the change.
    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16);
    schedule(() => {
      this.live.textContent = message;
    });
  }

  destroy(): void {
    this.root.remove();
  }
}
