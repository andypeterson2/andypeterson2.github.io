// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCHEMA = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname!, '../docs/api-contract/schemas/telemetry-event.schema.json'),
    'utf-8',
  ),
) as {
  properties: Record<string, { enum?: string[]; maxLength?: number; description: string }>;
  required: string[];
};

// The store keeps ordered arrays, so a column's position is the contract. These two
// guard the failure that would otherwise pass every other check: a field added to the
// schema with no column, or a column moved under a name that already meant something.
describe('Telemetry column contract', () => {
  test('every schema field has exactly one column, and none has moved', async () => {
    const { BLOB_COLUMNS, DOUBLE_COLUMNS } = await import('../src/telemetry');

    // Pinned literally: reading them from the source would let a reorder agree with
    // itself. `app` is the store's index, so it holds no blob or double.
    expect(BLOB_COLUMNS).toEqual([
      'v',
      'event',
      'tier',
      'outcome',
      'variant',
      'detail',
      'release',
      'visit',
    ]);
    expect(DOUBLE_COLUMNS).toEqual(['value', 'a', 'b', 'n']);

    const placed = new Set<string>([...BLOB_COLUMNS, ...DOUBLE_COLUMNS, 'app']);
    const declared = Object.keys(SCHEMA.properties);
    expect([...declared].sort()).toEqual([...placed].sort());
  });

  test('the schema forbids any durable identifier', () => {
    const banned = ['jti', 'pass', 'email', 'user', 'ip', 'session', 'sid', 'client_id'];
    for (const field of Object.keys(SCHEMA.properties)) {
      expect(banned).not.toContain(field.toLowerCase());
    }
    // The one correlation key is documented as per-load and unstored.
    expect(SCHEMA.properties.visit!.description).toMatch(/per page load/i);
  });
});

describe('track()', () => {
  let sent: { url: string; body: Blob }[] = [];

  beforeEach(async () => {
    sent = [];
    vi.stubGlobal('navigator', {
      sendBeacon: (url: string, body: Blob) => {
        sent.push({ url, body });
        return true;
      },
    });
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function trackOne(event: Parameters<typeof import('../src/telemetry').track>[0]) {
    const { track } = await import('../src/telemetry');
    track(event);
    expect(sent).toHaveLength(1);
    return JSON.parse(await sent[0]!.body.text()) as Record<string, unknown>;
  }

  test('a sent event validates against the schema it is written to', async () => {
    const body = await trackOne({
      app: 'nonogram',
      event: 'run.done',
      tier: 'browser',
      outcome: 'ok',
      variant: 'clues',
      value: 0.3,
      a: 3,
      b: 3,
      n: 1,
    });

    for (const key of SCHEMA.required) expect(body).toHaveProperty(key);
    for (const [key, raw] of Object.entries(body)) {
      const rule = SCHEMA.properties[key];
      expect(rule, `${key} has no column`).toBeDefined();
      if (rule!.enum) expect(rule!.enum).toContain(raw);
      if (rule!.maxLength) expect(String(raw).length).toBeLessThanOrEqual(rule!.maxLength);
    }
  });

  test('the version and the visit key are added by the client, not the caller', async () => {
    const body = await trackOne({ app: 'portal', event: 'tier.change', tier: 'live' });
    expect(body.v).toBe(1);
    expect(typeof body.visit).toBe('string');
    expect(String(body.visit).length).toBeLessThanOrEqual(36);
  });

  test('the visit key is the same within a page load and different across one', async () => {
    const first = await trackOne({ app: 'portal', event: 'run.start', tier: 'browser' });
    const { track } = await import('../src/telemetry');
    track({ app: 'portal', event: 'run.done', tier: 'browser' });
    const second = JSON.parse(await sent[1]!.body.text()) as Record<string, unknown>;
    expect(second.visit).toBe(first.visit);

    // A fresh module is a fresh page load: nothing carried the old value over,
    // because nothing wrote it down.
    vi.resetModules();
    sent = [];
    const reloaded = await trackOne({ app: 'portal', event: 'run.start', tier: 'browser' });
    expect(reloaded.visit).not.toBe(first.visit);
  });

  test('it posts as a simple request, so a beacon never needs a preflight', async () => {
    await trackOne({ app: 'cv', event: 'run.done', tier: 'live' });
    expect(sent[0]!.url).toBe('https://api.andypeterson.dev/t');
    expect(sent[0]!.body.type).toBe('text/plain');
  });

  test('a browser with no beacon is not an error the page has to handle', async () => {
    vi.stubGlobal('navigator', {});
    vi.resetModules();
    const { track } = await import('../src/telemetry');
    expect(() => {
      track({ app: 'portal', event: 'run.start', tier: 'browser' });
    }).not.toThrow();
    expect(sent).toHaveLength(0);
  });
});
