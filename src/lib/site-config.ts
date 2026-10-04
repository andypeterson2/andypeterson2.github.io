/**
 * Pure site-config resolver. Takes an env object (typically
 * import.meta.env) and produces the fully-resolved SiteConfig with
 * fallback values. Kept pure (no import.meta access) so it can be unit-tested.
 */

export interface SiteConfig {
  displayName: string;
  firstName: string;
  lastName: string;
  domain: string;
  email: string;
  title: string;
  /** One job title everywhere it appears (Me card, page titles, JSON-LD). */
  jobTitle: string;
  /** Where the person is, as they would say it: "San Diego". */
  location: string;
  /** Availability signals, each shown only when switched on. */
  openToWork: boolean;
  openToRelocation: boolean;
  openToRemote: boolean;
  description: string;
  github: string;
  linkedin: string;
}

export interface SiteEnv {
  SITE_DISPLAY_NAME?: string;
  SITE_DOMAIN?: string;
  SITE_EMAIL?: string;
  SITE_TITLE?: string;
  SITE_JOB_TITLE?: string;
  SITE_LOCATION?: string;
  SITE_OPEN_TO_WORK?: string;
  SITE_OPEN_TO_RELOCATION?: string;
  SITE_OPEN_TO_REMOTE?: string;
  SITE_DESCRIPTION?: string;
  SITE_GITHUB?: string;
  SITE_LINKEDIN?: string;
  [key: string]: string | undefined;
}

/** A switch is on for the words a person would actually set: true, 1, yes, on. */
function isOn(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? '').trim());
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
    jobTitle: env.SITE_JOB_TITLE || 'Software Engineer',
    location: env.SITE_LOCATION || '',
    openToWork: isOn(env.SITE_OPEN_TO_WORK),
    openToRelocation: isOn(env.SITE_OPEN_TO_RELOCATION),
    openToRemote: isOn(env.SITE_OPEN_TO_REMOTE),
    description: env.SITE_DESCRIPTION || 'Personal portfolio and project showcase',
    github: env.SITE_GITHUB || '',
    linkedin: env.SITE_LINKEDIN || '',
  };
}
