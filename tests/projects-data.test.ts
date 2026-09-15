/**
 * Project data integrity tests for the project data source.
 */
import { describe, test, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { projects } from '../src/data/projects';

const ROOT = resolve(import.meta.dirname!, '..');

describe('projects.ts data integrity', () => {
  test('has at least one project', () => {
    expect(projects.length).toBeGreaterThan(0);
  });

  test('all projects have required fields', () => {
    for (const p of projects) {
      expect(p.title, `${p.slug} missing title`).toBeTruthy();
      expect(p.slug, `${p.title} missing slug`).toBeTruthy();
      expect(p.description, `${p.slug} missing description`).toBeTruthy();
      expect(p.icon, `${p.slug} missing icon`).toBeTruthy();
      expect(p.repoUrl, `${p.slug} missing repoUrl`).toBeTruthy();
    }
  });

  test('slugs are unique', () => {
    const slugs = projects.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test('slugs are URL-safe', () => {
    for (const p of projects) {
      expect(p.slug, `${p.slug} is not URL-safe`).toMatch(/^[a-z0-9-]+$/);
    }
  });

  test('icons reference existing files', () => {
    for (const p of projects) {
      expect(
        existsSync(resolve(ROOT, 'public/icons', p.icon)),
        `Icon ${p.icon} for ${p.slug} not found`,
      ).toBe(true);
    }
  });

  test('repo URLs are valid GitHub URLs', () => {
    for (const p of projects) {
      expect(p.repoUrl, `${p.slug} repoUrl not a GitHub URL`).toMatch(/^https:\/\/github\.com\//);
    }
  });

  test('appUrl is an internal path or an external http(s) URL if present', () => {
    for (const p of projects) {
      if (p.appUrl) {
        expect(
          p.appUrl,
          `${p.slug} appUrl must be an internal path (/...) or an external http(s) URL`,
        ).toMatch(/^(\/|https?:\/\/)/);
      }
    }
  });
});

// Every writeup belongs to a project (the "?" button reads it by slug), and every
// long-form article names the project its "Back to the project" link returns to
// A missing writeup fails the build; this names the culprit.
describe('Content ↔ project contract', () => {
  const slugs = new Set(projects.map((p) => p.slug));
  const dir = (d: string) => readdirSync(resolve(ROOT, d)).filter((f) => f.endsWith('.md'));

  test('every project has a writeup', () => {
    const writeups = new Set(dir('src/content/writeups').map((f) => f.replace(/\.md$/, '')));
    for (const slug of slugs) expect(writeups, slug).toContain(slug);
  });

  test("every article's project is a real project slug", () => {
    for (const f of dir('src/content/articles')) {
      const front = readFileSync(resolve(ROOT, 'src/content/articles', f), 'utf-8').split('---')[1];
      const project = /^project:\s*(\S+)/m.exec(front)?.[1];
      expect(project, f).toBeDefined();
      expect(slugs, f).toContain(project);
    }
  });
});
