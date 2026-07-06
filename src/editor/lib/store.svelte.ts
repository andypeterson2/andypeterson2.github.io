// Editor state — Svelte 5 runes. A single reactive store the components read.
import type { Person, Selection, Section, Entry } from './types';
import { DEMO_PERSON } from './demo';
import { defaultFields, SECTION_TYPES } from './section-types';
import { api } from './api';

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

  /** Try to load the active person from the live backend (read-only). */
  async connect() {
    if (this.connecting) return;
    this.connecting = true;
    this.connectError = null;
    const res = await api.fetchActivePerson();
    this.connecting = false;
    if (res.ok && res.data) {
      this.loadPerson(res.data);
    } else if (res.error?.code === 'auth_required') {
      this.connectError = 'signin';
    } else {
      this.connectError = 'offline';
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
        const res = await api.fetchActivePerson();
        if (res.ok && res.data) {
          clearInterval(poll);
          this.signingIn = false;
          this.loadPerson(res.data);
          if (!popup.closed) popup.close();
        } else if (tries >= 40 || popup.closed) {
          clearInterval(poll);
          this.signingIn = false;
        }
      })();
    }, 2500);
  }
}

export const editor = new EditorState();
