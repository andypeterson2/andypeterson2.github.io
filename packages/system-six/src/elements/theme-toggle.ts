/**
 * `<s6-theme-toggle></s6-theme-toggle>`
 *
 * The dark-mode control (L4 — state is inversion at page scale). Flips
 * `data-theme` on `<html>` and persists to `localStorage["sm-theme"]`; the page
 * inverts via the single `html[data-theme=dark]` filter in base.css.
 *
 * Two things the consumer supplies: bootstrap-icons (for the `bi-circle-half`
 * glyph) and a no-FOUC bootstrap in <head> — a 3-line inline script that reads
 * localStorage and sets `data-theme` before first paint (see the README).
 */
export class S6ThemeToggle extends HTMLElement {
  private wrapped = false;

  connectedCallback(): void {
    if (this.wrapped) return;
    this.wrapped = true;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.innerHTML = '<i class="bi bi-circle-half" aria-hidden="true"></i>';

    const sync = (): void => {
      const dark = document.documentElement.dataset.theme === 'dark';
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('aria-pressed', String(dark));
    };

    btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem('sm-theme', next);
      } catch {
        /* private mode — session-only */
      }
      sync();
    });

    sync();
    this.appendChild(btn);
  }
}

customElements.define('s6-theme-toggle', S6ThemeToggle);

declare global {
  interface HTMLElementTagNameMap {
    's6-theme-toggle': S6ThemeToggle;
  }
}
