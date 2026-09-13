// Carry a visitor's demo edits across the Google sign-in redirect (audit C1).
//
// The demo is local-only, and sign-in is a same-tab redirect, so without this the
// editor's one call to action ("Sign in … to save") threw the visitor's work away.
// Before redirecting we stash the edited demo as the same import-compatible tree the
// Export button produces; after sign-in the store offers to import it as a profile
// of the visitor's own (POST /persons/:pid/import).
//
// sessionStorage, not localStorage: it survives the round trip in this tab and dies
// with the tab, so a half-finished demo never haunts a later visit or another person
// on a shared machine. Stale stashes (older than an hour) are ignored.
import type { ExportDoc } from './export';

const KEY = 'cv.demoDraft.v1';
const MAX_AGE_MS = 60 * 60 * 1000;

interface Stash {
  savedAt: number;
  doc: ExportDoc;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): StorageLike | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null; // blocked storage (privacy mode, sandbox) — callers fall back to a confirm
  }
}

/** Stash the demo tree. Returns false when it can't be kept (the caller should warn). */
export function stashDemoDraft(doc: ExportDoc, now = Date.now(), store = storage()): boolean {
  if (!store) return false;
  try {
    store.setItem(KEY, JSON.stringify({ savedAt: now, doc } satisfies Stash));
    return true;
  } catch {
    return false; // quota or blocked
  }
}

/** The stashed demo tree, if there is a fresh one. Does not remove it. */
export function peekDemoDraft(now = Date.now(), store = storage()): ExportDoc | null {
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Stash>;
    if (typeof s.savedAt !== 'number' || !s.doc || typeof s.doc !== 'object') return null;
    if (now - s.savedAt > MAX_AGE_MS) return null;
    return s.doc;
  } catch {
    return null;
  }
}

export function clearDemoDraft(store = storage()): void {
  try {
    store?.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * The demo is the site owner's own résumé, with their public contacts overlaid.
 * When a visitor takes it into their account, the contact header becomes theirs:
 * their name and email from the signed-in identity, and the owner's handles dropped.
 * Everything they edited in the body is kept as-is.
 */
export function forNewOwner(
  doc: ExportDoc,
  identity: { name: string | null; email: string | null },
): ExportDoc {
  const [firstName = '', ...rest] = (identity.name ?? '').trim().split(/\s+/);
  const OWNER_CONTACT = [
    'firstName',
    'lastName',
    'email',
    'github',
    'linkedin',
    'homepage',
    'phone',
  ];
  const personal: Record<string, string> = Object.fromEntries(
    Object.entries(doc.personal).filter(([k]) => !OWNER_CONTACT.includes(k)),
  );
  if (firstName) personal.firstName = firstName;
  if (rest.length) personal.lastName = rest.join(' ');
  if (identity.email) personal.email = identity.email;
  return {
    ...doc,
    name: identity.name?.trim() ? `${identity.name.trim()} (from demo)` : 'My résumé (from demo)',
    personal,
  };
}
