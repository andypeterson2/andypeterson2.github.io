/**
 * Classifier-tier entry — the single bundled script ClassifierApp.astro loads.
 *
 * config's side effects (seeding window.UI_CONFIG / API_BASE / dataset list)
 * must run before app's module body reads them; app pulls in the rest
 * (ui-kit, connection, sse, chart, infer) as ordinary imports.
 */
import './config';
import './app';
