// The undo stack's pure core — the command contract, coalescing, depth cap, and
// the field-shadow that makes an "old value" recoverable at all.
//
// Runes-free so vitest can reach it (no Svelte plugin here); the reactive shell
// is undo.svelte.ts, and the commands themselves are minted by the store.
//
// WHY A SHADOW. Components bind straight to state (`bind:value={entry.fields.x}`)
// and only then call `editor.saveEntry(entry)`. By the time the store hears about
// an edit, the previous value is gone. So we keep a copy of what we last recorded
// for each object and diff against it.
//
// The shadow is keyed by OBJECT IDENTITY, never by id: undoing a delete re-creates
// the row and the server hands back a *new* id, while the JS object survives. Ids
// churn; identities don't.
import type { Person } from './types';

export interface UndoCommand {
  /** shown in the Edit menu: "Undo Position" */
  label: string;
  /** same key within COALESCE_MS → one command, so typing undoes as a burst */
  mergeKey?: string;
  /** epoch ms, for the coalescing window */
  at: number;
  undo(): void | Promise<void>;
  redo(): void | Promise<void>;
}

/** A command before the stack timestamps it. */
export type NewCommand = Omit<UndoCommand, 'at'>;

/** Deep enough to cover a session's editing; shallow enough to stay cheap. */
export const MAX_DEPTH = 60;
/** Keystrokes closer together than this collapse into one undoable burst. */
export const COALESCE_MS = 900;

export function canMerge(
  top: UndoCommand | undefined,
  next: NewCommand & { at: number },
  windowMs = COALESCE_MS,
): boolean {
  if (!top || !next.mergeKey || top.mergeKey !== next.mergeKey) return false;
  const gap = next.at - top.at;
  return gap >= 0 && gap <= windowMs;
}

/**
 * Fold `next` into `top`: keep the OLDER undo (the value before the burst began)
 * and the NEWER redo. Undoing a typed word must restore what preceded the word,
 * not the second-to-last keystroke.
 */
export function merge(top: UndoCommand, next: UndoCommand): UndoCommand {
  return { ...next, undo: top.undo };
}

/** Append (or coalesce) onto the stack, dropping the oldest past MAX_DEPTH. */
export function pushCommand(
  stack: UndoCommand[],
  next: UndoCommand,
  max = MAX_DEPTH,
  windowMs = COALESCE_MS,
): UndoCommand[] {
  const top = stack[stack.length - 1];
  const out = canMerge(top, next, windowMs)
    ? [...stack.slice(0, -1), merge(top, next)]
    : [...stack, next];
  return out.length > max ? out.slice(out.length - max) : out;
}

/** "firstName" → "First name". The Edit menu reads "Undo First name". */
export function humanize(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) return 'Edit';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

// ---- the field shadow ----

export type Shadow = WeakMap<object, Record<string, string>>;
export type Fields = Record<string, string | undefined>;

/** Remember an object's current values, so the next edit knows what it replaced. */
export function seedShadow(shadow: Shadow, obj: object, fields: Fields): void {
  const snap: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) snap[k] = v ?? '';
  shadow.set(obj, snap);
}

export interface FieldChange {
  key: string;
  old: string;
  next: string;
}

/**
 * Which single field changed since we last looked, and what it held before.
 * Updates the shadow as a side effect. An unseeded object is seeded and reports
 * no change — we cannot invent a previous value we never saw.
 */
export function fieldDiff(shadow: Shadow, obj: object, fields: Fields): FieldChange | null {
  const prev = shadow.get(obj);
  if (!prev) {
    seedShadow(shadow, obj, fields);
    return null;
  }
  for (const key of Object.keys(fields)) {
    const next = fields[key] ?? '';
    const old = prev[key] ?? '';
    if (old !== next) {
      prev[key] = next;
      return { key, old, next };
    }
  }
  return null;
}

/** Keep the shadow in step when a command writes a value back. */
export function patchShadow(shadow: Shadow, obj: object, key: string, value: string): void {
  const snap = shadow.get(obj);
  if (snap) snap[key] = value;
}

/**
 * The field-shadow as one object, so the store and the letter controller don't
 * each carry the same WeakMaps and seeding loops. Wraps the primitives above plus
 * the coalescing `uid` counter. Pure (WeakMaps, no runes) — unit-tested directly.
 */
export class FieldShadow {
  #shadow: Shadow = new WeakMap();
  #uids = new WeakMap<object, number>();
  #uidSeq = 0;

  /** A stable per-object key for coalescing merge-keys (ids move; identity doesn't). */
  uid(obj: object): number {
    let u = this.#uids.get(obj);
    if (u == null) {
      u = ++this.#uidSeq;
      this.#uids.set(obj, u);
    }
    return u;
  }

  /** Which field changed since last seen, and its old value (advances the shadow). */
  diff(obj: object, fields: Fields): FieldChange | null {
    return fieldDiff(this.#shadow, obj, fields);
  }

  /** Snapshot an object's current values as the new baseline. */
  seed(obj: object, fields: Fields): void {
    seedShadow(this.#shadow, obj, fields);
  }

  /** Seed a bullet (its two text fields). */
  seedItem(item: { title?: string; content: string }): void {
    this.seed(item, { title: item.title ?? '', content: item.content });
  }

  /** Keep the shadow in step when a command writes a value back. */
  patch(obj: object, key: string, value: string): void {
    patchShadow(this.#shadow, obj, key, value);
  }

  /** Re-seed a whole document + the global style object — a fresh set of objects. */
  reseat(person: Person, style: Record<string, string>): void {
    this.seed(person.personal, person.personal as Record<string, string>);
    this.seed(style, style);
    for (const section of person.sections)
      for (const entry of section.entries) {
        this.seed(entry, entry.fields);
        for (const item of entry.items) this.seedItem(item);
      }
  }
}
