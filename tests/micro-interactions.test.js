/**
 * @jest-environment jsdom
 */
// WP #770: Test: Micro-interaction animations
const fs = require('fs');
const path = require('path');

const componentsDir = path.resolve(__dirname, '..', 'components');
const tokensCSS = fs.readFileSync(path.resolve(__dirname, '..', 'tokens.css'), 'utf-8');
const baseCSS = fs.readFileSync(path.resolve(__dirname, '..', 'base.css'), 'utf-8');

describe('Micro-interaction animations', () => {
  describe('Transition tokens', () => {
    test('duration tokens are defined', () => {
      expect(tokensCSS).toContain('--duration-fast');
      expect(tokensCSS).toContain('--duration-normal');
    });

    test('theme transition is smooth', () => {
      expect(tokensCSS).toMatch(/transition:\s*background/);
    });
  });

  describe('Button interactions', () => {
    test('button has hover transition', () => {
      const css = fs.readFileSync(path.join(componentsDir, 'buttons.css'), 'utf-8');
      expect(css).toContain('transition');
    });

    test('button has active/pressed state', () => {
      const css = fs.readFileSync(path.join(componentsDir, 'buttons.css'), 'utf-8');
      expect(css).toMatch(/:active/);
    });

    test('button loading state has animation', () => {
      const css = fs.readFileSync(path.join(componentsDir, 'buttons.css'), 'utf-8');
      expect(css).toMatch(/loading|spinner|animate/i);
    });
  });

  describe('Card interactions', () => {
    test('interactive card has hover effect', () => {
      const css = fs.readFileSync(path.join(componentsDir, 'cards.css'), 'utf-8');
      expect(css).toContain('transition');
      expect(css).toMatch(/:hover|card-interactive/);
    });
  });

  describe('Drawer animations', () => {
    test('drawer has slide transition', () => {
      const css = fs.readFileSync(path.join(componentsDir, 'drawers.css'), 'utf-8');
      expect(css).toContain('transition');
    });
  });

  describe('Toast notifications', () => {
    test('toast has entrance animation', () => {
      const css = fs.readFileSync(path.join(componentsDir, 'toasts.css'), 'utf-8');
      expect(css).toMatch(/animation|transition|@keyframes/);
    });
  });

  describe('Fade utility', () => {
    test('fade component defines opacity transition', () => {
      const css = fs.readFileSync(path.join(componentsDir, 'fade.css'), 'utf-8');
      expect(css).toContain('opacity');
      expect(css).toContain('transition');
    });
  });

  describe('Spinner animation', () => {
    test('spinner has rotation animation', () => {
      const css = fs.readFileSync(path.join(componentsDir, 'spinner.css'), 'utf-8');
      expect(css).toMatch(/@keyframes|animation/);
    });
  });

  describe('Icon animations', () => {
    test('icon-spin class uses rotation keyframes', () => {
      const css = fs.readFileSync(path.join(componentsDir, 'icons.css'), 'utf-8');
      expect(css).toContain('icon-spin');
      expect(css).toMatch(/@keyframes|animation/);
    });
  });

  describe('Skeleton loading', () => {
    test('skeleton has shimmer/pulse animation', () => {
      const css = fs.readFileSync(path.join(componentsDir, 'skeleton.css'), 'utf-8');
      expect(css).toMatch(/@keyframes|animation/);
    });
  });

  describe('Collapsible', () => {
    test('collapsible has height/opacity transition', () => {
      const css = fs.readFileSync(path.join(componentsDir, 'collapsible.css'), 'utf-8');
      expect(css).toContain('transition');
    });
  });

  describe('Reduced motion respect', () => {
    test('prefers-reduced-motion disables animations', () => {
      const combined = tokensCSS + baseCSS;
      expect(combined).toContain('prefers-reduced-motion');
    });
  });
});
