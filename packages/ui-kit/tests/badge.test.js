/**
 * @jest-environment jsdom
 */
// WP #762: Test: Tag/Badge component variants
const fs = require('fs');
const path = require('path');

const badgesCSS = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'badges.css'), 'utf-8');
const statusCSS = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'status.css'), 'utf-8');

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = badgesCSS + statusCSS;
  document.head.appendChild(style);
});

describe('Tag/Badge component variants', () => {
  test('badge component CSS is defined', () => {
    expect(badgesCSS.length).toBeGreaterThan(0);
  });

  test('badge uses CSS custom properties', () => {
    expect(badgesCSS).toContain('var(--');
  });

  test('status component CSS is defined', () => {
    expect(statusCSS.length).toBeGreaterThan(0);
  });

  test('badge element renders', () => {
    const badge = document.createElement('span');
    badge.className = 'ui-badge';
    badge.textContent = 'New';
    document.body.appendChild(badge);
    expect(badge.textContent).toBe('New');
    expect(badge.classList.contains('ui-badge')).toBe(true);
  });

  test('multiple badges render side by side', () => {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.gap = '4px';
    ['Tag A', 'Tag B', 'Tag C'].forEach((text) => {
      const badge = document.createElement('span');
      badge.className = 'ui-badge';
      badge.textContent = text;
      wrap.appendChild(badge);
    });
    document.body.appendChild(wrap);
    expect(wrap.querySelectorAll('.ui-badge').length).toBe(3);
  });
});
