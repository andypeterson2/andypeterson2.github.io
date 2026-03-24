/**
 * @jest-environment jsdom
 */
// WP #758: Test: Dark mode token switching for all components
const fs = require('fs');
const path = require('path');

const tokensCSS = fs.readFileSync(path.resolve(__dirname, '..', 'tokens.css'), 'utf-8');

function loadBootstrap() {
  delete document.documentElement.dataset.theme;
  eval(fs.readFileSync(path.resolve(__dirname, '..', 'theme-bootstrap.js'), 'utf-8'));
}

function loadUIKit() {
  delete window.UIKit;
  eval(fs.readFileSync(path.resolve(__dirname, '..', 'icons.js'), 'utf-8'));
  eval(fs.readFileSync(path.resolve(__dirname, '..', 'ui-kit.js'), 'utf-8'));
  return window.UIKit;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('Dark mode token switching', () => {
  test('tokens.css defines :root (dark) variables', () => {
    expect(tokensCSS).toMatch(/:root\s*\{/);
    expect(tokensCSS).toContain('--bg:');
    expect(tokensCSS).toContain('--text:');
    expect(tokensCSS).toContain('--accent:');
  });

  test('tokens.css defines [data-theme="light"] overrides', () => {
    expect(tokensCSS).toContain('[data-theme="light"]');
  });

  test('light theme overrides all major token categories', () => {
    const lightSection = tokensCSS.split('[data-theme="light"]')[1];
    expect(lightSection).toContain('--bg:');
    expect(lightSection).toContain('--text:');
    expect(lightSection).toContain('--accent:');
    expect(lightSection).toContain('--surface:');
    expect(lightSection).toContain('--border:');
    expect(lightSection).toContain('--success:');
    expect(lightSection).toContain('--danger:');
    expect(lightSection).toContain('--term-bg:');
    expect(lightSection).toContain('--scrollbar-track:');
  });

  test('prefers-color-scheme media query exists for no-JS fallback', () => {
    expect(tokensCSS).toContain('prefers-color-scheme: light');
    expect(tokensCSS).toContain(':root:not([data-theme])');
  });

  test('theme transition styles exist', () => {
    expect(tokensCSS).toContain('transition: background');
  });

  test('theme-bootstrap sets theme from localStorage', () => {
    localStorage.setItem('sm-theme', 'dark');
    loadBootstrap();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  test('theme-bootstrap defaults to light when no stored preference and no matchMedia', () => {
    // jsdom has no matchMedia dark mode support, so defaults to light
    loadBootstrap();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  test('theme toggle switches between dark and light', () => {
    document.documentElement.dataset.theme = 'dark';
    const UIKit = loadUIKit();
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    UIKit.initThemeToggle(btn);

    btn.click();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('sm-theme')).toBe('light');

    btn.click();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('sm-theme')).toBe('dark');
  });

  test('theme toggle sets aria-label', () => {
    document.documentElement.dataset.theme = 'dark';
    const UIKit = loadUIKit();
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    UIKit.initThemeToggle(btn);

    expect(btn.getAttribute('aria-label')).toBe('Switch to light mode');
    btn.click();
    expect(btn.getAttribute('aria-label')).toBe('Switch to dark mode');
  });

  test('theme syncs across tabs via storage event', () => {
    loadBootstrap();
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'sm-theme',
      newValue: 'dark',
    }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
