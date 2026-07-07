# CV editor (document-first)

The résumé / CV / cover-letter editor: a **Svelte 5 island** mounted by Astro at
[`/projects/latex-resume-editor/app/`](../pages/projects/latex-resume-editor/app.astro),
built to static HTML on GitHub Pages and backed by the **Access-gated cv REST
API** at `api.andypeterson.dev/cv`. The portal owns this frontend; the backend
([`andypeterson2/cv`](https://github.com/andypeterson2/cv)) is API-only.

The design rationale is [`docs/editor-redesign.md`](../../docs/editor-redesign.md);
this README is the as-built map.

## How it mounts

`app.astro` renders `<Editor client:load />` inside a bare (chrome-stripped)
layout. The page HTML is server-rendered at build time, then the island
hydrates in the browser and, in `onMount`, probes the backend (`editor.connect()`).
There is no server at runtime — everything below the API boundary is static.

## Layout

```
Editor.svelte          root shell — menubar, toolbar, statusbar, drawers, save toast
components/
  Document.svelte      the rendered résumé (sections → entries → bullets)
  EntryEdit.svelte     type-aware inline editor for one entry
  PersonalEdit.svelte  the header/contact fields
  LetterEditor.svelte  cover-letter mode (header + paragraphs)
  TagChips.svelte      inline tag add/remove on an entry
  Drawer.svelte        slide-in panel frame; *Drawer.svelte are its contents
  {Style,Layouts,Tags,Variant,Profiles}Drawer.svelte
lib/
  store.svelte.ts      EditorState — the single reactive store (see below)
  api.ts               REST client, the wire⇄view mappers, LaTeX escaping, auth
  types.ts             Person / Section / Entry / Item / Variant / LetterSection
  demo.ts              the fictional demo persona (Jordan Rivera) + demo letters
  section-types.ts     the section catalog (fields, labels, defaults) per type
  variant-lens.ts      resolves which entries a variant's rules include/exclude
  export.ts            builds the import-compatible JSON snapshot
  accent.ts            accent-name → hex
  sortable.ts          drag-reorder action (pointer + keyboard)
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

> The store is ~750 lines and does a lot — it's the known "god object"
> ([tech-debt #11](../../docs/) register). Split with care: the reactive wiring
> is dense and the e2e suite is the safety net.

## Talking to the backend — `api.ts`

The cv API is **id-addressable**: `GET /persons` lists profiles, `GET /persons/:pid`
returns one full document ("main"), and CRUD hangs off `/persons/:pid/...`,
`/entries/:id`, `/items/:id`, etc. `api.ts` wraps `fetch` (always
`credentials: 'include'` for the Access cookie), unwraps the response envelope,
and maps the wire shape ⇄ the view types.

**Auth (Cloudflare Access).** `connect()` probes `GET /persons`:
- **200** → signed-in owner; load the real document(s).
- **403** → Access is blocking; show a "Sign in with Google" affordance that
  opens the Access login (popup → `/persons`), never a hand-built URL.
- **network error** → stay on the demo, offline.

**LaTeX escaping** (`tex` / `untex`) is deliberately *light-LaTeX-aware*: it
escapes `% & $ # _` and en-dashes but leaves `\command`, `{}`, `~`, `^` intact
(via a `(?<!\\)` negative lookbehind), so fields can carry real macros
(`\textbf{…}`, `\qiQubitCount`) round-trip. Widening it would mangle the real
CV — this is a documented tradeoff, not a gap.

## Kept in sync with the backend (by hand)

Three pieces of logic are **duplicated** in the cv backend and here. They live
in separate repos with no shared package (the submodule was removed), so there
is no import to dedupe them — the mitigation is to know they're coupled and
change both sides together ([tech-debt #10](../../docs/)):

| Knowledge | Backend (cv) | Frontend (here) | Drift shows up as |
|---|---|---|---|
| LaTeX escaping | `editor/lib/serializer.js` (final `.tex`) | `api.ts` `tex`/`untex` (edit display) | a char renders raw in one, escaped in the other |
| Section-type catalog | `GET /api/catalog` → `validSectionTypes` | `section-types.ts` (types + fields + labels) | a backend-only type has no editor UI |
| Variant include/exclude | `editor/lib/db/variants.js` | `variant-lens.ts` (client preview) | the preview dims different entries than the compiled PDF |

The escaping overlap is the mildest (the two encode the same rule for different
outputs); the catalog and variant-lens are the ones to watch — the backend is
authoritative, so if the two disagree, the backend wins and this side is the bug.

## Demo mode

Not signed in → the editor renders a **fictional** persona (Jordan Rivera, in
`demo.ts` — the repo is public and PII-gated, so demo data must never be real)
and is fully editable **locally**. Nothing persists; a **Download JSON** action
exports the current document in the same shape the backend's import accepts, so
a demo session isn't lost.

## Save-error toast

A failed persist surfaces a System-6 alert toast, not just the muted statusbar
tick. It offers **Retry** only where re-sending is safe — the field PUTs, which
route through `push*` helpers that re-read the field's current value. Creates
pass no retry (the failed one was already rolled back; a blind re-POST would
orphan a server row); they still raise the toast, minus the button.

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
