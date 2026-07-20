// Section-type registry — the editor's canonical definition, also mirrored by the
// backend. This is what makes the editor type-aware: 16 section types across 5
// shapes (by latexType). See docs/editor-redesign.md §3.

export interface FieldDef {
  key: string;
  label: string;
  options?: readonly string[];
}

export interface SectionTypeDef {
  latexType: 'cventries' | 'cvskills' | 'cvhonors' | 'cvparagraph' | 'cvreferences';
  label: string;
  description: string;
  category: 'roles' | 'achievements' | 'other';
  entryLabel?: string;
  itemLabel?: string;
  titleField?: string;
  titleFallback?: string;
  /** entries have bullet items (only the cventries shape) */
  hasItems?: boolean;
  /** a single free-text block, not entries (summary) */
  isParagraph?: boolean;
  combine?: { target: string; from: string[]; join: string };
  fields: FieldDef[];
}

export const DEGREE_PROGRAMS = [
  '',
  'B.S.',
  'B.A.',
  'B.F.A.',
  'B.E.',
  'B.B.A.',
  'M.S.',
  'M.A.',
  'M.F.A.',
  'M.E.',
  'M.B.A.',
  'Ph.D.',
  'Ed.D.',
  'J.D.',
  'M.D.',
  'D.O.',
  'A.S.',
  'A.A.',
  'A.A.S.',
] as const;

const roleFields: FieldDef[] = [
  { key: 'position', label: 'Position' },
  { key: 'organization', label: 'Organization' },
  { key: 'location', label: 'Location' },
  { key: 'date', label: 'Date' },
];

export const SECTION_TYPES: Record<string, SectionTypeDef> = {
  experience: {
    latexType: 'cventries',
    label: 'Experience',
    description: 'Positions held at organizations',
    category: 'roles',
    entryLabel: 'Role',
    itemLabel: 'Bullet',
    titleField: 'organization',
    titleFallback: 'position',
    hasItems: true,
    fields: roleFields,
  },
  education: {
    latexType: 'cventries',
    label: 'Education',
    description: 'Degrees and academic programs',
    category: 'roles',
    entryLabel: 'Degree',
    itemLabel: 'Detail',
    titleField: 'organization',
    titleFallback: 'major',
    hasItems: true,
    combine: { target: 'position', from: ['program', 'major'], join: ' ' },
    fields: [
      { key: 'program', label: 'Program', options: DEGREE_PROGRAMS },
      { key: 'major', label: 'Major / Field of Study' },
      { key: 'organization', label: 'Institution' },
      { key: 'location', label: 'Location' },
      { key: 'date', label: 'Date' },
    ],
  },
  projects: {
    latexType: 'cventries',
    label: 'Projects',
    description: 'Personal or professional projects',
    category: 'roles',
    entryLabel: 'Project',
    itemLabel: 'Detail',
    titleField: 'organization',
    titleFallback: 'position',
    hasItems: true,
    fields: [
      { key: 'position', label: 'Role / Contribution' },
      { key: 'organization', label: 'Project Name' },
      { key: 'location', label: 'Technologies / URL' },
      { key: 'date', label: 'Date' },
    ],
  },
  presentations: {
    latexType: 'cventries',
    label: 'Presentations',
    description: 'Talks, lectures, and presentations',
    category: 'roles',
    entryLabel: 'Talk',
    itemLabel: 'Detail',
    titleField: 'organization',
    titleFallback: 'position',
    hasItems: true,
    fields: [
      { key: 'position', label: 'Title' },
      { key: 'organization', label: 'Event / Venue' },
      { key: 'location', label: 'Location' },
      { key: 'date', label: 'Date' },
    ],
  },
  leadership: {
    latexType: 'cventries',
    label: 'Leadership',
    description: 'Leadership roles and responsibilities',
    category: 'roles',
    entryLabel: 'Role',
    itemLabel: 'Bullet',
    titleField: 'organization',
    titleFallback: 'position',
    hasItems: true,
    fields: [
      { key: 'position', label: 'Title' },
      { key: 'organization', label: 'Organization' },
      { key: 'location', label: 'Location' },
      { key: 'date', label: 'Date' },
    ],
  },
  volunteer: {
    latexType: 'cventries',
    label: 'Volunteer',
    description: 'Volunteer work and community service',
    category: 'roles',
    entryLabel: 'Role',
    itemLabel: 'Bullet',
    titleField: 'organization',
    titleFallback: 'position',
    hasItems: true,
    fields: roleFields,
  },
  committees: {
    latexType: 'cventries',
    label: 'Committees',
    description: 'Committee memberships and service',
    category: 'roles',
    entryLabel: 'Role',
    itemLabel: 'Bullet',
    titleField: 'organization',
    titleFallback: 'position',
    hasItems: true,
    fields: [
      { key: 'position', label: 'Role' },
      { key: 'organization', label: 'Committee' },
      { key: 'location', label: 'Location' },
      { key: 'date', label: 'Date' },
    ],
  },
  extracurricular: {
    latexType: 'cventries',
    label: 'Extracurricular',
    description: 'Activities outside work or academics',
    category: 'roles',
    entryLabel: 'Activity',
    itemLabel: 'Detail',
    titleField: 'organization',
    titleFallback: 'position',
    hasItems: true,
    fields: [
      { key: 'position', label: 'Activity' },
      { key: 'organization', label: 'Organization' },
      { key: 'location', label: 'Location' },
      { key: 'date', label: 'Date' },
    ],
  },
  writing: {
    latexType: 'cventries',
    label: 'Writing & Publications',
    description: 'Articles, papers, and written works',
    category: 'roles',
    entryLabel: 'Publication',
    itemLabel: 'Detail',
    titleField: 'organization',
    titleFallback: 'position',
    hasItems: true,
    fields: [
      { key: 'position', label: 'Title' },
      { key: 'organization', label: 'Publisher / Venue' },
      { key: 'location', label: 'URL / DOI' },
      { key: 'date', label: 'Date' },
    ],
  },
  skills: {
    latexType: 'cvskills',
    label: 'Skills',
    description: 'Skills grouped by category',
    category: 'other',
    entryLabel: 'Skill Group',
    titleField: 'category',
    fields: [
      { key: 'category', label: 'Category' },
      { key: 'skills', label: 'Skills' },
    ],
  },
  honors: {
    latexType: 'cvhonors',
    label: 'Honors & Awards',
    description: 'Awards, distinctions, and honors',
    category: 'achievements',
    entryLabel: 'Honor',
    titleField: 'award',
    fields: [
      { key: 'award', label: 'Award' },
      { key: 'issuer', label: 'Issuer' },
      { key: 'location', label: 'Location' },
      { key: 'date', label: 'Date' },
    ],
  },
  certifications: {
    latexType: 'cvhonors',
    label: 'Certifications',
    description: 'Professional certifications and licenses',
    category: 'achievements',
    entryLabel: 'Certification',
    titleField: 'award',
    fields: [
      { key: 'award', label: 'Certification' },
      { key: 'issuer', label: 'Issuer' },
      { key: 'location', label: 'Credential ID' },
      { key: 'date', label: 'Date' },
    ],
  },
  summary: {
    latexType: 'cvparagraph',
    label: 'Summary / Paragraph',
    description: 'Free-text paragraph block',
    category: 'other',
    isParagraph: true,
    fields: [{ key: 'text', label: 'Text' }],
  },
  references: {
    latexType: 'cvreferences',
    label: 'References',
    description: 'Professional references',
    category: 'other',
    entryLabel: 'Reference',
    titleField: 'name',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'relation', label: 'Relation' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
    ],
  },
};

export const VALID_SECTION_TYPES = Object.keys(SECTION_TYPES);

export function typeDef(type: string): SectionTypeDef | undefined {
  return SECTION_TYPES[type];
}

export function hasBullets(type: string): boolean {
  return !!SECTION_TYPES[type]?.hasItems;
}

/** Derive an entry's display title from its fields, per the type's titleField. */
export function entryTitle(type: string, fields: Record<string, string>): string {
  const t = SECTION_TYPES[type];
  if (!t || t.isParagraph) return '(untitled)';
  return (
    (t.titleField && fields[t.titleField]) ||
    (t.titleFallback && fields[t.titleFallback]) ||
    '(untitled)'
  );
}

/** The lead display value for an entry (usually `position`), applying any
 *  combine rule — e.g. education combines `program` + `major` into one line. */
export function entryLead(type: string, fields: Record<string, string>): string {
  const t = SECTION_TYPES[type];
  if (t?.combine) {
    const combined = t.combine.from
      .map((k) => fields[k])
      .filter(Boolean)
      .join(t.combine.join);
    if (combined) return combined;
  }
  return fields[t?.combine?.target ?? 'position'] ?? fields.position ?? '';
}

export function defaultFields(type: string): Record<string, string> {
  const t = SECTION_TYPES[type];
  const out: Record<string, string> = {};
  t?.fields.forEach((f) => (out[f.key] = ''));
  return out;
}

/** Grouped presets for the "Add section" picker. */
export function presetsByCategory() {
  const cats: Record<
    'roles' | 'achievements' | 'other',
    { key: string; label: string; description: string }[]
  > = {
    roles: [],
    achievements: [],
    other: [],
  };
  for (const [key, def] of Object.entries(SECTION_TYPES)) {
    cats[def.category].push({ key, label: def.label, description: def.description });
  }
  return cats;
}
