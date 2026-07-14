// Version history — the versioned CV store (ADR-006). A checkpoint is a snapshot
// of the whole document. Increment 1: snapshot / restore / a History drawer.
// Increment 2: compare a checkpoint against the current document (a structural
// diff). Increment 3: branches (audience lines you fork and switch between), tags
// (frozen provenance names), and cherry-restore (lift one entry from a checkpoint).
//
// In the demo the list lives for the session only (the demo saves nothing —
// ADR-001), so history is in-memory. When connected it persists through the
// backend's /versions endpoints; a whole-document restore is a *server* operation,
// since a local swap would desync the backend (ADR-003).
//
// Restore replaces the working document, so like a demo reset or a profile switch
// it drops undo — the restored objects are fresh (ADR-003 / ADR-004).
import { api } from './api';
import { diffDocuments, type DocDiff } from './diff';
import type { SaveHost } from './host';
import type { Person } from './types';

/** A saved point in a document's history — a named (or untitled) checkpoint. */
export interface Version {
  id: number;
  /** the checkpoint's name, or '' for an untitled one */
  label: string;
  /** epoch ms the checkpoint was taken */
  createdAt: number;
  /** the whole document as it stood — a plain, independent snapshot */
  doc: Person;
  /** the audience line (branch) this checkpoint belongs to; 'main' by default */
  branch: string;
  /** the version this descends from — the provenance chain, if any */
  parent?: number;
  /** a frozen provenance name ("sent-to-google"), if tagged */
  tag?: string;
}

/** The shared save infra plus the reads/writes the history concern needs. */
export interface HistoryHost extends SaveHost {
  /** the active profile's id, or null in demo / the empty state */
  activePersonId(): number | null;
  /** a plain, independent snapshot of the working document */
  capture(): Person;
  /** replace the working document with a restored snapshot (drops undo) */
  apply(doc: Person): void;
  /** refetch the active profile from the backend, after a server-side restore */
  reload(): Promise<void>;
  /** cherry-restore: copy one entry (by id) from `source` onto the working document */
  applyEntry(source: Person, entryId: number): boolean;
}

export class HistoryController {
  /** checkpoints for the active document, newest first (across all branches) */
  versions = $state<Version[]>([]);
  /** true while a restore / switch is settling — the list is inert until it finishes */
  restoring = $state(false);
  /** the audience line currently being edited */
  currentBranch = $state('main');
  /** every branch name seen this session (seeded with main) */
  branches = $state<string[]>(['main']);

  /** the current branch's checkpoints, newest first — what the drawer lists */
  visible = $derived(this.versions.filter((v) => v.branch === this.currentBranch));

  constructor(private host: HistoryHost) {}

  /** the newest checkpoint on a branch (its tip) — versions are kept newest-first */
  #tip(branch: string): Version | undefined {
    return this.versions.find((v) => v.branch === branch);
  }

  /** Load the active profile's checkpoints (connected only; demo keeps its in-memory list). */
  async load() {
    const pid = this.host.activePersonId();
    if (!this.host.connected() || pid == null) return;
    const res = await api.listVersions(pid);
    if (res.ok && res.data) {
      this.versions = res.data.versions
        .map((v) => ({
          id: v.id,
          label: v.label ?? '',
          createdAt: v.createdAt,
          doc: v.doc,
          branch: v.branch || 'main',
          parent: v.parent ?? undefined,
          tag: v.tag ?? undefined,
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
      this.branches = [...new Set(['main', ...this.versions.map((v) => v.branch)])];
    }
  }

  /** Capture the working document as a checkpoint on the current branch. */
  async snapshot(label = '') {
    const doc = this.host.capture();
    const version: Version = {
      id: this.host.nextId(),
      label: label.trim(),
      createdAt: Date.now(),
      doc,
      branch: this.currentBranch,
      parent: this.#tip(this.currentBranch)?.id,
    };
    this.versions = [version, ...this.versions];
    this.host.announce(version.label ? `Checkpoint “${version.label}” saved` : 'Checkpoint saved');
    const pid = this.host.activePersonId();
    if (!this.host.connected() || pid == null) return;
    // Best-effort persistence — a backend not yet serving /versions must not toast.
    const res = await api.commitVersion(pid, {
      label: version.label,
      doc,
      branch: version.branch,
      parent: version.parent,
    });
    if (res.ok && res.data) version.id = res.data.id; // reconcile temp id → server id
  }

  /** Restore a checkpoint — replace the working document with its snapshot. */
  async restore(id: number) {
    if (this.restoring) return;
    const version = this.versions.find((v) => v.id === id);
    if (!version) return;
    this.restoring = true;
    try {
      const pid = this.host.activePersonId();
      if (this.host.connected() && pid != null) {
        const res = await api.restoreVersion(pid, id);
        if (res.ok) {
          await this.host.reload();
          this.currentBranch = version.branch;
          this.host.announce(version.label ? `Restored “${version.label}”` : 'Checkpoint restored');
        } else {
          this.host.announce(
            'Restoring a connected profile needs the version backend (coming next).',
          );
        }
      } else {
        // Demo: swap the local document (JSON clone keeps the stored checkpoint pristine).
        this.host.apply(JSON.parse(JSON.stringify(version.doc)) as Person);
        this.currentBranch = version.branch;
        this.host.announce(version.label ? `Restored “${version.label}”` : 'Checkpoint restored');
      }
    } finally {
      this.restoring = false;
    }
  }

  /**
   * Diff a checkpoint against the current document — "what changed since this
   * checkpoint." Uses the in-memory snapshot (demo); when connected and the doc
   * isn't loaded (the list omits the blob), fetch it. Null if it can't be resolved.
   */
  async compare(versionId: number): Promise<DocDiff | null> {
    const source = await this.#docFor(versionId);
    return source ? diffDocuments(source, this.host.capture()) : null;
  }

  /** Resolve a version's document — from memory (demo) or by fetching it (connected). */
  async #docFor(versionId: number): Promise<Person | undefined> {
    const version = this.versions.find((v) => v.id === versionId);
    if (!version) return undefined;
    let doc = version.doc as Person | undefined;
    if (!doc) {
      const pid = this.host.activePersonId();
      if (this.host.connected() && pid != null) {
        const res = await api.getVersion(pid, versionId);
        if (res.ok && res.data) doc = res.data.doc;
      }
    }
    return doc;
  }

  /** Tag a checkpoint with a frozen provenance name (or clear it with ''). */
  async tag(id: number, name: string) {
    const version = this.versions.find((v) => v.id === id);
    if (!version) return;
    version.tag = name.trim() || undefined;
    this.versions = [...this.versions]; // a member mutated — nudge the derived list
    this.host.announce(version.tag ? `Tagged “${version.tag}”` : 'Tag removed');
    const pid = this.host.activePersonId();
    if (this.host.connected() && pid != null) void api.tagVersion(pid, id, version.tag ?? '');
  }

  /** Fork a new audience line from the current document; switch onto it. */
  async fork(name: string) {
    const branch = name.trim();
    if (!branch || this.branches.includes(branch)) return;
    const doc = this.host.capture();
    const version: Version = {
      id: this.host.nextId(),
      label: `Forked from ${this.currentBranch}`,
      createdAt: Date.now(),
      doc,
      branch,
      parent: this.#tip(this.currentBranch)?.id,
    };
    this.versions = [version, ...this.versions];
    this.branches = [...this.branches, branch];
    this.currentBranch = branch;
    this.host.announce(`Forked branch “${branch}”`);
    const pid = this.host.activePersonId();
    if (this.host.connected() && pid != null) {
      const res = await api.commitVersion(pid, {
        label: version.label,
        doc,
        branch,
        parent: version.parent,
      });
      if (res.ok && res.data) version.id = res.data.id;
    }
  }

  /** Switch to another audience line — preserve current work, then restore its tip. */
  async switchTo(name: string) {
    if (name === this.currentBranch || this.restoring) return;
    const targetTip = this.#tip(name);
    if (!targetTip) return;
    // Don't lose uncommitted edits: if the working document has drifted from the
    // current branch's tip, checkpoint it here before leaving.
    const here = this.#tip(this.currentBranch);
    if (!here || !diffDocuments(here.doc, this.host.capture()).empty) {
      await this.snapshot('Auto-saved before switching');
    }
    await this.restore(targetTip.id); // sets currentBranch to the target's branch
  }

  /** Cherry-restore one entry from a checkpoint onto the current document. */
  async cherryRestore(versionId: number, entryId: number) {
    const source = await this.#docFor(versionId);
    if (!source) return;
    const ok = this.host.applyEntry(source, entryId);
    this.host.announce(
      ok ? 'Restored one entry from the checkpoint.' : 'Could not place that entry.',
    );
  }

  /** Forget the list — the document was replaced (profile switch / demo reset). */
  clear() {
    this.versions = [];
    this.currentBranch = 'main';
    this.branches = ['main'];
  }
}
