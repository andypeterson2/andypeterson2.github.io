---
title: LaTeX Resume Editor
summary: A document editor with a normalized database, a gated REST API, and server-side XeLaTeX — plus a real in-browser demo that needs no backend.
---

A web editor for resumes, CVs, and cover letters, backed by a normalized **SQLite database as the single source of truth** — content lives as structured records, not a blob of markup.

## How it works

An **Express REST API** exposes 20+ endpoints with **JSON Schema validation**, reached through a **Cloudflare Worker gateway gated by Cloudflare Access**. The frontend is a **Svelte 5 island**:

- edit the document inline;
- save a **variant** — a reusable tag-rule *lens* over the same content, so one master yields many targeted CVs;
- reorder by drag or keyboard, restyle and re-layout live;
- track changes with **checkpoint history and undo/redo**.

Documents compile server-side through **XeLaTeX (Awesome-CV)** into a real PDF.

## Demo-first by design

A **live in-browser demo runs the real editor with no backend** — it treats "not signed in" as the confident default, degrading gracefully instead of erroring, so any visitor can try the full thing on GitHub Pages. The owner's backend is reached only after a Cloudflare Access sign-in.

## What's real

Driven by a deterministic, backend-mocked **end-to-end suite** plus unit tests across its logic tier — the slice controllers, variants, tags, and history.

## Stack

Svelte 5 (runes) · Express · SQLite · Cloudflare Worker + Access · XeLaTeX · Playwright + Vitest.
