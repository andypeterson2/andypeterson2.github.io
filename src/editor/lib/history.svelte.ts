// Version history — increment 1 of the versioned CV store (ADR-006). A checkpoint
// is a snapshot of the whole document; the drawer lists them and can restore one.
//
// In the demo the list lives for the session only (the demo saves nothing —
// ADR-001), so history is in-memory. When connected it persists through the
// backend's /versions endpoints — the paired backend increment; until it ships,
// connected checkpoints are best-effort (a missing endpoint must not raise the
// save-error toast) and connected *restore* is a server operation, not a local
// swap: replacing the document locally would desync the backend (ADR-003).
//
// Restore is a *replace* of the working document, so like a demo reset or a
// profile switch it drops the undo history — the restored objects are fresh and
// the old stack can't be replayed against them (ADR-003 / ADR-004).
import { api } from './api';
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
}

export class HistoryController {
  /** checkpoints for the active document, newest first */
  versions = $state<Version[]>([]);
  /** true while a restore is settling — the list is inert until it finishes */
  restoring = $state(false);

  constructor(private host: HistoryHost) {}

  /** Load the active profile's checkpoints (connected only; demo keeps its in-memory list). */
  async load() {
    const pid = this.host.activePersonId();
    if (!this.host.connected() || pid == null) return;
    const res = await api.listVersions(pid);
    if (res.ok && res.data) {
      this.versions = res.data.versions
        .map((v) => ({ id: v.id, label: v.label ?? '', createdAt: v.createdAt, doc: v.doc }))
        .sort((a, b) => b.createdAt - a.createdAt);
    }
  }

  /** Capture the working document as a checkpoint. Safe in every mode — it only reads. */
  async snapshot(label = '') {
    const doc = this.host.capture();
    const version: Version = {
      id: this.host.nextId(),
      label: label.trim(),
      createdAt: Date.now(),
      doc,
    };
    this.versions = [version, ...this.versions];
    this.host.announce(version.label ? `Checkpoint “${version.label}” saved` : 'Checkpoint saved');
    const pid = this.host.activePersonId();
    if (!this.host.connected() || pid == null) return;
    // Best-effort persistence: the checkpoint already exists this session, so a
    // backend not yet serving /versions must not raise the save-error toast.
    const res = await api.commitVersion(pid, { label: version.label, doc });
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
        // Connected: restore is a server operation (a local swap would desync the
        // backend — ADR-003), then reload. Needs the backend increment's endpoint.
        const res = await api.restoreVersion(pid, id);
        if (res.ok) {
          await this.host.reload();
          this.host.announce(version.label ? `Restored “${version.label}”` : 'Checkpoint restored');
        } else {
          this.host.announce(
            'Restoring a connected profile needs the version backend (coming next).',
          );
        }
      } else {
        // Demo: swap the local document. A JSON round-trip clones the plain
        // document snapshot (structuredClone rejects the reactive-snapshot shape)
        // so the stored checkpoint stays pristine — restorable again, never
        // aliased to the now-live tree.
        this.host.apply(JSON.parse(JSON.stringify(version.doc)) as Person);
        this.host.announce(version.label ? `Restored “${version.label}”` : 'Checkpoint restored');
      }
    } finally {
      this.restoring = false;
    }
  }

  /** Forget the list — the document was replaced (profile switch / demo reset). */
  clear() {
    this.versions = [];
  }
}
