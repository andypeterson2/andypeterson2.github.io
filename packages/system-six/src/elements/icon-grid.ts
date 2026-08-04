import { el, projectChildren, onReady } from '../dom';

/**
 * `<s6-icon-grid>…s6-finder-icons…</s6-icon-grid>`
 *
 * The Finder desktop — a responsive grid of icons (L7 — the OS is the IA).
 * Emits `.icon-grid` and projects the icons.
 */
export class S6IconGrid extends HTMLElement {
  private wrapped = false;

  connectedCallback(): void {
    onReady(() => this.upgrade());
  }

  private upgrade(): void {
    if (this.wrapped) return;
    this.wrapped = true;
    const grid = el('div', 'icon-grid');
    projectChildren(this, grid);
    this.appendChild(grid);
  }
}

customElements.define('s6-icon-grid', S6IconGrid);

declare global {
  interface HTMLElementTagNameMap {
    's6-icon-grid': S6IconGrid;
  }
}
