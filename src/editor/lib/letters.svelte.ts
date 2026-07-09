// The cover-letter concern — the per-variant letter header plus the per-variant
// body paragraphs, their loading, and their CRUD — lifted out of EditorState
// (tech-debt #11). Unlike the preview slice, this one is genuinely coupled to the
// editor's save machinery, so rather than reach into a god-object it declares
// that coupling as an explicit `LetterHost` the store supplies. The paragraphs
// (`sections`) live here now; the store coordinates by calling load()/clear()
// when the active variant changes.
import { api } from './api';
import { DEMO_LETTERS } from './demo';
import { move } from './util';
import { fieldDiff, patchShadow, seedShadow, type Shadow } from './undo';
import type { SaveHost } from './host';
import type { LetterSection, Variant } from './types';

/** The shared save infra plus the reads the cover-letter concern needs. */
export interface LetterHost extends SaveHost {
  activeVariant(): Variant | null;
  activeVariantId(): number | null;
  /** the demo person's shared header — the fallback header source when offline. */
  coverletter(): Record<string, string>;
}

export class LetterController {
  /** body paragraphs of the active cover-letter variant (loaded on select) */
  sections = $state<LetterSection[]>([]);
  /** header fields of the active cover-letter variant (recipient / opening / closing) */
  header = $state<Record<string, string>>({});

  /** Last-recorded field values, for undo — see undo.ts on why a shadow is needed. */
  #shadow: Shadow = new WeakMap();

  constructor(private host: LetterHost) {}

  /** Re-shadow after the letter's objects are replaced wholesale. */
  #reshadow() {
    seedShadow(this.#shadow, this.header, this.header);
    for (const s of this.sections) this.#seedSection(s);
  }
  #seedSection(section: LetterSection) {
    seedShadow(this.#shadow, section, { title: section.title, body: section.body });
  }

  /** Load the active cover-letter variant's header + paragraphs (clear for a CV variant). */
  load() {
    const v = this.host.activeVariant();
    if (v?.kind !== 'coverletter') {
      this.clear();
      return;
    }
    if (this.host.connected()) {
      this.clear();
      const vid = v.id;
      void api.getLetterData(vid).then((res) => {
        // guard against a stale response after the user switched variants again
        if (res.ok && res.data && this.host.activeVariantId() === vid) {
          this.sections = res.data.sections;
          this.header = res.data.header;
          this.#reshadow();
        }
      });
    } else {
      this.sections = (DEMO_LETTERS[v.id] ?? []).map((s) => ({ ...s }));
      this.header = { ...this.host.coverletter() }; // demo: the shared person header
      this.#reshadow();
    }
  }

  /** Drop the loaded header + paragraphs (fresh variant, or on leaving a profile). */
  clear() {
    this.sections = [];
    this.header = {};
  }

  /** Debounced save of one cover-letter header field to the active variant. */
  saveHeader(key: string) {
    const change = fieldDiff(this.#shadow, this.header, this.header);
    if (change) {
      const { old, next } = change;
      this.host.record({
        label: 'Letter header',
        mergeKey: `letterHeader:${change.key}`,
        undo: () => this.applyHeader(change.key, old),
        redo: () => this.applyHeader(change.key, next),
      });
    }
    this.host.markDirty();
    const v = this.host.activeVariant();
    if (!this.host.connected() || !v) return;
    const vid = v.id;
    this.host.setSaving();
    this.host.debounce(`clh.${vid}.${key}`, () => {
      void this.host.persist(() => api.updateVariantHeader(vid, { [key]: this.header[key] ?? '' }));
    });
  }
  private applyHeader(key: string, value: string) {
    this.header[key] = value;
    patchShadow(this.#shadow, this.header, key, value);
    this.host.markDirty();
    const v = this.host.activeVariant();
    if (!this.host.connected() || !v) return;
    void this.host.persist(() => api.updateVariantHeader(v.id, { [key]: value }));
  }

  async addParagraph() {
    const v = this.host.activeVariant();
    if (!v) return;
    const index = this.sections.length;
    this.sections.push({ id: this.host.nextId(), title: '', body: '' });
    const section = this.sections[index]; // the proxy, not the literal we pushed
    this.#seedSection(section);
    const tempId = section.id;
    this.host.markDirty();
    const remember = () =>
      this.host.record({
        label: 'Add paragraph',
        undo: () => this.detach(section),
        redo: () => this.attach(section, index),
      });
    if (!this.host.connected()) {
      remember();
      return;
    }
    const res = await this.host.persist(() =>
      api.createLetterSection(v.id, { title: '', body: '' }),
    );
    if (res.ok && res.data) {
      section.id = res.data.id; // reconcile temp id → server id
      remember();
    } else {
      this.sections = this.sections.filter((s) => s.id !== tempId); // roll back
    }
  }

  saveParagraph(section: LetterSection) {
    const change = fieldDiff(this.#shadow, section, {
      title: section.title,
      body: section.body,
    });
    if (change) {
      const { key, old, next } = change;
      this.host.record({
        label: 'Paragraph',
        mergeKey: `letterSection:${section.id}:${key}`,
        undo: () => this.applyParagraph(section, key, old),
        redo: () => this.applyParagraph(section, key, next),
      });
    }
    this.host.markDirty();
    const v = this.host.activeVariant();
    if (!this.host.connected() || !v) return;
    const vid = v.id;
    this.host.setSaving();
    this.host.debounce(`ls.${section.id}`, () => {
      void this.host.persist(() =>
        api.updateLetterSection(vid, section.id, { title: section.title, body: section.body }),
      );
    });
  }
  private applyParagraph(section: LetterSection, key: string, value: string) {
    if (key === 'title') section.title = value;
    else section.body = value;
    patchShadow(this.#shadow, section, key, value);
    this.host.markDirty();
    const v = this.host.activeVariant();
    if (!this.host.connected() || !v) return;
    void this.host.persist(() =>
      api.updateLetterSection(v.id, section.id, { title: section.title, body: section.body }),
    );
  }

  async deleteParagraph(id: number) {
    const index = this.sections.findIndex((s) => s.id === id);
    if (index < 0) return;
    const section = this.sections[index];
    this.host.record({
      label: 'Delete paragraph',
      undo: () => this.attach(section, index),
      redo: () => this.detach(section),
    });
    await this.detach(section);
  }
  private async detach(section: LetterSection) {
    const v = this.host.activeVariant();
    const id = section.id;
    this.sections = this.sections.filter((s) => s.id !== id);
    this.host.markDirty();
    if (!this.host.connected() || !v) return;
    await this.host.persist(() => api.deleteLetterSection(v.id, id));
  }
  /** Put a paragraph back — the row is re-created, so its id comes back new. */
  private async attach(section: LetterSection, index: number) {
    const v = this.host.activeVariant();
    this.sections.splice(Math.min(index, this.sections.length), 0, section);
    this.host.markDirty();
    if (!this.host.connected() || !v) return;
    const res = await this.host.persist(() =>
      api.createLetterSection(v.id, { title: section.title, body: section.body }),
    );
    if (!res.ok || !res.data) {
      this.sections = this.sections.filter((s) => s !== section);
      return;
    }
    section.id = res.data.id;
    await api.reorderLetterSections(
      v.id,
      this.sections.map((s) => s.id),
    );
  }

  async reorderParagraphs(from: number, to: number) {
    const v = this.host.activeVariant();
    this.sections = move(this.sections, from, to);
    this.host.announce(`Paragraph moved to position ${to + 1} of ${this.sections.length}`);
    this.host.record({
      label: 'Reorder',
      undo: () => this.reorderParagraphs(to, from),
      redo: () => this.reorderParagraphs(from, to),
    });
    this.host.markDirty();
    if (!this.host.connected() || !v) return;
    const ids = this.sections.map((s) => s.id);
    await this.host.persist(() => api.reorderLetterSections(v.id, ids));
  }
}
