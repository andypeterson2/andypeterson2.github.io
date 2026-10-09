# CV editor (document-first)

The resume / CV / cover-letter editor: a **Svelte 5 island** mounted by Astro at
[`/projects/latex-resume-editor/app/`](../pages/projects/latex-resume-editor/app.astro),
built to static HTML on Cloudflare Pages and backed by the **cv REST API** at
`api.andypeterson.dev/cv`, reached through the gateway after a Google sign-in
(the gateway's self-hosted OIDC flow; an allowlisted owner sees every profile). The portal owns this frontend; the backend
([`andypeterson2/cv`](https://github.com/andypeterson2/cv)) is API-only.

this README is the as-built map.

## How it mounts

`app.astro` renders `<Editor client:load />` through `DemoShell`, in the same
emulated window every other page uses, with `ownScroll` so the editor scrolls its
own regions instead of the pane. The page HTML is server-rendered at build time,
then the island hydrates in the browser and, in `onMount`, probes the backend
(`editor.connect()`). There is no server at runtime — everything below the API
boundary is static.

## Layout

```
Editor.svelte          root shell — toolbar, drawers, modals, error toast
components/
  Document.svelte      the rendered resume (sections → entries → bullets)
  EntryEdit.svelte     type-aware editor for one entry (always open)
  PersonalEdit.svelte  the header/contact fields, as a section like the rest
  LetterEditor.svelte  cover-letter mode (header + paragraphs)
  PdfView.svelte       the preview pane — pdf.js onto a canvas, never an iframe
  SymbolPalette.svelte the permitted glyphs, as chips, for the Symbols popup
  TagChips.svelte      inline tag add/remove on an entry
  UnknownWarning.svelte an unrecognised section type, named rather than hidden
  Drawer.svelte        slide-in panel frame; *Drawer.svelte are its contents
  {Style,Layouts,Tags,Variant,Profiles,History}Drawer.svelte
  ui/Button.svelte     every button — variants, and the out-of-reach convention
lib/
  store.svelte.ts      EditorState — the single reactive store (see below)
  api.ts               REST client, the wire⇄view mappers, LaTeX escaping, auth
  types.ts             Person / Section / Entry / Item / Variant / LetterSection
  demo.ts              the offline demo resume (owner's public CV) + demo letters
  section-types.ts     the section catalog (fields, labels, defaults) per type
  variant-lens.ts      resolves which entries a variant's rules include/exclude
  export.ts            builds the import-compatible JSON snapshot
  linkedin.ts          the work history as paste-ready blocks + fingerprints
  draft.ts             carries a visitor's demo edits across the sign-in redirect
  history.svelte.ts    snapshots, branches and restores (signed in only)
  letters.svelte.ts    cover-letter sections and header
  tags.svelte.ts       the tag vocabulary, highlight and catalog calls
  variants.svelte.ts   the variant list, its rules and the active lens
  suggest.svelte.ts    tag suggestions, asked for on demand
  preview.svelte.ts    compile requests and the PDF blob the preview shows
  symbol-input.svelte.ts  one open state for the Symbols popup + where to insert
  symbols.ts           the permitted-symbol allowlist
  caret.ts             insert at a field's caret and fire an input event
  autogrow.ts          a textarea that is always as tall as its text
  sortable.ts          drag-reorder action (pointer + keyboard + edge scroll)
  modal.ts             focus trap, Escape and scrim behaviour for a popup
  undo.ts / undo.svelte.ts  the command stack behind Undo/Redo
  diff.ts              what changed between two documents (for History)
  host.ts / wire.ts    the save plumbing the slice-controllers share
  profile-cache.ts     working trees of the profiles visited this session
  util.ts              array move, and the PDF's download name
  accent.ts            accent-name → hex
  styles.css           System-6 look
```

## The store — `EditorState`

One class in `store.svelte.ts`, exported as the `editor` singleton, holds all
UI state as Svelte 5 runes (`$state` / `$derived`). Components read fields
directly (`editor.person`, `editor.saveState`, …) and call methods to mutate.

- **Content model** — `person` is the document: `personal` + `sections[]` (each
  with `entries[]`, each with `items[]`). `variants[]` are alternate lenses.
- **Derived views** — e.g. `tagVocab`, `activeVariant`, `profileLabel`,
  `accentHex` recompute automatically from the content.
- **Optimistic writes** — mutations apply locally first, then persist. Creates
  push a temp id (`seq++`) and reconcile it to the server id on success; **on
  failure they roll back** the temp node so nothing phantom is left behind.
- **Autosave** — field edits are debounced (~600 ms) then PUT; state flows
  `saving → saved | error`. A failed save raises a **retry toast** (see below).

> The store is ~1200 lines and does a lot. Split it with care: the reactive
> wiring is dense and the e2e suite is the safety net.

## Talking to the backend — `api.ts`

The cv API is **id-addressable**: `GET /persons` lists profiles, `GET /persons/:pid`
returns one full document ("main"), and CRUD hangs off `/persons/:pid/...`,
`/entries/:id`, `/items/:id`, etc. `api.ts` wraps `fetch` (always
`credentials: 'include'` for the session cookie), unwraps the `{ ok, data }` reply,
and maps the wire shape ⇄ the view types.

**Auth (Google, via the gateway's own OIDC).** `connect()` asks `GET /auth/me`
first, then loads:
- **a session** → load that account's profiles and documents.
- **no session** → stay in the local demo. The backend answers an anonymous
  request with the shared public person, so a logged-out visitor's edits must
  never be sent anywhere.
- **network error** → stay on the demo, offline.

Signing in happens in the site menu bar, not here. The editor only listens:
`site:signin` is cancellable, so `prepareSignIn()` stashes a visitor's demo
edits (sessionStorage, one hour) before the redirect and offers to import them
as a profile afterwards.

**LaTeX escaping** (`tex` / `untex`) is *light-LaTeX-aware* by design: it
escapes `% & $ # _` and en-dashes but leaves `\command`, `{}`, `~`, `^` intact
(via a `(?<!\\)` negative lookbehind), so fields can carry real macros
(`\textbf{…}`, `\qiQubitCount`) round-trip. Widening it would mangle the real
CV — this is a documented tradeoff, not a gap.

## Kept in sync with the backend (by hand)

Four pieces of logic are **duplicated** in the cv backend and here. They live
in separate repos with no shared package, so there is no import to dedupe them.
Know they are coupled and change both sides together:

| Knowledge | Backend (cv) | Frontend (here) | A mismatch shows up as |
|---|---|---|---|
| LaTeX escaping | `editor/lib/serializer.js` (final `.tex`) | `api.ts` `tex`/`untex` (edit display) | a char renders raw in one, escaped in the other |
| Section-type catalog | `GET /api/catalog` → `validSectionTypes` | `section-types.ts` (types + fields + labels) | a backend-only type has no editor UI |
| Variant include/exclude | `editor/lib/db/variants.js` | `variant-lens.ts` (client preview) | the preview dims different entries than the compiled PDF |
| LinkedIn blocks | `editor/lib/linkedin.js` | `linkedin.ts` | the two fingerprint the same position differently |

The escaping overlap is the mildest (the two encode the same rule for different
outputs). The backend is authoritative: if the two disagree, this side is the
bug. The LinkedIn fingerprints are pinned digit for digit in
[`tests/editor-linkedin.test.ts`](../../tests/editor-linkedin.test.ts).

## Demo mode

Not signed in → the editor renders the owner's **public CV** (`demo.ts`) and is
fully editable **locally**. The professional history is hardcoded (the same public
narrative as the About page), but the identity — name + contacts — is NOT: it is
resolved from `siteConfig` on the server and passed in as the `identity` prop, so
committed source carries no protected PII and only the
public business contacts (email / GitHub / LinkedIn) ever render. Nothing persists.
**Export ▸ JSON** writes the current document in the same shape the backend's
import accepts, so a demo session isn't lost, and **Clear** empties it to a blank
document (undoable) for anyone who wants to see what starting from nothing is like.

## The toolbar

Three rows, because the controls answer to three different things. The top row is
the document as a whole — Resume, Variant, History, Export — with the save notice
pushed to the right edge. Below it the row splits on the same seam as the panes:
what edits the document on the left (Undo, Redo, Clear, Tags, Style, Symbols),
what makes the PDF on the right (Layout, Preview, Compile). The split holds even
with the preview closed, so nothing moves when it opens.

A control nobody can use yet is never natively `disabled` — that drops it out of
the tab order and answers no hover. It carries `aria-disabled`, the reason in
`title`, and a click guard, which is what the nonogram does; `ui/Button.svelte`
owns all three.

## Error toast

A failed persist raises a System-6 alert toast rather than only a muted tick. It
offers **Retry** only where re-sending is safe — the field PUTs, which route
through `push*` helpers that re-read the field's current value. Creates pass no
retry (the failed one was already rolled back; a blind re-POST would orphan a
server row); they still raise the toast, minus the button. `fail()` raises the
same toast for a failure that was never a save, like a LinkedIn export on an
origin that withholds WebCrypto.

## Testing & the hydration marker

E2E lives in [`tests/e2e/cv-editor.spec.ts`](../../tests/e2e/cv-editor.spec.ts);
each test mocks the backend with `page.route` to stay off the real gateway.

Because this is a hydrating island, tests must not act before the handlers
attach. `onMount` sets `data-hydrated` on the `.stage` element; the shared
[`gotoEditor`](../../tests/e2e/helpers.ts) helper navigates and waits for that
marker, after which a single click lands on a live handler (no retry loops).
When you add interactive UI, keep that marker meaningful — it is the suite's
definition of "ready".

## Dev

From the repo root (Node 22): `npm run dev` (Astro dev server) — note the CSP
`<meta>` is injected only at **build** time, so `npm run build` reflects prod
more faithfully. `npm run test` runs the unit suite; `npx playwright test
tests/e2e/cv-editor.spec.ts` runs the editor e2e.
