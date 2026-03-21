/**
 * WP #579-#588: Component and design system tests
 * WP #632: Token build pipeline output
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname!, '..');

describe('Design Token Source of Truth', () => {
  const tokensJson = JSON.parse(
    readFileSync(resolve(ROOT, 'src/tokens/tokens.json'), 'utf-8'),
  );

  test('tokens.json exists and has all categories', () => {
    expect(tokensJson.color).toBeDefined();
    expect(tokensJson.font).toBeDefined();
    expect(tokensJson.fontSize).toBeDefined();
    expect(tokensJson.space).toBeDefined();
    expect(tokensJson.layout).toBeDefined();
    expect(tokensJson.motion).toBeDefined();
  });

  test('all color tokens have dark values', () => {
    for (const [name, def] of Object.entries(tokensJson.color)) {
      expect((def as { value: string }).value).toBeTruthy();
    }
  });

  test('all color tokens have light overrides', () => {
    for (const [name, def] of Object.entries(tokensJson.color)) {
      expect((def as { light: string }).light).toBeTruthy();
    }
  });

  test('font tokens define sans and mono', () => {
    expect(tokensJson.font.sans.value).toContain('IBM Plex Sans');
    expect(tokensJson.font.mono.value).toContain('IBM Plex Mono');
  });

  test('fontSize tokens use clamp() for responsive sizing', () => {
    for (const [name, def] of Object.entries(tokensJson.fontSize)) {
      expect((def as { value: string }).value).toContain('clamp(');
    }
  });

  test('spacing scale is complete', () => {
    const expected = ['1', '2', '3', '4', '6', '8', '12', '16', '24', '32'];
    for (const key of expected) {
      expect(tokensJson.space[key]).toBeDefined();
    }
  });

  test('radius is zero (design principle)', () => {
    expect(tokensJson.layout.radius.value).toBe('0');
  });
});

describe('Token CSS Output', () => {
  const tokensCss = readFileSync(
    resolve(ROOT, 'src/styles/tokens.css'),
    'utf-8',
  );

  test('defines :root with dark theme variables', () => {
    expect(tokensCss).toMatch(/:root\s*\{/);
    expect(tokensCss).toContain('--color-bg:');
    expect(tokensCss).toContain('--color-text:');
    expect(tokensCss).toContain('--color-accent:');
  });

  test('defines light theme overrides', () => {
    expect(tokensCss).toContain('[data-theme=\'light\']');
  });

  test('includes prefers-color-scheme fallback', () => {
    expect(tokensCss).toContain('prefers-color-scheme: light');
  });

  test('includes prefers-reduced-motion', () => {
    expect(tokensCss).toContain('prefers-reduced-motion');
  });

  test('defines spacing tokens', () => {
    expect(tokensCss).toContain('--space-1:');
    expect(tokensCss).toContain('--space-4:');
    expect(tokensCss).toContain('--space-16:');
  });

  test('defines typography tokens with clamp()', () => {
    expect(tokensCss).toContain('--text-base:');
    expect(tokensCss).toContain('clamp(');
  });
});

describe('Token Build Pipeline', () => {
  test('generated CSS file exists', () => {
    expect(existsSync(resolve(ROOT, 'src/tokens/tokens.generated.css'))).toBe(true);
  });

  test('generated TS file exists', () => {
    expect(existsSync(resolve(ROOT, 'src/tokens/tokens.generated.ts'))).toBe(true);
  });

  test('generated CSS contains custom properties', () => {
    const css = readFileSync(
      resolve(ROOT, 'src/tokens/tokens.generated.css'),
      'utf-8',
    );
    expect(css).toContain(':root {');
    expect(css).toContain('--color-');
  });

  test('generated TS exports token object', () => {
    const ts = readFileSync(
      resolve(ROOT, 'src/tokens/tokens.generated.ts'),
      'utf-8',
    );
    expect(ts).toContain('export const tokens');
  });
});

describe('Base CSS', () => {
  const baseCss = readFileSync(resolve(ROOT, 'src/styles/base.css'), 'utf-8');

  test('includes box-sizing reset', () => {
    expect(baseCss).toContain('box-sizing: border-box');
  });

  test('body uses token variables', () => {
    expect(baseCss).toContain('var(--color-bg)');
    expect(baseCss).toContain('var(--color-text)');
    expect(baseCss).toContain('var(--font-sans)');
  });

  test('defines heading styles', () => {
    expect(baseCss).toMatch(/h1[\s,{]/);
    expect(baseCss).toContain('var(--text-4xl)');
  });

  test('link styles use accent color', () => {
    expect(baseCss).toContain('var(--color-accent)');
  });

  test('focus-visible styles are defined', () => {
    expect(baseCss).toContain(':focus-visible');
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
  const components = [
    'Button.astro',
    'Card.astro',
    'Tag.astro',
    'SectionLabel.astro',
    'InlineCode.astro',
    'CodeBlock.astro',
    'InvertedSection.astro',
  ];

  test.each(components)('%s component exists', (filename) => {
    expect(
      existsSync(resolve(ROOT, 'src/components', filename)),
    ).toBe(true);
  });
});

describe('Button Component', () => {
  const buttonSrc = readFileSync(
    resolve(ROOT, 'src/components/Button.astro'),
    'utf-8',
  );

  test('supports variant prop', () => {
    expect(buttonSrc).toContain('variant');
    expect(buttonSrc).toContain('primary');
    expect(buttonSrc).toContain('secondary');
    expect(buttonSrc).toContain('ghost');
  });

  test('supports size prop', () => {
    expect(buttonSrc).toContain('size');
    expect(buttonSrc).toContain('btn-sm');
    expect(buttonSrc).toContain('btn-lg');
  });

  test('uses token variables for styling', () => {
    expect(buttonSrc).toContain('var(--color-');
    expect(buttonSrc).toContain('var(--duration-');
  });

  test('supports href for link-style buttons', () => {
    expect(buttonSrc).toContain('href');
  });
});

describe('Card Component', () => {
  const cardSrc = readFileSync(
    resolve(ROOT, 'src/components/Card.astro'),
    'utf-8',
  );

  test('uses token variables', () => {
    expect(cardSrc).toContain('var(--color-surface)');
    expect(cardSrc).toContain('var(--color-border)');
  });

  test('supports title prop', () => {
    expect(cardSrc).toContain('title');
  });

  test('supports href for link cards', () => {
    expect(cardSrc).toContain('href');
  });

  test('has hover transition', () => {
    expect(cardSrc).toContain('transition');
  });
});

describe('Tag Component', () => {
  const tagSrc = readFileSync(
    resolve(ROOT, 'src/components/Tag.astro'),
    'utf-8',
  );

  test('supports variant prop', () => {
    expect(tagSrc).toContain('variant');
    expect(tagSrc).toContain('accent');
    expect(tagSrc).toContain('teal');
    expect(tagSrc).toContain('purple');
  });

  test('uses mono font', () => {
    expect(tagSrc).toContain('var(--font-mono)');
  });
});

describe('SectionLabel Component', () => {
  const src = readFileSync(
    resolve(ROOT, 'src/components/SectionLabel.astro'),
    'utf-8',
  );

  test('renders label text', () => {
    expect(src).toContain('label');
  });

  test('has decorative line', () => {
    expect(src).toContain('section-label-line');
  });
});

describe('InlineCode Component', () => {
  const src = readFileSync(
    resolve(ROOT, 'src/components/InlineCode.astro'),
    'utf-8',
  );

  test('uses mono font', () => {
    expect(src).toContain('var(--font-mono)');
  });

  test('uses surface background', () => {
    expect(src).toContain('var(--color-surface');
  });
});

describe('CodeBlock Component', () => {
  const src = readFileSync(
    resolve(ROOT, 'src/components/CodeBlock.astro'),
    'utf-8',
  );

  test('supports filename prop', () => {
    expect(src).toContain('filename');
  });

  test('supports language prop', () => {
    expect(src).toContain('language');
  });

  test('uses token colors', () => {
    expect(src).toContain('var(--color-');
  });
});

describe('InvertedSection Component', () => {
  const src = readFileSync(
    resolve(ROOT, 'src/components/InvertedSection.astro'),
    'utf-8',
  );

  test('uses surface background', () => {
    expect(src).toContain('var(--color-surface)');
  });

  test('uses border', () => {
    expect(src).toContain('var(--color-border)');
  });
});

describe('Site Configuration', () => {
  const siteSrc = readFileSync(
    resolve(ROOT, 'src/config/site.ts'),
    'utf-8',
  );

  test('reads from environment variables', () => {
    expect(siteSrc).toContain('import.meta.env');
  });

  test('defines SiteConfig interface', () => {
    expect(siteSrc).toContain('interface SiteConfig');
  });

  test('exports siteConfig', () => {
    expect(siteSrc).toContain('export const siteConfig');
  });

  test('has displayName field', () => {
    expect(siteSrc).toContain('displayName');
  });
});

describe('Responsive Type Sizing', () => {
  const tokensCss = readFileSync(
    resolve(ROOT, 'src/styles/tokens.css'),
    'utf-8',
  );

  test('all text-* tokens use clamp()', () => {
    const textTokenLines = tokensCss
      .split('\n')
      .filter((l) => l.includes('--text-') && l.includes(':'));
    for (const line of textTokenLines) {
      if (line.includes('clamp(') || line.includes('--text-inverse') || line.includes('--text-secondary') || line.includes('--text-muted')) {
        continue;
      }
      // Lines defining text-xs through text-4xl should use clamp
      const match = line.match(/--text-(xs|sm|base|lg|xl|2xl|3xl|4xl)/);
      if (match) {
        expect(line).toContain('clamp(');
      }
    }
  });
});
