// The shared save/persistence infra that every slice-controller needs from the
// editor core (tech-debt #11). EditorState supplies one `SaveHost` object and
// each controller's host extends it with the slice-specific reads it needs, so
// the coupling to the store is named and typed in one place instead of being
// re-declared per controller.

import type { NewCommand } from './undo';
import type { ApiResult } from './api';

export interface SaveHost {
  /** live "is the backend connected" flag — the guard before any persist */
  connected(): boolean;
  /** next client-side id for an optimistically-created node */
  nextId(): number;
  /** flag unsaved edits */
  markDirty(): void;
  /**
   * Show "saving…" immediately, before a debounced write actually fires — so the
   * indicator doesn't claim "saved" while an edit is still pending. Always paired
   * with the scheduled `persist` that settles it; never used alone.
   */
  setSaving(): void;
  /**
   * Run a backend write and resolve the save indicator from its result — the ONE
   * place "saving…" is paired with a settle, so a mutation can't forget to clear
   * it and hang forever (it even settles if `op` throws). A no-op that reports
   * success when offline: demo edits don't persist. Returns the full result so a
   * create can read `data` to reconcile its temp id. Pass `retry` only for
   * idempotent ops — re-running a create would orphan a second row.
   */
  persist<T>(op: () => Promise<ApiResult<T>>, retry?: () => void): Promise<ApiResult<T>>;
  /** debounce a keyed callback (field autosave) */
  debounce(key: string, fn: () => void): void;
  /** announce a message to the aria-live region (screen readers) */
  announce(msg: string): void;
  /** record an undoable command; a no-op while an inverse is being applied */
  record(cmd: NewCommand): void;
  /** forget the undo history — the stack cannot be replayed across this change */
  forgetHistory(): void;
}
