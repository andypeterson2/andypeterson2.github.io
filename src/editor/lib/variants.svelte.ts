// The variants concern — the list of alternate lenses (CV / résumé / cover
// letter) over the main document, and their include/exclude rules — lifted out
// of EditorState (tech-debt #11). This slice is the most cross-cutting: the
// active-lens pointer (`activeVariantId`) is read by several store derivations
// and by the preview + letters controllers, so it STAYS on the store; this
// controller reaches it through the host (`activeId`/`setActiveId`) and lets the
// store own the cross-slice coordination via `syncActive` (reset the preview,
// load or clear the cover letter for the newly-active lens).
import { api } from './api';
import type { SaveHost } from './host';
import type { Variant } from './types';

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
    this.host.setSaving();
    const res = await api.createVariant(pid, { name: clean, kind });
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
    this.host.settle(res.ok);
  }

  async rename(variant: Variant, name: string) {
    const clean = name.trim();
    if (!clean || clean === variant.name) return;
    variant.name = clean;
    this.host.markDirty();
    if (!this.host.connected()) return;
    this.host.setSaving();
    this.host.settle((await api.renameVariant(variant.id, clean)).ok);
  }

  async remove(variant: Variant) {
    this.host.setVariants(this.host.variants().filter((v) => v.id !== variant.id));
    if (this.host.activeId() === variant.id) this.host.setActiveId(null);
    this.host.markDirty();
    if (!this.host.connected()) return;
    this.host.setSaving();
    this.host.settle((await api.deleteVariant(variant.id)).ok);
  }

  async addRule(variant: Variant, mode: 'include' | 'exclude', tag: string) {
    const t = tag.trim().replace(/^#/, '');
    if (!t || variant.rules[mode].includes(t)) return;
    variant.rules[mode] = [...variant.rules[mode], t];
    this.host.markDirty();
    if (!this.host.connected()) return;
    this.host.setSaving();
    this.host.settle((await api.setVariantRules(variant.id, variant.rules)).ok);
  }

  async removeRule(variant: Variant, mode: 'include' | 'exclude', tag: string) {
    variant.rules[mode] = variant.rules[mode].filter((t) => t !== tag);
    this.host.markDirty();
    if (!this.host.connected()) return;
    this.host.setSaving();
    this.host.settle((await api.setVariantRules(variant.id, variant.rules)).ok);
  }
}
