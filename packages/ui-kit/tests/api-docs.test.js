/**
 * @jest-environment jsdom
 */
// WP #766: Test: Component API documentation accuracy
const fs = require('fs');
const path = require('path');

const apiDoc = fs.readFileSync(path.resolve(__dirname, '..', 'API.md'), 'utf-8');

function loadUIKit() {
  delete window.UIKit;
  eval(fs.readFileSync(path.resolve(__dirname, '..', 'icons.js'), 'utf-8'));
  eval(fs.readFileSync(path.resolve(__dirname, '..', 'ui-kit.js'), 'utf-8'));
  return window.UIKit;
}

describe('Component API documentation accuracy', () => {
  let UIKit;
  beforeEach(() => {
    document.body.innerHTML = '';
    UIKit = loadUIKit();
  });

  test('API.md exists and has content', () => {
    expect(apiDoc.length).toBeGreaterThan(100);
  });

  test('API.md documents initThemeToggle', () => {
    expect(apiDoc).toContain('initThemeToggle');
  });

  test('API.md documents initDrawer', () => {
    expect(apiDoc).toContain('initDrawer');
  });

  test('API.md documents initDropdown', () => {
    expect(apiDoc).toContain('initDropdown');
  });

  test('API.md documents onEscape', () => {
    expect(apiDoc).toContain('onEscape');
  });

  test('API.md documents createLogger', () => {
    expect(apiDoc).toContain('createLogger');
  });

  test('API.md documents toast', () => {
    expect(apiDoc).toContain('toast');
  });

  test('API.md documents initFadeIn', () => {
    expect(apiDoc).toContain('initFadeIn');
  });

  test('API.md documents initConnect', () => {
    expect(apiDoc).toContain('initConnect');
  });

  test('API.md documents initResize', () => {
    expect(apiDoc).toContain('initResize');
  });

  test('all documented methods exist on UIKit object', () => {
    const expectedMethods = [
      'initThemeToggle', 'initDrawer', 'initDropdown', 'onEscape',
      'initResize', 'createLogger', 'toast', 'dismissToast', 'initFadeIn', 'initConnect'
    ];
    expectedMethods.forEach((method) => {
      expect(typeof UIKit[method]).toBe('function');
    });
  });

  test('theme key is documented', () => {
    expect(apiDoc).toContain('sm-theme');
    expect(UIKit.THEME_KEY).toBe('sm-theme');
  });

  test('UIKit.ICONS is documented and available', () => {
    expect(apiDoc).toContain('ICONS');
    expect(typeof UIKit.ICONS).toBe('object');
  });
});
