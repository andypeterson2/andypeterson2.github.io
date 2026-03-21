/**
 * WP #485: Contact form with validation
 * WP #486: Social links
 * WP #489: Form submission routing per identity
 * WP #614: Test: Contact form validation and submission
 * WP #401: Sitemap and robots.txt
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- WP #485 / #614: Contact form ----

describe('Contact form with validation', () => {
  const contactSrc = readFileSync(resolve(ROOT, 'src/pages/contact.astro'), 'utf-8');

  test('form element exists', () => {
    expect(contactSrc).toContain('<form');
    expect(contactSrc).toContain('contact-form');
  });

  test('form uses novalidate for custom validation', () => {
    expect(contactSrc).toContain('novalidate');
  });

  test('has name input with required', () => {
    expect(contactSrc).toContain('id="contact-name"');
    expect(contactSrc).toContain('name="name"');
  });

  test('has email input with required', () => {
    expect(contactSrc).toContain('id="contact-email"');
    expect(contactSrc).toContain('type="email"');
  });

  test('has message textarea with required', () => {
    expect(contactSrc).toContain('id="contact-message"');
    expect(contactSrc).toContain('<textarea');
  });

  test('has submit button', () => {
    expect(contactSrc).toContain('type="submit"');
    expect(contactSrc).toContain('Send Message');
  });

  test('has error display elements', () => {
    expect(contactSrc).toContain('form-error');
    expect(contactSrc).toContain('data-for=');
  });

  test('validates email format', () => {
    expect(contactSrc).toContain('@[^\\s@]+\\.[^\\s@]+');
  });

  test('prevents default form submission', () => {
    expect(contactSrc).toContain('preventDefault');
  });

  test('shows validation errors on empty fields', () => {
    expect(contactSrc).toContain('Name is required');
    expect(contactSrc).toContain('Email is required');
    expect(contactSrc).toContain('Message is required');
  });

  test('has invalid class styling', () => {
    expect(contactSrc).toContain('.invalid');
    expect(contactSrc).toContain('--color-danger');
  });

  test('labels have required indicator', () => {
    expect(contactSrc).toContain('<span class="required">*</span>');
  });

  test('inputs have autocomplete attributes', () => {
    expect(contactSrc).toContain('autocomplete="name"');
    expect(contactSrc).toContain('autocomplete="email"');
  });
});

// ---- WP #486: Social links ----

describe('Social links', () => {
  const contactSrc = readFileSync(resolve(ROOT, 'src/pages/contact.astro'), 'utf-8');

  test('social links section exists', () => {
    expect(contactSrc).toContain('social-links-section');
  });

  test('has GitHub social link', () => {
    expect(contactSrc).toContain('social-link');
    expect(contactSrc).toContain('GitHub');
  });

  test('has LinkedIn social link', () => {
    expect(contactSrc).toContain('LinkedIn');
  });

  test('has Email social link', () => {
    expect(contactSrc).toContain('Email');
  });

  test('social links open in new tab', () => {
    expect(contactSrc).toContain('target="_blank"');
    expect(contactSrc).toContain('rel="noopener noreferrer"');
  });

  test('social links have aria-labels', () => {
    expect(contactSrc).toContain('aria-label="GitHub"');
    expect(contactSrc).toContain('aria-label="LinkedIn"');
    expect(contactSrc).toContain('aria-label="Email"');
  });

  test('social links use siteConfig values', () => {
    expect(contactSrc).toContain('siteConfig.github');
    expect(contactSrc).toContain('siteConfig.linkedin');
    expect(contactSrc).toContain('siteConfig.email');
  });
});

// ---- WP #489: Form submission routing per identity ----

describe('Form submission routing per identity', () => {
  const contactSrc = readFileSync(resolve(ROOT, 'src/pages/contact.astro'), 'utf-8');

  test('email link uses siteConfig email', () => {
    expect(contactSrc).toContain('siteConfig.email');
    expect(contactSrc).toContain('mailto:');
  });

  test('no hardcoded email addresses in form', () => {
    // Ensure no literal email addresses are in the source
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    // Filter out the validation regex pattern
    const srcWithoutRegex = contactSrc.replace(/@\[\\s@\]\+\\\.\[\\s@\]\+/, '');
    expect(srcWithoutRegex).not.toMatch(emailRegex);
  });
});

// ---- WP #401: Sitemap and robots.txt ----

describe('Sitemap and robots.txt', () => {
  test('robots.txt exists', () => {
    expect(existsSync(resolve(ROOT, 'robots.txt'))).toBe(true);
  });

  test('robots.txt allows all crawlers', () => {
    const robots = readFileSync(resolve(ROOT, 'robots.txt'), 'utf-8');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
  });

  test('astro config has sitemap integration', () => {
    const config = readFileSync(resolve(ROOT, 'astro.config.mjs'), 'utf-8');
    expect(config).toContain('sitemap');
  });

  test('astro config has site URL', () => {
    const config = readFileSync(resolve(ROOT, 'astro.config.mjs'), 'utf-8');
    expect(config).toContain('site:');
  });
});
