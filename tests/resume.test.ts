/**
 * WP #476: Inline resume web view
 * WP #477: ATS compatibility verification
 * WP #480: Cover letter template
 * WP #612: Test: Build-time PDF generation (placeholder verified)
 * Updated for system.css monochrome architecture.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- WP #476: Inline resume web view ----

describe('Resume page (redirect stub)', () => {
  const resumeSrc = readFileSync(resolve(ROOT, 'src/pages/resume.astro'), 'utf-8');

  test('is a redirect stub to /about', () => {
    expect(resumeSrc).toContain('http-equiv="refresh"');
    expect(resumeSrc).toContain('url=/about');
  });

  test('uses BaseLayout', () => {
    expect(resumeSrc).toContain('BaseLayout');
  });

  test('has fallback link', () => {
    expect(resumeSrc).toContain('href="/about"');
  });
});

// ---- WP #477: ATS compatibility verification ----

describe('ATS compatibility verification (about page houses resume content)', () => {
  const aboutSrc = readFileSync(resolve(ROOT, 'src/pages/about.astro'), 'utf-8');

  test('uses semantic section structure', () => {
    expect(aboutSrc).toContain('<section');
  });

  test('uses proper heading hierarchy', () => {
    expect(aboutSrc).toContain('<h1');
  });

  test('no personal info hardcoded (uses siteConfig)', () => {
    expect(aboutSrc).toContain('siteConfig');
    expect(aboutSrc).not.toMatch(/[a-z]+@gmail\.com/);
  });

  test('experience items use window-based layout with details-bar', () => {
    expect(aboutSrc).toContain('section-window');
    expect(aboutSrc).toContain('details-bar');
  });
});

// ---- WP #480: Cover letter template ----

describe('Cover letter page (redirect stub)', () => {
  test('cover letter page exists', () => {
    expect(existsSync(resolve(ROOT, 'src/pages/cover-letter.astro'))).toBe(true);
  });

  const coverSrc = readFileSync(
    resolve(ROOT, 'src/pages/cover-letter.astro'),
    'utf-8',
  );

  test('uses BaseLayout', () => {
    expect(coverSrc).toContain('BaseLayout');
  });

  test('is a redirect stub to /about', () => {
    expect(coverSrc).toContain('http-equiv="refresh"');
    expect(coverSrc).toContain('url=/about');
  });

  test('has fallback link', () => {
    expect(coverSrc).toContain('href="/about"');
  });
});

// ---- WP #612: PDF generation readiness ----

describe('PDF generation readiness', () => {
  test('site has printable structure', () => {
    const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');
    expect(baseCss).toContain('@media print');
  });

  test('about page (which houses resume content) has semantic sections', () => {
    const aboutSrc = readFileSync(resolve(ROOT, 'src/pages/about.astro'), 'utf-8');
    expect(aboutSrc).toContain('<section');
  });

  test('about page has download link to resume PDF', () => {
    const aboutSrc = readFileSync(resolve(ROOT, 'src/pages/about.astro'), 'utf-8');
    expect(aboutSrc).toContain('/resume.pdf');
  });
});
