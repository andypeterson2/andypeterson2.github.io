/* exported SECTION_TYPES, VALID_SECTION_TYPES, DEGREE_PROGRAMS, getSectionTitle, getSectionTitleField, getDefaultFields, getLatexType, getPresetsByCategory */

var DEGREE_PROGRAMS = [
  '', 'B.S.', 'B.A.', 'B.F.A.', 'B.E.', 'B.B.A.',
  'M.S.', 'M.A.', 'M.F.A.', 'M.E.', 'M.B.A.',
  'Ph.D.', 'Ed.D.', 'J.D.', 'M.D.', 'D.O.',
  'A.S.', 'A.A.', 'A.A.S.',
];

var SECTION_TYPES = {
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
    fields: [
      { key: 'position', label: 'Position' },
      { key: 'organization', label: 'Organization' },
      { key: 'location', label: 'Location' },
      { key: 'date', label: 'Date' },
    ],
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
    fields: [
      { key: 'position', label: 'Role' },
      { key: 'organization', label: 'Organization' },
      { key: 'location', label: 'Location' },
      { key: 'date', label: 'Date' },
    ],
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

var VALID_SECTION_TYPES = Object.keys(SECTION_TYPES);

function getLatexType(type) {
  var t = SECTION_TYPES[type];
  return t ? t.latexType : type;
}

function getSectionTitle(type, fields) {
  var t = SECTION_TYPES[type];
  if (!t || t.isParagraph) return '(untitled)';
  return fields[t.titleField] || (t.titleFallback && fields[t.titleFallback]) || '(untitled)';
}

function getSectionTitleField(type) {
  var t = SECTION_TYPES[type];
  return t ? t.titleField : null;
}

function getDefaultFields(type) {
  var t = SECTION_TYPES[type];
  if (!t) return {};
  var defaults = {};
  t.fields.forEach(function (f) { defaults[f.key] = ''; });
  return defaults;
}

function getPresetsByCategory() {
  var categories = { roles: [], achievements: [], other: [] };
  for (var key in SECTION_TYPES) {
    var entry = SECTION_TYPES[key];
    var cat = entry.category || 'other';
    if (categories[cat]) {
      categories[cat].push({ key: key, label: entry.label, description: entry.description });
    }
  }
  return categories;
}
