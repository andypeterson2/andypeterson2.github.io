/**
 * @jest-environment jsdom
 */
// WP #759: Test: Typography scale and font loading
const fs = require('fs');
const path = require('path');

const tokensCSS = fs.readFileSync(path.resolve(__dirname, '..', 'tokens.css'), 'utf-8');
const baseCSS = fs.readFileSync(path.resolve(__dirname, '..', 'base.css'), 'utf-8');

describe('Typography scale and font loading', () => {
  test('font family token is defined', () => {
    expect(tokensCSS).toContain("--font:");
    expect(tokensCSS).toContain('Atkinson Hyperlegible');
  });

  test('monospace font family token is defined', () => {
    expect(tokensCSS).toContain('--font-mono:');
    expect(tokensCSS).toContain('monospace');
  });

  test('typography scale tokens exist in correct order', () => {
    const sizes = ['--text-xs:', '--text-sm:', '--text-base:', '--text-lg:', '--text-xl:', '--text-2xl:', '--text-3xl:'];
    sizes.forEach((size) => {
      expect(tokensCSS).toContain(size);
    });
  });

  test('typography scale values increase monotonically', () => {
    const sizeMap = {};
    const regex = /--(text-\w+):\s*(\d+)px/g;
    let match;
    while ((match = regex.exec(tokensCSS)) !== null) {
      sizeMap[match[1]] = parseInt(match[2]);
    }
    const ordered = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'];
    for (let i = 1; i < ordered.length; i++) {
      expect(sizeMap[ordered[i]]).toBeGreaterThan(sizeMap[ordered[i - 1]]);
    }
  });

  test('body uses font family token', () => {
    expect(baseCSS).toContain('var(--font)');
  });

  test('body sets font smoothing', () => {
    expect(baseCSS).toContain('-webkit-font-smoothing');
    expect(baseCSS).toContain('-moz-osx-font-smoothing');
  });

  test('body font size is set', () => {
    expect(baseCSS).toMatch(/font-size:\s*14px/);
  });
});
