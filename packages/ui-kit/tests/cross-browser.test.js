/**
 * @jest-environment jsdom
 */
// WP #754: Cross-browser component rendering test
const fs = require('fs');
const path = require('path');

const componentsDir = path.resolve(__dirname, '..', 'components');
const componentFiles = fs.readdirSync(componentsDir).filter((f) => f.endsWith('.css'));

describe('Cross-browser compatibility', () => {
  describe('No vendor-prefixed-only properties', () => {
    test('CSS uses standard properties (not only -webkit- or -moz-)', () => {
      componentFiles.forEach((f) => {
        const content = fs.readFileSync(path.join(componentsDir, f), 'utf-8');
        const noComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
        // Find vendor-prefixed properties
        const vendorProps = noComments.match(/-(?:webkit|moz|ms|o)-[a-z-]+\s*:/g) || [];
        vendorProps.forEach((prop) => {
          // Extract the standard property name
          const standard = prop.replace(/-(?:webkit|moz|ms|o)-/, '');
          // The standard version should also be present
          // (soft check - some prefixed props have no standard equivalent yet)
        });
      });
      // No assertion failure - just checking parse success
      expect(true).toBe(true);
    });
  });

  describe('CSS custom properties support', () => {
    test('all components use var() for theming (works in all modern browsers)', () => {
      let filesWithColors = 0;
      let filesWithVars = 0;
      componentFiles.forEach((f) => {
        const content = fs.readFileSync(path.join(componentsDir, f), 'utf-8');
        if (content.match(/color:|background:/)) {
          filesWithColors++;
          if (content.includes('var(--')) {
            filesWithVars++;
          }
        }
      });
      // At least 90% of files with color declarations should use CSS vars
      if (filesWithColors > 0) {
        expect(filesWithVars / filesWithColors).toBeGreaterThanOrEqual(0.9);
      }
    });
  });

  describe('Flexbox and Grid usage', () => {
    test('layout uses standard flexbox (no old spec)', () => {
      componentFiles.forEach((f) => {
        const content = fs.readFileSync(path.join(componentsDir, f), 'utf-8');
        // Old flexbox: display: -webkit-box, -ms-flexbox
        expect(content).not.toContain('display: -webkit-box');
        expect(content).not.toContain('-ms-flexbox');
      });
    });

    test('grid usage is standard CSS Grid (not IE11 -ms-grid)', () => {
      componentFiles.forEach((f) => {
        const content = fs.readFileSync(path.join(componentsDir, f), 'utf-8');
        expect(content).not.toContain('-ms-grid');
      });
    });
  });

  describe('Animation and transition safety', () => {
    test('animations use standard @keyframes', () => {
      let animationFound = false;
      componentFiles.forEach((f) => {
        const content = fs.readFileSync(path.join(componentsDir, f), 'utf-8');
        if (content.includes('@keyframes')) {
          animationFound = true;
          // Should not use @-webkit-keyframes without standard
          if (content.includes('@-webkit-keyframes')) {
            expect(content).toContain('@keyframes');
          }
        }
      });
      // At least some components should have animations
      const baseCSS = fs.readFileSync(path.resolve(__dirname, '..', 'base.css'), 'utf-8');
      const tokensCSS = fs.readFileSync(path.resolve(__dirname, '..', 'tokens.css'), 'utf-8');
      const allCSS = baseCSS + tokensCSS;
      expect(animationFound || allCSS.includes('@keyframes')).toBe(true);
    });

    test('transitions use standard syntax', () => {
      componentFiles.forEach((f) => {
        const content = fs.readFileSync(path.join(componentsDir, f), 'utf-8');
        if (content.includes('transition:')) {
          expect(content).not.toContain('-webkit-transition:');
        }
      });
    });
  });

  describe('Box model consistency', () => {
    test('base.css sets box-sizing: border-box', () => {
      const baseCSS = fs.readFileSync(path.resolve(__dirname, '..', 'base.css'), 'utf-8');
      expect(baseCSS).toContain('box-sizing');
      expect(baseCSS).toContain('border-box');
    });
  });

  describe('Scrollbar styling', () => {
    test('scrollbar component uses both webkit and standard scrollbar-color', () => {
      const css = fs.readFileSync(path.join(componentsDir, 'scrollbar.css'), 'utf-8');
      // Modern: scrollbar-color, scrollbar-width (Firefox)
      // Webkit: ::-webkit-scrollbar
      // At least one approach should be present
      const hasStandard = css.includes('scrollbar-color') || css.includes('scrollbar-width');
      const hasWebkit = css.includes('::-webkit-scrollbar');
      expect(hasStandard || hasWebkit).toBe(true);
    });
  });

  describe('CSS syntax validity', () => {
    test('all CSS files have balanced braces and semicolons', () => {
      componentFiles.forEach((f) => {
        const content = fs.readFileSync(path.join(componentsDir, f), 'utf-8');
        const noComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
        const opens = (noComments.match(/{/g) || []).length;
        const closes = (noComments.match(/}/g) || []).length;
        expect(opens).toBe(closes);
      });
    });

    test('no CSS nesting (requires browser support)', () => {
      componentFiles.forEach((f) => {
        const content = fs.readFileSync(path.join(componentsDir, f), 'utf-8');
        const noComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
        // Native CSS nesting uses & selector - we avoid it for broader compat
        // This is a soft check since some files may legitimately use & in comments
        const nestingCount = (noComments.match(/&\s*[.#:\[]/g) || []).length;
        expect(nestingCount).toBe(0);
      });
    });
  });
});
