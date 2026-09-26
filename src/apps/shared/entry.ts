/**
 * Live-tier entry — the bundled script a demo page loads to reach its backend.
 *
 * Import order is load-bearing: pass first (its fetch wrapper must be installed
 * before anything calls out), then service-config and contract-client, which the
 * app tiers read.
 */
import './pass';
import './service-config';
import './contract-client';
