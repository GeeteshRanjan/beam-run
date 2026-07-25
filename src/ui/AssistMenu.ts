/**
 * AssistMenu — the accessibility options dialog.
 *
 * A real, keyboard-operable modal dialog (role=dialog, aria-modal) of labelled
 * checkboxes bound to the headless `AssistController`. Every change routes
 * through the controller, which applies it to the sim/loop/audio and announces
 * it via aria-live. Opened from the pause menu (or Start), closed with "Done".
 */
import { COPY } from '../data/copy';
import type { AssistController, AssistToggle } from '../core/AssistController';
import { PIXEL_TITLE, setPixelButtonLabel, setPixelText } from './PixelType';

const TOGGLES: { key: AssistToggle; label: string }[] = [
  { key: 'autoRun', label: COPY.assist.autoRun },
  { key: 'slowMode', label: COPY.assist.slowMode },
  { key: 'extraTime', label: COPY.assist.extraTime },
  { key: 'noSetbacks', label: COPY.assist.noSetbacks },
  { key: 'largerControls', label: COPY.assist.largerControls },
  { key: 'muteMusic', label: COPY.assist.muteMusic },
  { key: 'muteSfx', label: COPY.assist.muteSfx },
];

export class AssistMenu {
  readonly root: HTMLDivElement;
  private readonly controller: AssistController;
  private readonly onClose: () => void;
  private readonly checkboxes = new Map<AssistToggle, HTMLInputElement>();
  private readonly doneBtn: HTMLButtonElement;
  private _open = false;

  constructor(parent: HTMLElement, controller: AssistController, onClose: () => void) {
    this.controller = controller;
    this.onClose = onClose;
    const doc = parent.ownerDocument;

    this.root = doc.createElement('div');
    this.root.className = 'beam-run__overlay beam-run__assist';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', COPY.assist.title);

    const title = doc.createElement('h2');
    title.className = 'beam-run__title';
    setPixelText(title, COPY.assist.title, PIXEL_TITLE);

    // The intro and the checkbox labels stay in web type on purpose: this is a
    // settings dialog with real form controls, and the 5×7 font has no lower
    // case or punctuation, which is what makes a sentence hard to read.
    const intro = doc.createElement('p');
    intro.className = 'beam-run__assist-intro';
    intro.textContent = COPY.assist.intro;

    const list = doc.createElement('div');
    list.className = 'beam-run__assist-list';
    for (const { key, label } of TOGGLES) {
      const row = doc.createElement('label');
      row.className = 'beam-run__assist-row';
      const box = doc.createElement('input');
      box.type = 'checkbox';
      box.className = 'beam-run__assist-check';
      box.addEventListener('change', () => this.controller.set(key, box.checked));
      const span = doc.createElement('span');
      span.textContent = label;
      row.append(box, span);
      list.append(row);
      this.checkboxes.set(key, box);
    }

    const actions = doc.createElement('div');
    actions.className = 'beam-run__actions';
    this.doneBtn = doc.createElement('button');
    this.doneBtn.type = 'button';
    this.doneBtn.className = 'beam-run__btn beam-run__btn--primary';
    setPixelButtonLabel(this.doneBtn, COPY.assist.close, 'primary');
    this.doneBtn.addEventListener('click', () => this.hide());
    actions.append(this.doneBtn);

    this.root.append(title, intro, list, actions);
    parent.appendChild(this.root);
  }

  get open(): boolean {
    return this._open;
  }

  /** Sync the checkboxes to the controller's current values and reveal. */
  show(): void {
    for (const [key, box] of this.checkboxes) box.checked = this.controller.isOn(key);
    this._open = true;
    this.root.classList.add('beam-run__overlay--visible');
    this.doneBtn.focus?.();
  }

  hide(): void {
    if (!this._open) return;
    this._open = false;
    this.root.classList.remove('beam-run__overlay--visible');
    this.onClose();
  }

  destroy(): void {
    this.root.remove();
  }
}
