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

  constructor(private host: LetterHost) {}

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
        }
      });
    } else {
      this.sections = (DEMO_LETTERS[v.id] ?? []).map((s) => ({ ...s }));
      this.header = { ...this.host.coverletter() }; // demo: the shared person header
    }
  }

  /** Drop the loaded header + paragraphs (fresh variant, or on leaving a profile). */
  clear() {
    this.sections = [];
    this.header = {};
  }

  /** Debounced save of one cover-letter header field to the active variant. */
  saveHeader(key: string) {
    this.host.markDirty();
    const v = this.host.activeVariant();
    if (!this.host.connected() || !v) return;
    const vid = v.id;
    this.host.setSaving();
    this.host.debounce(`clh.${vid}.${key}`, () => {
      void api
        .updateVariantHeader(vid, { [key]: this.header[key] ?? '' })
        .then((r) => this.host.settle(r.ok));
    });
  }

  async addParagraph() {
    const v = this.host.activeVariant();
    if (!v) return;
    const section: LetterSection = { id: this.host.nextId(), title: '', body: '' };
    const tempId = section.id;
    this.sections.push(section);
    this.host.markDirty();
    if (!this.host.connected()) return;
    this.host.setSaving();
    const res = await api.createLetterSection(v.id, { title: '', body: '' });
    if (res.ok && res.data) {
      const s = this.sections.find((x) => x.id === tempId);
      if (s) s.id = res.data.id; // reconcile temp id → server id
    } else {
      this.sections = this.sections.filter((s) => s.id !== tempId); // roll back
    }
    this.host.settle(res.ok);
  }

  saveParagraph(section: LetterSection) {
    this.host.markDirty();
    const v = this.host.activeVariant();
    if (!this.host.connected() || !v) return;
    const vid = v.id;
    this.host.setSaving();
    this.host.debounce(`ls.${section.id}`, () => {
      void api
        .updateLetterSection(vid, section.id, { title: section.title, body: section.body })
        .then((r) => this.host.settle(r.ok));
    });
  }

  async deleteParagraph(id: number) {
    const v = this.host.activeVariant();
    this.sections = this.sections.filter((s) => s.id !== id);
    this.host.markDirty();
    if (!this.host.connected() || !v) return;
    this.host.setSaving();
    this.host.settle((await api.deleteLetterSection(v.id, id)).ok);
  }

  async reorderParagraphs(from: number, to: number) {
    const v = this.host.activeVariant();
    this.sections = move(this.sections, from, to);
    this.host.announce(`Paragraph moved to position ${to + 1} of ${this.sections.length}`);
    this.host.markDirty();
    if (!this.host.connected() || !v) return;
    this.host.setSaving();
    const ids = this.sections.map((s) => s.id);
    this.host.settle((await api.reorderLetterSections(v.id, ids)).ok);
  }
}
