/**
 * Site configuration — reads identity from environment variables.
 *
 * Set SITE_DISPLAY_NAME, SITE_DOMAIN, and SITE_EMAIL in .env.local
 * to configure the site for a specific identity.
 */

export interface SiteConfig {
  displayName: string;
  firstName: string;
  lastName: string;
  domain: string;
  email: string;
  title: string;
  description: string;
  github: string;
  linkedin: string;
}

export const siteConfig: SiteConfig = {
  displayName: import.meta.env.SITE_DISPLAY_NAME || 'Portfolio',
  firstName: (import.meta.env.SITE_DISPLAY_NAME || 'Portfolio').split(' ')[0] || 'Portfolio',
  lastName: (import.meta.env.SITE_DISPLAY_NAME || '').split(' ').slice(1).join(' ') || '',
  domain: import.meta.env.SITE_DOMAIN || 'localhost',
  email: import.meta.env.SITE_EMAIL || '',
  title: import.meta.env.SITE_TITLE || 'Portfolio',
  description: import.meta.env.SITE_DESCRIPTION || 'Personal portfolio and project showcase',
  github: import.meta.env.SITE_GITHUB || '',
  linkedin: import.meta.env.SITE_LINKEDIN || '',
};
