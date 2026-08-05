import type { Project } from '../data/projects';
import type { ExperienceEntry } from '../data/experience';

/**
 * A single entry on the home-page unified timeline — either a work/leadership
 * period or a project. The `type` discriminant is a presentation concern added
 * when the timeline is composed (see index.astro), so the underlying
 * experience/project data stays free of layout coupling.
 */
export type TimelineItem =
  | ({ type: 'experience' } & ExperienceEntry)
  | { type: 'project'; period: string; project: Project };
