---
title: LaTeX Resume Editor
summary: A document editor with a normalized database, a gated REST API, and server-side XeLaTeX — plus a live in-browser demo that needs no backend.
---

A web editor for resumes, CVs, and cover letters, backed by a normalized **SQLite database as the one source of truth** — content lives as structured records, not a blob of markup.

## How it works

An **Express REST API** exposes 20+ endpoints with **JSON Schema validation**. A **Cloudflare Worker gateway, gated by Cloudflare Access**, controls access to them. The frontend is a **Svelte 5 island**:

- edit the document inline
- save a **variant** — a tag-rule *lens* on the same content, so one master yields many targeted CVs
- reorder by drag or keyboard, restyle and re-layout live
- record changes with **checkpoint history and undo/redo**.

Each document becomes a PDF server-side, through **XeLaTeX (Awesome-CV)**.

## Built demo-first

A **live in-browser demo runs the same editor with no backend** — it treats "not signed in" as the confident default and does not show an error. So a visitor can try the full editor on GitHub Pages. The owner's backend opens only after a Cloudflare Access sign-in.

## Verification

A deterministic, backend-mocked **end-to-end suite** drives it, plus unit tests across its logic tier — the slice controllers, variants, tags, and history.

## Stack

Svelte 5 (runes) · Express · SQLite · Cloudflare Worker + Access · XeLaTeX · Playwright + Vitest.
