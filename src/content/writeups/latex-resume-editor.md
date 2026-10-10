---
title: LaTeX Resume Editor
summary: A document editor with a normalized database, a gated REST API, and server-side XeLaTeX — plus a real in-browser demo that needs no backend.
---

A web editor for resumes, CVs, and cover letters, backed by a normalized **SQLite database as the single source of truth** — content lives as structured records, not a blob of markup.

## How it works

An **Express REST API** exposes **84 endpoints** with **JSON Schema validation**, and `GET /api` lists every one of them, so the running service is its own reference. It is reached through a **Cloudflare Worker gateway with its own Google sign-in**; every person belongs to an account, and an account sees only its own. A second Worker serves the same API to an LLM as a **remote MCP server** over OAuth. The frontend is a **Svelte 5 island**:

- edit the document inline;
- save a **variant** — a reusable tag-rule *lens* over the same content, so one master yields many targeted CVs;
- reorder by drag or keyboard, restyle and re-layout live;
- track changes with **checkpoint history and undo/redo**.

Tags decide what each variant includes, so a local int8 MiniLM embedding ranks the tags a bullet already has, blended with votes from the person's nearest tagged bullets. It runs offline and never invents a tag.

Documents compile server-side through **XeLaTeX (Awesome-CV)** into a real PDF.

## The result

A **live in-browser demo runs the real editor with no backend**: it treats "not signed in" as the confident default and degrades gracefully instead of erroring. Any visitor can edit, reorder, tag and restyle a real document and export it as JSON. Compiling to a PDF and saving need an account, via **Sign in with Google** — and the demo edits you made come with you into your own profile.

## What's checked

Driven by a deterministic, backend-mocked **end-to-end suite** plus unit tests across its logic tier — the slice controllers, variants, tags, and history.

Compiling untrusted LaTeX is the sharp edge, so it runs bounded: 10 compiles a minute per client, 100 per account per day, two XeLaTeX processes at once, 30 seconds each, and a third-party layout bundle is installed only after it passes verification. The front-door secret rolls out fail-closed — a miss is logged and allowed until `CV_ORIGIN_SECRET_ENFORCE` flips, and the secret itself takes a comma-separated set so it can be rotated one sender at a time. The rate limiter keys on `CF-Connecting-IP` only when `CV_TRUST_CF_IP` is set, because anywhere but behind Cloudflare a client picks that header's value itself.
