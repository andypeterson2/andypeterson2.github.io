import { el, projectChildren, onReady } from '../dom';

/**
 * `<s6-window title="…" details="…">…body…</s6-window>`
 *
 * A System 6 window. Emits `.window › .title-bar > .title` (+ optional
 * `.details-bar`) `› .window-body`, and projects your content into the body.
 * All chrome comes from system.css.
 */
export class S6Window extends HTMLElement {
  private wrapped = false;

  connectedCallback(): void {
    onReady(() => this.upgrade());
  }

  private upgrade(): void {
    if (this.wrapped) return;
    this.wrapped = true;

    const win = el('div', 'window');

    const bar = el('div', 'title-bar');
    bar.appendChild(el('span', 'title', this.getAttribute('title') ?? ''));
    win.appendChild(bar);

    const details = this.getAttribute('details');
    if (details != null) {
      const d = el('div', 'details-bar');
      d.appendChild(el('span', undefined, details));
      win.appendChild(d);
    }

    const body = el('div', 'window-body');
    projectChildren(this, body); // your content → the window body
    win.appendChild(body);

    this.appendChild(win);
  }
}

customElements.define('s6-window', S6Window);

declare global {
  interface HTMLElementTagNameMap {
    's6-window': S6Window;
  }
}
