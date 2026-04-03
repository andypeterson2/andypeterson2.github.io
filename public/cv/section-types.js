/* exported SECTION_TYPES, VALID_SECTION_TYPES, getSectionTitle, getSectionTitleField, getDefaultFields */
var SECTION_TYPES = {
  cventries: {
    label: 'CV Entry',
    entryLabel: 'Entry',
    itemLabel: 'Bullet',
    titleField: 'organization',
    titleFallback: 'position',
    fields: [
      { key: 'position', label: 'Position' },
      { key: 'organization', label: 'Organization' },
      { key: 'location', label: 'Location' },
      { key: 'date', label: 'Date' },
    ],
    hasItems: true,
  },
  cvskills: {
    label: 'Skills',
    entryLabel: 'Entry',
    titleField: 'category',
    fields: [
      { key: 'category', label: 'Category' },
      { key: 'skills', label: 'Skills' },
    ],
  },
  cvhonors: {
    label: 'Honors',
    entryLabel: 'Entry',
    titleField: 'award',
    fields: [
      { key: 'award', label: 'Award' },
      { key: 'issuer', label: 'Issuer' },
      { key: 'location', label: 'Location' },
      { key: 'date', label: 'Date' },
    ],
  },
  cvreferences: {
    label: 'References',
    entryLabel: 'Entry',
    titleField: 'name',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'relation', label: 'Relation' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
    ],
  },
  cvparagraph: {
    label: 'Paragraph',
    isParagraph: true,
    fields: [{ key: 'text', label: 'Text' }],
  },
};

var VALID_SECTION_TYPES = Object.keys(SECTION_TYPES);

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
