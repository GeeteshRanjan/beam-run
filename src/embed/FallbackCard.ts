/**
 * FallbackCard — the static, branded card shown when the game is not (yet)
 * running: before a lazy mount intersects, when the kill switch is off, or when
 * the game fails to boot. It is lightweight DOM (no canvas, no game code) so it
 * never sits on the host's critical path, and it always offers a route onward
 * (Play when allowed, and a Skip link to the Navigator) — no dead ends.
 */
import { COPY } from '../data/copy';

export interface FallbackCardCallbacks {
  canPlay: boolean;
  onPlay: () => void;
  onSkip: () => void;
}

export class FallbackCard {
  readonly root: HTMLDivElement;

  constructor(parent: HTMLElement, cb: FallbackCardCallbacks) {
    const doc = parent.ownerDocument;
    this.root = doc.createElement('div');
    this.root.className = 'beam-run__fallback';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', COPY.fallback.title);

    const title = doc.createElement('h2');
    title.className = 'beam-run__fallback-title';
    title.textContent = COPY.fallback.title;

    const body = doc.createElement('p');
    body.className = 'beam-run__fallback-body';
    body.textContent = COPY.fallback.body;

    const actions = doc.createElement('div');
    actions.className = 'beam-run__actions';

    if (cb.canPlay) {
      const play = doc.createElement('button');
      play.type = 'button';
      play.className = 'beam-run__btn beam-run__btn--primary';
      play.textContent = COPY.fallback.play;
      play.addEventListener('click', cb.onPlay);
      actions.appendChild(play);
    }

    const skip = doc.createElement('button');
    skip.type = 'button';
    skip.className = 'beam-run__btn beam-run__btn--ghost';
    skip.textContent = COPY.fallback.skip;
    skip.addEventListener('click', cb.onSkip);
    actions.appendChild(skip);

    this.root.append(title, body, actions);
    parent.appendChild(this.root);
  }

  destroy(): void {
    this.root.remove();
  }
}
