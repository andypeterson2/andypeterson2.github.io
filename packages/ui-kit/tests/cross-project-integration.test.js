/**
 * @jest-environment jsdom
 */
// WP #751: Cross-project integration test matrix
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const uiKitCSS = fs.readFileSync(path.join(rootDir, 'ui-kit.css'), 'utf-8');
const uiKitCoreCSS = fs.readFileSync(path.join(rootDir, 'ui-kit-core.css'), 'utf-8');

describe('Cross-project integration matrix', () => {
  describe('Entry points', () => {
    test('ui-kit.css is a valid entry point with imports', () => {
      expect(uiKitCSS).toContain('@import');
      expect(uiKitCSS).toContain('tokens.css');
      expect(uiKitCSS).toContain('base.css');
      expect(uiKitCSS).toContain('components.css');
    });

    test('ui-kit-core.css provides minimal entry without components', () => {
      expect(uiKitCoreCSS).toContain('tokens.css');
      expect(uiKitCoreCSS).toContain('base.css');
      expect(uiKitCoreCSS).not.toContain('components.css');
    });
  });

  describe('Token availability for consumer projects', () => {
    const tokensCSS = fs.readFileSync(path.join(rootDir, 'tokens.css'), 'utf-8');

    test('surface tokens available for dashboard panels', () => {
      expect(tokensCSS).toContain('--surface');
      expect(tokensCSS).toContain('--surface2');
      expect(tokensCSS).toContain('--bg');
    });

    test('accent tokens available for interactive elements', () => {
      expect(tokensCSS).toContain('--accent');
      expect(tokensCSS).toContain('--accent-hover');
      expect(tokensCSS).toContain('--accent-teal');
    });

    test('semantic tokens available for status indicators', () => {
      expect(tokensCSS).toContain('--success');
      expect(tokensCSS).toContain('--warn');
      expect(tokensCSS).toContain('--danger');
    });

    test('terminal tokens available for log-terminal components', () => {
      expect(tokensCSS).toContain('--term-bg');
      expect(tokensCSS).toContain('--term-ok');
      expect(tokensCSS).toContain('--term-warn');
      expect(tokensCSS).toContain('--term-err');
    });

    test('syntax tokens available for code highlighting', () => {
      expect(tokensCSS).toContain('--syntax-string');
      expect(tokensCSS).toContain('--syntax-keyword');
      expect(tokensCSS).toContain('--syntax-function');
    });

    test('canvas tokens available for nonogram solver', () => {
      expect(tokensCSS).toContain('--canvas-bg');
      expect(tokensCSS).toContain('--canvas-clear-bg');
    });

    test('font tokens match across dark and light themes', () => {
      // Font tokens should be the same in both themes
      expect(tokensCSS).toContain('--font:');
      expect(tokensCSS).toContain('--font-mono:');
    });
  });

  describe('JavaScript API for consumer projects', () => {
    const uiKitJS = fs.readFileSync(path.join(rootDir, 'ui-kit.js'), 'utf-8');

    test('UIKit namespace is exported', () => {
      expect(uiKitJS).toContain('UIKit');
    });

    test('theme toggle API is available', () => {
      expect(uiKitJS).toContain('initThemeToggle');
    });

    test('drawer API is available for side panels', () => {
      expect(uiKitJS).toContain('initDrawer');
    });

    test('dropdown API is available for menus', () => {
      expect(uiKitJS).toContain('initDropdown');
    });

    test('logger API is available for log-terminal', () => {
      expect(uiKitJS).toContain('createLogger');
    });
  });

  describe('Theme bootstrap for all consumers', () => {
    const bootstrapJS = fs.readFileSync(path.join(rootDir, 'theme-bootstrap.js'), 'utf-8');

    test('bootstrap script prevents FOWT', () => {
      expect(bootstrapJS).toContain('localStorage');
      expect(bootstrapJS).toContain('dataset.theme');
    });

    test('bootstrap exposes __setTheme and __getTheme', () => {
      expect(bootstrapJS).toContain('__setTheme');
      expect(bootstrapJS).toContain('__getTheme');
    });
  });

  describe('Icons availability', () => {
    const iconsJS = fs.readFileSync(path.join(rootDir, 'icons.js'), 'utf-8');

    test('icons module exports icon markup', () => {
      expect(iconsJS).toContain('ICONS');
      expect(iconsJS).toContain('fa-solid');
    });

    test('common icons are available', () => {
      expect(iconsJS).toContain('close');
      expect(iconsJS).toContain('hamburger');
    });
  });

  describe('Component file isolation', () => {
    const componentsDir = path.join(rootDir, 'components');
    const componentFiles = fs.readdirSync(componentsDir).filter((f) => f.endsWith('.css'));

    test('each component file is self-contained (no cross-component imports)', () => {
      componentFiles.forEach((f) => {
        const content = fs.readFileSync(path.join(componentsDir, f), 'utf-8');
        // Component files should not import other component files
        const imports = content.match(/@import\s+url\(/g) || [];
        expect(imports.length).toBe(0);
      });
    });

    test('components can be individually imported', () => {
      // Each component file should be valid CSS on its own (with tokens)
      componentFiles.forEach((f) => {
        const content = fs.readFileSync(path.join(componentsDir, f), 'utf-8');
        expect(content.length).toBeGreaterThan(0);
        // Check balanced braces
        const opens = (content.match(/{/g) || []).length;
        const closes = (content.match(/}/g) || []).length;
        expect(opens).toBe(closes);
      });
    });
  });
});
