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
import {
  findExperience,
  findFirstEntry,
  findLensVariant,
  findLetterVariant,
  SPOTLIT_TAG,
  LENS_TAG,
} from './tour-shape';

/** Typed live into a brand-new bullet during the tour (removed again on reset). */
const TYPED_BULLET =
  'Added dark-count modeling to the channel simulator, tightening the eavesdrop-detection threshold.';

export function tourSteps(): TourStep[] {
  // Captured across re-entries: Resume re-runs the current step, and a step that
  // appended a bullet each time would grow the demo instead of restaging it.
  let bulletId: number | null = null;

  // The shapes the steps drive, guarded by tests/editor-tour-shape.test.ts.
  const experience = () => findExperience(editor.person);
  const firstEntry = () => findFirstEntry(editor.person);
  const lensVariant = () => findLensVariant(editor.person);
  const letterVariant = () => findLetterVariant(editor.person);

  return [
    {
      id: 'inline',
      caption: 'The résumé is the interface. Click any line and it opens for editing, in place.',
      spot: '[data-tour-spot="experience"]',
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
      spot: '[data-tour-spot="experience"]',
      async enter(signal) {
        const entry = firstEntry();
        if (!entry) return;
        // Idempotent across re-entries (Resume replays the step): reuse the bullet a
        // previous run added, else make one. It never persists — in demo nothing is
        // saved, and a signed-in owner's tour is sandboxed (store.stageTour).
        let bullet = bulletId == null ? null : (entry.items.find((i) => i.id === bulletId) ?? null);
        if (!bullet) {
          bullet = editor.addEphemeralBullet(entry);
          bulletId = bullet.id;
        }
        const target = bullet;
        target.content = '';
        await typeText(TYPED_BULLET, (partial) => (target.content = partial), signal);
      },
    },
    {
      id: 'tags',
      caption: `Tag any entry or bullet, then spotlight a tag — here #${SPOTLIT_TAG} — and the rest fades.`,
      spot: '[data-tour-spot="experience"]',
      enter() {
        editor.clearSelection();
        editor.tags.highlight = SPOTLIT_TAG;
      },
    },
    {
      id: 'lens',
      caption: `A variant is a saved lens over that one document. This one keeps only what is tagged #${LENS_TAG}.`,
      spot: '[data-tour-spot="variants"]',
      // Phones: the variant picker is folded into the ☰ menu, so frame the document
      // the lens just re-rendered — the visible effect is right there in the résumé.
      spotMobile: '[data-tour-spot="document"]',
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
      spot: 'aside.drawer',
      enter() {
        editor.openDrawer = 'variant';
      },
    },
    {
      id: 'letter',
      caption:
        'A cover letter is a variant too — the same profile, with its own recipient and paragraphs.',
      spot: '[data-tour-spot="variants"]',
      // Phones: frame the document, now re-rendered as the letter this variant selects.
      spotMobile: '[data-tour-spot="document"]',
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
      spot: '[data-tour-spot="export"]',
      // Phones: Export lives inside the ☰ menu (File → Export) — point at the menu.
      spotMobile: '.menubar .hamburger',
      enter() {
        editor.variants.select(null);
      },
    },
  ];
}
