# `system-six` — Web Components library, scope

A thin, framework-agnostic Web Components layer over the System-6 design system: custom
elements that **emit the real `system.css` classes and tokens** and carry **zero styling of
their own**. The design stays in CSS (single source of truth); the components just make the
class/token idiom composable, typed, and — because they're standard custom elements — usable
by the Astro site, by React, and by claude.ai/design alike.

This makes the [conventions doc](./design-system.md) *executable* and the
[ethos](./design-ethos.md) *shippable*.

## Goal / non-goal

- **Goal:** a reusable primitive set that renders the System-6 vocabulary, with an attribute
  API and a bundle — good enough to drop into any project and to sync to claude.ai/design.
- **Non-goal:** reimplementing any styling. If a component sets a color, a border, or a font,
  it's wrong — it must reach for the existing class/token. No restyle, no fork of the design.

## Architecture — thin, light-DOM, class-emitting

- **Light DOM, no Shadow DOM.** Each element renders its markup *into itself* with the real
  classes, so the global `system.css` / `tokens.css` / `dither.css` style it exactly as they
  style hand-written markup. (Shadow DOM would wall off the global CSS and force a re-import
  per element — the opposite of thin.) Trade-off accepted: no style encapsulation, which is
  the whole point here.
- **No CSS in JS.** Components emit classes and set `var(--*)` where a token is the API
  (e.g. status color). That's the only place a value appears.
- **Reactive where it earns it.** `attributeChangedCallback` for the dynamic ones (`s6-status`,
  `s6-theme-toggle`); the rest are render-once.
- **TypeScript → esbuild**, emitting: an **ESM** entry (Astro/import), an **IIFE global**
  (`window.SystemSix.*` for claude.ai/design), and **`.d.ts`** attribute contracts.

## The primitive set (v1)

Prefix `s6-`. Every "emits" column uses names already verified present in the build.

| Element | Attributes | Slot | Emits | Encodes |
|---|---|---|---|---|
| `s6-window` | `title`, `details?` | body | `.window › .title-bar > .title` (+ `.details-bar`) `› .window-body` | L1 (chrome) |
| `s6-button` | `variant` (`default`\|`danger`), `disabled` | label | `button.btn` (+ danger class *or* status color) | L1 |
| `s6-section-rule` | — | label | `.section-rule` (hairlines from base.css) | L5 |
| `s6-icon-grid` | — | icons | `.icon-grid` | L7 |
| `s6-finder-icon` | `glyph`, `label`, `href` | — | `a.finder-icon › .icon-glyph + .icon-label` | L1/L7 |
| `s6-dither` | `density` (`light`\|`25`\|`50`\|`75`\|`hatch`) | body | `.dither-<density>` | **L2 (one ink)** |
| `s6-status` | `state` (`success`\|`warning`\|`danger`\|`idle`), `label` | — | dot + label, `color: var(--color-<state>)` | **L3 + L6 (status light / honest state)** |
| `s6-theme-toggle` | `label?` | — | `button.theme-toggle` + `data-theme` flip + `localStorage['sm-theme']` | **L4 (inversion / dark)** |

The value concentrates in the last three: `s6-dither`, `s6-status`, and `s6-theme-toggle` are
the primitives that encode the design's *thesis* (1-bit, honest state, page-scale inversion) —
the rest are thin macros over `system.css` chrome.

**Build-time verifications** (minor, resolve when authoring): the exact `system.css` button
variant classes (is there a `.btn--danger`, or does danger route through the status scale?);
the precise `s6-finder-icon` inner structure (`.icon-box` wrapper?). Both are settled by
grepping the built CSS + the real `finder-icon` markup, not guesses.

## CSS as the single source of truth

The library ships **one** `styles.css` whose `@import` closure is the whole look — the exact
requirement claude.ai/design imposes. To make that honest, `src/styles/{tokens,base,dither}.css`
**move into the package** (`packages/system-six/styles/`), `system.css` is **vendored** (so the
closure is self-contained, not CDN-dependent), and **the Astro site imports `styles.css` from
the package**. One design, one home, consumed by both the site and the library. (The quick
alternative — the package references `../../src/styles` in place — ships faster but keeps two
owners; not recommended.)

## Package shape

```
packages/system-six/
  src/            elements/{window,button,dither,status,theme-toggle,…}.ts, index.ts
  styles/         tokens.css · base.css · dither.css · system.css (vendored) · styles.css (@imports the closure)
  dist/           system-six.esm.js · system-six.global.js · *.d.ts   ← the syncable bundle
  package.json · tsconfig · esbuild.config
```

## claude.ai/design sync — honest caveat

A Web Components bundle **is** syncable, but it's off the converter's happy path (that path
expects a React bundle exposing `window.X.Button`). So the real sync is the skill's **off-script
route**: hand-produce `_ds_bundle.js` (registers the elements) + author each component's `.d.ts`
(as *attribute* contracts), `.prompt.md`, and preview cards, with the existing
[`design-system.md`](./design-system.md) as the `readmeHeader`. The verification gates don't move
— every preview still gets graded. This is a real, separate phase, not a free `/design-sync`.

## Phasing & effort

1. **Foundation (~½–1 day)** — package + build tooling + CSS-into-package + `styles.css` closure
   + `s6-window`, `s6-button`, `s6-dither` + a demo page. *Proves the shape end-to-end.*
2. **The set (~½ day)** — `s6-section-rule`, `s6-finder-icon`/`s6-icon-grid`, `s6-status`,
   `s6-theme-toggle` + `.d.ts` + README/usage. *v1 complete.*
3. **Integration (~½ day)** — migrate the Astro site to consume the package's `styles.css`
   (and optionally swap hand-written chrome for the elements). *Single-source proven in prod.*
4. **Sync (~½ day)** — the off-script claude.ai/design bundle + cards + real `/design-sync`.

**v1 = phases 1–2.** 3 and 4 are opt-in follow-ons.

## Out of scope (v1)

Forms/inputs, dialog/modal, the site menubar/nav, a published npm package, React/Vue wrappers,
and — emphatically — any restyling.

## Open decisions (gate the build)

1. **Framework:** vanilla custom elements (zero-dep, truly thin) **[rec]** vs. Lit (nicer
   reactive DX, ~5 kb dep).
2. **CSS ownership:** move `src/styles` into the package now **[rec — proper single source]**
   vs. reference in place (faster, two owners).
3. **Scope of v1:** phases 1–2 only **[rec]**, or include integration (3) / the sync (4).
