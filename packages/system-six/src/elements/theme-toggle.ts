/**
 * `<s6-theme-toggle></s6-theme-toggle>`
 *
 * The dark-mode control (L4 — state is inversion at page scale). Flips
 * `data-theme` on `<html>` and persists to `localStorage["sm-theme"]`; the page
 * inverts via the single `html[data-theme=dark]` filter in base.css.
 *
 * The icon (a half-filled circle) is an inlined SVG, so the component is
 * self-contained — no icon-font dependency. The one thing the consumer supplies
 * is a no-FOUC bootstrap in <head>: a 3-line inline script that reads
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
    btn.innerHTML =
      '<svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M8 15A7 7 0 1 0 8 1zm0 1A8 8 0 1 1 8 0a8 8 0 0 1 0 16"/></svg>';

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
