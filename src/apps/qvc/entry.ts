/**
 * Quantum-video-chat tier entry — the single bundled script the page loads.
 * The app module bootstraps on evaluation (module scripts run after the page
 * markup). Nothing here opens a socket or touches a camera: the live tier waits
 * for `navbar:connect`, and the simulation waits for its button.
 * The vendored Socket.IO classic script must be loaded by the page before this
 * bundle (it supplies the `io` global).
 */
import './app';
