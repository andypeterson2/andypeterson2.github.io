// The variants concern — the list of alternate lenses (CV / resume / cover
// letter) over the main document, and their include/exclude rules — lifted out
// of EditorState (tech-debt #11). This slice is the most cross-cutting: the
// active-lens pointer (`activeVariantId`) is read by several store derivations
// and by the preview + letters controllers, so it STAYS on the store; this
// controller reaches it through the host (`activeId`/`setActiveId`) and lets the
// store own the cross-slice coordination via `syncActive` (reset the preview,
// load or clear the cover letter for the newly-active lens).
import { api } from './api';
import type { SaveHost } from './host';
import type { Variant, Entry, Item, EntryOverride, ItemOverride } from './types';

/** True when a resolved override carries no signal — the backend drops such a row. */
function emptyEntryOv(o: EntryOverride): boolean {
  return (
    o.included == null &&
    o.textOverride == null &&
    o.sortOverride == null &&
    o.fieldsOverride == null
  );
}
function emptyItemOv(o: ItemOverride): boolean {
  return o.included == null && o.textOverride == null && o.sortOverride == null;
}
/** Structural copy so an undo snapshot never aliases the live proxy it was taken from. */
function cloneEntryOv(o: EntryOverride | null): EntryOverride | null {
  return o ? { ...o, fieldsOverride: o.fieldsOverride ? { ...o.fieldsOverride } : null } : null;
}
function cloneItemOv(o: ItemOverride | null): ItemOverride | null {
  return o ? { ...o } : null;
}
/** Fold one field edit into an entry override; matching Main auto-clears the key. */
function withField(
  before: EntryOverride | null,
  key: string,
  value: string,
  base: string,
): EntryOverride | null {
  const fo: Record<string, string> = { ...(before?.fieldsOverride ?? {}) };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- removing one field's override from a plain record keyed by field name
  if (value === base) delete fo[key];
  else fo[key] = value;
  const next: EntryOverride = {
    included: before?.included ?? null,
    textOverride: before?.textOverride ?? null,
    sortOverride: before?.sortOverride ?? null,
    fieldsOverride: Object.keys(fo).length ? fo : null,
  };
  return emptyEntryOv(next) ? null : next;
}
/** Fold an include tri-state (1 force-in / 0 force-out / null default) into an override. */
function withEntryIncluded(
  before: EntryOverride | null,
  state: number | null,
): EntryOverride | null {
  const next: EntryOverride = {
    included: state,
    textOverride: before?.textOverride ?? null,
    sortOverride: before?.sortOverride ?? null,
    fieldsOverride: before?.fieldsOverride ?? null,
  };
  return emptyEntryOv(next) ? null : next;
}
function withItemIncluded(before: ItemOverride | null, state: number | null): ItemOverride | null {
  const next: ItemOverride = {
    included: state,
    textOverride: before?.textOverride ?? null,
    sortOverride: before?.sortOverride ?? null,
  };
  return emptyItemOv(next) ? null : next;
}

/** The shared save infra plus the reads/writes the variants concern needs. */
export interface VariantHost extends SaveHost {
  activePersonId(): number | null;
  activeId(): number | null;
  setActiveId(id: number | null): void;
  variants(): Variant[];
  setVariants(v: Variant[]): void;
  /** react to the active lens changing: reset preview, then load or clear letters. */
  syncActive(loadLetters: boolean): void;
}

export class VariantController {
  constructor(private host: VariantHost) {}

  /** Switch the active lens (null = Main, the full document). */
  select(id: number | null) {
    this.host.setActiveId(id);
    this.host.syncActive(true);
  }

  async add(name: string, kind: Variant['kind'] = 'cv') {
    const clean = name.trim() || (kind === 'coverletter' ? 'New cover letter' : 'New variant');
    const variant: Variant = {
      id: this.host.nextId(),
      name: clean,
      kind,
      rules: { include: [], exclude: [] },
      sections: [],
    };
    const tempId = variant.id;
    this.host.variants().push(variant);
    this.host.setActiveId(tempId);
    this.host.syncActive(false); // a fresh variant has no letter paragraphs yet
    this.host.markDirty();
    const pid = this.host.activePersonId();
    if (!this.host.connected() || pid == null) return;
    const res = await this.host.persist(() => api.createVariant(pid, { name: clean, kind }));
    if (res.ok && res.data) {
      if (this.host.activeId() === tempId) this.host.setActiveId(res.data.id);
      variant.id = res.data.id; // reconcile temp id → server id
    } else {
      this.host.setVariants(this.host.variants().filter((v) => v.id !== tempId)); // roll back
      if (this.host.activeId() === tempId) {
        this.host.setActiveId(null); // fall back to Main
        this.host.syncActive(false);
      }
    }
  }

  async rename(variant: Variant, name: string) {
    const clean = name.trim();
    if (!clean || clean === variant.name) return;
    variant.name = clean;
    this.host.markDirty();
    await this.host.persist(() => api.renameVariant(variant.id, clean));
  }

  async remove(variant: Variant) {
    // Variant add/remove isn't itself undoable, and a delete would strand any rule
    // command still pointing at this variant's now-dead server row. Forget rather
    // than offer an "Undo" that would 404.
    this.host.forgetHistory();
    this.host.setVariants(this.host.variants().filter((v) => v.id !== variant.id));
    if (this.host.activeId() === variant.id) this.host.setActiveId(null);
    this.host.markDirty();
    await this.host.persist(() => api.deleteVariant(variant.id));
  }

  // A rule tag is its own inverse: adding undoes to removing and vice versa. Rules
  // are only edited on the ACTIVE variant (the drawer gates on it), so undo re-dims
  // the document live. `record` no-ops while an inverse runs, so the stack drains.
  async addRule(variant: Variant, mode: 'include' | 'exclude', tag: string) {
    const t = tag.trim().replace(/^#/, '');
    if (!t || variant.rules[mode].includes(t)) return;
    variant.rules[mode] = [...variant.rules[mode], t];
    this.host.record({
      label: `${mode === 'include' ? 'Include' : 'Exclude'} #${t}`,
      undo: () => this.removeRule(variant, mode, t),
      redo: () => this.addRule(variant, mode, t),
    });
    this.host.markDirty();
    await this.host.persist(() => api.setVariantRules(variant.id, variant.rules));
  }

  async removeRule(variant: Variant, mode: 'include' | 'exclude', tag: string) {
    if (!variant.rules[mode].includes(tag)) return;
    variant.rules[mode] = variant.rules[mode].filter((t) => t !== tag);
    this.host.record({
      label: `Remove #${tag}`,
      undo: () => this.addRule(variant, mode, tag),
      redo: () => this.removeRule(variant, mode, tag),
    });
    this.host.markDirty();
    await this.host.persist(() => api.setVariantRules(variant.id, variant.rules));
  }

  // ---- per-variant overrides (field patch + force include/exclude) ----
  // Every override write sends the WHOLE row (the backend upsert is whole-row and
  // deletes when all fields are null), so each method computes the complete next
  // state from the current one. `variant` is a live proxy in `person.variants`, so
  // mutating `entryOverrides`/`itemOverrides` re-runs the lens instantly. undo/redo
  // carry snapshots straight to `_applyEntryOverride`, so they never re-record.

  /** Set (or, when it equals Main, clear) this variant's override of one entry field. */
  async setEntryFieldOverride(variant: Variant, entry: Entry, key: string, value: string) {
    const before = cloneEntryOv(variant.entryOverrides?.[entry.id] ?? null);
    const after = withField(before, key, value, entry.fields[key] ?? '');
    this.host.record({
      label: `Override ${key}`,
      undo: () => this._applyEntryOverride(variant, entry.id, before),
      redo: () => this._applyEntryOverride(variant, entry.id, after),
    });
    await this._applyEntryOverride(variant, entry.id, after);
  }

  /** Drop this variant's override of one entry field, reverting it to Main. */
  resetEntryField(variant: Variant, entry: Entry, key: string) {
    return this.setEntryFieldOverride(variant, entry, key, entry.fields[key] ?? '');
  }

  /** Force an entry in (1) / out (0) of this variant, or clear to tag-rule default (null). */
  async setEntryIncluded(variant: Variant, entry: Entry, state: number | null) {
    const before = cloneEntryOv(variant.entryOverrides?.[entry.id] ?? null);
    const after = withEntryIncluded(before, state);
    this.host.record({
      label: state == null ? 'Reset visibility' : state ? 'Always show' : 'Hide',
      undo: () => this._applyEntryOverride(variant, entry.id, before),
      redo: () => this._applyEntryOverride(variant, entry.id, after),
    });
    await this._applyEntryOverride(variant, entry.id, after);
  }

  /** Force a bullet/skill in (1) / out (0) of this variant, or clear to default (null). */
  async setItemIncluded(variant: Variant, item: Item, state: number | null) {
    const before = cloneItemOv(variant.itemOverrides?.[item.id] ?? null);
    const after = withItemIncluded(before, state);
    this.host.record({
      label: state == null ? 'Reset visibility' : state ? 'Always show' : 'Hide',
      undo: () => this._applyItemOverride(variant, item.id, before),
      redo: () => this._applyItemOverride(variant, item.id, after),
    });
    await this._applyItemOverride(variant, item.id, after);
  }

  /** Land an entry override in the live proxy + backend (null removes the row). */
  private async _applyEntryOverride(variant: Variant, entryId: number, ov: EntryOverride | null) {
    const map = (variant.entryOverrides ??= {});
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- cloneEntryOv(nonNull) is non-null by construction
    if (ov) map[entryId] = cloneEntryOv(ov)!;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- null override = remove the row, keyed by entry id
    else delete map[entryId];
    this.host.markDirty();
    await this.host.persist(() =>
      api.setVariantOverride(variant.id, {
        targetType: 'entry',
        targetId: entryId,
        included: ov?.included ?? null,
        textOverride: ov?.textOverride ?? null,
        sortOverride: ov?.sortOverride ?? null,
        fieldsOverride: ov?.fieldsOverride ?? null,
      }),
    );
  }

  private async _applyItemOverride(variant: Variant, itemId: number, ov: ItemOverride | null) {
    const map = (variant.itemOverrides ??= {});
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- cloneItemOv(nonNull) is non-null by construction
    if (ov) map[itemId] = cloneItemOv(ov)!;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- null override = remove the row, keyed by item id
    else delete map[itemId];
    this.host.markDirty();
    await this.host.persist(() =>
      api.setVariantOverride(variant.id, {
        targetType: 'item',
        targetId: itemId,
        included: ov?.included ?? null,
        textOverride: ov?.textOverride ?? null,
        sortOverride: ov?.sortOverride ?? null,
      }),
    );
  }
}
