import { projectChildren, onReady } from '../dom';

/**
 * `<s6-button [disabled]>Label</s6-button>`
 *
 * A System 6 button. Emits `<button class="btn">` and projects your label
 * (text or icon) into it. All styling is system.css's `.btn`.
 */
export class S6Button extends HTMLElement {
  private wrapped = false;

  connectedCallback(): void {
    onReady(() => this.upgrade());
  }

  private upgrade(): void {
    if (this.wrapped) return;
    this.wrapped = true;

    const btn = document.createElement('button');
    btn.className = 'btn';
    if (this.hasAttribute('disabled')) btn.setAttribute('disabled', '');
    projectChildren(this, btn);
    this.appendChild(btn);
  }
}

customElements.define('s6-button', S6Button);

declare global {
  interface HTMLElementTagNameMap {
    's6-button': S6Button;
  }
}
