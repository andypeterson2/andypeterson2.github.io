/**
 * Site configuration — reads identity from environment variables.
 *
 * Set SITE_DISPLAY_NAME, SITE_DOMAIN, and SITE_EMAIL in .env.local
 * to configure the site for a specific identity.
 */

import { resolveSiteConfig, type SiteConfig } from '../lib/site-config';

export type { SiteConfig };

export const siteConfig: SiteConfig = resolveSiteConfig(
  import.meta.env as Record<string, string | undefined>,
);
