// Editor state — Svelte 5 runes. A single reactive store the components read.
import type { Person, Selection, Section, Entry, Item } from './types';
import { DEMO_PERSON } from './demo';
import { defaultFields, SECTION_TYPES } from './section-types';
import { api, type PersonMeta } from './api';

/** Immutably move an array item from one index to another. */
function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

class EditorState {
  /** The person currently being edited (demo until a backend is connected). */
  person = $state<Person>(DEMO_PERSON);
  selection = $state<Selection>({ kind: 'none' });
  connected = $state(false);
  saveState = $state<'demo' | 'saved' | 'saving' | 'error'>('demo');
  previewOpen = $state(false);
  variant = $state('Master');
  dirty = $state(false);
  connecting = $state(false);
  connectError = $state<null | 'signin' | 'offline'>(null);
  signingIn = $state(false);
  /** Profiles available to the signed-in identity (empty in demo). */
  persons = $state<PersonMeta[]>([]);
  activePersonId = $state<number | null>(null);
  /** a section id the document should scroll into view (set on create) */
  scrollTarget = $state<number | string | null>(null);
  /** local id source for entries/bullets created before an API round-trip */
  private seq = 1000;

  select(sel: Selection) {
    this.selection = sel;
  }

  clearSelection() {
    this.selection = { kind: 'none' };
  }

  /** Flag unsaved edits (used in demo, where there's no backend to save to). */
  edited() {
    this.dirty = true;
  }

  private timers: Record<string, ReturnType<typeof setTimeout>> = {};
  private debounce(key: string, fn: () => void, delay = 600) {
    clearTimeout(this.timers[key]);
    this.timers[key] = setTimeout(fn, delay);
  }
  private settle(ok: boolean) {
    this.saveState = ok ? 'saved' : 'error';
  }

  // ---- debounced field autosave (connected only; demo stays local) ----
  saveEntry(entry: Entry) {
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.debounce(`entry.${entry.id}`, () => {
      void api.updateEntry(entry.id, entry.fields).then((r) => this.settle(r.ok));
    });
  }
  saveItem(item: Item) {
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.debounce(`item.${item.id}`, () => {
      void api
        .updateItem(item.id, { content: item.content, title: item.title ?? '' })
        .then((r) => this.settle(r.ok));
    });
  }
  savePersonal(key: string) {
    this.dirty = true;
    if (!this.connected || this.activePersonId == null) return;
    const pid = this.activePersonId;
    this.saveState = 'saving';
    this.debounce(`personal.${key}`, () => {
      void api
        .updatePersonal(pid, { [key]: this.person.personal[key] ?? '' })
        .then((r) => this.settle(r.ok));
    });
  }

  // ---- content mutations (persist immediately when connected) ----
  async addEntry(section: Section) {
    const entry: Entry = {
      id: this.seq++,
      fields: defaultFields(section.type),
      items: [],
      tags: [],
    };
    const tempId = entry.id;
    section.entries.push(entry);
    this.select({ kind: 'entry', sectionId: section.id, entryId: tempId });
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    const res = await api.createEntry(section.id, entry.fields);
    if (res.ok && res.data) {
      entry.id = res.data.id; // reconcile temp id → server id
      if (this.selection.kind === 'entry' && this.selection.entryId === tempId) {
        this.selection = { kind: 'entry', sectionId: section.id, entryId: res.data.id };
      }
    }
    this.settle(res.ok);
  }
  async deleteEntry(section: Section, entryId: number) {
    section.entries = section.entries.filter((e) => e.id !== entryId);
    this.clearSelection();
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.settle((await api.deleteEntry(entryId)).ok);
  }
  async addBullet(entry: Entry) {
    const item: Item = { id: this.seq++, content: '', title: '', tags: [] };
    entry.items.push(item);
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    const res = await api.createItem(entry.id, { content: '', title: '' });
    if (res.ok && res.data) item.id = res.data.id;
    this.settle(res.ok);
  }
  async deleteBullet(entry: Entry, itemId: number) {
    entry.items = entry.items.filter((i) => i.id !== itemId);
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.settle((await api.deleteItem(itemId)).ok);
  }
  async addSection(type: string) {
    // Section-type keys are valid slugs (^[a-z0-9_-]+$); dedup against existing.
    const existing = new Set(this.person.sections.map((s) => s.slug).filter(Boolean));
    let slug = type;
    let n = 2;
    while (existing.has(slug)) slug = `${type}-${n++}`;
    const title = SECTION_TYPES[type].label;
    const section: Section = { id: this.seq++, slug, type, title, entries: [] };
    this.person.sections.push(section);
    this.scrollTarget = section.id;
    this.dirty = true;
    if (!this.connected || this.activePersonId == null) return;
    this.saveState = 'saving';
    const res = await api.createSection(this.activePersonId, { slug, type, title });
    if (res.ok && res.data) section.id = res.data.id; // reconcile temp id → server id
    this.settle(res.ok);
  }
  async deleteSection(sectionId: Section['id']) {
    this.person.sections = this.person.sections.filter((s) => s.id !== sectionId);
    this.clearSelection();
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.settle((await api.deleteSection(sectionId)).ok);
  }

  // ---- drag reorder (persist the new id order) ----
  async reorderEntries(section: Section, from: number, to: number) {
    section.entries = move(section.entries, from, to);
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    const ids = section.entries.map((e) => e.id);
    this.settle((await api.reorderEntries(section.id, ids)).ok);
  }
  async reorderItems(entry: Entry, from: number, to: number) {
    entry.items = move(entry.items, from, to);
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    const ids = entry.items.map((i) => i.id);
    this.settle((await api.reorderItems(entry.id, ids)).ok);
  }
  async reorderSections(from: number, to: number) {
    this.person.sections = move(this.person.sections, from, to);
    this.dirty = true;
    if (!this.connected || this.activePersonId == null) return;
    this.saveState = 'saving';
    const ids = this.person.sections.map((s) => s.id);
    this.settle((await api.reorderSections(this.activePersonId, ids)).ok);
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

  /** Try to load a profile from the live backend (read-only). */
  async connect() {
    if (this.connecting) return;
    this.connecting = true;
    this.connectError = null;
    const res = await api.fetchActive();
    if (res.ok && res.data) {
      this.connecting = false;
      this.persons = res.data.persons;
      this.activePersonId = res.data.person.id;
      this.loadPerson(res.data.person);
      return;
    }
    // Not loaded. A not-signed-in request 302s to the Access login on another
    // origin, surfacing as a network/CORS error — so probe the public health
    // endpoint to tell "needs sign-in" (gateway reachable) from a real outage.
    if (res.error?.code === 'auth_required') {
      this.connectError = 'signin';
    } else {
      const health = await api.health();
      this.connectError = health.ok ? 'signin' : 'offline';
    }
    this.connecting = false;
  }

  /** Switch to another profile (the toolbar picker). */
  async selectPerson(pid: number) {
    if (pid === this.activePersonId) return;
    const res = await api.fetchPerson(pid);
    if (res.ok && res.data) {
      this.activePersonId = pid;
      this.loadPerson(res.data);
    }
  }

  /**
   * Sign in via Cloudflare Access. A hand-built /cdn-cgi/access/login URL can't
   * be matched to the app, and Access won't redirect cross-domain back to the
   * GitHub-Pages editor anyway. Instead open the protected API in a popup so
   * Cloudflare runs its own login on api.andypeterson.dev, then poll until the
   * session cookie lets us load the real CV.
   */
  signIn() {
    if (typeof window === 'undefined') return;
    const loginUrl = 'https://api.andypeterson.dev/cv/api/persons';
    const popup = window.open(loginUrl, 'cv-access-login', 'width=540,height=680');
    if (!popup) {
      // Popup blocked — fall back to a full-page login (browser back returns here).
      window.location.href = loginUrl;
      return;
    }
    this.signingIn = true;
    this.connectError = null;
    let tries = 0;
    const poll = setInterval(() => {
      void (async () => {
        tries += 1;
        await this.connect();
        if (this.connected || tries >= 40 || popup.closed) {
          clearInterval(poll);
          this.signingIn = false;
          if (this.connected && !popup.closed) popup.close();
        }
      })();
    }, 2500);
  }
}

export const editor = new EditorState();
