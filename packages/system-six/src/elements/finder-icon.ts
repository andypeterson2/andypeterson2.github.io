import { el } from '../dom';

/**
 * `<s6-finder-icon src="/icons/grid.svg" label="Nonogram" href="/…"></s6-finder-icon>`
 *
 * A single Finder icon — a monochrome glyph over a label, invert-on-hover.
 * Emits `a.finder-icon › .icon-box > img.icon-glyph` + `.icon-label`. The glyph
 * `src` should be a 1-bit SVG so it inverts correctly with the theme (L4).
 */
export class S6FinderIcon extends HTMLElement {
  private wrapped = false;

  connectedCallback(): void {
    if (this.wrapped) return;
    this.wrapped = true;

    const a = el('a', 'finder-icon');
    const href = this.getAttribute('href');
    if (href) a.setAttribute('href', href);

    const label = this.getAttribute('label') ?? '';
    const src = this.getAttribute('src');
    if (src) {
      const box = el('span', 'icon-box');
      const img = el('img', 'icon-glyph');
      img.setAttribute('src', src);
      img.setAttribute('alt', label);
      box.appendChild(img);
      a.appendChild(box);
    }
    a.appendChild(el('span', 'icon-label', label));

    this.appendChild(a);
  }
}

customElements.define('s6-finder-icon', S6FinderIcon);

declare global {
  interface HTMLElementTagNameMap {
    's6-finder-icon': S6FinderIcon;
  }
}
