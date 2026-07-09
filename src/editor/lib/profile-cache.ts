import type { Person } from './types';

/**
 * Working trees of the profiles visited this session, kept alive so switching away
 * and back preserves both the document and its undo history — reuse, don't refetch.
 * A refetch would rebuild every object and strand the undo commands (which hold
 * those objects by identity).
 *
 * CACHE THE PROXY, NOT THE RAW. Store `editor.person` — the Svelte `$state` proxy —
 * not the raw fetched object: nested edits write through the proxy and the raw
 * stays pristine, so a raw cache would render the profile unedited on return (a
 * real bug this once hid until a route-call counter proved the refetch never fired).
 */
export class ProfileCache {
  #trees = new Map<number, Person>();

  get(pid: number): Person | undefined {
    return this.#trees.get(pid);
  }
  set(pid: number, tree: Person): void {
    this.#trees.set(pid, tree);
  }
  drop(pid: number): void {
    this.#trees.delete(pid);
  }
}
