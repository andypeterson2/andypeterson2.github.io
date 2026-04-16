/**
 * Unit tests for pure site config resolver extracted from src/config/site.ts.
 */
import { describe, test, expect } from 'vitest';
import { resolveSiteConfig } from '../../src/lib/site-config';

describe('resolveSiteConfig', () => {
  test('empty env produces fallback values', () => {
    const config = resolveSiteConfig({});
    expect(config.displayName).toBe('Portfolio');
    expect(config.domain).toBe('localhost');
    expect(config.title).toBe('Projects');
    expect(config.description).toBe('Personal portfolio and project showcase');
    expect(config.email).toBe('');
    expect(config.github).toBe('');
    expect(config.linkedin).toBe('');
  });

  test('two-word display name splits into firstName and lastName', () => {
    const config = resolveSiteConfig({ SITE_DISPLAY_NAME: 'Andrew Peterson' });
    expect(config.displayName).toBe('Andrew Peterson');
    expect(config.firstName).toBe('Andrew');
    expect(config.lastName).toBe('Peterson');
  });

  test('three-word display name puts rest in lastName', () => {
    const config = resolveSiteConfig({ SITE_DISPLAY_NAME: 'Andrew J Peterson' });
    expect(config.firstName).toBe('Andrew');
    expect(config.lastName).toBe('J Peterson');
  });

  test('single-word display name produces empty lastName', () => {
    const config = resolveSiteConfig({ SITE_DISPLAY_NAME: 'Solo' });
    expect(config.firstName).toBe('Solo');
    expect(config.lastName).toBe('');
  });

  test('all env fields override defaults', () => {
    const config = resolveSiteConfig({
      SITE_DISPLAY_NAME: 'Test User',
      SITE_DOMAIN: 'example.com',
      SITE_EMAIL: 'test@example.com',
      SITE_TITLE: 'Custom Title',
      SITE_DESCRIPTION: 'Custom description',
      SITE_GITHUB: 'https://github.com/test',
      SITE_LINKEDIN: 'https://linkedin.com/in/test',
    });
    expect(config.displayName).toBe('Test User');
    expect(config.domain).toBe('example.com');
    expect(config.email).toBe('test@example.com');
    expect(config.title).toBe('Custom Title');
    expect(config.description).toBe('Custom description');
    expect(config.github).toBe('https://github.com/test');
    expect(config.linkedin).toBe('https://linkedin.com/in/test');
  });

  test('missing display name with other env vars still uses Portfolio fallback', () => {
    const config = resolveSiteConfig({ SITE_DOMAIN: 'example.com' });
    expect(config.displayName).toBe('Portfolio');
    expect(config.firstName).toBe('Portfolio');
  });
});
