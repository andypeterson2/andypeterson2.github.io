import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// Project deep-dive writeups, surfaced through the "?" WriteupModal on the home
// timeline's project entries. Markdown lives in src/content/writeups/;
// the entry id is the filename, which MUST match the project slug in
// src/data/projects.ts so <WriteupModal slug={...} /> can resolve it.
const writeups = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writeups' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().optional(),
  }),
});

// Long-form pieces too deep for a writeup modal (e.g. the QSVM paper recreation),
// rendered as their own pages at /writeups/<id>/ and linked from the modal.
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    /** The project slug this article belongs to: its "Back to the project" link. */
    project: z.string(),
  }),
});

export const collections = { writeups, articles };
