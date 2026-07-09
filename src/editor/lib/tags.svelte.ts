// The tags concern — the entry/bullet tag CRUD, the spotlight, and the derived
// tag vocabulary — lifted out of EditorState (tech-debt #11). The tag mutations
// need nothing beyond the shared SaveHost (they operate on the entry/item passed
// in); only the vocabulary needs to read the document, which it does through the
// host's `sections()`.
import { api } from './api';
import type { SaveHost } from './host';
import type { Entry, Item, Section } from './types';

/** The shared save infra plus the one read the tag vocabulary needs. */
export interface TagHost extends SaveHost {
  sections(): Section[];
}

export class TagController {
  /** a tag to spotlight — entries without it dim in the document. */
  highlight = $state<string | null>(null);

  constructor(private host: TagHost) {}

  /** the profile's tag vocabulary with usage counts (derived from content). */
  vocab = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const s of this.host.sections()) {
      for (const e of s.entries) {
        for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
        for (const it of e.items) for (const t of it.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  });

  // Tags are their own inverse: an add undoes to a remove and vice versa. The
  // commands drive these same public methods, and `record` no-ops while an inverse
  // is running — otherwise undoing would push a command and the stack never drains.
  async addToEntry(entry: Entry, tags: string[]) {
    const fresh = tags.map((t) => t.trim()).filter((t) => t && !entry.tags.includes(t));
    if (!fresh.length) return;
    entry.tags = [...entry.tags, ...fresh];
    this.host.record({
      label: fresh.length === 1 ? `Tag #${fresh[0]}` : 'Tags',
      undo: async () => {
        for (const t of fresh) await this.removeFromEntry(entry, t);
      },
      redo: () => this.addToEntry(entry, fresh),
    });
    this.host.markDirty();
    await this.host.persist(() => api.addEntryTags(entry.id, fresh));
  }

  async removeFromEntry(entry: Entry, tag: string) {
    if (!entry.tags.includes(tag)) return;
    entry.tags = entry.tags.filter((t) => t !== tag);
    this.host.record({
      label: `Untag #${tag}`,
      undo: () => this.addToEntry(entry, [tag]),
      redo: () => this.removeFromEntry(entry, tag),
    });
    this.host.markDirty();
    await this.host.persist(() => api.removeEntryTag(entry.id, tag));
  }

  async addToItem(item: Item, tags: string[]) {
    const fresh = tags.map((t) => t.trim()).filter((t) => t && !item.tags.includes(t));
    if (!fresh.length) return;
    item.tags = [...item.tags, ...fresh];
    this.host.record({
      label: fresh.length === 1 ? `Tag #${fresh[0]}` : 'Tags',
      undo: async () => {
        for (const t of fresh) await this.removeFromItem(item, t);
      },
      redo: () => this.addToItem(item, fresh),
    });
    this.host.markDirty();
    await this.host.persist(() => api.addItemTags(item.id, fresh));
  }

  async removeFromItem(item: Item, tag: string) {
    if (!item.tags.includes(tag)) return;
    item.tags = item.tags.filter((t) => t !== tag);
    this.host.record({
      label: `Untag #${tag}`,
      undo: () => this.addToItem(item, [tag]),
      redo: () => this.removeFromItem(item, tag),
    });
    this.host.markDirty();
    await this.host.persist(() => api.removeItemTag(item.id, tag));
  }
}
