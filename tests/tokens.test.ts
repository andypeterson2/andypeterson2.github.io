/**
 * Component and design system tests.
 * Updated for system.css monochrome architecture.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

describe('Token CSS Output', () => {
  const tokensCss = readFileSync(resolve(ROOT, 'packages/system-six/styles/tokens.css'), 'utf-8');

  test('defines :root with the honest ink primitives + status scale', () => {
    expect(tokensCss).toMatch(/:root\s*\{/);
    // the true monochrome primitives
    expect(tokensCss).toContain('--color-bg:');
    expect(tokensCss).toContain('--color-text:');
    expect(tokensCss).toContain('--color-border:');
    // the status-light scale (L3) — the only color the design has
    expect(tokensCss).toContain('--color-success:');
    expect(tokensCss).toContain('--color-danger:');
  });

  test('no chromatic-hierarchy tokens (L5 — rank by type, not hue)', () => {
    // These named a color hierarchy the design refuses; gap B removed them.
    // Guarding here so a well-meaning "design token" pass can't re-add the lie.
    expect(tokensCss).not.toContain('--color-accent:');
    expect(tokensCss).not.toContain('--color-text-secondary:');
    expect(tokensCss).not.toContain('--color-surface:');
  });

  test('no light theme overrides (pure monochrome)', () => {
    expect(tokensCss).not.toContain("[data-theme='light']");
  });

  test('no OS preference fallback (pure monochrome)', () => {
    expect(tokensCss).not.toContain('prefers-color-scheme: light');
  });

  test('includes prefers-reduced-motion', () => {
    expect(tokensCss).toContain('prefers-reduced-motion');
  });

  test('defines spacing tokens', () => {
    expect(tokensCss).toContain('--space-1:');
    expect(tokensCss).toContain('--space-4:');
    expect(tokensCss).toContain('--space-16:');
  });

  test('font size scale tokens are fluid (clamp with a px floor + ceiling)', () => {
    // The type scale is fluid: each step grows with the viewport between a legible
    // px floor and a capped px ceiling, so text is comfortable at any width.
    const steps = ['2xs', 'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'];
    for (const step of steps) {
      const line = tokensCss.split('\n').find((l) => new RegExp(`--text-${step}\\s*:`).test(l));
      expect(line, `--text-${step} should be defined`).toBeTruthy();
      expect(line).toMatch(/clamp\(\s*\d+px\s*,\s*[\d.]+vw\s*,\s*\d+px\s*\)/);
    }
  });
});

describe('Base CSS', () => {
  const baseCss = readFileSync(resolve(ROOT, 'packages/system-six/styles/base.css'), 'utf-8');

  test('includes box-sizing reset', () => {
    expect(baseCss).toContain('box-sizing: border-box');
  });

  test('body uses System 6 styling', () => {
    expect(baseCss).toContain('Chicago');
  });

  test('defines heading styles', () => {
    expect(baseCss).toMatch(/h1[\s,{]/);
    expect(baseCss).toContain('var(--text-4xl)');
  });

  test('link hover uses monochrome inversion', () => {
    expect(baseCss).toContain('a:hover');
  });

  test('selection uses monochrome inversion', () => {
    expect(baseCss).toContain('::selection');
  });

  test('sr-only utility is defined', () => {
    expect(baseCss).toContain('.sr-only');
  });

  test('container utility is defined', () => {
    expect(baseCss).toContain('.container');
    expect(baseCss).toContain('var(--max-width)');
  });
});

describe('Component Files Exist', () => {
  const components = ['Button.astro', 'SectionLabel.astro', 'PullQuote.astro'];

  test.each(components)('%s component exists', (filename) => {
    expect(existsSync(resolve(ROOT, 'src/components', filename))).toBe(true);
  });
});

describe('Button Component', () => {
  const buttonSrc = readFileSync(resolve(ROOT, 'src/components/Button.astro'), 'utf-8');

  test('uses system.css btn and btn-default classes', () => {
    expect(buttonSrc).toContain('btn-default');
    expect(buttonSrc).toContain('btn');
  });

  test('supports variant prop', () => {
    expect(buttonSrc).toContain('variant');
    expect(buttonSrc).toContain('primary');
    expect(buttonSrc).toContain('secondary');
    expect(buttonSrc).toContain('ghost');
  });

  test('supports href for link-style buttons', () => {
    expect(buttonSrc).toContain('href');
  });
});

describe('SectionLabel Component', () => {
  const src = readFileSync(resolve(ROOT, 'src/components/SectionLabel.astro'), 'utf-8');

  test('renders label text', () => {
    expect(src).toContain('label');
  });

  test('has decorative line', () => {
    expect(src).toContain('section-label-rule');
  });
});

describe('Site Configuration', () => {
  const siteSrc = readFileSync(resolve(ROOT, 'src/config/site.ts'), 'utf-8');
  const libSrc = readFileSync(resolve(ROOT, 'src/lib/site-config.ts'), 'utf-8');

  test('reads from environment variables', () => {
    expect(siteSrc).toContain('import.meta.env');
  });

  test('defines SiteConfig interface', () => {
    // Interface moved to src/lib/site-config.ts; site.ts re-exports it.
    expect(libSrc).toContain('interface SiteConfig');
  });

  test('exports siteConfig', () => {
    expect(siteSrc).toContain('export const siteConfig');
  });

  test('has displayName field', () => {
    expect(libSrc).toContain('displayName');
  });
});

// ---- Semantic color tokens ----

describe('Semantic color tokens', () => {
  const tokensCss = readFileSync(resolve(ROOT, 'packages/system-six/styles/tokens.css'), 'utf-8');

  test('defines --color-success with a non-black value', () => {
    const match = tokensCss.match(/--color-success:\s*([^;]+)/);
    expect(match).toBeTruthy();
    expect(match![1].trim()).not.toBe('#000');
  });

  test('defines --color-warning with a non-black value', () => {
    const match = tokensCss.match(/--color-warning:\s*([^;]+)/);
    expect(match).toBeTruthy();
    expect(match![1].trim()).not.toBe('#000');
  });

  test('defines --color-danger with a non-black value', () => {
    const match = tokensCss.match(/--color-danger:\s*([^;]+)/);
    expect(match).toBeTruthy();
    expect(match![1].trim()).not.toBe('#000');
  });
});

// ---- Token compliance in components ----

describe('Design token compliance', () => {
  test('ClassifierApp uses token variables for semantic colors', () => {
    const src = readFileSync(resolve(ROOT, 'src/components/ClassifierApp.astro'), 'utf-8');
    expect(src).not.toMatch(/color:\s*#16a34a/);
    expect(src).not.toMatch(/color:\s*#d97706/);
    expect(src).not.toMatch(/color:\s*#dc2626/);
  });
});

// ---- JSDoc documentation ----

describe('Component prop documentation', () => {
  test('Button.astro props have JSDoc comments', () => {
    const src = readFileSync(resolve(ROOT, 'src/components/Button.astro'), 'utf-8');
    const propsBlock = src.split('interface Props')[1]?.split('}')[0] || '';
    expect(propsBlock).toContain('/**');
  });
});
