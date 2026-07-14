# Decision artifacts

The CV editor's engineering-decision docs, in their canonical HTML — version-controlled
here so they survive. They lived only as claude.ai Artifacts plus scratchpad files, and
were lost and rebuilt more than once; this is the durable home. Both are System-6-styled,
theme-aware, and render standalone when opened in a browser.

| File | What | Live artifact |
|------|------|---------------|
| [`architecture-decision-log.html`](architecture-decision-log.html) | ADR-001…007 — the decisions behind the editor, including **ADR-006** (a versioned CV data store — shipped, all three increments) and **ADR-007** (multi-tenant + review — proposed) | [38475db4…](https://claude.ai/code/artifact/38475db4-7693-44dd-9280-6eb7c62938bf) |
| [`tech-debt-register.html`](tech-debt-register.html) | the debt register — two rounds of items, scored `(Impact + Risk) × (6 − Effort)` and ranked | [395b8099…](https://claude.ai/code/artifact/395b8099-7707-4b3c-8ec1-65efb2cfe087) |

## Editing

These are **Artifact sources**: each file begins at `<title>` with no
`<!doctype>` / `<html>` / `<head>` / `<body>` wrapper — the artifact host adds that at
publish time. Browsers render them fine on their own (a `<title>` + `<style>` + content).
To update the published version, edit the file here and redeploy it to the **same**
artifact URL above.

ADR-006 and ADR-007 once had their own standalone artifacts; they were folded into the
decision log and those URLs now point back to it.
