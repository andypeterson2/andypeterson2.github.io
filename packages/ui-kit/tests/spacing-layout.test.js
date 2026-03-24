/**
 * @jest-environment jsdom
 */
// WP #760: Test: Spacing and layout grid consistency
const fs = require('fs');
const path = require('path');

const baseCSS = fs.readFileSync(path.resolve(__dirname, '..', 'base.css'), 'utf-8');
const gridCSS = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'grid.css'), 'utf-8');
const layoutCSS = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'layout.css'), 'utf-8');

describe('Spacing and layout grid consistency', () => {
  test('box-sizing border-box reset is applied universally', () => {
    expect(baseCSS).toContain('box-sizing: border-box');
    expect(baseCSS).toMatch(/\*.*\{[^}]*box-sizing/s);
  });

  test('margin and padding reset is applied', () => {
    expect(baseCSS).toContain('margin: 0');
    expect(baseCSS).toContain('padding: 0');
  });

  test('body uses flex column layout', () => {
    expect(baseCSS).toContain('display: flex');
    expect(baseCSS).toContain('flex-direction: column');
  });

  test('body uses 100dvh height', () => {
    expect(baseCSS).toContain('100dvh');
  });

  test('grid component uses CSS grid or flex', () => {
    const usesGrid = gridCSS.includes('display: grid') || gridCSS.includes('display:grid');
    const usesFlex = gridCSS.includes('display: flex') || gridCSS.includes('display:flex');
    expect(usesGrid || usesFlex).toBe(true);
  });

  test('grid uses CSS custom properties for theming', () => {
    expect(gridCSS).toContain('var(--');
  });

  test('layout component defines app structure', () => {
    expect(layoutCSS).toContain('.app');
  });

  test('layout uses flex for main areas', () => {
    expect(layoutCSS).toContain('display: flex');
  });

  test('border-radius is zero everywhere (design system principle)', () => {
    expect(baseCSS).toContain('border-radius: 0');
  });

  test('scrollbar customization is defined', () => {
    expect(baseCSS).toContain('::-webkit-scrollbar');
    expect(baseCSS).toContain('width: 4px');
  });
});
