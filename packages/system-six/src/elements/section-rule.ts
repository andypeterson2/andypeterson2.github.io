import { el, projectChildren, onReady } from '../dom';

/**
 * `<s6-section-rule>How it works</s6-section-rule>`
 *
 * A centered uppercase label between hairlines (L5 — structure without color).
 * Emits `.section-rule`; the hairlines are its `::before`/`::after` in base.css.
 */
export class S6SectionRule extends HTMLElement {
  private wrapped = false;

  connectedCallback(): void {
    onReady(() => this.upgrade());
  }

  private upgrade(): void {
    if (this.wrapped) return;
    this.wrapped = true;
    const rule = el('div', 'section-rule');
    projectChildren(this, rule);
    this.appendChild(rule);
  }
}

customElements.define('s6-section-rule', S6SectionRule);

declare global {
  interface HTMLElementTagNameMap {
    's6-section-rule': S6SectionRule;
  }
}
