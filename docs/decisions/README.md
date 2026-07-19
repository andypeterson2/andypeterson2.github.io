# Decision artifacts

The CV editor's engineering-decision docs, in their canonical HTML — version-controlled
here so they survive. They previously lived only as rendered pages plus scratchpad files,
and were lost and rebuilt more than once; this is the durable home. Both are System-6-styled,
theme-aware, and render standalone when opened in a browser.

| File | What |
|------|------|
| [`architecture-decision-log.html`](architecture-decision-log.html) | ADR-001…007 — the decisions behind the editor, including **ADR-006** (a versioned CV data store — shipped, all three increments) and **ADR-007** (multi-tenant + review — proposed) |
| [`tech-debt-register.html`](tech-debt-register.html) | the debt register — two rounds of items, scored `(Impact + Risk) × (6 − Effort)` and ranked |

## Editing

Each file begins at `<title>` with no `<!doctype>` / `<html>` / `<head>` / `<body>`
wrapper and renders fine on its own (a `<title>` + `<style>` + content). Edit the file
here to update it.

ADR-006 and ADR-007 were folded into the decision log.
