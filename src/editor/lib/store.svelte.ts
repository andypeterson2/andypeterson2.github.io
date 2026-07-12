// Editor state — Svelte 5 runes. A single reactive store the components read.
//
// This store was split down incrementally (tech-debt #11). Four concerns are
// out, each a sub-controller composed below and driven through an injected host
// of thunks rather than reaching back into this object:
//   • `editor.preview`  — preview.svelte.ts  (2 deps; fully self-contained)
//   • `editor.letters`  — letters.svelte.ts  (the cover letter)
//   • `editor.variants` — variants.svelte.ts (the lenses + rules)
//   • `editor.tags`     — tags.svelte.ts     (tag CRUD, spotlight, vocabulary)
// The shared save infra (`nextId`/`markDirty`/`setSaving`/`settle`/`debounce`/
// `announce`) is named once as `SaveHost` (host.ts) and provided by `saveHost`
// below; each controller's host extends it with the slice's own reads. The
// recipe to peel a slice: define its host = SaveHost + its reads, move the
// methods, and keep genuinely shared reactive state (like `activeVariantId`)
// HERE — the controllers coordinate with it through the host.
//
// What remains under the `// ---- <slice> ----` banners — field autosave,
// content CRUD, drag reorder, drawers, profile CRUD — is the core the save infra
// exists FOR; it's deliberately left in place, as pulling it out would relocate
// coupling rather than reduce it. Navigate by the banners.
import type { Person, Selection, Section, Entry, Item } from './types';
import { createDemoPerson, DEMO_LETTERS } from './demo';
import { defaultFields, SECTION_TYPES } from './section-types';
import { api, type PersonMeta, type ApiResult } from './api';
import { resolveAccent } from './accent';
import { buildExport } from './export';
import { PreviewController } from './preview.svelte';
import { LetterController } from './letters.svelte';
import { VariantController } from './variants.svelte';
import { TagController } from './tags.svelte';
import { HistoryController } from './history.svelte';
import { UndoController } from './undo.svelte';
import { humanize, FieldShadow } from './undo';
import { ProfileCache } from './profile-cache';
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
  person = $state<Person>(createDemoPerson());
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
  /** the undo/redo history behind the Edit menu (undo.svelte.ts). */
  undo = new UndoController({ announce: (msg) => this.say(msg) });
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
  openDrawer = $state<null | 'variant' | 'tags' | 'layouts' | 'style' | 'profiles' | 'history'>(
    null,
  );
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
    persist: (op, retry) => this.persist(op, retry),
    debounce: (key, fn) => this.debounce(key, fn),
    announce: (msg) => this.say(msg),
    record: (cmd) => this.undo.record(cmd),
    forgetHistory: () => this.undo.clear(),
  };
  /** the cover-letter concern — header fields + per-variant paragraphs (letters.svelte.ts). */
  letters = new LetterController({
    ...this.saveHost,
    activeVariant: () => this.activeVariant,
    activeVariantId: () => this.activeVariantId,
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
      // Switching into or out of a cover letter replaces the letter objects, so any
      // command that closed over them would write to something detached. Switching
      // between CV lenses touches no objects and keeps its history.
      const letterInvolved =
        this.letters.sections.length > 0 || this.activeVariant?.kind === 'coverletter';
      if (letterInvolved) this.undo.clear();
      if (load) this.letters.load();
      else this.letters.clear();
    },
  });
  /** the tags concern — entry/bullet tags, the spotlight, the vocabulary (tags.svelte.ts). */
  tags = new TagController({
    ...this.saveHost,
    sections: () => this.person.sections,
  });
  /** the version-history concern — document checkpoints + restore (history.svelte.ts). */
  history = new HistoryController({
    ...this.saveHost,
    activePersonId: () => this.activePersonId,
    capture: () => $state.snapshot(this.person) as Person,
    apply: (doc) => this.restoreDocument(doc),
    reload: () => this.reloadActive(),
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

  constructor() {
    this.#shadow.reseat(this.person, this.style as Record<string, string>);
  }

  // ---- undo plumbing ----
  // `bind:value` mutates state before the store is called, so the previous value
  // has to be remembered separately — the field-shadow (undo.ts), keyed by object
  // identity. #cache keeps visited profiles' trees alive so a switch preserves undo.
  #shadow = new FieldShadow();
  #cache = new ProfileCache();

  /**
   * NOTE — the `$state` proxy trap. Pushing a raw object into a reactive array and
   * keeping the raw reference gives you an object that is never `===` the element
   * you read back, so identity filters silently match nothing and the shadow keyed
   * on it is never found. Always re-read the element after inserting it.
   */
  private live<T>(arr: T[], index: number): T {
    return arr[index];
  }

  /**
   * Enter a scope with a clean slate: the document was replaced by fresh objects
   * (demo reset, empty state), so its old history can't be replayed. Switch to the
   * scope, drop whatever it held, and re-seed the shadow for the new objects.
   */
  private rebase(scopeKey: string) {
    this.undo.setScope(scopeKey);
    this.undo.clear();
    this.#shadow.reseat(this.person, this.style as Record<string, string>);
  }

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
  /**
   * The single pairing of "saving…" with a settle — so no persist can hang the
   * indicator. Runs `op` (connected only; demo reports success and writes nothing),
   * settles from its result even if `op` throws, and returns the full result so a
   * create can reconcile from `data`. `retry` is stashed for the toast only when
   * the op is safe to re-run.
   */
  async persist<T>(op: () => Promise<ApiResult<T>>, retry?: () => void): Promise<ApiResult<T>> {
    if (!this.connected) return { ok: true, status: 0 };
    this.saveState = 'saving';
    let res: ApiResult<T>;
    try {
      res = await op();
    } catch {
      res = { ok: false, status: 0, error: { code: 'threw', message: 'save failed' } };
    }
    this.settle(res.ok, retry);
    return res;
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
  /**
   * Speak through the editor's single aria-live region. Public so the guided tour
   * can narrate its captions here rather than mount a second live region — two of
   * them talk over each other.
   */
  narrate(msg: string) {
    this.say(msg);
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
    const change = this.#shadow.diff(entry, entry.fields);
    if (change) {
      const { key, old, next } = change;
      this.undo.record({
        label: humanize(key),
        mergeKey: `entry:${this.#shadow.uid(entry)}:${key}`,
        undo: () => this.applyEntryField(entry, key, old),
        redo: () => this.applyEntryField(entry, key, next),
      });
    }
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving'; // immediate pending indicator; the debounced push settles it
    this.debounce(`entry.${entry.id}`, () => this.pushEntry(entry));
  }
  /** Write a field back (undo/redo). Persists at once — an inverse must not linger. */
  private applyEntryField(entry: Entry, key: string, value: string) {
    entry.fields[key] = value;
    this.#shadow.patch(entry, key, value);
    this.dirty = true;
    if (!this.connected) return;
    this.pushEntry(entry);
  }
  private pushEntry(entry: Entry) {
    void this.persist(
      () => api.updateEntry(entry.id, entry.fields),
      () => this.pushEntry(entry),
    );
  }
  saveItem(item: Item) {
    const change = this.#shadow.diff(item, {
      title: item.title ?? '',
      content: item.content,
    });
    if (change) {
      const { key, old, next } = change;
      this.undo.record({
        label: key === 'title' ? 'Lead-in' : 'Bullet',
        mergeKey: `item:${this.#shadow.uid(item)}:${key}`,
        undo: () => this.applyItemField(item, key, old),
        redo: () => this.applyItemField(item, key, next),
      });
    }
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.debounce(`item.${item.id}`, () => this.pushItem(item));
  }
  private applyItemField(item: Item, key: string, value: string) {
    if (key === 'title') item.title = value;
    else item.content = value;
    this.#shadow.patch(item, key, value);
    this.dirty = true;
    if (!this.connected) return;
    this.pushItem(item);
  }
  private pushItem(item: Item) {
    void this.persist(
      () => api.updateItem(item.id, { content: item.content, title: item.title ?? '' }),
      () => this.pushItem(item),
    );
  }
  savePersonal(key: string) {
    const personal = this.person.personal as Record<string, string | undefined>;
    const change = this.#shadow.diff(this.person.personal, personal);
    if (change) {
      const { old, next } = change;
      this.undo.record({
        label: humanize(change.key),
        mergeKey: `personal:${change.key}`,
        undo: () => this.applyPersonalField(change.key, old),
        redo: () => this.applyPersonalField(change.key, next),
      });
    }
    this.dirty = true;
    if (!this.connected || this.activePersonId == null) return;
    const pid = this.activePersonId;
    this.saveState = 'saving';
    this.debounce(`personal.${key}`, () => this.pushPersonal(pid, key));
  }
  private applyPersonalField(key: string, value: string) {
    (this.person.personal as Record<string, string>)[key] = value;
    this.#shadow.patch(this.person.personal, key, value);
    this.dirty = true;
    if (!this.connected || this.activePersonId == null) return;
    this.pushPersonal(this.activePersonId, key);
  }
  private pushPersonal(pid: number, key: string) {
    void this.persist(
      () => api.updatePersonal(pid, { [key]: this.person.personal[key] ?? '' }),
      () => this.pushPersonal(pid, key),
    );
  }

  // ---- content mutations (persist immediately when connected) ----
  // Every structural op is undoable, and its inverse re-CREATES the row — so the
  // server issues a new id. That is why each command closes over the live object
  // (reading `.id` at call time) rather than over an id captured up front, and why
  // an inserted literal is re-read out of the array before anything captures it.

  async addEntry(section: Section) {
    const index = section.entries.length;
    section.entries.push({
      id: this.seq++,
      fields: defaultFields(section.type),
      items: [],
      tags: [],
    });
    const entry = this.live(section.entries, index); // the proxy, not the literal
    this.#shadow.seed(entry, entry.fields);
    const tempId = entry.id;
    this.select({ kind: 'entry', sectionId: section.id, entryId: tempId });
    this.dirty = true;
    const remember = () =>
      this.undo.record({
        label: 'Add entry',
        undo: () => this.detachEntry(section, entry),
        redo: () => this.attachEntry(section, entry, index),
      });
    if (!this.connected) {
      remember();
      return;
    }
    const res = await this.persist(() => api.createEntry(section.id, entry.fields));
    if (res.ok && res.data) {
      entry.id = res.data.id; // reconcile temp id → server id
      if (this.selection.kind === 'entry' && this.selection.entryId === tempId) {
        this.selection = { kind: 'entry', sectionId: section.id, entryId: res.data.id };
      }
      remember(); // only a create that stuck is worth undoing
    } else {
      section.entries = section.entries.filter((e) => e.id !== tempId); // roll back the phantom
      this.clearSelection();
    }
  }
  async deleteEntry(section: Section, entryId: number) {
    const index = section.entries.findIndex((e) => e.id === entryId);
    if (index < 0) return;
    const entry = this.live(section.entries, index);
    this.undo.record({
      label: 'Delete entry',
      undo: () => this.attachEntry(section, entry, index),
      redo: () => this.detachEntry(section, entry),
    });
    await this.detachEntry(section, entry);
  }
  /** Drop an entry and its server row. The JS object survives, for the undo. */
  private async detachEntry(section: Section, entry: Entry) {
    const id = entry.id;
    section.entries = section.entries.filter((e) => e.id !== id);
    this.clearSelection();
    this.dirty = true;
    await this.persist(() => api.deleteEntry(id));
  }
  /** Put an entry back, re-creating its row, bullets and tags. Every id is new. */
  private async attachEntry(section: Section, entry: Entry, index: number) {
    section.entries.splice(Math.min(index, section.entries.length), 0, entry);
    this.dirty = true;
    if (!this.connected) return;
    const res = await this.persist(() => api.createEntry(section.id, entry.fields));
    if (!res.ok || !res.data) {
      section.entries = section.entries.filter((e) => e !== entry);
      return;
    }
    entry.id = res.data.id;
    // Re-attach children best-effort; the create above is what the indicator tracks.
    for (const item of entry.items) {
      const r = await api.createItem(entry.id, { content: item.content, title: item.title ?? '' });
      if (r.ok && r.data) item.id = r.data.id;
      if (item.tags.length) await api.addItemTags(item.id, item.tags);
    }
    if (entry.tags.length) await api.addEntryTags(entry.id, entry.tags);
    await api.reorderEntries(
      section.id,
      section.entries.map((e) => e.id),
    );
  }

  async addBullet(entry: Entry) {
    const index = entry.items.length;
    entry.items.push({ id: this.seq++, content: '', title: '', tags: [] });
    const item = this.live(entry.items, index);
    this.#shadow.seedItem(item);
    this.dirty = true;
    const remember = () =>
      this.undo.record({
        label: 'Add bullet',
        undo: () => this.detachBullet(entry, item),
        redo: () => this.attachBullet(entry, item, index),
      });
    if (!this.connected) {
      remember();
      return;
    }
    const res = await this.persist(() => api.createItem(entry.id, { content: '', title: '' }));
    if (res.ok && res.data) {
      item.id = res.data.id;
      remember();
    } else {
      entry.items = entry.items.filter((i) => i.id !== item.id); // roll back the phantom
    }
  }
  async deleteBullet(entry: Entry, itemId: number) {
    const index = entry.items.findIndex((i) => i.id === itemId);
    if (index < 0) return;
    const item = this.live(entry.items, index);
    this.undo.record({
      label: 'Delete bullet',
      undo: () => this.attachBullet(entry, item, index),
      redo: () => this.detachBullet(entry, item),
    });
    await this.detachBullet(entry, item);
  }
  private async detachBullet(entry: Entry, item: Item) {
    const id = item.id;
    entry.items = entry.items.filter((i) => i.id !== id);
    this.dirty = true;
    await this.persist(() => api.deleteItem(id));
  }
  private async attachBullet(entry: Entry, item: Item, index: number) {
    entry.items.splice(Math.min(index, entry.items.length), 0, item);
    this.dirty = true;
    if (!this.connected) return;
    const res = await this.persist(() =>
      api.createItem(entry.id, { content: item.content, title: item.title ?? '' }),
    );
    if (!res.ok || !res.data) {
      entry.items = entry.items.filter((i) => i !== item);
      return;
    }
    item.id = res.data.id;
    if (item.tags.length) await api.addItemTags(item.id, item.tags);
    await api.reorderItems(
      entry.id,
      entry.items.map((i) => i.id),
    );
  }

  async addSection(type: string) {
    // Section-type keys are valid slugs (^[a-z0-9_-]+$); dedup against existing.
    const existing = new Set(this.person.sections.map((s) => s.slug).filter(Boolean));
    let slug = type;
    let n = 2;
    while (existing.has(slug)) slug = `${type}-${n++}`;
    const title = SECTION_TYPES[type].label;
    const index = this.person.sections.length;
    this.person.sections.push({ id: this.seq++, slug, type, title, entries: [] });
    const section = this.live(this.person.sections, index);
    const tempId = section.id;
    this.scrollTarget = section.id;
    this.dirty = true;
    const remember = () =>
      this.undo.record({
        label: 'Add section',
        undo: () => this.detachSection(section),
        redo: () => this.attachSection(section, index),
      });
    if (!this.connected || this.activePersonId == null) {
      remember();
      return;
    }
    const pid = this.activePersonId;
    const res = await this.persist(() => api.createSection(pid, { slug, type, title }));
    if (res.ok && res.data) {
      section.id = res.data.id; // reconcile temp id → server id
      remember();
    } else {
      this.person.sections = this.person.sections.filter((s) => s.id !== tempId); // roll back
      this.scrollTarget = null;
    }
  }
  async deleteSection(sectionId: Section['id']) {
    const index = this.person.sections.findIndex((s) => s.id === sectionId);
    if (index < 0) return;
    const section = this.live(this.person.sections, index);
    this.undo.record({
      label: 'Delete section',
      undo: () => this.attachSection(section, index),
      redo: () => this.detachSection(section),
    });
    await this.detachSection(section);
  }
  private async detachSection(section: Section) {
    const id = section.id;
    this.person.sections = this.person.sections.filter((s) => s.id !== id);
    this.clearSelection();
    this.dirty = true;
    await this.persist(() => api.deleteSection(id));
  }
  /** Re-create a section and everything inside it. All ids are new; objects are not. */
  private async attachSection(section: Section, index: number) {
    this.person.sections.splice(Math.min(index, this.person.sections.length), 0, section);
    this.scrollTarget = section.id;
    this.dirty = true;
    if (!this.connected || this.activePersonId == null) return;
    const pid = this.activePersonId;
    const res = await this.persist(() =>
      api.createSection(pid, {
        slug: section.slug ?? section.type,
        type: section.type,
        title: section.title,
      }),
    );
    if (!res.ok || !res.data) {
      this.person.sections = this.person.sections.filter((s) => s !== section);
      return;
    }
    section.id = res.data.id;
    // Re-attach the children one at a time so each gets its own fresh server id.
    const entries = [...section.entries];
    section.entries = [];
    for (const [i, entry] of entries.entries()) await this.attachEntry(section, entry, i);
    await api.reorderSections(
      pid,
      this.person.sections.map((s) => s.id),
    );
  }

  // ---- drag reorder (persist the new id order) ----
  // move(arr, from, to) splices out `from` and inserts at `to`, so move(arr, to,
  // from) is its exact inverse — the undo is the same call with the pair swapped.
  async reorderEntries(section: Section, from: number, to: number) {
    section.entries = move(section.entries, from, to);
    this.say(`Entry moved to position ${to + 1} of ${section.entries.length}`);
    this.undo.record({
      label: 'Reorder',
      undo: () => this.reorderEntries(section, to, from),
      redo: () => this.reorderEntries(section, from, to),
    });
    this.dirty = true;
    if (!this.connected) return;
    const ids = section.entries.map((e) => e.id);
    await this.persist(() => api.reorderEntries(section.id, ids));
  }
  async reorderItems(entry: Entry, from: number, to: number) {
    entry.items = move(entry.items, from, to);
    this.say(`Bullet moved to position ${to + 1} of ${entry.items.length}`);
    this.undo.record({
      label: 'Reorder',
      undo: () => this.reorderItems(entry, to, from),
      redo: () => this.reorderItems(entry, from, to),
    });
    this.dirty = true;
    if (!this.connected) return;
    const ids = entry.items.map((i) => i.id);
    await this.persist(() => api.reorderItems(entry.id, ids));
  }
  async reorderSections(from: number, to: number) {
    this.person.sections = move(this.person.sections, from, to);
    this.say(`Section moved to position ${to + 1} of ${this.person.sections.length}`);
    this.undo.record({
      label: 'Reorder',
      undo: () => this.reorderSections(to, from),
      redo: () => this.reorderSections(from, to),
    });
    this.dirty = true;
    if (!this.connected || this.activePersonId == null) return;
    const pid = this.activePersonId;
    const ids = this.person.sections.map((s) => s.id);
    await this.persist(() => api.reorderSections(pid, ids));
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
    // The fetched values are the new baseline: without this, the first style edit
    // would record the demo default as its "old" and undo would restore that.
    this.#shadow.seed(this.style, this.style as Record<string, string>);
  }
  saveStyle(field: 'accentColor' | 'customHex' | 'pageSize' | 'fontSize') {
    const change = this.#shadow.diff(this.style, this.style as Record<string, string>);
    if (change) {
      const { key, old, next } = change;
      this.undo.record({
        label: humanize(key),
        mergeKey: `style:${key}`,
        undo: () => this.applyStyle(key, old),
        redo: () => this.applyStyle(key, next),
      });
    }
    this.dirty = true;
    if (!this.connected) return;
    this.saveState = 'saving';
    this.debounce(`style.${field}`, () => {
      void this.persist(() => api.patchSettings({ [`style.${field}`]: this.style[field] }));
    });
  }
  /** Write a style field back (undo/redo), persisting at once — an inverse must not linger. */
  private applyStyle(key: string, value: string) {
    (this.style as Record<string, string>)[key] = value;
    this.#shadow.patch(this.style, key, value);
    this.dirty = true;
    if (!this.connected) return;
    void this.persist(() => api.patchSettings({ [`style.${key}`]: value }));
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
    await this.persist(() => api.setDefaultLayout(id));
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
      data = buildExport(
        this.person,
        (v) => (this.activeVariantId === v.id ? this.letters.sections : (DEMO_LETTERS[v.id] ?? [])),
        (v) => (this.activeVariantId === v.id ? this.letters.header : this.person.coverletter),
      );
    }
    downloadJson(data, `${label}.json`);
  }

  /**
   * Make `p` the active document. `fresh` — a first load from the backend — caches
   * the tree and seeds its shadow; a reused (cached) tree keeps both. Either way we
   * switch the undo scope to this profile, so its history follows it.
   */
  private activate(p: Person, pid: number, fresh: boolean) {
    this.person = p;
    this.activePersonId = pid;
    this.connected = true;
    this.saveState = 'saved';
    this.selection = { kind: 'none' };
    this.activeVariantId = null;
    this.letters.clear();
    this.history.clear();
    this.preview.reset();
    this.dirty = false;
    this.undo.setScope(`p${pid}`);
    if (fresh) {
      // Cache the reactive proxy Svelte now manages (`this.person`), NOT the raw
      // `p`: edits flow through the proxy, and its nested objects are the very ones
      // the undo commands and the shadow hold. Re-assigning it later is idempotent
      // (Svelte returns an already-proxied object unchanged).
      this.#cache.set(pid, this.person);
      this.#shadow.reseat(this.person, this.style as Record<string, string>);
    }
  }

  loadPerson(p: Person) {
    this.activate(p, p.id, true);
  }

  /**
   * Replace the working document with a restored checkpoint (History drawer, demo
   * path). Like a demo reset it drops undo — the restored objects are fresh, so the
   * old stack can't be replayed against them (ADR-003 / ADR-004).
   */
  restoreDocument(doc: Person) {
    this.person = doc;
    this.selection = { kind: 'none' };
    this.activeVariantId = null;
    this.letters.clear();
    this.preview.reset();
    this.scrollTarget = null;
    this.dirty = true;
    this.saveState = 'demo';
    this.rebase('demo');
    this.say('Document restored to the selected checkpoint.');
  }

  /**
   * Refetch the active profile from scratch (after a connected restore). selectPerson
   * short-circuits on the current id and reuses the cached tree; a restore must
   * bypass both — drop the cache, then re-activate the server's copy.
   */
  async reloadActive() {
    const pid = this.activePersonId;
    if (pid == null) return;
    this.#cache.drop(pid);
    const res = await api.fetchPerson(pid);
    if (res.ok && res.data) this.activate(res.data, pid, true);
  }

  /**
   * Restore the untouched demo profile — the safety net behind "edit anything,
   * nothing is saved". If you invite people to touch it, you owe them an undo.
   * A no-op when connected: there is real data to protect.
   */
  resetDemo() {
    if (this.connected) return;
    this.person = createDemoPerson();
    this.selection = { kind: 'none' };
    this.activeVariantId = null;
    this.letters.clear();
    this.history.clear();
    this.preview.reset();
    this.tags.highlight = null;
    this.openDrawer = null;
    this.scrollTarget = null;
    this.dirty = false;
    this.saveState = 'demo';
    this.rebase('demo'); // fresh clone → fresh objects; nothing on the stack still points at them
    this.say('Demo reset — the sample résumé is back to its original state.');
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
    this.rebase('empty');
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
    // Return to an already-loaded profile without refetching: reusing its working
    // tree keeps its undo history (whose commands hold these very objects) alive.
    const cached = this.#cache.get(pid);
    if (cached) {
      this.activate(cached, pid, false);
      return;
    }
    const res = await api.fetchPerson(pid);
    if (res.ok && res.data) this.activate(res.data, pid, true);
  }

  // ---- profile (person) CRUD — connected only (profiles live on the server) ----
  async addPerson() {
    if (!this.connected) return;
    const existing = new Set(this.persons.map((p) => p.name));
    let name = 'New profile';
    let n = 2;
    while (existing.has(name)) name = `New profile ${n++}`;
    const res = await this.persist(() => api.createPerson(name));
    if (res.ok && res.data) {
      this.persons = [...this.persons, { id: res.data.id, name }];
      await this.selectPerson(res.data.id); // load the new (empty) profile
    }
  }
  async renamePerson(pid: number, name: string) {
    const clean = name.trim();
    const meta = this.persons.find((p) => p.id === pid);
    if (!clean || !meta || clean === meta.name) return;
    const old = meta.name;
    this.persons = this.persons.map((p) => (p.id === pid ? { ...p, name: clean } : p));
    if (!this.connected) return;
    const res = await this.persist(() => api.renamePerson(pid, clean));
    if (!res.ok) this.persons = this.persons.map((p) => (p.id === pid ? { ...p, name: old } : p));
  }
  async deletePerson(pid: number) {
    if (!this.connected) return;
    const snapshot = this.persons;
    const wasActive = this.activePersonId === pid;
    const remaining = this.persons.filter((p) => p.id !== pid);
    this.persons = remaining;
    const res = await this.persist(() => api.deletePerson(pid));
    if (!res.ok) {
      this.persons = snapshot;
      return;
    }
    this.#cache.drop(pid); // its working tree and history die with it
    this.undo.dropScope(`p${pid}`);
    if (wasActive) {
      // Guard the reuse path: the just-deleted tree must never be re-adopted.
      this.activePersonId = null;
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
