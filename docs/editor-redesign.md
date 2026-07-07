# CV Editor — Redesign (Document-First)

> **Status:** design agreed, not yet built. This is the north star for the ground-up
> frontend rewrite of the LaTeX résumé editor (`src/pages/projects/latex-resume-editor/`).
> The backend (cv on Railway) and the API are **not** changing — this is a frontend rewrite.
>
> **Mockups:** [desktop](https://claude.ai/code/artifact/833eccbd-4ca3-4884-b684-e7e6aa6c4a54) ·
> [mobile](https://claude.ai/code/artifact/eae19394-7a4a-48d3-b5d4-fa710927a18e)

---

## 1. Concept

**Edit the résumé as the document it is** — one centered, editable document, not a three-pane
IDE. The résumé *looks like a résumé while you edit it*; the compiled PDF is a **toggle**, not a
permanent pane.

- **Rejected: three-pane** (outline · form · preview). Too dense, needs a wide screen, three
  focuses competing, reads "tool" not "document."
- **Aesthetic: System 6 / classic Mac** — honor the portal's existing `system.css` identity
  (hairline black chrome, striped window title bars, selection via inversion, warm paper).
  UI chrome in a sans; the résumé prose in a serif — different materials.
- **Honest caveat:** the inline document is a *friendly approximation*, not the LaTeX truth.
  You **write** in the document; you **verify** in the preview. That's why preview matters and
  why it's one tap away.

## 2. Constraints & infrastructure

- **Stays on Astro (static) + GitHub Pages.** This is a client-side app that fetches from the cv
  API via the gateway; no SSR, no host-side compute needed. (Cloudflare Pages consolidation was
  considered and **tabled** — a nicety, not a need.)
- **Framework:** free choice as long as the build is static — an **Astro island**
  (React / Svelte / Solid / vanilla) is the cleanest path. Only `output: 'server'` would break Pages.
- **Auth:** `api.andypeterson.dev` is behind **Cloudflare Access** (Google IdP). Fetches are
  **credentialed** (`credentials: 'include'`) so the Access cookie rides along. Tiers: any Google =
  **demo** (public person 1, read-only); owner = **full**. Not signed in → the connect fails
  gracefully → "Sign in with Google" affordance (`/cdn-cgi/access/login/…`).
- The single hardcoded gateway reference today is the Access login URL — keep that pattern.

## 3. Data model — build against this

The cv backend stores a **normalized** model (`GET /api/persons/:id` returns the whole tree). The
one thing the old editor under-modeled: **sections are polymorphic.** There are **16 section types
in 3 categories, across 5 shapes** — the inline editor must be **type-aware**.

| Shape (`latexType`) | Section types | Fields | Bullets |
|---|---|---|---|
| `cventries` | experience, education, projects, presentations, leadership, volunteer, committees, extracurricular, writing | position · organization · location · date *(education adds `program` ▾ + `major`, combined into the title)* | **yes** |
| `cvskills` | skills | category · skills | no |
| `cvhonors` | honors, certifications | award · issuer · location · date | no |
| `cvparagraph` | summary | a single free-text block | no |
| `cvreferences` | references | name · relation · phone · email | no |

Categories for the "Add section" picker: **Roles** (the `cventries` set), **Achievements**
(honors, certifications), **Other** (skills, summary, references).

Other shape facts:
- **Bullets carry `title` + `content`** (a bold lead-in + body).
- **Section titles are derived** — each type has a `titleField` + `titleFallback` (e.g. organization → position).
- Each type has its own `entryLabel` / `itemLabel` ("Role"/"Bullet", "Degree"/"Detail", …).
- **Tags** live on entries *and* items; plus per-person **aliases** (synonyms) and a **catalog** (curated vocab).
- **Variants** are tag-rule-driven views (include/exclude) + section selection/order + per-entry/item
  overrides; `kind ∈ {cv, resume, coverletter}`; each can point at a layout.
- **Global style** = `~26` knobs: STYLE (page size, base font size, accent from a named palette —
  default `spinel` — font family `source-sans-3`), SPACING (`~18` LaTeX margins/skips), SIZES (`~8`).

## 4. Layout — surfaces

The three logical jobs (navigate · edit · preview) collapse into **one document + overlays.**

```
┌──────────────────────────────────────────────────────────────┐
│ CV Editor   Profile ▾   Variant ▾ ⚙   Tags Layout Style  ◱ Preview │
├──────────────────────────────────────────────────────────────┤
│         Andrew Peterson                                        │
│         Senior Software Engineer · … · San Francisco           │
│         ── EXPERIENCE ──────────────────────────────  + ⠿      │
│         Senior Software Engineer · Acme        2022 – Present   │
│           • Microservices migration — …               #backend │
│           ┌ inline edit (type-aware fields, expand in place) ┐ │
│         ── SKILLS ─────────────────────────────────────────── │
│           Languages   JavaScript · Python · Go · Rust          │
│                                              + Add section      │
├──────────────────────────────────────────────────────────────┤
│ ✓ saved · Main                          ⌘K · ⤒ jump to        │
└──────────────────────────────────────────────────────────────┘
```

- **The document = the outline.** No separate tree pane. Navigation is scroll + a `⌘K` command
  palette + a lightweight "jump-to." Drag handles reorder at every level.
- **Inline editing, expand-in-place.** Click a node → its **type-aware** fields open right there and
  collapse back to the rendered line. No form pane. (This is the polymorphism from §3 — design it
  deliberately, don't special-case `experience`.)
- **Preview is a toggle, not a pane.** `◱ Preview` splits in the compiled PDF (or full-screen on
  mobile); dismiss for the clean single column. Compile is **debounced/manual**, not per-keystroke
  (LaTeX is seconds + rate-limited).
- **Variant lens.** Selecting a variant (vs. "Main") paints the resolved result **onto** the main:
  excluded content stays **visible, dimmed + struck**, overrides get a badge, each cut item has a
  one-tap re-include. You shape the variant *while reading it* — the argument for a lens over a
  separate "variant builder." The dimming is just `GET /variants/:id/resolve` rendered in place.
- **Autosave** — every edit persists; show `saved / saving / error`. No Save button.
- **Demo state** — not signed in → the sample (Jane Doe) renders read-only + a sign-in affordance.

## 5. Drawers (secondary surfaces — System 6 dialogs / mobile bottom sheets)

| Drawer | Opened by | Contents | Endpoints |
|---|---|---|---|
| **Variant settings** | ⚙ next to the variant selector | kind · include/exclude tag chips · section checklist (drag) · overrides list · layout · *Resolve preview* | `…/variants/:id/{rules,sections,overrides,layout,resolve}` |
| **Tag manager** | Tags | vocabulary (usage counts) · aliases (`k8s → kubernetes`) · catalog (tag · desc · category) · suggest / seed | `…/persons/:id/{tags,tag-aliases,tags/catalog,tags/suggest…}` |
| **Layouts** | Layout | installed layouts (name · version · engine · kinds · status/source) · set default · verify/delete · sandboxed upload | `…/layouts…` |
| **Style** | Style | tabbed **Style / Spacing / Sizes** (page/base/family, accent swatches, the `~26` knobs) | `GET`·`PATCH /api/settings`, `GET /api/catalog` |

## 6. Feature → endpoint checklist (build order within each)

Auth: everything except `/health`, `/api`, `/api/catalog`, and public-person reads is owner-gated.

**A · Session** — sign-in `GET …/cdn-cgi/access/login/…` · liveness `GET /health` · `GET /api/health`
**B · Profiles** — `GET·POST /api/persons` · `GET·PUT·DELETE /api/persons/:id` · `GET·PATCH /api/persons/:id/personal` · `GET /…/export` · `POST /…/import`
**C · Content** — load `GET /api/persons/:id` · sections `POST /api/persons/:id/sections`, `PATCH /…/sections/order`, `PUT·DELETE /api/sections/:id` · entries `POST /api/sections/:id/entries`, `PATCH /…/entries/order`, `PUT·DELETE /api/entries/:id` · bullets `POST /api/entries/:id/items`, `PATCH /…/items/order`, `PUT·DELETE /api/items/:id`
**D · Tags** — `POST·DELETE /api/entries/:id/tags[/:tag]` · `POST·DELETE /api/items/:id/tags[/:tag]` · `GET /api/persons/:id/tags` · `…/tags/search` · `GET·PUT·DELETE …/tag-aliases[/:alias]` · `GET·PUT·DELETE …/tags/catalog[/:tag]` · `…/tags/catalog/seed` · `…/tags/suggest` · `…/tags/suggest-bulk`
**E · Variants** — `GET·POST /api/persons/:id/variants` · `GET·PUT·DELETE /api/variants/:id` · `PUT /…/rules` · `POST /…/rules/expand` · `PUT /…/sections` · `PUT /…/overrides` · `PUT /…/layout` · `GET /…/resolve`
**F · Cover letters** *(PARKED — see §8)* — header via `PATCH /api/persons/:id/personal` *(coverletter.* keys — confirm)* · body `GET·POST /api/variants/:id/letter-sections`, `PUT·DELETE /…/:lid`, `PATCH /…/order`
**G · Compile** — `GET /api/variants/:id/pdf` · `POST /api/variants/:id/compile` (log) · `GET /…/resolve`
**H · Layouts** — `GET /api/layouts` · `GET·PUT /api/layouts/default` · `GET /api/layouts/:id` · `POST /api/layouts` · `POST /…/verify` · `DELETE /…/:id`
**I · Style** — `GET·PATCH /api/settings`
**J · Plumbing** — discovery `GET /api` · pickers `GET /api/catalog`

## 7. Mobile

Document-first is *already* mostly mobile-ready (one column). Conventions:

- Primary actions in the **bottom thumb-zone bar** (Preview · Add · Variant · More).
- Drawers become **drag-handled bottom sheets**, not center modals.
- Touch targets **≥ 44 px**; inputs at **16 px** to prevent iOS auto-zoom on focus.
- **Preview is a full-screen view** (no split at phone width).
- Compact sticky header + bottom bar; the document scrolls between; safe-area / home-indicator respected.

## 8. Scope & what's parked

**Core loop (MVP):** session (A) → profile + personal (B) → content tree with type-aware inline
edit (C) → tags (D) → one default variant → compile/preview/download (G). Groups **A · B · C · G**
plus a single variant.

**Power-user axes — stage or defer:** Variants (E) · ML tag-suggest (D) · custom layout upload (H) ·
multi-profile (B) · import/export (B).

**Parked — "add to the site later":**
- **Cover letters (F).** The document becomes a letter: header fields (`person_settings` `coverletter.*`)
  + reorderable body paragraphs (`variant_letter_sections`), driven by a `coverletter`-kind variant.
  Same single-column shape when we build it — just different content. Not in the first build.

## 9. Open questions / revisit as it grows

- **Compile cadence** — start debounced/manual; revisit server-side PDF caching for a more "live" feel.
- **API shape** — the granular REST is great for the MCP but chatty for a document editor; a thin
  `GET`/`PUT /api/persons/:id` document layer could simplify the frontend. **GraphQL** was floated and
  **tabled for later**. Keep the normalized DB regardless.
- **Error envelope** isn't 100% uniform (compile, auth 401, ajv failures deviate from `{error:{code,message}}`) —
  worth normalizing, and the frontend should tolerate it.
- **Persistence** — confirm the cv Railway service mounts a volume at `/data` with `CV_DB_PATH=/data/cv.db`
  (else redeploys reset to seed). Not provable from the repo.
- **F-header endpoint** is inferred (`coverletter.*` via `…/personal`) — verify when cover letters land.
