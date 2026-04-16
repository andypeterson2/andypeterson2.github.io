/**
 * Project data integrity tests — validate the projects.ts data source.
 */
import { describe, test, expect } from 'vitest';
import { existsSync } from 'fs';
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
      expect(p.longDescription, `${p.slug} missing longDescription`).toBeTruthy();
      expect(p.category, `${p.slug} missing category`).toBeTruthy();
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
      expect(p.repoUrl, `${p.slug} repoUrl not a GitHub URL`).toMatch(
        /^https:\/\/github\.com\//,
      );
    }
  });

  test('status is a valid enum value', () => {
    for (const p of projects) {
      expect(['active', 'archived']).toContain(p.status);
    }
  });

  test('at least one project is featured', () => {
    const featured = projects.filter((p) => p.featured);
    expect(featured.length).toBeGreaterThan(0);
  });

  test('appUrl paths start with / if present', () => {
    for (const p of projects) {
      if (p.appUrl) {
        expect(p.appUrl, `${p.slug} appUrl doesn't start with /`).toMatch(/^\//);
      }
    }
  });
});
