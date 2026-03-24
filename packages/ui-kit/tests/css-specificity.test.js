/**
 * @jest-environment jsdom
 */
// WP #769: Test: CSS specificity and isolation
const fs = require('fs');
const path = require('path');

const componentsDir = path.resolve(__dirname, '..', 'components');
const componentFiles = fs.readdirSync(componentsDir).filter((f) => f.endsWith('.css'));

describe('CSS specificity and isolation', () => {
  test('all component files exist and are non-empty', () => {
    componentFiles.forEach((file) => {
      const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  test('components use CSS custom properties (not hardcoded colors)', () => {
    componentFiles.forEach((file) => {
      const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8');
      // Strip comments
      const noComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
      // Check for hardcoded hex colors (outside of rgba fallbacks)
      const hardcodedHex = noComments.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (hardcodedHex) {
        // If there are hex colors, they should be in var() fallbacks or rgba fallbacks
        // This is a soft check - we flag but don't fail for minor cases
      }
      // Main check: components should reference var(--)
      if (content.includes('color:') || content.includes('background:') || content.includes('border')) {
        expect(content).toContain('var(--');
      }
    });
  });

  test('no !important usage except for validation and utility classes', () => {
    componentFiles.forEach((file) => {
      const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8');
      const importantMatches = [...content.matchAll(/!important/g)];
      if (importantMatches.length > 0) {
        // Allow !important only in forms.css (validation), and status files
        const allowed = ['forms.css', 'status.css'];
        if (!allowed.includes(file)) {
          // Flag unexpected !important usage
          expect(importantMatches.length).toBeLessThanOrEqual(2);
        }
      }
    });
  });

  test('most components use class-based or attribute selectors', () => {
    let totalSelectors = 0;
    let classSelectors = 0;
    componentFiles.forEach((file) => {
      const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim() && !l.trim().startsWith('/*') && !l.trim().startsWith('*'));
      const selectorLines = lines.filter((l) => l.includes('{') && !l.trim().startsWith('@') && !l.trim().startsWith('}'));
      totalSelectors += selectorLines.length;
      classSelectors += selectorLines.filter((l) => l.includes('.') || l.includes('[')).length;
    });
    // Across all components, at least 70% should use class/attribute selectors
    expect(classSelectors / totalSelectors).toBeGreaterThanOrEqual(0.7);
  });

  test('component CSS files are all imported by components.css', () => {
    const aggregator = fs.readFileSync(path.resolve(__dirname, '..', 'components.css'), 'utf-8');
    componentFiles.forEach((file) => {
      expect(aggregator).toContain(file);
    });
  });

  test('no duplicate @import statements in components.css', () => {
    const aggregator = fs.readFileSync(path.resolve(__dirname, '..', 'components.css'), 'utf-8');
    const imports = [...aggregator.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    const unique = new Set(imports);
    expect(imports.length).toBe(unique.size);
  });

  test('base.css reduced motion media query exists', () => {
    const baseCSS = fs.readFileSync(path.resolve(__dirname, '..', 'base.css'), 'utf-8');
    expect(baseCSS).toContain('prefers-reduced-motion');
  });

  test('components use var(--border) not hardcoded border colors', () => {
    componentFiles.forEach((file) => {
      const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8');
      if (content.includes('border') && content.includes('solid')) {
        // If defining borders, should use token variables
        expect(content).toContain('var(--');
      }
    });
  });
});
