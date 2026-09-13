/**
 * Shared-tier entry — the single bundled script the server-status nav loads.
 *
 * Import order is load-bearing:
 * pass first (its fetch wrapper must be installed before anything calls out),
 * then service-config and contract-client (published for the app tiers), then
 * the connect-modal UI that consumes them.
 */
import './pass';
import './service-config';
import './contract-client';
import './server-connect-modal';
