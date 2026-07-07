// Editor state — Svelte 5 runes. A single reactive store the components read.
//
// This store is being split down incrementally (tech-debt #11). Three concerns
// are already out, each a sub-controller composed below and driven through an
// injected host of thunks rather than reaching back into this object:
//   • `editor.preview`  — preview.svelte.ts  (2 deps; fully self-contained)
//   • `editor.letters`  — letters.svelte.ts  (the cover letter)
//   • `editor.variants` — variants.svelte.ts (the lenses + rules)
// The shared save infra (`nextId`/`markDirty`/`setSaving`/`settle`/`debounce`/
// `announce`) is named once as `SaveHost` (host.ts) and provided by `saveHost`
// below; each controller's host extends it with the slice's own reads. To peel
// another slice, define its host = SaveHost + its reads, move the methods, and
// keep genuinely shared reactive state (like `activeVariantId`) HERE — the
// controllers coordinate with it through the host. What remains under the
// `// ---- <slice> ----` banners (field autosave, content CRUD, drag reorder,
// drawers, tags, profile CRUD) is the core; extracting it gives diminishing
// returns. Navigate by the banners.
import type { Person, Selection, Section, Entry, Item } from './types';
import { DEMO_PERSON, DEMO_LETTERS } from './demo';
import { defaultFields, SECTION_TYPES } from './section-types';
import { api, type PersonMeta } from './api';
import { resolveAccent } from './accent';
import { buildExport } from './export';
import { PreviewController } from './preview.svelte';
import { LetterController } from './letters.svelte';
import { VariantController } from './variants.svelte';
import type { SaveHost } from './host';
import { move } from './util';

/** Trigger a client-side download of `data` as a pretty-printed JSON file. */
function downloadJson(data: unknown, filename: string) {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** A blank profile held while connected with zero profiles — nothing stale renders. */
const EMPTY_PERSON: Person = {
  id: 0,
  name: '',
  personal: {},
  sections: [],
  variants: [],
  coverletter: {},
};

class EditorState {
  /** The person currently being edited (demo until a backend is connected). */
  person = $state<Person>(DEMO_PERSON);
  selection = $state<Selection>({ kind: 'none' });
  connected = $state(false);
  saveState = $state<'demo' | 'saved' | 'saving' | 'error'>('demo');
  /** Human-readable save-failure message for the toast (null → no toast shown). */
  saveError = $state<string | null>(null);
  /** Re-run the last failed save, or null when there's nothing safe to retry. */
  retryOp = $state<null | (() => void)>(null);
  /** the on-demand PDF preview — its own reactive island (see preview.svelte.ts). */
  preview = new PreviewController(
    () => this.connected,
    () => this.activeVariant,
  );
  /** aria-live text for keyboard-reorder feedback (screen-reader only). */
  announce = $state('');
  /** the active variant lens (null = Main, the full document). */
  activeVariantId = $state<number | null>(null);
  dirty = $state(false);
  connecting = $state(false);
  connectError = $state<null | 'signin' | 'offline'>(null);
  signingIn = $state(false);
  /** Profiles available to the signed-in identity (empty in demo). */
  persons = $state<PersonMeta[]>([]);
  activePersonId = $state<number | null>(null);
  /** a section id the document should scroll into view (set on create) */
  scrollTarget = $state<number | string | null>(null);
  openDrawer = $state<null | 'variant' | 'tags' | 'layouts' | 'style' | 'profiles'>(null);
  style = $state({
    accentColor: 'spinel',
    customHex: '',
    pageSize: 'letterpaper',
    fontSize: '11pt',
  });
  layouts = $state<{ id: string; name: string; status: string }[]>([]);
  defaultLayout = $state<string | null>(null);
  /** accent hex the document themes with — mirrors the Style drawer live. */
  accentHex = $derived(resolveAccent(this.style.accentColor, this.style.customHex));
  /** a tag to spotlight — entries without it dim in the document. */
  highlightTag = $state<string | null>(null);
  /** the profile's tag vocabulary with usage counts (derived from content). */
  tagVocab = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const s of this.person.sections) {
      for (const e of s.entries) {
        for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
        for (const it of e.items) for (const t of it.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  });
  /** the Variant object for the active lens, or null for Main (full document). */
  activeVariant = $derived(
    this.activeVariantId == null
      ? null
      : (this.person.variants.find((v) => v.id === this.activeVariantId) ?? null),
  );
  /** label for the toolbar/titlebar — the active variant's name or "Main". */
  variantLabel = $derived(this.activeVariant?.name ?? 'Main');
  /** true when the active variant is a cover letter — the editor swaps to letter mode. */
  letterMode = $derived(this.activeVariant?.kind === 'coverletter');
  /** the save infra every slice-controller composes (see host.ts). */
  private saveHost: SaveHost = {
    connected: () => this.connected,
    nextId: () => this.seq++,
    markDirty: () => {
      this.dirty = true;
    },
    setSaving: () => {
      this.saveState = 'saving';
    },
    settle: (ok, retry) => this.settle(ok, retry),
    debounce: (key, fn) => this.debounce(key, fn),
    announce: (msg) => this.say(msg),
  };
  /** the cover-letter concern — header fields + per-variant paragraphs (letters.svelte.ts). */
  letters = new LetterController({
    ...this.saveHost,
    activeVariant: () => this.activeVariant,
    activeVariantId: () => this.activeVariantId,
    activePersonId: () => this.activePersonId,
    coverletter: () => this.person.coverletter as Record<string, string>,
  });
  /** the variants concern — alternate lenses + include/exclude rules (variants.svelte.ts). */
  variants = new VariantController({
    ...this.saveHost,
    activePersonId: () => this.activePersonId,
    activeId: () => this.activeVariantId,
    setActiveId: (id) => {
      this.activeVariantId = id;
    },
    variants: () => this.person.variants,
    setVariants: (v) => {
      this.person.variants = v;
    },
    syncActive: (load) => {
      this.preview.reset();
      if (load) this.letters.load();
      else this.letters.clear();
    },
  });
  /** connected, but the account has no profiles yet (e.g. after deleting the last). */
  noProfiles = $derived(this.connected && this.persons.length === 0);
  /** the active profile's switcher label (its person "name"); demo → the CV name. */
  profileLabel = $derived(
    this.noProfiles
      ? 'No profiles'
      : this.persons.find((p) => p.id === this.activePersonId)?.name ||
          `${this.person.personal.firstName ?? ''} ${this.person.personal.lastName ?? ''}`.trim() ||
          'Demo',
  );
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
  /** true when the error toast can offer a one-tap retry. */
  canRetry = $derived(this.retryOp !== null);
  /**
   * Resolve a save: clear the error on success, or raise the toast on failure.
   * Pass `retry` only for idempotent saves (field PUTs) — re-running a create
   * would orphan a second server row, since the failed one was rolled back.
   */
  private settle(ok: boolean, retry?: () => void) {
    if (ok) {
      this.saveState = 'saved';
      this.saveError = null;
      this.retryOp = null;
      return;
    }
    this.saveState = 'error';
    this.retryOp = retry ?? null;
    this.saveError = retry
      ? "Couldn't save your edit — it's still here. Retry?"
      : "Couldn't save your last change. Check your connection.";
  }
  /** Re-fire the stashed retry (used by the error toast). */
  retrySave() {
    const fn = this.retryOp;
    this.retryOp = null;
    fn?.();
  }
  /** Dismiss the error toast; the statusbar keeps its subtle marker until the next save. */
  dismissError() {
    this.saveError = null;
  }
  private annToggle = false;
  /** Set the aria-live message, forcing a re-announce even when the text repeats. */
  private say(msg: string) {
    this.annToggle = !this.annToggle;
    this.announce = this.annToggle ? msg : `${msg}\u200B`;
  }

  // ---- debounced field autosave (connected only; demo stays local) ----
  // Each debounced save delegates to a push* helper so the same call can be
  // re-fired verbatim by the error toast — reading the field's *current* value.
  saveEntry(entry: Entry) {
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.debounce(`entry.${entry.id}`, () => this.pushEntry(entry));
  }
  private pushEntry(entry: Entry) {
    this.saveState = 'saving';
    void api
      .updateEntry(entry.id, entry.fields)
      .then((r) => this.settle(r.ok, () => this.pushEntry(entry)));
  }
  saveItem(item: Item) {
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.debounce(`item.${item.id}`, () => this.pushItem(item));
  }
  private pushItem(item: Item) {
    this.saveState = 'saving';
    void api
      .updateItem(item.id, { content: item.content, title: item.title ?? '' })
      .then((r) => this.settle(r.ok, () => this.pushItem(item)));
  }
  savePersonal(key: string) {
    this.dirty = true;
    if (!this.connected || this.activePersonId == null) return;
    const pid = this.activePersonId;
    this.saveState = 'saving';
    this.debounce(`personal.${key}`, () => this.pushPersonal(pid, key));
  }
  private pushPersonal(pid: number, key: string) {
    this.saveState = 'saving';
    void api
      .updatePersonal(pid, { [key]: this.person.personal[key] ?? '' })
      .then((r) => this.settle(r.ok, () => this.pushPersonal(pid, key)));
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
    } else {
      section.entries = section.entries.filter((e) => e.id !== tempId); // roll back the phantom
      this.clearSelection();
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
    else entry.items = entry.items.filter((i) => i.id !== item.id); // roll back the phantom
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
    if (res.ok && res.data)
      section.id = res.data.id; // reconcile temp id → server id
    else {
      this.person.sections = this.person.sections.filter((s) => s.id !== section.id); // roll back
      this.scrollTarget = null;
    }
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
    this.say(`Entry moved to position ${to + 1} of ${section.entries.length}`);
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    const ids = section.entries.map((e) => e.id);
    this.settle((await api.reorderEntries(section.id, ids)).ok);
  }
  async reorderItems(entry: Entry, from: number, to: number) {
    entry.items = move(entry.items, from, to);
    this.say(`Bullet moved to position ${to + 1} of ${entry.items.length}`);
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    const ids = entry.items.map((i) => i.id);
    this.settle((await api.reorderItems(entry.id, ids)).ok);
  }
  async reorderSections(from: number, to: number) {
    this.person.sections = move(this.person.sections, from, to);
    this.say(`Section moved to position ${to + 1} of ${this.person.sections.length}`);
    this.dirty = true;
    if (!this.connected || this.activePersonId == null) return;
    this.saveState = 'saving';
    const ids = this.person.sections.map((s) => s.id);
    this.settle((await api.reorderSections(this.activePersonId, ids)).ok);
  }

  // ---- drawers: global style + layouts ----
  async loadStyle() {
    if (!this.connected) return;
    const res = await api.getSettings('style');
    if (!res.ok || !res.data) return;
    for (const [k, v] of Object.entries(res.data)) {
      const field = k.replace(/^style\./, '');
      if (field in this.style && typeof v === 'string') {
        (this.style as Record<string, string>)[field] = v;
      }
    }
  }
  saveStyle(field: 'accentColor' | 'customHex' | 'pageSize' | 'fontSize') {
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.debounce(`style.${field}`, () => {
      void api
        .patchSettings({ [`style.${field}`]: this.style[field] })
        .then((r) => this.settle(r.ok));
    });
  }
  async loadLayouts() {
    if (!this.connected) return;
    const res = await api.getLayouts();
    if (res.ok && res.data) {
      this.layouts = res.data.layouts ?? [];
      this.defaultLayout = res.data.default ?? null;
    }
  }
  async chooseLayout(id: string) {
    this.defaultLayout = id;
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.settle((await api.setDefaultLayout(id)).ok);
  }

  // ---- tags on entries + bullets (optimistic; persisted when connected) ----
  async addEntryTags(entry: Entry, tags: string[]) {
    const fresh = tags.map((t) => t.trim()).filter((t) => t && !entry.tags.includes(t));
    if (!fresh.length) return;
    entry.tags = [...entry.tags, ...fresh];
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.settle((await api.addEntryTags(entry.id, fresh)).ok);
  }
  async removeEntryTag(entry: Entry, tag: string) {
    entry.tags = entry.tags.filter((t) => t !== tag);
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.settle((await api.removeEntryTag(entry.id, tag)).ok);
  }
  async addItemTags(item: Item, tags: string[]) {
    const fresh = tags.map((t) => t.trim()).filter((t) => t && !item.tags.includes(t));
    if (!fresh.length) return;
    item.tags = [...item.tags, ...fresh];
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.settle((await api.addItemTags(item.id, fresh)).ok);
  }
  async removeItemTag(item: Item, tag: string) {
    item.tags = item.tags.filter((t) => t !== tag);
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.settle((await api.removeItemTag(item.id, tag)).ok);
  }

  /**
   * Download the current résumé as import-compatible JSON. Connected profiles use
   * the authoritative backend export; the local demo (and any unsaved edits) is
   * serialized client-side. Either way it re-imports losslessly.
   */
  async exportJson() {
    if (this.noProfiles) return;
    // Keep Unicode letters (résumé, non-Latin names); strip only filesystem-unsafe
    // characters + leading/trailing dots/spaces (\w would flatten accents to dashes).
    const label =
      (this.profileLabel || 'resume')
        .replace(/[/\\:*?"<>| -]+/g, '-')
        .replace(/^[-.\s]+|[-.\s]+$/g, '') || 'resume';
    let data: unknown;
    if (this.connected && this.activePersonId != null) {
      const res = await api.exportPerson(this.activePersonId);
      if (!res.ok || res.data == null) {
        this.settle(false);
        return;
      }
      data = res.data;
    } else {
      data = buildExport(this.person, (v) =>
        this.activeVariantId === v.id ? this.letters.sections : (DEMO_LETTERS[v.id] ?? []),
      );
    }
    downloadJson(data, `${label}.json`);
  }

  loadPerson(p: Person) {
    this.person = p;
    this.connected = true;
    this.saveState = 'saved';
    this.selection = { kind: 'none' };
    this.activeVariantId = null;
    this.letters.clear();
    this.preview.reset();
    this.dirty = false;
  }

  /** Connected but with no profiles — shows the "create your first profile" prompt. */
  enterEmpty() {
    this.person = EMPTY_PERSON;
    this.persons = [];
    this.activePersonId = null;
    this.connected = true;
    this.saveState = 'saved';
    this.selection = { kind: 'none' };
    this.activeVariantId = null;
    this.letters.clear();
    this.preview.reset();
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
    // Signed in but the account has no profiles yet → connected empty state,
    // NOT a sign-in prompt (the request succeeded; the list was just empty).
    if (res.error?.code === 'no_persons') {
      this.connecting = false;
      this.enterEmpty();
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

  // ---- profile (person) CRUD — connected only (profiles live on the server) ----
  async addPerson() {
    if (!this.connected) return;
    const existing = new Set(this.persons.map((p) => p.name));
    let name = 'New profile';
    let n = 2;
    while (existing.has(name)) name = `New profile ${n++}`;
    this.saveState = 'saving';
    const res = await api.createPerson(name);
    if (res.ok && res.data) {
      this.persons = [...this.persons, { id: res.data.id, name }];
      this.settle(true);
      await this.selectPerson(res.data.id); // load the new (empty) profile
    } else {
      this.settle(false);
    }
  }
  async renamePerson(pid: number, name: string) {
    const clean = name.trim();
    const meta = this.persons.find((p) => p.id === pid);
    if (!clean || !meta || clean === meta.name) return;
    const old = meta.name;
    this.persons = this.persons.map((p) => (p.id === pid ? { ...p, name: clean } : p));
    if (!this.connected) return;
    this.saveState = 'saving';
    const res = await api.renamePerson(pid, clean);
    if (!res.ok) this.persons = this.persons.map((p) => (p.id === pid ? { ...p, name: old } : p));
    this.settle(res.ok);
  }
  async deletePerson(pid: number) {
    if (!this.connected) return;
    const snapshot = this.persons;
    const wasActive = this.activePersonId === pid;
    const remaining = this.persons.filter((p) => p.id !== pid);
    this.persons = remaining;
    this.saveState = 'saving';
    const res = await api.deletePerson(pid);
    if (!res.ok) {
      this.persons = snapshot;
      this.settle(false);
      return;
    }
    this.settle(true);
    if (wasActive) {
      if (remaining.length) await this.selectPerson(remaining[0].id);
      else this.enterEmpty(); // deleted the last one → connected empty state
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
