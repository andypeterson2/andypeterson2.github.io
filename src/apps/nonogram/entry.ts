/**
 * Nonogram-tier entry — the single bundled script the nonogram page loads.
 * The app module pulls in the state, UI, grid and solver modules as ordinary
 * imports and bootstraps on evaluation (module scripts run after the page markup).
 * The vendored Socket.IO classic script must be loaded by the page BEFORE
 * this bundle (it supplies the `io` global).
 */
import './app';
