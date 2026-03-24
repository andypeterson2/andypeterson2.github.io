/**
 * @jest-environment jsdom
 */
// WP #765: Test: Token naming convention consistency
const fs = require('fs');
const path = require('path');

const tokensCSS = fs.readFileSync(path.resolve(__dirname, '..', 'tokens.css'), 'utf-8');

describe('Token naming convention consistency', () => {
  const allTokens = [...tokensCSS.matchAll(/--([\w-]+):/g)].map((m) => m[1]);
  const uniqueTokens = [...new Set(allTokens)];

  test('all tokens use lowercase', () => {
    uniqueTokens.forEach((token) => {
      expect(token).toBe(token.toLowerCase());
    });
  });

  test('all tokens use hyphens (not underscores)', () => {
    uniqueTokens.forEach((token) => {
      expect(token).not.toContain('_');
    });
  });

  test('surface tokens follow naming pattern', () => {
    const surfaceTokens = uniqueTokens.filter((t) => t.startsWith('surface'));
    expect(surfaceTokens.length).toBeGreaterThanOrEqual(3);
  });

  test('text tokens follow naming pattern', () => {
    const textTokens = uniqueTokens.filter((t) => t.startsWith('text-') && !t.match(/text-(xs|sm|base|lg|xl|2xl|3xl)/));
    expect(textTokens.length).toBeGreaterThanOrEqual(2);
  });

  test('accent tokens follow naming pattern', () => {
    const accentTokens = uniqueTokens.filter((t) => t.startsWith('accent'));
    expect(accentTokens.length).toBeGreaterThanOrEqual(4);
  });

  test('syntax tokens follow naming pattern', () => {
    const syntaxTokens = uniqueTokens.filter((t) => t.startsWith('syntax-'));
    expect(syntaxTokens.length).toBeGreaterThanOrEqual(4);
  });

  test('terminal tokens follow naming pattern', () => {
    const termTokens = uniqueTokens.filter((t) => t.startsWith('term-'));
    expect(termTokens.length).toBeGreaterThanOrEqual(5);
  });

  test('no duplicate token definitions in dark theme', () => {
    const rootMatch = tokensCSS.match(/:root\s*\{([^}]+)\}/s);
    if (rootMatch) {
      const rootTokens = [...rootMatch[1].matchAll(/--([\w-]+):/g)].map((m) => m[1]);
      const seen = new Set();
      rootTokens.forEach((t) => {
        expect(seen.has(t)).toBe(false);
        seen.add(t);
      });
    }
  });

  test('border tokens use consistent prefix', () => {
    const borderTokens = uniqueTokens.filter((t) => t.startsWith('border'));
    expect(borderTokens).toContain('border');
    expect(borderTokens).toContain('border-focus');
  });

  test('scrollbar tokens use consistent prefix', () => {
    const scrollbarTokens = uniqueTokens.filter((t) => t.startsWith('scrollbar'));
    expect(scrollbarTokens.length).toBeGreaterThanOrEqual(2);
  });
});
