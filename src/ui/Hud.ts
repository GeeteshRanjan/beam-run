/**
 * Hud — the in-play heads-up display, built from real DOM (not canvas) so it is
 * screen-reader accessible.
 *
 * Four readouts, each on its own high-contrast panel so it stays legible over a
 * busy pixel backdrop (text-shadow alone was not enough):
 *
 *   top-left      current stage
 *   top-right     TIME TO MARKET — the one number that matters, dominant
 *   bottom-left   quick wins found (a count, never a score)
 *   bottom-right  the ANSR capability engaged on this screen (persistent chip)
 *
 * There is no lives counter: setbacks cost months, not lives.
 */
import { COPY } from '../data/copy';

export interface PowerHud {
  /** Short outcome label, e.g. "Roles filled". */
  name: string;
  /** ANSR product name, e.g. "Talent500". */
  product: string;
}

export interface HudModel {
  levelLabel: string;
  months: number;
  quickWins: number;
  totalQuickWins: number;
  power: PowerHud | null;
}

const GRAPH_SVG =
  '<svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="vertical-align:-0.12em">' +
  '<polyline points="3,17 9,11 13,14 21,5" fill="none" stroke="currentColor" stroke-width="2.5" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

export class Hud {
  readonly root: HTMLDivElement;
  private readonly level: HTMLDivElement;
  private readonly clock: HTMLDivElement;
  private readonly clockValue: HTMLSpanElement;
  private readonly quickWins: HTMLDivElement;
  private readonly power: HTMLDivElement;
  private readonly powerName: HTMLSpanElement;
  private readonly powerProduct: HTMLSpanElement;
  private readonly live: HTMLDivElement;
  private lastMonths = -1;

  constructor(parent: HTMLElement) {
    const doc = parent.ownerDocument;
    this.root = doc.createElement('div');
    this.root.className = 'beam-run__hud';

    this.level = doc.createElement('div');
    this.level.className = 'beam-run__hud-row beam-run__hud-level';

    // The journey clock — deliberately the loudest thing on the HUD.
    this.clock = doc.createElement('div');
    this.clock.className = 'beam-run__hud-row beam-run__hud-clock';
    const clockLabel = doc.createElement('span');
    clockLabel.className = 'beam-run__hud-clock-label';
    clockLabel.textContent = COPY.hud.monthsLabel;
    this.clockValue = doc.createElement('span');
    this.clockValue.className = 'beam-run__hud-clock-value';
    const clockUnit = doc.createElement('span');
    clockUnit.className = 'beam-run__hud-clock-unit';
    clockUnit.textContent = COPY.hud.monthsUnit;
    this.clock.append(clockLabel, this.clockValue, clockUnit);

    this.quickWins = doc.createElement('div');
    this.quickWins.className = 'beam-run__hud-row beam-run__hud-wins';

    this.power = doc.createElement('div');
    this.power.className = 'beam-run__hud-row beam-run__hud-power';
    this.powerName = doc.createElement('span');
    this.powerName.className = 'beam-run__hud-power-name';
    this.powerProduct = doc.createElement('span');
    this.powerProduct.className = 'beam-run__hud-power-product';
    this.power.append(this.powerProduct, this.powerName);

    this.live = doc.createElement('div');
    this.live.className = 'beam-run__sr';
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');

    this.root.append(this.level, this.clock, this.quickWins, this.power, this.live);
    parent.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('beam-run__hud--visible', visible);
  }

  update(model: HudModel): void {
    this.level.textContent = model.levelLabel;

    this.clockValue.textContent = `${model.months}`;
    this.clock.setAttribute(
      'aria-label',
      `${COPY.hud.monthsLabel}: ${model.months} ${COPY.hud.monthsUnit}`,
    );
    // Nudge the clock when it moves so a booked delay is impossible to miss.
    if (this.lastMonths >= 0 && model.months !== this.lastMonths) {
      this.clock.classList.remove('beam-run__hud-clock--bump');
      void this.clock.offsetWidth; // force reflow so the animation can retrigger
      this.clock.classList.add('beam-run__hud-clock--bump');
    }
    this.lastMonths = model.months;

    this.quickWins.innerHTML =
      `${GRAPH_SVG} <span>${model.quickWins}<span class="beam-run__hud-wins-total">` +
      `/${model.totalQuickWins}</span></span>`;
    this.quickWins.setAttribute(
      'aria-label',
      `${COPY.hud.quickWinsLabel}: ${model.quickWins} of ${model.totalQuickWins}`,
    );

    if (model.power) {
      this.power.classList.add('beam-run__hud-power--visible');
      this.powerProduct.textContent = model.power.product;
      this.powerName.textContent = model.power.name;
      this.power.setAttribute(
        'aria-label',
        `${COPY.hud.powerLabel}: ${model.power.product} — ${model.power.name}`,
      );
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
