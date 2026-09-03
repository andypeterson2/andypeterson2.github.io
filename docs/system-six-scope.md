# system-six scope — historical note

**Resolved 2026-09: the Web-Components tier was amputated.** This document
previously specified a set of light-DOM custom elements (`<s6-window>`,
`<s6-button>`, `<s6-status>`, `<s6-theme-toggle>`, …) that emitted the
System-6 classes, plus their esbuild/tsc build pipeline and a demo page.

The round-2 tech-debt audit posed the standing "adopt or amputate" question
and the evidence answered it: after two years, **zero `<s6-*>` tags existed
anywhere** in `src/`, `public/`, or the tests — the site writes plain
System-6 markup and consumes only the package's CSS closure
(`packages/system-six/styles/`), which is fully adopted, token-tested, and
e2e-verified. The components tier carried ten TypeScript sources, built
artifacts, two build toolchains, and a nested `node_modules` vendoring
TypeScript and esbuild — all for a tier nothing used.

What was removed (recoverable from git history before 2026-09):
`packages/system-six/{src,dist,demo}`, `esbuild.config.mjs`, `build-ds.mjs`
(the claude.ai/design self-contained-closure sync helper), the package's
`tsconfig.json`, lockfile, and dev dependencies, and the dead 70% of
`styles/elements.css` (the `s6-*` host rules and the unused `.s6-status`
family — the live status dots are `ServerConnectModal`'s own `.sn-dot`).

What remains is the product that was always in use: the CSS closure,
documented in [`packages/system-six/README.md`](../packages/system-six/README.md)
and [`design-system.md`](design-system.md).
