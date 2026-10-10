---
title: LaTeX Resume Editor
summary: A document editor with a normalized database, a gated REST API, and server-side XeLaTeX — plus a real in-browser demo that needs no backend.
---

One master document, many targeted CVs. A resume is kept as structured records in a normalized **SQLite store** rather than a blob of markup, so a **variant** — a reusable tag-rule *lens* over that same content — can yield a version aimed at one job without copying anything. Editing, reordering and restyling happen live; compiling produces a real PDF.

## How it works

An **Express REST API** exposes **84 endpoints** with **JSON Schema validation**, and `GET /api` lists every one of them, so the running service is its own reference. It is reached through a **Cloudflare Worker gateway with its own Google sign-in**; every person belongs to an account, and an account sees only its own. A second Worker serves the same API to an LLM as a **remote MCP server** over OAuth. The frontend is a **Svelte 5 island**:

- edit the document inline;
- save a variant, and switch between them;
- reorder by drag or keyboard, restyle and re-layout live;
- track changes with **checkpoint history and undo/redo**.

Tags decide what each variant includes, so a local int8 MiniLM embedding ranks the tags a bullet already has, blended with votes from the person's nearest tagged bullets. It runs offline and never invents a tag. The embedding is the stock model rather than the fine-tuned one from [the skill linker](/projects/tiny-skill-linker/) — measured on these bullets, fine-tuning made it worse.

Documents compile server-side through **XeLaTeX (Awesome-CV)** into a real PDF.

## The result

A **live in-browser demo runs the real editor with no backend**. The decision that shapes it: "not signed in" is the confident default, so the demo degrades instead of erroring. Any visitor can edit, reorder, tag and restyle a real document and export it as JSON. Compiling to a PDF and saving need an account, via **Sign in with Google** — and **the demo edits you made come with you into your own profile**, rather than being thrown away at the door.

## What's checked

A deterministic, backend-mocked **end-to-end suite** drives the editor through editing, variants, tags and history against a mocked API, and unit tests cover the logic tier underneath — the slice controllers, the variant lens, the tag ranking and the undo stack.

Compiling untrusted LaTeX is the sharp edge, so it runs bounded: 10 compiles a minute per client, 100 per account per day, two XeLaTeX processes at once, 30 seconds each, and a third-party layout bundle is installed only after its checksum matches the one recorded for it.

Two bounds depend on deployment rather than code, so they are worth stating plainly. The front-door secret defaults to **logging a miss and allowing it**, and only rejects once `CV_ORIGIN_SECRET_ENFORCE=true`; it takes a comma-separated set so it can be rotated one sender at a time. The rate limiter keys on `CF-Connecting-IP` only when `CV_TRUST_CF_IP` is set, because anywhere but behind Cloudflare a client picks that header's value itself. Neither is on by default, and a deployment that leaves them off has a front door it is only watching.
