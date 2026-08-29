import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// Project deep-dive writeups, surfaced through the "?" WriteupModal on project
// pages (and, later, the one-page site). Markdown lives in src/content/writeups/;
// the entry id is the filename, which MUST match the project slug in
// src/data/projects.ts so <WriteupModal slug={...} /> can resolve it.
const writeups = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writeups' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().optional(),
  }),
});

export const collections = { writeups };
