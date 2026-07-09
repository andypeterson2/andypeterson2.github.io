// The undo stack's reactive shell. Sequencing and coalescing live in ./undo;
// this file holds the runes and the one invariant that makes the whole thing safe:
// while an inverse is being applied, nothing it does may be recorded.
//
// Composed through an injected host, like the other slice controllers.
import { pushCommand, type NewCommand, type UndoCommand } from './undo';

export interface UndoHost {
  /** narrate through the editor's ONE aria-live region */
  announce(msg: string): void;
}

export class UndoController {
  past = $state.raw<UndoCommand[]>([]);
  future = $state.raw<UndoCommand[]>([]);
  /**
   * True while an inverse is running. Every command's undo/redo drives the same
   * public store methods a user's clicks do — and those methods record. Without
   * this guard, undoing would push a new command and the stack would never drain.
   */
  applying = $state(false);

  /**
   * Undo is per-profile: each profile's history is stashed here when you switch
   * away and restored when you come back, so glancing at another profile doesn't
   * throw away your work. Commands close over that profile's document objects, so
   * this is only sound as long as the store keeps those objects alive across the
   * switch (it caches the working tree rather than refetching — see store.selectPerson).
   */
  #scope = 'demo';
  #stashed = new Map<string, { past: UndoCommand[]; future: UndoCommand[] }>();

  constructor(private host: UndoHost) {}

  canUndo = $derived(this.past.length > 0 && !this.applying);
  canRedo = $derived(this.future.length > 0 && !this.applying);
  undoLabel = $derived(this.past[this.past.length - 1]?.label ?? '');
  redoLabel = $derived(this.future[this.future.length - 1]?.label ?? '');
  depth = $derived(this.past.length);

  record(cmd: NewCommand) {
    if (this.applying) return;
    this.past = pushCommand(this.past, { ...cmd, at: Date.now() });
    this.future = []; // a fresh action forks history; the old redo branch is gone
  }

  async undo() {
    await this.#step('past');
  }
  async redo() {
    await this.#step('future');
  }

  async #step(from: 'past' | 'future') {
    if (this.applying) return;
    const stack = from === 'past' ? this.past : this.future;
    const cmd = stack[stack.length - 1];
    if (!cmd) return;
    this.applying = true;
    try {
      await (from === 'past' ? cmd.undo() : cmd.redo());
    } finally {
      this.applying = false;
    }
    if (from === 'past') {
      this.past = this.past.slice(0, -1);
      this.future = [...this.future, cmd];
    } else {
      this.future = this.future.slice(0, -1);
      this.past = [...this.past, cmd];
    }
    this.host.announce(`${from === 'past' ? 'Undid' : 'Redid'} ${cmd.label.toLowerCase()}`);
  }

  /**
   * Drop the CURRENT scope's history. Called when a change lands that the scope
   * cannot be replayed across: the demo reset, or an operation whose inverse we
   * don't model (variant CRUD). Better to forget than to offer an "Undo" that
   * would write to a row that no longer exists.
   */
  clear() {
    this.past = [];
    this.future = [];
  }

  /**
   * Switch to a profile's history, stashing the current one first. A profile
   * seen for the first time starts empty; returning to one restores where you
   * left off. Keying is the caller's job (the store uses the person id).
   */
  setScope(key: string) {
    if (key === this.#scope) return;
    this.#stashed.set(this.#scope, { past: this.past, future: this.future });
    const restored = this.#stashed.get(key) ?? { past: [], future: [] };
    this.#scope = key;
    this.past = restored.past;
    this.future = restored.future;
  }

  /** Forget a profile's history entirely (it was deleted). */
  dropScope(key: string) {
    this.#stashed.delete(key);
    if (key === this.#scope) this.clear();
  }
}
