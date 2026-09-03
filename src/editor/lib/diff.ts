// Structural diff of two CV documents (ADR-006 increment 2). Compares two Person
// snapshots and reports what changed — added / removed / changed sections, entries,
// bullets, and personal fields — matched by *id*, so a moved or edited row reads as
// a change, not a delete-plus-re-add. Entity ids are stable across a snapshot's
// lineage (ADR-006), so this is a pure, id-based function, unit-testable without
// the store. It does not track identity across an id-renumbering restore — such a
// comparison reads as wholesale removed + added, which is honest if coarse.
import type { Person, Section, Entry, Item } from './types';

/**
 * A value AS STORED: version-history `doc` snapshots round-trip through the
 * backend as opaque JSON, so any nested field can be missing in old or
 * imported rows. The domain types in ./types.ts describe a live, fully-mapped
 * document; this wrapper describes what actually comes back — which is why
 * the null-guards throughout this module are load-bearing, not decorative.
 */
export type Stored<T> = T extends (infer U)[]
  ? Stored<U>[] | undefined
  : T extends object
    ? { [K in keyof T]?: Stored<T[K]> }
    : T | undefined;

export type ChangeKind = 'added' | 'removed' | 'changed';

/** One field's before/after — a personal field or an entry field. */
export interface FieldChange {
  key: string;
  from: string;
  to: string;
}

/** A bullet's change. `from`/`to` hold the content (one side empty for add/remove). */
export interface ItemDiff {
  kind: ChangeKind;
  id: number;
  from: string;
  to: string;
}

export interface EntryDiff {
  kind: ChangeKind;
  id: number;
  /** a readable one-line label (position · organization, a title, …) */
  label: string;
  /** changed fields — empty unless kind === 'changed' */
  fields: FieldChange[];
  /** added / removed / changed bullets */
  items: ItemDiff[];
}

export interface SectionDiff {
  kind: ChangeKind;
  id: number | string;
  title: string;
  entries: EntryDiff[];
}

export interface DocDiff {
  personal: FieldChange[];
  sections: SectionDiff[];
  counts: { added: number; removed: number; changed: number };
  /** true when the two documents are structurally identical. */
  empty: boolean;
}

const str = (v: string | null | undefined): string => v ?? '';

/** A readable one-line label for an entry, from whatever fields it carries. */
export function entryLabel(entry: Stored<Entry> & { id: number | string }): string {
  const f = entry.fields ?? {};
  const headline = [f.position, f.organization].filter(Boolean).join(' · ');
  return (
    headline ||
    f.title ||
    f.category ||
    f.name ||
    f.degree ||
    f.institution ||
    (f.text ? f.text.slice(0, 40) : '') ||
    `entry #${entry.id}`
  );
}

function diffFields(
  a: Stored<Record<string, string>> | undefined,
  b: Stored<Record<string, string>> | undefined,
): FieldChange[] {
  const out: FieldChange[] = [];
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const key of keys) {
    const from = str(a?.[key]);
    const to = str(b?.[key]);
    if (from !== to) out.push({ key, from, to });
  }
  return out;
}

/** Id-matching is the whole design (see header) — a stored row that lost its
 *  id cannot be matched and is skipped rather than colliding on `undefined`. */
function withIds<T extends { id?: unknown }>(
  rows: T[] | undefined,
): (T & { id: number | string })[] {
  return (rows ?? []).filter(
    (r): r is T & { id: number | string } => typeof r.id === 'number' || typeof r.id === 'string',
  );
}

function diffItems(aRaw: Stored<Item>[], bRaw: Stored<Item>[]): ItemDiff[] {
  const a = withIds(aRaw).filter((i): i is typeof i & { id: number } => typeof i.id === 'number');
  const b = withIds(bRaw).filter((i): i is typeof i & { id: number } => typeof i.id === 'number');
  const out: ItemDiff[] = [];
  const aById = new Map(a.map((i) => [i.id, i]));
  const bById = new Map(b.map((i) => [i.id, i]));
  for (const ia of a) {
    const ib = bById.get(ia.id);
    if (!ib) out.push({ kind: 'removed', id: ia.id, from: str(ia.content), to: '' });
    else if (str(ia.content) !== str(ib.content) || str(ia.title) !== str(ib.title))
      out.push({ kind: 'changed', id: ia.id, from: str(ia.content), to: str(ib.content) });
  }
  for (const ib of b) {
    if (!aById.has(ib.id)) out.push({ kind: 'added', id: ib.id, from: '', to: str(ib.content) });
  }
  return out;
}

function diffEntries(aRaw: Stored<Entry>[], bRaw: Stored<Entry>[]): EntryDiff[] {
  const a = withIds(aRaw).filter((e): e is typeof e & { id: number } => typeof e.id === 'number');
  const b = withIds(bRaw).filter((e): e is typeof e & { id: number } => typeof e.id === 'number');
  const out: EntryDiff[] = [];
  const aById = new Map(a.map((e) => [e.id, e]));
  const bById = new Map(b.map((e) => [e.id, e]));
  for (const ea of a) {
    const eb = bById.get(ea.id);
    if (!eb) {
      out.push({ kind: 'removed', id: ea.id, label: entryLabel(ea), fields: [], items: [] });
    } else {
      const fields = diffFields(ea.fields, eb.fields);
      const items = diffItems(ea.items ?? [], eb.items ?? []);
      if (fields.length || items.length)
        out.push({ kind: 'changed', id: ea.id, label: entryLabel(eb), fields, items });
    }
  }
  for (const eb of b) {
    if (!aById.has(eb.id))
      out.push({ kind: 'added', id: eb.id, label: entryLabel(eb), fields: [], items: [] });
  }
  return out;
}

const allEntries = (kind: ChangeKind, entries: Stored<Entry>[]): EntryDiff[] =>
  withIds(entries)
    .filter((e): e is typeof e & { id: number } => typeof e.id === 'number')
    .map((e) => ({ kind, id: e.id, label: entryLabel(e), fields: [], items: [] }));

function diffSections(aRaw: Stored<Section>[], bRaw: Stored<Section>[]): SectionDiff[] {
  const a = withIds(aRaw);
  const b = withIds(bRaw);
  const out: SectionDiff[] = [];
  const aById = new Map(a.map((s) => [s.id, s]));
  const bById = new Map(b.map((s) => [s.id, s]));
  for (const sa of a) {
    const sb = bById.get(sa.id);
    if (!sb) {
      out.push({
        kind: 'removed',
        id: sa.id,
        title: str(sa.title),
        entries: allEntries('removed', sa.entries ?? []),
      });
    } else {
      const entries = diffEntries(sa.entries ?? [], sb.entries ?? []);
      if (entries.length || str(sa.title) !== str(sb.title))
        out.push({ kind: 'changed', id: sa.id, title: str(sb.title), entries });
    }
  }
  for (const sb of b) {
    if (!aById.has(sb.id))
      out.push({
        kind: 'added',
        id: sb.id,
        title: str(sb.title),
        entries: allEntries('added', sb.entries ?? []),
      });
  }
  return out;
}

function tally(personal: FieldChange[], sections: SectionDiff[]): DocDiff['counts'] {
  let added = 0;
  let removed = 0;
  let changed = personal.length;
  const bump = (kind: ChangeKind, n = 1) => {
    if (kind === 'added') added += n;
    else if (kind === 'removed') removed += n;
    else changed += n;
  };
  for (const s of sections) {
    if (s.kind !== 'changed') {
      bump(s.kind, Math.max(1, s.entries.length));
      continue;
    }
    for (const e of s.entries) {
      if (e.kind !== 'changed') {
        bump(e.kind);
        continue;
      }
      changed += e.fields.length;
      for (const it of e.items) bump(it.kind);
    }
  }
  return { added, removed, changed };
}

/**
 * Diff two documents: what does it take to get from `base` to `target`? "Added"
 * means present in target but not base (created since the checkpoint); "removed"
 * the reverse. So `diffDocuments(checkpoint, current)` reads as "what changed since
 * this checkpoint."
 */
export function diffDocuments(base: Stored<Person>, target: Stored<Person>): DocDiff {
  const personal = diffFields(base.personal ?? {}, target.personal ?? {});
  const sections = diffSections(base.sections ?? [], target.sections ?? []);
  return {
    personal,
    sections,
    counts: tally(personal, sections),
    empty: personal.length === 0 && sections.length === 0,
  };
}
