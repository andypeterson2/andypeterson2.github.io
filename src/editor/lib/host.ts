// The shared save/persistence infra that every slice-controller needs from the
// editor core (tech-debt #11). EditorState supplies one `SaveHost` object and
// each controller's host extends it with the slice-specific reads it needs, so
// the coupling to the store is named and typed in one place instead of being
// re-declared per controller.

import type { NewCommand } from './undo';

export interface SaveHost {
  /** live "is the backend connected" flag — the guard before any persist */
  connected(): boolean;
  /** next client-side id for an optimistically-created node */
  nextId(): number;
  /** flag unsaved edits */
  markDirty(): void;
  /** enter the "saving…" state */
  setSaving(): void;
  /** resolve a save: clear on success, raise the error toast on failure */
  settle(ok: boolean, retry?: () => void): void;
  /** debounce a keyed callback (field autosave) */
  debounce(key: string, fn: () => void): void;
  /** announce a message to the aria-live region (screen readers) */
  announce(msg: string): void;
  /** record an undoable command; a no-op while an inverse is being applied */
  record(cmd: NewCommand): void;
  /** forget the undo history — the stack cannot be replayed across this change */
  forgetHistory(): void;
}
