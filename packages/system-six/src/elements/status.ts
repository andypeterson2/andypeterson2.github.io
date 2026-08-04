import { el } from '../dom';

/** The status-light states (L3 — color is the only color; L6 — honest state). */
export type StatusState = 'success' | 'warning' | 'danger' | 'idle';
const STATES = new Set<StatusState>(['success', 'warning', 'danger', 'idle']);

/**
 * `<s6-status state="success" label="Connected"></s6-status>`
 *
 * The status light — a colored dot + label. Reactive: change `state`/`label`
 * and it updates live, because reporting state honestly is the point. Color is
 * the ONLY place a hue appears in this system, and it comes from the status
 * tokens (`--color-success` / `-warning` / `-danger`, or muted for `idle`).
 */
export class S6Status extends HTMLElement {
  static readonly observedAttributes = ['state', 'label'];
  private wrapped = false;

  connectedCallback(): void {
    if (this.wrapped) return;
    this.wrapped = true;
    const wrap = el('span', 's6-status');
    wrap.appendChild(el('span', 's6-status-dot', '●'));
    wrap.appendChild(el('span', 's6-status-label'));
    this.appendChild(wrap);
    this.setAttribute('role', 'status');
    this.update();
  }

  attributeChangedCallback(): void {
    if (this.wrapped) this.update();
  }

  private update(): void {
    const raw = (this.getAttribute('state') ?? 'idle') as StatusState;
    const state = STATES.has(raw) ? raw : 'idle';
    const wrap = this.firstElementChild as HTMLElement;
    wrap.className = `s6-status s6-status--${state}`;
    (wrap.querySelector('.s6-status-label') as HTMLElement).textContent =
      this.getAttribute('label') ?? '';
  }
}

customElements.define('s6-status', S6Status);

declare global {
  interface HTMLElementTagNameMap {
    's6-status': S6Status;
  }
}
