/**
 * Pure site-config resolver. Takes an env object (typically
 * import.meta.env) and produces the fully-resolved SiteConfig with
 * fallback values. Extracted from src/config/site.ts for unit testing.
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

export interface SiteEnv {
  SITE_DISPLAY_NAME?: string;
  SITE_DOMAIN?: string;
  SITE_EMAIL?: string;
  SITE_TITLE?: string;
  SITE_DESCRIPTION?: string;
  SITE_GITHUB?: string;
  SITE_LINKEDIN?: string;
  [key: string]: string | undefined;
}

export function resolveSiteConfig(env: SiteEnv): SiteConfig {
  const rawDisplayName = env.SITE_DISPLAY_NAME;
  const displayName = rawDisplayName || 'Portfolio';
  const nameParts = (rawDisplayName || 'Portfolio').split(' ');
  const firstName = nameParts[0] || 'Portfolio';
  const lastName = (rawDisplayName || '').split(' ').slice(1).join(' ') || '';

  return {
    displayName,
    firstName,
    lastName,
    domain: env.SITE_DOMAIN || 'localhost',
    email: env.SITE_EMAIL || '',
    title: env.SITE_TITLE || 'Projects',
    description: env.SITE_DESCRIPTION || 'Personal portfolio and project showcase',
    github: env.SITE_GITHUB || '',
    linkedin: env.SITE_LINKEDIN || '',
  };
}
