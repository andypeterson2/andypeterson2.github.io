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
   * Drop the whole history. Called when a change lands that the stack cannot be
   * replayed across: a different profile loaded, the demo reset, or an operation
   * whose inverse we don't model (variant and profile CRUD). Better to forget
   * than to offer an "Undo" that would write to a row that no longer exists.
   */
  clear() {
    this.past = [];
    this.future = [];
  }
}
