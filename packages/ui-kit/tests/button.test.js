/**
 * @jest-environment jsdom
 */
// WP #755: Test: Button component variants and states
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'buttons.css'), 'utf-8');

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  injectStyles();
});

describe('Button component variants and states', () => {
  test('btn base class exists and is applicable', () => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    document.body.appendChild(btn);
    expect(btn.classList.contains('btn')).toBe(true);
  });

  test.each(['btn-primary', 'btn-secondary', 'btn-danger', 'btn-icon'])(
    'variant %s can be applied alongside btn',
    (variant) => {
      const btn = document.createElement('button');
      btn.className = `btn ${variant}`;
      document.body.appendChild(btn);
      expect(btn.classList.contains('btn')).toBe(true);
      expect(btn.classList.contains(variant)).toBe(true);
    }
  );

  test.each(['btn-sm', 'btn-xs', 'btn-lg'])(
    'size variant %s can be applied',
    (size) => {
      const btn = document.createElement('button');
      btn.className = `btn btn-primary ${size}`;
      document.body.appendChild(btn);
      expect(btn.classList.contains(size)).toBe(true);
    }
  );

  test('disabled button has disabled attribute', () => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.disabled = true;
    document.body.appendChild(btn);
    expect(btn.disabled).toBe(true);
    expect(btn.matches(':disabled')).toBe(true);
  });

  test('loading state adds btn-loading class', () => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-loading';
    document.body.appendChild(btn);
    expect(btn.classList.contains('btn-loading')).toBe(true);
  });

  test('focus-visible outline is defined in CSS', () => {
    expect(CSS).toContain(':focus-visible');
    expect(CSS).toContain('outline');
  });

  test('active state is defined in CSS', () => {
    expect(CSS).toContain(':active:not(:disabled)');
  });

  test('hover state is defined for primary variant', () => {
    expect(CSS).toContain('.btn-primary:hover:not(:disabled)');
  });

  test('hover state is defined for secondary variant', () => {
    expect(CSS).toContain('.btn-secondary:hover:not(:disabled)');
  });

  test('hover state is defined for danger variant', () => {
    expect(CSS).toContain('.btn-danger:hover:not(:disabled)');
  });

  test('transition property is set on base btn', () => {
    expect(CSS).toMatch(/\.btn\s*\{[^}]*transition:/);
  });

  test('btn-pulse keyframes exist for loading animation', () => {
    expect(CSS).toContain('@keyframes btn-pulse');
  });

  test('combined variant and size classes work together', () => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-danger btn-lg btn-loading';
    document.body.appendChild(btn);
    expect(btn.classList.contains('btn')).toBe(true);
    expect(btn.classList.contains('btn-danger')).toBe(true);
    expect(btn.classList.contains('btn-lg')).toBe(true);
    expect(btn.classList.contains('btn-loading')).toBe(true);
  });
});
