# Portfolio Website — Technical Overview

High-level index. Each project's detailed technical documentation lives in
[`docs/`](docs/); this file stays intentionally short so it does not rot. Shared
reference: the [Quantum Algorithm Glossary](docs/quantum-glossary.md).

## [Main Site](docs/main-site.md) — `andypeterson.dev`

The Astro static site that hosts the projects below — the portfolio shell.
Framework config, design tokens, components, security/SEO, and the CI/CD pipeline.

## [CV Editor](docs/cv-editor.md) — `packages/cv`

A normalized LaTeX résumé / CV / cover-letter editor: a stateless REST API over a
SQLite store, an MCP server exposing it as tools, tag-based variants with fuzzy
matching + optional local embeddings, and `xelatex` PDF compilation.

## [Nonogram Solver](docs/nonogram.md) — `packages/nonogram`

A quantum nonogram (picross) solver — a Python/Flask backend with a web client.

## [Quantum Protein Kernel](docs/quantum-protein-kernel.md) — `packages/quantum-protein-kernel`

Quantum machine-learning image classifiers (PyTorch + Qiskit) served via Flask.

## [Quantum Video Chat](docs/quantum-video-chat.md) — `packages/qvc`

WebRTC video chat secured with BB84 quantum key distribution — a Python signaling
server plus a JS client.
