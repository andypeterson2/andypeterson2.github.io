// Editor state — Svelte 5 runes. A single reactive store the components read.
import type { Person, Selection, Section, Entry } from './types';
import { DEMO_PERSON } from './demo';
import { defaultFields, SECTION_TYPES } from './section-types';

class EditorState {
  /** The person currently being edited (demo until a backend is connected). */
  person = $state<Person>(DEMO_PERSON);
  selection = $state<Selection>({ kind: 'none' });
  connected = $state(false);
  saveState = $state<'demo' | 'saved' | 'saving' | 'error'>('demo');
  previewOpen = $state(false);
  variant = $state('Master');
  dirty = $state(false);
  /** local id source for entries/bullets created before an API round-trip */
  private seq = 1000;

  select(sel: Selection) {
    this.selection = sel;
  }

  clearSelection() {
    this.selection = { kind: 'none' };
  }

  /** Flag unsaved edits. (Autosave to the API lands in a later increment.) */
  edited() {
    this.dirty = true;
  }

  // ---- content mutations (reactive — Svelte $state proxies are deep) ----
  addEntry(section: Section) {
    const entry: Entry = {
      id: this.seq++,
      fields: defaultFields(section.type),
      items: [],
      tags: [],
    };
    section.entries.push(entry);
    this.select({ kind: 'entry', sectionId: section.id, entryId: entry.id });
    this.edited();
  }
  deleteEntry(section: Section, entryId: number) {
    section.entries = section.entries.filter((e) => e.id !== entryId);
    this.clearSelection();
    this.edited();
  }
  addBullet(entry: Entry) {
    entry.items.push({ id: this.seq++, content: '', tags: [] });
    this.edited();
  }
  deleteBullet(entry: Entry, itemId: number) {
    entry.items = entry.items.filter((i) => i.id !== itemId);
    this.edited();
  }
  addSection(type: string) {
    const s: Section = {
      id: `s-${this.seq++}`,
      type,
      title: SECTION_TYPES[type].label,
      entries: [],
    };
    this.person.sections.push(s);
    this.edited();
  }
  deleteSection(sectionId: Section['id']) {
    this.person.sections = this.person.sections.filter((s) => s.id !== sectionId);
    this.clearSelection();
    this.edited();
  }

  togglePreview() {
    this.previewOpen = !this.previewOpen;
  }

  loadPerson(p: Person) {
    this.person = p;
    this.connected = true;
    this.saveState = 'saved';
    this.selection = { kind: 'none' };
    this.dirty = false;
  }
}

export const editor = new EditorState();
