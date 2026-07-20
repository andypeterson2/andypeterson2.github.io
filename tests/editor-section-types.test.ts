import { describe, test, expect } from 'vitest';
import {
  SECTION_TYPES,
  VALID_SECTION_TYPES,
  typeDef,
  hasBullets,
  entryTitle,
  entryLead,
  defaultFields,
  presetsByCategory,
} from '../src/editor/lib/section-types';

describe('section-types — registry lookups', () => {
  test('typeDef resolves a known type and returns undefined for an unknown one', () => {
    expect(typeDef('experience')).toBeDefined();
    expect(typeDef('not-a-type')).toBeUndefined();
  });

  test('VALID_SECTION_TYPES is the registry key set and covers the staples', () => {
    expect(VALID_SECTION_TYPES).toEqual(Object.keys(SECTION_TYPES));
    for (const t of ['experience', 'education', 'skills', 'summary']) {
      expect(VALID_SECTION_TYPES).toContain(t);
    }
  });

  test('hasBullets reflects the type (experience carries bullets)', () => {
    expect(hasBullets('experience')).toBe(true);
    expect(hasBullets('not-a-type')).toBe(false);
  });

  test('defaultFields returns every field key, blank', () => {
    const fields = defaultFields('experience');
    expect(Object.keys(fields).length).toBeGreaterThan(0);
    expect(Object.values(fields).every((v) => v === '')).toBe(true);
    expect(defaultFields('not-a-type')).toEqual({}); // undefined type → empty
  });
});

describe('section-types — display derivations', () => {
  test('entryTitle: a paragraph type and an empty entry both read "(untitled)"', () => {
    expect(entryTitle('summary', { text: 'anything' })).toBe('(untitled)'); // isParagraph
    expect(entryTitle('experience', {})).toBe('(untitled)'); // no title fields
  });

  test('entryTitle: a filled entry yields a real title', () => {
    expect(entryTitle('experience', { organization: 'Qualcomm', position: 'Intern' })).not.toBe(
      '(untitled)',
    );
  });

  test('entryLead: education combines its parts; experience falls back to position', () => {
    const edu = entryLead('education', { program: 'B.S.', major: 'Computer Science' });
    expect(edu).toContain('B.S.');
    expect(edu).toContain('Computer Science');
    expect(entryLead('experience', { position: 'Engineer' })).toBe('Engineer');
  });
});

describe('section-types — the Add-section picker groups', () => {
  test('presetsByCategory buckets every type into roles / achievements / other', () => {
    const cats = presetsByCategory();
    expect(Object.keys(cats).sort()).toEqual(['achievements', 'other', 'roles']);
    const total = cats.roles.length + cats.achievements.length + cats.other.length;
    expect(total).toBe(VALID_SECTION_TYPES.length); // every type is placed exactly once
    expect([...cats.roles, ...cats.achievements, ...cats.other].every((p) => p.key && p.label)).toBe(
      true,
    );
  });
});
