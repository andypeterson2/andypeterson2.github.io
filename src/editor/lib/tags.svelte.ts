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

  async addToEntry(entry: Entry, tags: string[]) {
    const fresh = tags.map((t) => t.trim()).filter((t) => t && !entry.tags.includes(t));
    if (!fresh.length) return;
    entry.tags = [...entry.tags, ...fresh];
    this.host.markDirty();
    if (!this.host.connected()) return;
    this.host.setSaving();
    this.host.settle((await api.addEntryTags(entry.id, fresh)).ok);
  }

  async removeFromEntry(entry: Entry, tag: string) {
    entry.tags = entry.tags.filter((t) => t !== tag);
    this.host.markDirty();
    if (!this.host.connected()) return;
    this.host.setSaving();
    this.host.settle((await api.removeEntryTag(entry.id, tag)).ok);
  }

  async addToItem(item: Item, tags: string[]) {
    const fresh = tags.map((t) => t.trim()).filter((t) => t && !item.tags.includes(t));
    if (!fresh.length) return;
    item.tags = [...item.tags, ...fresh];
    this.host.markDirty();
    if (!this.host.connected()) return;
    this.host.setSaving();
    this.host.settle((await api.addItemTags(item.id, fresh)).ok);
  }

  async removeFromItem(item: Item, tag: string) {
    item.tags = item.tags.filter((t) => t !== tag);
    this.host.markDirty();
    if (!this.host.connected()) return;
    this.host.setSaving();
    this.host.settle((await api.removeItemTag(item.id, tag)).ok);
  }
}
