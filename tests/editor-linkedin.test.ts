/**
 * The editor's LinkedIn export, against data shaped like a resolved variant with
 * LaTeX artifacts included: role = fields.position, company = fields.organization.
 * Mirrors the cv backend's own suite, so the two transforms stay in step.
 */
import { describe, test, expect } from 'vitest';
import { exportLinkedin, clean, parseRange } from '../src/editor/lib/linkedin';
import type { Section } from '../src/editor/lib/types';

const entry = (id: number, fields: Record<string, string>, items: string[]) => ({
  id,
  fields,
  tags: [],
  items: items.map((content, i) => ({ id: id * 10 + i, content, title: '', tags: [] })),
});

// A non-experience section first (it must be skipped), then experience entries with
// dates and LaTeX (`---`, `\%`, no `title` field — the company is `organization`).
const SECTIONS = [
  {
    id: 1,
    type: 'summary',
    title: 'Summary',
    entries: [entry(1, { text: 'Ignore me.' }, [])],
  },
  {
    id: 2,
    type: 'experience',
    title: 'Experience',
    entries: [
      entry(
        101,
        {
          date: 'July 2022 -- December 2024',
          location: 'Springfield, IL',
          organization: 'Example Research Lab',
          position: 'Research Assistant',
        },
        [
          'Designed a signaling server (Python/Flask, Socket.IO) with cryptographic room assignment',
          'Built two solver implementations --- brute force and backtracking search --- for comparison',
        ],
      ),
      entry(
        102,
        {
          date: 'August 2020 -- May 2022',
          location: 'Remote',
          organization: 'Example Gaming Club',
          position: 'Web Developer',
        },
        ['Maintained 99.9\\% uptime on a web server behind an Nginx reverse proxy'],
      ),
    ],
  },
] as unknown as Section[];

describe('exportLinkedin — mapping and shape', () => {
  test('reads only the experience section, one block per entry', async () => {
    const { positions } = await exportLinkedin(SECTIONS, null);
    expect(positions).toHaveLength(2);
    expect(positions.map((p) => p.entryId)).toEqual([101, 102]);
  });

  test('role comes from fields.position, company from fields.organization', async () => {
    const { positions } = await exportLinkedin(SECTIONS, null);
    expect(positions[0].title).toBe('Research Assistant');
    expect(positions[0].company).toBe('Example Research Lab');
    expect(positions[0].location).toBe('Springfield, IL');
  });

  test('full month names and a LaTeX range become {month, year}', async () => {
    const { positions } = await exportLinkedin(SECTIONS, null);
    expect(positions[0].start).toEqual({ month: 7, year: 2022 });
    expect(positions[0].end).toEqual({ month: 12, year: 2024 });
  });

  test('descriptions are cleaned and bulleted, with no LaTeX left in them', async () => {
    const { positions } = await exportLinkedin(SECTIONS, null);
    expect(positions[0].description).toContain('• Designed a signaling server');
    expect(positions[0].description).toContain('—'); // --- became an em dash
    expect(positions[1].description).toBe(
      '• Maintained 99.9% uptime on a web server behind an Nginx reverse proxy',
    );
    expect(positions[1].description).not.toContain('\\');
    expect(positions[0].overLimit).toBe(false);
  });
});

describe('exportLinkedin — the fingerprint', () => {
  test('holds across calls, and across the bullet glyph', async () => {
    const a = await exportLinkedin(SECTIONS, null);
    const b = await exportLinkedin(SECTIONS, null, 'markdown');
    expect(a.positions[0].fingerprint).toBe(b.positions[0].fingerprint);
  });

  test('moves when a bullet actually changes', async () => {
    const before = await exportLinkedin(SECTIONS, null);
    const edited = structuredClone(SECTIONS);
    edited[1].entries[0].items[0].content = 'Something else entirely';
    const after = await exportLinkedin(edited, null);
    expect(after.positions[0].fingerprint).not.toBe(before.positions[0].fingerprint);
  });
});

// The fingerprints the cv backend's own transform produces for the fixture above.
// They are what tells a later run which positions have drifted, so the two
// implementations have to agree digit for digit or the drift report lies.
describe('exportLinkedin — parity with the cv backend', () => {
  test('fingerprints match the ones the server computes', async () => {
    const { positions } = await exportLinkedin(SECTIONS, null);
    expect(positions.map((p) => p.fingerprint)).toEqual([
      '64ac7b4d37a26354b8d7892bcbfb7819b05fe1662c4669dd55bb85bc9f34cc58',
      'cd3062a6e47cdd6f736cc7599da77035b4e62b57c33f45da0ff13053cc2860d5',
    ]);
  });
});

describe('exportLinkedin — formats', () => {
  test('plaintext drops the glyph; markdown uses a dash', async () => {
    const plain = await exportLinkedin(SECTIONS, null, 'plaintext');
    const md = await exportLinkedin(SECTIONS, null, 'markdown');
    expect(plain.positions[1].description.startsWith('Maintained')).toBe(true);
    expect(md.positions[1].description.startsWith('- Maintained')).toBe(true);
  });
});

describe('parseRange and clean', () => {
  test('a year-only range leaves the month for the paster to pick', () => {
    expect(parseRange('2019 -- 2021')).toEqual({
      start: { month: null, year: 2019 },
      end: { month: null, year: 2021 },
    });
  });

  test('"Present" is an open end, meaning still there', () => {
    expect(parseRange('June 2023 -- Present').end).toBeNull();
  });

  test('a lone date is an open-ended start', () => {
    expect(parseRange('June 2023')).toEqual({ start: { month: 6, year: 2023 }, end: null });
  });

  test('clean turns the arrow macro into a glyph', () => {
    expect(clean('latency \\textrightarrow{} throughput')).toBe('latency → throughput');
  });
});
