# The design idea — ethos & principles (iteration 1)

This is not a component spec. It is the *idea* the site is trying to be, stated as a
small set of load-bearing laws — so future design decisions get **better**, not merely
consistent. It reads the current CSS back to itself, names where the implementation is
*less than the idea*, and proposes the elevated version. Iterate on the laws, not the pixels.

---

## 0. Where the design comes from

The site does not have a bespoke design system. It **adopts an operating system**:

- **`@sakun/system.css@0.1.11`** — a faithful re-creation of Apple **System 6** (1988), loaded
  from unpkg with SRI (`BaseLayout.astro:48`). It owns the chrome: windows, title bars, the
  menu bar, buttons, inputs, scrollbars, dialogs.
- **Local layer, three files, deliberately thin:**
  - `packages/system-six/styles/tokens.css` — *"System 6 palette: one warm ink on paper (a
    warm-gray ramp, no pure black), plus the status light and a single résumé accent."* Type roles
    (Chicago / Geneva / Monaco), the space/size scale, a warm ink ramp, the status scale, and one accent.
  - `packages/system-six/styles/base.css` — *"system.css provides… We only add what it doesn't cover."*
  - `public/ui-kit/ui-kit.js` — the behaviors system.css can't express: the theme toggle
    (`data-theme` + `localStorage["sm-theme"]`) and the connect widget's **status dot**
    (`ui-connect-dot[data-state]`).

The stance is the first thing to notice: **deference, not theming.** The design's confidence
comes from committing to a real, coherent visual language instead of inventing one.

---

## 1. The ethos the code already lives by

Five laws are *already* in the CSS, unnamed. Naming them is half the work.

1. **Adopt the machine, don't theme it.** `base.css` adds only gaps. Restraint is the method.
2. **Warm near-monochrome is content; color is signal.** Almost everything a person *reads* is warm
   ink on paper — a near-black `--ink` and a short warm-gray ramp, not pure black/white/gray. The one
   standing exception is the résumé's crimson `--accent`; past it, the status scale is the only color,
   and it stays genuinely rare — reserved for machine state.
3. **Every state change is an inversion.** Hover, `::selection`, and focus all flip black↔white
   (`a:hover{background:#000;color:#fff}`, `.finder-icon:hover .icon-glyph{filter:invert(1)}`).
   No glows, no color-shift, no elevation. One motion, everywhere.
4. **Hard truth, no blur.** 1–2px solid `#000`, hard `2px 2px 0` shadows, zero border-radius.
   The pixel is honest about being a pixel.
5. **The OS is the information architecture.** Finder icons, windows, and the menu bar *are* the
   navigation — not a metaphor layered on top of a nav, the nav itself.

Two more are implied by the recent behavioral work, not yet by the stylesheet:

6. **Demo-first / confident default.** An app with no backend renders its free tier, never an
   error wall (the two-tier work; classifier + nonogram; ADR-001).
7. **The interface narrates its own state.** Health dots, the connect widget, demo-vs-live, and
   the BB84 pipeline stepper all show the machine's status as chrome.

---

## 2. Where the specific designs fall short of the idea

The idea is bigger than today's implementation. Three honest gaps — closing them makes the
design *more itself*, which is different from more retro.

**A. The grays betray System 6.** `tokens.css` says it plainly: *"dither patterns (future-ready,
flat grays for now)."* System 6 had **no grays** — it dithered 1-bit black/white to fake them.
The flat `#ccc / #eee / #666` are the one inauthentic move in an otherwise authentic system.
The *idea* says dither; the CSS says flat. This is the single highest-leverage gap.
**(Iterations 2–3 — CLOSED. `src/styles/dither.css` ships a 1-bit ordered ramp as SVG
data-URIs, and every live flat-gray fill is now either dither or a white inset. Two
findings from doing it, both sharper than the theory:**
- **Dither density is a legibility budget.** `--dither-light` reads fine behind *bold,
  spaced* text (nonogram clue numbers) but not behind *dense monospace* (inline `code`).
  The threshold is text density, not just tone — L5 in practice.
- **Not every gray should become dither; some should stop existing.** Inline `code` was
  flat `#eee` behind small text — the right answer was neither gray nor dither but a
  **white inset** (border does the work), which is more System 6 than the gray was. A gap
  can close by *deletion*, not only substitution.
**Residue: the desktop-pattern fallback `#eee` (correct) and two dead unused tokens.)**

**B. The tokens lie about hierarchy. — CLOSED (iteration 4).** The audit was worse than the
symptom: the 16-token color layer was ~90% dead cargo-cult — `--color-bg / text / border /
accent / surface / …` all had **zero uses**; the site draws with literal `#000/#fff` by choice
(`base.css`'s deference to system.css). Only `--color-text-secondary` (→ `#000`, the lie) and
the status scale were live. Fix: **deleted 8** liars/dead/dup (`surface`, `surface-2`,
`border-focus`, `text-secondary`, `accent`, `accent-hover`, `accent-muted`, `warn`), **kept 8**
— five honest ink primitives (`bg`, `text`, `text-inverse`, `border`, the one `text-muted` gray)
plus the three-color status scale — repointed the 3 secondary usages to `--color-text` (identical
black; hierarchy stays typographic = L5), and added a test that fails if a chromatic-hierarchy
token ever returns. `tokens.css` now states L2/L3/L5 as its own docstring. The finding worth
keeping: **the biggest lie wasn't a wrong value, it was a whole vocabulary nobody used** —
honesty here meant deletion, like gap A's white insets.

**(Reopened — warm-palette iteration.** The later "standardize to warm" pass brought `--accent`
back, but *earned* this time: one crimson (`#9c2b3f`) on the résumé's section labels and the
editor's active state — real uses, not dead cargo. And the site no longer draws with literal
`#000/#fff`; it draws through `var(--ink)` / `var(--paper)` — a single warm ink, a gray ramp, and
paper tints, every value a token behind a `lint:tokens` gate. The iteration-4 finding still holds —
*delete the vocabulary nobody uses* — but a vocabulary the design genuinely needs is honest to name.
See `docs/design-system.md`.)**

**C. "Color = signal" is a practice, not a law.** It's true in the code but written nowhere, so
every new feature re-decides it — the QBER stepper, the health dots, and demo/live each invented
their own greens and reds. Unwritten, it drifts.

---

## 3. The elevated laws (the design idea, sharpened)

Seven laws. Each names the **channel** it works through, so decisions have somewhere to go.

- **L1 — Adopt, don't theme.** system.css owns the chrome. We add only what it lacks, in its
  own idiom. *(unchanged; still the foundation)*
- **L2 — One ink.** Content is 1-bit: black on white, inverted in dark mode. **Grays are
  *dithered*, never flat.** *(closes gap A — the tokens' own stated intent, finally executed)*
  **(Warm-palette update: the "one ink" is now a warm near-black, `--ink #1c1b19`, and de-emphasized
  *text* runs a short warm-gray ramp (`--ink-2…5`) instead of a lone `#666`. This is ink for text —
  *fills* are still dither, never a flat gray palette — and the whole-page invert still holds.)**
- **L3 — Color is a status light.** Color appears *only* when the machine reports state:
  success, warning, danger, live. If nothing is happening, there is no color. *(promotes practice
  C to law; makes the rare color moments mean something)*
  **(Warm-palette update: one standing exception now — the résumé's `--accent` crimson, a deliberate
  brand mark on section labels + the editor's active state. It is the single decorative hue; every
  other color still obeys the law.)**
- **L4 — State is inversion, at every scale.** From the whole page (dark mode) to a single cell
  (a selected item, a failed QBER round), every "on / active / selected / changed" is a black↔white
  flip. *(generalizes idiom #3 into the site's one motion language)*
  **(Realized, iteration 5.** Dark mode was dead vestige — a `UIKit.initThemeToggle` no one called,
  no toggle rendered, no dark CSS, a missing `theme-bootstrap.js`, and a comment falsely claiming
  "the portal owns theming globally." Now real: `html[data-theme='dark'] { filter: invert(1)
  hue-rotate(180deg) }` — dark mode is literally the page as a photographic negative, the same
  inversion idiom at the largest scale. It's a *one-liner with zero exceptions* only because the
  design is honestly 1-bit + monochrome-SVG (L2): every pixel and image flips correctly, and
  `hue-rotate` keeps the status scale (L3) on-hue while lightening it for contrast on black. The
  law's flagship example is now the code, not a wish. Caveat worth remembering: the no-FOUC
  bootstrap is an `is:inline` script Astro won't auto-hash, so its CSP hash is pinned by hand and
  guarded by `tests/integration/csp.test.ts`.)**
- **L5 — Hierarchy is spatial and typographic, never chromatic.** Rank by weight, dither density,
  chrome, and whitespace. Name tokens for what they do; delete the chromatic lies. *(closes gap B)*
- **L6 — The interface tells the truth about its own state.** Demo vs live, connected vs degraded,
  secure vs compromised — always shown as chrome (a dot, a badge, a stepper), never hidden. This
  is the site's real subject: *systems that are honest about what they're doing.* *(elevates
  behaviors 6–7 into one design law; unifies health dots + demo-first + the pipeline stepper)*
- **L7 — One surface; depth on demand.** One page, one window per thing. Detail lives behind a
  "?" or inside a title-bar, not scattered across routes. *(from the one-page consolidation +
  writeup modals)*
- **L8 — The artifact survives the medium.** Print stylesheet, reduced-motion, responsive
  `clamp()`, SRI'd dependencies. Craft in the parts nobody screenshots. *(already true in
  `base.css`; kept as a law so it stays true)*

The through-line, and the reason this is a portfolio for *this* person: **the aesthetic and the
subject are the same argument.** A 1-bit interface that never lies about its own state, sitting
in front of quantum-key exchange and in-browser inference that never lie about their metrics.
The design isn't retro decoration — it's the thesis rendered in chrome.

---

## 4. Next iterations to try (highest leverage first)

1. ~~**Build + roll out the dither layer.**~~ **DONE (iterations 2–3)** — `src/styles/dither.css`
   wired into `BaseLayout.astro`; every flat-gray fill mapped (decorative chrome → dither, dense-text
   surfaces → white inset). Gap A closed.
2. ~~**Re-ground the tokens.**~~ **DONE (iteration 4)** — gap B closed: the dead/lying color
   layer is deleted, `tokens.css` carries only honest primitives + the status scale, and a test
   guards against the lie returning.
2. **Rename the collapsed tokens** to their real jobs; delete `--color-*` values that only equal
   `#000`. The token file should stop describing a design the site doesn't have.
3. **Write the "status light" contract** into `tokens.css` as the semantic scale's docstring, and
   route every feature's state color through that one scale (QBER stepper, health dots, demo/live).
4. **Ship a "state" chrome kit** — dot, badge, stepper — one vocabulary for L6, so every app
   narrates its state the same way instead of re-inventing it.

---

## 5. Iterations 2–5 (done)

The dither layer (2–3), the token honesty pass (4), and a real dark mode (5) all landed — see
the DONE notes in §2 and §4 and the law they each realize. What's left open is the last §5
question below, now answered.

---

## 6. The center — the open question, resolved

*Is L6 ("honest state") the center of the idea, or one law among equals?* The only test that
means anything: does L6 **generate** the other laws?

- It generates **two**: L3 (color = status light is just "color is *how* state is told") and L4
  (inversion is *how* a state change is shown). Both are corollaries of L6.
- It generates **nothing else** — not L2 (one ink), not L5 (typographic hierarchy), not L1 (the
  method). You could build a scrupulously state-honest interface in full color. So L6 is a strong
  law with a cluster, **but it is not the root.**

There's a second root, and it reaches further: **L1** (adopt the 1-bit machine) → **L2** (one ink)
→ **L5** (no color to rank with) — and L2 *enables* **L4** (you can only flip between two values).
So there are two spines — an **ethic** spine (L6 → L3, L4) and a **form** spine (L1 → L2 → L5, L4)
— and they **intersect at L3 and L4**. That intersection is why those two are unkillable: they are
load-bearing for both roots at once.

**The center is that the two roots are the same thing: L2 ≡ L6.** A 1-bit medium and a
state-honest interface are one commitment seen from two directions. 1-bit does not *guarantee*
honesty — you can still write a false label — but it **removes the hiding places**: no muddy middle
to fudge a "sort of," no decorative color to bury the signal, no soft shadow faking depth. A thing
is on or off; a change is a flip; color, when it appears at all, *has* to mean something.
**1-bit is honesty rendered as a medium. The form is the ethic.**

The evidence is this document's own history. Every gap closed in iterations 2–5 was the *same move*
— dither the fake grays, delete a gray for a white inset, tear out the lying/dead tokens, invert
the whole page for dark mode. Each was "make the form honestly 1-bit," which is identical to "make
it structurally truthful." **The work converged on the L2/L6 seam before it was named.**

**Reclassified around the center:**

| role | laws |
|---|---|
| **Center** — form = ethic | **L2 ≡ L6** |
| **Load-bearing intersection** (both roots; unkillable) | **L3, L4** |
| **Origin** (method that handed us the medium) | **L1** |
| **Consequence** | **L5** |
| **Periphery** — earned, not central (each still carries a faint honesty thread: L7 = honest *disclosure*, L8's SRI = dependency *integrity*) | **L7, L8** |

So the answer is neither "yes" nor "one of equals": **L6 is half of the center; L2 is the other
half; and that they are the same thing is the whole idea.**
