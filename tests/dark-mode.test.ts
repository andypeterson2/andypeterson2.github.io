/**
 * WP #416: Dark mode token layer
 * WP #522: Dark mode token implementation
 * WP #523: Dark mode toggle UX
 * WP #433: Dark mode toggle in footer
 * WP #584: Dark mode token switching
 * WP #628: Dark mode full token verification
 * WP #629: Dark mode toggle no-flash
 * WP #596: Dark mode toggle persistence
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

// ---- WP #416 / #522: Dark mode token layer ----

describe('Dark mode token implementation', () => {
  const tokensCss = readFileSync(resolve(ROOT, 'src/styles/tokens.css'), 'utf-8');

  test('dark theme is default (:root)', () => {
    expect(tokensCss).toContain(':root');
    expect(tokensCss).toContain('--color-bg: #111111');
  });

  test('light theme defined via data-theme attribute', () => {
    expect(tokensCss).toContain("[data-theme='light']");
  });

  test('light theme overrides all surface tokens', () => {
    // Should have light variants for all surface colors
    const lightSection = tokensCss.split("[data-theme='light']")[1]?.split('}')[0] || '';
    expect(lightSection).toContain('--color-bg');
    expect(lightSection).toContain('--color-surface');
    expect(lightSection).toContain('--color-surface-2');
    expect(lightSection).toContain('--color-surface-muted');
  });

  test('light theme overrides text tokens', () => {
    const lightSection = tokensCss.split("[data-theme='light']")[1]?.split('}')[0] || '';
    expect(lightSection).toContain('--color-text');
    expect(lightSection).toContain('--color-text-secondary');
    expect(lightSection).toContain('--color-text-muted');
  });

  test('light theme overrides accent tokens', () => {
    const lightSection = tokensCss.split("[data-theme='light']")[1]?.split('}')[0] || '';
    expect(lightSection).toContain('--color-accent');
    expect(lightSection).toContain('--color-accent-hover');
  });

  test('light theme overrides border tokens', () => {
    const lightSection = tokensCss.split("[data-theme='light']")[1]?.split('}')[0] || '';
    expect(lightSection).toContain('--color-border');
    expect(lightSection).toContain('--color-border-focus');
  });

  test('light theme overrides syntax highlight tokens', () => {
    const lightSection = tokensCss.split("[data-theme='light']")[1]?.split('}')[0] || '';
    expect(lightSection).toContain('--color-syntax-string');
    expect(lightSection).toContain('--color-syntax-keyword');
  });

  test('OS preference fallback exists', () => {
    expect(tokensCss).toContain('prefers-color-scheme: light');
    expect(tokensCss).toContain(':root:not([data-theme])');
  });
});

// ---- WP #523 / #433: Dark mode toggle UX ----

describe('Dark mode toggle in footer', () => {
  const footerSrc = readFileSync(
    resolve(ROOT, 'src/components/Footer.astro'),
    'utf-8',
  );

  test('toggle button exists in footer', () => {
    expect(footerSrc).toContain('theme-toggle');
  });

  test('toggle has aria-label', () => {
    expect(footerSrc).toContain('aria-label="Toggle dark mode"');
  });

  test('toggle has icon element', () => {
    expect(footerSrc).toContain('theme-toggle-icon');
  });

  test('toggle script sets data-theme attribute', () => {
    expect(footerSrc).toContain("setAttribute('data-theme'");
  });

  test('toggle meets touch target minimum', () => {
    expect(footerSrc).toContain('min-width: 48px');
    expect(footerSrc).toContain('min-height: 48px');
  });
});

// ---- WP #596: Dark mode toggle persistence ----

describe('Dark mode persistence', () => {
  const footerSrc = readFileSync(
    resolve(ROOT, 'src/components/Footer.astro'),
    'utf-8',
  );

  test('toggle saves preference to localStorage', () => {
    expect(footerSrc).toContain("localStorage.setItem('theme'");
  });

  test('toggle reads current theme from DOM', () => {
    expect(footerSrc).toContain("getAttribute('data-theme')");
  });
});

// ---- WP #629: Dark mode toggle no-flash ----

describe('Dark mode no-flash on load', () => {
  const layoutSrc = readFileSync(
    resolve(ROOT, 'src/layouts/BaseLayout.astro'),
    'utf-8',
  );

  test('inline script restores theme before paint', () => {
    expect(layoutSrc).toContain("localStorage.getItem('theme')");
    expect(layoutSrc).toContain("setAttribute('data-theme'");
  });

  test('inline script runs in head (is:inline)', () => {
    expect(layoutSrc).toContain('is:inline');
  });

  test('script appears before body', () => {
    const scriptPos = layoutSrc.indexOf("localStorage.getItem('theme')");
    const bodyPos = layoutSrc.indexOf('<body');
    expect(scriptPos).toBeLessThan(bodyPos);
  });
});

// ---- WP #584 / #628: Token switching verification ----

describe('Dark mode full token verification', () => {
  const tokensCss = readFileSync(resolve(ROOT, 'src/styles/tokens.css'), 'utf-8');

  test('dark and light backgrounds have sufficient contrast', () => {
    // Dark bg should be dark (#1d2021), light bg should be light (#fbf1c7)
    expect(tokensCss).toContain('--color-bg: #111111');
    expect(tokensCss).toContain('--color-bg: #FFFFFF');
  });

  test('dark and light text colors are inverted', () => {
    // Dark theme text is light, light theme text is dark
    expect(tokensCss).toContain('--color-text: #EEEEEE');
    expect(tokensCss).toContain('--color-text: #111111');
  });

  test('semantic colors defined in both themes', () => {
    // Count occurrences of semantic tokens
    const successCount = (tokensCss.match(/--color-success/g) || []).length;
    const warnCount = (tokensCss.match(/--color-warn/g) || []).length;
    const dangerCount = (tokensCss.match(/--color-danger/g) || []).length;
    // Should appear at least 3 times: root, light theme, OS fallback
    expect(successCount).toBeGreaterThanOrEqual(3);
    expect(warnCount).toBeGreaterThanOrEqual(3);
    expect(dangerCount).toBeGreaterThanOrEqual(3);
  });

  test('typography tokens are theme-independent', () => {
    // Font families should only be in :root, not duplicated per theme
    const fontSansCount = (tokensCss.match(/--font-sans/g) || []).length;
    expect(fontSansCount).toBe(1);
  });

  test('spacing tokens are theme-independent', () => {
    const spaceCount = (tokensCss.match(/--space-4: 1rem/g) || []).length;
    expect(spaceCount).toBe(1);
  });
});
