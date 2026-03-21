/**
 * WP #476: Inline resume web view
 * WP #477: ATS compatibility verification
 * WP #480: Cover letter template
 * WP #612: Test: Build-time PDF generation (placeholder verified)
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- WP #476: Inline resume web view ----

describe('Inline resume web view', () => {
  const resumeSrc = readFileSync(resolve(ROOT, 'src/pages/resume.astro'), 'utf-8');

  test('has inline resume section', () => {
    expect(resumeSrc).toContain('resume-inline');
    expect(resumeSrc).toContain('Quick View');
  });

  test('has resume document container', () => {
    expect(resumeSrc).toContain('resume-document');
  });

  test('shows display name from config', () => {
    expect(resumeSrc).toContain('siteConfig.displayName');
  });

  test('shows description from config', () => {
    expect(resumeSrc).toContain('siteConfig.description');
  });

  test('has download PDF button', () => {
    expect(resumeSrc).toContain('Download PDF');
    expect(resumeSrc).toContain('/resume.pdf');
  });

  test('has link to cover letter', () => {
    expect(resumeSrc).toContain('/cover-letter');
    expect(resumeSrc).toContain('Cover Letter');
  });
});

// ---- WP #477: ATS compatibility verification ----

describe('ATS compatibility verification', () => {
  const resumeSrc = readFileSync(resolve(ROOT, 'src/pages/resume.astro'), 'utf-8');

  test('uses semantic section structure', () => {
    expect(resumeSrc).toContain('<section');
    expect(resumeSrc).toContain('resume-experience');
    expect(resumeSrc).toContain('resume-education');
  });

  test('uses proper heading hierarchy', () => {
    expect(resumeSrc).toContain('<h1>');
    expect(resumeSrc).toContain('<h3>');
  });

  test('no personal info hardcoded (uses siteConfig)', () => {
    expect(resumeSrc).toContain('siteConfig');
    // Verify no literal personal email addresses
    expect(resumeSrc).not.toMatch(/[a-z]+@gmail\.com/);
  });

  test('experience items have structured data', () => {
    expect(resumeSrc).toContain('experience-header');
    expect(resumeSrc).toContain('experience-date');
    expect(resumeSrc).toContain('experience-org');
    expect(resumeSrc).toContain('experience-desc');
  });

  test('page has breadcrumbs', () => {
    expect(resumeSrc).toContain('Breadcrumbs');
  });
});

// ---- WP #480: Cover letter template ----

describe('Cover letter template', () => {
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

  test('has breadcrumbs with Resume parent', () => {
    expect(coverSrc).toContain('Breadcrumbs');
    expect(coverSrc).toContain("label: 'Resume'");
    expect(coverSrc).toContain("href: '/resume'");
  });

  test('has letter document structure', () => {
    expect(coverSrc).toContain('letter-document');
    expect(coverSrc).toContain('letter-header');
    expect(coverSrc).toContain('letter-body');
  });

  test('uses siteConfig for name', () => {
    expect(coverSrc).toContain('siteConfig.displayName');
  });

  test('uses siteConfig for email', () => {
    expect(coverSrc).toContain('siteConfig.email');
  });

  test('has customizable placeholder text', () => {
    expect(coverSrc).toContain('[Position Title]');
    expect(coverSrc).toContain('[Company Name]');
  });

  test('has proper closing', () => {
    expect(coverSrc).toContain('Sincerely');
  });

  test('has back to resume link', () => {
    expect(coverSrc).toContain('/resume');
    expect(coverSrc).toContain('Back to Resume');
  });
});

// ---- WP #612: PDF generation readiness ----

describe('PDF generation readiness', () => {
  const resumeSrc = readFileSync(resolve(ROOT, 'src/pages/resume.astro'), 'utf-8');

  test('resume page has printable structure', () => {
    // Print stylesheet exists in base.css
    const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');
    expect(baseCss).toContain('@media print');
  });

  test('resume content is in semantic sections', () => {
    expect(resumeSrc).toContain('<section');
  });

  test('download link points to PDF', () => {
    expect(resumeSrc).toContain('/resume.pdf');
  });
});
