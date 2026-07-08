/**
 * Unit tests for the client-side JSON exporter (src/editor/lib/export.ts).
 * It must produce the cv backend's import-compatible shape (id-less, positional,
 * LaTeX-escaped) so an offline/demo export re-imports losslessly.
 */
import { describe, test, expect } from 'vitest';
import { buildExport } from '../src/editor/lib/export';
import type { Person, Variant } from '../src/editor/lib/types';

function person(over: Partial<Person> = {}): Person {
  return { id: 1, name: 'Ada', personal: {}, sections: [], variants: [], coverletter: {}, ...over };
}

describe('buildExport', () => {
  test('produces an id-less, positional tree with LaTeX-escaped text', () => {
    const doc = buildExport(
      person({
        personal: { firstName: 'Ada', address: '50% Analytical Rd' },
        sections: [
          {
            id: 5,
            slug: 'experience',
            type: 'experience',
            title: 'Experience',
            entries: [
              {
                id: 11,
                fields: { position: 'Lead 50%', organization: 'R&D' },
                tags: ['x'],
                items: [{ id: 100, title: 'Note', content: 'cut cost 60%', tags: ['y'] }],
              },
            ],
          },
        ],
      }),
      () => [],
    );

    expect(doc.sections[0]).toMatchObject({ slug: 'experience', type: 'experience', sortOrder: 0 });
    expect('id' in doc.sections[0]).toBe(false);
    expect('id' in doc.sections[0].entries[0]).toBe(false);
    // Display text is re-escaped for the backend.
    expect(doc.personal.address).toBe('50\\% Analytical Rd');
    expect(doc.sections[0].entries[0].fields.position).toBe('Lead 50\\%');
    expect(doc.sections[0].entries[0].fields.organization).toBe('R\\&D');
    expect(doc.sections[0].entries[0].items[0].content).toBe('cut cost 60\\%');
    expect(doc.sections[0].entries[0].tags).toEqual(['x']);
  });

  test('coverletter variants carry escaped letterSections; cv variants do not', () => {
    const cv: Variant = {
      id: 1,
      name: 'CV',
      kind: 'cv',
      rules: { include: [], exclude: [] },
      sections: [],
    };
    const cl: Variant = {
      id: 2,
      name: 'Letter',
      kind: 'coverletter',
      rules: { include: [], exclude: [] },
      sections: [],
    };
    const doc = buildExport(
      person({ variants: [cv, cl], coverletter: { opening: 'Dear R&D,' } }),
      (v) => (v.id === 2 ? [{ id: 9, title: '', body: 'saved 50% time' }] : []),
      (v) => (v.id === 2 ? { recipientName: 'Acme R&D' } : {}),
    );
    expect(doc.coverletter.opening).toBe('Dear R\\&D,'); // person-level header kept (expand compat)
    expect(doc.variants[0].letterSections).toBeUndefined();
    expect(doc.variants[0].header).toBeUndefined(); // cv variant has no header
    expect(doc.variants[1].letterSections).toEqual([{ title: '', body: 'saved 50\\% time' }]);
    expect(doc.variants[1].header).toEqual({ recipientName: 'Acme R\\&D' }); // per-variant, escaped
  });

  test('falls back to the CV name when the person has no label', () => {
    const doc = buildExport(
      person({ name: '', personal: { firstName: 'Grace', lastName: 'Hopper' } }),
      () => [],
      () => ({}),
    );
    expect(doc.name).toBe('Grace Hopper');
  });
});
