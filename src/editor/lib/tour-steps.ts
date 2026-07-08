// The tour's script. Every step drives the REAL editor through the same store
// calls a visitor's clicks make — there is no parallel "demo mode" rendering
// path to drift out of sync with the app. That is the whole point: the thing
// being demonstrated is the thing.
//
// Steps are looked up by shape (an `experience` section, the variant that has
// include-rules, the cover-letter variant) rather than by hard-coded id, so
// editing demo.ts can't silently break the narration.
import { editor } from './store.svelte';
import { typeText, type TourStep } from './tour';
import type { Entry } from './types';

/** Typed live into a brand-new bullet — fictional, like the rest of the demo. */
const TYPED_BULLET = 'Cut p95 latency 40% by batching the tag-resolver queries.';

/** The tag the spotlight step lifts out (one bullet carries it, so the effect is stark). */
const SPOTLIT_TAG = 'management';

export function tourSteps(): TourStep[] {
  // Captured across re-entries: Resume re-runs the current step, and a step that
  // appended a bullet each time would grow the demo instead of restaging it.
  let bulletId: number | null = null;

  const experience = () => editor.person.sections.find((s) => s.type === 'experience') ?? null;
  const firstEntry = (): Entry | null => experience()?.entries[0] ?? null;
  const lensVariant = () =>
    editor.person.variants.find((v) => v.kind !== 'coverletter' && v.rules.include.length > 0) ??
    null;
  const letterVariant = () => editor.person.variants.find((v) => v.kind === 'coverletter') ?? null;

  return [
    {
      id: 'inline',
      caption: 'The résumé is the interface. Click any line and it opens for editing, in place.',
      enter() {
        const section = experience();
        const entry = firstEntry();
        if (section && entry)
          editor.select({ kind: 'entry', sectionId: section.id, entryId: entry.id });
      },
    },
    {
      id: 'type',
      caption: 'Bullets are just content. Watch — this one is being added and typed right now.',
      async enter(signal) {
        const entry = firstEntry();
        if (!entry) return;
        // Idempotent: reuse the bullet a previous entry created, else make one.
        let bullet = bulletId == null ? null : (entry.items.find((i) => i.id === bulletId) ?? null);
        if (!bullet) {
          await editor.addBullet(entry);
          bullet = entry.items[entry.items.length - 1] ?? null;
          bulletId = bullet?.id ?? null;
        }
        if (!bullet) return;
        const target = bullet;
        target.content = '';
        await typeText(TYPED_BULLET, (partial) => (target.content = partial), signal);
        if (!signal.aborted) editor.saveItem(target); // demo: marks dirty, touches no network
      },
    },
    {
      id: 'tags',
      caption: `Tag any entry or bullet, then spotlight a tag — here #${SPOTLIT_TAG} — and the rest fades.`,
      enter() {
        editor.clearSelection();
        editor.tags.highlight = SPOTLIT_TAG;
      },
    },
    {
      id: 'lens',
      caption:
        'A variant is a saved lens over that one document. This one keeps only what is tagged #backend.',
      enter() {
        editor.tags.highlight = null;
        editor.openDrawer = null;
        const v = lensVariant();
        if (v) editor.variants.select(v.id);
      },
    },
    {
      id: 'rules',
      caption:
        'Its rules are ordinary tag chips. Edit them and the document re-filters as you type.',
      enter() {
        editor.openDrawer = 'variant';
      },
    },
    {
      id: 'letter',
      caption:
        'A cover letter is a variant too — the same profile, with its own recipient and paragraphs.',
      enter() {
        editor.openDrawer = null;
        const v = letterVariant();
        if (v) editor.variants.select(v.id);
      },
    },
    {
      id: 'ship',
      caption:
        'Export the profile as JSON whenever you like. Signed in, every variant compiles to a real PDF through LaTeX.',
      enter() {
        editor.variants.select(null);
      },
    },
  ];
}
