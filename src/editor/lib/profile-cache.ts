import type { Profile } from './types';

/**
 * Working trees of the profiles visited this session, kept alive so switching away
 * and back preserves both the document and its undo history — reuse, don't refetch.
 * A refetch would rebuild every object and strand the undo commands (which hold
 * those objects by identity).
 *
 * Cache the proxy. Store `editor.profile` — the Svelte `$state` proxy —
 * not the raw fetched object: nested edits write through the proxy and the raw
 * stays pristine, so a raw cache would render the profile unedited on return (a
 * real bug this once hid until a route-call counter proved the refetch never fired).
 */
export class ProfileCache {
  #trees = new Map<number, Profile>();

  get(pid: number): Profile | undefined {
    return this.#trees.get(pid);
  }
  set(pid: number, tree: Profile): void {
    this.#trees.set(pid, tree);
  }
  drop(pid: number): void {
    this.#trees.delete(pid);
  }
}
