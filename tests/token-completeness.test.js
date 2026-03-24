/**
 * @jest-environment jsdom
 */
// WP #764: Test: CSS custom property token completeness
const fs = require('fs');
const path = require('path');

const tokensCSS = fs.readFileSync(path.resolve(__dirname, '..', 'tokens.css'), 'utf-8');

function extractTokens(css, selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]+)\\}', 's');
  const match = css.match(re);
  if (!match) return [];
  return [...match[1].matchAll(/--([\w-]+):/g)].map((m) => m[1]);
}

describe('CSS custom property token completeness', () => {
  const darkTokens = extractTokens(tokensCSS, ':root');
  const lightTokens = extractTokens(tokensCSS, '[data-theme="light"]');

  test('dark theme defines surface tokens', () => {
    ['bg', 'surface', 'surface2', 'surface-muted', 'surface-hl'].forEach((t) => {
      expect(darkTokens).toContain(t);
    });
  });

  test('dark theme defines text tokens', () => {
    ['text', 'text-secondary', 'text-muted', 'text-inverse'].forEach((t) => {
      expect(darkTokens).toContain(t);
    });
  });

  test('dark theme defines accent tokens', () => {
    ['accent', 'accent-hover', 'accent-teal', 'accent-olive', 'accent-brown', 'accent-dark'].forEach((t) => {
      expect(darkTokens).toContain(t);
    });
  });

  test('dark theme defines semantic tokens', () => {
    ['success', 'warn', 'danger'].forEach((t) => {
      expect(darkTokens).toContain(t);
    });
  });

  test('dark theme defines border tokens', () => {
    ['border', 'border-focus', 'focus-ring'].forEach((t) => {
      expect(darkTokens).toContain(t);
    });
  });

  test('dark theme defines syntax tokens', () => {
    ['syntax-string', 'syntax-keyword', 'syntax-function', 'syntax-comment', 'syntax-type'].forEach((t) => {
      expect(darkTokens).toContain(t);
    });
  });

  test('dark theme defines terminal tokens', () => {
    ['term-bg', 'term-scrollbar', 'term-time', 'term-text', 'term-ok', 'term-warn', 'term-err'].forEach((t) => {
      expect(darkTokens).toContain(t);
    });
  });

  test('dark theme defines typography tokens', () => {
    ['font', 'font-mono', 'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'].forEach((t) => {
      expect(darkTokens).toContain(t);
    });
  });

  test('dark theme defines motion tokens', () => {
    ['duration-fast', 'duration-normal'].forEach((t) => {
      expect(darkTokens).toContain(t);
    });
  });

  test('light theme overrides all color tokens from dark theme', () => {
    const colorTokens = darkTokens.filter((t) =>
      !['font', 'font-mono', 'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl',
        'text-2xl', 'text-3xl', 'radius', 'duration-fast', 'duration-normal'].includes(t)
    );
    colorTokens.forEach((t) => {
      expect(lightTokens).toContain(t);
    });
  });
});
