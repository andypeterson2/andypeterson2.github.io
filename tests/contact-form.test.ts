/**
 * WP #485: Contact form with validation
 * WP #486: Social links
 * WP #489: Form submission routing per identity
 * WP #614: Test: Contact form validation and submission
 * WP #401: Sitemap and robots.txt
 * Updated for system.css monochrome architecture.
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
  });

  test('inputs have autocomplete attributes', () => {
    expect(contactSrc).toContain('autocomplete="name"');
    expect(contactSrc).toContain('autocomplete="email"');
  });

  test('form uses system.css field-row layout', () => {
    expect(contactSrc).toContain('field-row');
  });

  test('form is inside a window with New Message title', () => {
    expect(contactSrc).toContain('window contact-window');
    expect(contactSrc).toContain('New Message');
  });
});

// ---- WP #486: Social links (now contact cards) ----

describe('Contact method cards', () => {
  const contactSrc = readFileSync(resolve(ROOT, 'src/pages/contact.astro'), 'utf-8');

  test('contact cards section exists', () => {
    expect(contactSrc).toContain('contact-grid');
  });

  test('has GitHub contact card', () => {
    expect(contactSrc).toContain('standard-dialog contact-card');
    expect(contactSrc).toContain('GitHub');
  });

  test('has LinkedIn contact card', () => {
    expect(contactSrc).toContain('LinkedIn');
  });

  test('has Email contact card', () => {
    expect(contactSrc).toContain('Email');
  });

  test('contact card links open in new tab', () => {
    expect(contactSrc).toContain('target="_blank"');
    expect(contactSrc).toContain('rel="noopener noreferrer"');
  });

  test('contact card links use system.css btn class', () => {
    expect(contactSrc).toContain('class="btn"');
  });

  test('contact cards use siteConfig values', () => {
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
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const srcWithoutRegex = contactSrc.replace(/@\[.*?\]\+/g, '');
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
