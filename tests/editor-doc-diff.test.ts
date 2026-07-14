import { describe, test, expect } from 'vitest';
import { diffDocuments, entryLabel } from '../src/editor/lib/diff';
import type { Person, Entry } from '../src/editor/lib/types';

// A tiny document builder — ids are explicit so the diff can match by identity.
function doc(over: Partial<Person> = {}): Person {
  return {
    id: 1,
    name: 'Ada',
    personal: { firstName: 'Ada', position: 'Engineer' },
    sections: [
      {
        id: 10,
        type: 'experience',
        title: 'Experience',
        entries: [
          {
            id: 100,
            fields: { position: 'Engineer', organization: 'Acme' },
            items: [
              { id: 1000, content: 'Built the frontend', tags: [] },
              { id: 1001, content: 'Built the backend', tags: [] },
            ],
            tags: [],
          },
        ],
      },
    ],
    variants: [],
    coverletter: {},
    ...over,
  };
}

// deep clone so edits don't alias the original
const clone = (p: Person): Person => JSON.parse(JSON.stringify(p));

describe('diffDocuments', () => {
  test('identical documents diff to empty', () => {
    const d = diffDocuments(doc(), doc());
    expect(d.empty).toBe(true);
    expect(d.sections).toHaveLength(0);
    expect(d.personal).toHaveLength(0);
    expect(d.counts).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  test('a changed personal field is reported with from/to', () => {
    const b = clone(doc());
    b.personal.position = 'Senior Engineer';
    const d = diffDocuments(doc(), b);
    expect(d.empty).toBe(false);
    expect(d.personal).toEqual([{ key: 'position', from: 'Engineer', to: 'Senior Engineer' }]);
    expect(d.counts.changed).toBe(1);
  });

  test('a changed entry field surfaces under its section', () => {
    const b = clone(doc());
    b.sections[0].entries[0].fields.position = 'Staff Engineer';
    const d = diffDocuments(doc(), b);
    expect(d.sections).toHaveLength(1);
    const entry = d.sections[0].entries[0];
    expect(entry.kind).toBe('changed');
    expect(entry.fields).toEqual([{ key: 'position', from: 'Engineer', to: 'Staff Engineer' }]);
  });

  test('an added bullet is detected', () => {
    const b = clone(doc());
    b.sections[0].entries[0].items.push({ id: 1002, content: 'Mentored the team', tags: [] });
    const d = diffDocuments(doc(), b);
    const items = d.sections[0].entries[0].items;
    expect(items).toContainEqual({ kind: 'added', id: 1002, from: '', to: 'Mentored the team' });
    expect(d.counts.added).toBe(1);
  });

  test('a removed bullet is detected', () => {
    const b = clone(doc());
    b.sections[0].entries[0].items = b.sections[0].entries[0].items.filter((i) => i.id !== 1001);
    const d = diffDocuments(doc(), b);
    const items = d.sections[0].entries[0].items;
    expect(items).toContainEqual({ kind: 'removed', id: 1001, from: 'Built the backend', to: '' });
    expect(d.counts.removed).toBe(1);
  });

  test('a changed bullet carries both texts', () => {
    const b = clone(doc());
    b.sections[0].entries[0].items[0].content = 'Rebuilt the frontend';
    const d = diffDocuments(doc(), b);
    expect(d.sections[0].entries[0].items).toContainEqual({
      kind: 'changed',
      id: 1000,
      from: 'Built the frontend',
      to: 'Rebuilt the frontend',
    });
  });

  test('an added entry and an added section are detected', () => {
    const b = clone(doc());
    b.sections[0].entries.push({ id: 101, fields: { position: 'Intern' }, items: [], tags: [] });
    b.sections.push({ id: 11, type: 'skills', title: 'Skills', entries: [{ id: 200, fields: { category: 'Langs' }, items: [], tags: [] }] });
    const d = diffDocuments(doc(), b);
    const changedSec = d.sections.find((s) => s.id === 10)!;
    expect(changedSec.entries).toContainEqual(expect.objectContaining({ kind: 'added', id: 101 }));
    const addedSec = d.sections.find((s) => s.id === 11)!;
    expect(addedSec.kind).toBe('added');
    expect(addedSec.entries[0].kind).toBe('added');
  });

  test('a removed entry and a removed section are detected', () => {
    const base = doc();
    const b = clone(base);
    b.sections = []; // drop everything
    const d = diffDocuments(base, b);
    expect(d.sections).toHaveLength(1);
    expect(d.sections[0].kind).toBe('removed');
    expect(d.sections[0].entries[0].kind).toBe('removed');
    expect(d.counts.removed).toBeGreaterThan(0);
  });

  test('matches by id — a reordered but unchanged entry is not a change', () => {
    const b = clone(doc());
    b.sections[0].entries.reverse?.(); // one entry, but exercise the ordering path
    const d = diffDocuments(doc(), b);
    expect(d.empty).toBe(true);
  });
});

describe('entryLabel', () => {
  test('prefers position · organization', () => {
    const e: Entry = { id: 1, fields: { position: 'Engineer', organization: 'Acme' }, items: [], tags: [] };
    expect(entryLabel(e)).toBe('Engineer · Acme');
  });
  test('falls back through title / category / id', () => {
    expect(entryLabel({ id: 2, fields: { category: 'Languages' }, items: [], tags: [] })).toBe('Languages');
    expect(entryLabel({ id: 3, fields: {}, items: [], tags: [] })).toBe('entry #3');
  });
});
