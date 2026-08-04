import { el, projectChildren, onReady } from '../dom';

/** The 1-bit ordered fill densities (L2 — one ink). */
export type DitherDensity = 'light' | '25' | '50' | '75' | 'hatch';
const DENSITIES = new Set<DitherDensity>(['light', '25', '50', '75', 'hatch']);

/**
 * `<s6-dither density="25">…</s6-dither>`
 *
 * A 1-bit dithered fill — the honest System 6 gray. Emits `.dither-<density>`
 * (from dither.css); size the `<s6-dither>` element and the fill fills it.
 * `light` is the only density safe behind running text.
 */
export class S6Dither extends HTMLElement {
  private wrapped = false;

  connectedCallback(): void {
    onReady(() => this.upgrade());
  }

  private upgrade(): void {
    if (this.wrapped) return;
    this.wrapped = true;

    const raw = (this.getAttribute('density') ?? '25') as DitherDensity;
    const density = DENSITIES.has(raw) ? raw : '25';
    const box = el('div', `dither-${density}`);
    projectChildren(this, box);
    this.appendChild(box);
  }
}

customElements.define('s6-dither', S6Dither);

declare global {
  interface HTMLElementTagNameMap {
    's6-dither': S6Dither;
  }
}
