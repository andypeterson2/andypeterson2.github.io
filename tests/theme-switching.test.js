/**
 * @jest-environment jsdom
 */
// WP #767: Test: Theme switching mechanism
const fs = require('fs');
const path = require('path');

function loadUIKit() {
  delete window.UIKit;
  eval(fs.readFileSync(path.resolve(__dirname, '..', 'icons.js'), 'utf-8'));
  eval(fs.readFileSync(path.resolve(__dirname, '..', 'ui-kit.js'), 'utf-8'));
  return window.UIKit;
}

describe('Theme switching mechanism', () => {
  let UIKit;
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    document.documentElement.dataset.theme = 'dark';
    UIKit = loadUIKit();
  });

  test('initThemeToggle returns API with setTheme and destroy', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    const api = UIKit.initThemeToggle(btn);
    expect(typeof api.setTheme).toBe('function');
    expect(typeof api.destroy).toBe('function');
  });

  test('setTheme changes theme without persisting', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    const api = UIKit.initThemeToggle(btn);
    api.setTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    // setTheme does not persist (click does)
    expect(localStorage.getItem('sm-theme')).toBeNull();
  });

  test('clicking toggle persists to localStorage', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    UIKit.initThemeToggle(btn);
    btn.click();
    expect(localStorage.getItem('sm-theme')).toBe('light');
  });

  test('toggle respects custom localStorage key', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    UIKit.initThemeToggle(btn, { key: 'custom-theme' });
    btn.click();
    expect(localStorage.getItem('custom-theme')).toBe('light');
  });

  test('destroy removes click listener', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    const api = UIKit.initThemeToggle(btn);

    api.destroy();
    const themeBefore = document.documentElement.dataset.theme;
    btn.click();
    expect(document.documentElement.dataset.theme).toBe(themeBefore);
  });

  test('multiple rapid toggles alternate correctly', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    UIKit.initThemeToggle(btn);

    for (let i = 0; i < 6; i++) btn.click();
    // Started dark, 6 clicks = back to dark
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  test('THEME_KEY matches between bootstrap and UIKit', () => {
    const bootstrapSrc = fs.readFileSync(path.resolve(__dirname, '..', 'theme-bootstrap.js'), 'utf-8');
    expect(bootstrapSrc).toContain('"sm-theme"');
    expect(UIKit.THEME_KEY).toBe('sm-theme');
  });
});
