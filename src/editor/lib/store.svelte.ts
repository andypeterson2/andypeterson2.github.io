// Editor state — Svelte 5 runes. A single reactive store the components read.
// Preview, letters, variants, tags, and history are sub-controllers composed below,
// each driven through an injected host of thunks (the shared `SaveHost` save infra
// plus the slice's own reads) rather than reaching back into this object. Shared
// reactive state like `activeVariantId` stays here. The core the save infra exists
// for (field autosave, content CRUD, reorder, drawers, profiles) sits under banners.

import type {
  Profile,
  Personal,
  Section,
  Entry,
  Item,
  SettingValue,
  LayoutInfo,
  LayoutReview,
  LayoutCheck,
  StorageUsage,
} from './types';
import { createDemoProfile, DEMO_LETTERS } from './demo';
import { defaultFields, SECTION_TYPES } from './section-types';
import { api, type ProfileMeta, type ApiResult, type ApiError, type RenderCatalog } from './api';
import { resolveAccent } from './accent';
import { buildExport, type ExportDoc } from './export';
import { stashDemoDraft, peekDemoDraft, clearDemoDraft, forNewOwner } from './draft';
import { PreviewController } from './preview.svelte';
import { LetterController } from './letters.svelte';
import { VariantController } from './variants.svelte';
import { TagController } from './tags.svelte';
import { SuggestionController } from './suggest.svelte';
import { HistoryController } from './history.svelte';
import { UndoController } from './undo.svelte';
import { humanize, FieldShadow } from './undo';
import { ProfileCache } from './profile-cache';
import type { SaveHost } from './host';
import { move, pdfFileName } from './util';
import { exportLinkedin } from './linkedin';

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
const EMPTY_PROFILE: Profile = {
  id: 0,
  name: '',
  personal: {},
  sections: [],
  variants: [],
  coverletter: {},
};

class EditorState {
  /** The profile currently being edited (demo until a backend is connected). */
  profile = $state<Profile>(createDemoProfile());
  /** The owner's identity — name + public contacts — overlaid onto the demo profile
   *  from `siteConfig` (via the editor's `identity` prop). Held so resetDemo
   *  re-applies it after re-cloning the pristine sample. Never committed PII. */
  private demoIdentity: Partial<Personal> | null = null;
  connected = $state(false);
  saveState = $state<'demo' | 'saved' | 'saving' | 'error'>('demo');
  /** Human-readable save-failure message for the toast (null → no toast shown). */
  saveError = $state<string | null>(null);
  /** Re-run the last failed save, or null when there's nothing safe to retry. */
  retryOp = $state<null | (() => void)>(null);
  /** the on-demand PDF preview — its own reactive island. */
  preview = new PreviewController(
    () => this.connected,
    () => this.activeVariant,
    () => this.activeProfileId,
  );
  /** the undo/redo history behind the Edit menu. */
  undo = new UndoController({ announce: (msg) => this.say(msg) });
  /** aria-live text for keyboard-reorder feedback (screen-reader only). */
  announce = $state('');
  /** the active variant lens (null = Main, the full document). */
  activeVariantId = $state<number | null>(null);
  dirty = $state(false);
  /** When this document was last changed in this session, for the PDF's name. Null
   *  until an edit happens, and null again after a reload: nothing stores the date. */
  lastEditedAt = $state<number | null>(null);
  connecting = $state(false);
  connectError = $state<null | 'signin' | 'offline'>(null);
  signingIn = $state(false);
  /** The signed-in Google account (self-hosted session), or null when logged out. */
  identity = $state<{ email: string | null; name: string | null } | null>(null);
  /** Demo edits carried across sign-in, waiting for the visitor to import or discard
   *  them. Set by connect() when a fresh stash exists. */
  pendingDraft = $state<ExportDoc | null>(null);
  importingDraft = $state(false);
  /** Profiles available to the signed-in identity (empty in demo). */
  profiles = $state<ProfileMeta[]>([]);
  activeProfileId = $state<number | null>(null);
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
  layouts = $state<LayoutInfo[]>([]);
  defaultLayout = $state<string | null>(null);
  /** The signed-in account is the site owner, who reviews layouts before they go public. */
  canReviewLayouts = $state(false);
  /** What a test compile on this account's résumés found when it last chose someone else's layout. */
  layoutWarnings = $state<string[]>([]);
  /** The last zip check or install, shown under the upload control. */
  layoutCheck = $state<LayoutCheck | null>(null);
  layoutBusy = $state(false);
  layoutReviews = $state<LayoutReview[]>([]);
  /** The account's storage against its limits; null until loaded or when signed out. */
  usage = $state<StorageUsage | null>(null);
  /** accent hex the document themes with — mirrors the Style drawer live. */
  /** Where a Style-drawer edit goes while a variant is active: every resume, or this one. */
  settingsScope = $state<'account' | 'variant'>('variant');
  /** the account's spacing.* / fonts.* values, keyed prefixed; absent = the default */
  accountSettings = $state<Record<string, SettingValue>>({});
  /** defaults + units for the length settings, from the backend catalog */
  renderCatalog = $state<RenderCatalog | null>(null);
  accentHex = $derived(
    resolveAccent(this.styleSetting('style.accentColor'), this.styleSetting('style.customHex')),
  ); /** the Variant object for the active lens, or null for Main (full document). */
  activeVariant = $derived(
    this.activeVariantId == null
      ? null
      : (this.profile.variants.find((v) => v.id === this.activeVariantId) ?? null),
  );
  /** label for the toolbar/titlebar — the active variant's name or "Main". */
  variantLabel = $derived(this.activeVariant?.name ?? 'Main');
  /**
   * What a compiled PDF downloads as: the day, whose resume it is, and which variant.
   * A getter, so an unedited document reads today's date at the moment it compiles —
   * a memoised value keeps yesterday's across midnight.
   */
  get pdfName(): string {
    return pdfFileName(
      `${this.profile.personal.firstName ?? ''} ${this.profile.personal.lastName ?? ''}`.trim(),
      this.variantLabel,
      this.lastEditedAt == null ? new Date() : new Date(this.lastEditedAt),
    );
  }
  /** true when the active variant is a cover letter — the editor swaps to letter mode. */
  letterMode = $derived(this.activeVariant?.kind === 'coverletter');
  /** the save infra every slice-controller composes. */
  private saveHost: SaveHost = {
    connected: () => this.connected,
    nextId: () => this.seq++,
    markDirty: () => this.touch(),
    setSaving: () => {
      this.saveState = 'saving';
    },
    persist: (op, retry) => this.persist(op, retry),
    debounce: (key, fn) => this.debounce(key, fn),
    announce: (msg) => this.say(msg),
    record: (cmd) => this.undo.record(cmd),
    forgetHistory: () => this.undo.clear(),
  };
  /** the cover-letter concern — header fields + per-variant paragraphs. */
  letters = new LetterController({
    ...this.saveHost,
    activeVariant: () => this.activeVariant,
    activeVariantId: () => this.activeVariantId,
    coverletter: () => this.profile.coverletter,
  });
  /** the variants concern — alternate lenses + include/exclude rules. */
  variants = new VariantController({
    ...this.saveHost,
    activeProfileId: () => this.activeProfileId,
    activeId: () => this.activeVariantId,
    setActiveId: (id) => {
      this.activeVariantId = id;
    },
    variants: () => this.profile.variants,
    setVariants: (v) => {
      this.profile.variants = v;
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
  /** the tags concern — entry/bullet tags, the spotlight, the vocabulary. */
  tags = new TagController({
    ...this.saveHost,
    sections: () => this.profile.sections,
  });
  /** the tag-suggestion concern — ranked suggestions beside the chips, with feedback. */
  suggest = new SuggestionController(
    { connected: () => this.connected, activeProfileId: () => this.activeProfileId },
    this.tags,
  );
  /** the version-history concern — document checkpoints + restore. */
  history = new HistoryController({
    ...this.saveHost,
    activeProfileId: () => this.activeProfileId,
    capture: () => $state.snapshot(this.profile),
    apply: (doc) => this.restoreDocument(doc),
    reload: () => this.reloadActive(),
    applyEntry: (source, entryId) => this.applyEntryFrom(source, entryId),
  });
  /** connected, but the account has no profiles yet (e.g. after deleting the last). */
  noProfiles = $derived(this.connected && this.profiles.length === 0);
  /** the active profile's switcher label (its profile "name"); demo → the CV name. */
  profileLabel = $derived(
    this.noProfiles
      ? 'No resumes'
      : this.profiles.find((p) => p.id === this.activeProfileId)?.name ||
          `${this.profile.personal.firstName ?? ''} ${this.profile.personal.lastName ?? ''}`.trim() ||
          'Demo',
  );
  /** local id source for entries/bullets created before an API round-trip */
  private seq = 1000;

  constructor() {
    this.#shadow.reseat(this.profile, this.style);
  }

  // undo plumbing

  // `bind:value` overwrites state before the store is called, so the shadow keeps
  // pre-edit values; #cache keeps visited profiles' trees so a switch keeps undo.
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
    this.#shadow.reseat(this.profile, this.style);
  }

  /** Flag unsaved edits (used in demo, where there's no backend to save to). */
  edited() {
    this.touch();
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
  private settle(ok: boolean, retry?: () => void, error?: ApiError) {
    if (ok) {
      this.saveState = 'saved';
      this.saveError = null;
      this.retryOp = null;
      return;
    }
    this.saveState = 'error';
    this.retryOp = retry ?? null;
    // A full account is not a connection problem: say what is full, and refresh the meter.
    if (error?.code === 'quota_exceeded') {
      this.retryOp = null;
      this.saveError = error.message;
      void this.loadUsage();
      return;
    }
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
    this.settle(res.ok, retry, res.error);
    return res;
  }
  /**
   * Raise the error toast with a message of our own, for a failure that is not a
   * save: the document is unchanged, so the save indicator stays as it was.
   */
  private fail(msg: string) {
    this.retryOp = null;
    this.saveError = msg;
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
  /** Mark the document changed, and note when — the PDF is named after that day. */
  private touch() {
    this.dirty = true;
    this.lastEditedAt = Date.now();
  }
  /**
   * Speak through the editor's single aria-live region — one region for the whole
   * editor, so announcements never talk over each other.
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

  // debounced field autosave (connected only; demo stays local)
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
    this.touch();
    if (!this.connected) return;
    this.saveState = 'saving'; // immediate pending indicator; the debounced push settles it
    this.debounce(`entry.${entry.id}`, () => this.pushEntry(entry));
  }
  /** Write a field back (undo/redo). Persists at once — an inverse must not linger. */
  private applyEntryField(entry: Entry, key: string, value: string) {
    entry.fields[key] = value;
    this.#shadow.patch(entry, key, value);
    this.touch();
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
    this.touch();
    if (!this.connected) return;
    this.saveState = 'saving';
    this.debounce(`item.${item.id}`, () => this.pushItem(item));
  }
  private applyItemField(item: Item, key: string, value: string) {
    if (key === 'title') item.title = value;
    else item.content = value;
    this.#shadow.patch(item, key, value);
    this.touch();
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
    const personal = this.profile.personal as Record<string, string | undefined>;
    const change = this.#shadow.diff(this.profile.personal, personal);
    if (change) {
      const { old, next } = change;
      this.undo.record({
        label: humanize(change.key),
        mergeKey: `personal:${change.key}`,
        undo: () => this.applyPersonalField(change.key, old),
        redo: () => this.applyPersonalField(change.key, next),
      });
    }
    this.touch();
    if (!this.connected || this.activeProfileId == null) return;
    const pid = this.activeProfileId;
    this.saveState = 'saving';
    this.debounce(`personal.${key}`, () => this.pushPersonal(pid, key));
  }
  private applyPersonalField(key: string, value: string) {
    (this.profile.personal as Record<string, string>)[key] = value;
    this.#shadow.patch(this.profile.personal, key, value);
    this.touch();
    if (!this.connected || this.activeProfileId == null) return;
    this.pushPersonal(this.activeProfileId, key);
  }
  private pushPersonal(pid: number, key: string) {
    void this.persist(
      () =>
        api.updatePersonal(pid, {
          [key]: (this.profile.personal as Record<string, string>)[key] ?? '',
        }),
      () => this.pushPersonal(pid, key),
    );
  }

  // content mutations (persist immediately when connected)
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
    const entry = this.live(section.entries, index); // the proxy that replaced the literal
    this.#shadow.seed(entry, entry.fields);
    const tempId = entry.id;
    this.touch();
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
      remember(); // only a create that stuck is worth undoing
    } else {
      section.entries = section.entries.filter((e) => e.id !== tempId); // roll back the phantom
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
    this.touch();
    await this.persist(() => api.deleteEntry(id));
  }
  /** Put an entry back, re-creating its row, bullets and tags. Every id is new. */
  private async attachEntry(section: Section, entry: Entry, index: number) {
    section.entries.splice(Math.min(index, section.entries.length), 0, entry);
    this.touch();
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
    this.touch();
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
    this.touch();
    await this.persist(() => api.deleteItem(id));
  }
  private async attachBullet(entry: Entry, item: Item, index: number) {
    entry.items.splice(Math.min(index, entry.items.length), 0, item);
    this.touch();
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
    const existing = new Set(this.profile.sections.map((s) => s.slug).filter(Boolean));
    let slug = type;
    let n = 2;
    while (existing.has(slug)) slug = `${type}-${n++}`;
    const title = SECTION_TYPES[type]?.label ?? type;
    const index = this.profile.sections.length;
    this.profile.sections.push({ id: this.seq++, slug, type, title, entries: [] });
    const section = this.live(this.profile.sections, index);
    const tempId = section.id;
    this.scrollTarget = section.id;
    this.touch();
    const remember = () =>
      this.undo.record({
        label: 'Add section',
        undo: () => this.detachSection(section),
        redo: () => this.attachSection(section, index),
      });
    if (!this.connected || this.activeProfileId == null) {
      remember();
      return;
    }
    const pid = this.activeProfileId;
    const res = await this.persist(() => api.createSection(pid, { slug, type, title }));
    if (res.ok && res.data) {
      section.id = res.data.id; // reconcile temp id → server id
      remember();
    } else {
      this.profile.sections = this.profile.sections.filter((s) => s.id !== tempId); // roll back
      this.scrollTarget = null;
    }
  }
  async deleteSection(sectionId: Section['id']) {
    const index = this.profile.sections.findIndex((s) => s.id === sectionId);
    if (index < 0) return;
    const section = this.live(this.profile.sections, index);
    this.undo.record({
      label: 'Delete section',
      undo: () => this.attachSection(section, index),
      redo: () => this.detachSection(section),
    });
    await this.detachSection(section);
  }
  private async detachSection(section: Section) {
    const id = section.id;
    this.profile.sections = this.profile.sections.filter((s) => s.id !== id);
    this.touch();
    await this.persist(() => api.deleteSection(id));
  }
  /** Re-create a section and everything inside it. All ids are new; objects are not. */
  private async attachSection(section: Section, index: number) {
    this.profile.sections.splice(Math.min(index, this.profile.sections.length), 0, section);
    this.scrollTarget = section.id;
    this.touch();
    if (!this.connected || this.activeProfileId == null) return;
    const pid = this.activeProfileId;
    const res = await this.persist(() =>
      api.createSection(pid, {
        slug: section.slug ?? section.type,
        type: section.type,
        title: section.title,
      }),
    );
    if (!res.ok || !res.data) {
      this.profile.sections = this.profile.sections.filter((s) => s !== section);
      return;
    }
    section.id = res.data.id;
    // Re-attach the children one at a time so each gets its own fresh server id.
    const entries = [...section.entries];
    section.entries = [];
    for (const [i, entry] of entries.entries()) await this.attachEntry(section, entry, i);
    await api.reorderSections(
      pid,
      this.profile.sections.map((s) => s.id),
    );
  }

  // drag reorder (persist the new id order)
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
    this.touch();
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
    this.touch();
    if (!this.connected) return;
    const ids = entry.items.map((i) => i.id);
    await this.persist(() => api.reorderItems(entry.id, ids));
  }
  async reorderSections(from: number, to: number) {
    this.profile.sections = move(this.profile.sections, from, to);
    this.say(`Section moved to position ${to + 1} of ${this.profile.sections.length}`);
    this.undo.record({
      label: 'Reorder',
      undo: () => this.reorderSections(to, from),
      redo: () => this.reorderSections(from, to),
    });
    this.touch();
    if (!this.connected || this.activeProfileId == null) return;
    const pid = this.activeProfileId;
    const ids = this.profile.sections.map((s) => s.id);
    await this.persist(() => api.reorderSections(pid, ids));
  }

  // drawers: style (account or per-variant) + layouts

  /** The scope a Style-drawer edit writes to right now. */
  get writeScope(): 'account' | 'variant' {
    return this.activeVariant ? this.settingsScope : 'account';
  }
  /** A setting as the active document renders it: variant, then account, then default. */
  settingValue(key: string): SettingValue | undefined {
    const own = this.activeVariant?.settings?.[key];
    if (own !== undefined) return own;
    const [prefix, field] = key.split('.', 2);
    if (prefix === 'style') return (this.style as Record<string, string>)[field];
    if (prefix !== 'spacing' && prefix !== 'fonts') return undefined;
    return this.accountSettings[key] ?? this.renderCatalog?.[prefix][field];
  }
  /** A string-valued setting as rendered, or '' when unset or not a string. */
  styleSetting(key: string): string {
    const v = this.settingValue(key);
    return typeof v === 'string' ? v : '';
  }
  /** True when the current scope holds its own value for `key` (so it can be reset). */
  isSettingSet(key: string): boolean {
    if (this.writeScope === 'variant') return this.activeVariant?.settings?.[key] !== undefined;
    return key in this.accountSettings;
  }
  /** Write a setting to the current scope; `null` resets it to what the scope inherits. */
  setSetting(key: string, value: SettingValue | null) {
    const variant = this.activeVariant;
    if (variant && this.writeScope === 'variant') {
      void this.variants.setSettingOverride(variant, key, value);
      return;
    }
    const field = key.slice(key.indexOf('.') + 1);
    if (key.startsWith('style.')) {
      if (typeof value !== 'string' || !(field in this.style)) return;
      (this.style as Record<string, string>)[field] = value;
      this.saveStyle(field as 'accentColor' | 'customHex' | 'pageSize' | 'fontSize');
      return;
    }
    const before = this.accountSettings[key] ?? null;
    if (JSON.stringify(before) === JSON.stringify(value)) return;
    this.undo.record({
      label: humanize(field),
      undo: () => this.applyAccountSetting(key, before),
      redo: () => this.applyAccountSetting(key, value),
    });
    this.applyAccountSetting(key, value);
  }
  private applyAccountSetting(key: string, value: SettingValue | null) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- null resets one setting, keyed by name
    if (value == null) delete this.accountSettings[key];
    else this.accountSettings[key] = value;
    this.touch();
    if (!this.connected) return;
    void this.persist(() => api.patchSettings({ [key]: value }));
  }

  async loadStyle() {
    if (!this.connected) return;
    void api.fetchRenderCatalog().then((c) => {
      if (c) this.renderCatalog = c;
    });
    const lengths = await Promise.all([api.getSettings('spacing'), api.getSettings('fonts')]);
    const account: Record<string, SettingValue> = {};
    for (const r of lengths) if (r.ok && r.data) Object.assign(account, r.data);
    this.accountSettings = account;
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
    this.#shadow.seed(this.style, this.style);
  }
  saveStyle(field: 'accentColor' | 'customHex' | 'pageSize' | 'fontSize') {
    const change = this.#shadow.diff(this.style, this.style);
    if (change) {
      const { key, old, next } = change;
      this.undo.record({
        label: humanize(key),
        mergeKey: `style:${key}`,
        undo: () => this.applyStyle(key, old),
        redo: () => this.applyStyle(key, next),
      });
    }
    this.touch();
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
    this.touch();
    if (!this.connected) return;
    void this.persist(() => api.patchSettings({ [`style.${key}`]: value }));
  }
  async loadUsage() {
    if (!this.connected) return;
    const res = await api.getUsage();
    if (res.ok && res.data) this.usage = res.data;
  }
  async loadLayouts() {
    if (!this.connected) return;
    void this.loadUsage();
    const res = await api.getLayouts();
    if (res.ok && res.data) {
      this.layouts = res.data.layouts ?? [];
      this.defaultLayout = res.data.default ?? null;
      this.canReviewLayouts = !!res.data.canReview;
    }
    if (this.canReviewLayouts) await this.loadLayoutReviews();
  }
  async chooseLayout(id: string) {
    this.defaultLayout = id;
    this.layoutWarnings = [];
    this.touch();
    const res = await this.persist(() => api.setDefaultLayout(id));
    this.layoutWarnings = res.data?.warnings ?? [];
  }
  /** Check a zip against the layout contract (`install: false`) or install it. */
  async sendLayoutZip(file: File, install: boolean) {
    if (!this.connected) return;
    this.layoutBusy = true;
    try {
      this.layoutCheck = await api.sendLayoutZip(file, { install });
      if (install && this.layoutCheck.ok) await this.loadLayouts();
    } finally {
      this.layoutBusy = false;
    }
  }
  async publishLayout(id: string) {
    this.layoutBusy = true;
    try {
      await this.persist(() => api.publishLayout(id));
      await this.loadLayouts();
    } finally {
      this.layoutBusy = false;
    }
  }
  async unpublishLayout(id: string) {
    await this.persist(() => api.unpublishLayout(id));
    await this.loadLayouts();
  }
  async deleteLayout(id: string) {
    await this.persist(() => api.deleteLayout(id));
    await this.loadLayouts();
  }
  async downloadLayout(layout: LayoutInfo) {
    const blob = await api.downloadLayout(layout.id);
    if (!blob || typeof document === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layout.family}${layout.versionNo ? `-v${String(layout.versionNo)}` : ''}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  async loadLayoutReviews() {
    const res = await api.getLayoutReviews();
    this.layoutReviews = res.ok && res.data ? (res.data.pending ?? []) : [];
  }
  async reviewLayout(id: string, decision: 'approve' | 'reject', note: string) {
    await this.persist(() => api.reviewLayout(id, decision, note));
    await this.loadLayouts();
  }

  /**
   * The stem both JSON exports share. Keeps Unicode letters (non-Latin names);
   * strips only filesystem-unsafe characters and leading/trailing dots or spaces
   * (`\w` would flatten accents to dashes).
   */
  private exportLabel(): string {
    return (
      (this.profileLabel || 'resume')
        .replace(/[/\\:*?"<>|\x00-\x1f]+/g, '-')
        .replace(/^[-.\s]+|[-.\s]+$/g, '') || 'resume'
    );
  }

  /**
   * Download the current resume as import-compatible JSON. Connected profiles use
   * the authoritative backend export; the local demo (and any unsaved edits) is
   * serialized client-side. Either way it re-imports losslessly.
   */
  async exportJson() {
    if (this.noProfiles) return;
    const label = this.exportLabel();
    let data: unknown;
    if (this.connected && this.activeProfileId != null) {
      const res = await api.exportProfile(this.activeProfileId);
      if (!res.ok || res.data == null) {
        this.settle(false);
        return;
      }
      data = res.data;
    } else {
      data = this.localExport();
    }
    downloadJson(data, `${label}.json`);
  }

  /**
   * The work history as LinkedIn-ready blocks. The same transform the cv backend
   * runs, done here so a demo session gets the same file without an account.
   */
  async exportLinkedin() {
    if (this.noProfiles) return;
    try {
      const data = await exportLinkedin(this.profile.sections, this.activeVariant);
      downloadJson(data, `${this.exportLabel()}-linkedin.json`);
    } catch {
      // The fingerprints come from WebCrypto, which an insecure origin withholds.
      this.fail("Couldn't build the LinkedIn file — this page has to be served over HTTPS.");
    }
  }

  /** Save the compiled PDF, under the name the preview bar shows. */
  downloadPdf() {
    const url = this.preview.url;
    if (!url || typeof document === 'undefined') return;
    const a = document.createElement('a');
    a.href = url;
    a.download = this.pdfName;
    a.click();
  }

  /** The working document as an import-compatible tree, serialized client-side. */
  private localExport(): ExportDoc {
    return buildExport(
      this.profile,
      (v) => (this.activeVariantId === v.id ? this.letters.sections : (DEMO_LETTERS[v.id] ?? [])),
      (v) => (this.activeVariantId === v.id ? this.letters.header : this.profile.coverletter),
    );
  }

  /**
   * Make `p` the active document. `fresh` — a first load from the backend — caches
   * the tree and seeds its shadow; a reused (cached) tree keeps both. Either way we
   * switch the undo scope to this profile, so its history follows it.
   */
  private activate(p: Profile, pid: number, fresh: boolean) {
    this.profile = p;
    this.activeProfileId = pid;
    this.connected = true;
    this.saveState = 'saved';
    this.activeVariantId = null;
    this.letters.clear();
    this.history.clear();
    this.preview.reset();
    this.dirty = false;
    this.lastEditedAt = null;
    this.undo.setScope(`p${pid}`);
    if (fresh) {
      // Cache the reactive proxy (`this.profile`) so undo commands and
      // the shadow hold the proxy's nested objects. Re-assigning a proxy is idempotent.
      this.#cache.set(pid, this.profile);
      this.#shadow.reseat(this.profile, this.style);
    }
  }

  loadProfile(p: Profile) {
    this.activate(p, p.id, true);
  }

  /**
   * Replace the working document with a restored checkpoint (History drawer, demo
   * path). Like a demo reset it drops undo — the restored objects are fresh, so the
   * old stack can't be replayed against them.
   */
  restoreDocument(doc: Profile) {
    this.profile = doc;
    this.activeVariantId = null;
    this.letters.clear();
    this.preview.reset();
    this.scrollTarget = null;
    this.touch();
    this.saveState = 'demo';
    this.rebase('demo');
    this.say('Document restored to the selected checkpoint.');
  }

  /**
   * Refetch the active profile from scratch (after a connected restore). selectProfile
   * short-circuits on the current id and reuses the cached tree; a restore must
   * bypass both — drop the cache, then re-activate the server's copy.
   */
  async reloadActive() {
    const pid = this.activeProfileId;
    if (pid == null) return;
    this.#cache.drop(pid);
    const res = await api.fetchProfile(pid);
    if (res.ok && res.data) this.activate(res.data, pid, true);
  }

  /**
   * Cherry-restore: copy one entry, by id, from a checkpoint's document onto the
   * working one — overwrite it if it's still present, re-add it to its section if it
   * was deleted. A structural change, so it drops undo (the old stack can't be
   * replayed against the fresh objects).
   * Demo path; a connected cherry-restore would persist through the entry writes.
   */
  applyEntryFrom(source: Profile, entryId: number): boolean {
    let src: Entry | undefined;
    let sectionId: number | string | undefined;
    for (const s of source.sections) {
      const e = s.entries.find((x) => x.id === entryId);
      if (e) {
        src = e;
        sectionId = s.id;
        break;
      }
    }
    if (!src) return false;
    const section = this.profile.sections.find((s) => s.id === sectionId);
    if (!section) return false; // the section is gone — nowhere to place it
    const copy = JSON.parse(JSON.stringify(src)) as Entry;
    const existing = section.entries.find((e) => e.id === entryId);
    if (existing) {
      existing.fields = copy.fields;
      existing.items = copy.items;
      existing.tags = copy.tags;
    } else {
      section.entries.push(copy);
      this.scrollTarget = section.id;
    }
    this.touch();
    this.undo.clear();
    this.#shadow.reseat(this.profile, this.style);
    this.say('Restored one entry from the checkpoint.');
    return true;
  }

  /**
   * Overlay the owner's identity (name + public contacts, resolved from siteConfig
   * on the server and handed down as the editor's `identity` prop) onto the demo profile.
   * Stored so resetDemo keeps it across re-clones. A no-op once connected —
   * the real CV brings its own identity. Runs at mount, so the first paint already
   * shows the owner's contact fields.
   */
  hydrateDemoIdentity(identity: Partial<Personal>) {
    this.demoIdentity = identity;
    if (!this.connected) Object.assign(this.profile.personal, identity);
  }

  /**
   * Restore the untouched demo profile — the safety net behind "edit anything,
   * nothing is saved". If you invite people to touch it, you owe them an undo.
   * A no-op when connected: there is real data to protect.
   */
  resetDemo() {
    if (this.connected) return;
    const before = this.dirty ? $state.snapshot(this.profile) : null;
    const beforeDirty = this.dirty;
    this.applyPristineDemo();
    this.rebase('demo'); // fresh clone → fresh objects; nothing on the stack still points at them
    // The reset itself is undoable, so "Reset demo" is never a one-way door.
    if (before) {
      this.undo.record({
        label: 'Reset demo',
        undo: () => this.adoptDemoDocument(structuredClone(before), beforeDirty),
        redo: () => {
          this.applyPristineDemo();
          this.#shadow.reseat(this.profile, this.style);
        },
      });
    }
    this.say('Demo reset — the sample resume is back to its original state.');
  }

  /**
   * Empty the demo down to a blank document, so a visitor can see what starting from
   * scratch is like. Demo only. Undoable, like the reset it replaced: emptying a
   * document someone has been editing asks for a way back.
   */
  clearDemo() {
    if (this.connected) return;
    const before = $state.snapshot(this.profile);
    const beforeDirty = this.dirty;
    this.applyEmptyDemo();
    this.rebase('demo'); // the blank tree is fresh objects; nothing on the stack points at them
    this.undo.record({
      label: 'Clear resume',
      undo: () => this.adoptDemoDocument(structuredClone(before), beforeDirty),
      redo: () => {
        this.applyEmptyDemo();
        this.#shadow.reseat(this.profile, this.style);
      },
    });
    this.say('Emptied — undo brings the resume back.');
  }

  /** A blank document in place of the working one (no undo bookkeeping). */
  private applyEmptyDemo() {
    this.profile = {
      id: this.profile.id,
      name: '',
      personal: {},
      sections: [],
      variants: [],
      coverletter: this.profile.coverletter,
    };
    this.activeVariantId = null;
    this.letters.clear();
    this.history.clear();
    this.preview.reset();
    this.tags.highlight = null;
    this.openDrawer = null;
    this.scrollTarget = null;
    this.dirty = false;
    this.lastEditedAt = null;
    this.saveState = 'demo';
  }

  /** The pristine sample in place of the working document (no undo bookkeeping). */
  private applyPristineDemo() {
    this.profile = createDemoProfile(this.demoIdentity ?? undefined);
    this.activeVariantId = null;
    this.letters.clear();
    this.history.clear();
    this.preview.reset();
    this.tags.highlight = null;
    this.openDrawer = null;
    this.scrollTarget = null;
    this.dirty = false;
    this.lastEditedAt = null;
    this.saveState = 'demo';
  }

  /** Put a demo document back (undoing a reset). */
  private adoptDemoDocument(doc: Profile, dirty: boolean) {
    this.profile = doc;
    this.activeVariantId = null;
    this.letters.clear();
    this.preview.reset();
    this.scrollTarget = null;
    this.dirty = dirty;
    this.saveState = 'demo';
    this.#shadow.reseat(this.profile, this.style);
  }

  /** Connected but with no profiles — shows the "create your first profile" prompt. */
  enterEmpty() {
    this.profile = EMPTY_PROFILE;
    this.profiles = [];
    this.activeProfileId = null;
    this.connected = true;
    this.saveState = 'saved';
    this.activeVariantId = null;
    this.letters.clear();
    this.preview.reset();
    this.dirty = false;
    this.lastEditedAt = null;
    this.rebase('empty');
  }

  /** Try to load a profile from the live backend (read-only). */
  async connect() {
    if (this.connecting) return;
    this.connecting = true;
    this.connectError = null;
    // Who is signed in drives the account menu, even for a brand-new account whose
    // empty state has no resumes yet.
    const who = await api.me();
    this.identity = who.authenticated ? { email: who.email, name: who.name } : null;
    // Not signed in ⇒ stay in the local demo. The cv backend answers anonymous
    // requests with the SHARED public profile, so connecting a
    // logged-out visitor would both look like a saving session and let their edits
    // land on everyone's demo. The demo is local until there's a real session;
    // signing in re-runs connect() and loads your data.
    if (!this.identity) {
      this.connecting = false;
      this.showPublishedResume();
      return;
    }
    const res = await api.fetchActive();
    if (res.ok && res.data) {
      this.connecting = false;
      this.profiles = res.data.profiles;
      this.activeProfileId = res.data.profile.id;
      this.loadProfile(res.data.profile);
      this.pendingDraft = peekDemoDraft();
      return;
    }
    // Signed in but the account has no profiles yet → connected empty state,
    // not a sign-in prompt (the request succeeded; the list was just empty).
    if (res.error?.code === 'no_profiles') {
      this.connecting = false;
      this.enterEmpty();
      this.pendingDraft = peekDemoDraft();
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
    // Signed in, but nothing loaded: this session compiles as little as the demo
    // does, so it gets the published PDF too.
    this.showPublishedResume();
  }

  /** Nothing here can compile — put the site's published resume in the preview. */
  private showPublishedResume() {
    void this.preview.loadPublished();
  }

  /** Switch to another profile (the toolbar picker). */
  async selectProfile(pid: number) {
    if (pid === this.activeProfileId) return;
    // Return to an already-loaded profile without refetching: reusing its working
    // tree keeps its undo history (whose commands hold these very objects) alive.
    const cached = this.#cache.get(pid);
    if (cached) {
      this.activate(cached, pid, false);
      return;
    }
    const res = await api.fetchProfile(pid);
    if (res.ok && res.data) this.activate(res.data, pid, true);
  }

  // profile (profile) CRUD — connected only (profiles live on the server)
  async addProfile() {
    if (!this.connected) return;
    const existing = new Set(this.profiles.map((p) => p.name));
    let name = 'New resume';
    let n = 2;
    while (existing.has(name)) name = `New resume ${n++}`;
    const res = await this.persist(() => api.createProfile(name));
    if (res.ok && res.data) {
      this.profiles = [...this.profiles, { id: res.data.id, name }];
      await this.selectProfile(res.data.id); // load the new (empty) profile
    }
    void this.loadUsage();
  }
  async renameProfile(pid: number, name: string) {
    const clean = name.trim();
    const meta = this.profiles.find((p) => p.id === pid);
    if (!clean || !meta || clean === meta.name) return;
    const old = meta.name;
    this.profiles = this.profiles.map((p) => (p.id === pid ? { ...p, name: clean } : p));
    if (!this.connected) return;
    const res = await this.persist(() => api.renameProfile(pid, clean));
    if (!res.ok) this.profiles = this.profiles.map((p) => (p.id === pid ? { ...p, name: old } : p));
  }
  async deleteProfile(pid: number) {
    if (!this.connected) return;
    const snapshot = this.profiles;
    const wasActive = this.activeProfileId === pid;
    const remaining = this.profiles.filter((p) => p.id !== pid);
    this.profiles = remaining;
    const res = await this.persist(() => api.deleteProfile(pid));
    if (!res.ok) {
      this.profiles = snapshot;
      return;
    }
    void this.loadUsage();
    this.#cache.drop(pid); // its working tree and history die with it
    this.undo.dropScope(`p${pid}`);
    if (wasActive) {
      // Guard the reuse path: the just-deleted tree must never be re-adopted.
      this.activeProfileId = null;
      if (remaining.length) await this.selectProfile(remaining[0].id);
      else this.enterEmpty(); // deleted the last one → connected empty state
    }
  }

  /**
   * Make ready for the site menubar's Google sign-in, a same-tab redirect to the
   * gateway's /auth/login that returns here with a session cookie. Keeps a demo
   * visitor's edits so they can bring them into the account afterwards; returns
   * false when they'd rather not go than lose them.
   */
  prepareSignIn(): boolean {
    if (typeof window === 'undefined') return true;
    // If this browser won't let us keep the edits, say so before they're lost.
    if (!this.connected && this.dirty && !stashDemoDraft(this.localExport())) {
      const go = window.confirm(
        "This browser won't let the editor keep your demo edits through sign-in. " +
          'Sign in anyway? (Export ▸ JSON saves a copy first.)',
      );
      if (!go) return false;
    }
    this.signingIn = true;
    this.connectError = null;
    return true;
  }

  /** Start the sign-in from inside the editor (the drawers' inline offers). */
  signIn() {
    if (typeof window === 'undefined' || !this.prepareSignIn()) return;
    window.location.href = api.loginUrl(window.location.href);
  }

  /** Import the carried-over demo edits as a new profile of the signed-in visitor. */
  async importDraft() {
    const doc = this.pendingDraft;
    if (!doc || !this.connected || !this.identity || this.importingDraft) return;
    this.importingDraft = true;
    try {
      const tree = forNewOwner(doc, this.identity);
      const created = await this.persist(() => api.createProfile(tree.name));
      if (!created.ok || !created.data) return; // the save toast reports it; the offer stays
      const id = created.data.id;
      const imported = await this.persist(() => api.importProfile(id, tree));
      if (!imported.ok) return;
      clearDemoDraft();
      this.pendingDraft = null;
      this.profiles = [...this.profiles, { id, name: tree.name }];
      await this.selectProfile(id);
      this.say('Your demo edits are now a resume in your account.');
    } finally {
      this.importingDraft = false;
    }
  }

  /** Drop the carried-over demo edits. */
  discardDraft() {
    clearDemoDraft();
    this.pendingDraft = null;
  }
}

export const editor = new EditorState();
